/**
 * Inspector — v2 Editor
 * Floating contextual property editor, anchored to the selected block on the canvas.
 */

import { state, loadProject, uploadMedia } from './dataBridge.js';
import { normalizeBlocks } from '../modules/blocks/blockManager.js';

// ── Block type → field definitions ──

// Only non-visual properties live here. Text content is edited inline on the canvas.
const BLOCK_FIELDS = {
  'text-sm': [
    { key: 'align', label: 'Alignment', type: 'align' },
    { key: 'paddingTop', label: 'Pad Top (px)', type: 'number', min: 0, step: 1 },
    { key: 'paddingBottom', label: 'Pad Bottom (px)', type: 'number', min: 0, step: 1 }
  ],
  'text-md': [
    { key: 'align', label: 'Alignment', type: 'align' },
    { key: 'paddingTop', label: 'Pad Top (px)', type: 'number', min: 0, step: 1 },
    { key: 'paddingBottom', label: 'Pad Bottom (px)', type: 'number', min: 0, step: 1 }
  ],
  'text-lg': [
    { key: 'align', label: 'Alignment', type: 'align' },
    { key: 'paddingTop', label: 'Pad Top (px)', type: 'number', min: 0, step: 1 },
    { key: 'paddingBottom', label: 'Pad Bottom (px)', type: 'number', min: 0, step: 1 }
  ],
  'image': [
    { key: 'src', label: 'Image URL', type: 'image' },
    { key: 'alt', label: 'Alt Text', type: 'text' },
    { key: 'paddingTop', label: 'Pad Top (px)', type: 'number', min: 0, step: 1 },
    { key: 'paddingBottom', label: 'Pad Bottom (px)', type: 'number', min: 0, step: 1 }
  ],
  'alpha-art': [
    { key: 'src', label: 'Image URL', type: 'image' },
    { key: 'alt', label: 'Alt Text', type: 'text' },
    { key: 'color', label: 'Mask Color', type: 'color' },
    { key: 'bg', label: 'Background', type: 'text' },
    { key: 'scale', label: 'Scale (0.1–2)', type: 'number', min: 0.1, max: 2, step: 0.1 },
    { key: 'fit', label: 'Fit', type: 'select', options: ['contain', 'cover'] },
    { key: 'ratio', label: 'Aspect Ratio', type: 'text' }
  ],
  'quote': [
    { key: 'align', label: 'Alignment', type: 'align' },
    { key: 'paddingTop', label: 'Pad Top (px)', type: 'number', min: 0, step: 1 },
    { key: 'paddingBottom', label: 'Pad Bottom (px)', type: 'number', min: 0, step: 1 }
  ],
  'video': [
    { key: 'src', label: 'Video URL', type: 'image' },
    { key: 'paddingTop', label: 'Pad Top (px)', type: 'number', min: 0, step: 1 },
    { key: 'paddingBottom', label: 'Pad Bottom (px)', type: 'number', min: 0, step: 1 }
  ],
  'divider': [
    { key: 'paddingTop', label: 'Pad Top (px)', type: 'number', min: 0, step: 1 },
    { key: 'paddingBottom', label: 'Pad Bottom (px)', type: 'number', min: 0, step: 1 }
  ],
  'callout': [
    { key: 'tone', label: 'Tone', type: 'select', options: ['note', 'highlight', 'warning'] },
    { key: 'paddingTop', label: 'Pad Top (px)', type: 'number', min: 0, step: 1 },
    { key: 'paddingBottom', label: 'Pad Bottom (px)', type: 'number', min: 0, step: 1 }
  ],
  'cta': [
    { key: 'buttonLabel', label: 'Button Text', type: 'text' },
    { key: 'buttonUrl', label: 'Button URL', type: 'text' },
    { key: 'tone', label: 'Tone', type: 'select', options: ['default', 'highlight'] },
    { key: 'paddingTop', label: 'Pad Top (px)', type: 'number', min: 0, step: 1 },
    { key: 'paddingBottom', label: 'Pad Bottom (px)', type: 'number', min: 0, step: 1 }
  ],
  'beforeafter': [
    { key: 'beforeSrc', label: 'Before Image', type: 'image' },
    { key: 'beforeAlt', label: 'Before Alt', type: 'text' },
    { key: 'afterSrc', label: 'After Image', type: 'image' },
    { key: 'afterAlt', label: 'After Alt', type: 'text' },
    { key: 'caption', label: 'Caption', type: 'text' },
    { key: 'position', label: 'Position (0–100)', type: 'number', min: 0, max: 100, step: 1 },
    { key: 'paddingTop', label: 'Pad Top (px)', type: 'number', min: 0, step: 1 },
    { key: 'paddingBottom', label: 'Pad Bottom (px)', type: 'number', min: 0, step: 1 }
  ]
};

// Complex block types with sub-items get a simplified inspector
const ITEM_BLOCK_TYPES = new Set(['stats', 'skills', 'gallery', 'process', 'faq', 'twocol']);

// Block type labels for the "add after" picker
const BLOCK_TYPE_LABELS = [
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

// ── Hero field definitions ──

const HERO_FIELDS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'role', label: 'Role', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'reel.url', label: 'Background Video', type: 'image' },
  { key: 'watchReel.url', label: 'Watch Reel Video', type: 'image' },
  { key: 'favicon', label: 'Favicon', type: 'image' },
  { key: 'logo', label: 'Nav Logo', type: 'image' },
  { key: 'ogTitle', label: 'OG Title', type: 'text' },
  { key: 'ogDescription', label: 'OG Description', type: 'textarea' },
  { key: 'ogImage', label: 'OG Image', type: 'image' }
];

const CONTACT_FIELDS = [
  { key: 'contactPanel.title', label: 'Hero Title', type: 'text' },
  { key: 'contactPanel.titleAccent', label: 'Hero Accent', type: 'text' },
  { key: 'contactPanel.sub', label: 'Subtitle', type: 'textarea' },
  { key: 'contactPanel.scrollCue', label: 'Scroll Cue', type: 'text' },
  { key: 'contactPanel.emailLabel', label: 'Email Label', type: 'text' },
  { key: 'contactPanel.socialLabel', label: 'Social Label', type: 'text' },
  { key: 'contactPanel.resumeLabel', label: 'Resume Label', type: 'text' },
  { key: 'contact.email', label: 'Email', type: 'text' },
  { key: 'contact.resume', label: 'Resume File', type: 'image' },
  { key: 'contactPanel.tickerTop', label: 'Ticker Top (comma-sep)', type: 'text', isArray: true },
  { key: 'contactPanel.tickerMid', label: 'Ticker Mid (comma-sep)', type: 'text', isArray: true },
  { key: 'contactPanel.video.url', label: 'Background Video', type: 'image' }
];

const WORK_FIELDS = [
  { key: 'siteTitle', label: 'Site Title', type: 'text' }
];

const PROJECT_META_FIELDS = [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'type', label: 'Type', type: 'select', dynamic: 'filters' },
  { key: 'year', label: 'Year', type: 'text' },
  { key: 'client', label: 'Client', type: 'text' },
  { key: 'duration', label: 'Duration', type: 'text' },
  { key: 'thumbnail', label: 'Thumbnail', type: 'image' },
  { key: 'heroImage', label: 'Hero Image', type: 'image' },
  { key: 'videoUrl', label: 'Video URL', type: 'text' },
  { key: 'description', label: 'Share Description', type: 'textarea' },
  { key: 'tags', label: 'Tags (comma-sep)', type: 'text', isArray: true },
  { key: 'longform', label: 'Longform layout', type: 'checkbox' },
  { key: 'sensitive', label: 'Sensitive', type: 'checkbox' },
  { key: 'sensitiveLabel', label: 'Sensitive Label', type: 'text' }
];

const THEME_FIELDS = [
  { key: 'ink', label: 'Ink (Text)', type: 'color' },
  { key: 'paper', label: 'Paper (Background)', type: 'color' },
  { key: 'accent', label: 'Accent', type: 'color' },
  { key: 'panelBg', label: 'Panel Background', type: 'color' },
  { key: 'panelStyle', label: 'Panel Style', type: 'select', options: ['light', 'dark'] },
  { key: 'ctAccent', label: 'Contact Accent', type: 'color' },
  { key: 'ctBg', label: 'Contact Background', type: 'color' },
  { key: 'ctHi', label: 'Contact Highlight', type: 'color' },
  { key: 'sensitiveColor', label: 'Sensitive Color', type: 'color' }
];

// ── State ──

let currentSelection = null; // { type: 'block'|'section', scope, blockId, sectionName }
let onChangeCallback = null;
let onActionCallback = null;
let anchorEl = null;        // DOM element the inspector is anchored to
let scrollContainer = null; // the canvas scroll container

const MARGIN = 8;           // min px from viewport edges
const PANEL_W = 300;        // matches CSS width

/**
 * Initialize the inspector. Call once on startup.
 * @param {Function} onChange - Called when a field is edited: onChange(selection, key, value)
 */
export function initInspector(onChange, onAction) {
  onChangeCallback = onChange;
  onActionCallback = onAction || null;

  // Reposition on window resize
  window.addEventListener('resize', () => { if (anchorEl) reposition(); });
}

/**
 * Attach scroll listener to the canvas container (call once after DOM ready).
 */
export function bindCanvasScroll(container) {
  scrollContainer = container;
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => { if (anchorEl) reposition(); }, { passive: true });
  }
}

/**
 * Show the inspector anchored to a DOM element.
 */
export function showAt(el, selection) {
  anchorEl = el;
  currentSelection = selection;
  render();
  reposition();
  const panel = document.getElementById('v2-inspector');
  if (panel) panel.classList.add('open');
}

/**
 * Hide the inspector.
 */
export function hideInspector() {
  currentSelection = null;
  anchorEl = null;
  const panel = document.getElementById('v2-inspector');
  if (panel) panel.classList.remove('open');
}

/**
 * Set the current selection and re-render fields (without changing anchor).
 */
export function setSelection(selection) {
  currentSelection = selection;
  render();
}

/**
 * Clear the selection and hide.
 */
export function clearSelection() {
  hideInspector();
}

export function getSelection() {
  return currentSelection;
}

// ── Render ──

function render() {
  const panel = document.getElementById('v2-inspector');
  if (!panel) return;

  if (!currentSelection) {
    panel.innerHTML = `<div class="v2-insp-empty">Click an element on the canvas to inspect it</div>`;
    return;
  }

  if (currentSelection.type === 'section') {
    renderSectionInspector(panel);
  } else if (currentSelection.type === 'block') {
    renderBlockInspector(panel);
  }
}

// ── Positioning ──

function reposition() {
  // Inspector is now docked to the right — no floating positioning needed.
}

function renderSectionInspector(panel) {
  const name = currentSelection.sectionName;

  let fields = [];
  let data = {};

  if (name === 'hero') {
    fields = HERO_FIELDS;
    data = state.global;
  } else if (name === 'contact') {
    fields = CONTACT_FIELDS;
    data = state.global;

    const links = data.contact?.links || [];
    const linksHTML = links.map((l, i) => `
      <div class="v2-insp-sub-item" data-link-idx="${i}">
        <div class="v2-insp-sub-header"><span>#${i + 1}</span><button class="v2-insp-sub-del" data-del-link="${i}">&times;</button></div>
        <label>Label <input type="text" data-link-field="label" data-link-idx="${i}" value="${escapeHtml(l.label || '')}"></label>
        <label>URL <input type="text" data-link-field="url" data-link-idx="${i}" value="${escapeHtml(l.url || '')}"></label>
      </div>`).join('');

    panel.innerHTML = `
      <div class="v2-insp-header">Contact</div>
      <div class="v2-insp-fields">
        ${fields.map(f => {
          let val = getNestedValue(data, f.key);
          if (f.isArray && Array.isArray(val)) val = val.join(', ');
          return renderField(f, val);
        }).join('')}
        <div class="v2-insp-field">
          <label>Social Links</label>
          <div class="v2-insp-sub-items v2-links-list">${linksHTML}</div>
          <button class="v2-insp-sub-add v2-add-link">+ Add Link</button>
        </div>
      </div>`;

    bindFieldEvents(panel, fields, (key, value) => {
      const fieldDef = fields.find(f => f.key === key);
      if (fieldDef?.isArray) {
        setNestedValue(state.global, key, value.split(',').map(s => s.trim()).filter(Boolean));
      } else {
        setNestedValue(state.global, key, value);
      }
      if (onChangeCallback) onChangeCallback(currentSelection, key, value);
    });

    const syncLinks = () => {
      if (onChangeCallback) onChangeCallback(currentSelection, 'contact.links', data.contact.links);
    };

    panel.addEventListener('input', (e) => {
      const field = e.target.dataset.linkField;
      const idx = Number(e.target.dataset.linkIdx);
      if (field && !isNaN(idx) && data.contact?.links?.[idx]) {
        data.contact.links[idx][field] = e.target.value;
        syncLinks();
      }
    });

    panel.querySelector('.v2-add-link')?.addEventListener('click', () => {
      if (!data.contact) data.contact = {};
      if (!data.contact.links) data.contact.links = [];
      data.contact.links.push({ label: '', url: '' });
      syncLinks();
      render();
    });

    panel.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-del-link]');
      if (delBtn) {
        const idx = Number(delBtn.dataset.delLink);
        data.contact.links.splice(idx, 1);
        syncLinks();
        render();
      }
    });
    return;
  } else if (name === 'theme') {
    fields = THEME_FIELDS;
    data = state.global.theme || {};

    panel.innerHTML = `
      <div class="v2-insp-header">Theme</div>
      <div class="v2-insp-fields">${fields.map(f => renderField(f, data[f.key] || '')).join('')}</div>`;

    bindFieldEvents(panel, fields, (key, value) => {
      if (!state.global.theme) state.global.theme = {};
      state.global.theme[key] = value;
      if (onChangeCallback) onChangeCallback(currentSelection, key, value);
    });
    return;
  } else if (name === 'work') {
    fields = WORK_FIELDS;
    data = state.global;

    const filters = data.filters || [];
    const filterListHTML = filters.map((f, i) => `
      <div class="v2-insp-sub-item" data-filter-idx="${i}">
        <div class="v2-insp-sub-header"><span>#${i + 1}</span><button class="v2-insp-sub-del" data-del-filter="${i}">&times;</button></div>
        <label>Value <input type="text" data-filter-field="value" data-filter-idx="${i}" value="${escapeHtml(f.value || '')}"></label>
        <label>Label <input type="text" data-filter-field="label" data-filter-idx="${i}" value="${escapeHtml(f.label || '')}"></label>
      </div>`).join('');

    panel.innerHTML = `
      <div class="v2-insp-header">Work</div>
      <div class="v2-insp-fields">
        ${renderField({ key: 'siteTitle', label: 'Site Title', type: 'text' }, data.siteTitle || '')}
        <div class="v2-insp-field">
          <label>Filters</label>
          <div class="v2-insp-sub-items v2-filter-list">${filterListHTML}</div>
          <button class="v2-insp-sub-add v2-add-filter">+ Add Filter</button>
        </div>
        <div class="v2-insp-field">
          <label>Project Order</label>
          <p class="v2-insp-hint">Drag to reorder. Draft projects shown dimmed.</p>
          <div class="v2-insp-sub-items v2-project-order-list">${buildProjectOrderHTML()}</div>
        </div>
      </div>`;

    bindFieldEvents(panel, [{ key: 'siteTitle', label: 'Site Title', type: 'text' }], (key, value) => {
      state.global[key] = value;
      if (onChangeCallback) onChangeCallback(currentSelection, key, value);
    });

    const syncFilters = () => {
      if (onChangeCallback) onChangeCallback(currentSelection, 'filters', state.global.filters);
    };

    panel.addEventListener('input', (e) => {
      const field = e.target.dataset.filterField;
      const idx = Number(e.target.dataset.filterIdx);
      if (field && !isNaN(idx) && state.global.filters?.[idx]) {
        state.global.filters[idx][field] = e.target.value;
        syncFilters();
      }
    });

    panel.querySelector('.v2-add-filter')?.addEventListener('click', () => {
      if (!state.global.filters) state.global.filters = [];
      state.global.filters.push({ value: '', label: '' });
      syncFilters();
      render();
    });

    panel.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-del-filter]');
      if (delBtn) {
        const idx = Number(delBtn.dataset.delFilter);
        state.global.filters.splice(idx, 1);
        syncFilters();
        render();
      }
    });

    // Project order drag reordering
    initProjectOrderDrag(panel);
    return;
  } else if (name === 'project') {
    const projectId = currentSelection.projectId;
    if (!projectId) { panel.innerHTML = `<div class="v2-insp-empty">No project selected</div>`; return; }

    const card = state.projects.find(p => p.id === projectId) || {};
    const proj = state.projectCache.get(projectId) || card;
    const merged = { ...card, ...proj };

    fields = PROJECT_META_FIELDS;
    panel.innerHTML = `
      <div class="v2-insp-header">Project Settings</div>
      <div class="v2-insp-fields">${fields.map(f => {
        let val = merged[f.key];
        if (f.isArray && Array.isArray(val)) val = val.join(', ');
        return renderField(f, val);
      }).join('')}</div>`;

    bindFieldEvents(panel, fields, (key, value) => {
      const c = state.projects.find(p => p.id === projectId);
      const p = state.projectCache.get(projectId);
      const fieldDef = fields.find(f => f.key === key);
      const finalVal = fieldDef?.isArray ? value.split(',').map(s => s.trim()).filter(Boolean) : value;
      if (c) c[key] = finalVal;
      if (p) p[key] = finalVal;
      // Auto-set typeLabel when type changes
      if (key === 'type') {
        const filters = state.global?.filters || [];
        const match = filters.find(f => f.value === value);
        const label = match?.label || value;
        if (c) c.typeLabel = label;
        if (p) p.typeLabel = label;
      }
      if (onChangeCallback) onChangeCallback(currentSelection, key, finalVal);
    });
    return;
  } else {
    panel.innerHTML = `<div class="v2-insp-empty">Section: ${name}</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="v2-insp-header">${name.charAt(0).toUpperCase() + name.slice(1)}</div>
    <div class="v2-insp-fields">${fields.map(f => {
      let val = getNestedValue(data, f.key);
      if (f.isArray && Array.isArray(val)) val = val.join(', ');
      return renderField(f, val);
    }).join('')}</div>`;

  bindFieldEvents(panel, fields, (key, value) => {
    const fieldDef = fields.find(f => f.key === key);
    if (fieldDef?.isArray) {
      setNestedValue(state.global, key, value.split(',').map(s => s.trim()).filter(Boolean));
    } else {
      setNestedValue(state.global, key, value);
      // Auto-set video type when editing reel/watchReel URL
      if (key === 'reel.url') {
        setNestedValue(state.global, 'reel.type', detectMediaType(value));
      } else if (key === 'watchReel.url') {
        setNestedValue(state.global, 'watchReel.type', detectMediaType(value));
      }
    }
    if (onChangeCallback) onChangeCallback(currentSelection, key, value);
  });
}

// ── Project order drag reorder ──

function buildProjectOrderHTML() {
  const projects = state.global.projects || [];
  const cards = state.projects || [];
  return projects.map((id, i) => {
    const card = cards.find(c => c.id === id);
    const title = card?.title || id;
    const draft = card?.published === false;
    return `<div class="v2-insp-order-item${draft ? ' v2-draft' : ''}" draggable="true" data-order-idx="${i}" data-order-id="${escapeHtml(id)}">
      <span class="v2-insp-order-grip" title="Drag to reorder">&#9776;</span>
      <span class="v2-insp-order-label">${escapeHtml(title)}</span>
      ${draft ? '<span class="v2-insp-order-draft">Draft</span>' : ''}
    </div>`;
  }).join('');
}

function initProjectOrderDrag(panel) {
  const list = panel.querySelector('.v2-project-order-list');
  if (!list) return;

  let dragIdx = null;

  list.addEventListener('dragstart', (e) => {
    const item = e.target.closest('[data-order-idx]');
    if (!item) return;
    dragIdx = Number(item.dataset.orderIdx);
    item.classList.add('v2-dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('[data-order-idx]');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    target.classList.toggle('v2-drag-above', e.clientY < mid);
    target.classList.toggle('v2-drag-below', e.clientY >= mid);
  });

  list.addEventListener('dragleave', (e) => {
    const target = e.target.closest('[data-order-idx]');
    if (target) {
      target.classList.remove('v2-drag-above', 'v2-drag-below');
    }
  });

  list.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest('[data-order-idx]');
    if (!target || dragIdx === null) return;

    let dropIdx = Number(target.dataset.orderIdx);
    const rect = target.getBoundingClientRect();
    if (e.clientY >= rect.top + rect.height / 2) dropIdx++;
    if (dropIdx > dragIdx) dropIdx--;

    if (dropIdx !== dragIdx) {
      const projects = state.global.projects;
      const [moved] = projects.splice(dragIdx, 1);
      projects.splice(dropIdx, 0, moved);

      // Also reorder projectCards to match
      const cards = state.projects;
      const [movedCard] = cards.splice(cards.findIndex(c => c.id === moved), 1) || [null];
      if (movedCard) {
        const newCardIdx = projects.indexOf(moved);
        cards.splice(newCardIdx, 0, movedCard);
      }

      if (onChangeCallback) onChangeCallback(currentSelection, 'projects', projects);
    }

    // Clear drag indicators and re-render
    list.querySelectorAll('[data-order-idx]').forEach(el => {
      el.classList.remove('v2-dragging', 'v2-drag-above', 'v2-drag-below');
    });
    dragIdx = null;
    render();
  });

  list.addEventListener('dragend', () => {
    list.querySelectorAll('[data-order-idx]').forEach(el => {
      el.classList.remove('v2-dragging', 'v2-drag-above', 'v2-drag-below');
    });
    dragIdx = null;
  });
}

function renderBlockInspector(panel) {
  const { scope, blockId } = currentSelection;
  const block = findBlock(scope, blockId);

  if (!block) {
    panel.innerHTML = `<div class="v2-insp-empty">Block not found</div>`;
    return;
  }

  const { index, count } = getBlockPosition(scope, blockId);
  const actionsHTML = renderBlockActions(index, count);
  const fields = BLOCK_FIELDS[block.type];

  if (!fields) {
    // Complex block type (items-based) — full sub-item editing
    if (ITEM_BLOCK_TYPES.has(block.type)) {
      renderComplexBlockInspector(panel, block, actionsHTML);
      bindBlockActionEvents(panel);
      return;
    }

    panel.innerHTML = `
      <div class="v2-insp-header">${block.type}</div>
      ${actionsHTML}
      <div class="v2-insp-empty">No editable fields for ${block.type}</div>`;
    bindBlockActionEvents(panel);
    return;
  }

  panel.innerHTML = `
    <div class="v2-insp-header">${block.type}</div>
    ${actionsHTML}
    <div class="v2-insp-fields">${fields.map(f => renderField(f, block[f.key])).join('')}</div>`;

  bindBlockActionEvents(panel);
  bindFieldEvents(panel, fields, (key, value) => {
    if (key === 'scale' || key === 'position') {
      block[key] = parseFloat(value);
    } else if (key === 'columns' || key === 'paddingTop' || key === 'paddingBottom') {
      block[key] = parseInt(value, 10) || 0;
    } else {
      block[key] = value;
    }
    if (onChangeCallback) onChangeCallback(currentSelection, key, value);
  });
}

function getBlockPosition(scope, blockId) {
  let blocks = [];
  if (scope === 'about') {
    blocks = state.global.about || [];
  } else {
    const m = scope.match(/^proj-(.+)$/);
    if (m) {
      const proj = state.projectCache.get(m[1]);
      blocks = proj?.blocks || [];
    }
  }
  const index = blocks.findIndex(b => b.id === blockId);
  return { index, count: blocks.length };
}

function renderBlockActions(index, count) {
  const addOpts = BLOCK_TYPE_LABELS.map(([val, label]) =>
    `<option value="${val}">${label}</option>`
  ).join('');

  return `<div class="v2-insp-actions">
    <button class="v2-insp-act" data-v2-action="move-up" title="Move up" ${index <= 0 ? 'disabled' : ''}>&#9650;</button>
    <button class="v2-insp-act" data-v2-action="move-down" title="Move down" ${index >= count - 1 ? 'disabled' : ''}>&#9660;</button>
    <button class="v2-insp-act v2-insp-act-del" data-v2-action="delete" title="Delete block">&#10005;</button>
  </div>
  <div class="v2-insp-add-row">
    <select class="v2-insp-add-sel" data-v2-action="add-after">
      <option value="">+ Add block after…</option>
      ${addOpts}
    </select>
  </div>`;
}

function bindBlockActionEvents(panel) {
  panel.querySelectorAll('[data-v2-action]').forEach(el => {
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', () => {
        if (el.value && onActionCallback) {
          onActionCallback(el.dataset.v2Action, currentSelection, el.value);
          el.value = '';
        }
      });
    } else if (el.tagName === 'BUTTON') {
      el.addEventListener('click', () => {
        if (onActionCallback) onActionCallback(el.dataset.v2Action, currentSelection);
      });
    }
  });
}

// ── Field rendering ──

function renderField(field, value) {
  const val = value ?? '';
  const id = 'v2-field-' + field.key.replace(/\./g, '-');

  if (field.type === 'format') {
    return `<div class="v2-insp-field">
      <label>${field.label}</label>
      <div class="v2-insp-format-btns">
        <button data-fmt-cmd="bold" title="Bold"><b>B</b></button>
        <button data-fmt-cmd="italic" title="Italic"><i>I</i></button>
        <button data-fmt-cmd="underline" title="Underline"><u>U</u></button>
        <button data-fmt-cmd="rgr" title="RGR Badge" class="v2-ft-rgr">RGR</button>
      </div>
    </div>`;
  }

  if (field.type === 'textarea') {
    return `<div class="v2-insp-field">
      <label for="${id}">${field.label}</label>
      <textarea id="${id}" data-key="${field.key}" rows="3">${escapeHtml(val)}</textarea>
    </div>`;
  }

  if (field.type === 'select') {
    let options = field.options || [];
    if (field.dynamic === 'filters') {
      const filters = state.global?.filters || [
        { value: '2d', label: '2D' },
        { value: '3d', label: '3D' },
        { value: 'motion', label: 'Motion' }
      ];
      options = filters.map(f => f.value);
    }
    const opts = options.map(o =>
      `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`
    ).join('');
    return `<div class="v2-insp-field">
      <label for="${id}">${field.label}</label>
      <select id="${id}" data-key="${field.key}">${opts}</select>
    </div>`;
  }

  if (field.type === 'align') {
    return `<div class="v2-insp-field">
      <label>${field.label}</label>
      <div class="v2-insp-align" data-key="${field.key}">
        <button class="${val === 'left' || !val ? 'active' : ''}" data-val="left">L</button>
        <button class="${val === 'center' ? 'active' : ''}" data-val="center">C</button>
        <button class="${val === 'right' ? 'active' : ''}" data-val="right">R</button>
      </div>
    </div>`;
  }

  if (field.type === 'color') {
    return `<div class="v2-insp-field">
      <label for="${id}">${field.label}</label>
      <div class="v2-insp-color-row">
        <input type="color" id="${id}" data-key="${field.key}" value="${val || '#5e30eb'}">
        <input type="text" data-key="${field.key}" data-color-text value="${val || '#5e30eb'}" class="v2-insp-color-text">
      </div>
    </div>`;
  }

  if (field.type === 'number') {
    return `<div class="v2-insp-field">
      <label for="${id}">${field.label}</label>
      <input type="number" id="${id}" data-key="${field.key}" value="${val}" min="${field.min ?? ''}" max="${field.max ?? ''}" step="${field.step ?? 1}">
    </div>`;
  }

  if (field.type === 'image') {
    return `<div class="v2-insp-field">
      <label for="${id}">${field.label}</label>
      <div class="v2-insp-upload-row">
        <input type="text" id="${id}" data-key="${field.key}" value="${escapeHtml(val)}" placeholder="URL or upload…">
        <button class="v2-insp-browse-btn" data-browse-for="${field.key}" title="Browse media">&#128193;</button>
        <button class="v2-insp-upload-btn" data-upload-for="${field.key}" title="Upload file">&#8679;</button>
        <input type="file" class="v2-insp-upload-input" data-upload-key="${field.key}" accept="image/*,video/*" hidden>
      </div>
    </div>`;
  }

  if (field.type === 'checkbox') {
    return `<div class="v2-insp-field v2-insp-field-check">
      <label><input type="checkbox" data-key="${field.key}" ${val ? 'checked' : ''}> ${field.label}</label>
    </div>`;
  }

  // Default: text input
  return `<div class="v2-insp-field">
    <label for="${id}">${field.label}</label>
    <input type="text" id="${id}" data-key="${field.key}" value="${escapeHtml(val)}">
  </div>`;
}

function bindFieldEvents(panel, fields, onEdit) {
  // Text, textarea, number, select
  panel.querySelectorAll('input[data-key], textarea[data-key], select[data-key]').forEach(el => {
    if (el.dataset.colorText) return; // handled by color sync
    if (el.type === 'checkbox') {
      el.addEventListener('change', () => { onEdit(el.dataset.key, el.checked); });
      return;
    }
    el.addEventListener('input', () => {
      onEdit(el.dataset.key, el.value);
    });
  });

  // Color picker → sync text
  panel.querySelectorAll('input[type="color"][data-key]').forEach(picker => {
    const textInput = panel.querySelector(`input[data-color-text][data-key="${picker.dataset.key}"]`);
    picker.addEventListener('input', () => {
      if (textInput) textInput.value = picker.value;
      onEdit(picker.dataset.key, picker.value);
    });
    if (textInput) {
      textInput.addEventListener('input', () => {
        if (/^#[0-9a-f]{6}$/i.test(textInput.value)) {
          picker.value = textInput.value;
          onEdit(textInput.dataset.key, textInput.value);
        }
      });
    }
  });

  // Align toggle buttons
  panel.querySelectorAll('.v2-insp-align').forEach(group => {
    group.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onEdit(group.dataset.key, btn.dataset.val);
      });
    });
  });

  // Upload buttons (image/media fields)
  panel.querySelectorAll('.v2-insp-upload-btn').forEach(btn => {
    const key = btn.dataset.uploadFor;
    const fileInput = panel.querySelector(`.v2-insp-upload-input[data-upload-key="${key}"]`);
    if (!fileInput) return;

    btn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      btn.textContent = '…';
      btn.disabled = true;
      try {
        const result = await uploadMedia(file);
        if (result.success && result.path) {
          const textInput = panel.querySelector(`input[type="text"][data-key="${key}"]`);
          if (textInput) textInput.value = result.path;
          onEdit(key, result.path);
          btn.textContent = '✓';
          setTimeout(() => { btn.textContent = '⇧'; btn.disabled = false; }, 1500);
        } else {
          btn.textContent = '✗';
          setTimeout(() => { btn.textContent = '⇧'; btn.disabled = false; }, 2000);
        }
      } catch {
        btn.textContent = '✗';
        setTimeout(() => { btn.textContent = '⇧'; btn.disabled = false; }, 2000);
      }
    });
  });

  // Browse media buttons (image fields)
  panel.querySelectorAll('.v2-insp-browse-btn[data-browse-for]').forEach(btn => {
    const key = btn.dataset.browseFor;
    btn.addEventListener('click', () => {
      if (typeof window.__v2OpenMediaLibrary === 'function') {
        window.__v2OpenMediaLibrary((path) => {
          const textInput = panel.querySelector(`input[type="text"][data-key="${key}"]`);
          if (textInput) textInput.value = path;
          onEdit(key, path);
        });
      }
    });
  });

  // Format buttons (bold, italic, underline, RGR badge)
  panel.querySelectorAll('[data-fmt-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault()); // keep focus on contenteditable
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.fmtCmd;
      if (cmd === 'rgr') {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        const parentRgr = sel.anchorNode.parentElement?.closest('rgr');
        if (parentRgr) {
          const frag = document.createDocumentFragment();
          while (parentRgr.firstChild) frag.appendChild(parentRgr.firstChild);
          parentRgr.replaceWith(frag);
        } else {
          const badge = document.createElement('rgr');
          badge.appendChild(range.extractContents());
          range.insertNode(badge);
          sel.removeAllRanges();
          const newRange = document.createRange();
          newRange.selectNodeContents(badge);
          sel.addRange(newRange);
        }
      } else {
        document.execCommand(cmd, false);
      }
    });
  });
}

// ── Complex block sub-item inspector ──

const ITEM_SCHEMAS = {
  stats:   { arrayKey: 'items', fields: [{ key: 'num', label: 'Value', type: 'text' }, { key: 'label', label: 'Label', type: 'text' }] },
  skills:  { arrayKey: 'items', fields: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'pct', label: 'Percent', type: 'number', min: 0, max: 100 }] },
  gallery: { arrayKey: 'items', fields: [{ key: 'src', label: 'Image', type: 'image' }, { key: 'alt', label: 'Alt', type: 'text' }, { key: 'caption', label: 'Caption', type: 'text' }], blockFields: [{ key: 'columns', label: 'Columns', type: 'select', options: ['2', '3'] }] },
  process: { arrayKey: 'steps', fields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'content', label: 'Body', type: 'textarea' }, { key: 'date', label: 'Date', type: 'text' }, { key: 'image', label: 'Image', type: 'image' }] },
  faq:     { arrayKey: 'items', fields: [{ key: 'question', label: 'Question', type: 'text' }, { key: 'answer', label: 'Answer', type: 'textarea' }] },
  twocol:  null // special case
};

function renderComplexBlockInspector(panel, block, actionsHTML) {
  const schema = ITEM_SCHEMAS[block.type];

  // Two-column: special case — each side is a block
  if (block.type === 'twocol') {
    const leftType = block.left?.type || 'text-md';
    const rightType = block.right?.type || 'image';
    panel.innerHTML = `
      <div class="v2-insp-header">Two Columns</div>
      ${actionsHTML}
      <div class="v2-insp-fields">
        <div class="v2-insp-sub-header">Left (${leftType})</div>
        ${renderSubBlockFields(block.left || {}, 'left')}
        <div class="v2-insp-sub-header">Right (${rightType})</div>
        ${renderSubBlockFields(block.right || {}, 'right')}
      </div>
      <div class="v2-insp-field">
        <label>Pad Top (px)</label>
        <input type="number" data-key="paddingTop" value="${parseInt(block.paddingTop) || 0}" min="0" step="1">
      </div>
      <div class="v2-insp-field">
        <label>Pad Bottom (px)</label>
        <input type="number" data-key="paddingBottom" value="${parseInt(block.paddingBottom) || 0}" min="0" step="1">
      </div>`;

    // Bind twocol sub-fields
    panel.querySelectorAll('[data-side][data-subkey]').forEach(el => {
      el.addEventListener('input', () => {
        const side = el.dataset.side;
        const key = el.dataset.subkey;
        if (!block[side]) block[side] = {};
        block[side][key] = el.value;
        if (onChangeCallback) onChangeCallback(currentSelection, `${side}.${key}`, el.value);
      });
    });
    // Padding
    panel.querySelectorAll('input[type="number"][data-key]').forEach(el => {
      el.addEventListener('input', () => {
        block[el.dataset.key] = parseInt(el.value, 10) || 0;
        if (onChangeCallback) onChangeCallback(currentSelection, el.dataset.key, block[el.dataset.key]);
      });
    });
    return;
  }

  if (!schema) return;

  const items = block[schema.arrayKey] || [];
  const blockFieldsHTML = (schema.blockFields || []).map(f => renderField(f, String(block[f.key] ?? ''))).join('');

  let itemsHTML = items.map((item, i) => `
    <div class="v2-insp-sub-item" data-item-index="${i}">
      <div class="v2-insp-sub-header">
        <span>#${i + 1}</span>
        <button class="v2-insp-sub-del" data-del-index="${i}" title="Remove">✕</button>
      </div>
      ${schema.fields.map(f => {
        const val = item[f.key] ?? '';
        const id = `v2-sub-${i}-${f.key}`;
        if (f.type === 'textarea') {
          return `<div class="v2-insp-field"><label for="${id}">${f.label}</label><textarea id="${id}" data-item-idx="${i}" data-subkey="${f.key}" rows="2">${escapeHtml(val)}</textarea></div>`;
        }
        if (f.type === 'number') {
          return `<div class="v2-insp-field"><label for="${id}">${f.label}</label><input type="number" id="${id}" data-item-idx="${i}" data-subkey="${f.key}" value="${val}" min="${f.min??''}" max="${f.max??''}"></div>`;
        }
        if (f.type === 'image') {
          return `<div class="v2-insp-field"><label for="${id}">${f.label}</label><div class="v2-insp-upload-row"><input type="text" id="${id}" data-item-idx="${i}" data-subkey="${f.key}" value="${escapeHtml(val)}"><button class="v2-insp-browse-btn" data-browse-for-sub="${i}-${f.key}" title="Browse media">&#128193;</button><button class="v2-insp-upload-btn" data-upload-for-sub="${i}-${f.key}">⇧</button><input type="file" class="v2-insp-upload-input" data-upload-sub-key="${i}-${f.key}" accept="image/*,video/*" hidden></div></div>`;
        }
        return `<div class="v2-insp-field"><label for="${id}">${f.label}</label><input type="text" id="${id}" data-item-idx="${i}" data-subkey="${f.key}" value="${escapeHtml(val)}"></div>`;
      }).join('')}
    </div>`).join('');

  panel.innerHTML = `
    <div class="v2-insp-header">${block.type}</div>
    ${actionsHTML}
    <div class="v2-insp-fields">
      ${blockFieldsHTML}
      <div class="v2-insp-sub-items">${itemsHTML}</div>
      <button class="v2-insp-sub-add" data-add-item>+ Add Item</button>
      <div class="v2-insp-field">
        <label>Pad Top (px)</label>
        <input type="number" data-key="paddingTop" value="${parseInt(block.paddingTop) || 0}" min="0" step="1">
      </div>
      <div class="v2-insp-field">
        <label>Pad Bottom (px)</label>
        <input type="number" data-key="paddingBottom" value="${parseInt(block.paddingBottom) || 0}" min="0" step="1">
      </div>
    </div>`;

  // Bind block-level fields (e.g. gallery columns)
  if (schema.blockFields) {
    bindFieldEvents(panel, schema.blockFields, (key, value) => {
      block[key] = key === 'columns' ? parseInt(value, 10) : value;
      if (onChangeCallback) onChangeCallback(currentSelection, key, value);
    });
  }

  // Bind sub-item field edits
  panel.querySelectorAll('[data-item-idx][data-subkey]').forEach(el => {
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.itemIdx, 10);
      const key = el.dataset.subkey;
      const arr = block[schema.arrayKey];
      if (arr && arr[idx]) {
        arr[idx][key] = (el.type === 'number') ? parseFloat(el.value) : el.value;
        if (onChangeCallback) onChangeCallback(currentSelection, `${schema.arrayKey}[${idx}].${key}`, el.value);
      }
    });
  });

  // Bind padding
  panel.querySelectorAll('input[type="number"][data-key]').forEach(el => {
    el.addEventListener('input', () => {
      block[el.dataset.key] = parseInt(el.value, 10) || 0;
      if (onChangeCallback) onChangeCallback(currentSelection, el.dataset.key, block[el.dataset.key]);
    });
  });

  // Delete sub-item
  panel.querySelectorAll('.v2-insp-sub-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.delIndex, 10);
      const arr = block[schema.arrayKey];
      if (arr) {
        arr.splice(idx, 1);
        if (onChangeCallback) onChangeCallback(currentSelection, schema.arrayKey, arr);
        render(); // re-render inspector
      }
    });
  });

  // Add sub-item
  const addBtn = panel.querySelector('[data-add-item]');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (!block[schema.arrayKey]) block[schema.arrayKey] = [];
      const newItem = {};
      schema.fields.forEach(f => { newItem[f.key] = f.type === 'number' ? 0 : ''; });
      block[schema.arrayKey].push(newItem);
      if (onChangeCallback) onChangeCallback(currentSelection, schema.arrayKey, block[schema.arrayKey]);
      render(); // re-render inspector
    });
  }

  // Sub-item upload buttons
  panel.querySelectorAll('.v2-insp-upload-btn[data-upload-for-sub]').forEach(btn => {
    const [idxStr, key] = btn.dataset.uploadForSub.split('-');
    const idx = parseInt(idxStr, 10);
    const fileInput = panel.querySelector(`.v2-insp-upload-input[data-upload-sub-key="${btn.dataset.uploadForSub}"]`);
    if (!fileInput) return;
    btn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      btn.textContent = '…'; btn.disabled = true;
      try {
        const result = await uploadMedia(file);
        if (result.success && result.path) {
          const arr = block[schema.arrayKey];
          if (arr && arr[idx]) { arr[idx][key] = result.path; }
          const textEl = panel.querySelector(`input[data-item-idx="${idx}"][data-subkey="${key}"]`);
          if (textEl) textEl.value = result.path;
          if (onChangeCallback) onChangeCallback(currentSelection, `${schema.arrayKey}[${idx}].${key}`, result.path);
          btn.textContent = '✓'; setTimeout(() => { btn.textContent = '⇧'; btn.disabled = false; }, 1500);
        } else { btn.textContent = '✗'; setTimeout(() => { btn.textContent = '⇧'; btn.disabled = false; }, 2000); }
      } catch { btn.textContent = '✗'; setTimeout(() => { btn.textContent = '⇧'; btn.disabled = false; }, 2000); }
    });
  });

  // Sub-item browse media buttons
  panel.querySelectorAll('.v2-insp-browse-btn[data-browse-for-sub]').forEach(btn => {
    const [idxStr, key] = btn.dataset.browseForSub.split('-');
    const idx = parseInt(idxStr, 10);
    btn.addEventListener('click', () => {
      if (typeof window.__v2OpenMediaLibrary === 'function') {
        window.__v2OpenMediaLibrary((path) => {
          const arr = block[schema.arrayKey];
          if (arr && arr[idx]) { arr[idx][key] = path; }
          const textEl = panel.querySelector(`input[data-item-idx="${idx}"][data-subkey="${key}"]`);
          if (textEl) textEl.value = path;
          if (onChangeCallback) onChangeCallback(currentSelection, `${schema.arrayKey}[${idx}].${key}`, path);
        });
      }
    });
  });
}

function renderSubBlockFields(sub, side) {
  const type = sub.type || 'text-md';
  const fields = BLOCK_FIELDS[type] || [];
  return fields.filter(f => f.key !== '_format' && f.key !== 'paddingTop' && f.key !== 'paddingBottom').map(f => {
    const val = sub[f.key] ?? '';
    const id = `v2-twocol-${side}-${f.key}`;
    if (f.type === 'image') {
      return `<div class="v2-insp-field"><label for="${id}">${f.label}</label><input type="text" id="${id}" data-side="${side}" data-subkey="${f.key}" value="${escapeHtml(val)}"></div>`;
    }
    return `<div class="v2-insp-field"><label for="${id}">${f.label}</label><input type="text" id="${id}" data-side="${side}" data-subkey="${f.key}" value="${escapeHtml(val)}"></div>`;
  }).join('') + `<div class="v2-insp-field"><label>Content</label><textarea data-side="${side}" data-subkey="content" rows="3">${escapeHtml(sub.content || '')}</textarea></div>`;
}

// ── Helpers ──

function findBlock(scope, blockId) {
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

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj) ?? '';
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    return o[k];
  }, obj);
  target[last] = value;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function detectMediaType(url) {
  if (!url) return 'video';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  if (/youtu\.?be/i.test(url)) return 'youtube';
  if (/<iframe/i.test(url)) return 'embed';
  return 'video';
}
