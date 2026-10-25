// ---------------------------------------------------------------------------
// v4: the project calendar only covers the project's run (start → delivered, or
// start → end date). Months outside it can't be reached; days outside it are dimmed.
// Once a project is archived, the calendar reads as the record of how it went.
// Wraps renderCalendar() from 31-calendar-table.js.
// ---------------------------------------------------------------------------
function _v4ProjectRange() {
    if (typeof dashboardData === 'undefined' || !dashboardData) return null;
    const i = dashboardData.project_info || {};
    const start = i.start_date || '';
    const end = (dashboardData.project_complete && dashboardData.completed_date) || i.end_date || '';
    if (!start && !end) return null;
    return { start, end };
}
const _v4ym = s => { const [y, m] = s.split('-').map(Number); return y * 12 + (m - 1); };

const _v3RenderCalendar = window.renderCalendar;
window.renderCalendar = function (focusDateStr) {
    const r = _v4ProjectRange();
    if (r) {   // keep the shown month inside the project's run
        const cur = calendarYear * 12 + calendarMonth;
        const lo = r.start ? _v4ym(r.start) : -Infinity, hi = r.end ? _v4ym(r.end) : Infinity;
        const clamped = Math.min(Math.max(cur, lo), hi);
        if (clamped !== cur) { calendarYear = Math.floor(clamped / 12); calendarMonth = clamped % 12; }
    }
    _v3RenderCalendar.apply(this, arguments);
    if (!r) return;
    const section = document.getElementById('calendarSection');
    const days = [...section.querySelectorAll('.calendar-grid .cal-day:not(.empty)')];
    days.forEach((el, idx) => {
        const ds = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(idx + 1).padStart(2, '0')}`;
        if ((r.start && ds < r.start) || (r.end && ds > r.end)) el.classList.add('v4-outside');
    });
    const cur = calendarYear * 12 + calendarMonth;
    const [prev, next] = section.querySelectorAll('.calendar-nav button');
    if (prev && r.start && cur <= _v4ym(r.start)) prev.classList.add('v4-cal-bound');
    if (next && r.end && cur >= _v4ym(r.end)) next.classList.add('v4-cal-bound');
    const h2 = section.querySelector('.calendar-header h2');
    if (h2 && !h2.querySelector('.v4-cal-range')) {
        const done = dashboardData.project_complete && dashboardData.completed_date;
        h2.insertAdjacentHTML('beforeend', `<span class="v4-cal-range">${esc(r.start || '…')} → ${esc(r.end || '…')}${done ? ' · delivered' : ''}</span>`);
    }
};
if (typeof dashboardData !== 'undefined' && dashboardData) renderCalendar();

// The 7-day Due widget stops at the project's run too (v3 lets the wheel scroll forever).
const _v3BuildDueTimeline = window.buildDueTimeline;
window.buildDueTimeline = function (pool) {
    const r = _v4ProjectRange();
    if (r) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const diff = s => Math.round((new Date(s + 'T00:00:00') - today) / 86400000);
        if (r.start) _dueOffset = Math.max(_dueOffset, diff(r.start));
        if (r.end) _dueOffset = Math.min(_dueOffset, diff(r.end));
    }
    return _v3BuildDueTimeline.apply(this, arguments);
};
