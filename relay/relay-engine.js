// ---------------------------------------------------------------------------
// Relay Engine — Browser File System Access API
// Ports core/scanner.py + core/tracker.py to browser-native folder handles.
// ---------------------------------------------------------------------------

const RelayEngine = (function () {

    const RELAY_DIR_NAME = 'RGR Relay';
    const TRACKER_FILENAME = 'project_tracker.json';
    const ACTIVITY_LOG_FILENAME = 'activity_log.jsonl';
    const SNAPSHOTS_DIR_NAME = 'backups';

    // Naming scheme: proj.type.name.ver  (ver = digits or 'M')
    const SCHEME_RE = /^(?<proj>[^.]+)\.(?<type>[^.]+)\.(?<n>[^.]+)\.(?<ver>\d+|M)$/;
    const PLAYBLAST_RE = /^(?<proj>[^.]+)\.(?<type>[^.]+)\.(?<n>[^.]+)\.(?<ver>\d+)(?:-v(?<iter>\d+))?$/;

    const DEFAULT_EXCLUDED_EXTENSIONS = [
        '.png', '.jpg', '.jpeg', '.exr', '.tiff', '.tif', '.dpx', '.hdr', '.bmp',
        '.mp4', '.avi', '.mov', '.webm', '.mkv',
        '.wav', '.mp3', '.flac', '.ogg', '.aac',
    ];

    const DEFAULT_STATUSES = [
        { name: 'WIP',              color: '#3b82f6' },
        { name: 'Ready for Review', color: '#eab308' },
        { name: 'Needs Fixes',      color: '#ef4444' },
        { name: 'Approved',         color: '#22c55e' },
        { name: 'On Hold',          color: '#555566' },
    ];

    const DEFAULT_DIFFICULTIES = [
        { name: 'Easy',   color: '#22c55e' },
        { name: 'Medium', color: '#eab308' },
        { name: 'Hard',   color: '#ef4444' },
    ];

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function parseStem(stem) {
        const m = SCHEME_RE.exec(stem);
        if (!m) return null;
        return {
            base: `${m.groups.proj}.${m.groups.type}.${m.groups.n}`,
            proj: m.groups.proj,
            type: m.groups.type,
            name: m.groups.n,
            ver:  m.groups.ver,
        };
    }

    function migrateToColorFormat(items, defaults) {
        if (!items || items.length === 0) return defaults;
        if (typeof items[0] === 'string') {
            const map = {};
            defaults.forEach(d => map[d.name] = d.color);
            return items.map(s => ({ name: s, color: map[s] || '#888888' }));
        }
        return items;
    }

    async function getSubDir(parentHandle, name, create = false) {
        try {
            return await parentHandle.getDirectoryHandle(name, { create });
        } catch (e) {
            return null;
        }
    }

    async function getFileHandle(dirHandle, name, create = false) {
        try {
            return await dirHandle.getFileHandle(name, { create });
        } catch (e) {
            return null;
        }
    }

    async function readJSON(dirHandle, ...pathParts) {
        let current = dirHandle;
        for (let i = 0; i < pathParts.length - 1; i++) {
            current = await getSubDir(current, pathParts[i]);
            if (!current) return null;
        }
        const fh = await getFileHandle(current, pathParts[pathParts.length - 1]);
        if (!fh) return null;
        try {
            const file = await fh.getFile();
            const text = await file.text();
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    }

    async function writeJSON(dirHandle, data, ...pathParts) {
        let current = dirHandle;
        for (let i = 0; i < pathParts.length - 1; i++) {
            current = await getSubDir(current, pathParts[i], true);
            if (!current) return false;
        }
        try {
            const fh = await current.getFileHandle(pathParts[pathParts.length - 1], { create: true });
            const writable = await fh.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
            return true;
        } catch (e) {
            console.warn('RelayEngine writeJSON failed:', e);
            return false;
        }
    }

    async function readTextFile(dirHandle, ...pathParts) {
        let current = dirHandle;
        for (let i = 0; i < pathParts.length - 1; i++) {
            current = await getSubDir(current, pathParts[i]);
            if (!current) return null;
        }
        const fh = await getFileHandle(current, pathParts[pathParts.length - 1]);
        if (!fh) return null;
        try {
            const file = await fh.getFile();
            return await file.text();
        } catch (e) {
            return null;
        }
    }

    async function writeTextFile(dirHandle, text, ...pathParts) {
        let current = dirHandle;
        for (let i = 0; i < pathParts.length - 1; i++) {
            current = await getSubDir(current, pathParts[i], true);
            if (!current) return false;
        }
        try {
            const fh = await current.getFileHandle(pathParts[pathParts.length - 1], { create: true });
            const writable = await fh.createWritable();
            await writable.write(text);
            await writable.close();
            return true;
        } catch (e) {
            console.warn('RelayEngine writeTextFile failed:', e);
            return false;
        }
    }

    // -----------------------------------------------------------------------
    // Recursive file scanner
    // -----------------------------------------------------------------------

    async function scanAllFiles(rootHandle, maxItems = 20000) {
        const files = [];
        const queue = [{ handle: rootHandle, parts: [] }];
        let visited = 0;
        while (queue.length > 0 && visited < maxItems) {
            const current = queue.shift();
            try {
                for await (const entry of current.handle.values()) {
                    visited += 1;
                    const entryParts = [...current.parts, entry.name];
                    if (entry.kind === 'directory') {
                        queue.push({ handle: entry, parts: entryParts });
                    } else {
                        files.push({ parts: entryParts, name: entry.name });
                    }
                    if (visited >= maxItems) break;
                }
            } catch (e) {
                // permission or access error on this dir — skip
            }
        }
        return files;
    }

    // -----------------------------------------------------------------------
    // Scanner — port of scanner.py scan_project
    // -----------------------------------------------------------------------

    async function scanProject(rootHandle, scanFolders, excludedExtensions) {
        const excludedExtSet = new Set(
            (excludedExtensions || DEFAULT_EXCLUDED_EXTENSIONS).map(e =>
                e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`
            )
        );

        const allFiles = await scanAllFiles(rootHandle);
        const shots = {};

        function inScope(parts) {
            if (!scanFolders || scanFolders.length === 0) return true;
            if (parts.length < 2) return true;
            const top = parts[0];
            return scanFolders.some(f => top === f || top.endsWith(f) || top.includes(f));
        }

        // --- Parse version logs ---
        for (const f of allFiles) {
            if (f.name !== 'version_log.txt') continue;
            if (!f.parts.some(p => p === 'logs')) continue;
            // Check parent of parent is Master
            const logsIdx = f.parts.lastIndexOf('logs');
            if (logsIdx < 2) continue;
            if (f.parts[logsIdx - 1] !== 'Master') continue;

            const text = await readTextFile(rootHandle, ...f.parts);
            if (!text) continue;

            for (const ln of text.split('\n')) {
                const lineParts = ln.trim().split('|');
                if (lineParts.length < 5) continue;
                const base = lineParts[1].trim();
                const parsed = parseStem(base + '.M');
                if (!parsed) continue;

                const dateTime = lineParts[0].trim();
                let userPart = '', filePart = '', notePart = '';
                for (const p of lineParts.slice(2)) {
                    const pt = p.trim();
                    if (pt.startsWith('user:')) userPart = pt.slice(5).trim();
                    else if (pt.startsWith('file:')) filePart = pt.slice(5).trim();
                    else if (pt.startsWith('note:')) notePart = pt.slice(5).trim();
                }
                const vm = lineParts[2] ? lineParts[2].match(/and\s+(\d+|--)/) : null;
                const ver = vm ? vm[1] : '?';

                // Check for master .blend
                let hasMaster = false;
                const masterDir = f.parts.slice(0, logsIdx);
                for (const af of allFiles) {
                    if (af.name === `${base}.M.blend` &&
                        af.parts.length >= masterDir.length &&
                        masterDir.every((p, i) => af.parts[i] === p)) {
                        hasMaster = true;
                        break;
                    }
                }

                if (!shots[parsed.base]) {
                    shots[parsed.base] = {
                        name: parsed.base, proj: parsed.proj, type: parsed.type,
                        asset_name: parsed.name, version: ver, has_master: hasMaster,
                        last_published: dateTime, last_user: userPart,
                        last_file: filePart, last_note: notePart, history: [],
                    };
                }
                shots[parsed.base].version = ver;
                shots[parsed.base].has_master = hasMaster;
                shots[parsed.base].last_published = dateTime;
                shots[parsed.base].last_user = userPart;
                shots[parsed.base].last_file = filePart;
                shots[parsed.base].last_note = notePart;
                shots[parsed.base].history.push({
                    date: dateTime, version: ver, user: userPart,
                    file: filePart, note: notePart,
                });
            }
        }

        // Trim history
        for (const s of Object.values(shots)) {
            s.history = s.history.slice(-10);
        }

        // --- Scan project files ---
        for (const f of allFiles) {
            const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
            if (excludedExtSet.has(ext)) continue;
            if (f.parts.some(p => p === 'Master')) continue;
            if (f.name.includes('_backup')) continue;
            if (!inScope(f.parts)) continue;

            const stem = f.name.replace(/\.[^./\\]+$/, '');
            const parsed = parseStem(stem);
            if (!parsed) continue;
            if (parsed.ver === 'M') continue;

            const base = parsed.base;
            const relPath = f.parts.join('/');

            if (shots[base]) {
                try {
                    const existing = parseInt(shots[base].version) || -1;
                    const thisVer = parseInt(parsed.ver) || -1;
                    if (thisVer > existing) {
                        shots[base].version = parsed.ver;
                        shots[base].last_file = relPath;
                    }
                } catch (e) {}
                continue;
            }

            shots[base] = {
                name: base, proj: parsed.proj, type: parsed.type,
                asset_name: parsed.name, version: parsed.ver, has_master: false,
                last_published: '', last_user: '', last_file: relPath,
                last_note: '', history: [],
            };
        }

        // --- Best version pass ---
        const fileVersions = {};
        for (const f of allFiles) {
            const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
            if (excludedExtSet.has(ext)) continue;
            if (f.parts.some(p => p === 'Master')) continue;
            if (f.name.includes('_backup')) continue;
            if (!inScope(f.parts)) continue;

            const stem = f.name.replace(/\.[^./\\]+$/, '');
            const parsed = parseStem(stem);
            if (!parsed || parsed.ver === 'M') continue;

            const v = parseInt(parsed.ver);
            if (isNaN(v)) continue;
            const base = parsed.base;

            if (!fileVersions[base] || v > fileVersions[base].v) {
                fileVersions[base] = { v, path: f.parts.join('/') };
            }
        }

        for (const [base, info] of Object.entries(fileVersions)) {
            if (shots[base] && !shots[base].has_master) {
                shots[base].version = String(info.v).padStart(2, '0');
                shots[base].last_file = info.path;
            }
        }

        // --- Playblasts ---
        for (const f of allFiles) {
            const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
            if (ext !== '.mp4') continue;
            if (!f.parts.some(p => p.toLowerCase() === 'playblast')) continue;

            const stem = f.name.replace(/\.[^./\\]+$/, '');
            const m = PLAYBLAST_RE.exec(stem);
            if (!m) continue;

            const pbBase = `${m.groups.proj}.${m.groups.type}.${m.groups.n}`;
            const pbVer = parseInt(m.groups.ver);
            if (!shots[pbBase]) continue;

            const current = shots[pbBase]._playblast_info;
            if (!current || pbVer > current.ver) {
                shots[pbBase]._playblast_info = { ver: pbVer };
                shots[pbBase].playblast = f.parts.join('/');
            }
        }

        for (const s of Object.values(shots)) {
            delete s._playblast_info;
            if (!s.playblast) s.playblast = '';
        }

        return shots;
    }

    // -----------------------------------------------------------------------
    // Tracker
    // -----------------------------------------------------------------------

    async function loadTracker(rootHandle) {
        const data = await readJSON(rootHandle, RELAY_DIR_NAME, TRACKER_FILENAME);
        if (data) {
            data.custom_statuses = migrateToColorFormat(data.custom_statuses || [], DEFAULT_STATUSES);
            data.custom_difficulties = migrateToColorFormat(data.custom_difficulties || [], DEFAULT_DIFFICULTIES);
            return data;
        }
        return {
            assets: {},
            custom_statuses: [...DEFAULT_STATUSES],
            custom_difficulties: [...DEFAULT_DIFFICULTIES],
        };
    }

    async function saveTracker(rootHandle, data) {
        return await writeJSON(rootHandle, data, RELAY_DIR_NAME, TRACKER_FILENAME);
    }

    // -----------------------------------------------------------------------
    // Comments
    // -----------------------------------------------------------------------

    async function loadAllComments(rootHandle) {
        const allComments = {};
        const allMeta = {};
        const commentsDir = await getSubDir(rootHandle, RELAY_DIR_NAME);
        if (!commentsDir) return { comments: allComments, meta: allMeta };
        const cDir = await getSubDir(commentsDir, 'comments');
        if (!cDir) return { comments: allComments, meta: allMeta };

        try {
            for await (const entry of cDir.values()) {
                if (entry.kind !== 'file' || !entry.name.endsWith('_comments.json')) continue;
                const dept = entry.name.replace('_comments.json', '');
                try {
                    const file = await entry.getFile();
                    const text = await file.text();
                    const data = JSON.parse(text);
                    for (const [key, value] of Object.entries(data)) {
                        if (key.startsWith('_meta_')) {
                            allMeta[key.slice(6)] = value;
                        } else {
                            if (!allComments[key]) allComments[key] = [];
                            const stamped = value.map(c => {
                                if (!c.dept) return { ...c, dept };
                                return c;
                            });
                            allComments[key].push(...stamped);
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {}

        return { comments: allComments, meta: allMeta };
    }

    async function saveComment(rootHandle, shotBase, shotType, comment) {
        const filename = `${shotType}_comments.json`;
        const existing = await readJSON(rootHandle, RELAY_DIR_NAME, 'comments', filename) || {};
        if (!existing[shotBase]) existing[shotBase] = [];
        existing[shotBase].push(comment);
        return await writeJSON(rootHandle, existing, RELAY_DIR_NAME, 'comments', filename);
    }

    // -----------------------------------------------------------------------
    // Playlists
    // -----------------------------------------------------------------------

    async function listPlaylists(rootHandle) {
        const playlists = [];
        const relayDir = await getSubDir(rootHandle, RELAY_DIR_NAME);
        if (!relayDir) return playlists;
        const pDir = await getSubDir(relayDir, 'playlists');
        if (!pDir) return playlists;

        try {
            for await (const entry of pDir.values()) {
                if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
                try {
                    const file = await entry.getFile();
                    const text = await file.text();
                    const data = JSON.parse(text);
                    const assets = data.assets || data.shots || [];
                    playlists.push({
                        filename: entry.name,
                        name: data.name || entry.name.replace('.json', ''),
                        created: data.created || '',
                        asset_count: assets.length,
                        assets,
                        archived: data.archived || false,
                    });
                } catch (e) {}
            }
        } catch (e) {}

        return playlists.sort((a, b) => b.filename.localeCompare(a.filename));
    }

    async function loadPlaylist(rootHandle, filename) {
        const safe = filename.split('/').pop();
        return await readJSON(rootHandle, RELAY_DIR_NAME, 'playlists', safe);
    }

    async function savePlaylist(rootHandle, filename, data) {
        const safe = filename.split('/').pop();
        return await writeJSON(rootHandle, data, RELAY_DIR_NAME, 'playlists', safe);
    }

    async function createPlaylist(rootHandle, name, assets) {
        const safe = name.replace(/\s+/g, '_').toLowerCase() + '.json';
        const data = {
            name,
            created: new Date().toISOString().slice(0, 19).replace('T', ' '),
            assets: assets || [],
        };
        return await writeJSON(rootHandle, data, RELAY_DIR_NAME, 'playlists', safe);
    }

    // -----------------------------------------------------------------------
    // Activity log
    // -----------------------------------------------------------------------

    const ACTIVITY_LOG_MAX = 1000;

    async function readActivityLog(rootHandle, limit = 500) {
        const text = await readTextFile(rootHandle, RELAY_DIR_NAME, ACTIVITY_LOG_FILENAME);
        if (!text) return [];
        const entries = [];
        for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try { entries.push(JSON.parse(trimmed)); } catch (e) {}
        }
        return entries.slice(-limit);
    }

    async function appendActivityLog(rootHandle, newEntries) {
        if (!newEntries || newEntries.length === 0) return;
        const filtered = newEntries.filter(e => String(e.before || '') !== String(e.after || ''));
        if (filtered.length === 0) return;

        const existing = await readActivityLog(rootHandle, ACTIVITY_LOG_MAX);
        const combined = [...existing, ...filtered].slice(-ACTIVITY_LOG_MAX);
        const text = combined.map(e => JSON.stringify(e)).join('\n') + '\n';
        return await writeTextFile(rootHandle, text, RELAY_DIR_NAME, ACTIVITY_LOG_FILENAME);
    }

    // -----------------------------------------------------------------------
    // Snapshots
    // -----------------------------------------------------------------------

    async function listSnapshots(rootHandle) {
        const result = [];
        const relayDir = await getSubDir(rootHandle, RELAY_DIR_NAME);
        if (!relayDir) return result;
        const sDir = await getSubDir(relayDir, SNAPSHOTS_DIR_NAME);
        if (!sDir) return result;

        try {
            for await (const entry of sDir.values()) {
                if (entry.kind !== 'file' || !entry.name.startsWith('snapshot_') || !entry.name.endsWith('.json')) continue;
                try {
                    const file = await entry.getFile();
                    const text = await file.text();
                    const data = JSON.parse(text);
                    const meta = data._snapshot_meta || {};
                    result.push({
                        filename: entry.name,
                        created: meta.created || '',
                        label: meta.label || '',
                        is_complete: meta.is_complete || false,
                        asset_count: Object.keys(data.assets || {}).length,
                    });
                } catch (e) {}
            }
        } catch (e) {}

        return result.sort((a, b) => b.filename.localeCompare(a.filename));
    }

    async function saveSnapshot(rootHandle, label = 'manual') {
        const tracker = await readJSON(rootHandle, RELAY_DIR_NAME, TRACKER_FILENAME);
        if (!tracker) return { error: 'No tracker file found.' };

        const now = new Date();
        const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6})/, '$1_$2');
        const safeLabel = (label || 'manual').replace(/[^\w-]/g, '_').slice(0, 40);
        const filename = `snapshot_${ts}_${safeLabel}.json`;

        const snapshotData = {
            _snapshot_meta: {
                created: now.toISOString().slice(0, 19).replace('T', ' '),
                label,
                is_complete: false,
            },
            ...tracker,
        };

        const ok = await writeJSON(rootHandle, snapshotData, RELAY_DIR_NAME, SNAPSHOTS_DIR_NAME, filename);
        return ok ? { ok: true, filename } : { error: 'Could not write snapshot.' };
    }

    async function restoreSnapshot(rootHandle, filename) {
        const safe = filename.split('/').pop();
        const data = await readJSON(rootHandle, RELAY_DIR_NAME, SNAPSHOTS_DIR_NAME, safe);
        if (!data) return { error: 'Snapshot not found.' };
        delete data._snapshot_meta;
        const ok = await saveTracker(rootHandle, data);
        return ok ? { ok: true } : { error: 'Could not restore snapshot.' };
    }

    async function deleteSnapshot(rootHandle, filename) {
        const safe = filename.split('/').pop();
        const relayDir = await getSubDir(rootHandle, RELAY_DIR_NAME);
        if (!relayDir) return { error: 'Relay dir not found.' };
        const sDir = await getSubDir(relayDir, SNAPSHOTS_DIR_NAME);
        if (!sDir) return { error: 'Snapshots dir not found.' };
        try {
            await sDir.removeEntry(safe);
            return { ok: true };
        } catch (e) {
            return { error: String(e) };
        }
    }

    // -----------------------------------------------------------------------
    // Build dashboard data  (port of tracker.py build_dashboard_data)
    // -----------------------------------------------------------------------

    async function buildDashboardData(rootHandle) {
        const tracker = await loadTracker(rootHandle);
        const scanFolders = tracker.scan_folders || [];
        const excludedExts = tracker.excluded_extensions || [...DEFAULT_EXCLUDED_EXTENSIONS];
        const shots = await scanProject(rootHandle, scanFolders, excludedExts);
        const { comments: allComments, meta: allMeta } = await loadAllComments(rootHandle);

        const result = [];
        for (const [key, shot] of Object.entries(shots)) {
            const meta = (tracker.assets || {})[key] || {};
            shot.status       = meta.status       || 'WIP';
            shot.difficulty   = meta.difficulty   || '';
            shot.completion   = meta.completion   || 0;
            shot.notes        = meta.notes        || '';
            shot.excluded     = meta.excluded     || false;
            shot.manual_media = meta.manual_media || '';
            shot.due_date     = meta.due_date     || '';
            shot.done         = meta.done         || false;
            shot.starred      = meta.starred      || false;
            shot.assignee     = meta.assignee     || '';
            shot.comments     = allComments[key]  || [];
            const shotMeta    = allMeta[key]      || {};
            shot.frame_start  = shotMeta.frame_start || 1;
            shot.frame_end    = shotMeta.frame_end   || 250;
            shot.fps          = shotMeta.fps         || 24;
            result.push(shot);
        }

        result.sort((a, b) => a.name.localeCompare(b.name));

        return {
            assets:               result,
            custom_statuses:      tracker.custom_statuses     || [...DEFAULT_STATUSES],
            custom_difficulties:  tracker.custom_difficulties || [...DEFAULT_DIFFICULTIES],
            auto_status_rules:    tracker.auto_status_rules   || [],
            auto_status_enabled:  tracker.auto_status_enabled || false,
            project_complete:     tracker.project_complete    || false,
            completed_date:       tracker.completed_date      || '',
            final_media:          tracker.final_media         || '',
            current_edit:         tracker.current_edit        || '',
            project_reflection:   tracker.project_reflection  || '',
            scan_folders:         scanFolders,
            excluded_extensions:  excludedExts,
            root_path:            rootHandle.name,
            project_info:         tracker.project_info || { description: '', credits: [] },
        };
    }

    // -----------------------------------------------------------------------
    // Save metadata (status, notes, completion, etc.)
    // -----------------------------------------------------------------------

    async function saveMeta(rootHandle, body) {
        const tracker = await loadTracker(rootHandle);
        if (!tracker.assets) tracker.assets = {};
        const key = body.asset_name || body.shot || body.asset || body.name;
        if (!key) return { ok: false, error: 'No asset key.' };
        if (!tracker.assets[key]) tracker.assets[key] = {};
        const meta = tracker.assets[key];
        if (body.status !== undefined)      meta.status      = body.status;
        if (body.difficulty !== undefined)   meta.difficulty  = body.difficulty;
        if (body.completion !== undefined)   meta.completion  = body.completion;
        if (body.notes !== undefined)        meta.notes       = body.notes;
        if (body.excluded !== undefined)     meta.excluded    = body.excluded;
        if (body.manual_media !== undefined) meta.manual_media = body.manual_media;
        if (body.due_date !== undefined)     meta.due_date    = body.due_date;
        if (body.done !== undefined)         meta.done        = body.done;
        if (body.starred !== undefined)      meta.starred     = body.starred;
        if (body.assignee !== undefined)     meta.assignee    = body.assignee;
        const ok = await saveTracker(rootHandle, tracker);
        return { ok };
    }

    async function saveSettings(rootHandle, body) {
        const tracker = await loadTracker(rootHandle);
        if (body.custom_statuses !== undefined)      tracker.custom_statuses      = body.custom_statuses;
        if (body.custom_difficulties !== undefined)   tracker.custom_difficulties  = body.custom_difficulties;
        if (body.auto_status_rules !== undefined)     tracker.auto_status_rules    = body.auto_status_rules;
        if (body.auto_status_enabled !== undefined)   tracker.auto_status_enabled  = body.auto_status_enabled;
        if (body.scan_folders !== undefined)          tracker.scan_folders         = body.scan_folders;
        if (body.excluded_extensions !== undefined)   tracker.excluded_extensions  = body.excluded_extensions;
        const ok = await saveTracker(rootHandle, tracker);
        return { ok };
    }

    async function saveProjectInfo(rootHandle, body) {
        const tracker = await loadTracker(rootHandle);
        if (body.project_info !== undefined)       tracker.project_info       = body.project_info;
        if (body.project_complete !== undefined)    tracker.project_complete   = body.project_complete;
        if (body.completed_date !== undefined)      tracker.completed_date     = body.completed_date;
        if (body.final_media !== undefined)         tracker.final_media        = body.final_media;
        if (body.current_edit !== undefined)        tracker.current_edit       = body.current_edit;
        if (body.project_reflection !== undefined)  tracker.project_reflection = body.project_reflection;
        const ok = await saveTracker(rootHandle, tracker);
        return { ok };
    }

    // -----------------------------------------------------------------------
    // Public interface
    // -----------------------------------------------------------------------

    return {
        DEFAULT_STATUSES,
        DEFAULT_DIFFICULTIES,
        DEFAULT_EXCLUDED_EXTENSIONS,
        parseStem,
        buildDashboardData,
        loadTracker,
        saveTracker,
        saveMeta,
        saveSettings,
        saveProjectInfo,
        loadAllComments,
        saveComment,
        listPlaylists,
        loadPlaylist,
        savePlaylist,
        createPlaylist,
        readActivityLog,
        appendActivityLog,
        listSnapshots,
        saveSnapshot,
        restoreSnapshot,
        deleteSnapshot,
    };

})();
