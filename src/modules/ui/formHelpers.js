/**
 * Form Helpers
 * HTML generation for forms, fields, and editors
 */

import { getCustomizableColors, getColorDisplayName } from '../../utils/colors.js';

/**
 * Get a short preview of a block for the block list header
 * @param {Object} block - Block object
 * @returns {string} Preview text
 */
export function getBlockPreview(block) {
  if (block.type === 'divider') return '—';
  if (block.type === 'stats') {
    return (block.items || [])
      .map(s => s.num)
      .join(' · ');
  }
  if (block.type === 'skills') {
    return (block.items || [])
      .map(s => s.name)
      .join(', ');
  }
  if (block.type === 'image') {
    return block.src || block.alt || '(empty)';
  }
  if (block.type === 'twocol') {
    return 'Two columns';
  }
  if (block.type === 'callout') {
    return (block.title || 'Callout') + ' · ' + (block.tone || 'note');
  }
  if (block.type === 'process') {
    return `${(block.steps || []).length} step${(block.steps || []).length === 1 ? '' : 's'}`;
  }
  if (block.type === 'gallery') {
    return `${(block.items || []).length} image${(block.items || []).length === 1 ? '' : 's'} · ${block.columns || 2} cols`;
  }
  if (block.type === 'cta') {
    return block.headline || block.buttonLabel || 'CTA banner';
  }
  if (block.type === 'beforeafter') {
    return `Before/After · ${block.caption || 'comparison'}`;
  }
  if (block.type === 'faq') {
    return `${(block.items || []).length} question${(block.items || []).length === 1 ? '' : 's'}`;
  }
  return (block.content || '').slice(0, 60);
}

/**
 * Get display label for a block type
 * @param {string} type - Block type
 * @returns {string} Display label
 */
export function getBlockTypeLabel(type) {
  const labels = {
    'text-sm': 'Text (Small)',
    'text-md': 'Text (Medium)',
    'text-lg': 'Text (Large)',
    image: 'Image',
    twocol: 'Two Columns',
    quote: 'Quote',
    video: 'Video',
    stats: 'Statistics',
    skills: 'Skills',
    callout: 'Callout',
    gallery: 'Gallery',
    process: 'Process',
    cta: 'CTA Banner',
    beforeafter: 'Before / After',
    faq: 'FAQ',
    divider: 'Divider'
  };
  return labels[type] || type;
}

/**
 * Generate HTML for block type menu
 * @param {string} scope - Scope (e.g., 'about' or 'proj-id')
 * @returns {string} HTML
 */
export function getBlockMenuHTML(scope) {
  const types = [
    ['text-md', 'T', 'Text'],
    ['image', '🖼', 'Image'],
    ['twocol', '⊞', 'Two Col'],
    ['quote', '"', 'Quote'],
    ['video', '▶', 'Video'],
    ['stats', '#', 'Stats'],
    ['skills', '%', 'Skills'],
    ['callout', '!', 'Callout'],
    ['gallery', '🖼', 'Gallery'],
    ['process', '1.', 'Process'],
    ['cta', '→', 'CTA'],
    ['beforeafter', '⇄', 'Before/After'],
    ['faq', '?', 'FAQ'],
    ['divider', '—', 'Divider']
  ];

  return types
    .map(
      ([t, icon, label]) =>
        `<button class="bm-item" onclick="window.events?.onAddBlock?.('${scope}', '${t}')">
        <div class="bm-icon">${icon}</div>${label}</button>`
    )
    .join('');
}

/**
 * Generate color picker field HTML
 * @param {string} label - Field label
 * @param {string} key - Color key (e.g., 'accent')
 * @param {string} currentValue - Current hex color
 * @returns {string} HTML
 */
export function getColorFieldHTML(label, key, currentValue) {
  const uid = 'cf_' + key;
  return `
    <div class="color-field">
      <label>${label}</label>
      <div class="color-row">
        <div class="color-swatch" style="background:${currentValue}">
          <div class="color-swatch-fill" style="background:${currentValue}" id="${uid}_fill"></div>
          <input type="color" value="${currentValue}" oninput="window.events?.onColorChange?.('${key}', this.value, '${uid}')">
        </div>
        <input class="color-hex" id="${uid}_hex" value="${currentValue}" maxlength="7"
          oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))window.events?.onColorChange?.('${key}', this.value, '${uid}')">
      </div>
    </div>`;
}

/**
 * Generate block editor form HTML
 * @param {Object} block - Block object
 * @param {string} scope - Scope (e.g., 'about' or 'proj-id')
 * @returns {string} HTML for block body/controls
 */
export function getBlockBodyHTML(block, scope) {
  const type = block.type;

  // Text blocks (text-sm, text-md, text-lg)
  if (type.startsWith('text-')) {
    const sizes = [
      ['text-sm', 'Small'],
      ['text-md', 'Medium'],
      ['text-lg', 'Large']
    ];
    return `
      <div class="size-row">
        ${sizes
          .map(
            ([v, l]) =>
              `<button class="sz-btn ${block.type === v ? 'active' : ''}" 
            onclick="window.events?.onChangeBlockType?.('${scope}', '${block.id}', '${v}')">${l}</button>`
          )
          .join('')}
      </div>
      <div class="rt-toolbar">
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="window.v2RichText?.wrapSelection?.('rta-${block.id}', 'b')"><b>B</b></button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="window.v2RichText?.wrapSelection?.('rta-${block.id}', 'i')"><i>I</i></button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="window.v2RichText?.wrapSelection?.('rta-${block.id}', 'u')"><u>U</u></button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="window.v2RichText?.wrapSelection?.('rta-${block.id}', 'rgr')" style="font-size:.58rem;letter-spacing:.06em">RGR</button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="window.v2RichText?.insertAt?.('rta-${block.id}', '&lt;br&gt;')" title="Line break">↵</button>
      </div>
      <div class="field"><textarea id="rta-${block.id}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'content', this.value)">${block.content || ''}</textarea></div>
      <div class="field"><label>Alignment</label>
        <div class="align-row">
          ${['left', 'center', 'right']
            .map(
              a =>
                `<button class="al-btn ${(block.align || 'left') === a ? 'active' : ''}" 
              onclick="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'align', '${a}'); window.events?.onRerenderBlocks?.('${scope}')">${a[0].toUpperCase() + a.slice(1)}</button>`
            )
            .join('')}
        </div>
      </div>`;
  }

  // Image block
  if (type === 'image') {
    const dzStableId = 'imdz_' + block.id;
    return `
      <div class="field"><label>Image</label>
        <div id="${dzStableId}">
          <input type="file" accept="image/*" style="display:none">
          <div class="dz-label">Drag & drop or click to select</div>
          <div class="dz-sub">Loading...</div>
        </div>
        <input type="text" id="${dzStableId}_p" value="${block.src || ''}" placeholder="Path or URL" 
          style="margin-top:.5rem" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'src', this.value)">
        <button class="add-btn" style="margin-top:.35rem" onclick="window.events?.onBrowseMedia?.('${scope}', '${block.id}', '${dzStableId}_p')">📁 Browse Media</button>
      </div>
      <div class="field"><label>Alt Text</label>
        <input value="${block.alt || ''}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'alt', this.value)">
      </div>`;
  }

  // Two column block
  if (type === 'twocol') {
    return `<div class="twocol-editor">
      <div><div class="col-label">Left Column</div>
        ${getTwoColEditor(scope, block.id, block.left || {}, 'left')}
      </div>
      <div><div class="col-label">Right Column</div>
        ${getTwoColEditor(scope, block.id, block.right || {}, 'right')}
      </div>
    </div>`;
  }

  // Quote block
  if (type === 'quote') {
    return `
      <div class="rt-toolbar">
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="window.v2RichText?.wrapSelection?.('rta-q-${block.id}', 'b')"><b>B</b></button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="window.v2RichText?.wrapSelection?.('rta-q-${block.id}', 'i')"><i>I</i></button>
        <button class="rt-btn" onmousedown="event.preventDefault()" onclick="window.v2RichText?.wrapSelection?.('rta-q-${block.id}', 'u')"><u>U</u></button>
      </div>
      <div class="field"><textarea id="rta-q-${block.id}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'content', this.value)">${block.content || ''}</textarea></div>
      <div class="field"><label>Alignment</label>
        <div class="align-row">
          ${['left', 'center', 'right']
            .map(
              a =>
                `<button class="al-btn ${(block.align || 'left') === a ? 'active' : ''}" 
              onclick="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'align', '${a}'); window.events?.onRerenderBlocks?.('${scope}')">${a[0].toUpperCase() + a.slice(1)}</button>`
            )
            .join('')}
        </div>
      </div>`;
  }

  // Video block
  if (type === 'video') {
    return `
      <div class="field"><label>Embed URL</label>
        <input value="${block.src || ''}" placeholder="Vimeo or YouTube embed URL" 
          oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'src', this.value)">
      </div>`;
  }

  // Stats block
  if (type === 'stats') {
    return `
      <div style="display:flex;flex-direction:column;gap:.5rem" id="stats-${block.id}">
        ${(block.items || [])
          .map(
            (s, si) =>
              `<div class="stat-item">
          <input value="${s.num || ''}" placeholder="40+" oninput="window.events?.onUpdateStatItem?.('${scope}', '${block.id}', ${si}, 'num', this.value)">
          <input value="${s.label || ''}" placeholder="Projects" oninput="window.events?.onUpdateStatItem?.('${scope}', '${block.id}', ${si}, 'label', this.value)">
          <button class="del-btn" onclick="window.events?.onRemoveStatItem?.('${scope}', '${block.id}', ${si})">✕</button>
        </div>`
          )
          .join('')}
      </div>
      <button class="add-btn" onclick="window.events?.onAddStatItem?.('${scope}', '${block.id}')">+ Add Stat</button>`;
  }

  // Skills block
  if (type === 'skills') {
    return `
      <div style="display:flex;flex-direction:column;gap:.5rem" id="skills-${block.id}">
        ${(block.items || [])
          .map(
            (s, si) =>
              `<div class="skill-item">
          <input value="${s.name || ''}" placeholder="After Effects" oninput="window.events?.onUpdateSkillItem?.('${scope}', '${block.id}', ${si}, 'name', this.value)">
          <input type="range" min="0" max="100" value="${s.pct || 0}" step="1" 
            oninput="window.events?.onUpdateSkillItem?.('${scope}', '${block.id}', ${si}, 'pct', +this.value);this.nextElementSibling.textContent=this.value+'%'">
          <span class="skill-pct">${s.pct || 0}%</span>
          <button class="del-btn" onclick="window.events?.onRemoveSkillItem?.('${scope}', '${block.id}', ${si})">✕</button>
        </div>`
          )
          .join('')}
      </div>
      <button class="add-btn" onclick="window.events?.onAddSkillItem?.('${scope}', '${block.id}')">+ Add Skill</button>`;
  }

  // Divider block
  if (type === 'divider') {
    return `<p style="font-size:.72rem;color:var(--muted)">Horizontal rule divider.</p>`;
  }

  if (type === 'callout') {
    return `
      <div class="field"><label>Tone</label>
        <select onchange="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'tone', this.value)">
          ${['note', 'highlight', 'warning'].map(t => `<option value="${t}" ${(block.tone || 'note') === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Title</label><input value="${block.title || ''}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'title', this.value)"></div>
      <div class="field"><label>Body</label><textarea oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'content', this.value)">${block.content || ''}</textarea></div>`;
  }

  if (type === 'process') {
    return `
      <div style="display:flex;flex-direction:column;gap:.6rem" id="proc-${block.id}">
        ${(block.steps || []).map((step, index) => `<div class="bk" style="border:1px solid var(--border)">
          <div class="bk-body" style="display:flex;gap:.5rem;flex-direction:column">
            <div class="field"><label>Date (optional)</label><input value="${step.date || ''}" oninput="window.events?.onUpdateProcessStep?.('${scope}', '${block.id}', ${index}, 'date', this.value)"></div>
            <div class="field"><label>Step ${index + 1} Title</label><input value="${step.title || ''}" oninput="window.events?.onUpdateProcessStep?.('${scope}', '${block.id}', ${index}, 'title', this.value)"></div>
            <div class="field"><label>Description</label><textarea oninput="window.events?.onUpdateProcessStep?.('${scope}', '${block.id}', ${index}, 'content', this.value)">${step.content || ''}</textarea></div>
            <div class="field"><label>Image Path (optional)</label><input value="${step.image || ''}" oninput="window.events?.onUpdateProcessStep?.('${scope}', '${block.id}', ${index}, 'image', this.value)"></div>
            <div class="field"><label>Image Alt (optional)</label><input value="${step.imageAlt || ''}" oninput="window.events?.onUpdateProcessStep?.('${scope}', '${block.id}', ${index}, 'imageAlt', this.value)"></div>
            <button class="del-btn" onclick="window.events?.onRemoveProcessStep?.('${scope}', '${block.id}', ${index})" style="align-self:flex-end">✕</button>
          </div>
        </div>`).join('')}
      </div>
      <button class="add-btn" onclick="window.events?.onAddProcessStep?.('${scope}', '${block.id}')">+ Add Step</button>`;
  }

  if (type === 'gallery') {
    return `
      <div class="field"><label>Columns</label>
        <select onchange="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'columns', parseInt(this.value, 10))">
          <option value="2" ${(block.columns || 2) === 2 ? 'selected' : ''}>2</option>
          <option value="3" ${(block.columns || 2) === 3 ? 'selected' : ''}>3</option>
        </select>
      </div>
      <div style="display:flex;flex-direction:column;gap:.6rem">
        ${(block.items || []).map((item, index) => `<div class="bk" style="border:1px solid var(--border)">
          <div class="bk-body" style="display:flex;gap:.5rem;flex-direction:column">
            <div class="field"><label>Image Path</label><input value="${item.src || ''}" oninput="window.events?.onUpdateGalleryItem?.('${scope}', '${block.id}', ${index}, 'src', this.value)"></div>
            <div class="field"><label>Alt Text</label><input value="${item.alt || ''}" oninput="window.events?.onUpdateGalleryItem?.('${scope}', '${block.id}', ${index}, 'alt', this.value)"></div>
            <div class="field"><label>Caption</label><input value="${item.caption || ''}" oninput="window.events?.onUpdateGalleryItem?.('${scope}', '${block.id}', ${index}, 'caption', this.value)"></div>
            <button class="del-btn" onclick="window.events?.onRemoveGalleryItem?.('${scope}', '${block.id}', ${index})" style="align-self:flex-end">✕</button>
          </div>
        </div>`).join('')}
      </div>
      <button class="add-btn" onclick="window.events?.onAddGalleryItem?.('${scope}', '${block.id}')">+ Add Image</button>`;
  }

  if (type === 'cta') {
    return `
      <div class="field"><label>Headline</label><input value="${block.headline || ''}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'headline', this.value)"></div>
      <div class="field"><label>Body</label><textarea oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'body', this.value)">${block.body || ''}</textarea></div>
      <div class="row2">
        <div class="field"><label>Button Label</label><input value="${block.buttonLabel || ''}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'buttonLabel', this.value)"></div>
        <div class="field"><label>Button URL</label><input value="${block.buttonUrl || ''}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'buttonUrl', this.value)"></div>
      </div>`;
  }

  if (type === 'beforeafter') {
    return `
      <div class="field"><label>Before Image</label><input value="${block.beforeSrc || ''}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'beforeSrc', this.value)"></div>
      <div class="field"><label>Before Alt</label><input value="${block.beforeAlt || ''}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'beforeAlt', this.value)"></div>
      <div class="field"><label>After Image</label><input value="${block.afterSrc || ''}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'afterSrc', this.value)"></div>
      <div class="field"><label>After Alt</label><input value="${block.afterAlt || ''}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'afterAlt', this.value)"></div>
      <div class="field"><label>Caption</label><input value="${block.caption || ''}" oninput="window.events?.onUpdateBlock?.('${scope}', '${block.id}', 'caption', this.value)"></div>`;
  }

  if (type === 'faq') {
    return `
      <div style="display:flex;flex-direction:column;gap:.6rem">
        ${(block.items || []).map((item, index) => `<div class="bk" style="border:1px solid var(--border)">
          <div class="bk-body" style="display:flex;gap:.5rem;flex-direction:column">
            <div class="field"><label>Question</label><input value="${item.question || ''}" oninput="window.events?.onUpdateFaqItem?.('${scope}', '${block.id}', ${index}, 'question', this.value)"></div>
            <div class="field"><label>Answer</label><textarea oninput="window.events?.onUpdateFaqItem?.('${scope}', '${block.id}', ${index}, 'answer', this.value)">${item.answer || ''}</textarea></div>
            <div class="field"><label>Open By Default</label><select onchange="window.events?.onUpdateFaqItem?.('${scope}', '${block.id}', ${index}, 'open', this.value === 'true')"><option value="false" ${item.open ? '' : 'selected'}>Collapsed</option><option value="true" ${item.open ? 'selected' : ''}>Open</option></select></div>
            <button class="del-btn" onclick="window.events?.onRemoveFaqItem?.('${scope}', '${block.id}', ${index})" style="align-self:flex-end">✕</button>
          </div>
        </div>`).join('')}
      </div>
      <button class="add-btn" onclick="window.events?.onAddFaqItem?.('${scope}', '${block.id}')">+ Add FAQ Item</button>`;
  }

  return '';
}

/**
 * Get two-column editor HTML for a single column
 * @param {string} scope - Scope
 * @param {string} blockId - Block ID
 * @param {Object} colData - Column data
 * @param {string} side - 'left' or 'right'
 * @returns {string} HTML
 */
function getTwoColEditor(scope, blockId, colData, side) {
  const types = [
    ['text-sm', 'Text S'],
    ['text-md', 'Text M'],
    ['text-lg', 'Text L'],
    ['image', 'Image']
  ];
  const colType = colData.type || 'text-md';
  const dzStableId = 'imdz_' + blockId + '_' + side;

  return `<div style="display:flex;flex-direction:column;gap:.5rem">
    <select style="background:var(--surface2);border:1px solid var(--border);color:var(--text);font-family:var(--font);font-size:.78rem;padding:.4rem .5rem;outline:none" 
      onchange="window.events?.onUpdateColType?.('${scope}', '${blockId}', '${side}', this.value);window.events?.onRerenderBlocks?.('${scope}')">
      ${types.map(([v, l]) => `<option value="${v}" ${colType === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
    ${
      colType === 'image'
        ? `<div>
        <div id="${dzStableId}"><input type="file" accept="image/*" style="display:none">
          <div class="dz-label">Drag & drop or click</div>
          <div class="dz-sub">Loading...</div>
        </div>
        <input type="text" id="${dzStableId}_p" value="${colData.src || ''}" placeholder="Path or URL" style="margin-top:.5rem" 
          oninput="window.events?.onUpdateColField?.('${scope}', '${blockId}', '${side}', 'src', this.value)">
        <button class="add-btn" style="margin-top:.35rem" onclick="window.events?.onBrowseMedia?.('${scope}', '${blockId}', '${dzStableId}_p')">📁 Browse Media</button>
      </div>`
        : `<textarea style="background:var(--surface2);border:1px solid var(--border);color:var(--text);font-family:var(--font);font-size:.8rem;padding:.45rem .55rem;outline:none;resize:vertical;min-height:60px;width:100%" 
        oninput="window.events?.onUpdateColField?.('${scope}', '${blockId}', '${side}', 'content', this.value)">${colData.content || ''}</textarea>`
    }
  </div>`;
}

/**
 * Get all customizable color field HTMLs
 * @param {Object} theme - Current theme object
 * @returns {string} HTML for all color fields
 */
export function getAllColorFieldsHTML(theme) {
  const fields = [];
  const colors = getCustomizableColors();

  colors.forEach(key => {
    const label = getColorDisplayName(key);
    const value = theme[key] || '#000000';
    fields.push(getColorFieldHTML(label, key, value));
  });

  return fields.join('\n');
}
