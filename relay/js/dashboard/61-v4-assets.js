// ---------------------------------------------------------------------------
// v4: tabs in the expanded asset row, reference galleries, Files tab,
// and project references in the project info panel.
// Wraps buildDetailPanelHTML() from 31-calendar-table.js; v3's own sections are reused as tabs.
// ---------------------------------------------------------------------------
const _v3BuildDetailPanelHTML = window.buildDetailPanelHTML;
const _v4AssetTab = {};
const _v4ThumbCache = {};
const V4_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff'];

function _v4Ext(name) { return (name.split('.').pop() || '').toLowerCase(); }
function _v4JsStr(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

// Where a file's picture comes from: the local file inside the Relay app, otherwise the cloud copy
function _v4MediaSrc(path) {
    const r = window.__relay;
    return r && r.desktop && r.desktop.localMediaUrl ? r.desktop.localMediaUrl(path) : (r ? r.mediaUrl(path) : '');
}
// Images show themselves; videos get a drawn tile with a play badge
function _v4Thumb(ref) {
    if (V4_IMAGE_EXTS.includes(_v4Ext(ref.name))) return _v4MediaSrc(ref.media_key || ref.path);
    if (_v4ThumbCache[ref.path]) return _v4ThumbCache[ref.path];
    let h = 0; for (const ch of ref.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const c = document.createElement('canvas'); c.width = 240; c.height = 180; const x = c.getContext('2d');
    x.fillStyle = `hsl(${h % 360},28%,18%)`; x.fillRect(0, 0, 240, 180);
    x.fillStyle = `hsl(${h % 360},45%,55%)`;
    x.beginPath(); x.arc(70 + h % 100, 95, 34, 0, Math.PI * 2); x.fill();
    x.fillRect(130, 60 + h % 40, 70, 70);
    if (!V4_IMAGE_EXTS.includes(_v4Ext(ref.name))) {
        x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.arc(120, 90, 26, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.moveTo(112, 76); x.lineTo(112, 104); x.lineTo(134, 90); x.closePath(); x.fill();
    }
    return (_v4ThumbCache[ref.path] = c.toDataURL());
}

function _v4RefGallery(refs, assetName) {
    const scope = assetName ? `'${_v4JsStr(assetName)}'` : 'null';
    const tiles = refs.map((r, i) => `
        <div class="v4-ref" title="${esc(r.name)}">
            <button class="v4-ref-thumb" style="background-image:url('${_v4Thumb(r)}');" onclick="event.stopPropagation();v4PreviewRef(${scope},${i})" aria-label="Preview ${esc(r.name)}"></button>
            <div class="v4-ref-cap"><span>${esc(r.name)}</span>${(r.notes || []).length ? `<span class="v4-ref-notes" title="${r.notes.length} note${r.notes.length === 1 ? '' : 's'}">&#9998; ${r.notes.length}</span>` : ''}
                <button class="v4-ref-x" onclick="event.stopPropagation();v4RemoveReference(${scope},${i})" title="Remove from gallery" aria-label="Remove ${esc(r.name)}">&#215;</button></div>
        </div>`).join('');
    const inputId = 'v4up-' + (assetName || '__project').replace(/[^a-zA-Z0-9]/g, '_');
    return `
        <div class="v4-refs">${tiles || '<span class="v4-empty">No references yet.</span>'}</div>
        <div class="v4-ref-actions">
            <label class="btn-sm" for="${inputId}" style="cursor:pointer;">+ Upload</label>
            <input type="file" id="${inputId}" accept="image/*,video/*" multiple hidden onchange="v4UploadReferences(this, ${scope})">
            <button class="btn-sm" onclick="event.stopPropagation();v4BrowseReference(${scope})">Browse this project</button>
        </div>`;
}

function _v4FilesList(shot) {
    const files = [];
    if (shot.last_file) files.push({ label: 'Latest version', path: shot.last_file });
    if (shot.playblast) files.push({ label: 'Playblast', path: shot.playblast });
    (shot.references || []).forEach(r => files.push({ label: 'Reference', path: r.path }));
    if (!files.length) return '<span class="v4-empty">No files found for this asset.</span>';
    return `<div class="v4-files">${files.map(f => `
        <div class="v4-file">
            <span class="v4-file-label">${f.label}</span>
            <span class="v4-file-path">${esc(f.path.replace(dashboardData.root_path + '/', ''))}</span>
            <button class="btn-sm" onclick="event.stopPropagation();v4OpenFile('${_v4JsStr(f.path)}')">Open</button>
            <button class="btn-sm" onclick="event.stopPropagation();v4OpenFile('${_v4JsStr(parentPath(f.path))}')">Folder</button>
        </div>`).join('')}</div>`;
}

window.buildDetailPanelHTML = function (shot, isExcluded, isLib) {
    const html = _v3BuildDetailPanelHTML(shot, isExcluded, isLib);
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const sections = [...tmp.children].filter(el => el.classList.contains('detail-section'));
    const danger = tmp.querySelector('.detail-danger');
    const n = shot.name;
    const refs = shot.references || [];
    // v3's third column holds Version History then Review Notes: split it so notes sit with the media.
    const historySec = document.createElement('div'); historySec.className = 'detail-section';
    const notesSec = document.createElement('div'); notesSec.className = 'detail-section';
    if (sections[2]) {
        let into = historySec;
        [...sections[2].childNodes].forEach(node => {
            if (node.nodeType === 1 && node.tagName === 'H3' && /Review Notes/.test(node.textContent)) into = notesSec;
            into.appendChild(node);
        });
    }
    const tabs = [
        ['details', 'Details'],
        ['refs', `References${refs.length ? ' (' + refs.length + ')' : ''}`],
        ['record', 'History & Files'],
    ];
    const active = _v4AssetTab[n] || 'details';
    const body = {
        details: `<div class="v4-cols v4-cols-media"><div class="v4-media-col">${sections[1]?.outerHTML || ''}${notesSec.outerHTML}</div>${sections[0]?.outerHTML || ''}</div>`,
        refs: `<div class="detail-section"><h3>References</h3>${_v4RefGallery(refs, n)}</div>`,
        record: `<div class="v4-cols v4-cols-2">${historySec.outerHTML}<div class="detail-section"><h3>Files</h3>${_v4FilesList(shot)}</div></div>`,
    }[active];
    return `
        <div class="v4-asset-tabs" role="tablist">${tabs.map(([k, label]) =>
            `<button role="tab" aria-selected="${k === active}" class="${k === active ? 'active' : ''}" onclick="event.stopPropagation();v4SetAssetTab('${_v4JsStr(n)}','${k}')">${label}</button>`).join('')}</div>
        <div class="v4-asset-body">${body}</div>
        ${danger ? danger.outerHTML : ''}`;
};

function _v4InLibrary() { return document.getElementById('libraryModal')?.classList.contains('open'); }
function _v4Repaint(shotName) { if (_v4InLibrary() && typeof renderLibTable === 'function') renderLibTable(); else patchDetailPanel(shotName); }
function v4SetAssetTab(shotName, tab) { _v4AssetTab[shotName] = tab; _v4Repaint(shotName); }

async function v4OpenFile(path) { await api('/api/open_file', { filepath: path }); }

function _v4Target(assetName) { return assetName ? dashboardData.assets.find(a => a.name === assetName) : dashboardData; }
function _v4Refresh(assetName) { if (assetName) { _v4Repaint(assetName); if (!_v4InLibrary()) patchRowIfAny(assetName); } else renderProjectReferences(); }
function patchRowIfAny(name) { try { if (typeof patchRow === 'function') patchRow(name); } catch (e) {} }

async function _v4AddReference(assetName, ref) {
    const res = await api('/api/add_reference', Object.assign({ root_path: dashboardData.root_path, asset_name: assetName || '' }, ref));
    if (res.error) { showToast(res.error); return; }
    const t = _v4Target(assetName); t.references = t.references || []; t.references.push(res.reference);
    return res;
}

function v4UploadReferences(input, assetName) {
    const files = [...input.files]; if (!files.length) return;
    let left = files.length, folder = '';
    const done = res => {
        if (res) folder = res.saved_to;
        if (--left === 0) { _v4Refresh(assetName); showToast(`Uploaded ${files.length} file${files.length > 1 ? 's' : ''} · saved to ${folder.replace(dashboardData.root_path + '/', '')}`); }
    };
    const folder0 = `${dashboardData.root_path}/${dashboardData.refs_folder || 'D_docs/References'}${assetName ? '/' + assetName : ''}`;
    files.forEach(async file => {
        const key = `${folder0}/${file.name}`;
        const up = await fetch(`${__relay.worker}/media?key=${encodeURIComponent(key)}`, { method: 'PUT', headers: { ...__relay.authHeader(), 'Content-Type': file.type || 'application/octet-stream' }, body: file })
            .then(r => r.json()).catch(() => ({ error: 'Upload failed' }));
        if (up.error) { showToast(up.error); done(null); return; }
        done(await _v4AddReference(assetName, { name: file.name, media_key: key }));
    });
    input.value = '';
}

function v4BrowseReference(assetName) {
    const root = dashboardData.root_path;
    openFileBrowser('file', root + '/' + (dashboardData.refs_folder || 'D_docs/References'), async path => {
        if (!path || !(path === root || path.startsWith(root + '/'))) { showToast('Pick a file inside this project.'); return; }
        const res = await _v4AddReference(assetName, { name: path.split(/[/\\]/).pop(), path });
        if (res) { _v4Refresh(assetName); showToast(`Reference added: ${path.split(/[/\\]/).pop()}`); }
    });
}

// Clicking a reference previews it right here (image or video); "Open on computer" is still one click away.
let _v4Preview = null;
function v4PreviewRef(assetName, index) {
    const refs = _v4Target(assetName).references || [];
    if (!refs[index]) return;
    _v4Preview = { assetName, index };
    const r = refs[index], isImg = V4_IMAGE_EXTS.includes(_v4Ext(r.name));
    const src = _v4MediaSrc(r.media_key || r.path);
    const media = isImg ? `<img src="${src}" alt="${esc(r.name)}">` : `<video src="${src}" controls autoplay loop></video>`;
    let el = document.getElementById('v4RefPreview');
    if (!el) {
        el = document.createElement('div'); el.id = 'v4RefPreview'; el.className = 'v4-preview';
        el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
        el.addEventListener('click', e => { if (e.target === el) v4ClosePreview(); });
        document.body.appendChild(el);
    }
    const many = refs.length > 1, notes = r.notes || [];
    el.innerHTML = `
        <div class="v4-preview-box">
            <div class="v4-preview-main">
                <div class="v4-preview-media">${media}</div>
                <div class="v4-preview-notes">
                    <div class="v4-preview-notes-head">Notes${notes.length ? ` <span class="v4-muted">${notes.length}</span>` : ''}</div>
                    <div class="v4-preview-notes-list">${notes.length ? notes.map(n => `
                        <div class="v4-preview-note"><div class="v4-muted">${esc(n.author)} · ${esc(n.date)}</div><div>${esc(n.text)}</div></div>`).join('')
                        : '<div class="v4-muted">No notes yet.</div>'}</div>
                    <textarea id="v4RefNoteInput" rows="2" placeholder="Add a note…" aria-label="Add a note to ${esc(r.name)}"></textarea>
                    <button class="btn-sm" onclick="v4AddRefNote()">Add note</button>
                </div>
            </div>
            <div class="v4-preview-bar">
                ${many ? `<button class="btn-sm" onclick="v4PreviewRef(${assetName ? `'${_v4JsStr(assetName)}'` : 'null'},${(index - 1 + refs.length) % refs.length})" aria-label="Previous reference">&#8249;</button>` : ''}
                <span class="v4-preview-name">${esc(r.name)}${many ? ` <span class="v4-muted">${index + 1} / ${refs.length}</span>` : ''}</span>
                ${many ? `<button class="btn-sm" onclick="v4PreviewRef(${assetName ? `'${_v4JsStr(assetName)}'` : 'null'},${(index + 1) % refs.length})" aria-label="Next reference">&#8250;</button>` : ''}
                <button class="btn-sm" onclick="v4OpenFile('${_v4JsStr(r.path)}')">Open on computer</button>
                <button class="btn-sm" onclick="v4ClosePreview()" aria-label="Close preview">&#215;</button>
            </div>
        </div>`;
    el.querySelector('.v4-preview-bar button:last-child').focus();
}
async function v4AddRefNote() {
    const input = document.getElementById('v4RefNoteInput'), text = input.value.trim();
    if (!text || !_v4Preview) return;
    const { assetName, index } = _v4Preview;
    const res = await api('/api/ref_note', { root_path: dashboardData.root_path, asset_name: assetName || '', index, text });
    if (res.error) { showToast(res.error); return; }
    const ref = _v4Target(assetName).references[index];
    if (ref.notes !== res.note && !(ref.notes || []).includes(res.note)) (ref.notes = ref.notes || []).push(res.note);
    v4PreviewRef(assetName, index);
    _v4Refresh(assetName);
    document.getElementById('v4RefNoteInput')?.focus();
}
function v4ClosePreview() { document.getElementById('v4RefPreview')?.remove(); _v4Preview = null; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && _v4Preview) { e.stopPropagation(); v4ClosePreview(); } }, true);

async function v4RemoveReference(assetName, index) {
    const t = _v4Target(assetName); const ref = t.references[index];
    await api('/api/remove_reference', { root_path: dashboardData.root_path, asset_name: assetName || '', index });
    t.references.splice(index, 1);
    _v4Refresh(assetName);
    showToast(`Removed ${ref.name} from the gallery. The file stays on the server.`);
}

// ── Project references: a section in the project info panel (▾ under the title) ──
function renderProjectReferences() {
    const inner = document.querySelector('#projectInfoPanel .project-info-inner');
    if (!inner || !dashboardData) return;
    let sec = document.getElementById('v4ProjectRefs');
    if (!sec) { sec = document.createElement('div'); sec.id = 'v4ProjectRefs'; sec.className = 'project-info-section v4-proj-refs'; inner.appendChild(sec); }
    sec.innerHTML = `<h3>Project References</h3>${_v4RefGallery(dashboardData.references || [], null)}`;
}

const _v3InitProjectUI = window._initProjectUI;
window._initProjectUI = function () { _v3InitProjectUI.apply(this, arguments); renderProjectReferences(); };
if (typeof dashboardData !== 'undefined' && dashboardData) renderProjectReferences();
