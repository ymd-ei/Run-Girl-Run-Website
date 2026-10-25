// ---------------------------------------------------------------------------
// Library Modal
// ---------------------------------------------------------------------------
let libTabs = JSON.parse(localStorage.getItem('rgr_lib_tabs') || '[]');
let libActiveTab = parseInt(localStorage.getItem('rgr_lib_active_tab') || '0');
let libData = null;
let libExpandedShot = null;
let libSortCol = 'name', libSortDir = 'asc';
let libTypeFilter = null, libStatusFilter = null, libProjFilter = null, libSearchVal = '', libStarredFilter = false;
let libPlaylists = [];

function saveLibTabs() {
    try {
        localStorage.setItem('rgr_lib_tabs', JSON.stringify(libTabs));
        localStorage.setItem('rgr_lib_active_tab', String(libActiveTab));
    } catch(e) {}
}

function openLibrary() {
    // Save main dashboard context
    if (dashboardData && dashboardData !== libData) {
        _libPrevDashData = dashboardData;
        _libPrevPlaylists = dashboardPlaylists;
    }
    document.getElementById('libraryModal').classList.add('open');
    renderLibTabs();
    if (libTabs.length > 0 && libTabs[libActiveTab]) loadLibTab(libTabs[libActiveTab].path);
    else renderLibEmpty();
    document.addEventListener('keydown', libEscHandler);
}

function closeLibrary() {
    document.getElementById('libraryModal').classList.remove('open');
    document.removeEventListener('keydown', libEscHandler);
    clearBulkSelection();
    // Restore main dashboard context
    if (_libPrevDashData) {
        dashboardData = _libPrevDashData;
        dashboardPlaylists = _libPrevPlaylists || [];
        _libPrevDashData = null; _libPrevPlaylists = null;
    }
    _libCtxActive = false;
    renderFloatingStars(); renderFloatingDone();
}

function libEscHandler(e) {
    if (e.key === 'Escape') {
        if (bulkSelected.size > 0) { clearBulkSelection(); e.stopImmediatePropagation(); return; }
        closeLibrary();
    }
}

function renderLibTabs() {
    let html = '';
    libTabs.forEach((tab, i) => {
        const name = tab.name || tab.path.split(/[/\\]/).pop() || tab.path;
        html += `<div class="lib-tab ${i === libActiveTab ? 'active' : ''}" onclick="switchLibTab(${i})">
            ${esc(name)}
            <span class="lib-tab-close" onclick="event.stopPropagation();removeLibTab(${i})">&#215;</span>
        </div>`;
    });
    html += `<div class="lib-tab-add" onclick="addLibTab()" title="Add folder">+</div>`;
    document.getElementById('libTabs').innerHTML = html;
}

async function addLibTab() {
    // Get studio root as default directory
    const cfg = await api('/api/get_config');
    const studioRoot = cfg.studio_root || '';
    openFileBrowser('folder', studioRoot, async path => {
        if (!path) return;
        const existing = libTabs.findIndex(t => t.path === path);
        if (existing >= 0) { libActiveTab = existing; }
        else {
            const name = path.split(/[/\\]/).pop() || path;
            libTabs.push({ path, name });
            libActiveTab = libTabs.length - 1;
        }
        saveLibTabs(); renderLibTabs();
        await loadLibTab(path);
    });
}

function removeLibTab(index) {
    libTabs.splice(index, 1);
    if (libActiveTab >= libTabs.length) libActiveTab = Math.max(0, libTabs.length - 1);
    saveLibTabs(); renderLibTabs();
    if (libTabs.length === 0) { libData = null; renderLibEmpty(); }
    else loadLibTab(libTabs[libActiveTab].path);
}

async function switchLibTab(index) {
    if (index === libActiveTab) return;
    libActiveTab = index; saveLibTabs(); renderLibTabs();
    libExpandedShot = null; libTypeFilter = null; libStatusFilter = null; libProjFilter = null; libSearchVal = ''; libStarredFilter = false;
    await loadLibTab(libTabs[index].path);
}

async function loadLibTab(path) {
    setLibraryLoading(true, 'Loading library...');
    try {
        const encPath = encodeURIComponent(path);
        const playlistPromise = api('/api/playlists?path=' + encPath);

        let quickData = null;
        try {
            quickData = await api('/api/scan_quick?path=' + encPath);
        } catch (e) {
            quickData = null;
        }

        if (quickData && !quickData.error) {
            libData = quickData;
            dashboardData = libData;
            const quickPlaylists = await playlistPromise;
            libPlaylists = quickPlaylists.playlists || [];
            
            renderLibBody();
        }

        const [scanData, playlistData] = await Promise.all([
            api('/api/scan?path=' + encPath),
            playlistPromise,
        ]);
        libData = scanData;
        if (libData.error) { showToast(libData.error, true); renderLibEmpty();  return; }
        dashboardData = libData;
        libPlaylists = playlistData.playlists || [];
        
        renderLibBody();
    } finally {
        setLibraryLoading(false);
    }
}

function renderLibEmpty() {
    document.getElementById('libBody').innerHTML = '<div class="lib-empty">Add a folder to get started — click the <strong>+</strong> tab above.</div>';
    
}

function openLibReview() { openReview(libData?.root_path); }

function renderLibBody() {
    if (!libData || !libData.assets) { renderLibEmpty(); return; }
    const body = document.getElementById('libBody');
    const allActive = libData.assets.filter(s => !s.excluded);

    // Filters
    const types = [...new Set(allActive.map(s => s.type))].sort();
    const projs = [...new Set(allActive.map(s => s.name.split('.')[0]))].sort();
    const statuses = libData.custom_statuses || [];
    let html = `<div class="lib-filters">
        <input type="text" class="search-input" id="libSearch" placeholder="Search assets..." value="${esc(libSearchVal)}" oninput="libSearchVal=this.value;renderLibTable()">`;
    if (projs.length > 1) {
        const projOpts = [{value:'',label:'All Projects',color:null}].concat(projs.map(p=>({value:p,label:p,color:null})));
        html += makeCustomSelect('lib-proj', projOpts, libProjFilter||'', v=>{libProjFilter=v||null;renderLibTable();}, false);
    }
    const typeOpts = [{value:'',label:'All Types',color:null}].concat(types.map(t=>({value:t,label:t,color:null})));
    html += makeCustomSelect('lib-type', typeOpts, libTypeFilter||'', v=>{libTypeFilter=v||null;renderLibTable();renderLibBody();}, false);
    const hasStarred = allActive.some(s => s.starred);
    if (hasStarred) {
        html += `<span class="filter-chip ${libStarredFilter ? 'active' : ''}" onclick="libStarredFilter=!libStarredFilter;renderLibTable();renderLibBody();" style="${libStarredFilter ? 'border-color:#eab30880;color:#eab308;background:#eab30818;' : 'color:#eab308;border-color:#eab30840;'}">&#9733; Starred</span>`;
    }
    const anyLibFilterActive = libTypeFilter || libStatusFilter || libProjFilter || libStarredFilter;
    if (anyLibFilterActive) {
        html += `<span class="filter-chip" onclick="libTypeFilter=null;libStatusFilter=null;libProjFilter=null;libStarredFilter=false;renderLibTable();renderLibBody();" style="margin-left:auto;color:var(--text-muted);border-color:var(--border);">&#10005; Clear filters</span>`;
    }
    if (statuses.length) {
        html += `<div style="display:flex;align-items:center;justify-content:center;gap:0.4rem;width:100%;flex-wrap:wrap;margin-top:0;padding-top:0.5rem;border-top:1px solid var(--border);">`;
        for (const s of statuses) {
            const sn = statusName(s), sc = statusColor(s);
            const active = libStatusFilter === sn;
            html += `<span class="filter-chip" onclick="libStatusFilter=libStatusFilter==='${esc(sn)}'?null:'${esc(sn)}';renderLibTable();renderLibBody();" style="${active ? `background:${sc};border-color:${sc};color:#fff;font-weight:600;` : `background:${sc}22;border-color:${sc}55;color:${sc};`}">${esc(sn)}</span>`;
        }
        html += `</div>`;
    }
    html += `</div>`;

    // Table
    html += `<table class="lib-table"><thead><tr>
        <th onclick="libSort('name')">Asset</th>
        <th onclick="libSort('type')">Type</th>
        <th onclick="libSort('version')">Version</th>
        <th>Master</th>
        <th onclick="libSort('status')">Status</th>
        <th onclick="libSort('difficulty')">Difficulty</th>
        <th onclick="libSort('completion')">Progress</th>
        <th onclick="libSort('due_date')">Due</th>
        <th>Last Published</th>
        <th>By</th>
    </tr></thead><tbody id="libTableBody"></tbody></table>`;

    body.innerHTML = html;
    renderLibTable();
    renderFloatingStars(); renderFloatingDone();
}

function libSort(col) {
    if (libSortCol === col) libSortDir = libSortDir === 'asc' ? 'desc' : 'asc';
    else { libSortCol = col; libSortDir = 'asc'; }
    renderLibTable();
}

function renderLibTable() {
    const tbody = document.getElementById('libTableBody');
    if (!tbody || !libData) return;
    let shots = libData.assets.filter(s => !s.excluded);
    const search = libSearchVal.toLowerCase();
    if (search) shots = shots.filter(s => s.name.toLowerCase().includes(search));
    if (libStarredFilter) shots = shots.filter(s => s.starred);
    if (libProjFilter) shots = shots.filter(s => s.name.split('.')[0] === libProjFilter);
    if (libTypeFilter) shots = shots.filter(s => s.type === libTypeFilter);
    if (libStatusFilter) shots = shots.filter(s => s.status === libStatusFilter);
    shots = getSortedShots(shots, libSortCol, libSortDir);

    if (!shots.length) { tbody.innerHTML = `<tr><td colspan="10" class="lib-empty">No assets match</td></tr>`; return; }

    tbody.innerHTML = shots.map(shot => {
        const n = shot.name;
        const pct = shot.completion || 0;
        const activeComments = (shot.comments || []).filter(c => !c.archived);
        const statusColor = getStatusColor(shot.status);

        let row = `<tr data-lib-key="${esc(n)}" data-shot-key="${esc(n)}" class="${libExpandedShot === n ? 'expanded' : ''} ${bulkSelected.has(n) ? 'bulk-selected' : ''} ${shot.starred ? 'starred-row' : ''} ${shot.done ? 'done-row' : ''}" onmousedown="handleRowMousedown(event,'${esc(n)}',true)" onclick="handleRowClick(event,'${esc(n)}',true)" oncontextmenu="showCtxMenuLib(event,'${esc(n)}')" style="${rowStyle(shot, false)}">
            <td><span class="shot-name">${esc(n)}</span>${activeComments.length ? `<span class="comment-badge">${activeComments.length}</span>` : ''}</td>
            <td><span class="type-badge ${getTypeClass(shot.type)}">${esc(shot.type)}</span></td>
            <td><span class="version-num">v${esc(shot.version)}</span></td>
            <td>${shot.has_master ? '<span class="master-check">&#10003;</span>' : '<span class="master-missing">&#8212;</span>'}</td>
            <td><span class="status-badge" style="${colorBadgeStyle(statusColor)}">${esc(shot.status || '\u2014')}</span></td>
            <td>${renderDifficultyCell(shot)}</td>
            <td>${renderProgressCell(pct)}</td>
            <td>${renderDueDateCell(shot)}</td>
            <td style="font-size:0.75rem;color:var(--text-secondary);">${esc(shot.last_published || '\u2014')}</td>
            <td style="font-size:0.75rem;color:var(--text-secondary);">${esc(shot.last_user || '\u2014')}</td>
        </tr>`;

        if (libExpandedShot === n) {
            row += `<tr class="detail-row"><td colspan="10"><div class="detail-row-wrap"><div class="detail-panel" onclick="event.stopPropagation()">${buildDetailPanelHTML(shot, false, true)}</div></div></td></tr>`;
        }
        return row;
    }).join('');
    renderFloatingStars(); renderFloatingDone();
}

function libToggleDetail(name) {
    libExpandedShot = libExpandedShot === name ? null : name;
    renderLibTable();
    if (libExpandedShot) _openDetailRowAnimation(document.getElementById('libTableBody'));
    renderFloatingStars(); renderFloatingDone();
}

async function libQuickToggleDone(name, done) {
    if (!libData) return;
    const shot = libData.assets.find(s => s.name === name);
    if (!shot) return;
    shot.done = done;
    await saveMeta(shot);
    renderLibTable();
}

// Library context menu — reuse the main ctx menu (dashboardData is already pointed at libData)
function showCtxMenuLib(e, shotName) {
    e.preventDefault(); e.stopPropagation();
    _libCtxActive = true;
    dashboardPlaylists = libPlaylists;
    showCtxMenu(e, shotName);
}

let _libPrevDashData = null, _libPrevPlaylists = null;

