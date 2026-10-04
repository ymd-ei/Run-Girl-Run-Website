/**
 * Data Bridge — v3 Editor
 * Loads content.json + project JSONs into editor state.
 * Handles dirty tracking, auth, and saving via backend API.
 *
 * Independent copy of the v2 data bridge so v3 does not depend on src/editor-v2/
 * (which is being retired). Same backend worker, same endpoints.
 */

import { projectTypes, projectTypeLabels } from '../utils/projectTypes.js';

// ── API config (set by the editor host page before module loads) ──
const API_BASE =
  window.__V3_API_BASE ||
  window.__V2_API_BASE ||
  window.RGR_CONFIG?.apiBase;

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

export function getDirtyFiles() {
  return Array.from(dirtyFiles);
}

function dispatchStatusEvent() {
  window.dispatchEvent(new CustomEvent('v3-save-status', {
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

export function getApiBase() {
  return API_BASE;
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

  // Keep ONE object shared by both state.projects and the cache so edits via
  // either path stay in sync (saveSiteData reads the cache; pushData reads
  // state.projects). Merge full data onto the existing card object in place.
  const idx = state.projects.findIndex(p => p.id === id);
  let obj = full;
  if (idx >= 0) {
    obj = Object.assign(state.projects[idx], full);
  }
  state.projectCache.set(id, obj);
  return obj;
}

/**
 * Save all dirty files to the backend (commits to GitHub)
 */
const STATIC_PAGES = ['index.html', 'mobile.html'];

function escAttrValue(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Replace the content="" of a <meta> found by its property/name attribute.
function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta\\s[^>]*${attr}="${key}"[^>]*\\scontent=")[^"]*(")`);
  return re.test(html) ? html.replace(re, (_, a, b) => a + escAttrValue(value) + b) : html;
}

export function patchPageMeta(html, g) {
  const siteUrl = (html.match(/property="og:url"[^>]*content="([^"]+)"/) || [])[1] || location.origin + '/';
  const abs = p => (!p || /^https?:/i.test(p) ? p : new URL(p, siteUrl).href);
  let out = html;

  const title = g.siteTitle || g.name;
  if (title) out = out.replace(/<title>[^<]*<\/title>/, () => `<title>${escAttrValue(title)}</title>`);
  if (g.ogTitle) {
    out = setMeta(out, 'property', 'og:title', g.ogTitle);
    out = setMeta(out, 'name', 'twitter:title', g.ogTitle);
  }
  if (g.ogDescription) {
    out = setMeta(out, 'property', 'og:description', g.ogDescription);
    out = setMeta(out, 'name', 'twitter:description', g.ogDescription);
    if (/<meta\s[^>]*name="description"/.test(out)) out = setMeta(out, 'name', 'description', g.ogDescription);
    else out = out.replace(/(<title>[^<]*<\/title>)/, t => `${t}\n<meta name="description" content="${escAttrValue(g.ogDescription)}">`);
  }
  if (g.ogImage) {
    out = setMeta(out, 'property', 'og:image', abs(g.ogImage));
    out = setMeta(out, 'name', 'twitter:image', abs(g.ogImage));
  }
  if (g.favicon) {
    out = out.replace(/(<link\s[^>]*rel="(?:icon|apple-touch-icon|mask-icon)"[^>]*\shref=")[^"]*(")/g, (_, a, b) => a + escAttrValue(g.favicon) + b);
  }
  if (g.name) {
    out = out.replace(/(<div id="loader-name" data-name=")[^"]*(")/, (_, a, b) => a + escAttrValue(g.name) + b);
  }
  return out;
}

/* ── Project share pages ─────────────────────────────────
 * Each published project gets p/<id>/index.html: a tiny page whose meta tags
 * give link previews (Discord, iMessage...) the project's title, text and
 * thumbnail, then sends visitors on to ?project=<id>. The Share button links
 * here. (Ported from the legacy editor; v3 didn't write these before, so
 * projects published from v3 had no preview page.)
 */
const SHARE_SITE = 'https://rungirlrun.studio';

function projectDescription(proj, card, g) {
  if (proj?.description) return proj.description;
  for (const b of proj?.blocks || []) {
    if ((b.type === 'text-md' || b.type === 'text-sm') && b.content) {
      const plain = String(b.content).replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
      if (plain) return plain.length > 160 ? plain.slice(0, 157) + '…' : plain;
    }
  }
  const types = projectTypeLabels(proj || card, g.filters).join(' / ');
  return [types, card.year].filter(Boolean).join(' · ') + ` — ${g.name || 'Run Girl Run'}`;
}

function sharePageHTML(card, proj, g) {
  const site = g.name || 'Run Girl Run';
  // Encoded so file names with spaces still work for preview bots
  const abs = p => (!p ? '' : /^https?:/i.test(p) ? p : encodeURI(`${SHARE_SITE}/${String(p).replace(/^\/+/, '')}`));
  const title = card.title || 'Project';
  const desc = projectDescription(proj, card, g);
  const image = abs(card.thumbnail || g.ogImage || 'media/rgr_fav.png');
  const url = `${SHARE_SITE}/p/${card.id}/`;
  const go = `${SHARE_SITE}/?project=${encodeURIComponent(card.id)}`;
  const e = escAttrValue;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(title)} — ${e(site)}</title>
<meta name="description" content="${e(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${e(url)}">
<meta property="og:site_name" content="${e(site)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:image" content="${e(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(desc)}">
<meta name="twitter:image" content="${e(image)}">
<link rel="canonical" href="${e(url)}">
<script>window.location.replace(${JSON.stringify(go)});<\/script>
</head>
<body>
<p><a href="${e(go)}">${e(title)} — ${e(site)}</a></p>
</body>
</html>
`;
}

/** Share pages for every published project (unchanged ones commit as no-ops). */
function buildSharePages(g) {
  const out = {};
  for (const card of g.projectCards || []) {
    if (!card.published || !card.id) continue;
    out[`p/${card.id}/index.html`] = sharePageHTML(card, state.projectCache.get(card.id), g);
  }
  return out;
}

// Fetch the pages fresh from GitHub (not the possibly-cached live site) so we
// never commit back stale page code; only pages whose tags changed are returned.
async function buildPatchedPages(g) {
  const cfg = window.RGR_CONFIG || {};
  const out = {};
  for (const path of STATIC_PAGES) {
    try {
      const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${path}?ref=${cfg.branch || 'main'}`, {
        headers: { Accept: 'application/vnd.github.raw' },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(String(res.status));
      const html = await res.text();
      const patched = patchPageMeta(html, g);
      if (patched !== html) out[path] = patched;
    } catch (err) {
      console.warn(`SEO tags not updated in ${path}:`, err);
    }
  }
  return out;
}

export async function saveSiteData() {
  if (saveInFlight) return { success: false, error: 'Save already in progress' };
  if (dirtyFiles.size === 0) return { success: true, message: 'Nothing to save' };

  saveInFlight = true;
  dispatchStatusEvent();

  try {
    // A project saved without a date gets today's (shown in Details → Date, editable)
    const today = new Date().toLocaleDateString('en-CA');
    for (const path of dirtyFiles) {
      const m = path.match(/^projects\/(.+)\.json$/);
      const proj = m && state.projectCache.get(m[1]);
      const live = proj && state.projects.find(p => p.id === m[1]);
      for (const x of [proj, live]) if (x && !x.date) x.date = today;
    }

    // Sync projectCards into content.json from current project state
    state.global.projectCards = state.projects.map(p => ({
      id: p.id,
      title: p.title,
      types: projectTypes(p),
      type: projectTypes(p)[0] || '',
      typeLabel: projectTypeLabels(p, state.global.filters)[0] || '',
      year: p.year,
      date: p.date || '',
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
        if (proj) {
          // Strip card-only fields back out is unnecessary; project JSON keeps full shape
          files[path] = JSON.stringify(proj, null, 2);
        }
      }
    }

    // Always include content.json if any project changed (projectCards sync)
    if (Object.keys(files).some(k => k.startsWith('projects/'))) {
      files['content.json'] = JSON.stringify(state.global, null, 2);
    }

    // Write title / social-preview / favicon / loader name into the static
    // pages, where link previews and search engines read them.
    if (files['content.json']) {
      Object.assign(files, await buildPatchedPages(state.global));
      Object.assign(files, buildSharePages(state.global));
    }

    if (Object.keys(files).length === 0) {
      saveInFlight = false;
      dispatchStatusEvent();
      return { success: true, message: 'Nothing to save' };
    }

    const res = await fetch(`${API_BASE}/api/save`, authHeaders({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, message: 'Editor v3: save changes' })
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

/**
 * Upload a file to the media directory.
 */
export async function uploadMedia(file, folder = 'media') {
  // Check the size before sending anything (the backend rejects larger files anyway).
  const maxMB = (window.RGR_CONFIG && window.RGR_CONFIG.maxUploadMB) || 20;
  if (file.size > maxMB * 1024 * 1024) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { success: false, error: `${file.name} is ${mb} MB — the editor limit is ${maxMB} MB. Compress it, or add it to media/ on your computer and push with git.` };
  }
  const form = new FormData();
  form.append('file', file);
  form.append('folder', folder);

  const token = getSessionToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/media`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: form
  });

  const result = await res.json();
  if (!res.ok || !result.success) {
    return { success: false, error: result.error || 'Upload failed' };
  }
  return { success: true, path: result.path };
}

/**
 * List all media files from the backend.
 */
export async function fetchMediaFiles() {
  try {
    const res = await fetch(`${API_BASE}/api/media`, authHeaders({ method: 'GET' }));
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch { return []; }
}

/**
 * Delete a media file from the backend.
 */
export async function deleteMedia(path) {
  const res = await fetch(`${API_BASE}/api/media`, authHeaders({
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  }));
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return { success: false, error: data.error || 'Delete failed' };
  }
  return { success: true };
}

/**
 * Create a new project with a generated slug.
 */
export function createProject(title) {
  const slug = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'new-project';
  let id = slug;
  let n = 2;
  while (state.projects.some(p => p.id === id)) {
    id = slug + '-' + n++;
  }

  const project = {
    id,
    title: title || 'New Project',
    types: [],
    type: '',
    typeLabel: '',
    year: new Date().getFullYear().toString(),
    date: new Date().toLocaleDateString('en-CA'),
    client: '',
    duration: '',
    tags: [],
    thumbnail: '',
    videoUrl: '',
    longform: false,
    published: false,
    blocks: []
  };

  state.projects.push(project);
  state.projectCache.set(id, project);

  if (!state.global.projects) state.global.projects = [];
  state.global.projects.push(id);

  markDirty('content.json');
  markDirty('projects/' + id + '.json');
  return project;
}

/**
 * Delete a project by ID.
 */
export function deleteProject(id) {
  const idx = state.projects.findIndex(p => p.id === id);
  if (idx === -1) return false;

  state.projects.splice(idx, 1);
  state.projectCache.delete(id);

  if (state.global.projects) {
    state.global.projects = state.global.projects.filter(pid => pid !== id);
  }
  if (state.global.projectCards) {
    state.global.projectCards = state.global.projectCards.filter(c => c.id !== id);
  }

  markDirty('content.json');
  return true;
}
