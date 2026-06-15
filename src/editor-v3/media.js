/**
 * Media picker — v3 Editor
 *
 * A modal that lists media from the backend, supports upload + delete, and
 * returns a chosen path via callback. Reuses dataBridge media functions.
 */

import { fetchMediaFiles, uploadMedia, deleteMedia } from './dataBridge.js';

let modal = null;
let onPickCb = null;
let cache = null;

function isImage(p) { return /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(p); }
function isVideo(p) { return /\.(mp4|webm|mov|m4v)$/i.test(p); }
function isModel(p) { return /\.(glb|gltf)$/i.test(p); }

function build() {
  modal = document.createElement('div');
  modal.id = 'v3-media-modal';
  modal.innerHTML = `
    <div class="v3-media-backdrop"></div>
    <div class="v3-media-dialog">
      <div class="v3-media-head">
        <span>Media Library</span>
        <div class="v3-media-head-tools">
          <label class="v3-media-upload"><i class="ph-fill ph-upload-simple"></i> Upload
            <input type="file" accept="image/*,video/*,.glb,.gltf,model/gltf-binary,model/gltf+json" hidden></label>
          <button class="v3-media-close" title="Close"><i class="ph-fill ph-x"></i></button>
        </div>
      </div>
      <div class="v3-media-search"><input type="text" placeholder="Filter files…"></div>
      <div class="v3-media-grid"></div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('.v3-media-backdrop').addEventListener('click', close);
  modal.querySelector('.v3-media-close').addEventListener('click', close);
  modal.querySelector('.v3-media-search input').addEventListener('input', e => renderGrid(e.target.value));
  modal.querySelector('.v3-media-upload input').addEventListener('change', onUpload);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) close(); });

  modal.querySelector('.v3-media-grid').addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) { e.stopPropagation(); doDelete(del.getAttribute('data-del')); return; }
    const item = e.target.closest('[data-path]');
    if (item) pick(item.getAttribute('data-path'));
  });
}

function isOpen() { return modal && modal.classList.contains('show'); }

async function load(force) {
  if (!cache || force) cache = await fetchMediaFiles();
  return cache;
}

function renderGrid(filter = '') {
  const grid = modal.querySelector('.v3-media-grid');
  const files = (cache || []).filter(f => !filter || (f.name || f.path).toLowerCase().includes(filter.toLowerCase()));
  if (!files.length) {
    grid.innerHTML = `<div class="v3-media-empty">No media files${filter ? ' match' : ' yet'}.</div>`;
    return;
  }
  grid.innerHTML = files.map(f => {
    const p = f.path || f.name;
    const url = f.url || p;
    const basename = (f.name || p).split('/').pop();
    const ext = basename.includes('.') ? basename.split('.').pop() : '';
    const stem = ext ? basename.slice(0, -(ext.length + 1)) : basename;
    const thumb = isImage(p)
      ? `<img src="${url}" loading="lazy" alt="">`
      : isVideo(p)
        ? `<div class="v3-media-vid"><i class="ph-fill ph-film-strip"></i></div>`
        : isModel(p)
          ? `<div class="v3-media-vid"><i class="ph-fill ph-cube"></i></div>`
          : `<div class="v3-media-file"><i class="ph-fill ph-file"></i></div>`;
    return `<div class="v3-media-item" data-path="${p}" title="${p}">
      ${thumb}
      <div class="v3-media-label">
        <span class="v3-media-name">${stem || basename}</span>
        ${ext ? `<span class="v3-media-ext">${ext}</span>` : ''}
      </div>
      <button class="v3-media-del" data-del="${p}" title="Delete"><i class="ph-fill ph-trash"></i></button>
    </div>`;
  }).join('');
}

async function onUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const grid = modal.querySelector('.v3-media-grid');
  grid.insertAdjacentHTML('afterbegin', `<div class="v3-media-empty" id="v3-upm">Uploading ${file.name}…</div>`);
  // Keep 3D models in media/models/ so the work picker and viewer find them.
  const folder = isModel(file.name) ? 'media/models' : 'media';
  const res = await uploadMedia(file, folder);
  e.target.value = '';
  document.getElementById('v3-upm')?.remove();
  if (res.success) {
    await load(true);
    renderGrid(modal.querySelector('.v3-media-search input').value);
    window.__v3toast && window.__v3toast('Uploaded ' + res.path);
  } else {
    window.__v3toast && window.__v3toast('Upload failed: ' + res.error, true);
  }
}

async function doDelete(path) {
  if (!confirm('Delete ' + path + '? This cannot be undone.')) return;
  const res = await deleteMedia(path);
  if (res.success) {
    await load(true);
    renderGrid(modal.querySelector('.v3-media-search input').value);
    window.__v3toast && window.__v3toast('Deleted ' + path);
  } else {
    window.__v3toast && window.__v3toast('Delete failed: ' + res.error, true);
  }
}

function pick(path) {
  const cb = onPickCb;
  close();
  cb && cb(path);
}

function close() {
  if (modal) modal.classList.remove('show');
  onPickCb = null;
}

export async function openMediaPicker(onPick) {
  if (!modal) build();
  onPickCb = onPick;
  modal.classList.add('show');
  const grid = modal.querySelector('.v3-media-grid');
  grid.innerHTML = `<div class="v3-media-empty">Loading…</div>`;
  await load(false);
  renderGrid('');
}
