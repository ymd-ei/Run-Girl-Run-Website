// ---------------------------------------------------------------------------
// Demo Mode — NDA-safe proxy data engine
// Toggle via ⚙ System Settings → "Demo Mode"
// Stored in localStorage as 'rgr_demo_mode'
// ---------------------------------------------------------------------------
(function _installDemoEngine() {
    const DEMO_ROOT = 'C:\\Studio\\01_Projects\\DemoProject';

    const STATUSES = [
        { name:'WIP',      color:'#6366f1' },
        { name:'Review',   color:'#f59e0b' },
        { name:'Approved', color:'#22c55e' },
        { name:'Blocked',  color:'#ef4444' },
        { name:'Hold',     color:'#888888' },
    ];
    const DIFFICULTIES = [
        { name:'Low',    color:'#22c55e' },
        { name:'Medium', color:'#f59e0b' },
        { name:'High',   color:'#ef4444' },
    ];
    const CREDITS = [
        { name:'Alex M.',    roles:['Director','COMP'],  contact:'@alex_m',   color:'#6366f1' },
        { name:'Sam R.',     roles:['ANIM','Rig'],        contact:'@sam_r',    color:'#22c55e' },
        { name:'Jordan K.',  roles:['FX','LIT'],          contact:'@jkfx',     color:'#f59e0b' },
        { name:'Casey L.',   roles:['COMP','Edit'],       contact:'@casey_l',  color:'#a855f7' },
    ];

    function due(n) { const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
    const pub = due;  // alias — same calculation

    const ASSETS = [
        { name:'Shot_010',          type:'ANIM', version:'4', has_master:true,  status:'Approved', difficulty:'Medium', completion:100, due_date:due(-10), last_published:pub(-11), last_user:'Sam R.',    starred:true,  done:true,  excluded:false, assignee:'Sam R.',    notes:'',                                    comments:[] },
        { name:'Shot_020',          type:'ANIM', version:'3', has_master:true,  status:'Approved', difficulty:'Medium', completion:100, due_date:due(-5),  last_published:pub(-6),  last_user:'Sam R.',    starred:false, done:true,  excluded:false, assignee:'Sam R.',    notes:'',                                    comments:[] },
        { name:'Shot_030',          type:'ANIM', version:'2', has_master:false, status:'Review',   difficulty:'High',   completion:80,  due_date:due(2),   last_published:pub(-2),  last_user:'Sam R.',    starred:true,  done:false, excluded:false, assignee:'Sam R.',    notes:'',                                    comments:[{id:'c1',text:'Timing on the jump feels a beat off — revisit frames 42–58.',author:'Alex M.',timestamp:'2026-03-10 14:22',resolved:false,archived:false},{id:'c2',text:'Secondary motion on the coat looks great!',author:'Casey L.',timestamp:'2026-03-11 09:05',resolved:false,archived:false}] },
        { name:'Shot_040',          type:'ANIM', version:'1', has_master:false, status:'WIP',      difficulty:'High',   completion:45,  due_date:due(5),   last_published:pub(-1),  last_user:'Sam R.',    starred:false, done:false, excluded:false, assignee:'Sam R.',    notes:'',                                    comments:[] },
        { name:'Shot_050',          type:'ANIM', version:'2', has_master:false, status:'WIP',      difficulty:'Low',    completion:60,  due_date:due(7),   last_published:pub(-3),  last_user:'Sam R.',    starred:false, done:false, excluded:false, assignee:'Sam R.',    notes:'',                                    comments:[] },
        { name:'Shot_060',          type:'ANIM', version:'1', has_master:false, status:'Blocked',  difficulty:'High',   completion:20,  due_date:due(4),   last_published:pub(-5),  last_user:'Sam R.',    starred:false, done:false, excluded:false, assignee:'Sam R.',    notes:'Waiting on rig fix for hand IK.',     comments:[{id:'c3',text:'Hand IK broken on prop interaction — needs rig fix before this can progress.',author:'Sam R.',timestamp:'2026-03-09 16:44',resolved:false,archived:false}] },
        { name:'Shot_070',          type:'ANIM', version:'3', has_master:true,  status:'Approved', difficulty:'Medium', completion:100, due_date:due(-8),  last_published:pub(-9),  last_user:'Sam R.',    starred:false, done:true,  excluded:false, assignee:'Sam R.',    notes:'',                                    comments:[] },
        { name:'COMP_Intro',        type:'COMP', version:'5', has_master:true,  status:'Approved', difficulty:'Medium', completion:100, due_date:due(-12), last_published:pub(-13), last_user:'Casey L.',  starred:true,  done:true,  excluded:false, assignee:'Casey L.',  notes:'',                                    comments:[] },
        { name:'COMP_Act1_Open',    type:'COMP', version:'3', has_master:true,  status:'Approved', difficulty:'Low',    completion:100, due_date:due(-6),  last_published:pub(-7),  last_user:'Casey L.',  starred:false, done:true,  excluded:false, assignee:'Casey L.',  notes:'',                                    comments:[] },
        { name:'COMP_Act1_Mid',     type:'COMP', version:'2', has_master:false, status:'Review',   difficulty:'Medium', completion:85,  due_date:due(1),   last_published:pub(-1),  last_user:'Casey L.',  starred:false, done:false, excluded:false, assignee:'Casey L.',  notes:'',                                    comments:[{id:'c4',text:'Grade feels slightly cool — can we warm the mids a touch?',author:'Alex M.',timestamp:'2026-03-11 11:30',resolved:false,archived:false}] },
        { name:'COMP_Act2_Chase',   type:'COMP', version:'1', has_master:false, status:'WIP',      difficulty:'High',   completion:30,  due_date:due(6),   last_published:pub(-4),  last_user:'Casey L.',  starred:false, done:false, excluded:false, assignee:'Casey L.',  notes:'',                                    comments:[] },
        { name:'COMP_Act2_Reveal',  type:'COMP', version:'2', has_master:false, status:'WIP',      difficulty:'High',   completion:50,  due_date:due(8),   last_published:pub(-2),  last_user:'Casey L.',  starred:true,  done:false, excluded:false, assignee:'Alex M.',   notes:'',                                    comments:[] },
        { name:'COMP_Outro',        type:'COMP', version:'1', has_master:false, status:'Hold',     difficulty:'Low',    completion:10,  due_date:due(14),  last_published:'',       last_user:'',          starred:false, done:false, excluded:false, assignee:'Casey L.',  notes:'On hold pending final edit lock.',    comments:[] },
        { name:'FX_SplashHero',     type:'FX',   version:'3', has_master:true,  status:'Approved', difficulty:'High',   completion:100, due_date:due(-7),  last_published:pub(-8),  last_user:'Jordan K.', starred:true,  done:true,  excluded:false, assignee:'Jordan K.', notes:'',                                    comments:[] },
        { name:'FX_DustTrail',      type:'FX',   version:'2', has_master:false, status:'Review',   difficulty:'Medium', completion:75,  due_date:due(3),   last_published:pub(-1),  last_user:'Jordan K.', starred:false, done:false, excluded:false, assignee:'Jordan K.', notes:'',                                    comments:[{id:'c5',text:'Dust density looks great. Sim the leading edge more — it dies too fast.',author:'Alex M.',timestamp:'2026-03-10 17:00',resolved:false,archived:false}] },
        { name:'FX_Explosion_A',    type:'FX',   version:'1', has_master:false, status:'WIP',      difficulty:'High',   completion:40,  due_date:due(9),   last_published:pub(-3),  last_user:'Jordan K.', starred:false, done:false, excluded:false, assignee:'Jordan K.', notes:'',                                    comments:[] },
        { name:'FX_RainLayer',      type:'FX',   version:'2', has_master:false, status:'WIP',      difficulty:'Medium', completion:55,  due_date:due(6),   last_published:pub(-2),  last_user:'Jordan K.', starred:false, done:false, excluded:false, assignee:'Jordan K.', notes:'',                                    comments:[] },
        { name:'LIT_Ext_Day',       type:'LIT',  version:'4', has_master:true,  status:'Approved', difficulty:'Low',    completion:100, due_date:due(-9),  last_published:pub(-10), last_user:'Jordan K.', starred:false, done:true,  excluded:false, assignee:'Jordan K.', notes:'',                                    comments:[] },
        { name:'LIT_Ext_Night',     type:'LIT',  version:'2', has_master:false, status:'Review',   difficulty:'Medium', completion:70,  due_date:due(2),   last_published:pub(-1),  last_user:'Jordan K.', starred:false, done:false, excluded:false, assignee:'Jordan K.', notes:'',                                    comments:[] },
        { name:'LIT_Int_Office',    type:'LIT',  version:'3', has_master:true,  status:'Approved', difficulty:'Medium', completion:100, due_date:due(-4),  last_published:pub(-5),  last_user:'Jordan K.', starred:false, done:true,  excluded:false, assignee:'Jordan K.', notes:'',                                    comments:[] },
        { name:'LIT_Int_Warehouse', type:'LIT',  version:'1', has_master:false, status:'WIP',      difficulty:'High',   completion:35,  due_date:due(11),  last_published:pub(-1),  last_user:'Jordan K.', starred:false, done:false, excluded:false, assignee:'Jordan K.', notes:'',                                    comments:[] },
        { name:'Shot_OLD_v1',       type:'ANIM', version:'1', has_master:false, status:'Hold',     difficulty:'',       completion:0,   due_date:'',       last_published:'',       last_user:'',          starred:false, done:false, excluded:true,  assignee:'',          notes:'Replaced by Shot_010.',               comments:[] },
    ];

    const PLAYLISTS = [
        { filename:'review_wave1.json',  name:'Wave 1 Review',  assets:['Shot_010','Shot_020','COMP_Intro','COMP_Act1_Open','LIT_Ext_Day','LIT_Int_Office','FX_SplashHero'] },
        { filename:'in_progress.json',   name:'In Progress',    assets:['Shot_030','Shot_040','Shot_050','COMP_Act1_Mid','COMP_Act2_Chase','FX_DustTrail','FX_Explosion_A','LIT_Ext_Night'] },
    ];

    const DEMO_DATA = {
        root_path: DEMO_ROOT,
        assets: ASSETS,
        custom_statuses: STATUSES,
        custom_difficulties: DIFFICULTIES,
        auto_status_rules: [],
        auto_status_enabled: false,
        project_complete: false,
        final_media: '',
        project_reflection: '',
        scan_folders: [],
        excluded_extensions: [],
        project_info: { description: 'A short animated film. In production — targeting final delivery end of Q1.', credits: CREDITS },
    };

    function fakeJSON(data) {
        return Promise.resolve(new Response(JSON.stringify(data), { status:200, headers:{'Content-Type':'application/json'} }));
    }

    function installFetchInterceptor() {
        if (window._demoFetchInstalled) return;
        window._demoFetchInstalled = true;
        const _real = window.fetch.bind(window);
        window.fetch = function(url, opts) {
            const urlStr = typeof url === 'string' ? url : String(url);
            if (!urlStr.startsWith('/api/')) return _real(url, opts);
            const path = urlStr.split('?')[0];
            if (path === '/api/scan')        return fakeJSON(DEMO_DATA);
            if (path === '/api/playlists')   return fakeJSON({ playlists: PLAYLISTS });
            if (path === '/api/playlist') {
                const p = new URLSearchParams(urlStr.split('?')[1]||'');
                const pl = PLAYLISTS.find(x => x.filename === p.get('file')) || {name:'',assets:[]};
                return fakeJSON(pl);
            }
            if (path === '/api/list_dir')    return fakeJSON({ path:DEMO_ROOT, parent:null, is_root:true, entries:[] });
            if (path === '/api/get_config')  return fakeJSON({ studio_root:'C:\\Studio', launch_on_startup:false });
            if (path === '/api/get_studio_config') return fakeJSON({ cloud_sharing:{} });
            if (path === '/api/shutdown')    return fakeJSON({ ok:false, error:'Demo mode — shutdown disabled.' });
            if (path === '/api/activity_log')       return fakeJSON({ entries: [] });
            if (path === '/api/snapshot/list')      return fakeJSON({ snapshots: [] });
            if (path === '/api/snapshot/save')      return fakeJSON({ ok:true, filename:'demo_snapshot.json' });
            if (path === '/api/snapshot/restore')   return fakeJSON({ ok:true });
            if (path === '/api/snapshot/delete')    return fakeJSON({ ok:true });
            if (path === '/api/playlist/create') {
                let b={}; try{b=JSON.parse(opts?.body||'{}');}catch(e){}
                if (b.name) PLAYLISTS.push({ filename:b.name.replace(/\s+/g,'_').toLowerCase()+'_demo.json', name:b.name, assets:b.shots||[] });
                return fakeJSON({ ok:true });
            }
            const SILENT_OK = ['/api/save_meta','/api/save_settings','/api/save_project_info','/api/playlist/save','/api/set_startup','/api/set_studio_root','/api/open_file','/api/export_html','/api/save_studio_config','/api/test_cloud','/api/create_project'];
            if (SILENT_OK.includes(path)) return fakeJSON({ ok:true });
            return _real(url, opts);
        };
    }

    function removeFetchInterceptor() {
        // Reload the page to cleanly restore real fetch + real data
        window._demoFetchInstalled = false;
    }

    function addDemoBadge() {
        if (document.getElementById('_demoBadge')) return;
        const b = document.createElement('div');
        b.id = '_demoBadge';
        b.textContent = '● DEMO';
        b.style.cssText = 'position:fixed;bottom:14px;right:16px;z-index:999999;background:#a855f7cc;color:#fff;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:0.12em;padding:3px 8px;border-radius:4px;pointer-events:none;user-select:none;';
        document.body.appendChild(b);
    }

    function removeDemoBadge() {
        const b = document.getElementById('_demoBadge');
        if (b) b.remove();
    }

    // Public toggle — called by the checkbox in System Settings
    window.toggleDemoMode = function(enable) {
        try { localStorage.setItem('rgr_demo_mode', enable ? '1' : '0'); } catch(e) {}
        if (enable) {
            installFetchInterceptor();
            addDemoBadge();
            // Close settings and boot the demo project
            closeSystemSettings();
            try { localStorage.setItem('rgr_tabs', JSON.stringify([{path:DEMO_ROOT}])); localStorage.setItem('rgr_active_tab','0'); } catch(e) {}
            const pi = document.getElementById('projectPath');
            if (pi) pi.value = DEMO_ROOT;
            if (typeof loadProject === 'function') loadProject();
        } else {
            removeDemoBadge();
            showToast('Demo mode off — reloading…');
            setTimeout(() => location.reload(), 900);
        }
    };

    // Boot on page load if demo mode was previously enabled
    if (localStorage.getItem('rgr_demo_mode') === '1') {
        installFetchInterceptor();
        document.addEventListener('DOMContentLoaded', () => {
            addDemoBadge();
            try { localStorage.setItem('rgr_tabs', JSON.stringify([{path:DEMO_ROOT}])); localStorage.setItem('rgr_active_tab','0'); } catch(e) {}
            setTimeout(() => {
                const pi = document.getElementById('projectPath');
                if (pi) pi.value = DEMO_ROOT;
                if (typeof loadProject === 'function') loadProject();
            }, 50);
        });
    }
})();

document.addEventListener('click', e => { if (!document.getElementById('ctxMenu').contains(e.target)) hideCtxMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideCtxMenu(); });

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
// Project lifecycle
// ---------------------------------------------------------------------------
async function loadProject() {
    const path = document.getElementById('projectPath').value.trim();
    if (!path) return;
    dashboardData = await api('/api/scan?path=' + encodeURIComponent(path));
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
    await loadDashboardPlaylists();
    renderAll(true);
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
    Object.keys(_starRotations).forEach(k => delete _starRotations[k]);
    const _prevInfo = dashboardData.project_info || {};
    const _prevCompleted = dashboardData.completed_date || '';
    dashboardData = await api('/api/scan?path=' + encodeURIComponent(dashboardData.root_path));
    // Restore dates from localStorage (reliable client-side persistence)
    if (!dashboardData.project_info) dashboardData.project_info = {};
    dashboardData.project_info.start_date = dashboardData.project_start_date || _prevInfo.start_date || '';
    dashboardData.project_info.end_date   = dashboardData.project_end_date   || _prevInfo.end_date   || '';
    if (!dashboardData.completed_date) dashboardData.completed_date = _prevCompleted;
    _loadDatesFromLocal(dashboardData.root_path, dashboardData.project_info);
    await loadDashboardPlaylists();
    renderAll(true);
    showToast('Refreshed');
}

async function exportSnapshot() {
    if (!dashboardData) return;
    showToast('Generating export…');
    const result = await api('/api/export_html', { root_path: dashboardData.root_path });
    if (result.error) { showToast('Export failed: ' + result.error); return; }
    const folder = parentPath(result.path);
    showToast('Exported — opening folder');
    await api('/api/open_file', { filepath: folder });
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

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------
async function loadActivityLog() {
    if (!dashboardData) return;
    const container = document.getElementById('activityLogBody');
    if (!container) return;
    container.innerHTML = '<span style="color:var(--text-muted);font-size:0.65rem;">Loading…</span>';
    try {
        const res = await api('/api/activity_log?path=' + encodeURIComponent(dashboardData.root_path));
        const entries = (res.entries || []).slice().reverse(); // newest first
        if (!entries.length) {
            container.innerHTML = '<span style="color:var(--text-muted);font-size:0.65rem;">No activity recorded yet.</span>';
            return;
        }
        const fieldLabels = {
            status: 'Status', difficulty: 'Difficulty', assignee: 'Assignee',
            due_date: 'Due Date', notes: 'Notes', completion: 'Progress',
            project_complete: 'Project Complete', description: 'Description',
            playlist_create: 'Playlist Created', playlist_delete: 'Playlist Deleted',
            snapshot_restore: 'Snapshot Restored',
        };
        const rows = entries.slice(0, 200).map(e => {
            const asset = e.asset === '_project' ? '<span style="color:#a855f7;">project</span>' : `<span style="color:var(--accent);">${esc(e.asset)}</span>`;
            const field = fieldLabels[e.field] || e.field;
            let change = '';
            if (e.field === 'playlist_create')   change = `created <b>${esc(String(e.after||''))}</b>`;
            else if (e.field === 'playlist_delete') change = `deleted <b>${esc(String(e.before||''))}</b>`;
            else if (e.field === 'snapshot_restore') change = `restored <b>${esc(String(e.after||''))}</b>`;
            else if (e.field === 'completion')    change = `${e.before ?? '?'}% → <b>${e.after ?? '?'}%</b>`;
            else if (e.field === 'notes')         change = `notes updated`;
            else if (e.field === 'description')   change = `description updated`;
            else change = `${esc(String(e.before ?? '—'))} → <b>${esc(String(e.after ?? '—'))}</b>`;
            const ts = e.ts ? e.ts.slice(0, 16) : '';
            return `<div style="padding:3px 0;border-bottom:1px solid var(--border);display:flex;gap:0.5rem;align-items:baseline;flex-wrap:wrap;">
                <span style="color:var(--text-muted);font-size:0.6rem;flex-shrink:0;min-width:110px;">${esc(ts)}</span>
                <span style="font-size:0.65rem;">${asset} · <span style="color:var(--text-muted);">${esc(field)}</span> · ${change}</span>
            </div>`;
        }).join('');
        container.innerHTML = rows;
    } catch (err) {
        container.innerHTML = '<span style="color:#ef4444;font-size:0.65rem;">Failed to load log.</span>';
    }
}

// ---------------------------------------------------------------------------
// Snapshots / Checkpoints
// ---------------------------------------------------------------------------
async function saveCheckpoint() {
    if (!dashboardData) { showToast('No project loaded'); return; }
    const btn = document.querySelector('[onclick="saveCheckpoint()"]');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
    try {
        const res = await api('/api/snapshot/save', { root_path: dashboardData.root_path, label: 'manual' });
        if (res.ok) {
            showToast('Checkpoint saved');
            loadSnapshotList();
        } else {
            showToast('Error: ' + (res.error || 'Save failed'));
        }
    } catch (e) {
        showToast('Error saving checkpoint');
    } finally {
        if (btn) { btn.textContent = '💾 Save Checkpoint'; btn.disabled = false; }
    }
}

async function loadSnapshotList() {
    if (!dashboardData) return;
    const container = document.getElementById('snapshotList');
    if (!container) return;
    container.innerHTML = '<span style="font-size:0.68rem;color:var(--text-muted);font-family:var(--mono);">Loading…</span>';
    try {
        const res = await api('/api/snapshot/list?path=' + encodeURIComponent(dashboardData.root_path));
        const snaps = res.snapshots || [];
        if (!snaps.length) {
            container.innerHTML = '<span style="font-size:0.68rem;color:var(--text-muted);font-family:var(--mono);">No checkpoints yet.</span>';
            return;
        }
        const labelColors = { manual:'#6366f1', daily:'#888', project_complete:'#ffd700' };
        container.innerHTML = snaps.map((s, i) => {
            const lc = labelColors[s.label] || '#888';
            const isComplete = s.is_complete;
            const badge = `<span style="font-size:0.58rem;padding:1px 6px;border-radius:3px;background:${lc}22;color:${lc};border:1px solid ${lc}44;font-family:var(--mono);">${esc(s.label || 'manual')}${isComplete ? ' ★' : ''}</span>`;
            return `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border);">
                ${badge}
                <span style="font-family:var(--mono);font-size:0.65rem;color:var(--text-muted);flex:1;">${esc(s.created || '')}</span>
                <span style="font-family:var(--mono);font-size:0.62rem;color:var(--text-muted);">${s.asset_count} assets</span>
                <button class="btn-sm" onclick="restoreSnapshot(${JSON.stringify(s.filename)})" style="font-size:0.58rem;padding:2px 7px;border-color:#22c55e40;color:#22c55e;">Restore</button>
                ${!isComplete ? `<button class="btn-sm" onclick="deleteSnapshot(${JSON.stringify(s.filename)})" style="font-size:0.58rem;padding:2px 7px;border-color:#ef444440;color:#ef4444;">✕</button>` : ''}
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = '<span style="font-size:0.68rem;color:#ef4444;font-family:var(--mono);">Failed to load checkpoints.</span>';
    }
}

async function restoreSnapshot(filename) {
    if (!dashboardData) return;
    if (!confirm(`Restore this checkpoint?\n\nThis will overwrite asset data with the saved snapshot. Comments and playlists are not affected.`)) return;
    try {
        const res = await api('/api/snapshot/restore', { root_path: dashboardData.root_path, filename });
        if (res.ok) {
            showToast('Snapshot restored — reloading…');
            setTimeout(async () => {
                dashboardData = await api('/api/scan?path=' + encodeURIComponent(dashboardData.root_path));
                renderAll(true);
            }, 600);
        } else {
            showToast('Error: ' + (res.error || 'Restore failed'));
        }
    } catch (e) {
        showToast('Error restoring snapshot');
    }
}

async function deleteSnapshot(filename) {
    if (!dashboardData) return;
    if (!confirm('Delete this checkpoint? This cannot be undone.')) return;
    try {
        const res = await api('/api/snapshot/delete', { root_path: dashboardData.root_path, filename });
        if (res.ok) { showToast('Checkpoint deleted'); loadSnapshotList(); }
        else showToast('Error: ' + (res.error || 'Delete failed'));
    } catch (e) {
        showToast('Error deleting checkpoint');
    }
}

// ---------------------------------------------------------------------------
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
    dashboardData = await api('/api/scan?path=' + encodeURIComponent(path));
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
    await loadDashboardPlaylists();
    renderAll(true);
}

// ---------------------------------------------------------------------------
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
    const tbody = document.getElementById('shotsBody');
    tbody.classList.add('fade-out');
    setTimeout(() => { renderTable(true); renderStats(); void tbody.offsetHeight; tbody.classList.remove('fade-out'); }, 100);
}

function getSortedShots(shots, col, dir) {
    col = col || sortColumn;
    dir = dir || sortDir;
    return [...shots].sort((a, b) => {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
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
    else showToast(enable ? 'Added to Windows startup' : 'Removed from Windows startup');
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

    const credits = dashboardData.project_info?.credits?.filter(c => c.name) || [];
    if (credits.length) {
        const assigneeOpts = [{value:'',label:'All',color:null}].concat(credits.map(c=>({value:c.name,label:c.name,color:c.color||null})));
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
        return `<tr class="excluded-row" style="opacity:0.45;">
            <td colspan="9"><span class="shot-name" style="cursor:default;">${esc(n)}</span>${shot.notes ? `<span style="font-family:var(--mono);font-size:0.65rem;color:var(--text-muted);margin-left:0.75rem;">${esc(shot.notes)}</span>` : ''}</td>
            <td style="text-align:right;"><button class="btn-include" onclick="event.stopPropagation();toggleExclude('${esc(n)}',false)" style="padding:0.2rem 0.6rem;font-size:0.65rem;">Include</button></td>
        </tr>`;
    }
    const pct = shot.completion || 0;
    const activeComments = (shot.comments || []).filter(c => !c.archived);
    const statusColor = getStatusColor(shot.status);
    const assignee = shot.assignee || '';
    const assigneeCredit = assignee ? (dashboardData.project_info?.credits || []).find(c => c.name === assignee) : null;
    const assigneeColor = assigneeCredit?.color || 'var(--accent)';
    const assigneeAttr = assignee ? `data-assignee="${esc(assignee)}" data-assignee-color="${esc(assigneeColor)}"` : '';

    let row = `<tr data-shot-key="${esc(n)}" ${assigneeAttr} class="${expandedShot === n ? 'expanded' : ''} ${bulkSelected.has(n) ? 'bulk-selected' : ''} ${shot.starred ? 'starred-row' : ''} ${shot.done ? 'done-row' : ''}" onmousedown="handleRowMousedown(event,'${esc(n)}',false)" onclick="handleRowClick(event,'${esc(n)}',false)" oncontextmenu="showCtxMenu(event,'${esc(n)}')" ${assignee ? `onmouseenter="showAssigneeTooltip(event,this)" onmousemove="moveAssigneeTooltip(event)" onmouseleave="hideAssigneeTooltip()"` : ''} style="${rowStyle(shot, false)}">
        <td><span class="shot-name">${esc(n)}</span>${activeComments.length ? `<span class="comment-badge">${activeComments.length}</span>` : ''}</td>
        <td><span class="type-badge ${getTypeClass(shot.type)}">${esc(shot.type)}</span></td>
        <td><span class="version-num">v${esc(shot.version)}</span></td>
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
    if (opening) requestAnimationFrame(() => {
        const r = menu.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 8) {
            menu.style.top = 'auto'; menu.style.bottom = 'calc(100% + 4px)';
        } else { menu.style.top = ''; menu.style.bottom = ''; }
    });
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
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
                    <div class="detail-field" style="margin-bottom:0;"><label>Status</label>
                        ${makeCustomSelect(`status-${n}`, (dashboardData.custom_statuses||[]).map(s=>{const sn=typeof s==='string'?s:s.name,sc=typeof s==='string'?'#888888':(s.color||'#888888');return{value:sn,label:sn,color:sc};}), shot.status||'', v=>{ const sh=dashboardData.assets.find(a=>a.name===n); if(sh){sh.status=v;} autoSave(n); }, true)}
                        </div>
                    <div class="detail-field" style="margin-bottom:0;"><label>Difficulty</label>
                        ${makeCustomSelect(`difficulty-${n}`, [{value:'',label:'—',color:null}].concat((dashboardData.custom_difficulties||[]).map(d=>{const dn=typeof d==='string'?d:d.name,dc=typeof d==='string'?'#888888':(d.color||'#888888');return{value:dn,label:dn,color:dc};})), shot.difficulty||'', v=>{ const sh=dashboardData.assets.find(a=>a.name===n); if(sh){sh.difficulty=v;} autoSave(n); }, true)}
                        </div>
                    <div class="detail-field" style="margin-bottom:0;"><label>Assignee</label>
                        ${makeCustomSelect(`assignee-${n}`, [{value:'',label:'Unassigned',color:null}].concat((dashboardData.project_info?.credits||[]).filter(c=>c.name).map(c=>({value:c.name,label:c.name,color:c.color||null}))), shot.assignee||'', v=>{ const sh=dashboardData.assets.find(a=>a.name===n); if(sh){sh.assignee=v;} autoSave(n); }, true)}
                        </div>
                </div>
                <div class="detail-field"><label>Due Date</label>
                    <div style="display:flex;align-items:center;gap:0.4rem;">
                        <span id="duedate-display-${n}" style="font-family:var(--mono);font-size:0.78rem;color:var(--text-primary);flex:1;padding:0.4rem 0.5rem;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;min-height:1.8rem;cursor:pointer;" onclick="openDatePicker(v=>{ const s=dashboardData.assets.find(a=>a.name==='${n}'); if(s){s.due_date=v;document.getElementById('duedate-display-${n}').textContent=v||'—';autoSave('${n}');}}, '${shot.due_date||''}', this)">${shot.due_date||'—'}</span>
                        ${shot.due_date ? `<button class="btn-sm" style="font-size:0.6rem;padding:1px 6px;color:var(--text-muted);" onclick="const s=dashboardData.assets.find(a=>a.name==='${n}');if(s){s.due_date='';document.getElementById('duedate-display-${n}').textContent='—';autoSave('${n}');}">×</button>` : ''}
                        <button id="done-btn-${n}" class="ctx-toggle-btn${shot.done ? ' done-active' : ''}" style="gap:0.3rem;flex-shrink:0;padding:0.28rem 0.6rem;" onclick="(function(){ const sh=dashboardData.assets.find(a=>a.name==='${n}'); if(!sh) return; sh.done=!sh.done; const btn=document.getElementById('done-btn-${n}'); if(btn){btn.classList.toggle('done-active',sh.done);btn.textContent=sh.done?'\u2713 Done':'Mark as Done';btn.title=sh.done?'Mark undone':'Mark as done';} autoSave('${n}'); })()" title="${shot.done ? 'Mark undone' : 'Mark as done'}">${shot.done ? '\u2713 Done' : 'Mark as Done'}</button>
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
    activeBody.innerHTML = html || '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:2rem;">No assets found</td></tr>';

    if (expandedShot) _openDetailRowAnimation(activeBody);
    renderFloatingStars(); renderFloatingDone();

    if (!skipAnimation && oldActiveKeys.size > 0) {
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
                const iv = setInterval(() => { renderFloatingStars(); renderFloatingDone(); }, 30);
                setTimeout(() => {
                    clearInterval(iv);
                    // Switch to visible so dropdowns can escape the container
                    if (wrap) wrap.style.overflow = 'visible';
                }, 300);
            }
        });
    });
}

function toggleDetail(name) { expandedShot = expandedShot === name ? null : name; renderTable(true); }
function toggleExcludedSection() { _excludedExpanded = !_excludedExpanded; renderTable(true); }

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

const _starRotations = {};
function renderFloatingStars() {
    document.querySelectorAll('.floating-star').forEach(el => el.remove());
    const libOpen = document.getElementById('libraryModal').classList.contains('open');
    document.querySelectorAll('tr.starred-row').forEach(tr => {
        if (tr.closest('.excluded-section')) return;
        const rect = tr.getBoundingClientRect();
        const key = tr.dataset.shotKey || tr.dataset.libKey || '';
        if (_starRotations[key] === undefined) _starRotations[key] = Math.floor(Math.random() * 41) - 20;
        const star = document.createElement('div');
        star.className = 'floating-star';
        star.style.position = 'fixed';
        star.style.left = (rect.left + 2) + 'px';
        star.style.top = (rect.top + rect.height / 2 - 12) + 'px';
        star.style.transform = `rotate(${_starRotations[key]}deg)`;
        if (libOpen && tr.closest('#libTableBody')) star.style.zIndex = '310';
        star.textContent = '★';
        document.body.appendChild(star);
    });
}

function renderFloatingDone() {
    document.querySelectorAll('.floating-done').forEach(el => el.remove());
    const libOpen = document.getElementById('libraryModal').classList.contains('open');
    document.querySelectorAll('tr.done-row').forEach(tr => {
        if (tr.closest('.excluded-section')) return;
        const rect = tr.getBoundingClientRect();
        const check = document.createElement('div');
        check.className = 'floating-done';
        check.style.position = 'fixed';
        check.style.left = (rect.right - 20) + 'px';
        check.style.top = (rect.top + rect.height / 2 - 10) + 'px';
        if (libOpen && tr.closest('#libTableBody')) check.style.zIndex = '310';
        check.textContent = '✓';
        document.body.appendChild(check);
    });
}

function refreshBulkUI(isLib) {
    // Highlight rows
    const selector = isLib ? '#libTableBody tr' : '#shotsBody tr';
    document.querySelectorAll(selector).forEach(tr => {
        const key = tr.dataset.shotKey || tr.dataset.libKey;
        if (key) tr.classList.toggle('bulk-selected', bulkSelected.has(key));
    });

    // Remove old bar indicators + glow overlays
    document.querySelectorAll('.bulk-bar-indicator,.bulk-glow-overlay').forEach(el => el.remove());

    // Build contiguous groups of selected rows and render one bar per group
    const container = isLib ? '#libTableBody' : '#shotsBody';
    const selectedRows = [...document.querySelectorAll(`${container} tr.bulk-selected`)];
    if (selectedRows.length > 0) {
        const groups = [];
        let currentGroup = [selectedRows[0]];
        for (let i = 1; i < selectedRows.length; i++) {
            const prev = selectedRows[i - 1];
            const curr = selectedRows[i];
            // Check if adjacent — next visible sibling (skip detail rows)
            let next = prev.nextElementSibling;
            while (next && next.classList.contains('detail-row')) next = next.nextElementSibling;
            if (next === curr) {
                currentGroup.push(curr);
            } else {
                groups.push(currentGroup);
                currentGroup = [curr];
            }
        }
        groups.push(currentGroup);

        for (const group of groups) {
            const firstRect = group[0].getBoundingClientRect();
            const lastRect = group[group.length - 1].getBoundingClientRect();
            const bar = document.createElement('div');
            bar.className = 'bulk-bar-indicator';
            bar.style.left = (firstRect.left - 11) + 'px';
            bar.style.top = (firstRect.top + 3) + 'px';
            bar.style.height = (lastRect.bottom - firstRect.top - 6) + 'px';
            document.body.appendChild(bar);

            // Glow overlay
            const glow = document.createElement('div');
            glow.className = 'bulk-glow-overlay';
            glow.style.zIndex = isLib ? '310' : '49';
            glow.style.left = (firstRect.left - 2) + 'px';
            glow.style.top = firstRect.top + 'px';
            glow.style.width = (firstRect.width + 4) + 'px';
            glow.style.height = (lastRect.bottom - firstRect.top) + 'px';
            document.body.appendChild(glow);
        }
    }

    // Update action bar
    const bar = document.getElementById('bulkBar');
    if (bulkSelected.size > 0) {
        bar.classList.add('open');
        document.getElementById('bulkCount').textContent = bulkSelected.size + ' selected';
        // Position below lowest selected row
        let lowestBottom = 0;
        selectedRows.forEach(tr => {
            const rect = tr.getBoundingClientRect();
            if (rect.bottom > lowestBottom) lowestBottom = rect.bottom;
        });
        bar.style.position = 'fixed';
        bar.style.top = Math.min(lowestBottom + 24, window.innerHeight - 60) + 'px';
        bar.style.bottom = 'auto';
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
    document.querySelectorAll('.bulk-bar-indicator,.bulk-glow-overlay').forEach(el => el.remove());
    document.getElementById('bulkBar').classList.remove('open');
    closeBulkDropdown();
}

// Reposition floating elements on scroll
window.addEventListener('scroll', () => { requestAnimationFrame(() => { renderFloatingStars(); renderFloatingDone(); if (bulkSelected.size > 0) refreshBulkUI(document.getElementById('libraryModal').classList.contains('open')); }); }, true);
window.addEventListener('resize', () => { requestAnimationFrame(() => { renderFloatingStars(); renderFloatingDone(); }); });
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
        html = statuses.map(s => {
            const sn = statusName(s), sc = statusColor(s);
            return `<div class="bulk-dropdown-item" onclick="bulkSetStatus('${esc(sn)}')"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sc};margin-right:6px;"></span>${esc(sn)}</div>`;
        }).join('');
    } else if (type === 'difficulty') {
        const diffs = dashboardData.custom_difficulties || [];
        html = `<div class="bulk-dropdown-item" onclick="bulkSetDifficulty('')">— None</div>` +
            diffs.map(d => `<div class="bulk-dropdown-item" onclick="bulkSetDifficulty('${esc(statusName(d))}')">${esc(statusName(d))}</div>`).join('');
    } else if (type === 'assignee') {
        const credits = dashboardData.project_info?.credits?.filter(c => c.name) || [];
        html = `<div class="bulk-dropdown-item" onclick="bulkSetAssignee('')">Unassigned</div>` +
            credits.map(c => `<div class="bulk-dropdown-item" onclick="bulkSetAssignee('${esc(c.name)}')">${esc(c.name)}</div>`).join('');
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
    const btn = document.getElementById(type === 'status' ? 'bulkStatusBtn' : type === 'difficulty' ? 'bulkDiffBtn' : type === 'assignee' ? 'bulkAssignBtn' : type === 'due_date' ? 'bulkDueBtn' : 'bulkPlBtn');
    const barRect = bar.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    dd.style.left = (btnRect.left - barRect.left) + 'px';

    dd.innerHTML = html;
    dd.classList.add('open');
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
    _ctxRenderStatusChips(shot.status);
    _ctxRenderDifficultyChips(shot.difficulty);

    const pct = shot.completion || 0;
    document.getElementById('ctxCompletion').value = pct;
    document.getElementById('ctxPct').textContent = pct + '%';

    document.getElementById('ctxPlItems').style.display = '';
    document.getElementById('ctxPlNew').style.display = 'none';
    _ctxRenderPlaylistItems();

    const credits = dashboardData.project_info?.credits || [];
    const _ctxAssigneeContainer = document.getElementById('ctxAssigneeSelect');
    if (_ctxAssigneeContainer) {
        const _ctxAssigneeOpts = [{value:'',label:'Unassigned',color:null}].concat(credits.filter(c=>c.name).map(c=>({value:c.name,label:c.name,color:c.color||null})));
        _ctxAssigneeContainer.innerHTML = makeCustomSelect('ctxAssignee', _ctxAssigneeOpts, shot.assignee||'', v=>ctxSetAssignee(v), true);
    }
    if (!credits.length) document.getElementById('ctxAssigneeWrap').style.display = 'none';
    else document.getElementById('ctxAssigneeWrap').style.display = 'block';

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
    const shot = dashboardData.assets.find(s => s.name === _ctxShotName);
    if (!shot) return;
    shot.completion = parseInt(document.getElementById('ctxCompletion').value || '0');
    const autoStatus = applyAutoStatus(shot);
    if (autoStatus) { shot.status = autoStatus; _ctxRenderStatusChips(shot.status); fullRender = true; }
    await saveMeta(shot);
    if (_libCtxActive) { renderLibBody(); }
    else if (fullRender) { renderStats(); renderFilters(); renderTable(true); }
    else { renderStats(); patchRow(_ctxShotName); }
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

function setAssigneeFilter(name) {
    activeAssigneeFilter = name || null;
    renderAll();
}

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
    let status = document.getElementById(`status-${name}`)?.value || '';
    const difficulty = document.getElementById(`difficulty-${name}`)?.value || '';
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
    const assigneeCredit = assignee ? (dashboardData.project_info?.credits || []).find(c => c.name === assignee) : null;
    const assigneeColor = assigneeCredit?.color || 'var(--accent)';
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
}


async function sendAssetToAnchor(name) {
    if (!dashboardData) return;
    showToast('Sending to Anchor…');
    try {
        const r = await api('/api/send_asset_to_anchor', { root_path: dashboardData.root_path, asset_name: name });
        if (r.error) showToast('Error: ' + r.error);
        else if (r.skipped) showToast('⚓ Already in Anchor: ' + name);
        else showToast('⚓ Sent to Anchor: ' + name);
    } catch(e) { showToast('Could not reach Anchor'); }
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
// Settings modal
// ---------------------------------------------------------------------------
function openProjectSettings() {
    renderSettingsTags(); renderAutoRules(); renderScanFolderTags(); renderExcludedExtTags();
    document.getElementById('autoStatusEnabled').checked = dashboardData.auto_status_enabled || false;
    document.getElementById('projectSettingsModal').classList.add('open');
    loadSnapshotList();
}
function closeProjectSettings() { document.getElementById('projectSettingsModal').classList.remove('open'); }

function openSystemSettings() {
    // Sync demo mode checkbox
    const dmCb = document.getElementById('demoModeToggle');
    if (dmCb) dmCb.checked = localStorage.getItem('rgr_demo_mode') === '1';
    api('/api/get_config').then(cfg => {
        const cb = document.getElementById('launchOnStartup');
        if (cb) cb.checked = cfg.launch_on_startup || false;
        const sr = document.getElementById('sysStudioRoot');
        if (sr) sr.value = cfg.studio_root || '';
    });
    api('/api/get_studio_config').then(sc => {
        const cs = sc.cloud_sharing || {};
        document.getElementById('csEndpoint').value  = cs.r2_endpoint || '';
        document.getElementById('csAccessKey').value  = cs.r2_access_key || '';
        document.getElementById('csSecretKey').value  = cs.r2_secret_key || '';
        document.getElementById('csBucket').value     = cs.r2_bucket || '';
        document.getElementById('csTTL').value        = cs.session_ttl_hours || 48;
        document.getElementById('csShareURL').value   = cs.share_base_url || '';
        document.getElementById('csStatus').textContent = '';
    }).catch(() => {});
    document.getElementById('nsBasePath').value = '';
    document.getElementById('nsStudioName').value = '';
    document.getElementById('nsPreview').style.display = 'none';
    document.getElementById('nsError').style.display = 'none';
    document.getElementById('systemSettingsModal').classList.add('open');
}
function closeSystemSettings() { document.getElementById('systemSettingsModal').classList.remove('open'); }

function saveCloudSharing() {
    const status = document.getElementById('csStatus');
    const data = {
        cloud_sharing: {
            r2_endpoint:      document.getElementById('csEndpoint').value.trim(),
            r2_access_key:    document.getElementById('csAccessKey').value.trim(),
            r2_secret_key:    document.getElementById('csSecretKey').value.trim(),
            r2_bucket:        document.getElementById('csBucket').value.trim(),
            share_base_url:   document.getElementById('csShareURL').value.trim().replace(/\/+$/, ''),
            session_ttl_hours: parseInt(document.getElementById('csTTL').value) || 48,
        }
    };
    status.textContent = 'Saving…';
    status.style.color = 'var(--text-muted)';
    api('/api/save_studio_config', data).then(res => {
        if (res.ok) {
            status.textContent = '✓ Saved';
            status.style.color = '#22c55e';
        } else {
            status.textContent = '✗ ' + (res.error || 'Save failed');
            status.style.color = '#ef4444';
        }
    }).catch(() => {
        status.textContent = '✗ Save failed';
        status.style.color = '#ef4444';
    });
}

function testCloudConnection() {
    const status = document.getElementById('csStatus');
    const endpoint = document.getElementById('csEndpoint').value.trim();
    const bucket   = document.getElementById('csBucket').value.trim();
    if (!endpoint || !bucket) {
        status.textContent = '✗ Endpoint and bucket required';
        status.style.color = '#ef4444';
        return;
    }
    status.textContent = 'Testing…';
    status.style.color = 'var(--text-muted)';
    api('/api/test_cloud', {
        r2_endpoint:   endpoint,
        r2_access_key: document.getElementById('csAccessKey').value.trim(),
        r2_secret_key: document.getElementById('csSecretKey').value.trim(),
        r2_bucket:     bucket,
    }).then(res => {
        if (res.ok) {
            status.textContent = '✓ Connected';
            status.style.color = '#22c55e';
        } else {
            status.textContent = '✗ ' + (res.error || 'Connection failed');
            status.style.color = '#ef4444';
        }
    }).catch(() => {
        status.textContent = '✗ Connection failed';
        status.style.color = '#ef4444';
    });
}

// legacy aliases
function openSettings() { openProjectSettings(); }
function closeSettings() { closeProjectSettings(); }

// ---------------------------------------------------------------------------
// System Settings — studio root
// ---------------------------------------------------------------------------
function updateSysStudioPreview() { /* no live preview needed here */ }

async function browseSysStudioRoot() {
    openFileBrowser('folder', '', path => {
        if (path) document.getElementById('sysStudioRoot').value = path;
    });
}

async function saveSysStudioRoot() {
    const root = document.getElementById('sysStudioRoot').value.trim();
    if (!root) { showToast('Enter a studio root path first'); return; }
    const result = await api('/api/set_studio_root', { studio_root: root });
    if (result.error) { showToast('Error: ' + result.error); return; }
    showToast('Studio root saved');
    refreshPicker();
}

// ---------------------------------------------------------------------------
// New Studio (inside System Settings)
// ---------------------------------------------------------------------------
function updateNsPreview() {
    const base = (document.getElementById('nsBasePath').value || '').trimEnd().replace(/[/\\]+$/, '');
    const name = document.getElementById('nsStudioName').value.trim();
    const preview = document.getElementById('nsPreview');
    if (base && name) { preview.textContent = base + '\\' + name; preview.style.display = 'block'; }
    else { preview.style.display = 'none'; }
}

async function browseStudioBase() {
    openFileBrowser('folder', document.getElementById('nsBasePath').value.trim() || '', path => {
        if (path) { document.getElementById('nsBasePath').value = path; updateNsPreview(); }
    });
}

async function submitNewStudio() {
    const base_path   = document.getElementById('nsBasePath').value.trim();
    const studio_name = document.getElementById('nsStudioName').value.trim();
    const errEl       = document.getElementById('nsError');
    errEl.style.display = 'none';
    if (!base_path)   { errEl.textContent = 'Base path is required.';  errEl.style.display = 'block'; return; }
    if (!studio_name) { errEl.textContent = 'Studio name is required.'; errEl.style.display = 'block'; return; }
    const result = await api('/api/create_studio', { base_path, studio_name });
    if (result.error) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }
    // Update the studio root field in the same modal and save it
    document.getElementById('sysStudioRoot').value = result.path;
    document.getElementById('nsBasePath').value = '';
    document.getElementById('nsStudioName').value = '';
    document.getElementById('nsPreview').style.display = 'none';
    showToast(`✓ Studio "${studio_name}" created`);
    refreshPicker();
}

// ---------------------------------------------------------------------------
// Project Picker (splash screen)
// ---------------------------------------------------------------------------
async function refreshPicker() {
    const data = await fetch('/api/list_projects').then(r => r.json());
    const noStudio   = document.getElementById('pickerNoStudio');
    const listWrap   = document.getElementById('pickerProjectList');
    const items      = document.getElementById('pickerItems');
    const empty      = document.getElementById('pickerEmpty');
    const studioLbl  = document.getElementById('pickerStudioLabel');

    if (!data.studio_root) {
        noStudio.style.display = 'block';
        listWrap.style.display = 'none';
        return;
    }
    noStudio.style.display = 'none';
    listWrap.style.display = 'block';
    // show just the last two path parts as a label
    const parts = data.studio_root.replace(/\\/g, '/').split('/').filter(Boolean);
    studioLbl.textContent = parts.slice(-2).join(' / ');

    if (!data.projects || data.projects.length === 0) {
        items.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    items.innerHTML = data.projects.map(p => `
        <div onclick="loadPickerProject('${p.path.replace(/\\/g, '\\\\')}')"
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

async function loadPickerProject(path) {
    document.getElementById('projectPath').value = path;
    await loadProject();
}

// ---------------------------------------------------------------------------
// New Project modal
// ---------------------------------------------------------------------------
let _npStudioRoot = '';

async function openNewProject() {
    const cfg = await fetch('/api/get_config').then(r => r.json());
    _npStudioRoot = cfg.studio_root || '';
    document.getElementById('npProjectName').value = '';
    document.getElementById('npIsOneOff').checked = false;
    document.getElementById('npShots').value = '';
    document.getElementById('npPreview').style.display = 'none';
    document.getElementById('npError').style.display = 'none';
    const noStudio = document.getElementById('npNoStudio');
    noStudio.style.display = _npStudioRoot ? 'none' : 'block';
    document.getElementById('newProjectModal').classList.add('open');
    if (_npStudioRoot) setTimeout(() => document.getElementById('npProjectName').focus(), 60);
    updateNpPreview();
}

function closeNewProject() { document.getElementById('newProjectModal').classList.remove('open'); }

function updateNpPreview() {
    const name   = document.getElementById('npProjectName').value.trim();
    const oneoff = document.getElementById('npIsOneOff').checked;
    const preview = document.getElementById('npPreview');
    if (_npStudioRoot && name) {
        const sub = oneoff ? '01_Projects\\OneOffs\\' : '01_Projects\\';
        preview.textContent = _npStudioRoot.replace(/[/\\]+$/, '') + '\\' + sub + name;
        preview.style.display = 'block';
    } else { preview.style.display = 'none'; }
}

async function submitNewProject() {
    const project_name = document.getElementById('npProjectName').value.trim();
    const is_oneoff    = document.getElementById('npIsOneOff').checked;
    const shots_raw    = document.getElementById('npShots').value.trim();
    const shots        = shots_raw ? shots_raw.split(/\s+/).filter(Boolean) : [];
    const errEl        = document.getElementById('npError');
    errEl.style.display = 'none';
    if (!_npStudioRoot) { errEl.textContent = 'No studio root set. Go to ⚙ System first.'; errEl.style.display = 'block'; return; }
    if (!project_name)  { errEl.textContent = 'Project name is required.'; errEl.style.display = 'block'; return; }
    const result = await api('/api/create_project', { studio_root: _npStudioRoot, project_name, is_oneoff, shots });
    if (result.error) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }
    closeNewProject();
    const shotMsg = result.shots && result.shots.length ? ` + ${result.shots.length} shot(s)` : '';
    showToast(`✓ "${project_name}" created${shotMsg}`);
    refreshPicker();
}

function renderSettingsTags() {
    document.getElementById('statusTags').innerHTML = (dashboardData.custom_statuses || []).map((s, i) => {
        const sn = typeof s==='string'?s:s.name, sc = typeof s==='string'?'#888888':s.color;
        return `<span class="tag" style="border-color:${sc}40;"><span class="color-dot" style="background:${sc};"></span>${esc(sn)}${makeCustomSelect('status-color-'+i, PALETTE.map(c=>({value:c.hex,label:c.name,color:c.hex})), sc, v=>setStatusColor(i,v), false)}<span class="remove-tag" onclick="removeStatus(${i})">&#215;</span></span>`;
    }).join('');
    document.getElementById('difficultyTags').innerHTML = (dashboardData.custom_difficulties || []).map((d, i) => {
        const dn = typeof d==='string'?d:d.name, dc = typeof d==='string'?'#888888':d.color;
        return `<span class="tag" style="border-color:${dc}40;"><span class="color-dot" style="background:${dc};"></span>${esc(dn)}${makeCustomSelect('diff-color-'+i, PALETTE.map(c=>({value:c.hex,label:c.name,color:c.hex})), dc, v=>setDifficultyColor(i,v), false)}<span class="remove-tag" onclick="removeDifficulty(${i})">&#215;</span></span>`;
    }).join('');
}

function setStatusColor(i, color) { const s = dashboardData.custom_statuses[i]; if (typeof s==='string') dashboardData.custom_statuses[i]={name:s,color}; else s.color=color; renderSettingsTags(); }
function setDifficultyColor(i, color) { const d = dashboardData.custom_difficulties[i]; if (typeof d==='string') dashboardData.custom_difficulties[i]={name:d,color}; else d.color=color; renderSettingsTags(); }
function addStatus() { const v = document.getElementById('newStatusInput').value.trim(); const names = (dashboardData.custom_statuses||[]).map(s=>typeof s==='string'?s:s.name); if (v&&!names.includes(v)) { dashboardData.custom_statuses.push({name:v,color:PALETTE[dashboardData.custom_statuses.length%PALETTE.length].hex}); document.getElementById('newStatusInput').value=''; renderSettingsTags(); } }
function removeStatus(i) { dashboardData.custom_statuses.splice(i,1); renderSettingsTags(); }
function addDifficulty() { const v = document.getElementById('newDifficultyInput').value.trim(); const names = (dashboardData.custom_difficulties||[]).map(d=>typeof d==='string'?d:d.name); if (v&&!names.includes(v)) { dashboardData.custom_difficulties.push({name:v,color:PALETTE[dashboardData.custom_difficulties.length%PALETTE.length].hex}); document.getElementById('newDifficultyInput').value=''; renderSettingsTags(); } }
function removeDifficulty(i) { dashboardData.custom_difficulties.splice(i,1); renderSettingsTags(); }

function renderAutoRules() {
    const rules = dashboardData.auto_status_rules || [];
    const statuses = (dashboardData.custom_statuses||[]).map(s=>typeof s==='string'?s:s.name);    const container = document.getElementById('autoStatusRules');
    if (!rules.length) { container.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);padding:0.3rem 0;">No rules yet</div>'; return; }
    container.innerHTML = rules.map((r,i) => `<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.4rem;font-size:0.8rem;">
        <span style="font-family:var(--mono);color:var(--text-muted);min-width:1.5rem;">≥</span>
        <input type="number" min="0" max="100" value="${r.threshold}" onchange="updateAutoRule(${i},'threshold',parseInt(this.value))" style="width:60px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);font-family:var(--mono);font-size:0.8rem;padding:0.3rem 0.4rem;border-radius:4px;outline:none;">
        <span style="font-family:var(--mono);color:var(--text-muted);">%</span>
        <span style="color:var(--text-muted);margin:0 0.2rem;">→</span>
        ${makeCustomSelect('auto-rule-'+i, statuses.map(s=>({value:s,label:s,color:null})), r.status||'', v=>updateAutoRule(i,'status',v), true)}
        <span style="cursor:pointer;color:var(--text-muted);font-size:1rem;" onclick="removeAutoRule(${i})">&#215;</span>
    </div>`).join('');
}
function addAutoRule() { if (!dashboardData.auto_status_rules) dashboardData.auto_status_rules=[]; const statuses=(dashboardData.custom_statuses||[]).map(s=>typeof s==='string'?s:s.name); dashboardData.auto_status_rules.push({threshold:0,status:statuses[0]||'WIP'}); renderAutoRules(); }
function updateAutoRule(i,key,value) { if (dashboardData.auto_status_rules&&dashboardData.auto_status_rules[i]) dashboardData.auto_status_rules[i][key]=value; renderAutoRules(); }
function removeAutoRule(i) { if (dashboardData.auto_status_rules) dashboardData.auto_status_rules.splice(i,1); renderAutoRules(); }

function renderScanFolderTags() {
    const folders = dashboardData.scan_folders||[];
    document.getElementById('scanFolderTags').innerHTML = folders.length ? folders.map((f,i)=>`<span class="tag">${esc(f)}<span class="remove-tag" onclick="removeScanFolder(${i})">&#215;</span></span>`).join('') : '<span style="font-size:0.7rem;color:var(--text-muted);">All folders (no filter)</span>';
}
function addScanFolder() { const v=document.getElementById('newScanFolder').value.trim(); if (!v) return; if (!dashboardData.scan_folders) dashboardData.scan_folders=[]; if (!dashboardData.scan_folders.includes(v)) { dashboardData.scan_folders.push(v); document.getElementById('newScanFolder').value=''; renderScanFolderTags(); } }
function removeScanFolder(i) { dashboardData.scan_folders.splice(i,1); renderScanFolderTags(); }

function renderExcludedExtTags() {
    const exts = dashboardData.excluded_extensions||[];
    document.getElementById('excludedExtTags').innerHTML = exts.map((e,i)=>`<span class="tag">${esc(e)}<span class="remove-tag" onclick="removeExcludedExt(${i})">&#215;</span></span>`).join('');
}
function addExcludedExt() { let v=document.getElementById('newExcludedExt').value.trim().toLowerCase(); if (!v) return; if (!v.startsWith('.')) v='.'+v; if (!dashboardData.excluded_extensions) dashboardData.excluded_extensions=[]; if (!dashboardData.excluded_extensions.includes(v)) { dashboardData.excluded_extensions.push(v); document.getElementById('newExcludedExt').value=''; renderExcludedExtTags(); } }
function removeExcludedExt(i) { dashboardData.excluded_extensions.splice(i,1); renderExcludedExtTags(); }

async function saveSettings() {
    dashboardData.auto_status_enabled = document.getElementById('autoStatusEnabled').checked;
    await api('/api/save_settings', _buildSettingsPayload());
    if (dashboardData.auto_status_enabled) {
        for (const shot of dashboardData.assets) {
            if (shot.excluded) continue;
            const newStatus = applyAutoStatus(shot);
            if (newStatus && newStatus !== shot.status) {
                shot.status = newStatus;
                await saveMeta(shot);
            }
        }
    }
    closeSettings();
    dashboardData = await api('/api/scan?path=' + encodeURIComponent(dashboardData.root_path));
    renderAll(true); showToast('Settings saved');
}

document.getElementById('projectPath').addEventListener('keydown', e => { if (e.key==='Enter') loadProject(); });

if (projectTabs.length > 0 && projectTabs[activeTabIndex]) {
    loadTabProject(projectTabs[activeTabIndex].path);
} else {
    refreshPicker();
}

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
    document.querySelectorAll('.bulk-glow-overlay,.bulk-bar-indicator').forEach(el => el.remove());
    renderLibTabs();
    if (libTabs.length > 0 && libTabs[libActiveTab]) loadLibTab(libTabs[libActiveTab].path);
    else renderLibEmpty();
    document.addEventListener('keydown', libEscHandler);
}

function closeLibrary() {
    document.getElementById('libraryModal').classList.remove('open');
    document.removeEventListener('keydown', libEscHandler);
    clearBulkSelection();
    document.querySelectorAll('.floating-star').forEach(el => el.remove());
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
    libData = await api('/api/scan?path=' + encodeURIComponent(path));
    if (libData.error) { showToast(libData.error, true); renderLibEmpty(); document.getElementById('libReviewBtn').style.display = 'none'; return; }
    dashboardData = libData;
    // Load library playlists once
    const result = await api('/api/playlists?path=' + encodeURIComponent(libData.root_path));
    libPlaylists = result.playlists || [];
    document.getElementById('libReviewBtn').style.display = '';
    renderLibBody();
}

function renderLibEmpty() {
    document.getElementById('libBody').innerHTML = '<div class="lib-empty">Add a folder to get started — click the <strong>+</strong> tab above.</div>';
    document.getElementById('libReviewBtn').style.display = 'none';
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

