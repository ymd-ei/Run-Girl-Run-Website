/**
 * Block Renderer
 * Single source of truth for rendering blocks in both editor and display contexts
 */

import { generateThumbSVG } from '../../utils/svg.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderImageFallback(src, alt, caption = '') {
  if (!src) {
    return `<div class="bl-image empty">${alt || 'Image'}</div>`;
  }

  const captionHTML = caption ? `<figcaption class="bl-before-after-caption">${caption}</figcaption>` : '';
  return `<figure class="bl-before-after bl-before-after-fallback"><div class="bl-image"><img src="${src}" alt="${alt || ''}"></div>${captionHTML}</figure>`;
}

function isDirectVideoSource(src) {
  const clean = String(src || '').split('?')[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v)$/.test(clean);
}

/**
 * Generate thumbnail HTML for block preview
 * @param {string} type - Block type
 * @param {Object} theme - Theme object ({accent, paper})
 * @returns {string} HTML string
 */
export function renderBlockThumbnail(type, theme = {}) {
  const accentColor = theme.accent || '#5e30eb';
  const bgColor = theme.paper || '#e8e3da';
  const svg = generateThumbSVG(type, accentColor, bgColor);
  return `<div class="tph">${svg}</div>`;
}

/**
 * Render a single block
 * @param {Object} block - Block object
 * @param {Object} theme - Theme object (optional, for colors)
 * @returns {string} HTML string
 */
export function renderBlock(block, theme = {}, renderOptions = {}) {
  if (!block || !block.type) return '';

  const canvasAttrs = (field, itemIndex) => {
    const scope = renderOptions.canvasScope;
    if (!scope || !block.id || !field) return '';

    const projectIdAttr = renderOptions.canvasProjectId
      ? ` data-canvas-project-id="${renderOptions.canvasProjectId}"`
      : '';

    const itemAttr = itemIndex !== undefined ? ` data-canvas-item="${itemIndex}"` : '';

    return ` data-canvas-editable="true" data-canvas-scope="${scope}" data-canvas-block-id="${block.id}" data-canvas-field="${field}"${itemAttr}${projectIdAttr}`;
  };

  const alignClass =
    block.align === 'center' ? 'ac' : block.align === 'right' ? 'ar' : '';

  switch (block.type) {
    case 'text-sm':
      return `<p class="bl-text-sm ${alignClass}"${canvasAttrs('content')}>${block.content || ''}</p>`;

    case 'text-md':
      return `<p class="bl-text-md ${alignClass}"${canvasAttrs('content')}>${block.content || ''}</p>`;

    case 'text-lg':
      return `<p class="bl-text-lg ${alignClass}"${canvasAttrs('content')}>${block.content || ''}</p>`;

    case 'image':
      if (block.src) {
        return `<div class="bl-image"><img src="${block.src}" alt="${
          block.alt || ''
        }"></div>`;
      }
      return `<div class="bl-image empty">${block.alt || 'Image'}</div>`;

    case 'alpha-art':
      if (!block.src) {
        return `<div class="bl-alpha-art empty">${block.alt || 'Alpha artwork'}</div>`;
      }
      const rawScale = Number(block.scale);
      const safeScale = Number.isFinite(rawScale) ? clamp(rawScale, 0.1, 2) : 1;
      return `<div class="bl-alpha-art" role="img" aria-label="${
        block.alt || 'Alpha artwork'
      }" style="--alpha-src:url('${block.src}');--alpha-color:${
        block.color || '#5e30eb'
      };--alpha-bg:${block.bg || 'transparent'};--alpha-fit:${
        block.fit === 'cover' ? 'cover' : 'contain'
      };--alpha-scale:${safeScale};--alpha-ratio:${block.ratio || '16/9'}"><img class="bl-alpha-art-probe" src="${
        block.src
      }" alt="" aria-hidden="true" onload="if(this.naturalWidth&&this.naturalHeight){this.parentElement.style.setProperty('--alpha-natural-width',this.naturalWidth+'px');this.parentElement.style.setProperty('--alpha-ratio',this.naturalWidth+' / '+this.naturalHeight);}"><div class="bl-alpha-art-mask"></div></div>`;

    case 'twocol':
      const leftHTML = renderBlock(block.left || {}, theme);
      const rightHTML = renderBlock(block.right || {}, theme);
      return `<div class="bl-twocol"><div>${leftHTML}</div><div>${rightHTML}</div></div>`;

    case 'quote':
      return `<div class="bl-quote ${alignClass}"><p${canvasAttrs('content')}>${
        block.content || ''
      }</p></div>`;

    case 'video':
      if (block.src) {
        if (isDirectVideoSource(block.src)) {
          return `<div class="bl-video"><video src="${block.src}" controls playsinline preload="metadata"></video></div>`;
        }
        return `<div class="bl-video"><iframe title="Embedded project video" src="${block.src}" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
      }
      return `<div class="bl-video empty">Video embed</div>`;

    case 'stats':
      const cols = (block.items || []).length;
      const statsHTML = (block.items || [])
        .map(
          (s, i) =>
            `<div class="sc"><div class="sn" data-target="${s.num}"${canvasAttrs('items.num', i)}>${s.num}</div><div class="sl"${canvasAttrs('items.label', i)}>${s.label}</div></div>`
        )
        .join('');
      return `<div class="bl-stats" style="grid-template-columns:repeat(${cols},1fr)">${statsHTML}</div>`;

    case 'skills':
      const skillsHTML = (block.items || [])
        .map(
          (s, i) =>
            `<div class="skr"><div class="skn"><span${canvasAttrs('items.name', i)}>${s.name}</span><span>${s.pct}%</span></div><div class="skb"><div class="skf" style="--pct:${s.pct / 100}"></div></div></div>`
        )
        .join('');
      return `<div class="bl-skills" id="skl">${skillsHTML}</div>`;

    case 'divider':
      return `<div class="bl-divider"></div>`;

    case 'callout':
      return `<div class="bl-callout ${block.tone || 'note'}"><div class="bl-callout-title"${canvasAttrs('title')}>${
        block.title || ''
      }</div><div class="bl-callout-body"${canvasAttrs('content')}>${block.content || ''}</div></div>`;

    case 'gallery':
      const galleryCols = block.columns === 3 ? 3 : 2;
      return `<div class="bl-gallery cols-${galleryCols}">${(block.items || [])
        .map(
          (item, i) =>
            `<figure class="bl-gallery-item"><img class="bl-gallery-open" src="${item.src || ''}" alt="${
              item.alt || ''
            }" data-full-src="${item.src || ''}" data-full-alt="${item.alt || ''}">${
              item.caption ? `<figcaption${canvasAttrs('items.caption', i)}>${item.caption}</figcaption>` : ''
            }</figure>`
        )
        .join('')}</div>`;

    case 'process':
      return `<div class="bl-process">${(block.steps || [])
        .map(
          (step, index) => `<div class="bl-process-step${step.image ? ' has-image' : ''}">${
            step.image
              ? `<img class="bl-process-step-image" src="${step.image}" alt="${
                  step.imageAlt || step.title || ''
                }"><div class="bl-process-step-overlay"></div>`
              : ''
          }<div class="bl-process-num">${
            index + 1
          }</div><div class="bl-process-copy">${
            step.date ? `<div class="bl-process-meta"><span class="bl-process-date"${canvasAttrs('steps.date', index)}>${step.date}</span></div>` : ''
          }<h4${canvasAttrs('steps.title', index)}>${step.title || ''}</h4><p${canvasAttrs('steps.content', index)}>${step.content || ''}</p></div></div>`
        )
        .join('')}</div>`;

    case 'cta':
      return `<section class="bl-cta ${block.tone || 'default'}"><div class="bl-cta-copy">${
        block.headline ? `<h3 class="bl-cta-headline"${canvasAttrs('headline')}>${block.headline}</h3>` : ''
      }${block.body ? `<p class="bl-cta-body"${canvasAttrs('body')}>${block.body}</p>` : ''}</div>${
        block.buttonLabel && block.buttonUrl
          ? `<a class="bl-cta-link" href="${block.buttonUrl}" target="_blank" rel="noopener"${canvasAttrs('buttonLabel')}>${block.buttonLabel}</a>`
          : ''
      }</section>`;

    case 'beforeafter':
      if (!block.beforeSrc || !block.afterSrc) {
        return renderImageFallback(
          block.afterSrc || block.beforeSrc,
          block.afterAlt || block.beforeAlt,
          block.caption || ''
        );
      }

      const rawPosition = Number(block.position);
      // Mirror the slider: 0 = after (right), 100 = before (left)
      const mirrored = clamp(Number.isFinite(rawPosition) ? rawPosition : 67, 0, 100);
      const position = 100 - mirrored;
      return `<figure class="bl-before-after" data-before-after style="--before-after-pos:${position}%"><div class="bl-before-after-frame" data-before-after-frame><img class="bl-before-after-base" src="${
        block.afterSrc
      }" alt="${block.afterAlt || 'After image'}" draggable="false"><div class="bl-before-after-overlay"><img class="bl-before-after-top" src="${
        block.beforeSrc
      }" alt="${block.beforeAlt || 'Before image'}" draggable="false"></div><button class="bl-before-after-handle" type="button" role="slider" aria-label="Adjust before and after comparison" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${mirrored}" data-before-after-handle><span class="bl-before-after-pill"></span></button></div>${
        block.caption ? `<figcaption class="bl-before-after-caption">${block.caption}</figcaption>` : ''
      }</figure>`;

    case 'faq':
      const openIndex = Math.max(
        0,
        (block.items || []).findIndex(item => item.open)
      );
      return `<div class="bl-faq" data-faq>${(block.items || [])
        .map((item, index) => {
          const isOpen = index === openIndex;
          return `<div class="bl-faq-item ${isOpen ? 'open' : ''}" data-faq-item><button class="bl-faq-trigger" type="button" aria-expanded="${
            isOpen ? 'true' : 'false'
          }" data-faq-trigger><span${canvasAttrs('items.question', index)}>${item.question || `Question ${index + 1}`}</span><span class="bl-faq-icon" aria-hidden="true">+</span></button><div class="bl-faq-panel" ${
            isOpen ? '' : 'hidden'
          } data-faq-panel><p${canvasAttrs('items.answer', index)}>${item.answer || ''}</p></div></div>`;
        })
        .join('')}</div>`;

    default:
      return '';
  }
}

/**
 * Render multiple blocks as a canvas
 * @param {Array} blocks - Array of block objects
 * @param {Object} theme - Theme object (optional)
 * @returns {string} HTML string
 */
export function renderBlocks(blocks, theme = {}, renderOptions = {}) {
  if (!Array.isArray(blocks)) return '';

  // In editor mode, wrap each block in a selection root that carries its
  // identity. This is layout-safe: .block-canvas uses flex `gap`, so the
  // wrapper simply becomes the flex item. Gated behind canvasEditor so normal
  // visitor DOM is unchanged.
  const editor = !!renderOptions.canvasEditor;
  const scope = renderOptions.canvasScope || '';
  const projAttr = renderOptions.canvasProjectId
    ? ` data-canvas-project-id="${renderOptions.canvasProjectId}"`
    : '';

  const blocksHTML = blocks.map(b => {
    const inner = renderBlock(b, theme, renderOptions);
    if (!editor) return inner;
    return `<div class="cv-block" data-canvas-block-root data-canvas-block-id="${b.id || ''}" data-canvas-block-type="${b.type || ''}" data-canvas-scope="${scope}"${projAttr}>${inner}</div>`;
  }).join('');

  return `<div class="block-canvas${editor ? ' cv-editing' : ''}">${blocksHTML}</div>`;
}

/**
 * Render block preview (for display/public)
 * @param {Object} block - Block object
 * @param {Object} theme - Theme object
 * @returns {string} HTML string
 */
export function renderBlockPreview(block, theme = {}) {
  return renderBlock(block, theme);
}

/**
 * Get block display name for UI
 * @param {string} type - Block type
 * @returns {string} Display name
 */
export function getBlockTypeName(type) {
  const names = {
    'text-sm': 'Small Text',
    'text-md': 'Medium Text',
    'text-lg': 'Large Text',
    'image': 'Image',
    'alpha-art': 'Alpha Art',
    'twocol': 'Two Column',
    'quote': 'Quote',
    'video': 'Video',
    'stats': 'Stats',
    'skills': 'Skills',
    'callout': 'Callout',
    'gallery': 'Gallery',
    'process': 'Process',
    'cta': 'CTA Banner',
    'beforeafter': 'Before / After',
    'faq': 'FAQ',
    'divider': 'Divider'
  };
  return names[type] || type;
}

/**
 * Check if block supports items (stats, skills)
 * @param {string} type - Block type
 * @returns {boolean}
 */
export function blockSupportsItems(type) {
  return type === 'stats' || type === 'skills' || type === 'gallery' || type === 'faq';
}

/**
 * Check if block is a two-column block
 * @param {string} type - Block type
 * @returns {boolean}
 */
export function isTwoColumnBlock(type) {
  return type === 'twocol';
}

/**
 * Check if block supports alignment
 * @param {string} type - Block type
 * @returns {boolean}
 */
export function blockSupportsAlignment(type) {
  return (
    type === 'text-sm' ||
    type === 'text-md' ||
    type === 'text-lg' ||
    type === 'quote'
  );
}
