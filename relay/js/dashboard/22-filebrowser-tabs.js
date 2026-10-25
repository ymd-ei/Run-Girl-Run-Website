// In-browser File Browser
// ---------------------------------------------------------------------------
const MEDIA_EXTS = new Set(['mp4','avi','mov','webm','png','jpg','jpeg','gif','webp','bmp','tiff']);

let _fbMode = 'folder';       // 'folder' | 'media'
let _fbCurrentPath = '';
let _fbSelectedPath = '';
let _fbSelectedIsDir = false;
let _fbCallback = null;
let _fbInitialDir = '';

async function openFileBrowser(mode, initialDir, callback) {
    _fbMode = mode;
    _fbCallback = callback;
    _fbSelectedPath = '';
    _fbInitialDir = initialDir || '';
    document.getElementById('fbTitle').textContent = mode === 'folder' ? 'Select Folder' : 'Select Media';
    document.getElementById('fbSelLabel').textContent = mode === 'folder' ? 'Folder:' : 'File:';
    document.getElementById('fbSelName').textContent = '—';
    document.getElementById('fbSelectBtn').textContent = mode === 'folder' ? 'Select Folder' : 'Select File';
    document.getElementById('fileBrowserModal').classList.add('open');
    await _fbNavigate(initialDir || '');
}

function _fbCancel() {
    document.getElementById('fileBrowserModal').classList.remove('open');
    _fbCallback = null;
}

function _fbConfirm() {
    if (!_fbSelectedPath) return;
    const cb = _fbCallback;
    _fbCallback = null;
    document.getElementById('fileBrowserModal').classList.remove('open');
    if (cb) cb(_fbSelectedPath);
}

async function _fbNavigate(path) {
    const url = '/api/list_dir' + (path ? '?path=' + encodeURIComponent(path) : '');
    let data;
    try { data = await fetch(url).then(r => r.json()); } catch(e) { return; }
    if (data.error) return;
    _fbCurrentPath = data.path || '';

    // Breadcrumb
    const pathText = document.getElementById('fbPathText');
    const upBtn = document.getElementById('fbUpBtn');
    pathText.textContent = _fbCurrentPath || 'This PC';
    upBtn.style.opacity = (data.parent !== null && data.parent !== undefined) ? '1' : '0.25';
    upBtn.style.pointerEvents = (data.parent !== null && data.parent !== undefined) ? '' : 'none';

    // Reset selection when navigating
    _fbSelectedPath = '';
    _fbSelectedIsDir = false;
    document.getElementById('fbSelName').textContent = '—';

    // Render list
    const list = document.getElementById('fbList');
    const entries = data.entries || [];
    const visible = entries.filter(e => {
        if (e.is_dir) return true;
        if (_fbMode === 'folder') return false;
        const ext = e.ext.replace('.', '');
        return MEDIA_EXTS.has(ext);
    });

    if (data.timed_out) {
        list.innerHTML = '<div class="fb-empty">This folder is responding slowly (network mount?).<br>Try again, or navigate via a subfolder path.</div>';
        return;
    }

    if (visible.length === 0) {
        list.innerHTML = '<div class="fb-empty">No items</div>';
        return;
    }

    list.innerHTML = visible.map(e => {
        const cls = e.is_dir ? 'fb-dir' : 'fb-file';
        const icon = e.is_dir ? '📁' : '🎞';
        const fullPath = _fbCurrentPath ? (_fbCurrentPath.replace(/[\\/]+$/, '') + (_fbCurrentPath.includes('/') ? '/' : '\\') + e.name) : e.name;
        return `<div class="fb-item ${cls}" data-path="${esc(fullPath)}" data-isdir="${e.is_dir}" onclick="_fbClickItem(this)">
            <span class="fb-icon">${icon}</span>
            <span class="fb-item-name">${esc(e.name)}</span>
        </div>`;
    }).join('');
}

function _fbClickItem(el) {
    const path = el.dataset.path;
    const isDir = el.dataset.isdir === 'true';
    if (isDir && _fbMode === 'folder') {
        // Single-click selects folder, double-click navigates
        if (_fbSelectedPath === path) {
            _fbNavigate(path);
        } else {
            document.querySelectorAll('.fb-item').forEach(i => i.classList.remove('fb-selected'));
            el.classList.add('fb-selected');
            _fbSelectedPath = path;
            _fbSelectedIsDir = true;
            document.getElementById('fbSelName').textContent = path.split(/[/\\]/).pop();
        }
    } else if (isDir) {
        // In file mode, navigate into directories
        _fbNavigate(path);
    } else {
        // File select
        document.querySelectorAll('.fb-item').forEach(i => i.classList.remove('fb-selected'));
        el.classList.add('fb-selected');
        _fbSelectedPath = path;
        _fbSelectedIsDir = false;
        document.getElementById('fbSelName').textContent = path.split(/[/\\]/).pop();
    }
}

async function _fbUp() {
    const url = '/api/list_dir' + (_fbCurrentPath ? '?path=' + encodeURIComponent(_fbCurrentPath) : '');
    const data = await fetch(url).then(r => r.json()).catch(() => null);
    if (!data) return;
    if (data.parent !== null && data.parent !== undefined) {
        _fbNavigate(data.parent);
    } else if (data.is_root) {
        _fbNavigate(''); // go to drive list
    }
}

// ---------------------------------------------------------------------------
// Playlists (dashboard side)
// ---------------------------------------------------------------------------
async function loadDashboardPlaylists() {
    if (!dashboardData) return;
    const result = await api('/api/playlists?path=' + encodeURIComponent(dashboardData.root_path));
    dashboardPlaylists = result.playlists || [];
    // Keep libPlaylists in sync when operating on library data
    if (libData && dashboardData === libData) libPlaylists = dashboardPlaylists;
}

async function addToPlaylist(shotName) {
    const select = document.getElementById(`playlist-sel-${shotName}`);
    if (!select) return;
    const val = select.value;
    if (!val) return;

    if (val === '__new__') {
        const name = prompt('New playlist name:');
        if (!name) return;
        const result = await api('/api/playlist/create', {
            root_path: dashboardData.root_path,
            name,
            shots: [shotName],
        });
        if (result.ok) {
            await loadDashboardPlaylists();
            renderTable(true);
            showToast(`Created "${name}" with ${shotName}`);
        }
    } else {
        const playlist = await api('/api/playlist?path=' + encodeURIComponent(dashboardData.root_path) + '&file=' + encodeURIComponent(val));
        if (!playlist.assets) playlist.assets = playlist.shots || [];
        if (!playlist.assets.includes(shotName)) {
            playlist.assets.push(shotName);
            await api('/api/playlist/save', {
                root_path: dashboardData.root_path,
                filename: val,
                name: playlist.name,
                assets: playlist.assets,
            });
            await loadDashboardPlaylists();
            renderTable(true);
            showToast(`Added to "${playlist.name}"`);
        } else {
            showToast('Already in this playlist');
        }
    }
    select.value = '';
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
let projectTabs = JSON.parse(localStorage.getItem('rgr_tabs') || '[]');
let activeTabIndex = parseInt(localStorage.getItem('rgr_active_tab') || '0');

function saveTabs() {
    try {
        localStorage.setItem('rgr_tabs', JSON.stringify(projectTabs));
        localStorage.setItem('rgr_active_tab', String(activeTabIndex));
    } catch(e) {}
}

function renderTabs() {
    let html = '';
    projectTabs.forEach((tab, i) => {
        const name = tab.path.split(/[/\\]/).pop() || tab.path;
        html += `<div class="tab ${i === activeTabIndex ? 'active' : ''}" onclick="switchTab(${i})">
            ${esc(name)}
            <span class="tab-close" onclick="event.stopPropagation();closeTab(${i})">&#215;</span>
        </div>`;
    });
    html += `<div class="tab-add" onclick="addProjectTab()">+</div>`;
    document.getElementById('tabBar').innerHTML = html;
}

async function addProjectTab() {
    openTabPicker();
}

async function openTabPicker() {
    const data = await fetch('/api/list_projects').then(r => r.json());
    const noStudio = document.getElementById('tpNoStudio');
    const listWrap = document.getElementById('tpProjectList');
    const items    = document.getElementById('tpItems');
    const empty    = document.getElementById('tpEmpty');
    const label    = document.getElementById('tpStudioLabel');

    if (!data.studio_root) {
        noStudio.style.display = 'block';
        listWrap.style.display = 'none';
    } else {
        noStudio.style.display = 'none';
        listWrap.style.display = 'block';
        const parts = data.studio_root.replace(/\\/g, '/').split('/').filter(Boolean);
        label.textContent = parts.slice(-2).join(' / ');
        if (!data.projects || data.projects.length === 0) {
            items.innerHTML = '';
            empty.style.display = 'block';
        } else {
            empty.style.display = 'none';
            items.innerHTML = data.projects.map(p => `
                <div onclick="tabPickerSelect('${p.path.replace(/\\/g, '\\\\')}')"
                     style="display:flex;align-items:center;justify-content:space-between;
                            padding:0.5rem 0.75rem;border-radius:7px;cursor:pointer;
                            background:var(--bg-tertiary);border:1px solid var(--border);
                            transition:border-color 0.15s,background 0.15s;"
                     onmouseover="this.style.borderColor='var(--accent)';this.style.background='var(--bg-hover)'"
                     onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--bg-tertiary)'">
                    <span style="font-family:var(--mono);font-size:0.82rem;color:var(--text-primary);">${esc(p.name)}</span>
                    ${p.oneoff ? '<span style="font-family:var(--mono);font-size:0.62rem;color:var(--text-muted);border:1px solid var(--border);border-radius:4px;padding:1px 5px;">OneOff</span>' : ''}
                </div>`).join('');
        }
    }
    document.getElementById('tabPickerModal').classList.add('open');
}

function closeTabPicker() {
    document.getElementById('tabPickerModal').classList.remove('open');
}

async function tabPickerSelect(path) {
    closeTabPicker();
    const existing = projectTabs.findIndex(t => t.path === path);
    if (existing >= 0) { activeTabIndex = existing; saveTabs(); renderTabs(); loadTabProject(path); return; }
    projectTabs.push({ path }); activeTabIndex = projectTabs.length - 1;
    saveTabs();
    await loadTabProject(path);
}

async function tabPickerBrowse() {
    closeTabPicker();
    const activeDir = (projectTabs[activeTabIndex] && projectTabs[activeTabIndex].path) || '';
    openFileBrowser('folder', activeDir, async path => {
        if (!path) return;
        const existing = projectTabs.findIndex(t => t.path === path);
        if (existing >= 0) { activeTabIndex = existing; }
        else { projectTabs.push({ path }); activeTabIndex = projectTabs.length - 1; }
        saveTabs();
        await loadTabProject(path);
    });
}

async function openProjectFolder() {
    if (!dashboardData) return;
    await api('/api/open_file', { filepath: dashboardData.root_path });
}

function closeTab(index) {
    projectTabs.splice(index, 1);
    if (activeTabIndex >= projectTabs.length) activeTabIndex = Math.max(0, projectTabs.length - 1);
    saveTabs();
    if (projectTabs.length === 0) changeProject();
    else loadTabProject(projectTabs[activeTabIndex].path);
}

async function switchTab(index) {
    if (index === activeTabIndex) return;
    activeTabIndex = index; saveTabs();
    await loadTabProject(projectTabs[index].path);
}

async function loadTabProject(path) {
    setDashboardLoading(true, 'Switching project...');
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
            document.getElementById('setupScreen').style.display = 'none';
            document.getElementById('dashboard').classList.add('active');
            document.getElementById('topAppBar').classList.add('active');
            document.getElementById('dashFooter').style.display = 'flex';
            document.getElementById('projectNameDisplay').textContent = dashboardData.root_path.split(/[/\\]/).pop() || dashboardData.root_path;
            document.getElementById('projectPathDisplay').textContent = dashboardData.root_path;
            _initProjectUI();
            expandedShot = null;
            activeAssigneeFilter = null;
            activeDateFilter = null;
            const quickPlaylists = await playlistPromise;
            dashboardPlaylists = quickPlaylists.playlists || [];
            renderAll(true);
        }

        const [scanData, playlistData] = await Promise.all([
            api('/api/scan?path=' + encPath),
            playlistPromise,
        ]);
        dashboardData = scanData;
        if (dashboardData.error) { showToast(dashboardData.error); return; }
        document.getElementById('setupScreen').style.display = 'none';
        document.getElementById('dashboard').classList.add('active');
        document.getElementById('topAppBar').classList.add('active');
        document.getElementById('dashFooter').style.display = 'flex';
        document.getElementById('projectNameDisplay').textContent = dashboardData.root_path.split(/[/\\]/).pop() || dashboardData.root_path;
        document.getElementById('projectPathDisplay').textContent = dashboardData.root_path;
        _initProjectUI();
        expandedShot = null;
        activeAssigneeFilter = null;
        activeDateFilter = null;
        dashboardPlaylists = playlistData.playlists || [];
        renderAll(true);
        if (scanData._scanning) watchBackgroundScan(path);
    } finally {
        setDashboardLoading(false);
    }
}

// ---------------------------------------------------------------------------
