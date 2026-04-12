/**
 * Inspector — v2 Editor
 * Right-panel contextual property editor. Shows editable fields for selected elements.
 */

import { state, loadProject } from './dataBridge.js';
import { normalizeBlocks } from '../modules/blocks/blockManager.js';

// ── Block type → field definitions ──

const BLOCK_FIELDS = {
  'text-sm': [
    { key: 'content', label: 'Content', type: 'textarea' },
    { key: 'align', label: 'Alignment', type: 'align' }
  ],
  'text-md': [
    { key: 'content', label: 'Content', type: 'textarea' },
    { key: 'align', label: 'Alignment', type: 'align' }
  ],
  'text-lg': [
    { key: 'content', label: 'Content', type: 'textarea' },
    { key: 'align', label: 'Alignment', type: 'align' }
  ],
  'image': [
    { key: 'src', label: 'Image URL', type: 'text' },
    { key: 'alt', label: 'Alt Text', type: 'text' }
  ],
  'alpha-art': [
    { key: 'src', label: 'Image URL', type: 'text' },
    { key: 'alt', label: 'Alt Text', type: 'text' },
    { key: 'color', label: 'Mask Color', type: 'color' },
    { key: 'bg', label: 'Background', type: 'text' },
    { key: 'scale', label: 'Scale (0.1–2)', type: 'number', min: 0.1, max: 2, step: 0.1 },
    { key: 'fit', label: 'Fit', type: 'select', options: ['contain', 'cover'] },
    { key: 'ratio', label: 'Aspect Ratio', type: 'text' }
  ],
  'quote': [
    { key: 'content', label: 'Quote', type: 'textarea' },
    { key: 'align', label: 'Alignment', type: 'align' }
  ],
  'video': [
    { key: 'src', label: 'Video URL', type: 'text' }
  ],
  'divider': [],
  'callout': [
    { key: 'tone', label: 'Tone', type: 'select', options: ['note', 'highlight', 'warning'] },
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'content', label: 'Body', type: 'textarea' }
  ],
  'cta': [
    { key: 'headline', label: 'Headline', type: 'text' },
    { key: 'body', label: 'Body', type: 'textarea' },
    { key: 'buttonLabel', label: 'Button Text', type: 'text' },
    { key: 'buttonUrl', label: 'Button URL', type: 'text' },
    { key: 'tone', label: 'Tone', type: 'select', options: ['default', 'highlight'] }
  ],
  'beforeafter': [
    { key: 'beforeSrc', label: 'Before Image', type: 'text' },
    { key: 'beforeAlt', label: 'Before Alt', type: 'text' },
    { key: 'afterSrc', label: 'After Image', type: 'text' },
    { key: 'afterAlt', label: 'After Alt', type: 'text' },
    { key: 'caption', label: 'Caption', type: 'text' },
    { key: 'position', label: 'Position (0–100)', type: 'number', min: 0, max: 100, step: 1 }
  ]
};

// Complex block types with sub-items get a simplified inspector
const ITEM_BLOCK_TYPES = new Set(['stats', 'skills', 'gallery', 'process', 'faq', 'twocol']);

// ── Hero field definitions ──

const HERO_FIELDS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'role', label: 'Role', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' }
];

const CONTACT_FIELDS = [
  { key: 'contactPanel.title', label: 'Hero Title', type: 'text' },
  { key: 'contactPanel.titleAccent', label: 'Hero Accent', type: 'text' },
  { key: 'contactPanel.sub', label: 'Subtitle', type: 'textarea' },
  { key: 'contactPanel.emailLabel', label: 'Email Label', type: 'text' },
  { key: 'contactPanel.socialLabel', label: 'Social Label', type: 'text' },
  { key: 'contact.email', label: 'Email', type: 'text' }
];

// ── State ──

let currentSelection = null; // { type: 'block'|'section', scope, blockId, sectionName }
let onChangeCallback = null;

/**
 * Initialize the inspector. Call once on startup.
 * @param {Function} onChange - Called when a field is edited: onChange(selection, key, value)
 */
export function initInspector(onChange) {
  onChangeCallback = onChange;
}

/**
 * Set the current selection and render the inspector panel
 */
export function setSelection(selection) {
  currentSelection = selection;
  render();
}

/**
 * Clear the selection
 */
export function clearSelection() {
  currentSelection = null;
  render();
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
  } else {
    panel.innerHTML = `<div class="v2-insp-empty">Section: ${name}</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="v2-insp-header">${name.charAt(0).toUpperCase() + name.slice(1)}</div>
    <div class="v2-insp-fields">${fields.map(f => renderField(f, getNestedValue(data, f.key))).join('')}</div>`;

  bindFieldEvents(panel, fields, (key, value) => {
    setNestedValue(state.global, key, value);
    if (onChangeCallback) onChangeCallback(currentSelection, key, value);
  });
}

function renderBlockInspector(panel) {
  const { scope, blockId } = currentSelection;
  const block = findBlock(scope, blockId);

  if (!block) {
    panel.innerHTML = `<div class="v2-insp-empty">Block not found</div>`;
    return;
  }

  const fields = BLOCK_FIELDS[block.type];

  if (!fields) {
    // Complex block type (items-based) — show type label and basic info
    if (ITEM_BLOCK_TYPES.has(block.type)) {
      const count = block.items?.length || block.steps?.length || 0;
      panel.innerHTML = `
        <div class="v2-insp-header">${block.type}</div>
        <div class="v2-insp-fields">
          <div class="v2-insp-info">${count} item${count !== 1 ? 's' : ''}</div>
          ${block.type === 'gallery' ? renderField({ key: 'columns', label: 'Columns', type: 'select', options: ['2', '3'] }, String(block.columns || 2)) : ''}
        </div>`;

      if (block.type === 'gallery') {
        bindFieldEvents(panel, [{ key: 'columns', label: 'Columns', type: 'select', options: ['2', '3'] }], (key, value) => {
          block[key] = key === 'columns' ? parseInt(value, 10) : value;
          if (onChangeCallback) onChangeCallback(currentSelection, key, value);
        });
      }
      return;
    }

    panel.innerHTML = `<div class="v2-insp-empty">No editable fields for ${block.type}</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="v2-insp-header">${block.type}</div>
    <div class="v2-insp-fields">${fields.map(f => renderField(f, block[f.key])).join('')}</div>`;

  bindFieldEvents(panel, fields, (key, value) => {
    if (key === 'scale' || key === 'position') {
      block[key] = parseFloat(value);
    } else if (key === 'columns') {
      block[key] = parseInt(value, 10);
    } else {
      block[key] = value;
    }
    if (onChangeCallback) onChangeCallback(currentSelection, key, value);
  });
}

// ── Field rendering ──

function renderField(field, value) {
  const val = value ?? '';
  const id = 'v2-field-' + field.key.replace(/\./g, '-');

  if (field.type === 'textarea') {
    return `<div class="v2-insp-field">
      <label for="${id}">${field.label}</label>
      <textarea id="${id}" data-key="${field.key}" rows="3">${escapeHtml(val)}</textarea>
    </div>`;
  }

  if (field.type === 'select') {
    const opts = (field.options || []).map(o =>
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
