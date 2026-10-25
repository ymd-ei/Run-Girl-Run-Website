// ---------------------------------------------------------------------------
// Settings modal
// ---------------------------------------------------------------------------
function openProjectSettings() {
    renderSettingsTags(); renderAutoRules(); renderScanFolderTags(); renderExcludedExtTags();
    document.getElementById('autoStatusEnabled').checked = dashboardData.auto_status_enabled || false;
    document.getElementById('projectSettingsModal').classList.add('open');
    loadSnapshotList();
}
function closeProjectSettings() { document.getElementById('projectSettingsModal').classList.remove('open'); }

// App settings: this computer only (the desktop app). Studio-wide things live in Studio Settings.
function openSystemSettings() {
    v4EnsureSettingsModal('systemSettingsModal').classList.add('open');
    _renderSystemSettings();
}
function _renderSystemSettings() {
    const body = `
        <div class="field"><label>Studio folder</label>
            <div class="v4-invite"><input type="text" id="sysStudioRoot" style="flex:1;" spellcheck="false" aria-label="Studio folder">
                <button class="btn-sm" onclick="browseSysStudioRoot()">Browse</button>
                <button class="btn-sm" style="border-color:var(--accent);color:var(--accent);" onclick="saveSysStudioRoot()">Save</button></div></div>
        <div class="field" style="margin-top:1.25rem;"><label>New studio</label>
            <div class="v4-invite"><input type="text" id="nsBasePath" placeholder="Create it in…" style="flex:1;" spellcheck="false" oninput="updateNsPreview()" aria-label="Folder to create the studio in">
                <button class="btn-sm" onclick="browseStudioBase()">Browse</button></div>
            <div class="v4-invite" style="margin-top:0.4rem;"><input type="text" id="nsStudioName" placeholder="Studio name" style="flex:1;" oninput="updateNsPreview()" onkeydown="if(event.key==='Enter')submitNewStudio()" aria-label="Studio name">
                <button class="btn-sm" onclick="submitNewStudio()">Create</button></div>
            <div id="nsPreview" class="sys-preview" style="display:none;"></div>
            <div id="nsError" class="sys-error" style="display:none;"></div></div>
        <div class="field" style="margin-top:1.25rem;"><label>Startup</label>
            <label class="v4-check"><input type="checkbox" id="launchOnStartup" onchange="setStartup(this.checked)"> Open Relay when I log in</label></div>`;
    document.getElementById('systemSettingsModalBody').innerHTML = v4SettingsShell('systemSettingsModal', 'App settings', '',
        [], '', '', body);
    api('/api/get_config').then(cfg => {
        const cb = document.getElementById('launchOnStartup'); if (cb) cb.checked = cfg.launch_on_startup || false;
        const sr = document.getElementById('sysStudioRoot'); if (sr) sr.value = cfg.studio_root || '';
    });
}
function loadCloudSharing() {
    api('/api/get_studio_config').then(sc => {
        const cs = sc.cloud_sharing || {};
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        set('csEndpoint', cs.r2_endpoint || ''); set('csAccessKey', cs.r2_access_key || ''); set('csSecretKey', cs.r2_secret_key || '');
        set('csBucket', cs.r2_bucket || ''); set('csTTL', cs.session_ttl_hours || 48); set('csShareURL', cs.share_base_url || '');
    }).catch(() => {});
}
function closeSystemSettings() { document.getElementById('systemSettingsModal').classList.remove('open'); }

function saveCloudSharing() {
    const status = document.getElementById('csStatus');
    const data = {
        cloud_sharing: {
            r2_endpoint:      document.getElementById('csEndpoint').value.trim(),
            r2_access_key:    document.getElementById('csAccessKey').value.trim(),
            r2_secret_key:    document.getElementById('csSecretKey').value.trim(),
            r2_bucket:        document.getElementById('csBucket').value.trim(),
            share_base_url:   document.getElementById('csShareURL').value.trim().replace(/\/+$/, ''),
            session_ttl_hours: parseInt(document.getElementById('csTTL').value) || 48,
        }
    };
    status.textContent = 'Saving…';
    status.style.color = 'var(--text-muted)';
    api('/api/save_studio_config', data).then(res => {
        if (res.ok) {
            status.textContent = '✓ Saved';
            status.style.color = '#22c55e';
        } else {
            status.textContent = '✗ ' + (res.error || 'Save failed');
            status.style.color = '#ef4444';
        }
    }).catch(() => {
        status.textContent = '✗ Save failed';
        status.style.color = '#ef4444';
    });
}

function testCloudConnection() {
    const status = document.getElementById('csStatus');
    const endpoint = document.getElementById('csEndpoint').value.trim();
    const bucket   = document.getElementById('csBucket').value.trim();
    if (!endpoint || !bucket) {
        status.textContent = '✗ Endpoint and bucket required';
        status.style.color = '#ef4444';
        return;
    }
    status.textContent = 'Testing…';
    status.style.color = 'var(--text-muted)';
    api('/api/test_cloud', {
        r2_endpoint:   endpoint,
        r2_access_key: document.getElementById('csAccessKey').value.trim(),
        r2_secret_key: document.getElementById('csSecretKey').value.trim(),
        r2_bucket:     bucket,
    }).then(res => {
        if (res.ok) {
            status.textContent = '✓ Connected';
            status.style.color = '#22c55e';
        } else {
            status.textContent = '✗ ' + (res.error || 'Connection failed');
            status.style.color = '#ef4444';
        }
    }).catch(() => {
        status.textContent = '✗ Connection failed';
        status.style.color = '#ef4444';
    });
}

// legacy aliases
function openSettings() { openProjectSettings(); }
function closeSettings() { closeProjectSettings(); }

// ---------------------------------------------------------------------------
// System Settings — studio root
// ---------------------------------------------------------------------------
function updateSysStudioPreview() { /* no live preview needed here */ }

async function browseSysStudioRoot() {
    openFileBrowser('folder', '', path => {
        if (path) document.getElementById('sysStudioRoot').value = path;
    });
}

async function saveSysStudioRoot() {
    const root = document.getElementById('sysStudioRoot').value.trim();
    if (!root) { showToast('Enter a studio root path first'); return; }
    const result = await api('/api/set_studio_root', { studio_root: root });
    if (result.error) { showToast('Error: ' + result.error); return; }
    showToast('Studio root saved');
    refreshPicker();
}

// ---------------------------------------------------------------------------
// New Studio (inside System Settings)
// ---------------------------------------------------------------------------
function updateNsPreview() {
    const base = (document.getElementById('nsBasePath').value || '').trimEnd().replace(/[/\\]+$/, '');
    const name = document.getElementById('nsStudioName').value.trim();
    const preview = document.getElementById('nsPreview');
    if (base && name) { preview.textContent = base + (base.includes('\\') ? '\\' : '/') + name; preview.style.display = 'block'; }
    else { preview.style.display = 'none'; }
}

async function browseStudioBase() {
    openFileBrowser('folder', document.getElementById('nsBasePath').value.trim() || '', path => {
        if (path) { document.getElementById('nsBasePath').value = path; updateNsPreview(); }
    });
}

async function submitNewStudio() {
    const base_path   = document.getElementById('nsBasePath').value.trim();
    const studio_name = document.getElementById('nsStudioName').value.trim();
    const errEl       = document.getElementById('nsError');
    errEl.style.display = 'none';
    if (!base_path)   { errEl.textContent = 'Base path is required.';  errEl.style.display = 'block'; return; }
    if (!studio_name) { errEl.textContent = 'Studio name is required.'; errEl.style.display = 'block'; return; }
    const result = await api('/api/create_studio', { base_path, studio_name });
    if (result.error) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }
    // Update the studio root field in the same modal and save it
    document.getElementById('sysStudioRoot').value = result.path;
    document.getElementById('nsBasePath').value = '';
    document.getElementById('nsStudioName').value = '';
    document.getElementById('nsPreview').style.display = 'none';
    showToast(`✓ Studio "${studio_name}" created`);
    refreshPicker();
}

// ---------------------------------------------------------------------------
// Project Picker (splash screen)
// ---------------------------------------------------------------------------
async function refreshPicker() {
    const data = await fetch('/api/list_projects').then(r => r.json());
    const noStudio   = document.getElementById('pickerNoStudio');
    const listWrap   = document.getElementById('pickerProjectList');
    const items      = document.getElementById('pickerItems');
    const empty      = document.getElementById('pickerEmpty');
    const studioLbl  = document.getElementById('pickerStudioLabel');

    if (!data.studio_root) {
        noStudio.style.display = 'block';
        listWrap.style.display = 'none';
        return;
    }
    noStudio.style.display = 'none';
    listWrap.style.display = 'block';
    // show just the last two path parts as a label
    const parts = data.studio_root.replace(/\\/g, '/').split('/').filter(Boolean);
    studioLbl.textContent = parts.slice(-2).join(' / ');

    if (!data.projects || data.projects.length === 0) {
        items.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    items.innerHTML = data.projects.map(p => `
        <div onclick="loadPickerProject('${p.path.replace(/\\/g, '\\\\')}')"
             style="display:flex;align-items:center;justify-content:space-between;
                    padding:0.5rem 0.75rem;border-radius:7px;cursor:pointer;
                    background:var(--bg-tertiary);border:1px solid var(--border);
                    transition:border-color 0.15s,background 0.15s;"
             onmouseover="this.style.borderColor='var(--accent)';this.style.background='var(--bg-hover)'"
             onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--bg-tertiary)'">
            <span style="font-family:var(--mono);font-size:0.82rem;color:var(--text-primary);">${esc(p.name)}</span>
            ${p.oneoff ? '<span style="font-family:var(--mono);font-size:0.62rem;color:var(--text-muted);border:1px solid var(--border);border-radius:4px;padding:1px 5px;">OneOff</span>' : ''}
        </div>`).join('');
}

async function loadPickerProject(path) {
    document.getElementById('projectPath').value = path;
    await loadProject();
}

// ---------------------------------------------------------------------------
// New Project modal
// ---------------------------------------------------------------------------
let _npStudioRoot = '';

async function openNewProject() {
    const cfg = await fetch('/api/get_config').then(r => r.json());
    _npStudioRoot = cfg.studio_root || '';
    document.getElementById('npProjectName').value = '';
    document.getElementById('npCode').value = ''; _npCodeEdited = false;
    document.getElementById('npBuilder').innerHTML = namesBuilderHTML('np', '', ASSET_TYPES);
    document.getElementById('npPreview').style.display = 'none';
    document.getElementById('npError').style.display = 'none';
    const noStudio = document.getElementById('npNoStudio');
    noStudio.style.display = _npStudioRoot ? 'none' : 'block';
    document.getElementById('newProjectModal').classList.add('open');
    if (_npStudioRoot) setTimeout(() => document.getElementById('npProjectName').focus(), 60);
    updateNpPreview();
}

// Project code: suggested from the name (The Last Lantern → TLL) until you type your own
let _npCodeEdited = false;
function _npSuggestCode(name) {
    const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words.map(w => w[0]).join('') : (words[0] || '').slice(0, 3)).toUpperCase().slice(0, 6);
}
function npCodeTyped() {
    _npCodeEdited = true;
    const el = document.getElementById('npCode'); el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    _npSyncCode();
}
function _npSyncCode() { const el = document.getElementById('npProj'); if (el) el.value = document.getElementById('npCode').value; }
function closeNewProject() { document.getElementById('newProjectModal').classList.remove('open'); }

function updateNpPreview() {
    const name   = document.getElementById('npProjectName').value.trim();
    if (!_npCodeEdited) { document.getElementById('npCode').value = _npSuggestCode(name); _npSyncCode(); }
    const preview = document.getElementById('npPreview');
    if (_npStudioRoot && name) {
        const sep = _npStudioRoot.includes('\\') ? '\\' : '/';
        preview.textContent = _npStudioRoot.replace(/[/\\]+$/, '') + sep + '01_Projects' + sep + name;
        preview.style.display = 'block';
    } else { preview.style.display = 'none'; }
}

async function submitNewProject() {
    const project_name = document.getElementById('npProjectName').value.trim();
    const project_code = document.getElementById('npCode').value.trim();
    const planned      = namesBuilderRead('np');
    const shots        = planned.map(n => n.name);
    const errEl        = document.getElementById('npError');
    errEl.style.display = 'none';
    if (!_npStudioRoot) { errEl.textContent = 'No studio folder set. Open App settings first.'; errEl.style.display = 'block'; return; }
    if (!project_name)  { errEl.textContent = 'Project name is required.'; errEl.style.display = 'block'; return; }
    if (!project_code)  { errEl.textContent = 'Project code is required.'; errEl.style.display = 'block'; return; }
    const result = await api('/api/create_project', { studio_root: _npStudioRoot, project_name, project_code, shots });   // shots = planned asset names: Relay data only, no folders
    if (result.error) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }
    closeNewProject();
    const shotMsg = result.shots && result.shots.length ? ` + ${result.shots.length} planned asset${result.shots.length > 1 ? 's' : ''}` : '';
    showToast(`✓ "${project_name}" created${shotMsg}`);
    refreshPicker();
}

function renderSettingsTags() {
    document.getElementById('statusTags').innerHTML = (dashboardData.custom_statuses || []).map((s, i) => {
        const sn = typeof s==='string'?s:s.name, sc = typeof s==='string'?'#888888':s.color;
        return `<span class="tag" style="border-color:${sc}40;"><span class="color-dot" style="background:${sc};"></span>${esc(sn)}${makeCustomSelect('status-color-'+i, PALETTE.map(c=>({value:c.hex,label:c.name,color:c.hex})), sc, v=>setStatusColor(i,v), false)}<span class="remove-tag" onclick="removeStatus(${i})">&#215;</span></span>`;
    }).join('');
    document.getElementById('difficultyTags').innerHTML = (dashboardData.custom_difficulties || []).map((d, i) => {
        const dn = typeof d==='string'?d:d.name, dc = typeof d==='string'?'#888888':d.color;
        return `<span class="tag" style="border-color:${dc}40;"><span class="color-dot" style="background:${dc};"></span>${esc(dn)}${makeCustomSelect('diff-color-'+i, PALETTE.map(c=>({value:c.hex,label:c.name,color:c.hex})), dc, v=>setDifficultyColor(i,v), false)}<span class="remove-tag" onclick="removeDifficulty(${i})">&#215;</span></span>`;
    }).join('');
}

function setStatusColor(i, color) { const s = dashboardData.custom_statuses[i]; if (typeof s==='string') dashboardData.custom_statuses[i]={name:s,color}; else s.color=color; renderSettingsTags(); }
function setDifficultyColor(i, color) { const d = dashboardData.custom_difficulties[i]; if (typeof d==='string') dashboardData.custom_difficulties[i]={name:d,color}; else d.color=color; renderSettingsTags(); }
function addStatus() { const v = document.getElementById('newStatusInput').value.trim(); const names = (dashboardData.custom_statuses||[]).map(s=>typeof s==='string'?s:s.name); if (v&&!names.includes(v)) { dashboardData.custom_statuses.push({name:v,color:PALETTE[dashboardData.custom_statuses.length%PALETTE.length].hex}); document.getElementById('newStatusInput').value=''; renderSettingsTags(); } }
function removeStatus(i) { dashboardData.custom_statuses.splice(i,1); renderSettingsTags(); }
function addDifficulty() { const v = document.getElementById('newDifficultyInput').value.trim(); const names = (dashboardData.custom_difficulties||[]).map(d=>typeof d==='string'?d:d.name); if (v&&!names.includes(v)) { dashboardData.custom_difficulties.push({name:v,color:PALETTE[dashboardData.custom_difficulties.length%PALETTE.length].hex}); document.getElementById('newDifficultyInput').value=''; renderSettingsTags(); } }
function removeDifficulty(i) { dashboardData.custom_difficulties.splice(i,1); renderSettingsTags(); }

function renderAutoRules() {
    const rules = dashboardData.auto_status_rules || [];
    const statuses = (dashboardData.custom_statuses||[]).map(s=>typeof s==='string'?s:s.name);    const container = document.getElementById('autoStatusRules');
    if (!rules.length) { container.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);padding:0.3rem 0;">No rules yet</div>'; return; }
    container.innerHTML = rules.map((r,i) => `<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.4rem;font-size:0.8rem;">
        <span style="font-family:var(--mono);color:var(--text-muted);min-width:1.5rem;">≥</span>
        <input type="number" min="0" max="100" value="${r.threshold}" onchange="updateAutoRule(${i},'threshold',parseInt(this.value))" style="width:60px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);font-family:var(--mono);font-size:0.8rem;padding:0.3rem 0.4rem;border-radius:4px;outline:none;">
        <span style="font-family:var(--mono);color:var(--text-muted);">%</span>
        <span style="color:var(--text-muted);margin:0 0.2rem;">→</span>
        ${makeCustomSelect('auto-rule-'+i, statuses.map(s=>({value:s,label:s,color:null})), r.status||'', v=>updateAutoRule(i,'status',v), true)}
        <span style="cursor:pointer;color:var(--text-muted);font-size:1rem;" onclick="removeAutoRule(${i})">&#215;</span>
    </div>`).join('');
}
function addAutoRule() { if (!dashboardData.auto_status_rules) dashboardData.auto_status_rules=[]; const statuses=(dashboardData.custom_statuses||[]).map(s=>typeof s==='string'?s:s.name); dashboardData.auto_status_rules.push({threshold:0,status:statuses[0]||'WIP'}); renderAutoRules(); }
function updateAutoRule(i,key,value) { if (dashboardData.auto_status_rules&&dashboardData.auto_status_rules[i]) dashboardData.auto_status_rules[i][key]=value; renderAutoRules(); }
function removeAutoRule(i) { if (dashboardData.auto_status_rules) dashboardData.auto_status_rules.splice(i,1); renderAutoRules(); }

function renderScanFolderTags() {
    const folders = dashboardData.scan_folders||[];
    document.getElementById('scanFolderTags').innerHTML = folders.length ? folders.map((f,i)=>`<span class="tag">${esc(f)}<span class="remove-tag" onclick="removeScanFolder(${i})">&#215;</span></span>`).join('') : '<span style="font-size:0.7rem;color:var(--text-muted);">All folders (no filter)</span>';
}
function addScanFolder() { const v=document.getElementById('newScanFolder').value.trim(); if (!v) return; if (!dashboardData.scan_folders) dashboardData.scan_folders=[]; if (!dashboardData.scan_folders.includes(v)) { dashboardData.scan_folders.push(v); document.getElementById('newScanFolder').value=''; renderScanFolderTags(); } }
function removeScanFolder(i) { dashboardData.scan_folders.splice(i,1); renderScanFolderTags(); }

function renderExcludedExtTags() {
    const exts = dashboardData.excluded_extensions||[];
    document.getElementById('excludedExtTags').innerHTML = exts.map((e,i)=>`<span class="tag">${esc(e)}<span class="remove-tag" onclick="removeExcludedExt(${i})">&#215;</span></span>`).join('');
}
function addExcludedExt() { let v=document.getElementById('newExcludedExt').value.trim().toLowerCase(); if (!v) return; if (!v.startsWith('.')) v='.'+v; if (!dashboardData.excluded_extensions) dashboardData.excluded_extensions=[]; if (!dashboardData.excluded_extensions.includes(v)) { dashboardData.excluded_extensions.push(v); document.getElementById('newExcludedExt').value=''; renderExcludedExtTags(); } }
function removeExcludedExt(i) { dashboardData.excluded_extensions.splice(i,1); renderExcludedExtTags(); }

async function saveSettings() {
    dashboardData.auto_status_enabled = document.getElementById('autoStatusEnabled').checked;
    await api('/api/save_settings', _buildSettingsPayload());
    if (dashboardData.auto_status_enabled) {
        for (const shot of dashboardData.assets) {
            if (shot.excluded) continue;
            const newStatus = applyAutoStatus(shot);
            if (newStatus && newStatus !== shot.status) {
                shot.status = newStatus;
                await saveMeta(shot);
            }
        }
    }
    closeSettings();
    dashboardData = await api('/api/scan?path=' + encodeURIComponent(dashboardData.root_path) + '&force=1');
    renderAll(true); showToast('Settings saved');
}

document.getElementById('projectPath').addEventListener('keydown', e => { if (e.key==='Enter') loadProject(); });

if (projectTabs.length > 0 && projectTabs[activeTabIndex]) {
    loadTabProject(projectTabs[activeTabIndex].path);
} else {
    refreshPicker();
}

