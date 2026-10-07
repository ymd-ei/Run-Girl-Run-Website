/**
 * Media page — v3 Editor
 *
 * A full-page media library opened from the left rail (the picker modal in
 * media.js is still used when choosing a file for a field). Browse by type,
 * upload (button or drag-and-drop), preview, copy a path, see where a file is
 * used across the site, and delete with a warning if it's still in use.
 */

import { state, fetchMediaFiles, uploadMedia, deleteMedia, loadProject } from './dataBridge.js';
import { webReadyToggleHtml, bindWebReadyToggle } from './webReady.js';

const TYPES = [
  ['all', 'All'],
  ['image', 'Images'],
  ['video', 'Video'],
  ['model', '3D models'],
  ['other', 'Other']
];

let root = null;
let files = null;
let usage = new Map();   // path → ['Site settings', 'Project: …', …]
let type = 'all';
let filter = '';
let selected = null;

function kind(p) {
  if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(p)) return 'image';
  if (/\.(mp4|webm|mov|m4v)$/i.test(p)) return 'video';
  if (/\.(glb|gltf)$/i.test(p)) return 'model';
  return 'other';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtSize(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

function toast(msg, err) { window.__v3toast && window.__v3toast(msg, err); }

// Pages in /modelling/ reach site files one level up.
const ROOT = location.pathname.includes('/modelling/') ? '../' : '';
let liveSources = null; // optional [{ label, json }] from the host editor's unsaved state

async function fetchText(path) {
  try {
    const res = await fetch(ROOT + path, { cache: 'no-cache' });
    return res.ok ? await res.text() : null;
  } catch (_) { return null; }
}

// Where each media path is referenced: site content, every project, the modelling site.
async function buildUsage() {
  usage = new Map();
  const note = (json, where) => {
    if (!json) return;
    for (const f of files || []) {
      if (json.includes(f.path)) {
        if (!usage.has(f.path)) usage.set(f.path, []);
        usage.get(f.path).push(where);
      }
    }
  };
  const live = new Set((liveSources || []).map(x => x.label));
  for (const src of liveSources || []) note(src.json, src.label);

  if (Object.keys(state.global || {}).length) {
    // Inside editor v3: use its in-memory (possibly unsaved) content.
    note(JSON.stringify(state.global), 'Site content');
    await Promise.all((state.projects || []).map(p => loadProject(p.id).catch(() => null)));
    for (const p of state.projects || []) {
      note(JSON.stringify(state.projectCache.get(p.id) || p), 'Project: ' + (p.title || p.id));
    }
  } else {
    // Elsewhere (modelling editor): read the saved site files.
    const siteText = await fetchText('content.json');
    note(siteText, 'Site content');
    let ids = [];
    try { ids = JSON.parse(siteText || '{}').projects || []; } catch (_) { /* no projects */ }
    const projects = await Promise.all(ids.map(async id => [id, await fetchText('projects/' + id + '.json')]));
    for (const [id, json] of projects) {
      let title = id;
      try { title = JSON.parse(json).title || id; } catch (_) { /* keep id */ }
      note(json, 'Project: ' + title);
    }
  }
  if (!live.has('Modelling site')) note(await fetchText('modelling/content.json'), 'Modelling site');
}

function visible() {
  return (files || []).filter(f =>
    (type === 'all' || kind(f.path) === type) &&
    (!filter || f.path.toLowerCase().includes(filter.toLowerCase())));
}

function thumb(f) {
  const k = kind(f.path);
  if (k === 'image') return `<img src="${esc(f.url || f.path)}" loading="lazy" alt="">`;
  const icon = k === 'video' ? 'ph-film-strip' : k === 'model' ? 'ph-cube' : 'ph-file';
  return `<div class="v3-mp-icon"><i class="ph-fill ${icon}"></i></div>`;
}

function renderGrid() {
  const grid = root.querySelector('.v3-mp-grid');
  const list = visible();
  root.querySelector('.v3-mp-count').textContent = `${list.length} file${list.length === 1 ? '' : 's'}`;
  if (!list.length) {
    grid.innerHTML = `<div class="v3-mp-empty">${files.length ? 'No files match.' : 'No media yet — upload or drop files here.'}</div>`;
    return;
  }
  grid.innerHTML = list.map(f => {
    const name = f.path.split('/').pop();
    const used = usage.has(f.path);
    return `<button class="v3-mp-item${selected === f.path ? ' active' : ''}" data-path="${esc(f.path)}" title="${esc(f.path)}">
      ${thumb(f)}
      <span class="v3-mp-name">${esc(name)}</span>
      ${used ? '' : '<span class="v3-mp-unused" title="Not used anywhere on the site">unused</span>'}
    </button>`;
  }).join('');
}

function renderDetail() {
  const pane = root.querySelector('.v3-mp-detail');
  const f = (files || []).find(x => x.path === selected);
  if (!f) {
    pane.innerHTML = `<p class="v3-mp-note">Select a file to preview it, copy its path or see where it's used.</p>`;
    return;
  }
  const k = kind(f.path);
  const preview = k === 'image'
    ? `<img src="${esc(f.url || f.path)}" alt="">`
    : k === 'video'
      ? `<video src="${esc(f.url || f.path)}" controls playsinline preload="metadata"></video>`
      : `<div class="v3-mp-icon big"><i class="ph-fill ${k === 'model' ? 'ph-cube' : 'ph-file'}"></i></div>`;
  const used = usage.get(f.path) || [];
  pane.innerHTML = `
    <div class="v3-mp-preview">${preview}</div>
    <div class="v3-mp-path"><code>${esc(f.path)}</code>
      <button class="v3-mp-ico" data-copy="${esc(f.path)}" title="Copy path"><i class="ph-fill ph-copy"></i></button></div>
    <p class="v3-mp-meta">${esc(fmtSize(f.size))}</p>
    <div class="v3-mp-subhead">Used in</div>
    ${used.length ? `<ul class="v3-mp-used">${used.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` : '<p class="v3-mp-meta">Not used anywhere on the site.</p>'}
    <button class="v3-mp-delete" data-delete="${esc(f.path)}"><i class="ph-fill ph-trash"></i> Delete file</button>`;
}

async function uploadFiles(list) {
  const arr = [...list];
  if (!arr.length) return;
  const status = root.querySelector('.v3-mp-status');
  let ok = 0;
  for (let i = 0; i < arr.length; i++) {
    const file = arr[i];
    status.textContent = `Uploading ${i + 1} of ${arr.length}: ${file.name}…`;
    // Keep 3D models in media/models/ so the modelling site finds them.
    const res = await uploadMedia(file, kind(file.name) === 'model' ? 'media/models' : 'media');
    if (res.success) { ok++; if (res.note) toast(res.note); }
    else toast(res.error.includes(file.name) ? res.error : `Upload failed (${file.name}): ${res.error}`, true);
  }
  status.textContent = '';
  if (ok) {
    toast(`Uploaded ${ok} file${ok === 1 ? '' : 's'}`);
    await refresh();
  }
}

async function doDelete(path) {
  const used = usage.get(path) || [];
  const warn = used.length
    ? `\n\nIt's still used in:\n• ${used.join('\n• ')}\n\nThose spots will show a broken file.`
    : '';
  if (!confirm(`Delete ${path}? This can't be undone.${warn}`)) return;
  const res = await deleteMedia(path);
  if (res.success) {
    toast('Deleted ' + path);
    selected = null;
    await refresh();
  } else {
    toast('Delete failed: ' + res.error, true);
  }
}

async function refresh() {
  files = (await fetchMediaFiles()).filter(f => f && f.path);
  files.sort((a, b) => a.path.localeCompare(b.path));
  await buildUsage();
  renderGrid();
  renderDetail();
}

function bind() {
  bindWebReadyToggle(root);
  root.querySelector('.v3-mp-types').addEventListener('click', e => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    type = b.getAttribute('data-type');
    root.querySelectorAll('.v3-mp-types button').forEach(x => x.classList.toggle('active', x === b));
    renderGrid();
  });
  root.querySelector('.v3-mp-filter').addEventListener('input', e => { filter = e.target.value; renderGrid(); });
  root.querySelector('.v3-mp-upload input').addEventListener('change', e => { uploadFiles(e.target.files); e.target.value = ''; });
  root.querySelector('.v3-mp-grid').addEventListener('click', e => {
    const item = e.target.closest('[data-path]');
    if (!item) return;
    selected = item.getAttribute('data-path');
    renderGrid();
    renderDetail();
  });
  root.querySelector('.v3-mp-detail').addEventListener('click', e => {
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      navigator.clipboard?.writeText(copy.getAttribute('data-copy')).then(() => toast('Path copied')).catch(() => {});
      return;
    }
    const del = e.target.closest('[data-delete]');
    if (del) doDelete(del.getAttribute('data-delete'));
  });

  // Drag-and-drop anywhere on the page
  const body = root.querySelector('.v3-mp-body');
  body.addEventListener('dragover', e => { e.preventDefault(); body.classList.add('drop'); });
  body.addEventListener('dragleave', e => { if (!body.contains(e.relatedTarget)) body.classList.remove('drop'); });
  body.addEventListener('drop', e => {
    e.preventDefault();
    body.classList.remove('drop');
    if (e.dataTransfer && e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
  });
}

/** Render the media page into the given panel element. */
export async function showMediaPage(panelEl, { authed, sources } = {}) {
  liveSources = sources || null;
  panelEl.innerHTML = '<div class="v3-mp-root"></div>';
  root = panelEl.firstElementChild;
  root.innerHTML = `<div class="v3-mp-head"><span>Media Library</span>
      <span class="v3-mp-status"></span>
      ${webReadyToggleHtml()}
      <label class="v3-mp-btn v3-mp-upload"><i class="ph-fill ph-upload-simple"></i> Upload
        <input type="file" multiple accept="image/*,video/*,.glb,.gltf,.pdf,model/gltf-binary,model/gltf+json" hidden></label></div>
    <div class="v3-mp-body">
      <p class="v3-mp-note v3-mp-limit">Uploads up to ${(window.RGR_CONFIG && window.RGR_CONFIG.maxUploadMB) || 20} MB per file, after the WebP conversion when "Make web-friendly" is on (images and model textures shrink first; videos don't). Larger files: compress them, or add to media/ on your computer and push with git.</p>
      <div class="v3-mp-main">
        <div class="v3-mp-toolbar">
          <div class="v3-mp-types">${TYPES.map(([v, l]) => `<button data-type="${v}" class="${v === type ? 'active' : ''}">${l}</button>`).join('')}</div>
          <input class="v3-mp-input v3-mp-filter" type="text" placeholder="Filter by name…" value="${esc(filter)}">
          <span class="v3-mp-count"></span>
        </div>
        <div class="v3-mp-grid"><div class="v3-mp-empty">${authed === false ? 'Log in to see and manage media.' : 'Loading…'}</div></div>
      </div>
      <aside class="v3-mp-detail"></aside>
    </div>`;
  bind();
  renderDetail();
  if (authed === false) return;
  await refresh();
}
