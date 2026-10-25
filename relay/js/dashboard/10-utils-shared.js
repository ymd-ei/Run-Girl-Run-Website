// ---------------------------------------------------------------------------
// Global dashboard state
// (previously declared in 00-demo-state.js, which was removed in v3)
// ---------------------------------------------------------------------------
let dashboardData = null;
let expandedShot = null;
let _libCtxActive = false;
let activeTypeFilter = null;
let activeStatusFilter = null;
let activeDateFilter = null;
let starredOnlyFilter = false;
let activeAssigneeFilter = null;
let _excludedExpanded = false;
let sortColumn = 'name';
let sortDir = 'asc';
let projectInfoOpen = false;
let dashboardPlaylists = [];
const resolvedExpanded = new Set();

// Close the right-click menu on outside click / Escape
document.addEventListener('click', e => { if (!document.getElementById('ctxMenu').contains(e.target)) hideCtxMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideCtxMenu(); });

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

async function api(endpoint, body = null) {
    const opts = body ? { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) } : {};
    const r = await fetch(endpoint, opts);
    return r.json();
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function sortComments(comments, allComments) {
    return [...comments].map((c, idx) => ({ c, i: allComments ? allComments.indexOf(c) : idx })).sort((a, b) => {
        const aKey = a.c.resolved ? (a.c.resolved_at || "") : (a.c.timestamp || "");
        const bKey = b.c.resolved ? (b.c.resolved_at || "") : (b.c.timestamp || "");
        return bKey.localeCompare(aKey);
    });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// CSS-variable → raw hex for places that need a concrete colour value
const COLOR_VAR_MAP = { 'var(--green)': '#22c55e', 'var(--yellow)': '#eab308', 'var(--accent)': '#6366f1' };

// Normalise status/difficulty items that may be plain strings or {name,color} objects
// ---------------------------------------------------------------------------
// People (v4): the project's people list is the one source for assignees,
// the assignee filter, colors and credits. (v3 used project_info.credits.)
// ---------------------------------------------------------------------------
const PERSON_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7', '#ef4444', '#ec4899', '#84cc16', '#14b8a6', '#eab308'];
function projectPeople() { return (dashboardData && dashboardData.people) || []; }
function currentUserName() { return window.__relay ? window.__relay.viewer().name : ''; }
function currentProjectRole() { return (window.__relay && dashboardData) ? window.__relay.roleIn(dashboardData.root_path) : null; }
function personColor(name) {
    const p = projectPeople().find(x => x.name === name);
    if (p && p.color) return p.color;
    let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PERSON_COLORS[h % PERSON_COLORS.length];
}
// You first, then by name
function peopleOptions(names, blankLabel) {
    const me = currentUserName();
    const sorted = [...new Set(names)].sort((a, b) => (b === me) - (a === me) || a.localeCompare(b));
    return [{ value: '', label: blankLabel, color: null }].concat(sorted.map(n => ({ value: n, label: n === me ? 'Me' : n, color: personColor(n) })));
}
// Only a senior role (the project's Lead; admins lead every project) assigns or reassigns work
function canReassign(shot) {
    return currentProjectRole() === 'Lead';
}

function statusName(s) { return typeof s === 'string' ? s : s.name; }
function statusColor(s) { return typeof s === 'string' ? '#888888' : (s.color || '#888888'); }

// Return the parent directory of a file path
function parentPath(p) { return p.replace(/[/\\][^/\\]+$/, ''); }

// Shared /api/save_meta — always sends the full shot payload
async function saveMeta(shot) {
    await api('/api/save_meta', {
        root_path:    dashboardData.root_path,
        asset_name:   shot.name,
        status:       shot.status       || 'WIP',
        difficulty:   shot.difficulty   || '',
        completion:   shot.completion   || 0,
        notes:        shot.notes        || '',
        due_date:     shot.due_date     || '',
        done:         shot.done         || false,
        excluded:     shot.excluded     || false,
        manual_media: shot.manual_media || '',
        starred:      shot.starred      || false,
        assignee:     shot.assignee     || '',
    });
}

// Shared settings payload (used by saveProjectMeta + saveSettings)
function _buildSettingsPayload() {
    return {
        root_path:            dashboardData.root_path,
        custom_statuses:      dashboardData.custom_statuses,
        custom_difficulties:  dashboardData.custom_difficulties,
        auto_status_rules:    dashboardData.auto_status_rules    || [],
        auto_status_enabled:  dashboardData.auto_status_enabled  || false,
        project_complete:     dashboardData.project_complete     || false,
        completed_date:       dashboardData.completed_date        || '',
        project_start_date:   dashboardData.project_info?.start_date || '',
        project_end_date:     dashboardData.project_info?.end_date   || '',
        final_media:          dashboardData.final_media          || '',
        current_edit:         dashboardData.current_edit         || '',
        project_reflection:   dashboardData.project_reflection   || '',
        scan_folders:         dashboardData.scan_folders         || [],
        excluded_extensions:  dashboardData.excluded_extensions  || [],
    };
}


// ---------------------------------------------------------------------------
// Project date persistence (localStorage, keyed by root_path)
// ---------------------------------------------------------------------------
function _saveDatesToLocal() {
    if (!dashboardData?.root_path) return;
    const key = 'relay_dates_' + dashboardData.root_path;
    localStorage.setItem(key, JSON.stringify({
        start_date:     dashboardData.project_info?.start_date || '',
        end_date:       dashboardData.project_info?.end_date   || '',
        completed_date: dashboardData.completed_date           || '',
    }));
}
function _loadDatesFromLocal(root_path, project_info) {
    try {
        const key = 'relay_dates_' + root_path;
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const d = JSON.parse(raw);
        if (!project_info.start_date && d.start_date) project_info.start_date = d.start_date;
        if (!project_info.end_date   && d.end_date)   project_info.end_date   = d.end_date;
        if (!dashboardData.completed_date && d.completed_date) dashboardData.completed_date = d.completed_date;
    } catch(e) {}
}

// Cell renderers — used by renderShotRow, renderLibTable, and patchRow
function renderProgressCell(pct) {
    return `<div class="progress-bar-container"><div class="progress-bar-fill" style="width:${pct}%;background:${progressColor(pct)};"></div></div><span class="progress-text">${pct}%</span>`;
}

function renderDifficultyCell(shot) {
    if (!shot.difficulty) return '<span style="color:var(--text-muted);">\u2014</span>';
    const dc = getDifficultyColor(shot.difficulty) || 'var(--text-secondary)';
    return `<span style="font-size:0.7rem;font-family:var(--mono);color:${dc}">${esc(shot.difficulty)}</span>`;
}

function renderDueDateCell(shot) {
    const d = shot.due_date;
    if (!d) return '<span style="font-size:0.75rem;color:var(--text-muted);">\u2014</span>';
    if (shot.completion >= 100 || shot.done) return '<span style="font-size:0.7rem;font-family:var(--mono);color:var(--green);">&#10003; Done</span>';
    const today = new Date(); today.setHours(0,0,0,0);
    const days = Math.round((new Date(d + 'T00:00:00') - today) / 86400000);
    let color = 'var(--green)', label;
    if (days < 0)      { color = 'var(--red)';    label = Math.abs(days) + 'd overdue'; }
    else if (days <= 3){ color = 'var(--yellow)';  label = days === 0 ? 'Today' : days + 'd left'; }
    else               { label = days + 'd left'; }
    return `<span style="font-size:0.7rem;font-family:var(--mono);color:${color};">${label}</span>`;
}

function rowStyle(shot, isExcluded) {
    if (isExcluded) return 'cursor:pointer;';
    const sc = getStatusColor(shot.status);
    const starGrad = 'linear-gradient(to right,#eab30828 0px,#eab30812 220px,transparent 380px)';
    const doneGrad = 'linear-gradient(to left,#22c55e28 0px,#22c55e12 220px,transparent 380px)';
    if (shot.starred && shot.done) {
        const combined = `background:${starGrad},${doneGrad}${sc ? `,${sc}18` : ''}`;
        return `cursor:pointer;${combined};`;
    }
    if (shot.starred) {
        return `cursor:pointer;background:${starGrad}${sc ? `,${sc}18` : ''};`;
    }
    if (shot.done) {
        return `cursor:pointer;background:${doneGrad}${sc ? `,${sc}18` : ''};`;
    }
    return `cursor:pointer;${sc ? `background:${sc}18;` : ''}`;
}

// Open the review page for any root path
function openReview(rootPath) {
    if (!rootPath) return;
    window.open('/review?path=' + encodeURIComponent(rootPath), '_blank');
}

// ---------------------------------------------------------------------------
// Partial loading UX helpers
// ---------------------------------------------------------------------------
let _dashLoadDepth = 0;
let _libLoadDepth = 0;

function _ensureLoadBadge(containerSelector, badgeId) {
    const container = document.querySelector(containerSelector);
    if (!container) return null;
    let badge = document.getElementById(badgeId);
    if (!badge) {
        badge = document.createElement('span');
        badge.id = badgeId;
        badge.className = 'load-hint-badge';
        container.appendChild(badge);
    }
    return badge;
}

function setDashboardLoading(isLoading, label = 'Loading updates...') {
    if (isLoading) _dashLoadDepth += 1;
    else _dashLoadDepth = Math.max(0, _dashLoadDepth - 1);

    const active = _dashLoadDepth > 0;
    const dashboard = document.getElementById('dashboard');
    if (dashboard) dashboard.classList.toggle('dashboard-data-loading', active);

    const badge = _ensureLoadBadge('.project-header-right', 'dashLoadingBadge');
    if (badge) {
        badge.textContent = label;
        badge.classList.toggle('show', active);
    }
}

function setLibraryLoading(isLoading, label = 'Loading updates...') {
    if (isLoading) _libLoadDepth += 1;
    else _libLoadDepth = Math.max(0, _libLoadDepth - 1);

    const active = _libLoadDepth > 0;
    const libBody = document.getElementById('libBody');
    if (libBody) libBody.classList.toggle('lib-loading', active);

    const badge = _ensureLoadBadge('.lib-header', 'libLoadingBadge');
    if (badge) {
        badge.textContent = label;
        badge.classList.toggle('show', active);
    }
}

