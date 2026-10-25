// Calendar
// ---------------------------------------------------------------------------
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();
function renderCalendar(focusDateStr) {
    const container = document.getElementById('calendarSection');
    const shots = getActiveShots().filter(s => s.due_date);
    if (!shots.length) { container.innerHTML = ''; return; }
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const shotsByDate = {};
    shots.forEach(s => { if (!shotsByDate[s.due_date]) shotsByDate[s.due_date] = []; shotsByDate[s.due_date].push(s); });
    let grid = days.map(d => `<div class="cal-day-header">${d}</div>`).join('');
    for (let i = 0; i < firstDay; i++) grid += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday = dateStr === todayStr;
        const isFocus = focusDateStr && dateStr === focusDateStr && focusDateStr !== todayStr;
        const isActiveFilter = activeDateFilter === dateStr;
        const dayShotsArr = shotsByDate[dateStr] || [];
        const dayDate = new Date(dateStr + 'T00:00:00');
        const isPast = dayDate < today && !isToday;
        const hasIncomplete = dayShotsArr.some(s => !s.done && s.completion < 100);
        const isOverdue = isPast && hasIncomplete;
        const hasShots = dayShotsArr.length > 0;
        const classes = ['cal-day', isToday ? 'today' : '', isFocus ? 'due-focus' : '', isOverdue ? 'cal-overdue' : '', isActiveFilter ? 'cal-active-filter' : '', hasShots ? 'cal-has-shots' : ''].filter(Boolean).join(' ');
        grid += `<div class="${classes}" ${hasShots ? `onclick="toggleDateFilter('${dateStr}')" title="Filter by ${dateStr}"` : ''}>
            <div class="cal-num">${d}</div>
            ${dayShotsArr.map(s => { const c = getStatusColor(s.status); return `<div class="cal-shot" style="background:${c}30;color:${c};" onclick="event.stopPropagation();expandedShot='${esc(s.name)}';renderTable(true);document.getElementById('shotsBody').scrollIntoView({behavior:'smooth'});">${esc(s.name.split('.').pop())}</div>`; }).join('')}
        </div>`;
    }
    const filterNote = activeDateFilter ? `<span style="font-family:var(--mono);font-size:0.65rem;color:#ef4444;cursor:pointer;" onclick="toggleDateFilter(null)" title="Clear date filter">&#10005; ${activeDateFilter}</span>` : '';
    container.innerHTML = `<div class="calendar-header"><h2>Schedule</h2>${filterNote}<div class="calendar-nav">
        <button onclick="calendarMonth--;if(calendarMonth<0){calendarMonth=11;calendarYear--;}renderCalendar();">&#9664;</button>
        <span>${months[calendarMonth]} ${calendarYear}</span>
        <button onclick="calendarMonth++;if(calendarMonth>11){calendarMonth=0;calendarYear++;}renderCalendar();">&#9654;</button>
    </div></div><div class="calendar-grid">${grid}</div>`;
}

function toggleDateFilter(dateStr) {
    activeDateFilter = (activeDateFilter === dateStr) ? null : dateStr;
    renderCalendar();
    renderTable(true);
    if (activeDateFilter) document.getElementById('shotsBody').scrollIntoView({ behavior: 'smooth' });
}

// ---------------------------------------------------------------------------
// Shot row rendering
// ---------------------------------------------------------------------------
let _previousKeys = new Set();
let _previousExcludedKeys = new Set();

function renderShotRow(shot, isExcluded) {
    const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
    if (search && !shot.name.toLowerCase().includes(search)) return '';
    if (!isExcluded && activeTypeFilter && shot.type !== activeTypeFilter) return '';
    if (!isExcluded && activeStatusFilter && shot.status !== activeStatusFilter) return '';
    if (!isExcluded && activeAssigneeFilter && shot.assignee !== activeAssigneeFilter) return '';
    if (!isExcluded && activeDateFilter && shot.due_date !== activeDateFilter) return '';
    const n = shot.name;
    if (isExcluded) {
        return `<tr class="excluded-row" style="opacity:0.45;" data-shot-key="${esc(n)}" oncontextmenu="showCtxMenu(event,'${esc(n)}')">
            <td colspan="9"><span class="shot-name" style="cursor:default;">${esc(n)}</span>${shot.notes ? `<span style="font-family:var(--mono);font-size:0.65rem;color:var(--text-muted);margin-left:0.75rem;">${esc(shot.notes)}</span>` : ''}</td>
            <td style="text-align:right;"><button class="btn-include" onclick="event.stopPropagation();toggleExclude('${esc(n)}',false)" style="padding:0.2rem 0.6rem;font-size:0.65rem;">Include</button></td>
        </tr>`;
    }
    const pct = shot.completion || 0;
    const activeComments = (shot.comments || []).filter(c => !c.archived);
    const statusColor = getStatusColor(shot.status);
    const assignee = shot.assignee || '';
    const assigneeColor = assignee ? personColor(assignee) : 'var(--accent)';
    const assigneeAttr = assignee ? `data-assignee="${esc(assignee)}" data-assignee-color="${esc(assigneeColor)}"` : '';

    let row = `<tr data-shot-key="${esc(n)}" ${assigneeAttr} class="${expandedShot === n ? 'expanded' : ''} ${bulkSelected.has(n) ? 'bulk-selected' : ''} ${shot.starred ? 'starred-row' : ''} ${shot.done ? 'done-row' : ''}" onmousedown="handleRowMousedown(event,'${esc(n)}',false)" onclick="handleRowClick(event,'${esc(n)}',false)" oncontextmenu="showCtxMenu(event,'${esc(n)}')" ${assignee ? `onmouseenter="showAssigneeTooltip(event,this)" onmousemove="moveAssigneeTooltip(event)" onmouseleave="hideAssigneeTooltip()"` : ''} style="${rowStyle(shot, false)}">
        <td><span class="shot-name">${esc(n)}</span>${shot.planned ? '<span class="planned-chip" title="No file yet. A file with exactly this name fills it.">Planned</span>' : ''}${activeComments.length ? `<span class="comment-badge">${activeComments.length}</span>` : ''}</td>
        <td><span class="type-badge ${getTypeClass(shot.type)}">${esc(shot.type)}</span></td>
        <td>${shot.planned ? '<span class="master-missing">&#8212;</span>' : `<span class="version-num">v${esc(shot.version)}</span>`}</td>
        <td>${shot.has_master ? '<span class="master-check">&#10003;</span>' : '<span class="master-missing">&#8212;</span>'}</td>
        <td><span class="status-badge" style="${colorBadgeStyle(getStatusColor(shot.status))}">${esc(shot.status || '\u2014')}</span></td>
        <td>${renderDifficultyCell(shot)}</td>
        <td>${renderProgressCell(pct)}</td>
        <td>${renderDueDateCell(shot)}</td>
        <td style="font-size:0.75rem;color:var(--text-secondary);">${esc(shot.last_published || '\u2014')}</td>
        <td style="font-size:0.75rem;color:var(--text-secondary);">${esc(shot.last_user || '\u2014')}</td>
    </tr>`;

    if (expandedShot === n) {
        row += `<tr class="detail-row"><td colspan="10"><div class="detail-row-wrap"><div class="detail-panel" data-detail-for="${esc(n)}" onclick="event.stopPropagation()">${buildDetailPanelHTML(shot, isExcluded)}</div></div></td></tr>`;
    }
    return row;
}


/* ── Custom Select Engine ───────────────────────────────── */
const _cselCbs = {};
let _cselActive = null;

function _cselOpen(id) {
    if (_cselActive && _cselActive !== id) {
        const pm = document.getElementById(_cselActive + '-csel-m');
        const pt = document.getElementById(_cselActive + '-csel-t');
        if (pm) pm.classList.remove('open');
        if (pt) pt.classList.remove('csel-active');
    }
    const menu = document.getElementById(id + '-csel-m');
    const trig = document.getElementById(id + '-csel-t');
    if (!menu) return;
    const opening = !menu.classList.contains('open');
    menu.classList.toggle('open', opening);
    if (trig) trig.classList.toggle('csel-active', opening);
    _cselActive = opening ? id : null;
    if (opening) addDropdownSearch(menu, '.csel-item');
    if (opening) requestAnimationFrame(() => {
        const r = menu.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 8) {
            menu.style.top = 'auto'; menu.style.bottom = 'calc(100% + 4px)';
        } else { menu.style.top = ''; menu.style.bottom = ''; }
    });
}

// v4: long people lists get a search box at the top
function addDropdownSearch(menu, itemSel) {
    if (!menu) return;
    const items = [...menu.querySelectorAll(itemSel)];
    if (items.length <= 8) return;
    let box = menu.querySelector('.dd-search');
    if (!box) {
        box = document.createElement('input');
        box.type = 'search'; box.className = 'dd-search'; box.placeholder = 'Search people'; box.setAttribute('aria-label', 'Search people');
        ['click', 'mousedown'].forEach(ev => box.addEventListener(ev, e => e.stopPropagation()));
        box.addEventListener('input', () => {
            const q = box.value.trim().toLowerCase();
            items.forEach(el => { el.style.display = !q || el.textContent.toLowerCase().includes(q) ? '' : 'none'; });
        });
        menu.insertBefore(box, menu.firstChild);
    }
    box.value = ''; items.forEach(el => el.style.display = '');
    setTimeout(() => box.focus(), 0);
}

function _cselPick(id, value) {
    const inp = document.getElementById(id);
    if (inp) inp.value = value;
    const items = document.querySelectorAll('#' + id + '-csel-m .csel-item');
    let label = value, color = null;
    items.forEach(el => {
        const sel = el.dataset.val === value;
        el.classList.toggle('csel-selected', sel);
        if (sel) {
            const lbl = el.querySelector('.csel-lbl'); if (lbl) label = lbl.textContent;
            const dot = el.querySelector('.csel-dot'); if (dot) color = dot.style.background;
        }
    });
    const lbl = document.getElementById(id + '-csel-l'); if (lbl) lbl.textContent = label;
    const dot = document.getElementById(id + '-csel-d'); if (dot && color) dot.style.background = color;
    const menu = document.getElementById(id + '-csel-m'); if (menu) menu.classList.remove('open');
    const trig = document.getElementById(id + '-csel-t'); if (trig) trig.classList.remove('csel-active');
    _cselActive = null;
    if (_cselCbs[id]) _cselCbs[id](value);
}

document.addEventListener('mousedown', e => {
    if (_cselActive && !e.target.closest('.csel-wrap')) {
        const m = document.getElementById(_cselActive + '-csel-m');
        const t = document.getElementById(_cselActive + '-csel-t');
        if (m) m.classList.remove('open');
        if (t) t.classList.remove('csel-active');
        _cselActive = null;
    }
});

function makeCustomSelect(id, options, currentVal, onChange, fullWidth) {
    _cselCbs[id] = onChange || null;
    const cur = options.find(o => String(o.value) === String(currentVal)) || {label: String(currentVal || '—'), value: currentVal || '', color: null};
    const wrapCls = 'csel-wrap' + (fullWidth ? ' csel-full' : '');
    const items = options.map(o =>
        `<div class="csel-item${String(o.value) === String(currentVal) ? ' csel-selected' : ''}" data-val="${esc(String(o.value))}" onclick="event.stopPropagation();_cselPick('${id}',this.dataset.val)">
            ${o.color ? `<span class="csel-dot" style="background:${o.color}"></span>` : ''}
            <span class="csel-lbl">${esc(o.label)}</span>
        </div>`
    ).join('');
    return `<div class="${wrapCls}"><input type="hidden" id="${id}" value="${esc(String(currentVal || ''))}"><div id="${id}-csel-t" class="csel-trigger" onclick="event.stopPropagation();_cselOpen('${id}')">${cur.color ? `<span id="${id}-csel-d" class="csel-dot" style="background:${cur.color}"></span>` : ''}<span id="${id}-csel-l">${esc(cur.label)}</span><span class="csel-arrow">▾</span></div><div id="${id}-csel-m" class="csel-menu">${items}</div></div>`;
}

function buildDetailPanelHTML(shot, isExcluded, isLib) {
    const n = shot.name;
    const pct = shot.completion || 0;
        const fStart = shot.frame_start || 1;
        const shotFps = shot.fps || 24;
        const media = shot.manual_media || shot.playblast || '';
        const isManual = !!shot.manual_media;
        const archivedComments = (shot.comments || []).filter(c => c.archived);
        const showArchived = !!window[`_showArchived_${n}`];

        let mediaHtml = '';
        if (media) {
            const ext = media.split('.').pop().toLowerCase();
            const isVideo = ['mp4','avi','mov','webm'].includes(ext);
            const isImage = ['png','jpg','jpeg','gif','webp','bmp','tiff'].includes(ext);
            const vid_id = 'vid-' + n.replace(/[^a-zA-Z0-9]/g, '_');
            if (isVideo) {
                mediaHtml = `<div style="position:relative;display:inline-block;width:100%;">
                    <video id="${vid_id}" controls preload="metadata" style="width:100%;border-radius:6px;background:#000;max-height:280px;"
                        src="/api/video?path=${encodeURIComponent(media)}"
                        ontimeupdate="updateFrameCounter('${vid_id}',${fStart},${shotFps})"
                        onloadedmetadata="initVideoFps('${vid_id}',${shotFps})"></video>
                    <div id="${vid_id}-overlay" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.75);color:var(--accent);font-family:var(--mono);font-size:0.8rem;font-weight:600;padding:2px 8px;border-radius:4px;pointer-events:none;">f${fStart}</div>
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.3rem;">
                    <span id="${vid_id}-readout" style="font-family:var(--mono);font-size:0.75rem;color:var(--accent);font-weight:600;">Frame: ${fStart}</span>
                    <span style="color:var(--text-muted);font-size:0.65rem;">|</span>
                    <span style="font-family:var(--mono);font-size:0.65rem;color:var(--text-muted);">${shotFps}fps · start: f${fStart}</span>
                </div>`;
            } else if (isImage) {
                mediaHtml = `<img src="/api/video?path=${encodeURIComponent(media)}" style="width:100%;border-radius:6px;max-height:280px;object-fit:contain;background:#000;">`;
            }
            mediaHtml += `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.3rem;font-family:var(--mono);word-break:break-all;">${isManual ? '(manual) ' : '(auto) '}${esc(media.split(/[/\\]/).pop())}</div>
            <div style="display:flex;gap:0.4rem;margin-top:0.4rem;">
                ${media.split('.').pop().toLowerCase().match(/mp4|avi|mov|webm/) ? `<button class="btn-sm" onclick="attachFrameFromVideo('vid-${n.replace(/[^a-zA-Z0-9]/g, '_')}','${esc(n)}','${esc(shot.type)}',${fStart},${shotFps})">Attach Frame</button>` : ''}
                <button class="btn-sm" onclick="browseMedia('${esc(n)}')">Replace</button>
                ${isManual ? `<button class="btn-sm" onclick="clearMedia('${esc(n)}')">Clear</button>` : ''}
            </div>`;
        } else {
            mediaHtml = `<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:0.4rem;">No media found</div><button class="btn-sm" onclick="browseMedia('${esc(n)}')">Attach Media</button>`;
        }

        const playlistOptions = dashboardPlaylists.filter(p => !p.archived).map(p => `<option value="${esc(p.filename)}">${esc(p.name)} (${p.asset_count})</option>`).join('');
        const commentsToShow = showArchived ? (shot.comments || []) : (shot.comments || []).filter(c => !c.archived);
        const activeComments = (shot.comments || []).filter(c => !c.archived && !c.resolved);
        const sorted = sortComments(commentsToShow, shot.comments || []);
        let commentsHtml = '';
        if (!commentsToShow.length && !archivedComments.length) {
            commentsHtml = '<div style="color:var(--text-muted);font-size:0.75rem;">No review notes yet</div>';
        } else if (!commentsToShow.length) {
            commentsHtml = '<div style="color:var(--text-muted);font-size:0.75rem;">All notes archived</div>';
        } else {
            commentsHtml = sorted.map(({ c, i }) => {
                if (c.archived) return `<div style="opacity:0.5;padding:0.25rem 0;border-bottom:1px solid var(--border);font-size:0.72rem;display:flex;align-items:center;gap:0.4rem;"><span style="font-family:var(--mono);color:var(--text-muted);font-size:0.65rem;">[archived]</span><span>${esc(c.text)}</span></div>`;
                if (c.resolved) {
                    const expandKey = `${n}:${i}`;
                    const isExpanded = resolvedExpanded.has(expandKey);
                    return `<div style="margin-bottom:4px;" class="comment-item">
                        <div style="display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.5rem;background:var(--green-dim);border:1px solid var(--green)22;border-radius:${isExpanded?'4px 4px 0 0':'4px'};">
                            <span style="color:var(--green);font-size:0.8rem;cursor:pointer;flex:1;display:flex;align-items:center;gap:0.4rem;" onclick="toggleResolvedComment('${esc(n)}',${i})">
                                <span>✓</span>
                                <span style="font-family:var(--mono);font-size:0.68rem;color:var(--green);">Resolved · ${esc((c.resolved_at||'').substring(0,10))}</span>
                                <span style="color:var(--green);font-size:0.65rem;opacity:0.7;">${isExpanded ? '▴' : '▾'}</span>
                            </span>
                            <button class="comment-archive-btn" onclick="archiveComment('${esc(n)}','${esc(shot.type)}',${i})" title="Archive" style="position:static;opacity:0.3;flex-shrink:0;">×</button>
                        </div>
                        ${isExpanded ? `<div style="padding:0.5rem 0.5rem 0.25rem;border:1px solid var(--border);border-top:none;border-radius:0 0 4px 4px;background:var(--bg-secondary);">
                            <div style="display:flex;gap:0.5rem;align-items:baseline;margin-bottom:0.2rem;"><span style="font-weight:600;font-size:0.75rem;">${esc(c.user)}</span><span style="font-size:0.65rem;color:var(--text-muted);">${esc(c.timestamp)}</span>${c.frame!=null?`<span style="font-family:var(--mono);font-size:0.65rem;color:var(--accent);cursor:pointer;" onclick="seekVideoToFrame('vid-${n.replace(/[^a-zA-Z0-9]/g,'_')}',${c.frame},${fStart},${shotFps})">f${c.frame}</span>`:''}
                            </div><div style="font-size:0.8rem;color:var(--text-secondary);">${esc(c.text)}</div>
                        </div>` : ''}
                    </div>`;
                }
                return `<div class="history-item comment-item" style="position:relative;">
                    <button class="comment-archive-btn" onclick="archiveComment('${esc(n)}','${esc(shot.type)}',${i})" title="Archive">×</button>
                    <div style="display:flex;align-items:baseline;gap:0.5rem;">
                        <span class="h-user" style="font-weight:600;">${esc(c.user)}</span>
                        <span class="h-date">${esc(c.timestamp)}</span>
                        ${c.frame!=null?`<span style="font-family:var(--mono);font-size:0.65rem;color:var(--accent);cursor:pointer;" onclick="seekVideoToFrame('vid-${n.replace(/[^a-zA-Z0-9]/g,'_')}',${c.frame},${fStart},${shotFps})">f${c.frame}</span>`:''}
                    </div>
                    <div style="margin-top:0.15rem;color:var(--text-primary);font-size:0.8rem;">${esc(c.text)}</div>
                    ${c.annotation_url ? `<div style="margin-top:0.4rem;cursor:zoom-in;border-radius:4px;overflow:hidden;border:1px solid var(--border);" onclick="openAnnotationLightbox('${esc(c.annotation_url)}')"><img src="${esc(c.annotation_url)}" style="width:100%;display:block;" loading="lazy" alt="annotation"></div>` : ''}
                    <div style="margin-top:0.3rem;"><button class="btn-sm" style="font-size:0.65rem;padding:0.2rem 0.5rem;color:var(--green);border-color:var(--green)44;" onclick="resolveComment('${esc(n)}','${esc(shot.type)}',${i})">✓ Resolve</button></div>
                </div>`;
            }).join('');
        }

    return `
            <!-- Col 1: Properties -->
            <div class="detail-section">
                <h3>Asset Properties</h3>
                <div class="detail-field"><label>Status</label>
                    <div class="ctx-chips" style="padding:0.1rem 0 0.2rem;">${(dashboardData.custom_statuses||[]).map(s=>{const sn=statusName(s),sc=statusColor(s);const isActive=(shot.status||'')===sn;return `<button class="ctx-chip${isActive?' active':''}" onclick="detailSetStatus('${esc(n)}','${esc(sn)}')" style="${isActive?`background:${sc};border-color:${sc};color:#fff;`:`border-color:${sc}55;color:${sc};`}">${esc(sn)}</button>`;}).join('')}</div>
                </div>
                <div class="detail-field"><label>Difficulty</label>
                    <div class="ctx-chips" style="padding:0.1rem 0 0.2rem;">${(()=>{const noActive=!shot.difficulty;return `<button class="ctx-chip${noActive?' active':''}" onclick="detailSetDifficulty('${esc(n)}','')" style="${noActive?'background:var(--border-light);border-color:var(--border-light);color:var(--text-primary);':''}">—</button>`+(dashboardData.custom_difficulties||[]).map(d=>{const dn=statusName(d),dc=statusColor(d);const isActive=shot.difficulty===dn;return `<button class="ctx-chip${isActive?' active':''}" onclick="detailSetDifficulty('${esc(n)}','${esc(dn)}')" style="${isActive?`background:${dc};border-color:${dc};color:#fff;`:`border-color:${dc}55;color:${dc};`}">${esc(dn)}</button>`;}).join('');})()}</div>
                </div>
                <div class="detail-field"><label>Assignee</label>
                    ${canReassign(shot)
                        ? makeCustomSelect(`assignee-${n}`, peopleOptions(projectPeople().map(p => p.name), 'Unassigned'), shot.assignee||'', v=>{ const sh=dashboardData.assets.find(a=>a.name===n); if(sh){sh.assignee=v;} autoSave(n); }, true)
                        : `<div class="assignee-readonly" title="Only the project lead can reassign">${shot.assignee ? `<span class="csel-dot" style="background:${personColor(shot.assignee)}"></span>${esc(shot.assignee)}` : '<span style="color:var(--text-muted);">Unassigned</span>'}</div>`}
                </div>
                <div class="detail-field"><label>Due Date</label>
                    <div style="display:flex;align-items:center;gap:0.4rem;">
                        <span id="duedate-display-${n}" style="font-family:var(--mono);font-size:0.78rem;color:var(--text-primary);flex:1;padding:0.4rem 0.5rem;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;min-height:1.8rem;cursor:pointer;" onclick="openDatePicker(v=>{ const s=dashboardData.assets.find(a=>a.name==='${n}'); if(s){s.due_date=v;document.getElementById('duedate-display-${n}').textContent=v||'—';autoSave('${n}');}}, '${shot.due_date||''}', this)">${shot.due_date||'—'}</span>
                        ${shot.due_date ? `<button class="btn-sm" style="font-size:0.6rem;padding:1px 6px;color:var(--text-muted);" onclick="const s=dashboardData.assets.find(a=>a.name==='${n}');if(s){s.due_date='';document.getElementById('duedate-display-${n}').textContent='—';autoSave('${n}');}">×</button>` : ''}
                        <button id="star-btn-${n}" class="ctx-toggle-btn${shot.starred ? ' star-active' : ''}" style="gap:0.3rem;flex-shrink:0;padding:0.28rem 0.6rem;" onclick="detailToggleStar('${esc(n)}')" title="${shot.starred ? 'Unstar' : 'Star'}">${shot.starred ? '\u2605 Starred' : '\u2606 Star'}</button>
                        <button id="done-btn-${n}" class="ctx-toggle-btn${shot.done ? ' done-active' : ''}" style="gap:0.3rem;flex-shrink:0;padding:0.28rem 0.6rem;" onclick="(function(){ const sh=dashboardData.assets.find(a=>a.name==='${n}'); if(!sh) return; sh.done=!sh.done; const btn=document.getElementById('done-btn-${n}'); if(btn){btn.classList.toggle('done-active',sh.done);btn.title=sh.done?'Mark undone':'Mark as done';} autoSave('${n}'); })()" title="${shot.done ? 'Mark undone' : 'Mark as done'}">\u2713 Done</button>
                    </div>
                    <input type="hidden" id="done-${n}" value="${shot.done ? 'true' : ''}">
                </div>
                <div class="detail-field"><label>Completion: <strong id="pct-label-${n}">${pct}%</strong></label>
                    <input type="range" min="0" max="100" value="${pct}" id="completion-${n}" oninput="document.getElementById('pct-label-${n}').textContent=this.value+'%'" onchange="autoSave('${n}')"></div>
                <div class="detail-field"><label>Notes</label>
                    <textarea id="notes-${n}" onchange="autoSave('${n}')">${esc(shot.notes||'')}</textarea></div>
                <div class="detail-actions">
                    ${shot.last_file ? `<button class="btn-save" onclick="openFile('${esc(shot.last_file.replace(/\\/g,'\\\\'))}')">Open File</button>` : ''}
                    ${shot.last_file ? `<button class="btn-sm" onclick="openFileFolder('${esc(shot.last_file.replace(/\\/g,'\\\\'))}')">Open Folder</button>` : ''}
                    <button class="btn-sm" onclick="navigator.clipboard.writeText('${esc(n)}').then(()=>showToast('Copied'))">Copy Name</button>
                </div>
                <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);">
                    <div style="font-size:0.65rem;color:var(--text-muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.4rem;">Add to Review Playlist</div>
                    <div class="playlist-add-row">
                        ${makeCustomSelect(`playlist-sel-${n}`, [{value:'',label:'Select playlist...',color:null}].concat((dashboardPlaylists||[]).map(p=>({value:p.filename,label:p.name,color:null}))).concat([{value:'__new__',label:'+ Create new playlist',color:null}]), '', null, true)}
                        <button class="btn-sm" onclick="addToPlaylist('${esc(n)}')">Add</button>
                    </div>
                </div>
            </div>
            <!-- Col 2: Media -->
            <div class="detail-section"><h3>Media</h3>${mediaHtml}</div>
            <!-- Col 3: History + Comments -->
            <div class="detail-section">
                <h3>Version History</h3>
                <div class="history-list">
                    ${(shot.history||[]).slice().reverse().map(h => `<div class="history-item"><span class="h-ver">v${esc(h.version)}</span> <span class="h-user">${esc(h.user)}</span> <span class="h-date">${esc(h.date)}</span>${h.note?`<div class="h-note">${esc(h.note)}</div>`:''}</div>`).join('')}
                    ${(!shot.history||!shot.history.length)?'<div style="color:var(--text-muted);font-size:0.75rem;">No history</div>':''}
                </div>
                <h3 style="margin-top:1rem;">Review Notes <span style="font-weight:400;color:var(--text-muted);font-size:0.7rem;">(${activeComments.length}${archivedComments.length?` · <span style="cursor:pointer;text-decoration:underline;" onclick="toggleShowArchived('${esc(n)}')">${showArchived?'hide':'show'} ${archivedComments.length} archived</span>`:''})</span></h3>
                <div style="display:flex;gap:0.4rem;margin-bottom:0.5rem;align-items:center;">
                    <input type="text" id="comment-input-${n}" placeholder="Add a note..." style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);font-family:var(--mono);font-size:0.75rem;padding:0.4rem 0.5rem;border-radius:4px;outline:none;" onkeydown="if(event.key==='Enter')addComment('${esc(n)}','${esc(shot.type)}')">
                    <span id="frame-badge-${n}" style="font-family:var(--mono);font-size:0.65rem;color:var(--accent);white-space:nowrap;"></span>
                    <button class="btn-sm" onclick="addComment('${esc(n)}','${esc(shot.type)}')">Send</button>
                </div>
                <div class="history-list" style="max-height:200px;">${commentsHtml}</div>
            </div>
            ${!isLib ? `<div class="detail-danger">
                ${isExcluded ? `<button class="btn-include" onclick="event.stopPropagation();toggleExclude('${n}',false)">Include</button>` : `<span onclick="event.stopPropagation();toggleExclude('${n}',true)" style="font-family:var(--mono);font-size:0.6rem;color:var(--text-muted);cursor:pointer;user-select:none;" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--text-muted)'">exclude</span>`}
            </div>` : ""}`;
}

function patchDetailPanel(shotName) {
    const panel = document.querySelector(`.detail-panel[data-detail-for="${CSS.escape(shotName)}"]`);
    if (!panel) return;
    const shot = dashboardData.assets.find(s => s.name === shotName);
    if (!shot) return;
    const isExcluded = shot.excluded || false;
    panel.innerHTML = buildDetailPanelHTML(shot, isExcluded);
}

function toggleShowArchived(shotName) {
    window[`_showArchived_${shotName}`] = !window[`_showArchived_${shotName}`];
    patchDetailPanel(shotName);
}

// v4: when filtering or sorting changes which rows show (or their order), rows glide instead of popping:
// staying rows slide to their new spot, new rows fade in, removed rows fade out where they were.
const _ROW_MOTION = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function _visibleRows(tbody) {
    return [...tbody.querySelectorAll('tr[data-shot-key]')].filter(r => !r.classList.contains('detail-row'));
}
function _ghostRow(tr) {   // a fading copy of a removed row, drawn where it was
    const rect = tr.getBoundingClientRect();
    if (!rect.height || rect.bottom < 0 || rect.top > innerHeight) return;   // only rows you can see
    const table = document.createElement('table');
    table.className = 'shots-table row-ghost';
    table.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;margin:0;table-layout:fixed;pointer-events:none;z-index:5;transition:opacity .22s ease, transform .22s ease;`;
    const copy = tr.cloneNode(true);
    [...tr.children].forEach((td, i) => { if (copy.children[i]) copy.children[i].style.width = td.getBoundingClientRect().width + 'px'; });
    const body = document.createElement('tbody'); body.appendChild(copy); table.appendChild(body);
    document.body.appendChild(table);
    void table.offsetHeight;
    table.style.opacity = '0'; table.style.transform = 'translateX(-14px)';
    setTimeout(() => table.remove(), 260);
}

function renderTable(skipAnimation) {
    const activeBody = document.getElementById('shotsBody');
    const oldActiveKeys = _previousKeys;

    const active = getSortedShots(getActiveShots());
    let html = '';
    const newActiveKeys = new Set();
    for (const shot of active) {
        const rowHtml = renderShotRow(shot, false);
        if (rowHtml) { newActiveKeys.add(shot.name); html += rowHtml; }
    }

    // Measure before redrawing, so rows can move from where they were
    const oldRows = _ROW_MOTION ? _visibleRows(activeBody) : [];
    const oldOrder = oldRows.map(r => r.dataset.shotKey);
    const newOrder = [...newActiveKeys];
    const overlap = oldOrder.some(k => newActiveKeys.has(k));            // none = a different project: no motion
    const changed = oldOrder.length !== newOrder.length || oldOrder.some((k, i) => k !== newOrder[i]);
    const glide = _ROW_MOTION && overlap && changed;
    const oldTops = new Map();
    if (glide) {
        oldRows.forEach(r => oldTops.set(r.dataset.shotKey, r.getBoundingClientRect().top));
        oldRows.filter(r => !newActiveKeys.has(r.dataset.shotKey)).forEach(_ghostRow);
    }

    activeBody.innerHTML = html || '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:2rem;">No assets found</td></tr>';

    if (glide) {
        const moving = [];
        _visibleRows(activeBody).forEach(r => {
            const k = r.dataset.shotKey;
            if (oldTops.has(k)) {
                const dy = oldTops.get(k) - r.getBoundingClientRect().top;
                if (Math.abs(dy) < 1) return;
                r.style.transition = 'none'; r.style.transform = `translateY(${dy}px)`;
            } else {
                r.style.transition = 'none'; r.style.opacity = '0'; r.style.transform = 'translateY(-6px)';
            }
            moving.push(r);
        });
        void activeBody.offsetHeight;   // commit the start positions, then let them glide home
        moving.forEach(r => { r.style.transition = 'transform .26s ease, opacity .26s ease'; r.style.transform = ''; r.style.opacity = ''; });
        setTimeout(() => moving.forEach(r => { r.style.transition = ''; }), 320);
    }

    if (expandedShot) _openDetailRowAnimation(activeBody);
    renderFloatingStars(); renderFloatingDone();

    if (!glide && !skipAnimation && oldActiveKeys.size > 0) {
        for (const row of activeBody.children) {
            const key = row.dataset?.shotKey;
            if (key && !oldActiveKeys.has(key) && !row.classList.contains('detail-row')) {
                row.classList.add('shot-row-enter');
                row.addEventListener('animationend', () => row.classList.remove('shot-row-enter'), { once: true });
            }
        }
    }
    _previousKeys = newActiveKeys;

    const excluded = getSortedShots(getExcludedShots());
    const exSection = document.getElementById('excludedSection');
    if (excluded.length) {
        exSection.style.display = 'block';
        const oldExKeys = _previousExcludedKeys;
        let exHtml = '';
        const newExKeys = new Set();
        for (const shot of excluded) {
            const rowHtml = renderShotRow(shot, true);
            if (rowHtml) { newExKeys.add(shot.name); exHtml += rowHtml; }
        }
        const isOpen = _excludedExpanded;
        exSection.innerHTML = `
            <div class="excluded-toggle ${isOpen ? 'open' : ''}" onclick="toggleExcludedSection()">
                <span class="ex-arrow">▶</span>
                <span>${excluded.length} excluded asset${excluded.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="excluded-body-wrap ${isOpen ? 'open' : ''}">
                <table class="shots-table" style="margin-top:0.5rem;"><tbody id="excludedBody">${exHtml}</tbody></table>
            </div>`;
        if (!skipAnimation && oldExKeys.size > 0) {
            const excludedBody = document.getElementById('excludedBody');
            if (excludedBody) for (const row of excludedBody.children) {
                const key = row.dataset?.shotKey;
                if (key && !oldExKeys.has(key) && !row.classList.contains('detail-row')) {
                    row.classList.add('shot-row-enter');
                    row.addEventListener('animationend', () => row.classList.remove('shot-row-enter'), { once: true });
                }
            }
        }
        _previousExcludedKeys = newExKeys;
    } else {
        exSection.style.display = 'none';
        _previousExcludedKeys = new Set();
    }
}

function _openDetailRowAnimation(tbody) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const detailRow = tbody?.querySelector('.detail-row');
            if (detailRow) {
                const wrap = detailRow.querySelector('.detail-row-wrap');
                // Keep hidden during animation to prevent overlap
                if (wrap) { wrap.style.overflow = 'hidden'; }
                detailRow.classList.add('open');
                setTimeout(() => {
                    // Switch to visible so dropdowns can escape the container
                    if (wrap) wrap.style.overflow = 'visible';
                }, 300);
            }
        });
    });
}

function toggleDetail(name) { expandedShot = expandedShot === name ? null : name; renderTable(true); }

// Detail-panel chip + star actions (shared by dashboard and library panels)
async function detailSetStatus(name, sn) {
    const shot = dashboardData.assets.find(a => a.name === name);
    if (!shot) return;
    shot.status = sn;
    await saveMeta(shot);
    renderStats(); patchRow(name); patchDetailPanel(name);
}

async function detailSetDifficulty(name, dn) {
    const shot = dashboardData.assets.find(a => a.name === name);
    if (!shot) return;
    shot.difficulty = dn;
    await saveMeta(shot);
    renderStats(); patchRow(name); patchDetailPanel(name);
}

async function detailToggleStar(name) {
    const shot = dashboardData.assets.find(a => a.name === name);
    if (!shot) return;
    shot.starred = !shot.starred;
    await saveMeta(shot);
    const tr = document.querySelector(`tr[data-shot-key="${CSS.escape(name)}"]`);
    if (tr) tr.classList.toggle('starred-row', shot.starred);
    const btn = document.getElementById(`star-btn-${name}`);
    if (btn) {
        btn.classList.toggle('star-active', shot.starred);
        btn.textContent = shot.starred ? '★ Starred' : '☆ Star';
        btn.title = shot.starred ? 'Unstar' : 'Star';
    }
}
function toggleExcludedSection() { _excludedExpanded = !_excludedExpanded; renderTable(true); }

