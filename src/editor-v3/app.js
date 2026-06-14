/**
 * Editor v3 — orchestrator
 *
 * Re-envisioned WYSIWYG editor. The canvas is the REAL site running in an iframe
 * (index.html?preview=1). We toggle edit mode on it, push state in, and receive
 * edit events back. No site rendering is duplicated here — fidelity is automatic.
 */

import {
  state, loadSiteData, loadProject, saveSiteData,
  checkAuth, getLoginUrl, getLogoutUrl,
  isDirty, markDirty, createProject, deleteProject
} from './dataBridge.js';
import {
  initBridge, pushData, navigate, setEditMode, isReady
} from './bridge.js';
import {
  initHistory, pushState, undo, redo, canUndo, canRedo
} from './history.js';
import {
  initInspector, showBlockInspector, showSectionInspector, clearInspector,
  showHomeSettings, showContactSettings, showProjectSettings
} from './inspector.js';
import { openMediaPicker } from './media.js';
import {
  getBlocks as bmGetBlocks, setBlocks as bmSetBlocks,
  addBlock as bmAddBlock, removeBlock as bmRemoveBlock,
  changeBlockType as bmChangeType
} from '../modules/blocks/blockManager.js';
import { uid } from '../utils/validation.js';

// blockManager operates on a { globalState, projects } shape; adapt our state.
// Both share object references with our dataBridge state, so mutations persist.
function bmState() {
  return { globalState: state.global, projects: state.projects };
}

function dirtyForScope(scope) {
  if (scope && scope.startsWith('proj-')) return 'projects/' + scope.slice(5) + '.json';
  return 'content.json';
}

// ── Current view state ──
const view = {
  panel: 'about',          // 'home' | 'about' | 'contact' | 'project'
  projectId: null
};

// ── DOM refs ──
let frame, saveBtn, authEl, railSections, railProjects, undoBtn, redoBtn;

// ── Toast ──
function toast(msg, isError) {
  const el = document.getElementById('v3-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}
window.__v3toast = toast;

// ── Field helpers ─────────────────────────────────────────────
// Apply a possibly-nested / item-indexed value onto a target object.
//   field 'content'        -> target.content = value
//   field 'items.num' i=2  -> target.items[2].num = value
//   field 'left.content'   -> target.left.content = value
export function setField(target, field, item, value) {
  if (!target || !field) return;
  if (field.startsWith('items.') && item != null && item !== '') {
    const sub = field.slice('items.'.length);
    if (!Array.isArray(target.items)) target.items = [];
    if (!target.items[item]) target.items[item] = {};
    setDeep(target.items[item], sub, value);
    return;
  }
  setDeep(target, field, value);
}

function setDeep(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof o[parts[i]] !== 'object' || o[parts[i]] == null) o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = value;
}

// Resolve the data container + dirty-file path for a canvas scope.
export function resolveScope(scope, projectId) {
  if (scope === 'contact') {
    state.global.contactPanel = state.global.contactPanel || {};
    return { container: state.global, blocks: null, dirty: 'content.json', sectionTarget: state.global.contactPanel };
  }
  if (scope === 'about') {
    if (!Array.isArray(state.global.about)) state.global.about = [];
    return { container: state.global, blocks: state.global.about, dirty: 'content.json' };
  }
  if (scope === 'hero' || scope === 'global') {
    return { container: state.global, blocks: null, dirty: 'content.json', sectionTarget: state.global };
  }
  if (scope.startsWith('proj-')) {
    const pid = projectId || scope.slice(5);
    const proj = state.projectCache.get(pid);
    if (!proj) return null;
    if (!Array.isArray(proj.blocks)) proj.blocks = [];
    return { container: proj, blocks: proj.blocks, dirty: 'projects/' + pid + '.json', projectId: pid };
  }
  return null;
}

export function findBlock(scope, projectId, blockId) {
  const r = resolveScope(scope, projectId);
  if (!r || !r.blocks) return null;
  return r.blocks.find(b => b.id === blockId) || null;
}

// ── Commit an inline text edit from the canvas ───────────────
function applyCommit(payload) {
  if (!payload) return;
  const { scope, field, blockId, projectId, item, value } = payload;
  if (!scope || !field) return;

  const r = resolveScope(scope, projectId);
  if (!r) return;

  pushState(state); // snapshot for undo (pre-mutation)

  if (!blockId && r.sectionTarget) {
    // Section-level field (e.g. contact panel sub/labels, hero text)
    setField(r.sectionTarget, field, item, value);
  } else if (r.blocks) {
    const blk = r.blocks.find(b => b.id === blockId);
    if (!blk) return;
    setField(blk, field, item, value);
  } else {
    return;
  }

  markDirty(r.dirty);
  updateSaveUI();
  // The iframe DOM already reflects the inline edit, so no re-push is needed here.
}

// ── Re-render the iframe after structural / inspector changes ──
export function repaint(opts = {}) {
  pushData(state.global, state.projects);
  // Re-open the project panel so its blocks re-render from the freshly pushed cache.
  if (view.panel === 'project' && view.projectId) {
    navigate('project', view.projectId);
  } else {
    navigate(view.panel, view.projectId);
  }
  if (opts.dirty) markDirty(opts.dirty);
  updateSaveUI();
}

// Light repaint: re-push data so the iframe re-renders hero / work / about /
// contact in place, without re-navigating (keeps the open panel from
// re-animating). Used by the section settings forms.
export function repaintLight() {
  pushData(state.global, state.projects);
  updateSaveUI();
}

// ── Navigation ────────────────────────────────────────────────
async function goTo(panel, projectId) {
  view.panel = panel;
  view.projectId = projectId || null;

  if (panel === 'project' && projectId) {
    await loadProject(projectId); // ensure full blocks are in state + pushed
    pushData(state.global, state.projects);
  }
  navigate(panel, projectId);
  renderRail();
  if (panel === 'home') showHomeSettings();
  else if (panel === 'contact') showContactSettings();
  else if (panel === 'project' && projectId) showProjectSettings(projectId);
  else if (panel === 'about') showSectionInspector('about');
  else clearInspector();
}
window.__v3goTo = goTo;

// ── Left rail ─────────────────────────────────────────────────
function renderRail() {
  const sections = [
    { id: 'home', label: 'Home', icon: 'ph-house' },
    { id: 'about', label: 'About', icon: 'ph-user' },
    { id: 'contact', label: 'Contact', icon: 'ph-envelope' }
  ];
  railSections.innerHTML = sections.map(s => `
    <button class="v3-nav-item${view.panel === s.id ? ' active' : ''}" data-nav="${s.id}">
      <i class="ph-fill ${s.icon}"></i><span>${s.label}</span>
    </button>`).join('');

  railProjects.innerHTML = (state.projects || []).map(p => `
    <button class="v3-nav-item v3-proj-item${view.panel === 'project' && view.projectId === p.id ? ' active' : ''}" data-nav="project" data-project="${p.id}" draggable="true">
      <span class="v3-proj-grip" title="Drag to reorder">⋮⋮</span>
      <span class="v3-proj-dot${p.published ? ' pub' : ''}"></span>
      <span>${escapeHtml(p.title || p.id)}</span>
    </button>`).join('') +
    `<button class="v3-add-proj" id="v3-add-proj">+ New Project</button>`;
}

function bindRail() {
  document.getElementById('v3-rail').addEventListener('click', e => {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) {
      const panel = navBtn.getAttribute('data-nav');
      const pid = navBtn.getAttribute('data-project') || null;
      goTo(panel, pid);
      return;
    }
    if (e.target.closest('#v3-add-proj')) {
      const title = prompt('New project title:');
      if (title) {
        pushState(state);
        const proj = createProject(title);
        renderRail();
        goTo('project', proj.id);
        toast('Project created — edit and Save to publish');
      }
    }
  });
}

// ── Project reordering (drag in the rail) ────────────────────
function reorderProjects(fromId, beforeId) {
  const ids = (state.global.projects || []).slice();
  const fi = ids.indexOf(fromId);
  if (fi < 0) return;
  pushState(state);
  ids.splice(fi, 1);
  let bi = beforeId ? ids.indexOf(beforeId) : ids.length;
  if (bi < 0) bi = ids.length;
  ids.splice(bi, 0, fromId);
  state.global.projects = ids;
  const byId = new Map(state.projects.map(p => [p.id, p]));
  state.projects = ids.map(id => byId.get(id)).filter(Boolean);
  markDirty('content.json');
  renderRail();
  repaintLight();
}

function bindProjectDrag() {
  let dragId = null;
  railProjects.addEventListener('dragstart', e => {
    const it = e.target.closest('[data-project]');
    if (!it) return;
    dragId = it.getAttribute('data-project');
    e.dataTransfer.effectAllowed = 'move';
    it.classList.add('v3-dragging');
  });
  railProjects.addEventListener('dragend', e => {
    e.target.closest('[data-project]')?.classList.remove('v3-dragging');
    railProjects.querySelectorAll('.v3-drop-before').forEach(el => el.classList.remove('v3-drop-before'));
    dragId = null;
  });
  railProjects.addEventListener('dragover', e => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    railProjects.querySelectorAll('.v3-drop-before').forEach(el => el.classList.remove('v3-drop-before'));
    const over = e.target.closest('[data-project]');
    if (over && over.getAttribute('data-project') !== dragId) over.classList.add('v3-drop-before');
  });
  railProjects.addEventListener('drop', e => {
    if (!dragId) return;
    e.preventDefault();
    const over = e.target.closest('[data-project]');
    const beforeId = over ? over.getAttribute('data-project') : null;
    if (beforeId !== dragId) reorderProjects(dragId, beforeId);
    dragId = null;
  });
}

// ── Auth ──────────────────────────────────────────────────────
async function initAuth() {
  const auth = await checkAuth();
  if (auth) {
    authEl.innerHTML = `<span class="v3-auth-user"><i class="ph-fill ph-check-circle"></i> ${auth.user || 'Logged in'}</span> <a href="${getLogoutUrl()}" class="v3-link">Logout</a>`;
    saveBtn.disabled = false;
  } else {
    authEl.innerHTML = `<a href="${getLoginUrl()}" class="v3-link v3-login">Log in to save</a>`;
    saveBtn.disabled = true;
  }
  updateSaveUI();
}

// ── Save ──────────────────────────────────────────────────────
function updateSaveUI() {
  if (!saveBtn) return;
  const dirty = isDirty();
  saveBtn.classList.toggle('dirty', dirty);
  saveBtn.querySelector('.v3-save-label').textContent = dirty ? 'Save *' : 'Saved';
  if (undoBtn) undoBtn.disabled = !canUndo();
  if (redoBtn) redoBtn.disabled = !canRedo();
}

async function doSave() {
  if (saveBtn.disabled) return;
  saveBtn.disabled = true;
  saveBtn.querySelector('.v3-save-label').textContent = 'Saving…';
  const result = await saveSiteData();
  if (result.success) {
    toast(result.message || 'Saved ✓');
    if (result.commit) startDeployPolling();
  } else {
    toast('Error: ' + result.error, true);
    if (result.error && /unauthor/i.test(result.error)) initAuth();
  }
  saveBtn.disabled = false;
  updateSaveUI();
}

// ── Deploy status polling (GitHub Pages public builds API, same as v1) ──
let deployTimer = null;
function setDeployStatus(msg, stateName) {
  const el = document.getElementById('v3-deploy');
  if (!el) return;
  el.textContent = msg;
  el.className = 'v3-deploy' + (stateName ? ' ' + stateName : '');
}
function startDeployPolling() {
  if (deployTimer) { clearInterval(deployTimer); deployTimer = null; }
  let tries = 0;
  const maxTries = 24; // ~4 min at 10s
  const poll = async () => {
    tries++;
    try {
      const r = await fetch('https://api.github.com/repos/ymd-ei/Run-Girl-Run-Website/pages/builds/latest',
        { headers: { Accept: 'application/vnd.github.v3+json' } });
      if (r.status === 404) { setDeployStatus('saved ✓', 'live'); clearInterval(deployTimer); deployTimer = null; return; }
      if (!r.ok) throw new Error(String(r.status));
      const build = await r.json();
      const st = (build.status || '').toLowerCase();
      if (st === 'built') { setDeployStatus('live ✓', 'live'); clearInterval(deployTimer); deployTimer = null; return; }
      if (st === 'errored') { setDeployStatus('deploy failed', 'error'); clearInterval(deployTimer); deployTimer = null; return; }
      setDeployStatus(st === 'building' ? 'building…' : 'queued…', st === 'building' ? 'building' : 'waiting');
      if (tries >= maxTries) { setDeployStatus('still processing', 'waiting'); clearInterval(deployTimer); deployTimer = null; }
    } catch {
      setDeployStatus('status unavailable', 'error'); clearInterval(deployTimer); deployTimer = null;
    }
  };
  setDeployStatus('checking…', 'waiting');
  poll();
  deployTimer = setInterval(poll, 10000);
}

// ── Misc ──────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Boot ──────────────────────────────────────────────────────
async function init() {
  frame = document.getElementById('v3-frame');
  saveBtn = document.getElementById('v3-save');
  authEl = document.getElementById('v3-auth');
  railSections = document.getElementById('v3-rail-sections');
  railProjects = document.getElementById('v3-rail-projects');
  undoBtn = document.getElementById('v3-undo');
  redoBtn = document.getElementById('v3-redo');

  try {
    await loadSiteData();
  } catch (err) {
    toast('Failed to load site data: ' + err.message, true);
    return;
  }

  // Debug handle (internal editor tool) — inspect live state from the console.
  window.__v3 = { state, view, repaint, goTo };

  initInspector({
    repaint,
    repaintLight,
    action: handleAction,
    openMedia: (onPick) => openMediaPicker(onPick),
    deleteProject: (id) => {
      pushState(state);
      deleteProject(id);
      toast('Project deleted — Save to apply');
      goTo('home');
    }
  });

  initHistory(() => {
    pushData(state.global, state.projects);
    navigate(view.panel, view.projectId);
    renderRail();
    updateSaveUI();
  });

  initBridge(frame, {
    onReady: () => {
      pushData(state.global, state.projects);
      setEditMode(true);
      navigate(view.panel, view.projectId);
    },
    onCommitEdit: applyCommit,
    onStartEdit: () => {},
    onCancelEdit: () => {},
    onSelectBlock: (payload) => {
      showBlockInspector(payload);
    },
    onAction: (payload) => handleAction(payload)
  });

  // Mount the real site as the canvas.
  frame.src = 'index.html?preview=1&editor=v3';

  renderRail();
  bindRail();
  bindProjectDrag();
  initAuth();

  saveBtn.addEventListener('click', doSave);
  undoBtn.addEventListener('click', () => { if (undo(state)) updateSaveUI(); });
  redoBtn.addEventListener('click', () => { if (redo(state)) updateSaveUI(); });

  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(); }
    else if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); if (undo(state)) updateSaveUI(); }
    else if (mod && (e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); if (redo(state)) updateSaveUI(); }
  });

  window.addEventListener('v3-save-status', updateSaveUI);
  window.addEventListener('v3-history', updateSaveUI);
}

// Block toolbar / inspector structural actions. Parent owns state; we mutate
// then repaint the iframe. Reuses the shared blockManager CRUD.
function handleAction(payload) {
  if (!payload || !payload.scope) return;
  const { op, scope, blockId, dir, blockType, afterBlockId } = payload;
  const bm = bmState();

  pushState(state); // undo snapshot (pre-mutation)
  let ok = false;
  let selectId = null;

  if (op === 'move') {
    const blocks = bmGetBlocks(bm, scope);
    const i = blocks.findIndex(b => b.id === blockId);
    const j = i + (dir || 0);
    if (i >= 0 && j >= 0 && j < blocks.length) {
      const t = blocks[i]; blocks[i] = blocks[j]; blocks[j] = t;
      bmSetBlocks(bm, scope, blocks);
      ok = true; selectId = blockId;
    }
  } else if (op === 'delete') {
    ok = bmRemoveBlock(bm, scope, blockId);
  } else if (op === 'duplicate') {
    const blocks = bmGetBlocks(bm, scope);
    const i = blocks.findIndex(b => b.id === blockId);
    if (i >= 0) {
      const copy = JSON.parse(JSON.stringify(blocks[i]));
      copy.id = uid();
      blocks.splice(i + 1, 0, copy);
      bmSetBlocks(bm, scope, blocks);
      ok = true; selectId = copy.id;
    }
  } else if (op === 'add') {
    const newId = bmAddBlock(bm, scope, blockType);
    if (newId) {
      const blocks = bmGetBlocks(bm, scope);
      const ni = blocks.findIndex(b => b.id === newId);
      const blk = blocks.splice(ni, 1)[0];
      const ai = afterBlockId ? blocks.findIndex(b => b.id === afterBlockId) : blocks.length;
      blocks.splice(ai < 0 ? blocks.length : ai + 1, 0, blk);
      bmSetBlocks(bm, scope, blocks);
      ok = true; selectId = newId;
    }
  } else if (op === 'change-type') {
    ok = bmChangeType(bm, scope, blockId, blockType);
    selectId = blockId;
  }

  if (!ok) return;
  markDirty(dirtyForScope(scope));
  repaint();
  updateSaveUI();
  void selectId; // selection re-highlight after repaint is a later refinement
}

init();
