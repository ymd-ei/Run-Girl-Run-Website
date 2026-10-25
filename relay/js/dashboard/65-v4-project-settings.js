// ---------------------------------------------------------------------------
// v4: Project Settings, rebuilt in the Studio Settings style (tabs on the left).
// Reuses v3's own editors by moving them in: statuses/difficulties/auto-status,
// scan folders/ignored types, and the timeline + credits editor from the ▾ panel.
// The ▾ panel keeps description + references, and shows timeline/credits read-only.
// ---------------------------------------------------------------------------
let _v4PsTab = 'people';
let _v4PsPanes = null;

function _v4BuildPanes() {
    if (_v4PsPanes) return _v4PsPanes;
    const old = document.querySelector('#projectSettingsModal .modal');
    const fields = [...old.querySelectorAll(':scope > .field')];
    const byLabel = t => fields.find(f => (f.querySelector('label')?.textContent || '').includes(t));
    const mk = () => document.createElement('div');
    const statuses = mk(), files = mk(), credits = mk();
    ['Custom Statuses', 'Custom Difficulties', 'Auto-Status Rules'].forEach(t => { const f = byLabel(t); if (f) statuses.appendChild(f); });
    const scan = byLabel('Scan Folders'), excl = byLabel('Excluded Extensions');
    // v3's timeline + credits editor (2nd section of the ▾ panel) moves here
    const timeline = document.querySelectorAll('#projectInfoPanel .project-info-inner > .project-info-section')[1];
    if (timeline) credits.appendChild(timeline);
    _v4PsPanes = { statuses, files, credits, scan, excl };
    // v3's editors find their parts by id, so parked panes stay on the page (hidden)
    const holder = document.createElement('div'); holder.id = 'v4PsHolder'; holder.hidden = true;
    document.body.appendChild(holder);
    _v4PsPanes.holder = holder;
    _v4ParkPanes();
    return _v4PsPanes;
}
function _v4ParkPanes() {
    const p = _v4PsPanes; if (!p) return;
    [p.statuses, p.credits, p.scan, p.excl].forEach(el => { if (el && el.parentNode !== p.holder) p.holder.appendChild(el); });
}

// v3 only fills its description/date/credit editors when the ▾ panel opens, and saves whatever they hold.
// Fill them from the data before Project Settings shows or saves them, so nothing is wiped.
function _v4FillInfoEditors() {
    const info = dashboardData.project_info || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const show = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
    set('projDescription', info.description || '');
    set('projStartDate', info.start_date || ''); show('projStartDateDisplay', info.start_date);
    set('projEndDate', info.end_date || ''); show('projEndDateDisplay', info.end_date);
    const row = document.getElementById('projCompletedRow');
    if (row) row.style.display = dashboardData.project_complete ? '' : 'none';
    set('projCompletedDate', dashboardData.completed_date || ''); show('projCompletedDateDisplay', dashboardData.completed_date);
    renderCredits(info.credits || []);
}

async function v4OpenProjectSettings(tab) {
    if (!dashboardData) return;
    _v4BuildPanes();
    _v4FillInfoEditors();
    if (tab) _v4PsTab = tab;
    renderSettingsTags(); renderAutoRules(); renderScanFolderTags(); renderExcludedExtTags();
    document.getElementById('autoStatusEnabled').checked = dashboardData.auto_status_enabled || false;
    v4EnsureSettingsModal('v4ProjectSettings').classList.add('open');
    await _v4RenderPs();
}
window.openProjectSettings = v4OpenProjectSettings;

function v4PsTab(k) { _v4PsTab = k; _v4RenderPs(); }

async function v4ProjectSettingsClosed() {
    _v4ParkPanes();
    await saveSettings();
    _initProjectUI(); renderStats(); renderV4PanelSummary();
}

let _v4PsCat = 'All', _v4PsQ = '';
function v4PsCat(k) { _v4PsCat = k; _v4RenderPs(); }
function v4PsSearch(q) { _v4PsQ = q; v4ApplySearch('v4PsSearch', q); }

function _v4Credits() { const i = dashboardData.project_info = dashboardData.project_info || {}; return (i.credits = i.credits || []); }
// Credits field = only people outside Relay. Members' credit roles live on their person record.

// People & credits: being on the project and being in its credits are one list.
async function _v4PsPeople() {
    const info = dashboardData.project_info || {};
    const res = await api('/api/project_people?path=' + encodeURIComponent(dashboardData.root_path));
    if (res.error) return `<p class="v4-muted">${esc(res.error)}</p>`;
    _v4PsLast = res;
    const all = res.people;
    // Same tabs as Studio People: kind, then roles (credit roles here, skills there)
    const roleNames = [...new Set(all.flatMap(p => p.credit_roles || []))].sort((a, b) => _v4HeadingRank(a) - _v4HeadingRank(b) || a.localeCompare(b));
    const inCat = (p, k) => k === 'All' || (k === 'Leads' ? p.role === 'Lead' : k === 'Staff' ? (p.kind || 'Staff') === 'Staff' : k === 'Collaborators' ? p.kind === 'Collaborator' : (p.credit_roles || []).includes(k));
    const cats = [['All', all.length], ['Leads', 0], ['Staff', 0], ['Collaborators', 0], ...roleNames.map(r => [r, 0])].map(([k]) => [k, all.filter(p => inCat(p, k)).length]).filter(([k, n]) => n || k === 'All');
    const q = _v4PsQ.trim().toLowerCase();
    const shown = all.filter(p => inCat(p, _v4PsCat)
        && (!q || (p.name + ' ' + p.email + ' ' + p.dept + ' ' + (p.credit_roles || []).join(' ')).toLowerCase().includes(q)));
    const can = res.canManage;
    const rows = shown.map(p => {
        const fixed = p.studioRole !== 'Member';
        const roles = p.credit_roles || [];
        return v4PersonRow({
            name: p.name, sub: p.email, q: [p.name, p.email, p.dept, p.kind || 'Staff', ...roles].join(' '),
            chips: v4KindChip(p, false) + (p.status === 'Invited' ? ' <span class="v4-chip v4-chip-invited">Invited</span>' : ''),
            role: fixed ? '<span class="v4-role-fixed">Studio admin</span>'
                : `<select ${can ? '' : 'disabled'} onchange="v4SetProjectRole('${p.id}', this.value)" aria-label="Project role for ${esc(p.name)}">${['Lead', 'Member'].map(r => `<option ${r === p.role ? 'selected' : ''}>${r}</option>`).join('')}</select>`,
            tagsTitle: 'Credit roles on this project',
            tags: v4TagEditor(roles, i => `v4RemoveCreditRole('${p.id}',${i})`, `aria-label="Add credit role for ${esc(p.name)}" onkeydown="if(event.key==='Enter'&&this.value.trim()){v4AddCreditRole('${p.id}',this.value.trim());}"`, '+ credit role', can) + (!can && !roles.length ? '<span class="v4-muted">Not credited</span>' : ''),
            actions: fixed || !can ? '' : `<button class="btn-sm" onclick="v4SetProjectRole('${p.id}', null)">Remove</button>`,
        });
    }).join('');
    const outside = _v4Credits().map((c, i) => [c, i]).filter(([c]) => c.name);
    const add = can && res.others.length ? `
        <div class="field"><label>Add people to this project</label>
            <div class="v4-invite">
                <select id="v4PsAddWho" aria-label="Person">${res.others.map(o => `<option value="${o.id}">${esc(o.name)}${o.dept ? ' · ' + esc(o.dept) : ''}</option>`).join('')}</select>
                <select id="v4PsAddRole" aria-label="Role">${['Member', 'Lead'].map(r => `<option>${r}</option>`).join('')}</select>
                <button class="btn-sm" onclick="v4SetProjectRole(document.getElementById('v4PsAddWho').value, document.getElementById('v4PsAddRole').value)">Add to project</button>
            </div>
            ${_v4IsAdmin() ? '<a href="#" class="v4-small-link" onclick="event.preventDefault();v4OpenStudioSettings(\'people\')">Invite someone new</a>' : ''}</div>` : '';
    return `
        <div class="field"><label>Timeline</label>
            <div class="v4-timeline">
                <span class="v4-muted">Start</span><input type="date" value="${esc(info.start_date || '')}" ${can ? '' : 'disabled'} onchange="v4SetDate('start_date', this.value)" aria-label="Start date">
                <span class="v4-muted">→ End</span><input type="date" value="${esc(info.end_date || '')}" ${can ? '' : 'disabled'} onchange="v4SetDate('end_date', this.value)" aria-label="End date">
                ${dashboardData.project_complete && dashboardData.completed_date ? `<span class="v4-muted">· Delivered ${esc(dashboardData.completed_date)}</span>` : ''}
            </div></div>
        ${add}
        <div class="field"><label style="display:flex;align-items:center;justify-content:space-between;">People &amp; credits<button class="btn-sm" style="text-transform:none;letter-spacing:0;" onclick="v4ExportCredits()">&#8628; Export credits</button></label>
            ${v4CatBar(cats, _v4PsCat, 'v4PsCat', _v4PsQ, 'v4PsSearch', 'v4PsSearch')}
            <div class="v4-people">${rows || '<div class="v4-empty-row">Nobody matches.</div>'}</div>
</div>
        <div class="field"><label>Also credited (not using Relay)</label>
            <div class="v4-people">${outside.length ? outside.map(([c, i]) => v4PersonRow({
                name: c.name, sub: c.contact || '', chips: '<span class="v4-kind-chip v4-kind-staff">Outside</span>',
                role: '<span class="v4-muted">credit only</span>',
                tags: (c.roles || []).map(r => `<span class="role-tag">${esc(r)}</span>`).join(''),
                actions: can ? `<button class="btn-sm" onclick="v4RemoveOutsideCredit(${i})">Remove</button>` : '' })).join('') : '<div class="v4-empty-row">Nobody yet.</div>'}</div>
            ${can ? `<div class="v4-invite" style="margin-top:0.5rem;"><input type="text" id="v4OutName" placeholder="Name"><input type="text" id="v4OutRoles" placeholder="Credit roles, comma separated"><button class="btn-sm" onclick="v4AddOutsideCredit()">Add credit</button></div>` : ''}</div>
`;
}
let _v4PsLast = null;

async function _v4SaveInfo(msg) {
    const i = dashboardData.project_info || {};
    await api('/api/save_project_info', { root_path: dashboardData.root_path, description: i.description || '', credits: _v4Credits(), start_date: i.start_date || '', end_date: i.end_date || '', completed_date: dashboardData.completed_date || '' });
    renderCredits(_v4Credits());   // keep v3's own credits data in step
    if (msg) showToast(msg);
}
async function v4SetDate(key, value) { dashboardData.project_info[key] = value; await _v4SaveInfo('Saved ' + (key === 'start_date' ? 'start date' : 'end date')); renderStats(); }
async function _v4SaveCreditRoles(id, roles) {
    await api('/api/person_credit/set', { path: dashboardData.root_path, id, roles });
    const p = projectPeople().find(x => x.id === id); if (p) p.credit_roles = roles;
}
async function v4AddCreditRole(id, role) {
    const p = (_v4PsLast?.people || []).find(x => x.id === id); if (!p) return;
    const roles = [...new Set([...(p.credit_roles || []), role])];
    await _v4SaveCreditRoles(id, roles); await _v4RenderPs();
    const inp = [...document.querySelectorAll('#v4ProjectSettings .v4-credit-tags input')].find(x => x.getAttribute('aria-label') === 'Add credit role for ' + p.name); if (inp) inp.focus();
}
async function v4RemoveCreditRole(id, ri) {
    const p = (_v4PsLast?.people || []).find(x => x.id === id); if (!p) return;
    const roles = (p.credit_roles || []).filter((_, i) => i !== ri);
    await _v4SaveCreditRoles(id, roles); _v4RenderPs();
}
async function v4AddOutsideCredit() {
    const name = document.getElementById('v4OutName').value.trim(); if (!name) { showToast('Enter a name first.'); return; }
    const roles = document.getElementById('v4OutRoles').value.split(',').map(x => x.trim()).filter(Boolean);
    _v4Credits().push({ name, roles, contact: '' }); await _v4SaveInfo(`${name} added to the credits`); _v4RenderPs();
}
async function v4RemoveOutsideCredit(i) { const [c] = _v4Credits().splice(i, 1); await _v4SaveInfo(`${c.name} removed from the credits`); _v4RenderPs(); }

function _v4PsFiles() {
    const rel = p => p ? esc(p.replace(dashboardData.root_path + '/', '')) : '<span class="v4-muted">Not set</span>';
    return `
        <div class="field"><label>Current edit</label>
            <div class="v4-file"><span class="v4-file-path">${rel(dashboardData.current_edit)}</span>
                <button class="btn-sm" onclick="v4PlayCurrentEdit()">&#9654; Play</button>
                <button class="btn-sm" onclick="v4ChangeCurrentEdit()">Change…</button></div>
</div>
        <div class="field"><label>Completion &amp; final media</label>
            <div class="v4-file"><span class="v4-file-path">${dashboardData.project_complete ? `Delivered ${esc(dashboardData.completed_date || '')} · ${rel(dashboardData.final_media)}` : '<span class="v4-muted">Not complete yet</span>'}</span>
                <button class="btn-sm v4-manage-only" style="${dashboardData.project_complete ? '' : 'border-color:#ffd70066;color:#ffd700;'}" onclick="v4PsComplete()">${dashboardData.project_complete ? '&#8634; Reopen project…' : '&#9733; Mark complete…'}</button></div>
</div>
        <div id="v4PsScanSlot"></div><div id="v4PsExclSlot"></div>`;
}

async function _v4PsActivity() {
    const res = await api('/api/activity_log?path=' + encodeURIComponent(dashboardData.root_path));
    const rows = (res.entries || []).slice().reverse();
    if (!rows.length) return '<p class="v4-muted">No changes recorded yet.</p>';
    return `
        <div class="v4-activity">${rows.map(e => `<div class="v4-act-row">
            <span class="v4-muted">${esc(e.ts)}</span><span>${esc(e.user)}</span><span class="v4-act-asset">${esc(e.asset)}</span>
            <span>${esc(e.field)}: <span class="v4-muted">${esc(String(e.before || '—'))}</span> → ${esc(String(e.after || '—'))}</span></div>`).join('')}</div>`;
}

async function _v4RenderPs() {
    const panes = _v4BuildPanes();
    _v4ParkPanes();
    if (!['people', 'statuses', 'files', 'activity'].includes(_v4PsTab)) _v4PsTab = 'people';
    const name = dashboardData.root_path.split(/[/\\]/).pop();
    const tabs = [['people', 'People &amp; credits'], ['statuses', 'Statuses &amp; rules'], ['files', 'Files &amp; media'], ['activity', 'Activity']];
    let body = '';
    if (_v4PsTab === 'people') body = await _v4PsPeople();
    else if (_v4PsTab === 'files') body = _v4PsFiles();
    else if (_v4PsTab === 'activity') body = await _v4PsActivity();
    else body = '<div id="v4PsPaneSlot"></div>';
    document.getElementById('v4ProjectSettingsBody').innerHTML = v4SettingsShell('v4ProjectSettings', 'Project Settings',
        esc(name), tabs, _v4PsTab, 'v4PsTab', body);
    // drop v3's live editors into place
    if (_v4PsTab === 'statuses') document.getElementById('v4PsPaneSlot').appendChild(panes.statuses);
    if (_v4PsTab === 'files') { if (panes.scan) document.getElementById('v4PsScanSlot').appendChild(panes.scan); if (panes.excl) document.getElementById('v4PsExclSlot').appendChild(panes.excl); }
}

async function v4SetProjectRole(id, role) {
    const res = await api('/api/project_people/set', { path: dashboardData.root_path, id, role });
    if (res.error) { showToast(res.error); return; }
    const fresh = await api('/api/project_people?path=' + encodeURIComponent(dashboardData.root_path));
    if (!fresh.error) dashboardData.people = fresh.people;
    renderFilters();
    showToast(role ? `Role set to ${role}` : 'Removed from this project');
    _v4RenderPs(); v4ApplyRole();
}
function v4PlayCurrentEdit() { document.getElementById('v4ProjectSettings').classList.remove('open'); openCurrentEditVideo(); }
function v4ChangeCurrentEdit() {
    openFileBrowser('media', dashboardData.root_path, async path => {
        if (!path) return;
        dashboardData.current_edit = path; await saveProjectMeta();
        showToast('Current edit updated'); _v4RenderPs();
    });
}

// ── ▾ panel: timeline + credits shown read-only (edited in Project Settings) ──
function renderV4PanelSummary() {
    const inner = document.querySelector('#projectInfoPanel .project-info-inner');
    if (!inner || !dashboardData) return;
    let sec = document.getElementById('v4PanelSummary');
    if (!sec) { sec = document.createElement('div'); sec.id = 'v4PanelSummary'; sec.className = 'project-info-section'; inner.insertBefore(sec, inner.children[1] || null); }
    const i = dashboardData.project_info || {};
    // Grouped by role, names on one line, so a 50-person crew stays a few lines (same order as the credits export)
    const byRole = {};
    _v4CreditEntries().forEach(e => e.roles.forEach(r => (byRole[r] = byRole[r] || []).push(e.name)));
    const groups = Object.keys(byRole).sort((a, b) => _v4HeadingRank(a) - _v4HeadingRank(b) || a.localeCompare(b))
        .map(role => ({ role, names: byRole[role].sort((a, b) => a.localeCompare(b)) }));
    sec.innerHTML = `<h3>Timeline &amp; credits</h3>
        <div class="v4-sum-row"><span class="v4-muted">Start</span><span>${esc(i.start_date || '—')}</span><span class="v4-muted">→ End</span><span>${esc(i.end_date || '—')}</span>
            ${dashboardData.project_complete && dashboardData.completed_date ? `<span class="v4-muted">· Delivered</span><span>${esc(dashboardData.completed_date)}</span>` : ''}</div>
        <div class="v4-sum-credits">${groups.length ? groups.map(g => `<div class="v4-sum-group"><span class="v4-muted">${esc(g.role)}</span><span>${g.names.map(esc).join(', ')}</span></div>`).join('') : '<span class="v4-muted">No credits yet</span>'}</div>
        <div style="display:flex;gap:0.4rem;margin-top:0.6rem;"><button class="btn-sm v4-manage-only" onclick="v4OpenProjectSettings('people')">Edit in Project Settings</button><button class="btn-sm" onclick="v4ExportCredits()">&#8628; Export credits</button></div>`;
}
const _v4InitProjectUIPs = window._initProjectUI;
window._initProjectUI = function () { _v4InitProjectUIPs.apply(this, arguments); _v4BuildPanes(); renderV4PanelSummary(); };
if (typeof dashboardData !== 'undefined' && dashboardData) { _v4BuildPanes(); renderV4PanelSummary(); }

// ---------------------------------------------------------------------------
// Credits export: the project's people + their credit roles, formatted for the edit.
// End-credits text (grouped by role), CSV (for spreadsheets / title tools), or one line per person.
// ---------------------------------------------------------------------------
const V4_ROLE_ORDER = ['Director', 'Producer', 'Writer', 'Storyboard Artist', 'Animator', 'Layout Artist', 'Modeler', 'Rigger', 'Lighting Artist', 'FX Artist', 'Compositor', 'Editor', 'Music', 'Sound'];
const V4_NO_LEAD_PREFIX = ['Director', 'Producer'];   // already leading roles
let _v4CreditFmt = 'credits', _v4CreditSplit = true;
let _v4CsvCols = [
    { key: 'role', label: 'Role', on: true }, { key: 'name', label: 'Name', on: true },
    { key: 'type', label: 'Type', on: true }, { key: 'contact', label: 'Contact', on: true },
];

// Each person + how each of their roles reads in the credits.
// Project leads (set as Lead on this project) read "Lead Animator"; collaborators can read "Additional Animator".
function _v4CreditEntries() {
    const members = projectPeople().filter(p => (p.credit_roles || []).length).map(p => ({
        name: p.creditName || p.name, roles: p.credit_roles, kind: p.kind || 'Staff', contact: '',   // credits use the credit name
        lead: p.role === 'Lead' && p.studioRole === 'Member',
    }));
    const outside = ((dashboardData.project_info || {}).credits || []).filter(c => c.name).map(c => ({ name: c.name, roles: c.roles || [], kind: 'Outside', contact: c.contact || '', lead: false }));
    return members.concat(outside);
}
// "Lead" goes on a lead's main role only (their first credit role), e.g. Lead Rigger, then Storyboard Artist
function _v4CreditRole(e, r, split) {
    if (e.lead && r === e.roles[0] && !V4_NO_LEAD_PREFIX.includes(r)) return 'Lead ' + r;
    if (split && e.kind === 'Collaborator') return 'Additional ' + r;
    return r;
}
function _v4BaseRole(h) { return h.replace(/^(Lead|Additional) /, ''); }
function _v4HeadingRank(h) {
    const i = V4_ROLE_ORDER.indexOf(_v4BaseRole(h));
    return (i < 0 ? 100 : i) * 3 + (h.startsWith('Lead ') ? 0 : h.startsWith('Additional ') ? 2 : 1);   // Lead X, X, Additional X
}
function _v4Groups(split) {
    const groups = {};
    _v4CreditEntries().forEach(e => e.roles.forEach(r => { const h = _v4CreditRole(e, r, split); (groups[h] = groups[h] || []).push(e.name); }));
    const order = Object.keys(groups).sort((a, b) => _v4HeadingRank(a) - _v4HeadingRank(b) || _v4BaseRole(a).localeCompare(_v4BaseRole(b)));
    return order.map(h => [h, groups[h].sort((a, b) => a.localeCompare(b))]);
}
function _v4CreditText(fmt, split) {
    const title = dashboardData.root_path.split(/[/\\]/).pop();
    if (fmt === 'csv') {
        const cols = _v4CsvCols.filter(c => c.on);
        const q = v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        const rows = [];
        _v4CreditEntries().forEach(e => e.roles.forEach(r => rows.push({ role: _v4CreditRole(e, r, split), name: e.name, type: e.kind, contact: e.contact })));
        rows.sort((a, b) => _v4HeadingRank(a.role) - _v4HeadingRank(b.role) || a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
        return [cols.map(c => q(c.label)).join(',')].concat(rows.map(r => cols.map(c => q(r[c.key] || '')).join(','))).join('\n');
    }
    if (fmt === 'people') {
        return _v4CreditEntries().slice().sort((a, b) => a.name.localeCompare(b.name)).map(e => `${e.name} — ${e.roles.map(r => _v4CreditRole(e, r, split)).join(', ')}`).join('\n');
    }
    const groups = _v4Groups(split);
    if (fmt === 'columns') {   // role once per group, names down the right; tab between the columns
        return [title.toUpperCase(), ''].concat(groups.flatMap(([h, names]) => [...names.map((n, i) => `${i === 0 ? h.toUpperCase() : ''}\t${n}`), ''])).join('\n').trim();
    }
    return [title.toUpperCase(), ''].concat(groups.flatMap(([h, names]) => [h.toUpperCase(), ...names, ''])).join('\n').trim();
}

function v4ExportCredits() {
    let m = document.getElementById('v4CreditsExport');
    if (!m) {
        m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'v4CreditsExport';
        m.onclick = e => { if (e.target === m) m.classList.remove('open'); };
        m.innerHTML = '<div class="modal v4-credits-modal"><div id="v4CreditsBody"></div></div>';
        document.body.appendChild(m);
    }
    _v4RenderCreditsExport();
    m.classList.add('open');
}
function v4CreditFmt(f) { _v4CreditFmt = f; _v4RenderCreditsExport(); }
function _v4RenderCreditsExport() {
    const n = _v4CreditEntries().length;
    const fmts = [['credits', 'End credits'], ['columns', 'Two columns'], ['csv', 'CSV'], ['people', 'By person']];
    document.getElementById('v4CreditsBody').innerHTML = `
        <div class="v4-set-head"><div><h2 style="margin:0;">Export credits</h2><div class="v4-muted" style="margin-top:0.2rem;">${n} ${n === 1 ? 'person' : 'people'}</div></div>
            <button class="btn-sm" onclick="document.getElementById('v4CreditsExport').classList.remove('open')" aria-label="Close">✕</button></div>
        <div class="v4-cat-bar"><div class="v4-cats" style="mask-image:none;-webkit-mask-image:none;">${fmts.map(([k, l]) => `<button class="${k === _v4CreditFmt ? 'active' : ''}" onclick="v4CreditFmt('${k}')">${l}</button>`).join('')}</div>
            <label class="v4-check" style="margin:0;"><input type="checkbox" ${_v4CreditSplit ? 'checked' : ''} onchange="_v4CreditSplit=this.checked;_v4RenderCreditsExport()"> Collaborators as "Additional …"</label></div>
        ${_v4CreditFmt === 'csv' ? `<div class="v4-csv-cols">${_v4CsvCols.map((c, i) => `<label class="v4-csv-col"><input type="checkbox" ${c.on ? 'checked' : ''} onchange="_v4CsvCols[${i}].on=this.checked;_v4RenderCreditsExport()" aria-label="Include ${esc(c.key)} column">
            <input type="text" value="${esc(c.label)}" onchange="_v4CsvCols[${i}].label=this.value.trim()||'${c.key}';_v4RenderCreditsExport()" aria-label="Column name for ${esc(c.key)}"></label>`).join('')}</div>` : ''}
        <textarea class="v4-credits-out" id="v4CreditsOut" readonly spellcheck="false" aria-label="Credits text">${esc(_v4CreditText(_v4CreditFmt, _v4CreditSplit))}</textarea>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.75rem;">
            <button class="btn-sm" style="border-color:var(--accent);color:var(--accent);" onclick="v4CopyCredits()">Copy</button>
        </div>`;
}
function v4CopyCredits() {
    const ta = document.getElementById('v4CreditsOut');
    const done = () => showToast('Credits copied');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); showToast('Selected: press Ctrl/Cmd+C to copy'); });
    else { ta.select(); showToast('Selected: press Ctrl/Cmd+C to copy'); }
}

// Mark complete lives here, beside the final media it sets. Settings closes first so the picker sits on top.
function v4PsComplete() {
    document.getElementById('v4ProjectSettings').classList.remove('open');
    v4ProjectSettingsClosed();
    v4AskComplete();
}
