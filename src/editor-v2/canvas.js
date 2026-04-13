/**
 * Canvas — v2 Editor
 * Renders the portfolio site sections inline inside the editor canvas.
 * Uses shared renderers (displayRenderer, blockRenderer) — does NOT import main.js.
 */

import { state, loadProject, markDirty, uploadMedia, createProject, deleteProject, fetchMediaFiles } from './dataBridge.js';
import { pushState } from './history.js';
import {
  applyTheme,
  renderWorkGrid,
  renderContactPanel,
  renderDisplayBlocks,
  initSensitiveTapes
} from '../display/displayRenderer.js';
import { normalizeBlocks, normalizeBlock } from '../modules/blocks/blockManager.js';
import { renderBlock } from '../modules/blocks/blockRenderer.js';
import { uid } from '../utils/validation.js';
import { phosphorIcon } from '../utils/icons.js';
import { initInspector, showAt, hideInspector, setSelection, clearSelection, getSelection, bindCanvasScroll } from './inspector.js';
import { initToolbar, startEdit, finishEdit, isEditing } from './floatingToolbar.js';

let currentSection = 'home';
let currentProjectId = null;

// ── Selection & editing wiring ──

/**
 * Initialize the selection + editing systems. Call once after DOM ready.
 */
export function initEditing() {
  // Inspector: when a field changes → re-render the affected block/section
  initInspector((selection, key, value) => {
    pushState(state);
    if (selection.type === 'section') {
      markDirty('content.json');
      if (selection.sectionName === 'theme') {
        applyCanvasTheme(state.global.theme || {});
      } else {
        rerenderSection(selection.sectionName);
      }
    } else if (selection.type === 'block') {
      if (selection.scope && selection.scope.startsWith('proj-')) {
        markDirty('projects/' + selection.scope.replace('proj-', '') + '.json');
      } else {
        markDirty('content.json');
      }
      rerenderBlock(selection.scope, selection.blockId);
    }
  }, (action, selection, extra) => {
    // Inspector action buttons: move-up, move-down, delete, add-after
    pushState(state);
    handleBlockAction(action, selection, extra);
  });

  // Floating toolbar: when inline text edit commits
  initToolbar((scope, blockId, field, value, itemIndex) => {
    pushState(state);
    const block = findBlockData(scope, blockId);
    if (block) {
      // Sub-item field: e.g. "items.num" with itemIndex=2
      if (itemIndex !== undefined && field.includes('.')) {
        const [arrKey, subKey] = field.split('.');
        const arr = block[arrKey];
        if (arr && arr[itemIndex]) {
          arr[itemIndex][subKey] = value;
        }
      } else {
        block[field] = value;
      }
      if (scope && scope.startsWith('proj-')) {
        markDirty('projects/' + scope.replace('proj-', '') + '.json');
      } else {
        markDirty('content.json');
      }
      // Don't re-render while editing content — the contenteditable IS the display
      if (field === 'align') {
        // Alignment change updates the inspector if open
        const sel = getSelection();
        if (sel && sel.blockId === blockId) {
          setSelection(sel); // re-render inspector
        }
      }
    }
  });

  // Canvas click / double-click handlers
  const canvas = document.getElementById('v2-canvas');
  if (!canvas) return;

  canvas.addEventListener('click', handleCanvasClick);

  // Bind scroll reposition for floating inspector
  bindCanvasScroll(canvas);

  // Media library sidebar button
  initMediaButton();
  window.__v2OpenMediaLibrary = openMediaLibrary;

  // Global Esc dismiss
  initGlobalEsc();

  // FAQ, before/after, gallery interactions
  initBlockInteractions(canvas);
}

/**
 * Full render — call after data is loaded
 */
export function renderCanvas() {
  const inner = document.getElementById('v2-canvas-inner');
  if (!inner) return;

  const g = state.global;
  const theme = g.theme || {};

  applyCanvasTheme(theme);

  inner.innerHTML = buildHeroHTML(g) +
    '<div class="v2-backdrop" id="v2-backdrop"></div>' +
    buildWorkPanelHTML(g, theme) +
    buildAboutPanelHTML(g) +
    buildContactPanelHTML(g) +
    buildProjectPanelHTML();

  // Wire project card clicks
  inner.querySelectorAll('[data-v2-project]').forEach(card => {
    card.addEventListener('click', () => openProject(card.dataset.v2Project));
  });

  // Wire panel close buttons
  inner.querySelectorAll('.v2-panel-close').forEach(btn => {
    btn.addEventListener('click', closePanel);
  });

  // Backdrop click closes panels
  document.getElementById('v2-backdrop')?.addEventListener('click', closePanel);

  // Back to work from project panel
  document.getElementById('v2-panel-back-work')?.addEventListener('click', () => {
    const projPanel = inner.querySelector('.v2-panel[data-v2-panel="project"]');
    if (projPanel) {
      projPanel.classList.remove('open');
      projPanel.classList.remove('v2-longform');
    }
    currentProjectId = null;
    showPanel('work');
  });

  updateSidebarNav();

  // Wire canvas nav buttons
  inner.querySelectorAll('[data-v2-nav]').forEach(btn => {
    btn.addEventListener('click', () => showPanel(btn.dataset.v2Nav));
  });

  // Wire work filter buttons
  inner.querySelectorAll('[data-v2-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.v2Filter;
      inner.querySelectorAll('[data-v2-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      inner.querySelectorAll('.wg .wc').forEach(card => {
        const type = card.dataset.type || '';
        const show = filter === 'all' || type === filter;
        card.style.opacity = show ? '' : '0';
        card.style.pointerEvents = show ? '' : 'none';
      });
    });
  });

  // Sensitive tapes on work cards
  initSensitiveTapes(state.projects, { showAll: true });
}

/**
 * Apply theme as CSS variables scoped to the canvas wrapper
 */
export function applyCanvasTheme(theme) {
  const root = document.getElementById('v2-canvas');
  if (!root) return;

  const ink = theme.ink || '#1a1714';
  const paper = theme.paper || '#f2ede4';
  const accent = theme.accent || '#5e30eb';
  const inkRgb = hexToRgb(ink);
  const paperRgb = hexToRgb(paper);

  const vars = {
    // ── editor prefixed colors ──
    '--color-accent': accent,
    '--color-paper': paper,
    '--color-ink': ink,
    '--color-panel-bg': theme.panelBg || '#f7f3ec',
    '--color-contact-accent': theme.ctAccent || '#ff7828',
    '--color-contact-bg': theme.ctBg || '#080808',
    '--color-contact-hi': theme.ctHi || '#ffffff',
    '--color-sensitive': theme.sensitiveColor || '#e03030',

    // ── core theme tokens (consumed by styles-main.css) ──
    '--ink': ink,
    '--paper': paper,
    '--accent': accent,
    '--accent-rgb': hexToRgb(accent),
    '--panel-bg': theme.panelBg || '#f7f3ec',
    '--ink-rgb': inkRgb,
    '--paper-rgb': paperRgb,
    '--surface': theme.surface || '#ede8df',
    '--muted': `rgba(${inkRgb},0.4)`,
    '--border': `rgba(${inkRgb},0.12)`,
    '--panel-border': `rgba(${inkRgb},0.1)`,

    // ── typography tokens ──
    '--font-b': "'DM Sans',sans-serif",
    '--font-s': "'Cormorant Garamond',serif",
    '--font-hero': "'Bebas Neue',sans-serif",
    '--font-ui': "'Space Grotesk',sans-serif",
    '--fs-xs': '.6rem',
    '--fs-sm': '.7rem',
    '--fs-md': '.85rem',
    '--fs-body': '.95rem',
    '--fs-lg': '1.3rem',
    '--fs-xl': '2.2rem',
    '--ls-tight': '.04em',
    '--ls-normal': '.1em',
    '--ls-wide': '.16em',
    '--ls-xwide': '.25em',

    // ── motion ──
    '--ease': 'cubic-bezier(0.16,1,0.3,1)',

    // ── contact tokens ──
    '--ct-accent': theme.ctAccent || '#ff7828',
    '--ct-bg': theme.ctBg || '#080808',
    '--ct-hi': theme.ctHi || '#ffffff',
    '--ct-muted': 'rgba(255,255,255,0.35)',
    '--ct-border': 'rgba(255,255,255,0.1)',
    '--ct-accent-rgb': hexToRgb(theme.ctAccent || '#ff7828')
  };

  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

// ── Section builders ──

function buildHeroHTML(g) {
  const name = g.name || 'Your Name';
  const role = g.role || 'Your Role';
  const parts = name.split(' ');
  const line1 = parts[0] || '';
  const line2 = parts.slice(1).join(' ') || '';

  let reelHTML = '';
  if (g.reel && g.reel.url) {
    if (g.reel.type === 'video') {
      reelHTML = `<video muted loop playsinline preload="metadata" src="${g.reel.url}" style="width:100%;height:100%;object-fit:cover;"></video>`;
    } else {
      reelHTML = `<div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;color:#666;font-size:.75rem;">Video embed (${g.reel.type})</div>`;
    }
  } else {
    reelHTML = `<div style="width:100%;height:100%;background:var(--ink);display:flex;align-items:center;justify-content:center;color:#666;font-size:.75rem;">Demo Reel Goes Here</div>`;
  }

  return `
    <div class="v2-hero" data-v2-section="hero" id="v2-sec-hero">
      <div class="v2-hero-bg">${reelHTML}</div>
      <div class="v2-hero-overlay"></div>
      <div class="v2-hero-accent-glow"></div>
      <div class="v2-hero-text">
        <p class="v2-hero-role">${role}</p>
        <h1 class="v2-hero-name">${line1}${line2 ? '<br><em>' + line2 + '</em>' : ''}</h1>
      </div>
      <nav class="v2-canvas-nav">
        <span class="v2-canvas-nav-name">${g.name || 'Your Name'}</span>
        <div class="v2-canvas-nav-links">
          <button data-v2-nav="work">Work</button>
          <button data-v2-nav="about">About</button>
          <button data-v2-nav="contact">Contact</button>
        </div>
      </nav>
    </div>`;
}

function buildWorkPanelHTML(g, theme) {
  const filters = g.filters || [
    { value: '2d', label: '2D' },
    { value: '3d', label: '3D' },
    { value: 'motion', label: 'Motion' }
  ];

  const gridHTML = renderWorkGrid(state.projects, theme, { showAll: true });

  const safeGrid = gridHTML.replace(
    /onclick="window\.display\?\.openProject\?\.\('([^']+)'\)"/g,
    'data-v2-project="$1"'
  );

  const filterBtns = `<button class="fb active" data-v2-filter="all">All</button>` +
    filters.map(f => `<button class="fb" data-v2-filter="${f.value}">${f.label}</button>`).join('');

  return `
    <div class="v2-panel v2-panel-wide" data-v2-panel="work" data-v2-section="work">
      <div class="v2-ph"><span class="v2-pt" data-v2-section="work">Work</span><button class="v2-pc v2-panel-close">&#x2715;</button></div>
      <div class="v2-panel-scroll">
        <div class="v2-work">
          <div class="v2-work-filters">${filterBtns}</div>
          <div class="v2-work-grid wg">${safeGrid}</div>
        </div>
      </div>
    </div>`;
}

function buildAboutPanelHTML(g) {
  const blocks = normalizeBlocks(g.about || []);
  const blocksHTML = renderEditableBlocks(blocks, 'about');

  return `
    <div class="v2-panel" data-v2-panel="about">
      <div class="v2-ph"><span class="v2-pt">About</span><button class="v2-pc v2-panel-close">&#x2715;</button></div>
      <div class="v2-panel-scroll">
        <div class="v2-about pb">${blocksHTML}</div>
      </div>
    </div>`;
}

function buildContactPanelHTML(g) {
  const ct = renderContactPanel(g);
  const email = g.contact?.email || '';
  const location = g.contact?.location || '';
  const siteName = g.name || '';

  const icons = (g.contact?.links || [])
    .map(l => `<a href="${l.url}" class="ct-icon-btn" title="${l.label}"><i class="${phosphorIcon(l.url)}"></i></a>`)
    .join('');

  return `
    <div class="v2-panel v2-panel-contact" data-v2-panel="contact">
      <button class="v2-ct-close v2-panel-close">&#x2715;</button>
      <div class="v2-panel-scroll">
        <div class="v2-contact">
          <div class="v2-ct-splash">
            ${location ? `<p class="ct-tag">${location}</p>` : ''}
            <h1 class="ct-hero">${ct.hero}</h1>
            <p class="ct-sub">${ct.sub}</p>
          </div>
          <div class="v2-ct-links">
            <div class="ct-email-block">
              <p class="ct-email-label">${ct.emailLabel}</p>
              <a href="${email ? 'mailto:' + email : '#'}" class="ct-email-link">
                <span>${email}</span>
                <i class="ph-fill ph-arrow-up-right arr"></i>
              </a>
            </div>
            <div class="ct-social-wrap">
              <p class="ct-social-label">${ct.socialLabel}</p>
              <div class="ct-icons">${icons}</div>
            </div>
          </div>
          <div class="ct-footer">
            <span>${siteName}</span>
            <div class="ct-footer-dot"></div>
            <span>${location}</span>
          </div>
        </div>
      </div>
    </div>`;
}

function buildProjectPanelHTML() {
  return `
    <div class="v2-panel v2-panel-wide" data-v2-panel="project">
      <div class="v2-ph">
        <button class="v2-backbtn" id="v2-panel-back-work">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          Back
        </button>
        <button class="v2-proj-pub-btn" id="v2-project-publish" title="Toggle publish"></button>
        <button class="v2-proj-settings-btn" id="v2-project-settings" title="Project settings">&#9881;</button>
        <button class="v2-proj-del-btn" id="v2-project-delete" title="Delete project">&#128465;</button>
        <button class="v2-pc v2-panel-close">&#x2715;</button>
      </div>
      <div class="v2-panel-scroll"></div>
    </div>`;
}

// ── Project detail ──

export async function openProject(id) {
  const inner = document.getElementById('v2-canvas-inner');
  if (!inner) return;

  const project = await loadProject(id);
  if (!project) return;

  currentProjectId = id;
  currentSection = 'project';

  const panel = inner.querySelector('.v2-panel[data-v2-panel="project"]');
  if (!panel) return;

  // No-transition reset (matches main site #pp open logic)
  panel.classList.remove('open');
  panel.classList.add('no-transition');
  const isLongform = project.longform === true;
  panel.classList.toggle('v2-longform', isLongform);
  void panel.offsetWidth; // layout flush
  panel.classList.remove('no-transition');

  const heroImg = project.heroImage || project.thumbnail || '';
  const blocks = normalizeBlocks(project.blocks || []);
  const blocksHTML = renderEditableBlocks(blocks, 'proj-' + id, { projectId: id });

  const scrollEl = panel.querySelector('.v2-panel-scroll');
  if (scrollEl) {
    scrollEl.innerHTML = `
      <div class="v2-project">
        <div class="pp-hero" ${heroImg ? `style="background-image:url('${heroImg}')"` : ''}>
          <div class="pp-hero-overlay"></div>
          <div class="pp-hero-content">
            <div class="pp-hero-left">
              <h2 class="pp-hero-title">${project.title || ''}</h2>
              <div class="pp-hero-meta">
                ${project.typeLabel ? `<span class="pp-hero-tag">${project.typeLabel}</span>` : ''}
                ${project.year ? `<span class="pp-hero-tag">${project.year}</span>` : ''}
                ${project.client ? `<span class="pp-hero-tag">${project.client}</span>` : ''}
              </div>
            </div>
          </div>
        </div>
        ${blocksHTML}
      </div>`;
    scrollEl.scrollTop = 0;
  }

  // Close work panel, open project panel
  inner.querySelector('.v2-panel[data-v2-panel="work"]')?.classList.remove('open');
  panel.classList.add('open');
  document.getElementById('v2-backdrop')?.classList.add('open');
  updateSidebarActive();

  // Wire delete button for this project
  const delBtn = document.getElementById('v2-project-delete');
  if (delBtn) {
    delBtn.onclick = () => handleDeleteProject(id);
  }

  // Wire publish toggle
  const pubBtn = document.getElementById('v2-project-publish');
  if (pubBtn) {
    const card = state.projects.find(p => p.id === id);
    const isPublished = card?.published !== false;
    pubBtn.textContent = isPublished ? 'Published' : 'Draft';
    pubBtn.classList.toggle('v2-pub-on', isPublished);
    pubBtn.onclick = () => {
      pushState(state);
      const c = state.projects.find(p => p.id === id);
      if (c) {
        c.published = !c.published;
        pubBtn.textContent = c.published ? 'Published' : 'Draft';
        pubBtn.classList.toggle('v2-pub-on', c.published);
        markDirty('content.json');
        renderSidebarProjects();
      }
    };
  }

  // Wire settings button → open project metadata in inspector
  const settingsBtn = document.getElementById('v2-project-settings');
  if (settingsBtn) {
    settingsBtn.onclick = () => {
      showAt(settingsBtn, { type: 'section', sectionName: 'project', projectId: id });
    };
  }
}

// ── Sidebar nav ──

function updateSidebarNav() {
  const nav = document.getElementById('v2-sidebar-nav');
  if (!nav) return;

  const sections = [
    { key: 'home', label: 'Home' },
    { key: 'work', label: 'Work' },
    { key: 'about', label: 'About' },
    { key: 'contact', label: 'Contact' }
  ];

  nav.innerHTML = sections
    .map(s => `<button class="v2-nav-item${s.key === currentSection ? ' active' : ''}" data-v2-goto="${s.key}">${s.label}</button>`)
    .join('');

  nav.querySelectorAll('[data-v2-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.v2Goto;
      if (target === 'home') closePanel();
      else showPanel(target);
    });
  });
}

function updateSidebarActive() {
  const nav = document.getElementById('v2-sidebar-nav');
  if (!nav) return;
  nav.querySelectorAll('.v2-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.v2Goto === currentSection);
  });
}

/**
 * Build project list in sidebar
 */
export function renderSidebarProjects() {
  const list = document.getElementById('v2-sidebar-projects');
  if (!list) return;

  list.innerHTML = state.projects
    .map(p => {
      const dot = p.published ? 'v2-dot-pub' : 'v2-dot-draft';
      return `<button class="v2-nav-item v2-nav-project" data-v2-open-project="${p.id}">
        <span class="v2-dot ${dot}"></span>${p.title || p.id}
      </button>`;
    })
    .join('') +
    `<button class="v2-nav-item v2-new-project-btn" id="v2-new-project">+ New Project</button>`;

  list.querySelectorAll('[data-v2-open-project]').forEach(btn => {
    btn.addEventListener('click', () => openProject(btn.dataset.v2OpenProject));
  });

  document.getElementById('v2-new-project')?.addEventListener('click', handleNewProject);
}

function handleNewProject() {
  const title = prompt('Project title:');
  if (!title || !title.trim()) return;
  pushState(state);
  const project = createProject(title.trim());
  renderSidebarProjects();
  renderCanvas();
  openProject(project.id);
}

export function handleDeleteProject(id) {
  if (!confirm('Delete project "' + (state.projectCache.get(id)?.title || id) + '"? This removes it from the site.')) return;
  pushState(state);
  deleteProject(id);
  closePanel();
  renderSidebarProjects();
  renderCanvas();
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ── Media Library ──

let mediaCache = null;
let mediaPickCallback = null;

async function loadMediaFiles(force = false) {
  if (!force && mediaCache) return mediaCache;
  mediaCache = await fetchMediaFiles();
  return mediaCache;
}

function renderMediaGrid(files, filter = '') {
  const grid = document.getElementById('v2-media-grid');
  if (!grid) return;

  const lowerFilter = filter.toLowerCase();
  const filtered = lowerFilter
    ? files.filter(f => f.name.toLowerCase().includes(lowerFilter))
    : files;

  if (!filtered.length) {
    grid.innerHTML = '<div class="v2-media-empty">No media files found</div>';
    return;
  }

  grid.innerHTML = filtered.map(f => {
    const isVideo = /\.(mp4|webm|mov)$/i.test(f.name);
    const thumb = isVideo
      ? `<div class="v2-media-thumb v2-media-video-thumb">&#9654; ${escapeAttr(f.name)}</div>`
      : `<img class="v2-media-thumb" src="${f.path}" alt="${escapeAttr(f.name)}">`;
    return `<div class="v2-media-item" data-media-path="${escapeAttr(f.path)}" title="${escapeAttr(f.name)}">${thumb}<div class="v2-media-name">${escapeAttr(f.name)}</div></div>`;
  }).join('');
}

export async function openMediaLibrary(onPick) {
  mediaPickCallback = onPick || null;
  const modal = document.getElementById('v2-media-modal');
  if (!modal) return;

  modal.hidden = false;
  const grid = document.getElementById('v2-media-grid');
  if (grid) grid.innerHTML = '<div class="v2-media-empty">Loading…</div>';

  const files = await loadMediaFiles();
  renderMediaGrid(files);

  const search = document.getElementById('v2-media-search');
  if (search) {
    search.value = '';
    search.oninput = () => renderMediaGrid(files, search.value);
  }

  // Close button
  const closeBtn = document.getElementById('v2-media-close');
  if (closeBtn) closeBtn.onclick = closeMediaLibrary;

  // Click backdrop to close
  modal.onclick = (e) => { if (e.target === modal) closeMediaLibrary(); };

  // Item click → preview (or pick if callback exists and double-click)
  const gridEl = document.getElementById('v2-media-grid');
  if (gridEl) {
    gridEl.onclick = (e) => {
      const item = e.target.closest('[data-media-path]');
      if (!item) return;
      const path = item.dataset.mediaPath;
      const name = item.title || path;
      showMediaPreview(path, name);
    };
  }

  // Preview select button
  const selectBtn = document.getElementById('v2-media-preview-select');
  if (selectBtn) {
    selectBtn.onclick = () => {
      const preview = document.getElementById('v2-media-preview');
      const path = preview?.dataset.currentPath;
      if (path && mediaPickCallback) {
        mediaPickCallback(path);
      }
      closeMediaLibrary();
    };
  }

  // Preview close button
  const previewCloseBtn = document.getElementById('v2-media-preview-close');
  if (previewCloseBtn) previewCloseBtn.onclick = hideMediaPreview;

  // Upload
  const uploadInput = document.getElementById('v2-media-upload');
  if (uploadInput) {
    uploadInput.value = '';
    uploadInput.onchange = async () => {
      const file = uploadInput.files[0];
      if (!file) return;
      const result = await uploadMedia(file);
      if (result.success) {
        mediaCache = null; // invalidate
        const freshFiles = await loadMediaFiles(true);
        renderMediaGrid(freshFiles, search?.value || '');
        if (mediaPickCallback && result.path) {
          mediaPickCallback(result.path);
          closeMediaLibrary();
        }
      }
    };
  }
}

function closeMediaLibrary() {
  hideMediaPreview();
  const modal = document.getElementById('v2-media-modal');
  if (modal) modal.hidden = true;
  mediaPickCallback = null;
}

function showMediaPreview(path, name) {
  const preview = document.getElementById('v2-media-preview');
  if (!preview) return;
  preview.dataset.currentPath = path;

  const contentEl = preview.querySelector('.v2-media-preview-content');
  const nameEl = preview.querySelector('.v2-media-preview-name');
  const selectBtn = document.getElementById('v2-media-preview-select');
  if (nameEl) nameEl.textContent = name;
  if (selectBtn) selectBtn.style.display = mediaPickCallback ? '' : 'none';

  const isVideo = /\.(mp4|webm|mov)$/i.test(path);
  if (isVideo) {
    contentEl.innerHTML = `<video src="${path}" controls autoplay muted style="max-width:100%;max-height:100%;"></video>`;
  } else {
    contentEl.innerHTML = `<img src="${path}" alt="${escapeAttr(name)}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
  }
  preview.hidden = false;
}

function hideMediaPreview() {
  const preview = document.getElementById('v2-media-preview');
  if (!preview || preview.hidden) return;
  preview.hidden = true;
  const contentEl = preview.querySelector('.v2-media-preview-content');
  if (contentEl) contentEl.innerHTML = '';
}

function isMediaPreviewOpen() {
  const p = document.getElementById('v2-media-preview');
  return p && !p.hidden;
}

function isMediaModalOpen() {
  const m = document.getElementById('v2-media-modal');
  return m && !m.hidden;
}

function initMediaButton() {
  const btn = document.getElementById('v2-media-btn');
  if (btn) btn.onclick = () => openMediaLibrary(null);
}

// ── Global Escape handler ──

function initGlobalEsc() {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;

    // Priority 1: media preview
    if (isMediaPreviewOpen()) {
      e.preventDefault();
      hideMediaPreview();
      return;
    }

    // Priority 2: media modal
    if (isMediaModalOpen()) {
      e.preventDefault();
      closeMediaLibrary();
      return;
    }

    // Priority 3: inline editing (handled by floatingToolbar's own listener)
    if (isEditing()) return;

    // Priority 4: inspector open → close it
    if (getSelection()) {
      e.preventDefault();
      clearCanvasSelection();
      clearSelection();
      return;
    }
  });
}

// ── Interactive block behaviors (FAQ, before/after, gallery) ──

function initBlockInteractions(canvas) {
  // FAQ accordion toggle
  canvas.addEventListener('click', e => {
    const trigger = e.target.closest('[data-faq-trigger]');
    if (!trigger) return;
    const item = trigger.closest('[data-faq-item]');
    if (!item) return;
    e.stopPropagation();
    const isOpen = item.classList.contains('open');
    // Close all siblings
    item.closest('[data-faq]')?.querySelectorAll('[data-faq-item]').forEach(i => {
      i.classList.remove('open');
      const panel = i.querySelector('[data-faq-panel]');
      const btn = i.querySelector('[data-faq-trigger]');
      if (panel) panel.hidden = true;
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      item.classList.add('open');
      const panel = item.querySelector('[data-faq-panel]');
      const btn = item.querySelector('[data-faq-trigger]');
      if (panel) panel.hidden = false;
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }
  });

  // Before/after slider
  let activeBA = null;
  canvas.addEventListener('pointerdown', e => {
    const handle = e.target.closest('[data-before-after-handle]');
    if (!handle) return;
    e.preventDefault();
    e.stopPropagation();
    activeBA = handle.closest('[data-before-after]');
    handle.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove', e => {
    if (!activeBA) return;
    const frame = activeBA.querySelector('[data-before-after-frame]');
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = (x / rect.width) * 100;
    activeBA.style.setProperty('--before-after-pos', pct + '%');
  });
  document.addEventListener('pointerup', () => { activeBA = null; });
  document.addEventListener('pointercancel', () => { activeBA = null; });

  // Gallery image lightbox (simple fullscreen preview)
  canvas.addEventListener('click', e => {
    const img = e.target.closest('.bl-gallery-open');
    if (!img) return;
    e.stopPropagation();
    const src = img.dataset.fullSrc || img.src;
    const alt = img.dataset.fullAlt || img.alt || '';
    if (src) showMediaPreview(src, alt);
  });
}

// ── Panel navigation ──

export function showPanel(name) {
  const inner = document.getElementById('v2-canvas-inner');
  if (!inner) return;

  // Close all panels
  inner.querySelectorAll('.v2-panel.open').forEach(p => p.classList.remove('open'));
  inner.querySelector('.v2-panel.v2-longform')?.classList.remove('v2-longform');

  // Reset hero push
  const hero = inner.querySelector('.v2-hero');
  if (hero) hero.classList.remove('v2-hero-pushed');

  if (!name) {
    document.getElementById('v2-backdrop')?.classList.remove('open');
    currentSection = 'home';
    currentProjectId = null;
    updateSidebarActive();
    return;
  }

  const panel = inner.querySelector(`.v2-panel[data-v2-panel="${name}"]`);
  if (panel) {
    panel.classList.add('open');
    document.getElementById('v2-backdrop')?.classList.add('open');
    currentSection = name;

    if (name !== 'project') {
      currentProjectId = null;
    }

    if (name === 'contact') {
      if (hero) hero.classList.add('v2-hero-pushed');
    }

    // Trigger skill bar fill animation when about opens
    if (name === 'about') {
      panel.querySelectorAll('.skf').forEach(bar => bar.classList.add('go'));
    }

    updateSidebarActive();
  }
}

export function closePanel() {
  showPanel(null);
}

/**
 * Open the theme editor in the inspector panel — triggered from sidebar.
 */
export function showThemeEditor() {
  clearCanvasSelection();
  const anchor = document.getElementById('v2-theme-btn') || document.getElementById('v2-canvas');
  showAt(anchor, { type: 'section', sectionName: 'theme' });
}

// ── Canvas selection handlers ──

function handleCanvasClick(e) {
  if (isEditing()) {
    // If we clicked inside the element being edited, let it be
    return;
  }

  // "Add Block" button → show type picker
  const addBtn = e.target.closest('.v2-add-block-btn');
  if (addBtn) {
    e.stopPropagation();
    showBlockTypePicker(addBtn);
    return;
  }

  // Type picker option click
  const tpOpt = e.target.closest('.v2-tp-opt');
  if (tpOpt) {
    e.stopPropagation();
    return; // handled by picker's own listener
  }

  // Did we click on an inline-editable element? → start typing immediately
  const editableEl = e.target.closest('[data-canvas-editable]');
  if (editableEl) {
    e.stopPropagation();
    selectBlock(editableEl);
    startEdit(editableEl);
    return;
  }

  // Did we click on a block wrapper or block element?
  const blockEl = e.target.closest('[data-canvas-block-id]');
  if (blockEl) {
    e.stopPropagation();
    selectBlock(blockEl);
    return;
  }

  // Did we click inside a v2-section?
  const sectionEl = e.target.closest('[data-v2-section]');
  if (sectionEl) {
    const sectionName = sectionEl.dataset.v2Section;
    clearCanvasSelection();
    showAt(sectionEl, { type: 'section', sectionName });
    return;
  }

  // Clicked blank canvas
  clearCanvasSelection();
  clearSelection();
}

function selectBlock(el) {
  clearCanvasSelection();

  const scope = el.getAttribute('data-canvas-scope');
  const blockId = el.getAttribute('data-canvas-block-id');
  if (!scope || !blockId) return;

  // Walk up to the nearest top-level block wrapper (or use the element itself)
  const wrapper = el.closest('.block-canvas > *') || el;
  wrapper.classList.add('v2-selected');

  showAt(wrapper, { type: 'block', scope, blockId });
}

function clearCanvasSelection() {
  document.querySelectorAll('.v2-selected').forEach(el => el.classList.remove('v2-selected'));
}

// ── Re-render helpers ──

function rerenderSection(name) {
  const g = state.global;
  const theme = g.theme || {};

  if (name === 'hero') {
    const sec = document.getElementById('v2-sec-hero');
    if (!sec) return;
    const content = sec.querySelector('.v2-hero-content') || sec;
    // Rebuild just hero inner content
    const heroHTML = buildHeroHTML(g);
    const temp = document.createElement('div');
    temp.innerHTML = heroHTML;
    const newInner = temp.querySelector('.v2-hero-content');
    if (newInner && content.classList.contains('v2-hero-content')) {
      content.innerHTML = newInner.innerHTML;
    }
  } else if (name === 'contact') {
    const panel = document.querySelector('.v2-panel[data-v2-panel="contact"] .v2-panel-scroll');
    if (panel) {
      const temp = document.createElement('div');
      temp.innerHTML = buildContactPanelHTML(g);
      const newScroll = temp.querySelector('.v2-panel-scroll');
      if (newScroll) panel.innerHTML = newScroll.innerHTML;
    }
  }
}

function rerenderBlock(scope, blockId) {
  // Find the block wrapper (or inline editable element) and re-render
  const wrapper = document.querySelector(`.v2-block-wrap[data-canvas-block-id="${blockId}"]`);
  const el = wrapper || document.querySelector(`[data-canvas-block-id="${blockId}"]`);
  if (!el) return;

  // Get the block data
  const block = findBlockData(scope, blockId);
  if (!block) return;

  const theme = state.global.theme || {};

  const renderOpts = { canvasScope: scope };
  const m = scope.match(/^proj-(.+)$/);
  if (m) renderOpts.canvasProjectId = m[1];

  const newHTML = renderBlock(block, theme, renderOpts);
  if (!newHTML) return;

  if (wrapper) {
    // Wrapper exists — replace its inner content
    wrapper.innerHTML = newHTML;
    wrapper.classList.add('v2-selected');
    // Update padding on the wrapper itself
    const pt = block.paddingTop;
    const pb = block.paddingBottom;
    wrapper.style.paddingTop = pt ? (parseInt(pt, 10) || 0) + 'px' : '';
    wrapper.style.paddingBottom = pb ? (parseInt(pb, 10) || 0) + 'px' : '';
  } else {
    // Legacy: no wrapper, replace the element itself
    const target = el.closest('.block-canvas > *') || el;
    const temp = document.createElement('div');
    temp.innerHTML = newHTML;
    const newEl = temp.firstElementChild;
    if (newEl) {
      target.replaceWith(newEl);
      newEl.classList.add('v2-selected');
    }
  }
}

function findBlockData(scope, blockId) {
  if (scope === 'about') {
    return (state.global.about || []).find(b => b.id === blockId);
  }
  const m = scope.match(/^proj-(.+)$/);
  if (m) {
    const project = state.projectCache.get(m[1]);
    if (project) return (project.blocks || []).find(b => b.id === blockId);
  }
  return null;
}

// ── Editable block rendering ──

/**
 * Render blocks wrapped in selectable containers for the editor.
 * Each block gets a .v2-block-wrap with data attributes for click selection.
 * An "Add Block" button is appended inside the block-canvas.
 */
function renderEditableBlocks(blocks, scope, options = {}) {
  const theme = state.global.theme || {};
  const renderOpts = { canvasScope: scope };
  if (options.projectId) renderOpts.canvasProjectId = options.projectId;

  const html = (blocks || []).map(block => {
    const inner = renderBlock(block, theme, renderOpts);
    const padStyles = [];
    const pt = block.paddingTop;
    const pb = block.paddingBottom;
    if (pt && pt !== '0' && pt !== 0) padStyles.push(`padding-top:${typeof pt === 'number' ? pt + 'px' : pt}`);
    if (pb && pb !== '0' && pb !== 0) padStyles.push(`padding-bottom:${typeof pb === 'number' ? pb + 'px' : pb}`);
    const styleAttr = padStyles.length ? ` style="${padStyles.join(';')}"` : '';
    return `<div class="v2-block-wrap" data-canvas-scope="${scope}" data-canvas-block-id="${block.id}"${styleAttr}>${inner}</div>`;
  }).join('');

  return `<div class="block-canvas">${html}<button class="v2-add-block-btn" data-v2-add-scope="${scope}">+ Add Block</button></div>`;
}

// ── Block CRUD actions ──

const BLOCK_TYPE_MENU = [
  ['text-md', 'Text'],
  ['text-sm', 'Small Text'],
  ['text-lg', 'Large Text'],
  ['image', 'Image'],
  ['video', 'Video'],
  ['quote', 'Quote'],
  ['divider', 'Divider'],
  ['callout', 'Callout'],
  ['cta', 'Call to Action'],
  ['gallery', 'Gallery'],
  ['stats', 'Stats'],
  ['skills', 'Skills'],
  ['process', 'Process'],
  ['beforeafter', 'Before / After'],
  ['faq', 'FAQ'],
  ['alpha-art', 'Alpha Art'],
  ['twocol', 'Two Columns']
];

function getBlocksForScope(scope) {
  if (scope === 'about') return state.global.about || [];
  const m = scope.match(/^proj-(.+)$/);
  if (m) {
    const proj = state.projectCache.get(m[1]);
    return proj?.blocks || [];
  }
  return [];
}

function setBlocksForScope(scope, blocks) {
  if (scope === 'about') {
    state.global.about = blocks;
  } else {
    const m = scope.match(/^proj-(.+)$/);
    if (m) {
      const proj = state.projectCache.get(m[1]);
      if (proj) proj.blocks = blocks;
    }
  }
}

function markDirtyForScope(scope) {
  if (scope === 'about') {
    markDirty('content.json');
  } else {
    const m = scope.match(/^proj-(.+)$/);
    if (m) markDirty('projects/' + m[1] + '.json');
  }
}

function handleBlockAction(action, selection, extra) {
  const { scope, blockId } = selection;
  const blocks = getBlocksForScope(scope);
  const index = blocks.findIndex(b => b.id === blockId);
  if (index === -1 && action !== 'add-after') return;

  switch (action) {
    case 'move-up':
      if (index > 0) {
        [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
        markDirtyForScope(scope);
        rerenderAllBlocks(scope);
        requestAnimationFrame(() => reselectBlock(scope, blockId));
      }
      break;

    case 'move-down':
      if (index < blocks.length - 1) {
        [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
        markDirtyForScope(scope);
        rerenderAllBlocks(scope);
        requestAnimationFrame(() => reselectBlock(scope, blockId));
      }
      break;

    case 'delete':
      blocks.splice(index, 1);
      markDirtyForScope(scope);
      clearCanvasSelection();
      clearSelection();
      rerenderAllBlocks(scope);
      break;

    case 'add-after': {
      const newBlock = normalizeBlock({ id: uid(), type: extra });
      if (!newBlock) return;
      if (index >= 0) {
        blocks.splice(index + 1, 0, newBlock);
      } else {
        blocks.push(newBlock);
      }
      setBlocksForScope(scope, blocks);
      markDirtyForScope(scope);
      rerenderAllBlocks(scope);
      requestAnimationFrame(() => reselectBlock(scope, newBlock.id));
      break;
    }
  }
}

function addNewBlock(scope, type) {
  pushState(state);
  const blocks = getBlocksForScope(scope);
  const newBlock = normalizeBlock({ id: uid(), type });
  if (!newBlock) return;
  blocks.push(newBlock);
  setBlocksForScope(scope, blocks);
  markDirtyForScope(scope);
  rerenderAllBlocks(scope);
  requestAnimationFrame(() => reselectBlock(scope, newBlock.id));
}

function rerenderAllBlocks(scope) {
  const blocks = normalizeBlocks(getBlocksForScope(scope));

  if (scope === 'about') {
    const container = document.querySelector('.v2-about');
    if (container) {
      container.innerHTML = renderEditableBlocks(blocks, 'about');
    }
  } else {
    const m = scope.match(/^proj-(.+)$/);
    if (m) {
      const projectEl = document.querySelector('.v2-project');
      if (!projectEl) return;
      const oldCanvas = projectEl.querySelector('.block-canvas');
      const newHTML = renderEditableBlocks(blocks, scope, { projectId: m[1] });
      if (oldCanvas) {
        const temp = document.createElement('div');
        temp.innerHTML = newHTML;
        const newCanvas = temp.querySelector('.block-canvas');
        if (newCanvas) oldCanvas.replaceWith(newCanvas);
      }
    }
  }
}

function reselectBlock(scope, blockId) {
  const el = document.querySelector(`.v2-block-wrap[data-canvas-block-id="${blockId}"]`);
  if (el) {
    clearCanvasSelection();
    el.classList.add('v2-selected');
    showAt(el, { type: 'block', scope, blockId });
  }
}

// ── Block type picker (for "Add Block" button) ──

function showBlockTypePicker(anchorBtn) {
  // Remove any existing picker
  document.querySelector('.v2-type-picker')?.remove();

  const scope = anchorBtn.dataset.v2AddScope;
  const picker = document.createElement('div');
  picker.className = 'v2-type-picker';

  picker.innerHTML = `<div class="v2-tp-title">Add Block</div><div class="v2-tp-grid">` +
    BLOCK_TYPE_MENU.map(([type, label]) =>
      `<button class="v2-tp-opt" data-type="${type}">${label}</button>`
    ).join('') + `</div>`;

  anchorBtn.insertAdjacentElement('afterend', picker);

  picker.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-type]');
    if (!opt) return;
    e.stopPropagation();
    addNewBlock(scope, opt.dataset.type);
    picker.remove();
  });

  // Close on outside click
  setTimeout(() => {
    const close = (e) => {
      if (!picker.contains(e.target) && e.target !== anchorBtn) {
        picker.remove();
        document.removeEventListener('click', close, true);
      }
    };
    document.addEventListener('click', close, true);
  }, 0);
}
