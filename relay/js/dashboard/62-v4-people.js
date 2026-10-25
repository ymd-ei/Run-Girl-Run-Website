// ---------------------------------------------------------------------------
// v4: people, roles and Studio Settings.
// Studio roles: Admin, Member (the owner is an admin who can't be removed). Project roles: Lead, Member.
// Clients and directors get a view-only share link from Review instead of a role.
// Studio Settings = the whole studio (admins). Project Settings = one project (lead + admins).
// ---------------------------------------------------------------------------
const V4_STUDIO_ROLES = {
    Admin:  'Runs the studio: people, defaults, sign-in, storage. Leads every project. The owner is an admin who can\'t be removed.',
    Member: 'Sees only the projects they\'re added to.',
};
const V4_PROJECT_ROLES = {
    Lead:   'Manages this project: its settings and who is on it. Edits everything.',
    Member: 'Edits everything in the project. Can\'t change its settings or people.',
};
let _v4Studio = { people: [], projects: [], signin: {}, defaults: {}, storage: {} };
let _v4StudioTab = 'people';
let _v4ConfirmRemove = null;
let _v4StudioCat = 'All', _v4StudioQ = '';
let _v4ProjPanel = null;   // person id whose project list is open
let _v4NamePanel = null;   // person id whose name editor is open

// Shared: category tabs + search over a people list (Studio People and Project People use it)
function v4CatBar(cats, active, onCat, query, onSearch, searchId) {
    return `<div class="v4-cat-bar">
        <div class="v4-cats" role="tablist">${cats.map(([k, n]) =>
            `<button role="tab" aria-selected="${k === active}" class="${k === active ? 'active' : ''}" onclick="${onCat}('${k.replace(/'/g, "\\'")}')">${esc(k)}<span>${n}</span></button>`).join('')}</div>
        <input type="search" class="v4-search" id="${searchId}" placeholder="Search people" value="${esc(query)}" oninput="${onSearch}(this.value)" aria-label="Search people">
    </div>`;
}
function v4KeepSearchFocus(id, fn) { const el = document.getElementById(id); const pos = el ? el.selectionStart : 0; fn(); const n = document.getElementById(id); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
function v4StudioCat(k) { _v4StudioCat = k; _v4RenderStudio(); }
function v4StudioSearch(q) { _v4StudioQ = q; v4ApplySearch('v4StudioSearch', q); }

function _v4SetHeadCount(head, n) {   // a group heading shows how many of its people match
    head.style.display = n ? '' : 'none';
    const span = head.querySelector('span'); if (span) span.textContent = n;
}
// Typing in a people search only hides/shows rows in place: no redraw, so the cursor stays put.
function v4ApplySearch(searchId, q) {
    const input = document.getElementById(searchId); if (!input) return;
    const list = input.closest('.field')?.querySelector('.v4-people'); if (!list) return;
    const needle = q.trim().toLowerCase();
    let shown = 0, lastHead = null, headHasRows = false;
    [...list.children].forEach(el => {
        if (el.classList.contains('v4-group-head')) {
            if (lastHead) _v4SetHeadCount(lastHead, headHasRows);
            lastHead = el; headHasRows = 0; return;
        }
        if (!el.classList.contains('v4-prow')) return;
        const hit = !needle || (el.dataset.q || '').includes(needle);
        el.style.display = hit ? '' : 'none';
        if (hit) { shown++; headHasRows++; }
    });
    if (lastHead) _v4SetHeadCount(lastHead, headHasRows);
    let empty = list.querySelector('.v4-search-empty');
    if (!shown && !empty) { empty = document.createElement('div'); empty.className = 'v4-empty-row v4-search-empty'; empty.textContent = 'Nobody matches.'; list.appendChild(empty); }
    if (empty) empty.style.display = shown ? 'none' : '';
}

function _v4Me() { return window.__relay ? window.__relay.viewer() : { studioRole: 'Member' }; }
function _v4IsAdmin() { const r = _v4Me().studioRole; return r === 'Owner' || r === 'Admin'; }
function _v4RoleHere() {
    return (typeof dashboardData !== 'undefined' && dashboardData && window.__relay) ? window.__relay.roleIn(dashboardData.root_path) : null;
}

function v4ApplyRole() {
    const b = document.body, role = _v4RoleHere();
    b.classList.toggle('v4-studio-admin', _v4IsAdmin());
    b.classList.toggle('v4-can-manage-project', role === 'Owner' || role === 'Lead');
    let note = document.getElementById('v4RoleNote');
    if (!note) {
        note = document.createElement('div'); note.id = 'v4RoleNote'; note.className = 'v4-role-note';
        const dash = document.getElementById('dashboard'); dash.insertBefore(note, dash.querySelector('.project-header'));
    }
    const msg = role === 'Member' ? "You're a member on this project: you can edit everything except its settings and people."
        : role === 'Lead' && !_v4IsAdmin() ? "You're the lead on this project: you manage its settings and people." : '';
    note.textContent = msg; note.style.display = 'none';   // no banner: the controls they can't use are simply hidden
}

// ── Shared settings shell (Studio Settings and Project Settings use the same look) ──
function v4SettingsShell(id, title, subtitle, tabs, active, onTab, body) {
    return `
        <div class="v4-set-head">
            <div><h2 style="margin:0;">${title}</h2>${subtitle ? `<div class="v4-muted" style="margin-top:0.2rem;">${subtitle}</div>` : ''}</div>
            <button class="btn-sm" onclick="document.getElementById('${id}').classList.remove('open');${id === 'v4ProjectSettings' ? 'v4ProjectSettingsClosed()' : ''}" aria-label="Close">✕</button>
        </div>
        ${tabs.length ? `<div class="v4-set-wrap">
            <nav class="v4-set-nav" role="tablist">${tabs.map(([k, label]) =>
                `<button role="tab" aria-selected="${k === active}" class="${k === active ? 'active' : ''}" onclick="${onTab}('${k}')">${label}</button>`).join('')}</nav>
            <div class="v4-set-body">${body}</div>
        </div>` : `<div class="v4-set-body">${body}</div>`}`;   // one page, no tabs
}
function v4EnsureSettingsModal(id) {
    let m = document.getElementById(id);
    if (m) return m;
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = id;
    m.onclick = e => { if (e.target === m) { m.classList.remove('open'); if (id === 'v4ProjectSettings') v4ProjectSettingsClosed(); } };
    m.innerHTML = `<div class="modal v4-modal v4-settings"><div id="${id}Body"></div></div>`;
    document.body.appendChild(m);
    return m;
}

// ── Studio Settings ──
async function v4OpenStudioSettings(tab) {
    const res = await api('/api/people');
    if (res.error) { showToast(res.error); return; }
    _v4Studio = res; _v4ConfirmRemove = null; if (tab) _v4StudioTab = tab;
    v4EnsureSettingsModal('v4StudioSettings').classList.add('open');
    _v4RenderStudio();
}
function v4StudioTab(k) { _v4StudioTab = k; _v4RenderStudio(); }
function _v4ProjName(path) { return (_v4Studio.projects.find(p => p.path === path) || { name: path.split('/').pop() }).name; }

// ── One row layout for every people list (Studio People, Project People & credits, outside credits) ──
// name · role dropdown · tags (skills or credit roles) · extra (projects) · actions; optional panel below.
function v4KindChip(p, clickable) {
    const k = p.kind || 'Staff';
    const cls = k === 'Collaborator' ? 'v4-kind-chip' : 'v4-kind-chip v4-kind-staff';
    return clickable ? `<button class="${cls} v4-kind-btn" onclick="v4SetKind('${p.id}','${k === 'Staff' ? 'Collaborator' : 'Staff'}')" title="Click to switch Staff / Collaborator">${k}</button>` : `<span class="${cls}">${k}</span>`;
}
function v4PersonRow(o) {
    return `<div class="v4-person v4-prow" data-q="${esc((o.q || o.name + ' ' + (o.sub || '')).toLowerCase())}">
        <div class="v4-person-main">
            <div class="v4-person-name" title="${esc(o.sub || '')}">${esc(o.name)} ${o.chips || ''}</div>
        </div>
        <div class="v4-person-role">${o.role || ''}</div>
        <div class="v4-credit-tags" title="${o.tagsTitle || ''}">${o.tags || ''}</div>
        <div class="v4-person-access">${o.extra || ''}</div>
        <div class="v4-person-actions">${o.actionsBefore || ''}${o.actions || ''}</div>
        ${o.below || ''}
    </div>`;
}
function v4TagEditor(tags, onRemove, onAddAttr, placeholder, editable) {
    return tags.map((t, i) => `<span class="role-tag">${esc(t)}${editable ? `<b onclick="${onRemove(i)}" title="Remove">×</b>` : ''}</span>`).join('')
        + (editable ? `<input placeholder="${placeholder}" ${onAddAttr}>` : '');
}

function _v4PersonRowStudio(p) {
    const owner = p.studioRole === 'Owner', admin = owner || p.studioRole === 'Admin';
    const entries = Object.entries(p.access || {});
    const open = _v4ProjPanel === p.id;
    const label = !entries.length ? '+ Add to projects' : entries.length === 1 ? `${esc(_v4ProjName(entries[0][0]))} · ${entries[0][1]}` : `${entries.length} projects`;
    return v4PersonRow({
        name: p.name, sub: p.creditName && p.creditName !== p.name ? `${p.email} · credited as ${p.creditName}` : p.email,   // shown as a tooltip
        q: [p.name, p.creditName || '', p.email, p.kind || 'Staff', ...(p.skills || [])].join(' '),
        chips: v4KindChip(p, true) + (p.status === 'Invited' ? ` <span class="v4-chip v4-chip-invited">Invited</span> <button class="v4-chip v4-chip-btn" onclick="v4InviteLink('${p.id}')" title="Make a new invite link (the old one stops working)">Link</button>` : ''),
        role: owner ? '<span class="v4-role-fixed">Admin · owner</span>'
            : `<select onchange="v4SetStudioRole('${p.id}', this.value)" aria-label="Studio role for ${esc(p.name)}">${['Admin', 'Member'].map(r => `<option ${r === p.studioRole ? 'selected' : ''}>${r}</option>`).join('')}</select>`,
        tagsTitle: 'Skills: what they do. Credit roles on each project start from these.',
        tags: v4TagEditor(p.skills || [], i => `v4RemoveSkill('${p.id}',${i})`, `aria-label="Add skill for ${esc(p.name)}" onkeydown="if(event.key==='Enter'&&this.value.trim()){v4AddSkill('${p.id}',this.value.trim());}"`, '+ skill', true),
        extra: admin ? '<span class="v4-chip v4-chip-all" title="Admins lead every project">Every project</span>'
            : `<button class="v4-chip v4-chip-btn${open ? ' open' : ''}" onclick="v4ToggleProjects('${p.id}')" title="Choose which projects ${esc(p.name)} is on">${label} ${open ? '▴' : '▾'}</button>`,
        actions: owner ? '' : _v4ConfirmRemove === p.id
            ? `<button class="btn-sm v4-danger" onclick="v4RemovePerson('${p.id}')">Confirm</button><button class="btn-sm" onclick="v4AskRemove(null)">Keep</button>`
            : `<button class="btn-sm" onclick="v4AskRemove('${p.id}')">Remove</button>`,
        actionsBefore: `<button class="btn-sm" onclick="v4ToggleName('${p.id}')" aria-expanded="${_v4NamePanel === p.id}">Name</button>`,
        below: (_v4NamePanel === p.id ? _v4NameEditor(p) : '')
            + (open && !admin ? _v4ProjectPicker(p) : ''),
    });
}

// Assign someone to projects right from the studio list: tick a project, pick their role there
function _v4ProjectPicker(p) {
    return `<div class="v4-proj-picker">
        ${_v4Studio.projects.map(pr => { const role = p.access[pr.path]; const pth = pr.path.replace(/'/g, "\\'");
            return `<div class="v4-pp-row${role ? ' on' : ''}">
                <label><input type="checkbox" ${role ? 'checked' : ''} onchange="v4AssignProject('${p.id}','${pth}', this.checked ? 'Member' : null)"> ${esc(pr.name)}</label>
                ${role ? `<select onchange="v4AssignProject('${p.id}','${pth}', this.value)" aria-label="Role on ${esc(pr.name)}">${['Member', 'Lead'].map(r => `<option ${r === role ? 'selected' : ''}>${r}</option>`).join('')}</select>` : '<span></span>'}
            </div>`; }).join('')}
    </div>`;
}
// Admins can fix anyone's name (typos, people who haven't signed in yet); everyone else edits their own in Your settings
function _v4NameFields(p, idp) {
    return `<label class="v4-field"><span>Name</span><input id="${idp}Name" value="${esc(p.name)}" maxlength="40">
</label>
        <label class="v4-field"><span>Credit name</span><input id="${idp}Credit" value="${esc(p.creditName || '')}" placeholder="${esc(p.name)}" maxlength="80">
</label>`;
}
function _v4NameEditor(p) {
    return `<div class="v4-name-editor">${_v4NameFields(p, 'v4Ed')}
        <div class="v4-name-actions"><button class="btn-sm" onclick="v4SavePersonName('${p.id}')">Save</button><button class="btn-sm" onclick="v4ToggleName(null)">Cancel</button></div></div>`;
}
function v4ToggleName(id) { _v4NamePanel = _v4NamePanel === id ? null : id; v4KeepSearchFocus('v4StudioSearch', _v4RenderStudio); if (_v4NamePanel) document.getElementById('v4EdName')?.focus(); }
async function v4SavePersonName(id) {
    const name = document.getElementById('v4EdName').value.trim(), creditName = document.getElementById('v4EdCredit').value.trim();
    if (!name) { showToast('Name can\'t be empty'); return; }
    const p = _v4Studio.people.find(x => x.id === id), old = p.name;
    const res = await api('/api/people/save', { id, name, creditName });
    if (res.error) { showToast(res.error); return; }
    Object.assign(p, { name, creditName }); _v4NamePanel = null;
    _v4AfterRename(id, old, name, creditName);
    v4KeepSearchFocus('v4StudioSearch', _v4RenderStudio);
    showToast(`Saved ${name}`);
}
// Keep the open project in step with a rename (assignees, people list, credits)
function _v4AfterRename(id, old, name, creditName) {
    if (typeof dashboardData === 'undefined' || !dashboardData) return;
    (dashboardData.assets || []).forEach(a => { if (a.assignee === old) a.assignee = name; });
    const pp = (dashboardData.people || []).find(x => x.id === id); if (pp) Object.assign(pp, { name, creditName });
    if (activeAssigneeFilter === old) activeAssigneeFilter = name;
    renderAll(true);
    if (typeof renderV4PanelSummary === 'function') renderV4PanelSummary();
    v4RenderMeChip();
}

// ── Your settings: everyone signs in, so everyone has their own settings ──
let _v4MyTab = 'profile';
function v4OpenMySettings(tab) { if (tab) _v4MyTab = tab; v4EnsureSettingsModal('v4MySettings').classList.add('open'); _v4RenderMy(); }
function v4MyTab(k) { _v4MyTab = k; _v4RenderMy(); }
async function _v4RenderMy() {
    const m = _v4Me(), admin = _v4IsAdmin();
    let body = '';
    if (_v4MyTab === 'profile') {
        body = `
            <div class="v4-my-grid">
                ${_v4NameFields(m, 'v4My')}
                <div class="v4-name-actions"><button class="btn-sm" onclick="v4SaveMyName()">Save</button></div>
            </div>
            <div class="field" style="margin:1.25rem 0 0.5rem;"><label>Set by a studio admin</label></div>
            <div class="v4-my-facts">
                <span class="v4-muted">Email</span><span>${esc(m.email || '—')}</span>
                <span class="v4-muted">Studio role</span><span>${m.studioRole === 'Member' ? 'Member' : m.studioRole === 'Owner' ? 'Admin · owner' : 'Admin'}</span>
                <span class="v4-muted">Type</span><span>${v4KindChip(m, false)}</span>
                <span class="v4-muted">Skills</span><span>${(m.skills || []).map(t => `<span class="role-tag">${esc(t)}</span>`).join('') || '—'}</span>
            </div>
            ${admin ? `<div class="v4-muted" style="margin-top:0.5rem;"><a href="#" onclick="event.preventDefault();document.getElementById('v4MySettings').classList.remove('open');v4OpenStudioSettings('people')">Studio Settings</a>.</div>` : ''}`;
        body += `<div class="field" style="margin:1.25rem 0 0.5rem;"><label>This account</label></div>
            <div class="v4-invite"><button class="btn-sm" onclick="v4DeviceLink()">Sign in on another device</button><button class="btn-sm" onclick="__relay.signOut()">Sign out</button></div>`;
    } else {
        const data = await fetch('/api/list_projects').then(r => r.json());
        const mine = (data.projects || []).filter(p => p.state !== 'archived');
        body = `            <div class="v4-my-projects">${mine.map(p => { const r = p.role || ''; return `
                <button class="v4-my-proj" onclick="document.getElementById('v4MySettings').classList.remove('open');loadPickerProject('${_v4JsStr(p.path)}')">
                    <span>${esc(p.name)}</span><span class="v4-muted">${r === 'Owner' ? 'Admin' : esc(r || '')}${p.state === 'complete' ? ' · delivered' : ''}</span></button>`; }).join('') || '<span class="v4-muted">You aren\'t on any projects yet.</span>'}</div>`;
    }
    document.getElementById('v4MySettingsBody').innerHTML = v4SettingsShell('v4MySettings', 'Your settings', '',
        [['profile', 'Profile'], ['projects', 'Projects']], _v4MyTab, 'v4MyTab', body);
}
async function v4SaveMyName() {
    const name = document.getElementById('v4MyName').value.trim(), creditName = document.getElementById('v4MyCredit').value.trim();
    if (!name) { showToast('Your name can\'t be empty'); return; }
    const m = _v4Me(), old = m.name;
    const res = await api('/api/me/save', { name, creditName });
    if (res.error) { showToast(res.error); return; }
    _v4AfterRename(m.id, old, name, creditName);
    _v4RenderMy();
    showToast('Profile saved');
}
// You, top right: opens Your settings
function v4RenderMeChip() {
    const b = document.getElementById('v4MeBtn'); if (!b) return;
    const m = _v4Me();
    b.innerHTML = `<span class="v4-me-dot" style="background:${personColor(m.name)};">${esc((m.name || '?')[0].toUpperCase())}</span>${esc(m.name)}`;
    b.title = 'Your settings'; b.setAttribute('aria-label', `Your settings (${m.name})`);
}

function v4ToggleProjects(id) { _v4ProjPanel = _v4ProjPanel === id ? null : id; v4KeepSearchFocus('v4StudioSearch', _v4RenderStudio); }
async function v4AssignProject(id, path, role) {
    const res = await api('/api/project_people/set', { path, id, role });
    if (res.error) { showToast(res.error); return; }
    const p = _v4Studio.people.find(x => x.id === id);
    if (role) p.access[path] = role; else delete p.access[path];
    v4KeepSearchFocus('v4StudioSearch', _v4RenderStudio);
    showToast(role ? `${p.name} is on ${_v4ProjName(path)} as ${role}` : `${p.name} removed from ${_v4ProjName(path)}`);
}

function _v4StudioPeople() {
    const all = _v4Studio.people;
    const skills = [...new Set(all.flatMap(p => p.skills || []))].sort();
    const cats = [['All', all.length], ['Staff', all.filter(p => (p.kind || 'Staff') === 'Staff').length], ['Collaborators', all.filter(p => p.kind === 'Collaborator').length],
        ['Admins', all.filter(p => p.studioRole !== 'Member').length], ['Invited', all.filter(p => p.status === 'Invited').length],
        ...skills.map(sk => [sk, all.filter(p => (p.skills || []).includes(sk)).length])];
    const q = _v4StudioQ.trim().toLowerCase();
    const inCat = p => _v4StudioCat === 'All' ? true
        : _v4StudioCat === 'Staff' ? (p.kind || 'Staff') === 'Staff'
        : _v4StudioCat === 'Collaborators' ? p.kind === 'Collaborator'
        : _v4StudioCat === 'Admins' ? p.studioRole !== 'Member'
        : _v4StudioCat === 'Invited' ? p.status === 'Invited'
        : (p.skills || []).includes(_v4StudioCat);
    const shown = all.filter(p => inCat(p) && (!q || (p.name + ' ' + p.email + ' ' + (p.skills || []).join(' ')).toLowerCase().includes(q)));
    const group = (title, list) => list.length ? `<div class="v4-group-head">${title} <span>${list.length}</span></div>${list.map(_v4PersonRowStudio).join('')}` : '';
    const body = _v4StudioCat === 'All'
        ? group('Staff', shown.filter(p => (p.kind || 'Staff') === 'Staff')) + group('Collaborators', shown.filter(p => p.kind === 'Collaborator'))
        : shown.map(_v4PersonRowStudio).join('');
    const invite = `<div class="field"><label>Invite someone</label>
            <div class="v4-invite">
                <input type="email" id="v4InviteEmail" placeholder="name@example.com" aria-label="Email to invite">
                <select id="v4InviteKind" aria-label="Staff or collaborator"><option>Staff</option><option>Collaborator</option></select>
                <select id="v4InviteRole" aria-label="Studio role">${['Member', 'Admin'].map(r => `<option>${r}</option>`).join('')}</select>
            </div>
            <div class="v4-invite" style="margin-top:0.4rem;">
                <input type="text" id="v4InviteSkills" placeholder="Skills, comma separated (e.g. Animator, Rigger)" aria-label="Skills">
                <button class="btn-sm" onclick="v4Invite()">Send invite</button>
            </div>
            <div class="v4-muted" id="v4InviteErr" style="color:var(--red);display:none;margin-top:0.3rem;"></div></div>`;
    return `${invite}
        <div class="field"><label>Everyone in the studio</label>
            ${v4CatBar(cats, _v4StudioCat, 'v4StudioCat', _v4StudioQ, 'v4StudioSearch', 'v4StudioSearch')}
            <div class="v4-people">${body || '<div class="v4-empty-row">Nobody matches.</div>'}</div>
        </div>`;
}

async function _v4SavePersonPatch(id, patch, msg) {
    const res = await api('/api/people/save', Object.assign({ id }, patch));
    if (res.error) { showToast(res.error); return; }
    Object.assign(_v4Studio.people.find(p => p.id === id), res.person);
    v4KeepSearchFocus('v4StudioSearch', _v4RenderStudio);
    if (msg) showToast(msg);
}
function v4SetKind(id, kind) { const p = _v4Studio.people.find(x => x.id === id); _v4SavePersonPatch(id, { kind }, `${p.name} is now listed as ${kind === 'Staff' ? 'staff' : 'a collaborator'}`); }
async function v4AddSkill(id, skill) {
    const p = _v4Studio.people.find(x => x.id === id);
    await _v4SavePersonPatch(id, { skills: [...new Set([...(p.skills || []), skill])] });
    const inp = [...document.querySelectorAll('#v4StudioSettings .v4-credit-tags input')].find(x => x.getAttribute('aria-label') === 'Add skill for ' + p.name); if (inp) inp.focus();
}
function v4RemoveSkill(id, i) { const p = _v4Studio.people.find(x => x.id === id); _v4SavePersonPatch(id, { skills: (p.skills || []).filter((_, k) => k !== i) }); }

function _v4TagList(kind) {
    const list = _v4Studio.defaults[kind] || [];
    return `<div class="tag-list">${list.map((s, i) => `<span class="tag" style="border-color:${s.color}40;"><span class="color-dot" style="background:${s.color};"></span>${esc(s.name)}<span class="remove-tag" onclick="v4RemoveDefault('${kind}',${i})" title="Remove">&#215;</span></span>`).join('')}</div>
        <div class="v4-invite" style="margin-top:0.5rem;"><input type="text" id="v4New_${kind}" placeholder="Add ${kind === 'statuses' ? 'a status' : 'a difficulty'}..."><input type="color" id="v4NewC_${kind}" value="#06b6d4" aria-label="Color" class="v4-color"><button class="btn-sm" onclick="v4AddDefault('${kind}')">Add</button></div>`;
}

function _v4StudioBody() {
    const s = _v4Studio.signin || {}, st = _v4Studio.storage || {};
    if (_v4StudioTab === 'people') return _v4StudioPeople();
    if (_v4StudioTab === 'defaults') return `
        <div class="field"><label>Default statuses</label>${_v4TagList('statuses')}</div>
        <div class="field"><label>Default difficulties</label>${_v4TagList('difficulties')}</div>`;
    if (_v4StudioTab === 'signin') return `
        <div class="field"><label>How people sign in</label>
            <label class="v4-check"><input type="checkbox" ${s.email_code ? 'checked' : ''} onchange="v4SaveStudio('signin','email_code', this.checked)"> Email code</label>
            <label class="v4-check"><input type="checkbox" ${s.invite_links ? 'checked' : ''} onchange="v4SaveStudio('signin','invite_links', this.checked)"> Invite links</label></div>
`;
    if (_v4StudioTab === 'storage') {
        const pct = Math.min(100, st.used_mb / (st.limit_gb * 1024) * 100);
        return `
        <div class="field"><label>Cloud storage</label>
            <div class="v4-meter"><span style="width:${Math.max(pct, 1)}%;"></span><i style="left:${st.warn_gb / st.limit_gb * 100}%;" title="Warning"></i><i style="left:${st.stop_gb / st.limit_gb * 100}%;" class="stop" title="Uploads stop"></i></div>
            <div class="v4-muted" style="margin-top:0.35rem;">≈${st.used_mb} MB of ${st.limit_gb} GB free storage used</div></div>
        <div class="field"><label>Spending guard</label>
            <div class="v4-invite"><span class="v4-muted" style="width:150px;">Warn admins at</span><input type="number" min="1" max="${st.limit_gb}" step="0.5" value="${st.warn_gb}" style="width:90px;" onchange="v4SaveStudio('storage','warn_gb', +this.value)"><span class="v4-muted">GB</span></div>
            <div class="v4-invite" style="margin-top:0.4rem;"><span class="v4-muted" style="width:150px;">Stop new uploads at</span><input type="number" min="1" max="${st.limit_gb}" step="0.5" value="${st.stop_gb}" style="width:90px;" onchange="v4SaveStudio('storage','stop_gb', +this.value)"><span class="v4-muted">GB</span></div>
</div>
        <div class="field"><label>Video</label>
            <label class="v4-check"><input type="checkbox" ${st.webm ? 'checked' : ''} onchange="v4SaveStudio('storage','webm', this.checked)"> Convert videos to WebM before upload</label></div>`;
    }
    return `
        <div class="field"><label>Where Relay keeps team data</label>
            <label class="v4-check"><input type="radio" name="v4mode" ${st.mode === 'local' ? 'checked' : ''} onchange="v4SaveStudio('storage','mode','local')"> Local only</label>
            <label class="v4-check"><input type="radio" name="v4mode" ${st.mode !== 'local' ? 'checked' : ''} onchange="v4SaveStudio('storage','mode','online')"> Online</label></div>
`;
}

function _v4RenderStudio() {
    document.getElementById('v4StudioSettingsBody').innerHTML = v4SettingsShell('v4StudioSettings', 'Studio Settings',
        '',
        [['people', 'People'], ['defaults', 'Defaults'], ['signin', 'Sign-in'], ['storage', 'Storage']],
        _v4StudioTab, 'v4StudioTab', _v4StudioBody());
}

async function v4SetStudioRole(id, studioRole) {
    const res = await api('/api/people/save', { id, studioRole });
    if (res.error) { showToast(res.error); return; }
    Object.assign(_v4Studio.people.find(p => p.id === id), res.person);
    _v4RenderStudio();
    showToast(studioRole === 'Admin' ? `${res.person.name} is now a studio admin: every project, plus Studio Settings` : `${res.person.name} is now a member`);
}
function v4AskRemove(id) { _v4ConfirmRemove = id; _v4RenderStudio(); }
async function v4RemovePerson(id) {
    const p = _v4Studio.people.find(x => x.id === id);
    const res = await api('/api/people/remove', { id });
    if (res.error) { showToast(res.error); return; }
    _v4Studio.people = _v4Studio.people.filter(x => x.id !== id); _v4ConfirmRemove = null;
    _v4RenderStudio(); showToast(`${p.name} removed from the studio`);
}
async function v4Invite() {
    const email = document.getElementById('v4InviteEmail').value.trim();
    const studioRole = document.getElementById('v4InviteRole').value;
    const kind = document.getElementById('v4InviteKind').value;
    const skills = document.getElementById('v4InviteSkills').value.split(',').map(x => x.trim()).filter(Boolean);
    const err = document.getElementById('v4InviteErr');
    const res = await api('/api/people/invite', { email, studioRole, kind, skills });
    if (res.error) { err.textContent = res.error; err.style.display = 'block'; return; }
    _v4Studio.people.push(res.person); _v4RenderStudio();
    v4ShowLink(`Invite link for ${email}`, res.link, `Send this to them. It works once and lasts ${res.expires_days} days.`);
}
// Links (invites, other devices): shown once with a Copy button; nothing is emailed in this version
function v4ShowLink(title, link, note) {
    let m = document.getElementById('v4LinkModal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'v4LinkModal'; m.onclick = e => { if (e.target === m) m.classList.remove('open'); }; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal" style="max-width:520px;"><h2 style="margin-top:0;">${esc(title)}</h2>
        <div class="v4-invite"><input type="text" id="v4LinkText" value="${esc(link)}" readonly style="flex:1;" aria-label="Link"><button class="btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('v4LinkText').value).then(()=>showToast('Link copied'))">Copy</button></div>
        <p class="v4-muted" style="margin:0.6rem 0 1rem;">${esc(note)}</p>
        <div class="modal-actions"><button class="btn-sm" onclick="document.getElementById('v4LinkModal').classList.remove('open')">Done</button></div></div>`;
    m.classList.add('open');
    setTimeout(() => document.getElementById('v4LinkText').select(), 50);
}
async function v4InviteLink(id) {
    const res = await api('/api/people/invite_link', { id });
    if (res.error) { showToast(res.error); return; }
    const p = _v4Studio.people.find(x => x.id === id);
    v4ShowLink(`Invite link for ${p ? p.email : ''}`, res.link, `Send this to them. It works once and lasts ${res.expires_days} days; earlier links stop working.`);
}
async function v4DeviceLink() {
    const res = await api('/api/device_link');
    if (res.error) { showToast(res.error); return; }
    v4ShowLink('Sign in on another device', res.link, `Open this on the other device within ${res.expires_minutes} minutes. It works once.`);
}
async function v4SaveStudio(group, key, value) {
    const ep = group === 'signin' ? '/api/signin/save' : '/api/storage/save';
    await api(ep, { [key]: value });
    _v4Studio[group][key] = value;
}
async function v4AddDefault(kind) {
    const name = document.getElementById('v4New_' + kind).value.trim(); if (!name) return;
    const color = document.getElementById('v4NewC_' + kind).value;
    _v4Studio.defaults[kind].push({ name, color });
    await api('/api/studio_defaults/save', { [kind]: _v4Studio.defaults[kind] }); _v4RenderStudio();
}
async function v4RemoveDefault(kind, i) {
    _v4Studio.defaults[kind].splice(i, 1);
    await api('/api/studio_defaults/save', { [kind]: _v4Studio.defaults[kind] }); _v4RenderStudio();
}

// ── Wire into v3's menus and the home tiles ──
(function () {
    const menu = document.getElementById('overflowMenu');
    if (menu && !document.getElementById('v4StudioItem')) {
        const item = document.createElement('div');
        item.className = 'overflow-item v4-admin-only'; item.id = 'v4StudioItem';
        item.innerHTML = '&#9881; Studio Settings';
        item.onclick = () => { closeOverflowMenu(); v4OpenStudioSettings(); };
        menu.insertBefore(item, menu.firstChild);
    }
    const bar = document.getElementById('topAppBar');
    const head = document.querySelector('.home-head');
    if (head && !head.querySelector('.v4-home-studio-btn')) {
        const btn = document.createElement('button');
        btn.className = 'btn-sm home-btn v4-admin-only v4-home-studio-btn'; btn.innerHTML = '&#9881; Studio Settings'; btn.onclick = () => v4OpenStudioSettings();
        head.appendChild(btn);
    }
    const wrap = document.getElementById('overflowMenuWrap');
    if (bar && wrap && !document.getElementById('v4MeBtn')) {
        const me = document.createElement('button'); me.id = 'v4MeBtn'; me.className = 'btn-sm v4-me-btn'; me.onclick = () => v4OpenMySettings('profile');
        bar.insertBefore(me, wrap);
    }
   
    v4RenderMeChip();
    v4ApplyRole();
})();
const _v4InitProjectUIPrev = window._initProjectUI;
window._initProjectUI = function () { _v4InitProjectUIPrev.apply(this, arguments); v4ApplyRole(); };
