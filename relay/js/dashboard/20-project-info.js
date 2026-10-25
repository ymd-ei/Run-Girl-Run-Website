// ---------------------------------------------------------------------------
// Background scan watcher — /api/scan serves cache instantly and revalidates
// on a server thread; this polls until that finishes and re-renders if the
// fresh scan found changes on disk.
// ---------------------------------------------------------------------------
let _bgScanWatchToken = 0;

async function watchBackgroundScan(path) {
    const token = ++_bgScanWatchToken;
    const encPath = encodeURIComponent(path);
    for (let i = 0; i < 200; i++) {
        await new Promise(r => setTimeout(r, 1500));
        if (token !== _bgScanWatchToken) return;                        // superseded by a newer watch
        if (!dashboardData || dashboardData.root_path !== path) return; // project switched
        let st;
        try { st = await api('/api/scan_status?path=' + encPath); } catch (e) { return; }
        if (st.scanning) continue;
        if (st.changed) {
            try {
                const fresh = await api('/api/scan?path=' + encPath + '&bg=0');
                if (token !== _bgScanWatchToken) return;
                if (!fresh.error && dashboardData && dashboardData.root_path === path) {
                    const prevInfo = dashboardData.project_info;
                    dashboardData = fresh;
                    if (!dashboardData.project_info) dashboardData.project_info = prevInfo || {};
                    _loadDatesFromLocal(dashboardData.root_path, dashboardData.project_info);
                    renderAll(true);
                    showToast('Updated from disk');
                }
            } catch (e) {}
        }
        return;
    }
}

// ---------------------------------------------------------------------------
// Project lifecycle
// ---------------------------------------------------------------------------
async function loadProject() {
    const path = document.getElementById('projectPath').value.trim();
    if (!path) return;
    setDashboardLoading(true, 'Loading project...');
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
            dashboardData = quickData;
            if (!dashboardData.project_info) dashboardData.project_info = {};
            if (dashboardData.project_start_date) dashboardData.project_info.start_date = dashboardData.project_start_date;
            if (dashboardData.project_end_date)   dashboardData.project_info.end_date   = dashboardData.project_end_date;
            _loadDatesFromLocal(dashboardData.root_path, dashboardData.project_info);
            const existing = projectTabs.findIndex(t => t.path === path);
            if (existing >= 0) { activeTabIndex = existing; }
            else { projectTabs.push({ path }); activeTabIndex = projectTabs.length - 1; }
            saveTabs();
            document.getElementById('setupScreen').style.display = 'none';
            document.getElementById('dashboard').classList.add('active');
            document.getElementById('topAppBar').classList.add('active');
            document.getElementById('dashFooter').style.display = 'flex';
            document.getElementById('projectNameDisplay').textContent = dashboardData.root_path.split(/[/\\]/).pop() || dashboardData.root_path;
            document.getElementById('projectPathDisplay').textContent = dashboardData.root_path;
            _initProjectUI();
            expandedShot = null;
            const quickPlaylists = await playlistPromise;
            dashboardPlaylists = quickPlaylists.playlists || [];
            renderAll(true);
        }

        const [scanData, playlistData] = await Promise.all([
            api('/api/scan?path=' + encPath),
            playlistPromise,
        ]);
        dashboardData = scanData;
        if (dashboardData.error) { alert(dashboardData.error); return; }
        if (!dashboardData.project_info) dashboardData.project_info = {};
        if (dashboardData.project_start_date) dashboardData.project_info.start_date = dashboardData.project_start_date;
        if (dashboardData.project_end_date)   dashboardData.project_info.end_date   = dashboardData.project_end_date;
        _loadDatesFromLocal(dashboardData.root_path, dashboardData.project_info);
        const existing = projectTabs.findIndex(t => t.path === path);
        if (existing >= 0) { activeTabIndex = existing; }
        else { projectTabs.push({ path }); activeTabIndex = projectTabs.length - 1; }
        saveTabs();
        document.getElementById('setupScreen').style.display = 'none';
        document.getElementById('dashboard').classList.add('active');
        document.getElementById('topAppBar').classList.add('active');
        document.getElementById('dashFooter').style.display = 'flex';
        document.getElementById('projectNameDisplay').textContent = dashboardData.root_path.split(/[/\\]/).pop() || dashboardData.root_path;
        document.getElementById('projectPathDisplay').textContent = dashboardData.root_path;
        _initProjectUI();
        expandedShot = null;
        dashboardPlaylists = playlistData.playlists || [];
        renderAll(true);
        if (scanData._scanning) watchBackgroundScan(path);
    } finally {
        setDashboardLoading(false);
    }
}

function _initProjectUI() {
    if (!dashboardData) return;
    const info = dashboardData.project_info || {};
    // Sync description preview
    const descPrev = document.getElementById('projDescPreview');
    if (descPrev) {
        const desc = info.description || '';
        if (typeof marked !== 'undefined' && desc) {
            descPrev.style.whiteSpace = 'normal';
            descPrev.innerHTML = marked.parse(desc);
        } else {
            descPrev.style.whiteSpace = 'pre-wrap';
            descPrev.textContent = desc || 'Click to add a description or reflection…';
        }
    }
    const descTA = document.getElementById('projDescription');
    if (descTA) descTA.value = info.description || '';
    // Pre-populate _creditsData so the reflection modal never saves an empty array
    if (info.credits && info.credits.length) {
        _creditsData = info.credits.map(c => ({...c, roles: [...(c.roles || [])]}));
    }
    // Sync final_media into the hidden input so the Current Edit button can show
    const fm = document.getElementById('projFinalMedia');
    if (fm) fm.value = dashboardData.final_media || '';
    // Pre-populate current_edit path in the modal input
    const ceInput = document.getElementById('currentEditPath');
    if (ceInput && dashboardData.current_edit) ceInput.value = dashboardData.current_edit;
}

async function browseProject() {
    openFileBrowser('folder', '', path => {
        if (!path) return;
        document.getElementById('projectPath').value = path;
        loadProject();
    });
}

async function shutDown() {
    if (!confirm('Shut down the Relay server?')) return;
    try { await fetch('/api/shutdown', { method: 'POST' }); } catch(e) {}
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#888;font-family:monospace;font-size:1.2rem;">Server stopped. You can close this tab.</div>';
}

async function refreshData() {
    if (!dashboardData) return;
    setDashboardLoading(true, 'Refreshing...');
    try {
        Object.keys(_starRotations).forEach(k => delete _starRotations[k]);
        const _prevInfo = dashboardData.project_info || {};
        const _prevCompleted = dashboardData.completed_date || '';
        const [scanData, playlistData] = await Promise.all([
            api('/api/scan?path=' + encodeURIComponent(dashboardData.root_path) + '&force=1'),
            api('/api/playlists?path=' + encodeURIComponent(dashboardData.root_path)),
        ]);
        dashboardData = scanData;
        // Restore dates from localStorage (reliable client-side persistence)
        if (!dashboardData.project_info) dashboardData.project_info = {};
        dashboardData.project_info.start_date = dashboardData.project_start_date || _prevInfo.start_date || '';
        dashboardData.project_info.end_date   = dashboardData.project_end_date   || _prevInfo.end_date   || '';
        if (!dashboardData.completed_date) dashboardData.completed_date = _prevCompleted;
        _loadDatesFromLocal(dashboardData.root_path, dashboardData.project_info);
        dashboardPlaylists = playlistData.playlists || [];
        renderAll(true);
        showToast('Refreshed');
    } finally {
        setDashboardLoading(false);
    }
}

function changeProject() {
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('topAppBar').classList.remove('active');
    document.getElementById('dashFooter').style.display = 'none';
    document.getElementById('setupScreen').style.display = 'flex';
    dashboardData = null; expandedShot = null;
    refreshPicker();
}

function openReviewPage() { if (dashboardData) openReview(dashboardData.root_path); }

// ---------------------------------------------------------------------------
// Project Info / Credits
// ---------------------------------------------------------------------------
function toggleProjectInfo() {
    projectInfoOpen = !projectInfoOpen;
    const panel = document.getElementById('projectInfoPanel');
    const title = document.getElementById('projectTitle');
    panel.classList.toggle('open', projectInfoOpen);
    title.classList.toggle('expanded', projectInfoOpen);
    if (projectInfoOpen && dashboardData) {
        const info = dashboardData.project_info || {};
        document.getElementById('projDescription').value = info.description || '';
        const _sd = info.start_date || ''; document.getElementById('projStartDate').value = _sd; const _sdd = document.getElementById('projStartDateDisplay'); if(_sdd){_sdd.textContent=_sd||'—';_sdd.classList.toggle('proj-date-set',!!_sd);}
        const _ed = info.end_date || ''; document.getElementById('projEndDate').value = _ed; const _edd = document.getElementById('projEndDateDisplay'); if(_edd){_edd.textContent=_ed||'—';_edd.classList.toggle('proj-date-set',!!_ed);}
        const isComplete = dashboardData.project_complete || false;
        const completedRow = document.getElementById('projCompletedRow');
        if (completedRow) completedRow.style.display = isComplete ? '' : 'none';
        if (isComplete) { const _cd = dashboardData.completed_date || ''; document.getElementById('projCompletedDate').value = _cd; const _cdd = document.getElementById('projCompletedDateDisplay'); if(_cdd){_cdd.textContent=_cd||'—';_cdd.classList.toggle('proj-date-set',!!_cd);} }
        renderCredits(info.credits || []);
        loadActivityLog();
    } else if (!projectInfoOpen) {
        saveProjectInfo();
    }
    // Re-render stars and done markers every frame during the panel animation (0.3s)
    const animEnd = performance.now() + 350;
    function _rafStep(now) {
        renderFloatingStars(); renderFloatingDone();
        if (now < animEnd) requestAnimationFrame(_rafStep);
    }
    requestAnimationFrame(_rafStep);
}

let _creditsData = [];

function renderCredits(credits) {
    _creditsData = credits.map(c => ({...c, roles: [...(c.roles || [])]}));
    _renderCreditsTable();
}

function _renderCreditsTable() {
    const container = document.getElementById('creditsBody');
    container.innerHTML = _creditsData.map((c, i) => {
        const color = c.color || PALETTE[i % PALETTE.length].hex;
        const paletteOpts = PALETTE.map(p => `<option value="${p.hex}" ${p.hex === color ? 'selected' : ''}>${p.name}</option>`).join('');
        const roleTags = (c.roles || []).map((r, ri) =>
            `<span class="role-tag">${esc(r)}<span class="rm" onclick="removeRole(${i},${ri})">×</span></span>`
        ).join('');
        return `<div class="credit-card">
            <div class="credit-color-wrap" id="color-wrap-${i}">
                <span class="credit-color-dot" style="background:${color};" onclick="toggleColorPicker(${i})"></span>
                <div class="credit-color-select" id="color-sel-${i}" style="display:none;padding:5px;flex-wrap:wrap;gap:4px;width:96px;">
                    ${PALETTE.map(p => `<span onclick="event.stopPropagation();updateCredit(${i},'color','${p.hex}');_renderCreditsTable();" title="${p.name}" style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${p.hex};cursor:pointer;border:2px solid ${p.hex===color?'#fff':'transparent'};transition:transform 0.1s;flex-shrink:0;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform=''"></span>`).join('')}
                </div>
            </div>
            <input class="credit-name-input" value="${esc(c.name||'')}" placeholder="Name" oninput="updateCredit(${i},'name',this.value)">
            <div class="credit-divider"></div>
            <input class="credit-contact-input" value="${esc(c.contact||'')}" placeholder="contact / @handle" oninput="updateCredit(${i},'contact',this.value)">
            <div class="credit-divider"></div>
            <div class="credit-roles-wrap">
                ${roleTags}
                <input class="role-add-input" placeholder="+ role" id="role-input-${i}"
                    onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault();addRole(${i},this.value.trim());this.value='';}"
                    onblur="if(this.value.trim()){addRole(${i},this.value.trim());this.value='';}">
            </div>
            <span class="credit-remove" onclick="removeCredit(${i})">×</span>
        </div>`;
    }).join('');
}

function updateCredit(i, field, value) {
    if (field === 'name' && dashboardData) {
        const oldName = _creditsData[i].name || '';
        if (oldName && oldName !== value) {
            dashboardData.assets.forEach(asset => {
                if (asset.assignee === oldName) {
                    asset.assignee = value;
                    saveMeta(asset);
                }
            });
        }
    }
    _creditsData[i][field] = value;
    // Keep project_info in sync so row lookups (tooltip color etc.) stay correct
    if (dashboardData?.project_info?.credits) {
        dashboardData.project_info.credits = _creditsData;
    }
    if (field === 'name' || field === 'color') renderTable(true);
    _debouncedSilentSave();
}
function toggleColorPicker(i) {
    const wrap = document.getElementById(`color-wrap-${i}`);
    const sel = document.getElementById(`color-sel-${i}`);
    const isOpen = wrap.classList.contains('open');
    document.querySelectorAll('.credit-color-wrap.open').forEach(w => {
        w.classList.remove('open');
        const s = w.querySelector('.credit-color-select'); if (s) s.style.display = 'none';
    });
    if (!isOpen) {
        wrap.classList.add('open');
        if (sel) sel.style.display = 'flex';
    }
}
function addRole(i, role) {
    if (!role) return;
    if (!_creditsData[i].roles.includes(role)) _creditsData[i].roles.push(role);
    _renderCreditsTable();
    _debouncedSilentSave();
}
function removeRole(i, ri) { _creditsData[i].roles.splice(ri, 1); _renderCreditsTable(); _debouncedSilentSave(); }
function removeCredit(i) { _creditsData.splice(i, 1); _renderCreditsTable(); _debouncedSilentSave(); }
function addCreditRow() { _creditsData.push({name: '', roles: [], contact: ''}); _renderCreditsTable(); _debouncedSilentSave(); }

// Click-outside to close project info panel
document.addEventListener('mousedown', function(e) {
    if (!projectInfoOpen) return;
    const panel = document.getElementById('projectInfoPanel');
    const header = document.querySelector('.project-header');
    const calBox = document.getElementById('calPickerBox');
    if (panel && header && !panel.contains(e.target) && !header.contains(e.target) && !(calBox && calBox.contains(e.target))) {
        projectInfoOpen = false;
        panel.classList.remove('open');
        document.getElementById('projectTitle').classList.remove('expanded');
        _saveProjectInfoSilent();
        const animEnd2 = performance.now() + 350;
        function _rafStep2(now) { renderFloatingStars(); renderFloatingDone(); if (now < animEnd2) requestAnimationFrame(_rafStep2); }
        requestAnimationFrame(_rafStep2);
    }
    // Close any open color pickers on outside click
    if (!e.target.closest('.credit-color-wrap')) {
        document.querySelectorAll('.credit-color-wrap.open').forEach(w => {
            w.classList.remove('open');
            const s = w.querySelector('.credit-color-select'); if (s) s.style.display = 'none';
        });
    }
});

async function saveProjectInfo() {
    await _saveProjectInfoSilent();
    showToast('Project info saved');
}

async function _saveProjectInfoSilent() {
    if (!dashboardData) return;
    const description = document.getElementById('projDescription').value;
    const startEl = document.getElementById('projStartDate');
    const endEl = document.getElementById('projEndDate');
    const start_date = startEl ? startEl.value : (dashboardData.project_info?.start_date || '');
    const end_date = endEl ? endEl.value : (dashboardData.project_info?.end_date || '');
    const isComplete = dashboardData.project_complete || false;
    const completed_date_field = document.getElementById('projCompletedDate');
    if (completed_date_field) dashboardData.completed_date = completed_date_field.value || dashboardData.completed_date || '';
    await api('/api/save_project_info', {
        root_path: dashboardData.root_path,
        description,
        credits: _creditsData,
        start_date,
        end_date,
        completed_date: dashboardData.completed_date || '',
    });
    dashboardData.project_info = { ...(dashboardData.project_info || {}), description, credits: _creditsData, start_date, end_date };
    _saveDatesToLocal();
    await saveProjectMeta();
    renderStats();
}

let _saveProjectInfoTimer = null;
function _debouncedSilentSave() {
    clearTimeout(_saveProjectInfoTimer);
    _saveProjectInfoTimer = setTimeout(_saveProjectInfoSilent, 600);
}

