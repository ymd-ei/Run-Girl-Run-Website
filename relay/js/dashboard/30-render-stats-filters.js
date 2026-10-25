// Rendering
// ---------------------------------------------------------------------------
function renderAll(skipAnimation) {
    renderTabs();
    renderCompleteBanner();
    renderStats();
    renderFilters();
    renderTable(skipAnimation);
    renderCalendar();
    renderFloatingStars(); renderFloatingDone();
    // excluded is now rendered inside renderTable, placed after calendar via DOM order
}

function sortTable(col) {
    sortColumn = sortColumn === col && sortDir === 'asc' ? (sortDir = 'desc', col) : (sortDir = 'asc', col);
    document.querySelectorAll('.shots-table th.sortable').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
    const cols = ['name','type','version','status','difficulty','completion','due_date','last_published'];
    const idx = cols.indexOf(col);
    if (idx >= 0) {
        const ths = document.querySelectorAll('.shots-table th.sortable');
        if (ths[idx]) ths[idx].classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
    renderTable(true); renderStats();   // rows glide to their new order (see renderTable)
}

function getSortedShots(shots, col, dir) {
    col = col || sortColumn;
    dir = dir || sortDir;
    return [...shots].sort((a, b) => {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
        if (a.planned && !b.planned) return -1;   // planned (no file yet) sit right under starred
        if (!a.planned && b.planned) return 1;
        let av = a[col] ?? '', bv = b[col] ?? '';
        if (col === 'version' || col === 'completion') {
            av = parseFloat(av) || 0; bv = parseFloat(bv) || 0;
            return dir === 'asc' ? av - bv : bv - av;
        }
        av = String(av).toLowerCase(); bv = String(bv).toLowerCase();
        if (av < bv) return dir === 'asc' ? -1 : 1;
        if (av > bv) return dir === 'asc' ? 1 : -1;
        return 0;
    });
}

function getActiveShots() {
    let shots = dashboardData.assets.filter(s => !s.excluded);
    if (starredOnlyFilter) shots = shots.filter(s => s.starred);
    return shots;
}
function getExcludedShots() { return dashboardData.assets.filter(s => s.excluded); }

async function setStartup(enable) {
    const result = await api('/api/set_startup', { enable });
    if (result.error) { showToast('Error: ' + result.error); document.getElementById('launchOnStartup').checked = !enable; }
    else showToast(enable ? 'Relay opens when you log in' : 'Relay won\'t open at log in');
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
function updateCompletionGlow(pct, fillColor, isProjectComplete) {
    const card = document.getElementById('completion-card');
    const layer = document.getElementById('completion-fill-layer');
    if (!card) return;
    const goldColor = '#ffd700';
    if (isProjectComplete) {
        card.style.boxShadow = `0 0 25px 12px ${goldColor}30, inset 0 0 15px ${goldColor}20`;
        card.style.borderColor = goldColor + '60';
        if (layer) { layer.style.setProperty('--fill-pct', '110%'); }
        return;
    }
    const rawColor = COLOR_VAR_MAP[fillColor] || fillColor;
    const fillOpacity = 0.06 + (pct / 100) * 0.24;
    const intensity = Math.round(pct / 100 * 20);
    const spread = Math.round(pct / 100 * 10);
    // fill opacity handled by canvas wave
    if (pct > 0) { card.style.boxShadow = `0 0 ${intensity}px ${spread}px ${rawColor}25, inset 0 0 ${Math.round(intensity/2)}px ${rawColor}15`; card.style.borderColor = rawColor + '40'; }
    else { card.style.boxShadow = 'none'; card.style.borderColor = ''; }
}

function fillPct(pct) {
    if (pct <= 0) return '-10%';
    if (pct >= 100) return '110%';
    return (pct * 1.2 - 10) + '%';
}

function renderStats() {
    const allActive = getActiveShots();
    const allTypes = [...new Set(allActive.map(s => s.type))];
    let pool = allActive;
    if (activeTypeFilter) pool = pool.filter(s => s.type === activeTypeFilter);
    if (activeStatusFilter) pool = pool.filter(s => s.status === activeStatusFilter);
    if (activeAssigneeFilter) pool = pool.filter(s => s.assignee === activeAssigneeFilter);
    const total = pool.length;
    const mastered = pool.filter(s => s.has_master).length;
    const masterPct = total ? Math.round(mastered / total * 100) : 0;
    const avgCompletion = total ? Math.round(pool.reduce((a, s) => a + (s.completion || 0), 0) / total) : 0;
    const filterLabel = activeTypeFilter || (activeStatusFilter ? activeStatusFilter : 'All Shots');
    const fillColor = avgCompletion >= 75 ? 'var(--green)' : avgCompletion >= 40 ? 'var(--yellow)' : 'var(--accent)';
    const rawColor = COLOR_VAR_MAP[fillColor] || fillColor;
    const isProjectComplete = dashboardData.project_complete || false;
    const endDate = dashboardData.project_info?.end_date || '';
    const completedDate = dashboardData.completed_date || '';
    const startDate = dashboardData.project_info?.start_date || '';

    let timelinePos = null;
    if (startDate && endDate) {
        const _tsStart = new Date(startDate + 'T00:00:00');
        const _tsEnd   = new Date(endDate   + 'T00:00:00');
        const _tsNow   = new Date();
        timelinePos = Math.min(Math.max((_tsNow - _tsStart) / (_tsEnd - _tsStart), 0), 1);
    }

    const existing = document.getElementById('completion-fill-layer');
    if (existing) {
        existing.style.setProperty('--fill-pct', fillPct(avgCompletion));
        existing.style.setProperty('--fill-color', fillColor);
        _startWaveCanvas(rawColor, avgCompletion, timelinePos);
        document.getElementById('stat-completion-value').textContent = avgCompletion + '%';
        document.getElementById('stat-completion-sub').textContent = activeTypeFilter || activeStatusFilter ? 'filtered' : 'across active shots';
        const _cdCard = document.getElementById('countdown-card');
        _cdCard.innerHTML = renderCountdownCardInner(endDate, completedDate, isProjectComplete, startDate);
        _cdCard.classList.toggle('overdue', _isOverdue(endDate, isProjectComplete));
        buildDueTimeline(pool);
        updateCompletionGlow(avgCompletion, fillColor, isProjectComplete);
        return;
    }

    document.getElementById('statsBar').innerHTML = `
        <div class="stat-card stat-card-countdown${_isOverdue(endDate, isProjectComplete) ? ' overdue' : ''}" id="countdown-card">${renderCountdownCardInner(endDate, completedDate, isProjectComplete, startDate)}</div>
        <div class="stat-card stat-card-due" id="due-timeline-card"><div class="due-card-label">Due</div><div class="due-graph" id="due-graph"></div></div>
        <div class="stat-card stat-card-fill" id="completion-card">
            <div id="completion-fill-layer" class="fill-layer" style="--fill-pct:0%;--fill-color:${fillColor};">
                <div class="fill-wave"><canvas id="wave-canvas"></canvas></div>
            </div>
            <div class="stat-label">Progress</div>
            <div class="stat-value" id="stat-completion-value">${avgCompletion}%</div>
            <div class="stat-sub" id="stat-completion-sub">${activeTypeFilter || activeStatusFilter ? 'filtered' : 'across active shots'}</div>
        </div>`;
    buildDueTimeline(pool);
    requestAnimationFrame(() => {
        const layer = document.getElementById('completion-fill-layer');
        if (layer) layer.style.setProperty('--fill-pct', fillPct(avgCompletion));
        updateCompletionGlow(avgCompletion, fillColor, isProjectComplete);
        _bindCountdownHover();
        _startWaveCanvas(rawColor, avgCompletion, timelinePos);
    });
}

function _bindCountdownHover() {
    const card = document.getElementById('countdown-card');
    if (!card || card._cdHoverBound) return;
    card._cdHoverBound = true;
    card.addEventListener('mouseenter', () => card.classList.add('cd-expanded'));
    card.addEventListener('mouseleave', () => card.classList.remove('cd-expanded'));
}

function _startWaveCanvas(color, pct, timelinePos) {
    const canvas = document.getElementById('wave-canvas');
    if (!canvas) return;
    const card = document.getElementById('completion-card');
    const W = card ? card.offsetWidth : 300;
    const H = card ? card.offsetHeight : 110;
    canvas.width = W;
    canvas.height = H;
    const targetY = H - (Math.min(Math.max(pct, 0), 100) / 100) * H;
    const amp1 = 1.8, amp2 = 0.8;
    const freq = (2 * Math.PI) / W;
    if (window._waveRafId && window._waveState) {
        window._waveState.targetY = targetY;
        window._waveState.color = color;
        window._waveState.timelinePos = (timelinePos !== undefined) ? timelinePos : window._waveState.timelinePos;
        return;
    }
    if (window._waveRafId) cancelAnimationFrame(window._waveRafId);
    window._waveState = { currentY: H, targetY, color, timelinePos: timelinePos ?? null };
    function draw(ts) {
        const s = window._waveState;
        s.currentY += (s.targetY - s.currentY) * 0.018;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        const phase = -(ts * 0.0009);
        const pts = [];
        for (let x = 0; x <= W; x++) {
            pts.push(s.currentY
                + Math.sin(freq * x * 2.1 + phase) * amp1
                + Math.sin(freq * x * 3.7 + phase * 1.3) * amp2);
        }
        // ── Filled region ──
        ctx.beginPath();
        ctx.moveTo(0, pts[0]);
        for (let x = 1; x <= W; x++) ctx.lineTo(x, pts[x]);
        ctx.lineTo(W, H); ctx.lineTo(0, H);
        ctx.closePath();
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = s.color;
        ctx.fill();
        // ── Pulse glow pass (wide, soft, breathing) ──
        const breathe = Math.sin(ts * 0.0018);
        ctx.beginPath();
        ctx.moveTo(0, pts[0]);
        for (let x = 1; x <= W; x++) ctx.lineTo(x, pts[x]);
        ctx.globalAlpha  = 0.15 + 0.07 * breathe;
        ctx.strokeStyle  = s.color;
        ctx.lineWidth    = 7;
        ctx.lineJoin     = 'round';
        ctx.shadowColor  = s.color;
        ctx.shadowBlur   = 12 + 5 * breathe;
        ctx.stroke();
        // ── Crisp stroke on top ──
        ctx.beginPath();
        ctx.moveTo(0, pts[0]);
        for (let x = 1; x <= W; x++) ctx.lineTo(x, pts[x]);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = s.color;
        ctx.lineWidth   = 1.5;
        ctx.lineJoin    = 'round';
        ctx.shadowBlur  = 0;
        ctx.stroke();
        // ── Timeline dot (where today sits between project start → end) ──
        if (s.timelinePos !== null && s.timelinePos >= 0 && s.timelinePos <= 1) {
            const dotX  = Math.round(s.timelinePos * W);
            const dotY  = pts[dotX] ?? s.currentY;
            const dotR  = 3.5;
            const ringR = dotR + 2.5 + 1.5 * Math.sin(ts * 0.003);
            const ringAlpha = 0.3 + 0.12 * Math.sin(ts * 0.003);
            // Outer pulsing ring
            ctx.beginPath();
            ctx.arc(dotX, dotY, ringR, 0, Math.PI * 2);
            ctx.globalAlpha = ringAlpha;
            ctx.fillStyle   = s.color;
            ctx.shadowColor = s.color;
            ctx.shadowBlur  = 8;
            ctx.fill();
            // Inner white dot
            ctx.beginPath();
            ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
            ctx.globalAlpha = 1;
            ctx.fillStyle   = '#ffffff';
            ctx.shadowColor = s.color;
            ctx.shadowBlur  = 6;
            ctx.fill();
            ctx.shadowBlur  = 0;
        }
        window._waveRafId = requestAnimationFrame(draw);
    }
    window._waveRafId = requestAnimationFrame(draw);
}

let _dueOffset = 0;
let _duePool = [];

function buildDueTimeline(pool) {
    const card = document.getElementById('due-timeline-card');
    const graph = document.getElementById('due-graph');
    if (!graph) return;

    // Attach wheel listener once
    if (!card._dueWheelBound) {
        card._dueWheelBound = true;
        card.addEventListener('wheel', e => {
            e.preventDefault();
            _dueOffset += e.deltaY > 0 ? 1 : -1;
            buildDueTimeline(_duePool);
        }, { passive: false });
        card.addEventListener('click', () => {
            if (_dueOffset === 0) return;
            _dueOffset = 0;
            buildDueTimeline(_duePool);
        });
    }
    _duePool = pool;

    const realToday = new Date(); realToday.setHours(0,0,0,0);
    function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
    function dayKey(d) { return d.toISOString().slice(0,10); }

    const today = addDays(realToday, _dueOffset);

    // Both schedule and scheduleDone built from pool so filters are respected consistently
    const schedule = {};
    const scheduleDone = {};
    pool.forEach(s => {
        if (!s.due_date) return;
        schedule[s.due_date] = (schedule[s.due_date] || 0) + 1;
        if (s.done || s.completion >= 100) scheduleDone[s.due_date] = (scheduleDone[s.due_date] || 0) + 1;
    });
    // For past days (before the current center day), show overdue count only
    function getDayCount(d) {
        const k = dayKey(d);
        const total = schedule[k] || 0;
        if (d < today) return Math.max(total - (scheduleDone[k] || 0), 0);
        return total;
    }

    const HALF = 3;
    const TOTAL_H = 110;
    const PAD = Math.round(TOTAL_H * 0.16);
    const BAR_MAX_H = Math.round(TOTAL_H * 0.62);
    const GAP = 5;

    const days = [];
    for (let i = -HALF; i <= HALF; i++) days.push(addDays(today, i));
    const todayKey = dayKey(today);
    const counts = days.map(d => getDayCount(d));
    // visibleMax uses raw totals so normalization doesn't shift as you scrub
    const rawCounts = days.map(d => schedule[dayKey(d)] || 0);
    const visibleMax = Math.max(...rawCounts, 1);
    const todayCount = counts[HALF];
    const todayDone = scheduleDone[todayKey] || 0;
    const todayRemaining = todayCount - todayDone;

    function getBarH(count) {
        return count > 0 ? Math.max(Math.round((count / visibleMax) * BAR_MAX_H), 8) : 3;
    }

    graph.innerHTML = '';

    // Update card background: red → amber → green based on focused day's done ratio
    if (card) {
        if (todayCount === 0) {
            card.style.background = '';
        } else {
            const ratio = todayDone / todayCount;
            function _lerp(a, b, t) { return Math.round(a + (b - a) * t); }
            function _hex(h) { const x=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return x?[parseInt(x[1],16),parseInt(x[2],16),parseInt(x[3],16)]:[0,0,0]; }
            function _mix(c1, c2, t) { const a=_hex(c1),b=_hex(c2); return `rgb(${_lerp(a[0],b[0],t)},${_lerp(a[1],b[1],t)},${_lerp(a[2],b[2],t)})`; }
            const bg = ratio <= 0.5
                ? _mix('#450a0a', '#422006', ratio * 2)
                : _mix('#422006', '#052e16', (ratio - 0.5) * 2);
            card.style.background = bg;
        }
    }

    // Show offset indicator if not on real today
    let label = card.querySelector('.due-card-label');
    if (!label) { label = document.createElement('div'); label.className = 'due-card-label'; card.prepend(label); }
    label.textContent = _dueOffset === 0 ? 'Due' : _dueOffset > 0 ? `Due  +${_dueOffset}d` : `Due  ${_dueOffset}d`;
    card.style.cursor = _dueOffset === 0 ? '' : 'pointer';

    // Sync calendar to focused day
    const focusStr = dayKey(today);
    calendarMonth = today.getMonth();
    calendarYear = today.getFullYear();
    renderCalendar(_dueOffset !== 0 ? focusStr : null);

    const allBars = [];

    days.forEach((d, i) => {
        const k = dayKey(d);
        const isToday = k === todayKey;
        const isPast = d < today;
        const isEdge = i === 0 || i === days.length - 1;
        const count = counts[i];
        const totalBarH = getBarH(count);

        const col = document.createElement('div');
        col.className = 'due-col' + (isToday ? ' is-today' : '');
        col.style.opacity = isEdge ? '0.2' : isPast ? '0.4' : '1';
        if (i === 0) col.style.marginLeft = '-10px';
        if (i === days.length - 1) col.style.marginRight = '-10px';

        if (isToday) {
            const done = todayDone;
            const total = todayCount;

            const barBottom = document.createElement('div');
            barBottom.className = 'due-bar';
            barBottom.id = 'due-bar-bottom';
            barBottom.style.background = 'rgba(255,255,255,0.22)';
            barBottom.style.height = '0px';
            barBottom.style.bottom = PAD + 'px';
            col.appendChild(barBottom);

            const barTop = document.createElement('div');
            barTop.className = 'due-bar due-bar-striped';
            barTop.id = 'due-bar-top';
            barTop.style.height = '0px';
            barTop.style.bottom = PAD + 'px';
            col.appendChild(barTop);

            const center = document.createElement('div');
            center.className = 'due-today-center';
            const sub = _dueOffset === 0 ? (total === 0 ? 'none due' : 'due today') : (total === 0 ? 'none due' : 'due this day');
            center.innerHTML = `<div class="due-today-number">${todayRemaining}</div><div class="due-today-label">${sub}</div>`;
            col.appendChild(center);

            allBars.push({ isToday: true, barTop, barBottom, totalBarH, done, total });
        } else {
            const barBg = count > 0
                ? (isPast ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.45)')
                : 'rgba(255,255,255,0.06)';
            const bar = document.createElement('div');
            bar.className = 'due-bar';
            bar.style.background = barBg;
            bar.style.height = '0px';
            bar.style.bottom = PAD + 'px';
            col.appendChild(bar);
            allBars.push({ isToday: false, el: bar, targetH: totalBarH });
        }

        graph.appendChild(col);
    });

    requestAnimationFrame(() => requestAnimationFrame(() => {
        allBars.forEach(b => {
            if (b.isToday) {
                const { barTop, barBottom, totalBarH, done, total } = b;
                if (done === 0 || total === 0) {
                    barBottom.style.height = '0px';
                    barTop.style.height = totalBarH + 'px';
                    barTop.style.bottom = PAD + 'px';
                } else {
                    const ratio = done / total;
                    const doneH = Math.max(Math.round(totalBarH * ratio), 4);
                    const remainH = Math.max(totalBarH - doneH - GAP, 0);
                    barBottom.style.height = doneH + 'px';
                    barBottom.style.bottom = PAD + 'px';
                    barTop.style.height = remainH + 'px';
                    barTop.style.bottom = (PAD + doneH + GAP) + 'px';
                }
            } else {
                b.el.style.height = b.targetH + 'px';
            }
        });
    }));
}
function _isOverdue(endDate, isComplete) {
    if (!endDate || isComplete) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    const end = new Date(endDate + 'T00:00:00');
    return Math.round((end - today) / 86400000) + 1 < 0;
}

function renderCountdownCardInner(endDate, completedDate, isComplete, startDate) {
    // Project delivered — freeze on completion date
    if (isComplete && completedDate) {
        const d = new Date(completedDate + 'T00:00:00');
        const month = d.toLocaleString('default', { month: 'long' });
        const day = d.getDate();
        const year = d.getFullYear();
        return `<div class="countdown-main"><div class="stat-label">Delivered</div>
                <div class="countdown-finished">&#10003;</div>
                <div class="stat-sub">${month} ${day}, ${year}</div></div>
                <div class="countdown-hover-dates"><div class="countdown-hover-divider"></div><div class="countdown-date-row"><span class="countdown-date-label">Start</span><span class="countdown-date-sep">·</span><span>${startDate ? (d2=new Date(startDate+"T00:00:00"), d2.toLocaleString("default",{month:"short"})+" "+d2.getDate()+", "+d2.getFullYear()) : "—"}</span></div><div class="countdown-date-row"><span class="countdown-date-label">End</span><span class="countdown-date-sep">·</span><span>${endDate ? (d3=new Date(endDate+"T00:00:00"), d3.toLocaleString("default",{month:"short"})+" "+d3.getDate()+", "+d3.getFullYear()) : "—"}</span></div></div>`;
    }
    if (!endDate) {
        return `<div class="countdown-main"><div class="stat-label">Deadline</div>
                <div class="stat-value" style="font-size:1.5rem;">—</div>
                <div class="stat-sub">no end date set</div></div>
                <div class="countdown-hover-dates"><div class="countdown-hover-divider"></div><div class="countdown-date-row"><span class="countdown-date-label">Start</span><span class="countdown-date-sep">·</span><span>${startDate ? (d2=new Date(startDate+"T00:00:00"), d2.toLocaleString("default",{month:"short"})+" "+d2.getDate()+", "+d2.getFullYear()) : "—"}</span></div><div class="countdown-date-row"><span class="countdown-date-label">End</span><span class="countdown-date-sep">·</span><span>${null ? (d3=new Date(null+"T00:00:00"), d3.toLocaleString("default",{month:"short"})+" "+d3.getDate()+", "+d3.getFullYear()) : "—"}</span></div></div>`;
    }
    const today = new Date(); today.setHours(0,0,0,0);
    const end = new Date(endDate + 'T00:00:00');
    const days = Math.round((end - today) / 86400000) + 1;
    if (days < 0) {
        const abs = Math.abs(days);
        return `<div class="countdown-main"><div class="stat-label">Deadline</div>
                <div class="stat-value">${abs}</div>
                <div class="stat-sub">${abs === 1 ? '1 day' : abs + ' days'} overdue</div></div>
                <div class="countdown-hover-dates"><div class="countdown-hover-divider"></div><div class="countdown-date-row"><span class="countdown-date-label">Start</span><span class="countdown-date-sep">·</span><span>${startDate ? (d2=new Date(startDate+"T00:00:00"), d2.toLocaleString("default",{month:"short"})+" "+d2.getDate()+", "+d2.getFullYear()) : "—"}</span></div><div class="countdown-date-row"><span class="countdown-date-label">End</span><span class="countdown-date-sep">·</span><span>${endDate ? (d3=new Date(endDate+"T00:00:00"), d3.toLocaleString("default",{month:"short"})+" "+d3.getDate()+", "+d3.getFullYear()) : "—"}</span></div></div>`;
    }
    if (days === 1) {
        return `<div class="countdown-main"><div class="stat-label">Deadline</div>
                <div class="stat-value">Today</div>
                <div class="stat-sub">due today</div></div>
                <div class="countdown-hover-dates"><div class="countdown-hover-divider"></div><div class="countdown-date-row"><span class="countdown-date-label">Start</span><span class="countdown-date-sep">·</span><span>${startDate ? (d2=new Date(startDate+"T00:00:00"), d2.toLocaleString("default",{month:"short"})+" "+d2.getDate()+", "+d2.getFullYear()) : "—"}</span></div><div class="countdown-date-row"><span class="countdown-date-label">End</span><span class="countdown-date-sep">·</span><span>${endDate ? (d3=new Date(endDate+"T00:00:00"), d3.toLocaleString("default",{month:"short"})+" "+d3.getDate()+", "+d3.getFullYear()) : "—"}</span></div></div>`;
    }
    return `<div class="countdown-main"><div class="stat-label">Deadline</div>
            <div class="stat-value">${days}</div>
            <div class="stat-sub">days remaining</div></div>
            <div class="countdown-hover-dates"><div class="countdown-hover-divider"></div><div class="countdown-date-row"><span class="countdown-date-label">Start</span><span class="countdown-date-sep">·</span><span>${startDate ? (d2=new Date(startDate+"T00:00:00"), d2.toLocaleString("default",{month:"short"})+" "+d2.getDate()+", "+d2.getFullYear()) : "—"}</span></div><div class="countdown-date-row"><span class="countdown-date-label">End</span><span class="countdown-date-sep">·</span><span>${endDate ? (d3=new Date(endDate+"T00:00:00"), d3.toLocaleString("default",{month:"short"})+" "+d3.getDate()+", "+d3.getFullYear()) : "—"}</span></div></div>`;
}

function renderFilters() {
    const types = [...new Set(dashboardData.assets.map(s => s.type))].sort();
    const statuses = dashboardData.custom_statuses || [];
    const hasStarred = dashboardData.assets.some(s => s.starred && !s.excluded);
    const sel = (active) => `background:var(--bg-tertiary);border:1px solid ${active ? 'var(--accent)' : 'var(--border)'};color:${active ? 'var(--accent)' : 'var(--text-secondary)'};font-family:var(--mono);font-size:0.7rem;padding:0.2rem 0.4rem;border-radius:5px;outline:none;cursor:pointer;`;
    const lbl = `color:var(--text-muted);font-size:0.65rem;font-family:var(--mono);margin-left:0.5rem;`;

    let html = `<input type="text" class="search-input" id="searchInput" placeholder="Search assets..." oninput="renderTable()">`;

    if (hasStarred) {
        html += `<span class="filter-chip ${starredOnlyFilter ? 'active' : ''}" onclick="toggleStarredFilter()" style="${starredOnlyFilter ? 'border-color:#eab30880;color:#eab308;background:#eab30818;' : 'color:#eab308;border-color:#eab30840;'}">&#9733; Starred</span>`;
        if (starredOnlyFilter) html += `<span class="filter-chip" onclick="clearAllStars()" style="color:var(--red);border-color:var(--red)40;" title="Remove all stars">&#10005; Clear stars</span>`;
    }

    const typeOpts = [{value:'',label:'All',color:null}].concat(types.map(t=>({value:t,label:t,color:null})));
    html += `<span style="${lbl}">TYPE:</span>${makeCustomSelect('flt-type', typeOpts, activeTypeFilter||'', v=>toggleTypeFilter(v||null), false)}`;

    const withWork = dashboardData.assets.filter(a => !a.excluded && a.assignee).map(a => a.assignee);
    if (activeAssigneeFilter) withWork.push(activeAssigneeFilter);
    if (withWork.length) {
        const assigneeOpts = peopleOptions(withWork, 'All');
        html += `<span style="${lbl}">ASSIGNEE:</span>${makeCustomSelect('flt-assignee', assigneeOpts, activeAssigneeFilter||'', v=>setAssigneeFilter(v), false)}`;
    }

    const anyFilterActive = activeTypeFilter || activeStatusFilter || activeAssigneeFilter || starredOnlyFilter || activeDateFilter;
    if (anyFilterActive) {
        html += `<span class="filter-chip" onclick="clearAllFilters()" style="margin-left:auto;color:var(--text-muted);border-color:var(--border);">&#10005; Clear filters</span>`;
    }

    if (statuses.length) {
        html += `<div style="display:flex;align-items:center;justify-content:center;gap:0.4rem;width:100%;flex-wrap:wrap;margin-top:0;padding-top:0.5rem;border-top:1px solid var(--border);">`;
        statuses.forEach(s => {
            const sn = statusName(s), sc = statusColor(s);
            const active = activeStatusFilter === sn;
            html += `<span class="filter-chip" onclick="toggleStatusFilter('${esc(sn)}')" style="${active ? `background:${sc};border-color:${sc};color:#fff;font-weight:600;` : `background:${sc}22;border-color:${sc}55;color:${sc};`}">${esc(sn)}</span>`;
        });
        html += `</div>`;
    }

    if (!dashboardData.project_complete) html += `<span class="filter-chip v4-manage-only" onclick="openPlannedAssets()" title="Add assets before their files exist">+ Planned</span>`;
    document.getElementById('filtersBar').innerHTML = html;
}

function toggleTypeFilter(t) { activeTypeFilter = t || null; renderAll(); }
function toggleStatusFilter(s) { activeStatusFilter = (activeStatusFilter === s) ? null : (s || null); renderAll(); }
function clearAllFilters() {
    activeTypeFilter = null; activeStatusFilter = null;
    activeAssigneeFilter = null; starredOnlyFilter = false; activeDateFilter = null;
    renderAll(); renderCalendar();
}
function toggleStarredFilter() { starredOnlyFilter = !starredOnlyFilter; renderAll(); }
async function clearAllStars() {
    if (!confirm('Remove all stars?')) return;
    const starred = dashboardData.assets.filter(s => s.starred);
    for (const shot of starred) {
        shot.starred = false;
        await saveMeta(shot);
    }
    starredOnlyFilter = false;
    renderAll(); showToast('All stars cleared');
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
const PALETTE = [
    {hex:'#3b82f6',name:'Ocean'},{hex:'#22c55e',name:'Mint'},{hex:'#eab308',name:'Honey'},
    {hex:'#ef4444',name:'Coral'},{hex:'#6366f1',name:'Indigo'},{hex:'#a855f7',name:'Violet'},
    {hex:'#ec4899',name:'Rose'},{hex:'#06b6d4',name:'Teal'},{hex:'#555566',name:'Slate'},{hex:'#888888',name:'Stone'}
];
function getStatusColor(status) { const item = (dashboardData.custom_statuses || []).find(s => s.name === status); return item ? item.color : '#888888'; }
function getDifficultyColor(diff) { const item = (dashboardData.custom_difficulties || []).find(d => d.name === diff); return item ? item.color : ''; }
function colorBadgeStyle(color) { return `background:${color}22;color:${color};`; }
function rowTintStyle(status) { const c = getStatusColor(status); return c ? `background: ${c}18;` : ''; }
function getTypeClass(type) { return ['ANIM','LIT','COMP','FX'].includes(type) ? `type-${type}` : 'type-default'; }
function progressColor(pct) { if (pct >= 75) return 'var(--green)'; if (pct >= 40) return 'var(--yellow)'; if (pct > 0) return 'var(--accent)'; return 'var(--text-muted)'; }

// ---------------------------------------------------------------------------
// Complete banner
// ---------------------------------------------------------------------------
let completeBannerExpanded = false;
function renderCompleteBanner() {
    const container = document.getElementById('completeBanner');
    const isComplete = dashboardData.project_complete || false;
    const finalMedia = dashboardData.final_media || '';
    if (!isComplete) { container.innerHTML = ''; return; }
    let mediaPreview = '';
    if (finalMedia) {
        const ext = finalMedia.split('.').pop().toLowerCase();
        if (['mp4','avi','mov','webm'].includes(ext)) mediaPreview = `<video controls preload="metadata" style="width:100%;border-radius:6px;background:#000;max-height:400px;" src="/api/video?path=${encodeURIComponent(finalMedia)}"></video>`;
        else if (['png','jpg','jpeg','gif','webp','bmp','tiff'].includes(ext)) mediaPreview = `<img src="/api/video?path=${encodeURIComponent(finalMedia)}" style="width:100%;border-radius:6px;max-height:400px;object-fit:contain;background:#000;">`;
        mediaPreview += `<div style="font-size:0.7rem;color:#ffd70066;margin-top:0.3rem;font-family:var(--mono);">${esc(finalMedia.split(/[/\\]/).pop())}</div>`;
    }
    container.innerHTML = `<div class="complete-banner" onclick="toggleCompleteBanner(event)">
        <div class="banner-row"><div class="banner-title">&#9733; Project Complete</div><div class="banner-sub">${finalMedia ? esc(finalMedia.split(/[/\\]/).pop()) : 'No final deliverable set'}</div></div>
        <div class="banner-detail ${completeBannerExpanded ? 'open' : ''}" onclick="event.stopPropagation()">
            ${mediaPreview || '<div style="color:#ffd70066;font-size:0.75rem;margin-bottom:0.5rem;">No final media attached</div>'}
            <div style="margin-top:0.75rem;">
                <div style="font-family:var(--mono);font-size:0.62rem;color:#ffd70088;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.35rem;">Reflection</div>
                <div onclick="openReflectionModal()" style="cursor:pointer;min-height:3rem;padding:0.55rem 0.75rem;background:var(--bg-tertiary);border:1px solid #ffd70030;border-radius:6px;font-size:0.75rem;color:${dashboardData.project_reflection ? 'var(--text-primary)' : '#ffd70044'};line-height:1.6;white-space:pre-wrap;word-break:break-word;" title="Click to edit">${dashboardData.project_reflection ? esc(dashboardData.project_reflection) : 'Click to add a reflection…'}</div>
            </div>
            <div class="banner-actions">
                <button class="btn-sm" onclick="browseFinalMedia()" style="border-color:#ffd70040;color:#ffd700;">${finalMedia ? 'Replace Media' : 'Attach Final Media'}</button>
                ${finalMedia ? `<button class="btn-sm" onclick="openFinalMediaFolder()" style="border-color:#ffd70040;color:#ffd700;">Open Folder</button>` : ''}
                ${finalMedia ? `<button class="btn-sm" onclick="clearFinalMedia()" style="border-color:#ffd70040;color:#ffd70088;">Clear</button>` : ''}
                <button class="btn-sm" onclick="toggleProjectComplete()" style="border-color:var(--red);color:var(--red);">Unmark Complete</button>
            </div>
        </div></div>`;
}
function toggleCompleteBanner(e) { completeBannerExpanded = !completeBannerExpanded; renderCompleteBanner(); }
async function saveReflection() {
    const el = document.getElementById('reflectionText');
    if (!el) return;
    dashboardData.project_reflection = el.value;
    await saveProjectMeta();
}
async function toggleProjectComplete() {
    const isComplete = dashboardData.project_complete || false;
    if (isComplete) { dashboardData.project_complete = false; dashboardData.final_media = ''; dashboardData.completed_date = ''; }
    else {
        dashboardData.project_complete = true;
        dashboardData.completed_date = new Date().toISOString().slice(0,10);
        await new Promise(resolve => openFileBrowser('media', dashboardData.root_path, path => {
            if (path) dashboardData.final_media = path;
            resolve();
        }));
    }
    await saveProjectMeta(); renderCompleteBanner();
    const _completedRow = document.getElementById('projCompletedRow');
    if (_completedRow) _completedRow.style.display = dashboardData.project_complete ? '' : 'none';
    if (dashboardData.project_complete) {
        const _cf = document.getElementById('projCompletedDate');
        if (_cf) { _cf.value = dashboardData.completed_date || ''; const _cdd = document.getElementById('projCompletedDateDisplay'); if(_cdd){_cdd.textContent=_cf.value||'—';_cdd.classList.toggle('proj-date-set',!!_cf.value);} }
    }
    _saveDatesToLocal();
    showToast(dashboardData.project_complete ? 'Project marked complete' : 'Project unmarked');
}
async function browseFinalMedia() {
    openFileBrowser('media', dashboardData.root_path, async path => {
        if (!path) return;
        dashboardData.final_media = path;
        await saveProjectMeta(); renderCompleteBanner(); showToast('Final media updated');
    });
}
async function clearFinalMedia() { dashboardData.final_media = ''; await saveProjectMeta(); renderCompleteBanner(); showToast('Final media cleared'); }
async function openFinalMediaFolder() {
    const media = dashboardData.final_media;
    if (!media) return;
    const folder = parentPath(media);
    const result = await api('/api/open_file', { filepath: folder });
    if (result.error) showToast('Error: ' + result.error);
}
async function saveProjectMeta() {
    await api('/api/save_settings', _buildSettingsPayload());
}

// ---------------------------------------------------------------------------
