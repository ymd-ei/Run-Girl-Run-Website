// ---------------------------------------------------------------------------
// v4 home: the project picker becomes a grid of tiles.
// Replaces refreshPicker() from 40-settings-picker.js; adds Add existing / Remove.
// ---------------------------------------------------------------------------
let _homeShowArchived = false;
let _homeConfirmRemove = null;
let _homeAddOpen = false;

function _homeStatusBar(p) {
    const statuses = (p.statuses || []).map(s => ({ name: statusName(s), color: statusColor(s) }));
    const total = p.asset_count || 0;
    if (!total) return `<div class="home-tile-empty">No assets tracked yet</div>`;
    const bar = statuses.map(s => {
        const n = p.counts[s.name] || 0;
        return n ? `<span style="width:${n / total * 100}%;background:${s.color};"></span>` : '';
    }).join('');
    const legend = statuses.filter(s => p.counts[s.name]).map(s =>
        `<span><span class="home-dot" style="background:${s.color};"></span>${esc(s.name)} ${p.counts[s.name]}</span>`).join('');
    return `<div class="home-bar">${bar}</div><div class="home-legend">${legend}</div>`;
}

function _homeDateLine(p) {
    if (p.state !== 'active') return p.completed_date ? `Delivered ${p.completed_date}` : 'Delivered';
    if (!p.end_date) return 'No end date';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(p.end_date + 'T00:00:00') - today) / 86400000) + 1;
    if (days < 0) return `<span style="color:var(--red);">${-days}d overdue</span>`;
    return days === 1 ? `<span style="color:var(--yellow);">Due today</span>` : `${days} days left`;
}

function _homeTile(p) {
    const path = p.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const confirming = _homeConfirmRemove === p.path;
    return `
    <div class="home-tile ${p.state}" onclick="loadPickerProject('${path}')" tabindex="0" role="button"
         onkeydown="if(event.key==='Enter'&&event.target===this)loadPickerProject('${path}')" aria-label="Open ${esc(p.name)}">
        <div class="home-tile-top">
            <span class="home-tile-name">${esc(p.name)}</span>
            <span class="home-tile-code">${esc(p.code)}</span>
            <span class="home-state ${p.state}">${p.state}</span>
        </div>
        ${_homeStatusBar(p)}
        <div class="home-tile-foot">
            <span style="flex:1;min-width:0;">${p.asset_count} asset${p.asset_count === 1 ? '' : 's'} · ${p.people} ${p.people === 1 ? 'person' : 'people'} · ${_homeDateLine(p)}</span>
            ${confirming
                ? `<button class="btn-sm home-btn home-danger" onclick="event.stopPropagation();homeRemoveProject('${path}')">Confirm remove</button>
                   <button class="btn-sm home-btn" onclick="event.stopPropagation();homeAskRemove(null)">Keep</button>`
                : `<button class="btn-sm home-btn home-muted" onclick="event.stopPropagation();homeAskRemove('${path}')" title="Stop showing this project in Relay">Remove</button>`}
        </div>
    </div>`;
}

async function refreshPicker() {
    const data = await fetch('/api/list_projects').then(r => r.json());
    const noStudio  = document.getElementById('pickerNoStudio');
    const listWrap  = document.getElementById('pickerProjectList');
    const items     = document.getElementById('pickerItems');
    const empty     = document.getElementById('pickerEmpty');
    const studioLbl = document.getElementById('pickerStudioLabel');
    if (!data.studio_root) { noStudio.style.display = 'block'; listWrap.style.display = 'none'; return; }
    noStudio.style.display = 'none';
    listWrap.style.display = 'block';
    const parts = data.studio_root.replace(/\\/g, '/').split('/').filter(Boolean);
    studioLbl.textContent = parts.slice(-2).join(' / ');
    const archToggle = document.getElementById('homeShowArchived');
    if (archToggle) archToggle.checked = _homeShowArchived;

    const shown = (data.projects || []).filter(p => _homeShowArchived || p.state !== 'archived');
    const order = { active: 0, complete: 1, archived: 2 };
    shown.sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name));
    empty.style.display = shown.length ? 'none' : 'block';
    items.innerHTML = shown.map(_homeTile).join('');
    await _homeRenderAddPanel();
}

function homeToggleArchived(on) { _homeShowArchived = on; refreshPicker(); }
function homeAskRemove(path) { _homeConfirmRemove = path; refreshPicker(); }

async function homeRemoveProject(path) {
    const name = path.split(/[/\\]/).pop();
    const res = await api('/api/remove_project', { path });
    _homeConfirmRemove = null;
    if (res.error) { showToast(res.error); return; }
    showToast(`${name} removed from Relay. Its files are untouched.`);
    refreshPicker();
}

function homeToggleAdd() { _homeAddOpen = !_homeAddOpen; _homeRenderAddPanel(); }

async function _homeRenderAddPanel() {
    const panel = document.getElementById('homeAddPanel');
    if (!panel) return;
    panel.style.display = _homeAddOpen ? 'block' : 'none';
    if (!_homeAddOpen) return;
    const data = await fetch('/api/list_untracked').then(r => r.json());
    const folders = data.folders || [];
    panel.innerHTML = `
        <div class="home-add-head">
            <span>Add existing project</span>
        </div>
        ${folders.length ? folders.map(f => `
            <div class="home-add-row">
                <span>01_Projects/${esc(f.name)}</span>
                <button class="btn-sm home-btn" onclick="homeAddProject('${f.path.replace(/'/g, "\\'")}')">Add</button>
            </div>`).join('') : `<div class="home-add-sub" style="padding:0.5rem 0;">Every folder is already in Relay.</div>`}`;
}

async function homeAddProject(path) {
    const res = await api('/api/add_project', { path });
    if (res.error) { showToast(res.error); return; }
    showToast(`Added ${path.split(/[/\\]/).pop()}`);
    refreshPicker();
}

// ---------------------------------------------------------------------------
// The home page is a floating window, not the start. Relay opens into your
// last project (or the first one you're on); Projects / the Relay name float
// the list on top, and closing it returns to the project underneath.
// ---------------------------------------------------------------------------
function v4OpenHome() {
    document.getElementById('setupScreen').style.display = 'flex';
    document.body.classList.add('v4-home-open');
    refreshPicker();
}
function v4CloseHome() {
    if (!dashboardData) return;   // nothing underneath yet
    document.getElementById('setupScreen').style.display = 'none';
    document.body.classList.remove('v4-home-open');
}
window.changeProject = v4OpenHome;   // v3's "change project" now just floats the list

async function v4OpenDefaultProject() {
    const data = await fetch('/api/list_projects').then(r => r.json());
    const open = (data.projects || []).filter(p => p.state !== 'archived');
    let last = null; try { last = localStorage.getItem('v4_last_project'); } catch (e) {}
    const pick = open.find(p => p.path === last) || open.find(p => p.state === 'active') || open[0];
    if (pick) { await loadPickerProject(pick.path); document.body.classList.remove('v4-home-open'); }
    else v4OpenHome();
}
// Remember the project you were in
const _v4InitHome = window._initProjectUI;
window._initProjectUI = function () { _v4InitHome.apply(this, arguments); try { localStorage.setItem('v4_last_project', dashboardData.root_path); } catch (e) {} document.body.classList.remove('v4-home-open'); };

(function () {
    const brand = document.querySelector('#topAppBar .relay-brand');
    if (brand) { brand.style.cursor = 'pointer'; brand.title = 'Projects'; brand.onclick = v4OpenHome; }
    const bar = document.getElementById('topAppBar'), sources = bar && bar.querySelector('[onclick="openLibrary()"]');
    if (sources && !document.getElementById('v4ProjectsBtn')) {
        const b = document.createElement('button'); b.id = 'v4ProjectsBtn'; b.className = 'btn-sm'; b.innerHTML = '&#9638; Projects'; b.onclick = v4OpenHome;
        bar.insertBefore(b, sources);
    }
    const card = document.querySelector('.setup-card.home-card');
    if (card && !card.querySelector('.v4-home-close')) {
        const x = document.createElement('button'); x.className = 'v4-home-close'; x.innerHTML = '&#215;'; x.title = 'Back to the project'; x.setAttribute('aria-label', 'Close');
        x.onclick = v4CloseHome; card.prepend(x);
    }
    const scr = document.getElementById('setupScreen');
    scr.addEventListener('click', e => { if (e.target === scr) v4CloseHome(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('v4-home-open')) v4CloseHome(); });
})();
// (Opening the default project happens in the last module, once everything has loaded.)
