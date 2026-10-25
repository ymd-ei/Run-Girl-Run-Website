// ---------------------------------------------------------------------------
// v4: "mine" is a place, not a hidden filter.
// - Home: a My work list of everything assigned to you across projects, by due date.
// - Project pages open showing everything; the Assignee filter has "Me" right after All.
// - Opening a project from My work starts it on Me.
// Also: one-line category tabs scroll with a normal mouse wheel.
// ---------------------------------------------------------------------------
let _v4MyWorkAll = false;

function _v4Me2() { return window.__relay ? window.__relay.viewer() : { name: '' }; }

// ── My work on the home page ──
function _v4DueLabel(d) {
    if (!d) return '<span class="v4-muted">No due date</span>';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(d + 'T00:00:00') - today) / 86400000);
    if (days < 0) return `<span style="color:var(--red);">${-days}d overdue</span>`;
    if (days === 0) return `<span style="color:var(--yellow);">Today</span>`;
    return `<span style="color:${days <= 3 ? 'var(--yellow)' : 'var(--green)'};">${days}d left</span>`;
}
async function renderMyWork() {
    const card = document.querySelector('.setup-card.home-card #pickerProjectList');
    if (!card) return;
    let sec = document.getElementById('v4MyWork');
    if (!sec) { sec = document.createElement('div'); sec.id = 'v4MyWork'; sec.className = 'v4-mywork'; card.insertBefore(sec, document.getElementById('homeAddPanel')); }
    const res = await api('/api/my_work');
    const items = res.items || [];
    const shown = _v4MyWorkAll ? items : items.slice(0, 5);
    const me = _v4Me2().name;
    sec.innerHTML = `
        <div class="home-head" style="margin-bottom:0.5rem;"><span class="home-label">My work</span><span class="home-studio">${items.length || ''}</span></div>
        ${items.length ? `<div class="v4-mw-list">${shown.map(it => {
            const st = (it.statuses || []).find(s => statusName(s) === it.status);
            const c = st ? statusColor(st) : '#888888';
            return `<button class="v4-mw-row" onclick="v4OpenMyWork('${_v4JsStr(it.path)}','${_v4JsStr(it.name)}')">
                <span class="v4-mw-due">${_v4DueLabel(it.due_date)}</span>
                <span class="v4-mw-name">${esc(it.name)}</span>
                <span class="v4-mw-proj">${esc(it.project)}</span>
                <span class="status-badge" style="${colorBadgeStyle(c)}">${esc(it.status)}</span>
                <span class="v4-mw-pct"><span style="width:${it.completion}%;background:${progressColor(it.completion)};"></span></span>
            </button>`; }).join('')}</div>
            ${items.length > 5 ? `<button class="btn-sm home-btn" style="margin-top:0.5rem;" onclick="_v4MyWorkAll=!_v4MyWorkAll;renderMyWork()">${_v4MyWorkAll ? 'Show less' : `Show all ${items.length}`}</button>` : ''}`
        : `<div class="v4-muted" style="padding:0.25rem 0 0.5rem;">Nothing assigned to you right now.</div>`}`;
}
async function v4OpenMyWork(path, name) {
    await loadPickerProject(path);
    activeAssigneeFilter = _v4Me2().name;   // you came here for your own work
    expandedShot = name;
    renderAll(true);
    setTimeout(() => document.querySelector(`#shotsBody tr[data-shot-key="${CSS.escape(name)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 200);
}
const _v4RefreshPickerMine = window.refreshPicker;
window.refreshPicker = async function () { const out = await _v4RefreshPickerMine.apply(this, arguments); renderMyWork(); return out; };
if (document.getElementById('setupScreen').style.display !== 'none') renderMyWork();

// Vertical wheel → sideways scroll on the one-line tabs (no visible scrollbar)
document.addEventListener('wheel', e => {
    const bar = e.target.closest && e.target.closest('.v4-cats');
    if (!bar || bar.scrollWidth <= bar.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    bar.scrollLeft += e.deltaY;
}, { passive: false });

// Last module to load: open Relay into your last project.
v4OpenDefaultProject();
