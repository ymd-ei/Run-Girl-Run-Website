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
  renderDisplayBlocks
} from '../display/displayRenderer.js';
import { normalizeBlocks } from '../modules/blocks/blockManager.js';
import { phosphorIcon } from '../utils/icons.js';
import { initInspector, setSelection, clearSelection, getSelection } from './inspector.js';
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
  canvas.addEventListener('dblclick', handleCanvasDblClick);
}

/**
 * Full render — call after data is loaded
 */
export function renderCanvas() {
  const canvas = document.getElementById('v2-canvas-inner');
  if (!canvas) return;

  const g = state.global;
  const theme = g.theme || {};

  // Apply theme CSS variables to the canvas scope
  applyCanvasTheme(theme);

  canvas.innerHTML = buildHeroHTML(g) +
    buildWorkHTML(g, theme) +
    buildAboutHTML(g) +
    buildContactHTML(g);

  // Wire up project card clicks
  canvas.querySelectorAll('[data-v2-project]').forEach(card => {
    card.addEventListener('click', () => openProject(card.dataset.v2Project));
  });

  // Wire up section nav clicks from sidebar
  updateSidebarNav();
}

/**
 * Apply theme as CSS variables scoped to the canvas wrapper
 */
function applyCanvasTheme(theme) {
  const root = document.getElementById('v2-canvas');
  if (!root) return;

  const vars = {
    '--color-accent': theme.accent || '#5e30eb',
    '--color-paper': theme.paper || '#f2ede4',
    '--color-ink': theme.ink || '#1a1714',
    '--color-panel-bg': theme.panelBg || '#f7f3ec',
    '--color-contact-accent': theme.ctAccent || '#ff7828',
    '--color-contact-bg': theme.ctBg || '#080808',
    '--color-contact-hi': theme.ctHi || '#ffffff',
    '--color-sensitive': theme.sensitiveColor || '#e03030',
    '--ink': theme.ink || '#1a1714',
    '--paper': theme.paper || '#f2ede4',
    '--accent': theme.accent || '#5e30eb',
    '--accent-rgb': hexToRgb(theme.accent || '#5e30eb'),
    '--panel-bg': theme.panelBg || '#f7f3ec',
    '--ct-accent': theme.ctAccent || '#ff4361',
    '--ct-bg': theme.ctBg || '#080808',
    '--ct-hi': theme.ctHi || '#ffffff'
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
    <section class="v2-section" data-v2-section="hero" id="v2-sec-hero">
      <div class="v2-section-label">Hero</div>
      <div class="v2-hero">
        <div class="v2-hero-bg">${reelHTML}</div>
        <div class="v2-hero-overlay"></div>
        <div class="v2-hero-text">
          <p class="v2-hero-role">${role}</p>
          <h1 class="v2-hero-name">${line1}${line2 ? '<br><em>' + line2 + '</em>' : ''}</h1>
        </div>
      </div>
    </section>`;
}

function buildWorkHTML(g, theme) {
  const filters = g.filters || [
    { value: '2d', label: '2D' },
    { value: '3d', label: '3D' },
    { value: 'motion', label: 'Motion' }
  ];

  // Show all projects (including drafts) in editor
  const gridHTML = renderWorkGrid(state.projects, theme, { showAll: true });

  // Replace onclick handlers with data attributes for v2
  const safeGrid = gridHTML.replace(
    /onclick="window\.display\?\.openProject\?\('([^']+)'\)"/g,
    'data-v2-project="$1"'
  );

  const filterBtns = `<button class="fb active" data-v2-filter="all">All</button>` +
    filters.map(f => `<button class="fb" data-v2-filter="${f.value}">${f.label}</button>`).join('');

  return `
    <section class="v2-section" data-v2-section="work" id="v2-sec-work">
      <div class="v2-section-label">Work</div>
      <div class="v2-work">
        <div class="v2-work-filters">${filterBtns}</div>
        <div class="v2-work-grid wg">${safeGrid}</div>
      </div>
    </section>`;
}

function buildAboutHTML(g) {
  const blocks = normalizeBlocks(g.about || []);
  const blocksHTML = renderDisplayBlocks(blocks, { scope: 'about' });

  return `
    <section class="v2-section" data-v2-section="about" id="v2-sec-about">
      <div class="v2-section-label">About</div>
      <div class="v2-about pb">${blocksHTML}</div>
    </section>`;
}

function buildContactHTML(g) {
  const ct = renderContactPanel(g);
  const email = g.contact?.email || '';

  const icons = (g.contact?.links || [])
    .map(l => `<a href="${l.url}" class="ct-icon-btn" title="${l.label}"><i class="${phosphorIcon(l.url)}"></i></a>`)
    .join('');

  return `
    <section class="v2-section" data-v2-section="contact" id="v2-sec-contact">
      <div class="v2-section-label">Contact</div>
      <div class="v2-contact">
        <div class="v2-contact-hero">
          <h1 class="ct-hero">${ct.hero}</h1>
          <p class="ct-sub">${ct.sub}</p>
        </div>
        <div class="v2-contact-details">
          <div class="v2-contact-col">
            <p class="v2-contact-label">${ct.emailLabel}</p>
            <a href="${email ? 'mailto:' + email : '#'}" class="v2-contact-email">${email}</a>
          </div>
          <div class="v2-contact-col">
            <p class="v2-contact-label">${ct.socialLabel}</p>
            <div class="ct-icons">${icons}</div>
          </div>
        </div>
      </div>
    </section>`;
}

// ── Project detail ──

export async function openProject(id) {
  const canvas = document.getElementById('v2-canvas-inner');
  if (!canvas) return;

  const project = await loadProject(id);
  if (!project) return;

  currentProjectId = id;
  currentSection = 'project';

  const heroImg = project.heroImage || project.thumbnail || '';
  const blocks = normalizeBlocks(project.blocks || []);
  const blocksHTML = renderDisplayBlocks(blocks, { scope: 'proj-' + id, projectId: id });

  canvas.innerHTML = `
    <section class="v2-section" data-v2-section="project">
      <div class="v2-section-label">
        <button class="v2-back-btn" id="v2-back">&#x2190; Back to all sections</button>
      </div>
      <div class="v2-project">
        <div class="v2-project-hero" ${heroImg ? `style="background-image:url('${heroImg}')"` : ''}>
          <div class="v2-project-hero-overlay"></div>
          <div class="v2-project-hero-content">
            <h2 class="v2-project-title">${project.title || ''}</h2>
            <div class="v2-project-meta">
              ${project.typeLabel ? `<span class="v2-project-tag">${project.typeLabel}</span>` : ''}
              ${project.year ? `<span class="v2-project-tag">${project.year}</span>` : ''}
              ${project.client ? `<span class="v2-project-tag">${project.client}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="v2-project-blocks pb">${blocksHTML}</div>
      </div>
    </section>`;

  document.getElementById('v2-back')?.addEventListener('click', () => {
    currentProjectId = null;
    currentSection = 'home';
    renderCanvas();
  });
}

// ── Sidebar nav ──

function updateSidebarNav() {
  const nav = document.getElementById('v2-sidebar-nav');
  if (!nav) return;

  const sections = ['hero', 'work', 'about', 'contact'];
  nav.innerHTML = sections
    .map(s => `<button class="v2-nav-item" data-v2-goto="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</button>`)
    .join('');

  nav.querySelectorAll('[data-v2-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById('v2-sec-' + btn.dataset.v2Goto);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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

// ── Canvas selection handlers ──

function handleCanvasClick(e) {
  if (isEditing()) return; // Don't disturb inline edit

  // Did we click on a block element with canvas attributes?
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
    setSelection({ type: 'section', sectionName });
    showInspector();
    return;
  }

  // Clicked blank canvas
  clearCanvasSelection();
  clearSelection();
}

function handleCanvasDblClick(e) {
  // Double-click on a text-editable element → inline edit
  const el = e.target.closest('[data-canvas-editable]');
  if (!el) return;

  e.stopPropagation();
  selectBlock(el);
  startEdit(el);
}

function selectBlock(el) {
  clearCanvasSelection();

  const scope = el.getAttribute('data-canvas-scope');
  const blockId = el.getAttribute('data-canvas-block-id');
  if (!scope || !blockId) return;

  // Walk up to the nearest top-level block wrapper (or use the element itself)
  const wrapper = el.closest('.block-canvas > *') || el;
  wrapper.classList.add('v2-selected');

  setSelection({ type: 'block', scope, blockId });
  showInspector();
}

function clearCanvasSelection() {
  document.querySelectorAll('.v2-selected').forEach(el => el.classList.remove('v2-selected'));
}

function showInspector() {
  const insp = document.getElementById('v2-inspector');
  if (insp) {
    insp.classList.add('open');
    document.documentElement.style.setProperty('--v2-inspector-w', '280px');
  }
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
    const sec = document.getElementById('v2-sec-contact');
    if (sec) {
      sec.querySelector('.v2-section-inner').innerHTML = buildContactHTML(g);
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
