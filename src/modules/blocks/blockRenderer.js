/**
 * Block Renderer
 * Single source of truth for rendering blocks in both editor and display contexts
 */

import { generateThumbSVG } from '../../utils/svg.js';

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
export function renderBlock(block, theme = {}) {
  if (!block || !block.type) return '';

  const alignClass =
    block.align === 'center' ? 'ac' : block.align === 'right' ? 'ar' : '';

  switch (block.type) {
    case 'text-sm':
      return `<p class="bl-text-sm ${alignClass}">${block.content || ''}</p>`;

    case 'text-md':
      return `<p class="bl-text-md ${alignClass}">${block.content || ''}</p>`;

    case 'text-lg':
      return `<p class="bl-text-lg ${alignClass}">${block.content || ''}</p>`;

    case 'image':
      if (block.src) {
        return `<div class="bl-image"><img src="${block.src}" alt="${
          block.alt || ''
        }"></div>`;
      }
      return `<div class="bl-image empty">${block.alt || 'Image'}</div>`;

    case 'twocol':
      const leftHTML = renderBlock(block.left || {}, theme);
      const rightHTML = renderBlock(block.right || {}, theme);
      return `<div class="bl-twocol"><div>${leftHTML}</div><div>${rightHTML}</div></div>`;

    case 'quote':
      return `<div class="bl-quote ${alignClass}"><p>${
        block.content || ''
      }</p></div>`;

    case 'video':
      if (block.src) {
        return `<div class="bl-video"><iframe src="${block.src}" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
      }
      return `<div class="bl-video empty">Video embed</div>`;

    case 'stats':
      const cols = (block.items || []).length;
      const statsHTML = (block.items || [])
        .map(
          s =>
            `<div class="sc"><div class="sn" data-target="${s.num}">${s.num}</div><div class="sl">${s.label}</div></div>`
        )
        .join('');
      return `<div class="bl-stats" style="grid-template-columns:repeat(${cols},1fr)">${statsHTML}</div>`;

    case 'skills':
      const skillsHTML = (block.items || [])
        .map(
          s =>
            `<div class="skr"><div class="skn"><span>${s.name}</span><span>${s.pct}%</span></div><div class="skb"><div class="skf" style="--pct:${
              s.pct / 100
            }"></div></div></div>`
        )
        .join('');
      return `<div class="bl-skills" id="skl">${skillsHTML}</div>`;

    case 'divider':
      return `<div class="bl-divider"></div>`;

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
export function renderBlocks(blocks, theme = {}) {
  if (!Array.isArray(blocks)) return '';

  const blocksHTML = blocks.map(b => renderBlock(b, theme)).join('');
  return `<div class="block-canvas">${blocksHTML}</div>`;
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
    'twocol': 'Two Column',
    'quote': 'Quote',
    'video': 'Video',
    'stats': 'Stats',
    'skills': 'Skills',
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
  return type === 'stats' || type === 'skills';
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
