/**
 * Canvas — v2 Editor
 * Renders the portfolio site sections inline inside the editor canvas.
 * Uses shared renderers (displayRenderer, blockRenderer) — does NOT import main.js.
 */

import { state, loadProject } from './dataBridge.js';
import {
  applyTheme,
  renderWorkGrid,
  renderContactPanel,
  renderDisplayBlocks,
  initSensitiveTapes
} from '../display/displayRenderer.js';
import { normalizeBlocks } from '../modules/blocks/blockManager.js';
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
    if (selection.type === 'section') {
      rerenderSection(selection.sectionName);
    } else if (selection.type === 'block') {
      rerenderBlock(selection.scope, selection.blockId);
    }
  });

  // Floating toolbar: when inline text edit commits
  initToolbar((scope, blockId, field, value) => {
    const block = findBlockData(scope, blockId);
    if (block) {
      block[field] = value;
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
function applyCanvasTheme(theme) {
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
    <div class="v2-panel v2-panel-wide" data-v2-panel="work">
      <div class="v2-ph"><span class="v2-pt">Work</span><button class="v2-pc v2-panel-close">&#x2715;</button></div>
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
  const blocksHTML = renderDisplayBlocks(blocks, { scope: 'about' });

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
  const blocksHTML = renderDisplayBlocks(blocks, { scope: 'proj-' + id, projectId: id });

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
        <div class="block-canvas">${blocksHTML}</div>
      </div>`;
    scrollEl.scrollTop = 0;
  }

  // Close work panel, open project panel
  inner.querySelector('.v2-panel[data-v2-panel="work"]')?.classList.remove('open');
  panel.classList.add('open');
  document.getElementById('v2-backdrop')?.classList.add('open');
  updateSidebarActive();
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
    .join('');

  list.querySelectorAll('[data-v2-open-project]').forEach(btn => {
    btn.addEventListener('click', () => openProject(btn.dataset.v2OpenProject));
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

// ── Canvas selection handlers ──

function handleCanvasClick(e) {
  if (isEditing()) {
    // If we clicked inside the element being edited, let it be
    return;
  }

  // Did we click on an inline-editable element? → start typing immediately
  const editableEl = e.target.closest('[data-canvas-editable]');
  if (editableEl) {
    e.stopPropagation();
    selectBlock(editableEl);
    startEdit(editableEl);
    return;
  }

  // Did we click on a block element (non-editable, e.g. image, video)?
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
  // Find all elements with this block ID and re-render them
  const el = document.querySelector(`[data-canvas-block-id="${blockId}"]`);
  if (!el) return;

  // Get the block data
  const block = findBlockData(scope, blockId);
  if (!block) return;

  const theme = state.global.theme || {};

  // Import renderBlock dynamically from the shared renderer
  import('../modules/blocks/blockRenderer.js').then(({ renderBlock }) => {
    const renderOptions = { canvasScope: scope };
    const m = scope.match(/^proj-(.+)$/);
    if (m) renderOptions.canvasProjectId = m[1];

    const newHTML = renderBlock(block, theme, renderOptions);
    if (!newHTML) return;

    // Find the wrapper to replace (parent .block-canvas child, or the element itself)
    const wrapper = el.closest('.block-canvas > *') || el;
    const temp = document.createElement('div');
    temp.innerHTML = newHTML;
    const newEl = temp.firstElementChild;
    if (newEl) {
      wrapper.replaceWith(newEl);
      // Re-select the new element
      newEl.classList.add('v2-selected');
    }
  });
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
