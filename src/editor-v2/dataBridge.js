/**
 * Data Bridge — v2 Editor
 * Loads content.json + project JSONs into editor state.
 * Handles dirty tracking, auth, and saving via backend API.
 */

// ── API config (set by editor-v2.html before module loads) ──
const API_BASE = window.__V2_API_BASE || 'https://rgr-editor-backend.rungirlrun.workers.dev';

export const state = {
  global: {},
  projects: [],
  projectCache: new Map()
};

// ── Dirty tracking ──
const dirtyFiles = new Set();
let saveInFlight = false;

export function markDirty(path) {
  dirtyFiles.add(path);
  dispatchStatusEvent();
}

export function isDirty() {
  return dirtyFiles.size > 0;
}

function dispatchStatusEvent() {
  window.dispatchEvent(new CustomEvent('v2-save-status', {
    detail: { dirty: dirtyFiles.size > 0, saving: saveInFlight }
  }));
}

// ── Auth helpers ──
function getSessionToken() {
  return localStorage.getItem('editor_session_token') || '';
}

function authHeaders(extra = {}) {
  const token = getSessionToken();
  const headers = { ...(extra.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return { credentials: 'include', ...extra, headers };
}

export async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/auth/check`, authHeaders({ method: 'GET' }));
    if (!res.ok) return null;
    const data = await res.json();
    return data.authenticated ? data : null;
  } catch { return null; }
}

export function getLoginUrl() {
  return `${API_BASE}/auth/login`;
}

export function getLogoutUrl() {
  return `${API_BASE}/auth/logout`;
}

/**
 * Load all site data from content.json and project files
 */
export async function loadSiteData() {
  const res = await fetch('content.json');
  if (!res.ok) throw new Error('Failed to load content.json');
  const data = await res.json();

  state.global = data;
  state.projectCache.clear();

  // Load project cards (lightweight metadata)
  const projectIds = data.projects || [];
  const cards = Array.isArray(data.projectCards) ? data.projectCards : [];

  if (cards.length) {
    const cardById = new Map(cards.map(c => [c.id, c]));
    state.projects = projectIds.map(id => cardById.get(id)).filter(Boolean);
  } else {
    // Fallback: load full project JSONs
    const loaded = await Promise.all(
      projectIds.map(id =>
        fetch('projects/' + id + '.json')
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );
    state.projects = loaded.filter(Boolean);
  }

  state.projects.forEach(p => {
    if (p && p.id) state.projectCache.set(p.id, p);
  });

  return state;
}

/**
 * Load full project data (blocks) by ID
 */
export async function loadProject(id) {
  const cached = state.projectCache.get(id);
  if (cached && Array.isArray(cached.blocks)) return cached;

  const res = await fetch('projects/' + id + '.json');
  if (!res.ok) return null;
  const full = await res.json();

  state.projectCache.set(id, full);

  const idx = state.projects.findIndex(p => p.id === id);
  if (idx >= 0) state.projects[idx] = full;

  return full;
}

/**
 * Save all dirty files to the backend (commits to GitHub)
 */
export async function saveSiteData() {
  if (saveInFlight) return { success: false, error: 'Save already in progress' };
  if (dirtyFiles.size === 0) return { success: true, message: 'Nothing to save' };

  saveInFlight = true;
  dispatchStatusEvent();

  try {
    // Sync projectCards into content.json from current project state
    state.global.projectCards = state.projects.map(p => ({
      id: p.id,
      title: p.title,
      type: p.type,
      typeLabel: p.typeLabel,
      year: p.year,
      thumbnail: p.thumbnail,
      published: !!p.published,
      sensitive: !!p.sensitive,
      sensitiveLabel: p.sensitiveLabel || '',
      sensitiveColor: p.sensitiveColor || '',
      longform: !!p.longform
    }));

    // Build files map
    const files = {};

    if (dirtyFiles.has('content.json')) {
      files['content.json'] = JSON.stringify(state.global, null, 2);
    }

    for (const path of dirtyFiles) {
      const m = path.match(/^projects\/(.+)\.json$/);
      if (m) {
        const proj = state.projectCache.get(m[1]);
        if (proj) files[path] = JSON.stringify(proj, null, 2);
      }
    }

    // Always include content.json if any project changed (projectCards sync)
    if (Object.keys(files).some(k => k.startsWith('projects/'))) {
      files['content.json'] = JSON.stringify(state.global, null, 2);
    }

    if (Object.keys(files).length === 0) {
      saveInFlight = false;
      dispatchStatusEvent();
      return { success: true, message: 'Nothing to save' };
    }

    const res = await fetch(`${API_BASE}/api/save`, authHeaders({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, message: 'Editor v2: save changes' })
    }));

    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.error || 'Save failed');
    }

    dirtyFiles.clear();
    saveInFlight = false;
    dispatchStatusEvent();
    return { success: true, commit: result.commit };
  } catch (err) {
    saveInFlight = false;
    dispatchStatusEvent();
    return { success: false, error: err.message };
  }
}
