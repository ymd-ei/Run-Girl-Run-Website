/**
 * Inspector — v3 Editor (right panel)
 *
 * Structured / non-text fields for the current selection. Inline TEXT editing
 * happens directly on the canvas; this panel handles everything else:
 * media, alignment, tone, block options, and array sub-items (stats / skills /
 * gallery / process / faq), plus block-level actions (type, move, dup, delete).
 *
 * Reuses the shared blockManager CRUD so behaviour matches v1.
 */

import { state, markDirty } from './dataBridge.js';
import { pushState } from './history.js';
import {
  findBlock as bmFindBlock, updateBlock as bmUpdateBlock,
  updateItemProperty, addItemToBlock, removeItemFromBlock,
  updateStepProperty, addStepToBlock, removeStepFromBlock,
  updateColumnField, updateColumnType,
  getBlocks as bmGetBlocks, setBlocks as bmSetBlocks
} from '../modules/blocks/blockManager.js';
import { blocksToMarkdown, parseMarkdownToBlocks } from '../modules/blocks/markdown.js';
import { slugRef, listRefs } from '../utils/refs.js';
import { DEFAULT_FILTERS, projectTypes, setProjectTypes, filterTags } from '../utils/projectTypes.js';
import { SITE_TEXT_FIELDS, SITE_TEXT_DEFAULTS } from '../display/siteChrome.js';

let panelEl = null;
let cb = {};             // { repaint, action, openMedia }
let current = null;      // { scope, blockId, projectId, blockType }

const BLOCK_TYPE_OPTIONS = [
  ['text-lg', 'Large Text'], ['text-md', 'Body Text'], ['text-sm', 'Small Text'],
  ['quote', 'Quote'], ['image', 'Image'], ['gallery', 'Gallery'], ['video', 'Video'],
  ['beforeafter', 'Before / After'], ['alpha-art', 'Alpha Art'], ['twocol', 'Two Columns'],
  ['stats', 'Stats'], ['skills', 'Skills'], ['process', 'Process'], ['faq', 'FAQ'],
  ['callout', 'Callout'], ['cta', 'CTA Banner'], ['divider', 'Divider']
];

const COL_TYPE_OPTIONS = [['text-md', 'Text'], ['image', 'Image']];

export function initInspector(callbacks) {
  cb = callbacks || {};
  panelEl = document.getElementById('v3-inspector');
  clearInspector();
}

function bm() { return { globalState: state.global, projects: state.projects }; }
function dirtyForScope(scope) {
  return scope && scope.startsWith('proj-') ? 'projects/' + scope.slice(5) + '.json' : 'content.json';
}

export function clearInspector() {
  current = null;
  if (!panelEl) return;
  panelEl.innerHTML = `<div class="v3-insp-empty">
    <i class="ph-fill ph-cursor-click"></i>
    <p>Click any text on the page to edit it inline.</p>
    <p class="v3-insp-hint">Hover a block for its toolbar, or select one to edit its options here.</p>
  </div>`;
}

export function showSectionInspector(panel) {
  current = null;
  if (!panelEl) return;
  const title = panel === 'about' ? 'About Section' : panel === 'contact' ? 'Contact Section' : panel;
  panelEl.innerHTML = `<div class="v3-insp-head"><span>${title}</span></div>
    <div class="v3-insp-body">
      <p class="v3-insp-hint">Click text on the page to edit it inline. Hover a block to insert, move, or delete it; select a block to edit its options here.</p>
      ${panel === 'about' ? mdToolsHTML() : ''}
    </div>`;
  if (panel === 'about') bindMdTools('about');
}

// ── Markdown import / export ─────────────────────────────────
function mdToolsHTML() {
  return `<div class="v3-set-group"><div class="v3-set-head">Markdown</div>
    <div class="v3-md-tools">
      <button class="v3-md-btn" data-md-export><i class="ph-fill ph-download-simple"></i> Export .md</button>
      <button class="v3-md-btn" data-md-import><i class="ph-fill ph-upload-simple"></i> Import .md</button>
    </div></div>`;
}

function bindMdTools(scope) {
  panelEl.querySelector('[data-md-export]')?.addEventListener('click', () => exportMd(scope));
  panelEl.querySelector('[data-md-import]')?.addEventListener('click', () => importMd(scope));
}

function exportMd(scope) {
  const blocks = bmGetBlocks(bm(), scope) || [];
  if (!blocks.length) { window.__v3toast && window.__v3toast('No blocks to export', true); return; }
  const md = blocksToMarkdown(blocks);
  const name = scope === 'about' ? 'about.md' : scope.replace('proj-', '') + '.md';
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  window.__v3toast && window.__v3toast('Exported ' + name);
}

function importMd(scope) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.txt,.markdown';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseMarkdownToBlocks(ev.target.result);
      const existing = bmGetBlocks(bm(), scope) || [];
      let next = parsed;
      if (existing.length) {
        next = confirm(`Found ${parsed.length} blocks in "${file.name}".\n\nOK = Replace all existing blocks\nCancel = Append to the end`)
          ? parsed : [...existing, ...parsed];
      }
      pushState(state);
      bmSetBlocks(bm(), scope, next);
      markDirty(dirtyForScope(scope));
      cb.repaint && cb.repaint();
      window.__v3toast && window.__v3toast(`Imported ${parsed.length} blocks from ${file.name}`);
    };
    reader.readAsText(file);
  };
  input.click();
}

export function showBlockInspector(payload) {
  if (!panelEl || !payload) return;
  current = payload;
  const { scope, blockId, projectId } = payload;
  const block = bmFindBlock(bm(), scope, blockId);
  if (!block) { clearInspector(); return; }

  const head = `<div class="v3-insp-head">
    <span>${labelForType(block.type)}</span>
    <div class="v3-insp-actions">
      <button class="v3-insp-ico" data-act="up" title="Move up"><i class="ph-fill ph-arrow-up"></i></button>
      <button class="v3-insp-ico" data-act="down" title="Move down"><i class="ph-fill ph-arrow-down"></i></button>
      <button class="v3-insp-ico" data-act="duplicate" title="Duplicate"><i class="ph-fill ph-copy"></i></button>
      <button class="v3-insp-ico v3-danger" data-act="delete" title="Delete"><i class="ph-fill ph-trash"></i></button>
    </div>
  </div>`;

  const typeRow = field({
    label: 'Block type', kind: 'select', value: block.type,
    options: BLOCK_TYPE_OPTIONS, dataKey: '__type'
  });

  const body = `<div class="v3-insp-body" id="v3-insp-fields">
    ${typeRow}
    ${fieldsForBlock(block)}
  </div>`;

  panelEl.innerHTML = head + body;
  bindInspector(block, scope, blockId, projectId);
}

// ── Field HTML helpers ───────────────────────────────────────
function field({ label, kind = 'text', value = '', options = [], dataKey, item, sub, placeholder = '', min, max, rows = 3 }) {
  const attrs = `data-key="${dataKey || ''}"${item != null ? ` data-item="${item}"` : ''}${sub ? ` data-sub="${sub}"` : ''}`;
  const v = escAttr(value);
  let control;
  if (kind === 'select') {
    control = `<select class="v3-f" ${attrs}>${options.map(([ov, ol]) =>
      `<option value="${escAttr(ov)}"${String(ov) === String(value) ? ' selected' : ''}>${escHtml(ol)}</option>`).join('')}</select>`;
  } else if (kind === 'textarea') {
    control = `<textarea class="v3-f" rows="${rows}" ${attrs} placeholder="${escAttr(placeholder)}">${escHtml(value)}</textarea>`;
  } else if (kind === 'media') {
    control = `<div class="v3-media-row">
      <input class="v3-f" type="text" ${attrs} value="${v}" placeholder="media/…">
      <button class="v3-media-btn" data-media-key="${dataKey || ''}"${item != null ? ` data-item="${item}"` : ''}${sub ? ` data-sub="${sub}"` : ''} title="Pick media"><i class="ph-fill ph-image"></i></button>
    </div>`;
  } else if (kind === 'color') {
    control = `<div class="v3-color-row"><input class="v3-color" type="color" ${attrs} value="${v || '#5e30eb'}"><input class="v3-f v3-color-text" type="text" data-mirror="${dataKey || ''}" value="${v}"></div>`;
  } else if (kind === 'date') {
    control = `<input class="v3-f" type="date" ${attrs} value="${v}">`;
  } else if (kind === 'checkbox') {
    control = `<label class="v3-check"><input type="checkbox" class="v3-f" ${attrs}${value ? ' checked' : ''}> ${escHtml(placeholder)}</label>`;
  } else {
    const t = kind === 'number' ? 'number' : 'text';
    const mm = (min != null ? ` min="${min}"` : '') + (max != null ? ` max="${max}"` : '');
    control = `<input class="v3-f" type="${t}"${mm} ${attrs} value="${v}" placeholder="${escAttr(placeholder)}">`;
  }
  return `<div class="v3-field">${label ? `<label>${escHtml(label)}</label>` : ''}${control}</div>`;
}

function fieldsForBlock(b) {
  switch (b.type) {
    case 'text-sm': case 'text-md': case 'text-lg': case 'quote':
      return note('Edit the text directly on the page.') +
        field({ label: 'Alignment', kind: 'select', value: b.align || 'left', dataKey: 'align',
          options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] });

    case 'image':
      return field({ label: 'Image', kind: 'media', value: b.src, dataKey: 'src' }) +
        field({ label: 'Alt text', value: b.alt, dataKey: 'alt' });

    case 'alpha-art':
      return field({ label: 'Source', kind: 'media', value: b.src, dataKey: 'src' }) +
        field({ label: 'Alt text', value: b.alt, dataKey: 'alt' }) +
        field({ label: 'Tint color', kind: 'color', value: b.color, dataKey: 'color' }) +
        field({ label: 'Background', value: b.bg, dataKey: 'bg', placeholder: 'transparent' }) +
        field({ label: 'Scale', kind: 'number', value: b.scale, dataKey: 'scale', min: 0.1, max: 2 }) +
        field({ label: 'Fit', kind: 'select', value: b.fit || 'contain', dataKey: 'fit', options: [['contain', 'Contain'], ['cover', 'Cover']] }) +
        field({ label: 'Aspect ratio', value: b.ratio, dataKey: 'ratio', placeholder: '16/9' });

    case 'video':
      return field({ label: 'Video URL or media path', value: b.src, dataKey: 'src', placeholder: 'https://… or media/clip.mp4' }) +
        note('YouTube/Vimeo embed URLs and direct mp4 paths both work.');

    case 'callout':
      return field({ label: 'Tone', kind: 'select', value: b.tone || 'note', dataKey: 'tone',
        options: [['note', 'Note'], ['highlight', 'Highlight'], ['warning', 'Warning']] }) +
        note('Edit the title and body directly on the page.');

    case 'divider':
      return note('A horizontal divider. No options.');

    case 'cta':
      return field({ label: 'Headline', value: b.headline, dataKey: 'headline' }) +
        field({ label: 'Body', kind: 'textarea', value: b.body, dataKey: 'body' }) +
        field({ label: 'Button label', value: b.buttonLabel, dataKey: 'buttonLabel' }) +
        field({ label: 'Button URL', value: b.buttonUrl, dataKey: 'buttonUrl' }) +
        field({ label: 'Tone', kind: 'select', value: b.tone || 'default', dataKey: 'tone',
          options: [['default', 'Default'], ['highlight', 'Highlight']] });

    case 'beforeafter':
      return field({ label: 'Before image', kind: 'media', value: b.beforeSrc, dataKey: 'beforeSrc' }) +
        field({ label: 'Before alt', value: b.beforeAlt, dataKey: 'beforeAlt' }) +
        field({ label: 'After image', kind: 'media', value: b.afterSrc, dataKey: 'afterSrc' }) +
        field({ label: 'After alt', value: b.afterAlt, dataKey: 'afterAlt' }) +
        field({ label: 'Caption', value: b.caption, dataKey: 'caption' }) +
        field({ label: 'Divider position (%)', kind: 'number', value: b.position, dataKey: 'position', min: 0, max: 100 });

    case 'stats':
      return itemList(b, 'stats', [['num', 'Number', 'text'], ['label', 'Label', 'text']]);
    case 'skills':
      return itemList(b, 'skills', [['name', 'Skill', 'text'], ['pct', 'Percent', 'number']]);
    case 'gallery':
      return field({ label: 'Columns', kind: 'select', value: String(b.columns || 2), dataKey: 'columns', options: [['2', '2'], ['3', '3']] }) +
        itemList(b, 'gallery', [['src', 'Image', 'media'], ['alt', 'Alt', 'text'], ['caption', 'Caption', 'text']]);
    case 'faq':
      return itemList(b, 'faq', [['question', 'Question', 'text'], ['answer', 'Answer', 'textarea'], ['open', 'Open by default', 'checkbox']]);

    case 'process':
      return stepList(b);

    case 'twocol':
      return columnEditor('left', b.left || {}) + columnEditor('right', b.right || {});

    default:
      return note('No editable options for this block.');
  }
}

function itemList(b, type, fieldDefs) {
  const items = b.items || [];
  const rows = items.map((it, i) => `<div class="v3-item" data-item-row="${i}">
    <div class="v3-item-head"><span>${labelForType(type)} ${i + 1}</span>
      <button class="v3-insp-ico v3-danger" data-item-del="${i}" title="Remove"><i class="ph-fill ph-x"></i></button></div>
    ${fieldDefs.map(([k, lbl, kind]) => field({ label: lbl, kind, value: it[k], dataKey: '__item', item: i, sub: k,
      placeholder: kind === 'checkbox' ? 'Open by default' : '' })).join('')}
  </div>`).join('');
  return `<div class="v3-itemlist" data-itemtype="${type}">${rows}
    <button class="v3-add-item" data-add-item="${type}">+ Add ${labelForType(type)}</button></div>`;
}

function stepList(b) {
  const steps = b.steps || [];
  const rows = steps.map((s, i) => `<div class="v3-item" data-step-row="${i}">
    <div class="v3-item-head"><span>Step ${i + 1}</span>
      <button class="v3-insp-ico v3-danger" data-step-del="${i}" title="Remove"><i class="ph-fill ph-x"></i></button></div>
    ${field({ label: 'Title', value: s.title, dataKey: '__step', item: i, sub: 'title' })}
    ${field({ label: 'Date', value: s.date, dataKey: '__step', item: i, sub: 'date', placeholder: 'leave blank for process style' })}
    ${field({ label: 'Body', kind: 'textarea', value: s.content, dataKey: '__step', item: i, sub: 'content' })}
    ${field({ label: 'Image', kind: 'media', value: s.image, dataKey: '__step', item: i, sub: 'image' })}
    ${field({ label: 'Image alt', value: s.imageAlt, dataKey: '__step', item: i, sub: 'imageAlt' })}
  </div>`).join('');
  return `<div class="v3-itemlist" data-steplist>${rows}
    <button class="v3-add-item" data-add-step>+ Add Step</button></div>`;
}

function columnEditor(side, col) {
  const isImg = col.type === 'image';
  const inner = isImg
    ? field({ label: 'Image', kind: 'media', value: col.src, dataKey: '__col', sub: side + '.src' }) +
      field({ label: 'Alt', value: col.alt, dataKey: '__col', sub: side + '.alt' })
    : field({ label: 'Text', kind: 'textarea', value: col.content, dataKey: '__col', sub: side + '.content' });
  return `<div class="v3-item"><div class="v3-item-head"><span>${side === 'left' ? 'Left' : 'Right'} column</span></div>
    ${field({ label: 'Type', kind: 'select', value: col.type || 'text-md', dataKey: '__coltype', sub: side, options: COL_TYPE_OPTIONS })}
    ${inner}</div>`;
}

function note(t) { return `<p class="v3-insp-note">${escHtml(t)}</p>`; }
function labelForType(t) { const m = Object.fromEntries(BLOCK_TYPE_OPTIONS); return m[t] || t; }

// ── Event binding ────────────────────────────────────────────
function bindInspector(block, scope, blockId, projectId) {
  const root = panelEl;

  // Block-level actions in the header
  root.querySelector('.v3-insp-actions')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    cb.action && cb.action({ op: btn.getAttribute('data-act'), scope, blockId, projectId, dir: btn.getAttribute('data-act') === 'up' ? -1 : 1, blockType: block.type });
  });

  const commit = (mutator, label) => {
    pushState(state);
    mutator();
    markDirty(dirtyForScope(scope));
    cb.repaint && cb.repaint();
    void label;
  };

  // Generic field changes
  root.querySelectorAll('.v3-f, .v3-color').forEach(el => {
    el.addEventListener('change', () => {
      const key = el.getAttribute('data-key');
      let value = el.type === 'checkbox' ? el.checked : el.value;

      if (key === '__type') {
        cb.action && cb.action({ op: 'change-type', scope, blockId, projectId, blockType: value });
        return;
      }
      if (key === '__item') {
        const i = Number(el.getAttribute('data-item'));
        const sub = el.getAttribute('data-sub');
        if (sub === 'pct') value = Number(value);
        commit(() => updateItemProperty(bm(), scope, blockId, i, sub, value));
        return;
      }
      if (key === '__step') {
        const i = Number(el.getAttribute('data-item'));
        const sub = el.getAttribute('data-sub');
        commit(() => updateStepProperty(bm(), scope, blockId, i, sub, value));
        return;
      }
      if (key === '__col') {
        const [side, sub] = el.getAttribute('data-sub').split('.');
        commit(() => updateColumnField(bm(), scope, blockId, side, sub, value));
        return;
      }
      if (key === '__coltype') {
        const side = el.getAttribute('data-sub');
        commit(() => updateColumnType(bm(), scope, blockId, side, value));
        return;
      }
      // Plain block field
      if (key === 'scale' || key === 'position') value = Number(value);
      if (key === 'columns') value = Number(value);
      commit(() => bmUpdateBlock(bm(), scope, blockId, key, value));
    });
  });

  // Color text mirror
  root.querySelectorAll('.v3-color-text').forEach(txt => {
    txt.addEventListener('change', () => {
      const key = txt.getAttribute('data-mirror');
      commit(() => bmUpdateBlock(bm(), scope, blockId, key, txt.value));
    });
  });

  // Media pick buttons
  root.querySelectorAll('[data-media-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-media-key');
      const itemAttr = btn.getAttribute('data-item');
      const sub = btn.getAttribute('data-sub');
      cb.openMedia && cb.openMedia(path => {
        if (!path) return;
        if (key === '__item' || key === '__step') {
          const i = Number(itemAttr);
          const fn = key === '__item' ? updateItemProperty : updateStepProperty;
          commit(() => fn(bm(), scope, blockId, i, sub, path));
        } else if (key === '__col') {
          const [side, s] = sub.split('.');
          commit(() => updateColumnField(bm(), scope, blockId, side, s, path));
        } else {
          commit(() => bmUpdateBlock(bm(), scope, blockId, key, path));
        }
        showBlockInspector(current); // refresh field value
      });
    });
  });

  // Add / remove items + steps
  root.querySelector('[data-add-item]')?.addEventListener('click', e => {
    const type = e.currentTarget.getAttribute('data-add-item');
    commit(() => addItemToBlock(bm(), scope, blockId, type));
    showBlockInspector(current);
  });
  root.querySelectorAll('[data-item-del]').forEach(btn => btn.addEventListener('click', () => {
    commit(() => removeItemFromBlock(bm(), scope, blockId, Number(btn.getAttribute('data-item-del'))));
    showBlockInspector(current);
  }));
  root.querySelector('[data-add-step]')?.addEventListener('click', () => {
    commit(() => addStepToBlock(bm(), scope, blockId));
    showBlockInspector(current);
  });
  root.querySelectorAll('[data-step-del]').forEach(btn => btn.addEventListener('click', () => {
    commit(() => removeStepFromBlock(bm(), scope, blockId, Number(btn.getAttribute('data-step-del'))));
    showBlockInspector(current);
  }));
}

// ════════════════════════════════════════════════════════════
//  Settings forms (Home / Contact / Project) — v1 parity
// ════════════════════════════════════════════════════════════

function getNested(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setNested(obj, path, val) {
  const ps = path.split('.');
  let o = obj;
  for (let i = 0; i < ps.length - 1; i++) {
    if (typeof o[ps[i]] !== 'object' || o[ps[i]] == null) o[ps[i]] = {};
    o = o[ps[i]];
  }
  o[ps[ps.length - 1]] = val;
}

const REEL_TYPES = [['video', 'Video file'], ['youtube', 'YouTube'], ['vimeo', 'Vimeo']];

const HOME_GROUPS = [
  { title: 'Demo reel (hero background)', fields: [
    { label: 'Type', key: 'reel.type', kind: 'select', options: REEL_TYPES },
    { label: 'URL / media', key: 'reel.url', kind: 'media' }
  ] },
  { title: 'Watch reel (button popup)', fields: [
    { label: 'Type', key: 'watchReel.type', kind: 'select', options: REEL_TYPES },
    { label: 'URL / media', key: 'watchReel.url', kind: 'media' }
  ] }
];

const CONTACT_GROUPS = [
  { title: 'Headline', fields: [
    { label: 'Title', key: 'contactPanel.title' },
    { label: 'Title accent', key: 'contactPanel.titleAccent' },
    { label: 'Subtitle', key: 'contactPanel.sub', kind: 'textarea' }
  ] },
  { title: 'Labels', fields: [
    { label: 'Email label', key: 'contactPanel.emailLabel' },
    { label: 'Social label', key: 'contactPanel.socialLabel' },
    { label: 'Resume label', key: 'contactPanel.resumeLabel', placeholder: 'Credentials' }
  ] },
  { title: 'Background video', fields: [
    { label: 'Type', key: 'contactPanel.video.type', kind: 'select', options: REEL_TYPES },
    { label: 'URL / media', key: 'contactPanel.video.url', kind: 'media' }
  ] }
];

// Site-wide settings. Text fields accept {shortcuts} — see References at the bottom.
const SITE_GROUPS = [
  { title: 'Studio identity', fields: [
    { label: 'Name', key: 'name' },
    { label: 'Role', key: 'role' },
    { label: 'Location', key: 'location' }
  ] },
  { title: 'Contact details', fields: [
    { label: 'Email', key: 'contact.email' },
    { label: 'Resume (PDF)', key: 'contact.resume', kind: 'media' }
  ] }
];

const SITE_GROUPS_2 = [
  { title: 'Availability', note: 'The “available” badge on the home screen and next to the cursor.', fields: [
    { label: '', key: 'availability.enabled', kind: 'checkbox', cbLabel: 'Show availability badge' },
    { label: 'Badge text', key: 'availability.text', placeholder: 'Available for work' }
  ] },
  { title: 'Branding', fields: [
    { label: 'Browser tab title', key: 'siteTitle' },
    { label: 'Logo', key: 'logo', kind: 'media' },
    { label: 'Favicon', key: 'favicon', kind: 'media' }
  ] },
  { title: 'Social preview (SEO)', note: 'What shows when your link is shared (Discord, iMessage, LinkedIn) and in search results. Written into the site when you save.', fields: [
    { label: 'Share title', key: 'ogTitle' },
    { label: 'Share description', key: 'ogDescription', kind: 'textarea' },
    { label: 'Share image', key: 'ogImage', kind: 'media' }
  ] },
  { title: 'Theme', fields: [
    { label: 'Ink (text)', key: 'theme.ink', kind: 'color' },
    { label: 'Paper (background)', key: 'theme.paper', kind: 'color' },
    { label: 'Accent', key: 'theme.accent', kind: 'color' },
    { label: 'Panel background', key: 'theme.panelBg', kind: 'color' },
    { label: 'Contact accent', key: 'theme.ctAccent', kind: 'color' },
    { label: 'Contact background', key: 'theme.ctBg', kind: 'color' },
    { label: 'Contact highlight', key: 'theme.ctHi', kind: 'color' },
    { label: 'Panel style', key: 'theme.panelStyle', kind: 'select', options: [['light', 'Light'], ['dark', 'Dark'], ['frost', 'Frost']] }
  ] },
  { title: 'Social feed', note: 'Posts tagged #rgr on the accounts in Social links join the Work grid. Add #rgr-<filter value> (or a filter’s feed hashtags) to place them under a filter.', fields: [
    { label: 'Default banner (text-only posts)', key: 'postBanner', kind: 'media' }
  ] },
  { title: 'Mature content', note: 'Defaults for projects marked sensitive. Each project can still override these.', fields: [
    { label: 'Warning label', key: 'sensitiveLabel', placeholder: 'MATURE' },
    { label: 'Warning color', key: 'theme.sensitiveColor', kind: 'color' }
  ] },
  { title: 'Site text', note: 'Leave blank to use the default shown.', fields: SITE_TEXT_FIELDS.map(([k, label]) => (
    { label, key: 'siteText.' + k, placeholder: SITE_TEXT_DEFAULTS[k] }
  )) },
  { title: 'Privacy & Legal', note: 'Blank line = new paragraph. Links: [text](https://…). Shortcuts like {name} and {email} fill in automatically. Empty a box to hide that section.', fields: [
    { label: 'Copyright', key: 'legal.copyright', kind: 'textarea', rows: 6 },
    { label: 'Privacy', key: 'legal.privacy', kind: 'textarea', rows: 10 },
    { label: 'AI disclosure', key: 'legal.ai', kind: 'textarea', rows: 5 }
  ] }
];

const PROJECT_GROUPS = [
  { title: 'Details', fields: [
    { label: 'Title', key: 'title' },
    { label: 'Filters', key: 'types', kind: 'types' },
    { label: 'Year', key: 'year' },
    { label: 'Date', key: 'date', kind: 'date' },
    { label: 'Client', key: 'client' },
    { label: 'Duration', key: 'duration' },
    { label: 'Thumbnail', key: 'thumbnail', kind: 'media' },
    { label: 'Header video URL', key: 'videoUrl' }
  ] },
  { title: 'Display', fields: [
    { label: '', key: 'longform', kind: 'checkbox', cbLabel: 'Longform layout' },
    { label: '', key: 'published', kind: 'checkbox', cbLabel: 'Published (visible on site)' },
    { label: '', key: 'sensitive', kind: 'checkbox', cbLabel: 'Sensitive content' },
    { label: 'Sensitive label', key: 'sensitiveLabel' },
    { label: 'Sensitive color', key: 'sensitiveColor', kind: 'color' }
  ] }
];

function groupsHTML(target, groups) {
  return groups.map(g => `<div class="v3-set-group"><div class="v3-set-head">${escHtml(g.title)}</div>${g.note ? note(g.note) : ''}${
    g.fields.map(fd => {
      const raw = getNested(target, fd.key);
      if (fd.kind === 'types') return typesFieldHTML(fd.label, target);
      if (fd.kind === 'checkbox') {
        return field({ label: '', kind: 'checkbox', value: !!raw, dataKey: fd.key, placeholder: fd.cbLabel || fd.label });
      }
      return field({ label: fd.label, kind: fd.kind || 'text', value: raw == null ? '' : raw, options: fd.options || [], dataKey: fd.key, placeholder: fd.placeholder || '', rows: fd.rows });
    }).join('')
  }</div>`).join('');
}

// Toggle chips: one per site filter. A project can be under several.
function typesFieldHTML(label, proj) {
  const filters = state.global.filters || DEFAULT_FILTERS;
  const on = projectTypes(proj);
  // Keep values that no longer match a filter visible so they can be removed.
  const orphans = on.filter(v => !filters.some(f => String(f.value) === v));
  const chips = [
    ...filters.filter(f => f && f.value !== '' && f.value != null).map(f => [String(f.value), f.label || f.value, false]),
    ...orphans.map(v => [v, v, true])
  ];
  return `<div class="v3-field"><label>${escHtml(label)}</label>
    <div class="v3-type-chips">${chips.map(([v, l, orphan]) =>
      `<button type="button" class="v3-type-chip${on.includes(v) ? ' active' : ''}${orphan ? ' orphan' : ''}" data-type-toggle="${escAttr(v)}"${orphan ? ' title="Not a site filter any more"' : ''}>${escHtml(l)}</button>`).join('')}</div>
    ${chips.length ? '' : '<p class="v3-insp-note">Add filters in Site settings.</p>'}</div>`;
}

function strListHTML(label, path, arr) {
  arr = arr || [];
  return `<div class="v3-set-group"><div class="v3-set-head">${escHtml(label)}</div>
    ${arr.map((v, i) => `<div class="v3-arr-row">
      <input class="v3-f v3-arr-input" data-arr="${path}" data-idx="${i}" value="${escAttr(v)}">
      <button class="v3-insp-ico v3-danger" data-arr-del="${path}" data-idx="${i}" title="Remove"><i class="ph-fill ph-x"></i></button></div>`).join('')}
    <button class="v3-add-item" data-arr-add="${path}">+ Add</button></div>`;
}

function objListHTML(label, path, arr, subs) {
  arr = arr || [];
  const keys = subs.map(s => s[0]).join(',');
  return `<div class="v3-set-group"><div class="v3-set-head">${escHtml(label)}</div>
    ${arr.map((it, i) => `<div class="v3-item">
      <div class="v3-item-head"><span>${escHtml(label)} ${i + 1}</span>
        <button class="v3-insp-ico v3-danger" data-arr-del="${path}" data-idx="${i}" title="Remove"><i class="ph-fill ph-x"></i></button></div>
      ${subs.map(([k, l]) => `<div class="v3-field"><label>${escHtml(l)}</label>
        <input class="v3-f v3-arr-input" data-arr="${path}" data-idx="${i}" data-sub="${k}" value="${escAttr(Array.isArray(it[k]) ? it[k].join(', ') : (it[k] == null ? '' : it[k]))}"></div>`).join('')}
    </div>`).join('')}
    <button class="v3-add-item" data-arr-add="${path}" data-objfields="${keys}">+ Add</button></div>`;
}

export function showHomeSettings() {
  current = null;
  if (!panelEl) return;
  const g = state.global;
  panelEl.innerHTML = `<div class="v3-insp-head"><span>Home Settings</span></div>
    <div class="v3-insp-body">
      ${groupsHTML(g, HOME_GROUPS)}
      <p class="v3-insp-note">Name, role, branding, SEO, theme and filters are in Site settings.</p>
    </div>`;
  bindSettingsForm(g, 'content.json', showHomeSettings, false);
}

export function showSiteSettings() {
  current = null;
  if (!panelEl) return;
  const g = state.global;
  panelEl.innerHTML = `<div class="v3-insp-head"><span>Site Settings</span>
      <button class="v3-site-preview-btn" id="v3-site-preview-btn" title="Show the site next to these settings"><i class="ph-fill ph-eye"></i> <span>Preview site</span></button></div>
    <div class="v3-insp-body v3-site-body">
      <nav class="v3-site-nav" id="v3-site-nav"></nav>
      <div class="v3-site-content">
      <p class="v3-insp-note">Site-wide settings used across every page, the mobile site and the modelling site.</p>
      ${groupsHTML(g, SITE_GROUPS)}
      ${objListHTML('Social link', 'contact.links', getNested(g, 'contact.links'), [['label', 'Label'], ['url', 'URL'], ['ref', 'Shortcut (auto from label)']])}
      ${groupsHTML(g, SITE_GROUPS_2)}
      ${objListHTML('Filter', 'filters', g.filters, [['value', 'Value (projects use this; keep it fixed)'], ['label', 'Label (shown on cards)'], ['tags', 'Feed hashtags (with #rgr), e.g. blender3d, 3danimation']])}
      ${referencesHTML(g)}
      </div>
    </div>`;
  bindSettingsForm(g, 'content.json', showSiteSettings, false);
  bindReferences();
  bindSiteLayout();
}

// Full-page layout: section jump list + a toggle to show the site canvas.
function bindSiteLayout() {
  const main = document.getElementById('v3-main');
  const nav = panelEl.querySelector('#v3-site-nav');
  const groups = [...panelEl.querySelectorAll('.v3-site-content > .v3-set-group')];
  const seen = new Set();
  nav.innerHTML = groups.map((grp, i) => {
    const title = grp.querySelector('.v3-set-head')?.textContent || '';
    grp.id = 'v3-site-sec-' + i;
    if (seen.has(title)) return ''; // repeated list items (e.g. each social link)
    seen.add(title);
    return `<button data-jump="${grp.id}">${escHtml(title)}</button>`;
  }).join('');
  nav.addEventListener('click', e => {
    const b = e.target.closest('[data-jump]');
    if (b) panelEl.querySelector('#' + b.getAttribute('data-jump'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const btn = panelEl.querySelector('#v3-site-preview-btn');
  const sync = () => {
    const on = main.classList.contains('v3-site-preview');
    btn.querySelector('span').textContent = on ? 'Hide preview' : 'Preview site';
    btn.classList.toggle('active', on);
  };
  btn.addEventListener('click', () => { main.classList.toggle('v3-site-preview'); sync(); });
  sync();
}

function referencesHTML(g) {
  const rows = listRefs(g, state.projects);
  let group = '';
  const body = rows.map(r => {
    const head = r.group !== group ? `<div class="v3-ref-group">${escHtml((group = r.group))}</div>` : '';
    return `${head}<div class="v3-ref-row${r.warn ? ' v3-ref-warn' : ''}">
      <code>${escHtml(r.code)}</code><span class="v3-ref-val" title="${escAttr(r.value)}">${escHtml(r.value || '—')}</span>
      <button class="v3-insp-ico" data-copy-ref="${escAttr(r.code)}" title="Copy"><i class="ph-fill ph-copy"></i></button></div>`;
  }).join('');
  return `<div class="v3-set-group" id="v3-references"><div class="v3-set-head">References</div>
    ${note('Type a shortcut in any text (or use Insert reference in the top bar) and the site shows the current value. Change the value here once and it updates everywhere.')}
    ${body}</div>`;
}

function bindReferences() {
  panelEl.querySelectorAll('[data-copy-ref]').forEach(btn => btn.addEventListener('click', () => {
    const code = btn.getAttribute('data-copy-ref');
    navigator.clipboard?.writeText(code).then(() => {
      btn.innerHTML = '<i class="ph-fill ph-check"></i>';
      setTimeout(() => { btn.innerHTML = '<i class="ph-fill ph-copy"></i>'; }, 1200);
    }).catch(() => {});
  }));
}

export function showContactSettings() {
  current = null;
  if (!panelEl) return;
  const g = state.global;
  panelEl.innerHTML = `<div class="v3-insp-head"><span>Contact Settings</span></div>
    <div class="v3-insp-body">
      ${groupsHTML(g, CONTACT_GROUPS)}
      ${strListHTML('Ticker — top row', 'contactPanel.tickerTop', getNested(g, 'contactPanel.tickerTop'))}
      ${strListHTML('Ticker — middle row', 'contactPanel.tickerMid', getNested(g, 'contactPanel.tickerMid'))}
      <p class="v3-insp-note">Email, resume and social links are in Site settings.</p>
    </div>`;
  bindSettingsForm(g, 'content.json', showContactSettings, false);
}

export function showProjectSettings(projectId) {
  current = null;
  if (!panelEl) return;
  const proj = state.projectCache.get(projectId) || state.projects.find(p => p.id === projectId);
  if (!proj) { clearInspector(); return; }
  panelEl.innerHTML = `<div class="v3-insp-head"><span>Project Settings</span></div>
    <div class="v3-insp-body">
      <p class="v3-insp-note">Edit this project’s page by clicking blocks on the canvas. Below are its catalogue / meta settings.</p>
      ${groupsHTML(proj, PROJECT_GROUPS)}
      ${strListHTML('Tags', 'tags', proj.tags)}
      ${mdToolsHTML()}
      <button class="v3-delete-project" data-delete-project="${projectId}"><i class="ph-fill ph-trash"></i> Delete project</button>
    </div>`;
  bindSettingsForm(proj, 'projects/' + projectId + '.json', () => showProjectSettings(projectId), true);
  bindMdTools('proj-' + projectId);
  panelEl.querySelector('[data-delete-project]')?.addEventListener('click', () => {
    if (confirm('Delete “' + (proj.title || projectId) + '”? It will be removed from the site on the next Save.')) {
      cb.deleteProject && cb.deleteProject(projectId);
    }
  });
}

// Bind a settings form. heavy=true uses the full repaint (re-opens the project
// panel so meta like title/thumbnail updates); otherwise a light in-place push.
function bindSettingsForm(target, dirtyFile, rerender, heavy) {
  const repaint = () => {
    if (heavy) cb.repaint && cb.repaint();
    else (cb.repaintLight || cb.repaint) && (cb.repaintLight || cb.repaint)();
  };
  const commit = (mutate) => { pushState(state); mutate(); markDirty(dirtyFile); repaint(); };

  panelEl.querySelectorAll('.v3-f, .v3-color').forEach(el => {
    if (el.classList.contains('v3-arr-input')) return;
    el.addEventListener('change', () => {
      const key = el.getAttribute('data-key');
      if (!key) return;
      const value = el.type === 'checkbox' ? el.checked : el.value;
      commit(() => setNested(target, key, value));
    });
  });
  panelEl.querySelectorAll('.v3-color-text').forEach(txt => {
    txt.addEventListener('change', () => commit(() => setNested(target, txt.getAttribute('data-mirror'), txt.value)));
  });
  panelEl.querySelectorAll('[data-media-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-media-key');
      cb.openMedia && cb.openMedia(p => { if (!p) return; commit(() => setNested(target, key, p)); rerender(); });
    });
  });

  panelEl.querySelectorAll('[data-type-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-type-toggle');
      const cur = projectTypes(target);
      const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
      commit(() => setProjectTypes(target, next, state.global.filters));
      rerender();
    });
  });

  // Array (string + object) lists
  panelEl.querySelectorAll('.v3-arr-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const arr = getNested(target, inp.getAttribute('data-arr')) || [];
      const idx = Number(inp.getAttribute('data-idx'));
      const sub = inp.getAttribute('data-sub');
      commit(() => {
        if (sub) {
          if (!arr[idx]) arr[idx] = {};
          arr[idx][sub] = sub === 'ref' ? slugRef(inp.value) : sub === 'tags' ? filterTags({ tags: inp.value }) : inp.value;
          if (sub === 'label' && 'ref' in arr[idx] && !arr[idx].ref) arr[idx].ref = slugRef(inp.value);
        } else { arr[idx] = inp.value; }
      });
      if (sub === 'label' || sub === 'ref' || sub === 'tags') rerender();
    });
  });
  panelEl.querySelectorAll('[data-arr-add]').forEach(b => b.addEventListener('click', () => {
    const path = b.getAttribute('data-arr-add');
    const objFields = b.getAttribute('data-objfields');
    commit(() => {
      let arr = getNested(target, path);
      if (!Array.isArray(arr)) { arr = []; setNested(target, path, arr); }
      arr.push(objFields ? Object.fromEntries(objFields.split(',').map(k => [k, ''])) : '');
    });
    rerender();
  }));
  panelEl.querySelectorAll('[data-arr-del]').forEach(b => b.addEventListener('click', () => {
    const path = b.getAttribute('data-arr-del');
    const idx = Number(b.getAttribute('data-idx'));
    commit(() => { const arr = getNested(target, path); if (Array.isArray(arr)) arr.splice(idx, 1); });
    rerender();
  }));
}

// ── escapes ──
function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }
