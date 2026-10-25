// ---------------------------------------------------------------------------
// Bulk Selection
// ---------------------------------------------------------------------------
let bulkSelected = new Set();
let _dragSelecting = false;
let _dragStartX = 0, _dragStartY = 0;
const DRAG_THRESHOLD = 5;
let _dragPastThreshold = false;
let _dragTargetIsLib = false;

function handleRowMousedown(e, name, isLib) {
    // Don't interfere with right-click, checkbox, or buttons
    if (e.button !== 0) return;
    if (e.target.closest('input,button,select,textarea,.custom-check-wrap')) return;

    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl) {
        e.preventDefault();
        // Toggle the clicked row immediately (handles plain ctrl+click with no drag)
        if (bulkSelected.has(name)) bulkSelected.delete(name);
        else bulkSelected.add(name);
        refreshBulkUI(isLib);
    }

    _dragStartX = e.clientX; _dragStartY = e.clientY;
    _dragPastThreshold = false;
    _dragSelecting = true;
    _dragTargetIsLib = isLib;

    const onMove = (me) => {
        if (!_dragSelecting) return;
        const dx = me.clientX - _dragStartX, dy = me.clientY - _dragStartY;
        if (!_dragPastThreshold && (dx*dx + dy*dy) < DRAG_THRESHOLD*DRAG_THRESHOLD) return;
        if (!_dragPastThreshold) {
            _dragPastThreshold = true;
            document.body.classList.add('bulk-dragging');
            if (!isCtrl) {
                // Without ctrl: start a fresh selection from this row
                bulkSelected.clear();
            }
            // Ensure the drag-start row is always included
            bulkSelected.add(name);
        }
        // Find row under cursor and add it to selection
        const el = document.elementFromPoint(me.clientX, me.clientY);
        const tr = el?.closest('tr[data-shot-key], tr[data-lib-key]');
        if (tr) {
            const key = tr.dataset.shotKey || tr.dataset.libKey;
            if (key && !tr.classList.contains('detail-row') && !tr.classList.contains('excluded-row')) {
                bulkSelected.add(key);
            }
        }
        refreshBulkUI(_dragTargetIsLib);
    };

    const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.classList.remove('bulk-dragging');
        _dragSelecting = false;
        if (!_dragPastThreshold && !isCtrl) {
            // Was a plain click (no ctrl, no drag) — clear selection and do normal expand
            if (bulkSelected.size > 0) { clearBulkSelection(); }
        }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function handleRowClick(e, name, isLib) {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); return; } // handled in mousedown
    if (_dragPastThreshold) { e.preventDefault(); return; } // was a drag
    if (bulkSelected.size > 0) return; // don't expand when in selection mode
    // Normal click — expand detail
    if (isLib) libToggleDetail(name);
    else toggleDetail(name);
}

// Star ★ and done ✓ markers are now rendered by pure CSS on the rows
// themselves (.starred-row / .done-row pseudo-elements in dashboard.css),
// so they scroll natively with the table — no repositioning, no lag.
// These stubs remain so legacy call sites are harmless.
function renderFloatingStars() {}
function renderFloatingDone() {}

function refreshBulkUI(isLib) {
    // Highlight rows
    const selector = isLib ? '#libTableBody tr' : '#shotsBody tr';
    document.querySelectorAll(selector).forEach(tr => {
        const key = tr.dataset.shotKey || tr.dataset.libKey;
        if (key) tr.classList.toggle('bulk-selected', bulkSelected.has(key));
    });

    // Selection highlight (left accent bar + glow) is pure CSS on
    // tr.bulk-selected — see dashboard.css. No floating overlays.

    // Update action bar — docked at bottom-center of the viewport
    const bar = document.getElementById('bulkBar');
    if (bulkSelected.size > 0) {
        bar.classList.add('open');
        document.getElementById('bulkCount').textContent = bulkSelected.size + ' selected';
        // Exclusion is a dashboard-only concept
        const exBtn = document.getElementById('bulkExcludeBtn');
        if (exBtn) exBtn.style.display = isLib ? 'none' : '';
        bar.style.position = 'fixed';
        bar.style.top = 'auto';
        bar.style.bottom = '28px';
        bar.style.left = '50%';
        bar.style.transform = 'translateX(-50%)';
    } else {
        bar.classList.remove('open');
        closeBulkDropdown();
    }
}

function clearBulkSelection() {
    bulkSelected.clear();
    document.querySelectorAll('tr.bulk-selected').forEach(tr => tr.classList.remove('bulk-selected'));
    document.getElementById('bulkBar').classList.remove('open');
    closeBulkDropdown();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && bulkSelected.size > 0 && !document.getElementById('libraryModal').classList.contains('open')) clearBulkSelection(); });

// Deselect when clicking outside rows or the bulk action bar
document.addEventListener('mousedown', e => {
    if (bulkSelected.size === 0) return;
    const onRow = e.target.closest('tr[data-shot-key], tr[data-lib-key]');
    const onBulkBar = e.target.closest('#bulkBar, #bulkDropdown');
    if (!onRow && !onBulkBar) clearBulkSelection();
});

// Bulk dropdowns
let _bulkDropdownType = null;

function openBulkDropdown(type) {
    const dd = document.getElementById('bulkDropdown');
    const bar = document.getElementById('bulkBar');
    _bulkDropdownType = type;
    let html = '';

    if (type === 'status') {
        const statuses = dashboardData.custom_statuses || [];
        html = `<div class="ctx-chips" style="padding:0.4rem 0.6rem;">` + statuses.map(s => {
            const sn = statusName(s), sc = statusColor(s);
            return `<button class="ctx-chip" onclick="bulkSetStatus('${esc(sn)}')" style="border-color:${sc}55;color:${sc};">${esc(sn)}</button>`;
        }).join('') + `</div>`;
    } else if (type === 'difficulty') {
        const diffs = dashboardData.custom_difficulties || [];
        html = `<div class="ctx-chips" style="padding:0.4rem 0.6rem;">` +
            `<button class="ctx-chip" onclick="bulkSetDifficulty('')" style="color:var(--text-muted);">—</button>` +
            diffs.map(d => {
                const dn = statusName(d), dc = statusColor(d);
                return `<button class="ctx-chip" onclick="bulkSetDifficulty('${esc(dn)}')" style="border-color:${dc}55;color:${dc};">${esc(dn)}</button>`;
            }).join('') + `</div>`;
    } else if (type === 'progress') {
        html = `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;">
            <input type="range" id="bulkProgress" min="0" max="100" value="50" style="flex:1;"
                oninput="document.getElementById('bulkProgressPct').textContent=this.value+'%'">
            <span id="bulkProgressPct" class="ctx-pct">50%</span>
            <button class="btn-sm" onclick="bulkSetProgress(parseInt(document.getElementById('bulkProgress').value))">Apply</button>
        </div>`;
    } else if (type === 'assignee') {
        html = currentProjectRole() !== 'Lead'
            ? `<div class="bulk-dropdown-item" style="color:var(--text-muted);cursor:default;">Only the lead can reassign several at once</div>`
            : peopleOptions(projectPeople().map(p => p.name), 'Unassigned').map(o => `<div class="bulk-dropdown-item" onclick="bulkSetAssignee('${esc(o.value)}')">${esc(o.label)}</div>`).join('');
    } else if (type === 'playlist') {
        const pls = dashboardPlaylists.filter(p => !p.archived);
        html = pls.map(p => `<div class="bulk-dropdown-item" onclick="bulkAddToPlaylist('${esc(p.filename)}','${esc(p.name)}')">${esc(p.name)} (${p.asset_count})</div>`).join('');
        html += `<div class="bulk-dropdown-item" style="color:var(--accent);" onclick="bulkNewPlaylist()">+ New playlist</div>`;
    } else if (type === 'due_date') {
        html = `<div class="bulk-dropdown-item" style="padding:0.4rem 0.75rem;">
            <button class="btn-sm" style="width:100%;font-size:0.7rem;" onclick="openDatePicker(v=>{ if(v) bulkSetDueDate(v); }, '', document.getElementById('bulkDueBtn'))">Pick Date…</button>
        </div>
        <div class="bulk-dropdown-item" onclick="bulkSetDueDate('')" style="color:var(--text-muted);">— Clear</div>`;
    }

    // Position dropdown above the triggering button
    const btn = document.getElementById(type === 'status' ? 'bulkStatusBtn' : type === 'difficulty' ? 'bulkDiffBtn' : type === 'assignee' ? 'bulkAssignBtn' : type === 'due_date' ? 'bulkDueBtn' : type === 'progress' ? 'bulkProgBtn' : 'bulkPlBtn');
    const barRect = bar.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    dd.style.left = (btnRect.left - barRect.left) + 'px';

    dd.innerHTML = html;
    dd.classList.add('open');
    if (type === 'assignee') addDropdownSearch(dd, '.bulk-dropdown-item');
}

function closeBulkDropdown() {
    document.getElementById('bulkDropdown').classList.remove('open');
    _bulkDropdownType = null;
}

// Close dropdown on outside click
document.addEventListener('click', e => {
    if (_bulkDropdownType && !e.target.closest('#bulkBar')) closeBulkDropdown();
});

async function _bulkPersist(shot) { await saveMeta(shot); }

function _getBulkShots() {
    return dashboardData.assets.filter(s => bulkSelected.has(s.name));
}

function _bulkRefresh() {
    const isLib = document.getElementById('libraryModal').classList.contains('open');
    if (isLib) renderLibBody();
    else { renderStats(); renderFilters(); renderTable(true); }
    refreshBulkUI(isLib);
    renderFloatingStars(); renderFloatingDone();
}

async function bulkSetStatus(sn) {
    closeBulkDropdown();
    const shots = _getBulkShots();
    for (const shot of shots) { shot.status = sn; await _bulkPersist(shot); }
    showToast(`Status → ${sn} for ${shots.length} asset${shots.length !== 1 ? 's' : ''}`);
    _bulkRefresh();
}

async function bulkSetDifficulty(dn) {
    closeBulkDropdown();
    const shots = _getBulkShots();
    for (const shot of shots) { shot.difficulty = dn; await _bulkPersist(shot); }
    showToast(`Difficulty updated for ${shots.length} asset${shots.length !== 1 ? 's' : ''}`);
    _bulkRefresh();
}

async function bulkSetAssignee(name) {
    closeBulkDropdown();
    const shots = _getBulkShots();
    for (const shot of shots) { shot.assignee = name; await _bulkPersist(shot); }
    showToast(`Assignee → ${name || 'none'} for ${shots.length} asset${shots.length !== 1 ? 's' : ''}`);
    _bulkRefresh();
}

async function bulkSetDueDate(date) {
    closeBulkDropdown();
    const shots = _getBulkShots();
    for (const shot of shots) { shot.due_date = date; await _bulkPersist(shot); }
    showToast(date ? `Due date → ${date} for ${shots.length} asset${shots.length !== 1 ? 's' : ''}` : `Due date cleared for ${shots.length} asset${shots.length !== 1 ? 's' : ''}`);
    _bulkRefresh();
}

async function bulkSetProgress(pct) {
    closeBulkDropdown();
    const shots = _getBulkShots();
    for (const shot of shots) {
        shot.completion = pct;
        const autoStatus = applyAutoStatus(shot);
        if (autoStatus) shot.status = autoStatus;
        await _bulkPersist(shot);
    }
    showToast(`Progress → ${pct}% for ${shots.length} asset${shots.length !== 1 ? 's' : ''}`);
    _bulkRefresh();
}


async function bulkToggleExclude() {
    const shots = _getBulkShots();
    const allExcluded = shots.every(s => s.excluded);
    for (const shot of shots) { shot.excluded = !allExcluded; await _bulkPersist(shot); }
    showToast(`${allExcluded ? 'Included' : 'Excluded'} ${shots.length} asset${shots.length !== 1 ? 's' : ''}`);
    clearBulkSelection();
    expandedShot = null;
    renderAll();
}

async function bulkToggleStar() {
    const shots = _getBulkShots();
    const allStarred = shots.every(s => s.starred);
    for (const shot of shots) { shot.starred = !allStarred; await _bulkPersist(shot); }
    showToast(`${allStarred ? 'Unstarred' : 'Starred'} ${shots.length} asset${shots.length !== 1 ? 's' : ''}`);
    _bulkRefresh();
}

async function bulkToggleDone() {
    const shots = _getBulkShots();
    const allDone = shots.every(s => s.done);
    for (const shot of shots) { shot.done = !allDone; await _bulkPersist(shot); }
    showToast(`${allDone ? 'Unmarked' : 'Marked done'} ${shots.length} asset${shots.length !== 1 ? 's' : ''}`);
    _bulkRefresh();
}

async function bulkAddToPlaylist(filename, playlistName) {
    closeBulkDropdown();
    const shots = _getBulkShots();
    const data = await api('/api/playlist?path=' + encodeURIComponent(dashboardData.root_path) + '&file=' + encodeURIComponent(filename));
    const assets = data.assets || data.shots || [];
    let added = 0;
    for (const shot of shots) {
        if (!assets.find(a => (a.asset_name || a) === shot.name)) { assets.push(shot.name); added++; }
    }
    if (added) {
        await api('/api/playlist/save', { root_path: dashboardData.root_path, filename, name: playlistName, assets });
        showToast(`Added ${added} to "${playlistName}"`);
    } else { showToast('All already in playlist'); }
    await loadDashboardPlaylists();
}

async function bulkNewPlaylist() {
    closeBulkDropdown();
    const name = prompt('New playlist name:');
    if (!name) return;
    const shots = _getBulkShots();
    await api('/api/playlist/create', { root_path: dashboardData.root_path, name, assets: shots.map(s => s.name) });
    await loadDashboardPlaylists();
    showToast(`Created "${name}" with ${shots.length} asset${shots.length !== 1 ? 's' : ''}`);
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------
let _ctxShotName = null;

function showCtxMenu(e, shotName) {
    e.preventDefault(); e.stopPropagation();
    _ctxShotName = shotName;
    const shot = dashboardData.assets.find(s => s.name === shotName);
    if (!shot) return;

    document.getElementById('ctxTitle').textContent = shotName;
    _ctxSyncToggles(shot);
    document.getElementById('ctxDeletePlanned').style.display = shot.planned && canReassign(shot) ? '' : 'none';
    document.getElementById('ctxOpenFile').style.display = shot.planned ? 'none' : '';
    document.getElementById('ctxOpenFolder').style.display = shot.planned ? 'none' : '';
    _ctxRenderStatusChips(shot.status);
    _ctxRenderDifficultyChips(shot.difficulty);

    const pct = shot.completion || 0;
    document.getElementById('ctxCompletion').value = pct;
    document.getElementById('ctxPct').textContent = pct + '%';

    document.getElementById('ctxPlItems').style.display = '';
    document.getElementById('ctxPlNew').style.display = 'none';
    _ctxRenderPlaylistItems();

    const _canAssign = projectPeople().length && canReassign(shot);
    const _ctxAssigneeContainer = document.getElementById('ctxAssigneeSelect');
    if (_ctxAssigneeContainer && _canAssign) {
        _ctxAssigneeContainer.innerHTML = makeCustomSelect('ctxAssignee', peopleOptions(projectPeople().map(p => p.name), 'Unassigned'), shot.assignee||'', v=>ctxSetAssignee(v), true);
    }
    if (!_canAssign) document.getElementById('ctxAssigneeWrap').style.display = 'none';
    else document.getElementById('ctxAssigneeWrap').style.display = 'block';

    // Due date
    document.getElementById('ctxDueDate').textContent = shot.due_date || '—';
    document.getElementById('ctxDueClear').style.display = shot.due_date ? '' : 'none';

    // Open file / folder — only when the asset has a file on disk
    const hasFile = !!shot.last_file;
    document.getElementById('ctxOpenFile').style.display = hasFile ? '' : 'none';
    document.getElementById('ctxOpenFolder').style.display = hasFile ? '' : 'none';

    // Exclude / Include (hidden in library — exclusion is a dashboard concept)
    const exEl = document.getElementById('ctxExclude');
    exEl.style.display = _libCtxActive ? 'none' : '';
    exEl.textContent = shot.excluded ? 'Include' : 'Exclude';

    const menu = document.getElementById('ctxMenu');
    menu.classList.add('open');
    requestAnimationFrame(() => {
        const vw = window.innerWidth, vh = window.innerHeight;
        let x = e.clientX + 6, y = e.clientY + 6;
        const mw = menu.offsetWidth, mh = menu.offsetHeight;
        if (x + mw > vw - 8) x = e.clientX - mw - 4;
        if (y + mh > vh - 8) y = vh - mh - 8;
        menu.style.left = x + 'px'; menu.style.top = y + 'px';
    });
}

function _ctxSyncToggles(shot) {
    const starBtn = document.getElementById('ctxStarBtn');
    const doneBtn = document.getElementById('ctxDoneBtn');
    starBtn.textContent = shot.starred ? '★ Starred' : '☆ Star';
    starBtn.classList.toggle('star-active', !!shot.starred);
    doneBtn.textContent = shot.done ? '✓ Done' : '✓ Done';
    doneBtn.classList.toggle('done-active', !!shot.done);
}

function _ctxRenderStatusChips(activeStatus) {
    const statuses = dashboardData.custom_statuses || [];
    document.getElementById('ctxStatusChips').innerHTML = statuses.map(s => {
        const sn = statusName(s), sc = statusColor(s);
        const isActive = activeStatus === sn;
        return `<button class="ctx-chip${isActive?' active':''}" onclick="ctxSetStatus('${esc(sn)}')" style="${isActive?`background:${sc};border-color:${sc};color:#fff;`:`border-color:${sc}55;color:${sc};`}">${esc(sn)}</button>`;
    }).join('');
}

function _ctxRenderDifficultyChips(activeDiff) {
    const diffs = dashboardData.custom_difficulties || [];
    const noActive = !activeDiff;
    document.getElementById('ctxDifficultyChips').innerHTML =
        `<button class="ctx-chip${noActive?' active':''}" onclick="ctxSetDifficulty('')" style="${noActive?'background:var(--border-light);border-color:var(--border-light);color:var(--text-primary);':''}">—</button>` +
        diffs.map(d => {
            const dn = statusName(d), dc = statusColor(d);
            const isActive = activeDiff === dn;
            return `<button class="ctx-chip${isActive?' active':''}" onclick="ctxSetDifficulty('${esc(dn)}')" style="${isActive?`background:${dc};border-color:${dc};color:#fff;`:`border-color:${dc}55;color:${dc};`}">${esc(dn)}</button>`;
        }).join('');
}

function hideCtxMenu() {
    document.getElementById('ctxMenu').classList.remove('open');
    _ctxShotName = null;
}

async function _ctxPersist(fullRender = false) {
    const name = _ctxShotName;   // the menu usually closes (clearing _ctxShotName) before the save comes back
    const shot = dashboardData.assets.find(s => s.name === name);
    if (!shot) return;
    shot.completion = parseInt(document.getElementById('ctxCompletion').value || '0');
    const autoStatus = applyAutoStatus(shot);
    if (autoStatus) { shot.status = autoStatus; _ctxRenderStatusChips(shot.status); fullRender = true; }
    await saveMeta(shot);
    if (_libCtxActive) { renderLibBody(); }
    else if (fullRender) { renderStats(); renderFilters(); renderTable(true); }
    else { renderStats(); patchRow(name); }
}

function ctxAutoSave() { if (_ctxShotName) { _ctxPersist(); hideCtxMenu(); } }

function ctxSetAssignee(name) {
    if (!_ctxShotName) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    if (!shot) return;
    shot.assignee = name;
    _ctxPersist();
    hideCtxMenu();
}

function ctxPickDueDate(anchorEl) {
    if (!_ctxShotName) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    if (!shot) return;
    openDatePicker(v => {
        shot.due_date = v || '';
        document.getElementById('ctxDueDate').textContent = shot.due_date || '—';
        document.getElementById('ctxDueClear').style.display = shot.due_date ? '' : 'none';
        _ctxPersist();
        hideCtxMenu();
    }, shot.due_date || '', anchorEl);
}

function ctxClearDueDate() {
    if (!_ctxShotName) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    if (!shot) return;
    shot.due_date = '';
    document.getElementById('ctxDueDate').textContent = '—';
    document.getElementById('ctxDueClear').style.display = 'none';
    _ctxPersist();
    hideCtxMenu();
}

function ctxOpenFile() {
    if (!_ctxShotName) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    hideCtxMenu();
    if (shot && shot.last_file) openFile(shot.last_file);
}

function ctxOpenFolder() {
    if (!_ctxShotName) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    hideCtxMenu();
    if (shot && shot.last_file) openFileFolder(shot.last_file);
}

function ctxToggleExclude() {
    if (!_ctxShotName) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    const name = _ctxShotName;
    hideCtxMenu();
    if (shot) toggleExclude(name, !shot.excluded);
}

function setAssigneeFilter(name) {
    activeAssigneeFilter = name || null;
    renderAll();
}

const _lastPointer = { x: 0, y: 0 };
document.addEventListener('mousemove', e => { _lastPointer.x = e.clientX; _lastPointer.y = e.clientY; }, { passive: true });
function showAssigneeTooltip(e, row) {
    const name = row.dataset.assignee;
    const color = row.dataset.assigneeColor || 'var(--accent)';
    if (!name) return;
    const tip = document.getElementById('assigneeTooltip');
    tip.textContent = 'Assigned to: ' + name;
    tip.style.borderColor = color;
    tip.style.color = color;
    tip.style.display = 'block';
    moveAssigneeTooltip(e);
}
function moveAssigneeTooltip(e) {
    const tip = document.getElementById('assigneeTooltip');
    const th = tip.offsetHeight || 24;
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top = (e.clientY - Math.round(th / 2)) + 'px';
}
function hideAssigneeTooltip() {
    document.getElementById('assigneeTooltip').style.display = 'none';
}

function ctxToggleStar() {
    if (!_ctxShotName) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    if (!shot) return;
    shot.starred = !shot.starred;
    _ctxSyncToggles(shot);
    _ctxPersist(true);
    hideCtxMenu();
}

function ctxToggleDone() {
    if (!_ctxShotName) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    if (!shot) return;
    shot.done = !shot.done;
    _ctxSyncToggles(shot);
    _ctxPersist(true);
    hideCtxMenu();
}

function ctxSetStatus(sn) {
    if (!_ctxShotName) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    if (!shot) return;
    shot.status = sn;
    _ctxRenderStatusChips(sn);
    _ctxPersist(true);
    hideCtxMenu();
}

function ctxSetDifficulty(dn) {
    if (!_ctxShotName) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    if (!shot) return;
    shot.difficulty = dn;
    _ctxRenderDifficultyChips(dn);
    _ctxPersist(true);
    hideCtxMenu();
}

function _ctxRenderPlaylistItems() {
    const container = document.getElementById('ctxPlItems');
    if (!container) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    const activePls = dashboardPlaylists.filter(p => !p.archived);

    if (!activePls.length) {
        container.innerHTML = `<div class="ctx-item ctx-item-new" onclick="ctxShowNewPlaylist()"><span>+</span> New Playlist…</div>`;
        return;
    }

    let html = activePls.map(p => {
        const alreadyIn = p.assets && shot && p.assets.includes(shot.name);
        if (alreadyIn) {
            return `<div class="ctx-item ctx-item-muted"><span style="color:#4ade80;">✓</span>${esc(p.name)}<span class="ctx-item-count">${p.asset_count || 0}</span></div>`;
        }
        return `<div class="ctx-item" onclick="ctxAddToPlaylist('${esc(p.filename)}','${esc(p.name)}')">
            <span style="color:var(--accent);">▶</span>${esc(p.name)}<span class="ctx-item-count">${p.asset_count || 0}</span>
        </div>`;
    }).join('');

    html += `<div class="ctx-item ctx-item-new" onclick="ctxShowNewPlaylist()"><span>+</span> New Playlist…</div>`;
    container.innerHTML = html;
}

function ctxShowNewPlaylist() {
    document.getElementById('ctxPlItems').style.display = 'none';
    const newRow = document.getElementById('ctxPlNew');
    newRow.style.display = 'flex';
    const inp = document.getElementById('ctxPlNewName');
    inp.value = '';
    setTimeout(() => inp.focus(), 30);
}

async function ctxAddToPlaylist(filename, playlistName) {
    if (!_ctxShotName) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    if (!shot) return;
    const pl = dashboardPlaylists.find(p => p.filename === filename);
    const assets = pl ? [...(pl.assets || [])] : [];
    if (!assets.includes(shot.name)) {
        assets.push(shot.name);
        await api('/api/playlist/save', { root_path: dashboardData.root_path, filename, name: playlistName, assets });
        showToast(`Added to "${playlistName}"`);
    } else {
        showToast(`Already in "${playlistName}"`);
    }
    hideCtxMenu();
    await loadDashboardPlaylists();
}

async function ctxConfirmNewPlaylist() {
    if (!_ctxShotName) return;
    const name = document.getElementById('ctxPlNewName').value.trim();
    if (!name) return;
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    if (shot) {
        await api('/api/playlist/create', { root_path: dashboardData.root_path, name, assets: [shot.name] });
        await loadDashboardPlaylists();
        showToast(`Created "${name}"`);
    }
    hideCtxMenu();
}

function ctxCancelNewPlaylist() {
    document.getElementById('ctxPlNew').style.display = 'none';
    document.getElementById('ctxPlItems').style.display = '';
    _ctxRenderPlaylistItems();
}

// ---------------------------------------------------------------------------
// Asset actions
// ---------------------------------------------------------------------------
async function quickToggleDone(name, done) {
    const shot = dashboardData.assets.find(s => s.name === name);
    if (shot) {
        shot.done = done;
        await saveMeta(shot);
        renderStats(); renderTable(true);
        showToast(done ? `Done: ${name}` : `Unmarked: ${name}`);
    }
}

function applyAutoStatus(shot) {
    if (!dashboardData.auto_status_enabled) return null;
    const rules = dashboardData.auto_status_rules || [];
    if (!rules.length) return null;
    const pct = shot.completion || 0;
    const sorted = [...rules].sort((a, b) => b.threshold - a.threshold);
    for (const r of sorted) { if (pct >= r.threshold) return r.status; }
    return null;
}

async function autoSave(name) {
    const shot = dashboardData.assets.find(s => s.name === name);
    // Status/difficulty are set as chips directly on the shot object;
    // fall back to hidden inputs if present (legacy), then current values.
    let status = document.getElementById(`status-${name}`)?.value ?? shot?.status ?? '';
    const difficulty = document.getElementById(`difficulty-${name}`)?.value ?? shot?.difficulty ?? '';
    const completion = parseInt(document.getElementById(`completion-${name}`)?.value || '0');
    const notes = document.getElementById(`notes-${name}`)?.value || '';
    // Due date is now set directly on shot.due_date by the calendar picker callback;
    // fall back to reading the display span text, then the existing shot value.
    const dueDateInput = document.getElementById(`duedate-${name}`);
    const dueDateDisplay = document.getElementById(`duedate-display-${name}`);
    const due_date = dueDateInput?.value || (dueDateDisplay && dueDateDisplay.textContent !== '—' ? dueDateDisplay.textContent : '') || shot?.due_date || '';
    const done = shot?.done || false;
    if (shot) {
        shot.difficulty = difficulty; shot.completion = completion; shot.notes = notes; shot.due_date = due_date; shot.done = done;
        const autoStatus = applyAutoStatus(shot);
        if (autoStatus) status = autoStatus;
        shot.status = status;
    }
    await saveMeta(shot);
    renderStats(); patchRow(name); showToast(`Saved: ${name}`);
}

function patchRow(name) {
    const shot = dashboardData.assets.find(s => s.name === name);
    if (!shot) return;
    const tr = document.querySelector(`tr[data-shot-key="${CSS.escape(name)}"]`);
    if (!tr) return;
    const cells = tr.querySelectorAll('td');
    if (cells.length < 9) return;
    // col 4: status badge
    const sc = getStatusColor(shot.status);
    cells[4].innerHTML = `<span class="status-badge" style="${colorBadgeStyle(sc)}">${esc(shot.status || '—')}</span>`;
    // col 5: difficulty
    cells[5].innerHTML = renderDifficultyCell(shot);
    // col 6: progress
    cells[6].innerHTML = renderProgressCell(shot.completion || 0);
    // col 7: due date
    cells[7].innerHTML = renderDueDateCell(shot);
    // assignee data attrs + hover handlers
    const assignee = shot.assignee || '';
    const assigneeColor = assignee ? personColor(assignee) : 'var(--accent)';
    if (assignee) {
        tr.dataset.assignee = assignee;
        tr.dataset.assigneeColor = assigneeColor;
        tr.onmouseenter = (e) => showAssigneeTooltip(e, tr);
        tr.onmousemove  = (e) => moveAssigneeTooltip(e);
        tr.onmouseleave = () => hideAssigneeTooltip();
    } else {
        delete tr.dataset.assignee;
        delete tr.dataset.assigneeColor;
        tr.onmouseenter = null;
        tr.onmousemove  = null;
        tr.onmouseleave = null;
    }
    tr.style.cssText = rowStyle(shot, tr.classList.contains('excluded-row'));
    // The cursor badge was drawn before this update landed (e.g. right after a context-menu pick): redraw it
    const tip = document.getElementById('assigneeTooltip');
    if (tip && tr.matches(':hover')) {
        if (assignee) showAssigneeTooltip({ clientX: _lastPointer.x, clientY: _lastPointer.y }, tr);
        else tip.style.display = 'none';
    }
}



async function toggleExclude(name, exclude) {
    const shot = dashboardData.assets.find(s => s.name === name);
    if (shot) {
        shot.excluded = exclude;
        await saveMeta(shot);
    }
    expandedShot = null; renderAll(); showToast(exclude ? `Excluded: ${name}` : `Included: ${name}`);
}

async function openFile(filepath) { const r = await api('/api/open_file', { filepath }); if (r.error) showToast('Error: ' + r.error); else showToast('Opened: ' + filepath.split(/[/\\]/).pop()); }
async function openFileFolder(filepath) { const r = await api('/api/open_file', { filepath: parentPath(filepath) }); if (r.error) showToast('Error: ' + r.error); }

// Video
const _videoFpsCache = {};
function initVideoFps(vidId, defaultFps) { _videoFpsCache[vidId] = defaultFps; }
function updateFrameCounter(vidId, frameStart, fps) {
    const vid = document.getElementById(vidId); if (!vid) return;
    const actualFps = _videoFpsCache[vidId] || fps;
    const currentFrame = frameStart + Math.round(vid.currentTime * actualFps);
    const overlay = document.getElementById(vidId + '-overlay');
    const readout = document.getElementById(vidId + '-readout');
    if (overlay) overlay.textContent = 'f' + currentFrame;
    if (readout) readout.textContent = 'Frame: ' + currentFrame;
}
function seekVideoToFrame(vidId, frame, frameStart, fps) {
    const vid = document.getElementById(vidId); if (!vid) return;
    const actualFps = _videoFpsCache[vidId] || fps;
    vid.currentTime = Math.max(0, (frame - frameStart) / actualFps);
    updateFrameCounter(vidId, frameStart, actualFps);
}
function getCurrentVideoFrame(vidId, frameStart, fps) {
    const vid = document.getElementById(vidId); if (!vid) return frameStart;
    return frameStart + Math.round(vid.currentTime * (_videoFpsCache[vidId] || fps));
}

let _pendingFrame = {};
async function attachFrameFromVideo(vidId, shotName, shotType, frameStart, fps) {
    const frame = getCurrentVideoFrame(vidId, frameStart, fps);
    _pendingFrame[shotName] = frame;
    const badge = document.getElementById(`frame-badge-${shotName}`);
    if (badge) badge.textContent = `f${frame} attached`;
    showToast(`Frame ${frame} attached — type note and Send`);
}

// Comments
async function addComment(shotName, shotType) {
    const input = document.getElementById(`comment-input-${shotName}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const frame = _pendingFrame[shotName] != null ? _pendingFrame[shotName] : null;
    const payload = { root_path: dashboardData.root_path, asset_name: shotName, shot_type: shotType, text, user: 'dashboard' };
    if (frame !== null) payload.frame = frame;
    const result = await api('/api/add_comment', payload);
    if (result.error) { showToast('Error: ' + result.error); return; }
    const shot = dashboardData.assets.find(s => s.name === shotName);
    if (shot) {
        if (!shot.comments) shot.comments = [];
        const c = { user: result.user || 'you', text, timestamp: new Date().toISOString().replace('T',' ').substring(0,19) };
        if (frame !== null) c.frame = frame;
        shot.comments.push(c);
    }
    input.value = '';
    delete _pendingFrame[shotName];
    patchDetailPanel(shotName);
    showToast(frame !== null ? `Note added at frame ${frame}` : 'Note added');
}

function openAnnotationLightbox(url) {
    const existing = document.getElementById('annotLightbox');
    if (existing) { existing.remove(); return; }
    const el = document.createElement('div');
    el.id = 'annotLightbox';
    el.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    el.innerHTML = `<img src="${url}" style="max-width:95%;max-height:95%;border-radius:6px;box-shadow:0 0 60px rgba(0,0,0,0.8);">`;
    el.onclick = () => el.remove();
    document.body.appendChild(el);
}

async function resolveComment(shotName, shotType, commentIndex) {
    const result = await api('/api/resolve_comment', { root_path: dashboardData.root_path, asset_name: shotName, shot_type: shotType, comment_index: commentIndex, resolved_by: dashboardData._username || 'dashboard' });
    if (result.error) { showToast('Error: ' + result.error); return; }
    const shot = dashboardData.assets.find(s => s.name === shotName);
    if (shot && shot.comments && shot.comments[commentIndex]) Object.assign(shot.comments[commentIndex], result.comment);
    patchDetailPanel(shotName); showToast('Note resolved');
}

async function archiveComment(shotName, shotType, commentIndex) {
    const result = await api('/api/archive_comment', { root_path: dashboardData.root_path, asset_name: shotName, shot_type: shotType, comment_index: commentIndex });
    if (result.error) { showToast('Error: ' + result.error); return; }
    const shot = dashboardData.assets.find(s => s.name === shotName);
    if (shot && shot.comments && shot.comments[commentIndex]) shot.comments[commentIndex].archived = true;
    patchDetailPanel(shotName); showToast('Note archived');
}

function toggleResolvedComment(shotName, commentIndex) {
    const key = `${shotName}:${commentIndex}`;
    if (resolvedExpanded.has(key)) resolvedExpanded.delete(key); else resolvedExpanded.add(key);
    patchDetailPanel(shotName);
}

async function browseMedia(shotName) {
    openFileBrowser('media', dashboardData.root_path, async path => {
        if (!path) return;
        const shot = dashboardData.assets.find(s => s.name === shotName);
        if (shot) {
            shot.manual_media = path;
            await saveMeta(shot);
            patchDetailPanel(shotName); patchRow(shotName); showToast('Media attached: ' + path.split(/[/\\]/).pop());
        }
    });
}

async function clearMedia(shotName) {
    const shot = dashboardData.assets.find(s => s.name === shotName);
    if (shot) {
        shot.manual_media = '';
        await saveMeta(shot);
        patchDetailPanel(shotName); showToast('Media cleared');
    }
}


// ---------------------------------------------------------------------------
// Planned assets: a lead creates assets before any file exists, so work can be assigned on day one.
// They live only in Relay's data; a file with exactly the same name fills one later.
// ---------------------------------------------------------------------------
// Names follow the Asset Manager scheme PROJ.TYPE.NAME (the version is added by the addon).
// The project code is fixed when the project is set up; you pick a type and type the names.
const ASSET_TYPES = ['CHAR', 'RIG', 'PROP', 'ENV', 'LAY', 'ANIM', 'LIT', 'COMP', 'FX'];
function projectCode() {
    if (!dashboardData) return '';
    return dashboardData.project_code || ((dashboardData.assets.find(a => !a.planned) || dashboardData.assets[0] || {}).name || '').split('.')[0] || '';
}
// Same three fields as the Asset Manager's New asset box: Project · Type · Name.
// Enter (or +) adds the name to the list and keeps Project and Type for the next one.
const _nbLists = {};
function namesBuilderHTML(p, code, types) {
    _nbLists[p] = [];
    return `<div class="nb">
        <label class="nb-field"><span>Project</span><input type="text" id="${p}Proj" value="${esc(code || '')}" maxlength="10" spellcheck="false" ${p === 'np' || code ? 'readonly' : ''} oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')"></label>
        <label class="nb-field"><span>Type</span><input type="text" id="${p}Type" list="${p}Types" maxlength="16" spellcheck="false" placeholder="e.g. ANIM, RIG, CHAR" oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9_]/g,'')">
            <datalist id="${p}Types">${types.map(t => `<option value="${esc(t)}">`).join('')}</datalist></label>
        <label class="nb-field"><span>Name</span><span class="nb-inline"><input type="text" id="${p}Name" spellcheck="false" placeholder="e.g. SQ040_SH050, Mei" onkeydown="if(event.key==='Enter'){event.preventDefault();namesBuilderAdd('${p}');}">
            <button type="button" class="btn-sm" onclick="namesBuilderAdd('${p}')" aria-label="Add to the list">+</button></span></label>
        <div class="nb-list" id="${p}List"></div></div>`;
}
function namesBuilderAdd(p) {
    const proj = document.getElementById(p + 'Proj').value.trim(), type = document.getElementById(p + 'Type').value.trim();
    const nmEl = document.getElementById(p + 'Name'), nm = nmEl.value.trim().replace(/\s+/g, '_');
    if (!proj || !type || !nm) { showToast(!proj ? 'Add a project code' : !type ? 'Add a type' : 'Add a name'); return; }
    if (nm.includes('.')) { showToast('Names can\'t contain dots'); return; }
    const full = `${proj}.${type}.${nm}`;
    if (p === 'pb' && dashboardData.assets.some(a => a.name === full)) { showToast(`${full} already exists`); return; }
    if (!_nbLists[p].includes(full)) _nbLists[p].push(full);
    nmEl.value = ''; nmEl.focus();
    _nbRenderList(p);
}
function namesBuilderRemove(p, i) { _nbLists[p].splice(i, 1); _nbRenderList(p); }
function _nbRenderList(p) {
    document.getElementById(p + 'List').innerHTML = _nbLists[p].map((n, i) =>
        `<span>${esc(n)}<b onclick="namesBuilderRemove('${p}',${i})" title="Remove" role="button" aria-label="Remove ${esc(n)}">×</b></span>`).join('');
    const btn = document.getElementById(p + 'Submit'); if (btn) btn.textContent = _nbLists[p].length ? `Add ${_nbLists[p].length}` : 'Add';
}
function namesBuilderRead(p) {   // the list, plus a name still sitting in the field
    const pending = document.getElementById(p + 'Name').value.trim();
    if (pending) namesBuilderAdd(p);
    return (_nbLists[p] || []).map(name => ({ name, ok: true }));
}

function openPlannedAssets() {
    let m = document.getElementById('plannedModal');
    if (!m) {
        m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'plannedModal';
        m.onclick = e => { if (e.target === m) m.classList.remove('open'); };
        document.body.appendChild(m);
    }
    const types = [...new Set([...dashboardData.assets.map(a => a.type), ...ASSET_TYPES])];
    m.innerHTML = `<div class="modal" style="max-width:460px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;"><h2 style="margin:0;">Planned assets</h2>
            <button class="btn-sm" onclick="document.getElementById('plannedModal').classList.remove('open')" aria-label="Close">✕</button></div>
        ${namesBuilderHTML('pb', projectCode(), types)}
        <div class="modal-actions"><button class="btn-sm" id="pbSubmit" style="border-color:var(--accent);color:var(--accent);" onclick="addPlannedAssets()">Add</button>
            <button class="btn-sm" onclick="document.getElementById('plannedModal').classList.remove('open')">Cancel</button></div></div>`;
    m.classList.add('open');
    setTimeout(() => document.getElementById(projectCode() ? 'pbType' : 'pbProj').focus(), 60);
}
async function addPlannedAssets() {
    const names = namesBuilderRead('pb').map(n => n.name);
    if (!names.length) return;
    const res = await api('/api/planned/add', { root_path: dashboardData.root_path, names });
    if (res.error) { showToast(res.error); return; }
    (res.assets || []).forEach(a => dashboardData.assets.push(a));
    document.getElementById('plannedModal').classList.remove('open');
    renderAll();
    const skipped = names.length - (res.assets || []).length;
    showToast(`Added ${res.assets.length} planned asset${res.assets.length === 1 ? '' : 's'}${skipped ? ` · ${skipped} already existed` : ''}`);
}
async function deletePlannedAsset(name) {
    const res = await api('/api/planned/remove', { root_path: dashboardData.root_path, name });
    if (res.error) { showToast(res.error); return; }
    dashboardData.assets = dashboardData.assets.filter(a => a.name !== name);
    if (expandedShot === name) expandedShot = null;
    renderAll();
    showToast(`Deleted ${name}`);
}
