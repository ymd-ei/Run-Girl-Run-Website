/**
 * Block Manager
 * Handles all block CRUD operations
 * Decoupled from rendering and DOM manipulation
 */

import { uid } from '../../v2_utils/v2_validation.js';

/**
 * Block type defaults (templates for new blocks)
 */
const BLOCK_DEFAULTS = {
  'text-sm': { type: 'text-sm', content: '', align: 'left' },
  'text-md': { type: 'text-md', content: '', align: 'left' },
  'text-lg': { type: 'text-lg', content: '', align: 'left' },
  'image': { type: 'image', src: '', alt: '' },
  'twocol': {
    type: 'twocol',
    left: { type: 'image', src: '', alt: '' },
    right: { type: 'text-md', content: '', align: 'left' }
  },
  'quote': { type: 'quote', content: '', align: 'left' },
  'video': { type: 'video', src: '' },
  'stats': { type: 'stats', items: [{ num: '', label: '' }] },
  'skills': { type: 'skills', items: [{ name: '', pct: 80 }] },
  'divider': { type: 'divider' }
};

/**
 * Get blocks for a scope (either 'about' or project ID)
 * @param {Object} state - Global state object
 * @param {string} scope - 'about' or 'proj-{projectId}'
 * @returns {Array} Array of blocks
 */
export function getBlocks(state, scope) {
  if (scope === 'about') {
    return state.globalState.about || [];
  }

  const projectId = scope.replace('proj-', '');
  const project = state.projects.find(p => p.id === projectId);
  return project ? project.blocks || [] : [];
}

/**
 * Set blocks for a scope
 * @param {Object} state - Global state object
 * @param {string} scope - 'about' or 'proj-{projectId}'
 * @param {Array} blocks - New blocks array
 */
export function setBlocks(state, scope, blocks) {
  if (scope === 'about') {
    state.globalState.about = blocks;
  } else {
    const projectId = scope.replace('proj-', '');
    const project = state.projects.find(p => p.id === projectId);
    if (project) {
      project.blocks = blocks;
    }
  }
}

/**
 * Find a block by ID in a scope
 * @param {Object} state - Global state object
 * @param {string} scope - Scope identifier
 * @param {string} blockId - Block ID
 * @returns {Object|null} Block object or null
 */
export function findBlock(state, scope, blockId) {
  const blocks = getBlocks(state, scope);
  return blocks.find(b => b.id === blockId) || null;
}

/**
 * Add a new block of specified type
 * @param {Object} state - Global state object
 * @param {string} scope - Scope identifier
 * @param {string} type - Block type
 * @returns {string} New block ID
 */
export function addBlock(state, scope, type) {
  const blocks = getBlocks(state, scope) || [];
  const blockId = uid();

  const template = BLOCK_DEFAULTS[type];
  if (!template) {
    console.warn(`Unknown block type: ${type}`);
    return null;
  }

  const newBlock = {
    id: blockId,
    ...JSON.parse(JSON.stringify(template)) // Deep copy to avoid mutating defaults
  };

  blocks.push(newBlock);
  setBlocks(state, scope, blocks);

  return blockId;
}

/**
 * Remove a block by ID
 * @param {Object} state - Global state object
 * @param {string} scope - Scope identifier
 * @param {string} blockId - Block ID to remove
 * @returns {boolean} True if removed, false if not found
 */
export function removeBlock(state, scope, blockId) {
  const blocks = getBlocks(state, scope) || [];
  const originalLength = blocks.length;

  const filtered = blocks.filter(b => b.id !== blockId);
  setBlocks(state, scope, filtered);

  return filtered.length < originalLength;
}

/**
 * Update a property of a block
 * @param {Object} state - Global state object
 * @param {string} scope - Scope identifier
 * @param {string} blockId - Block ID
 * @param {string} key - Property key
 * @param {*} value - New value
 * @returns {boolean} True if updated, false if block not found
 */
export function updateBlock(state, scope, blockId, key, value) {
  const block = findBlock(state, scope, blockId);
  if (!block) return false;

  block[key] = value;
  return true;
}

/**
 * Change block type
 * @param {Object} state - Global state object
 * @param {string} scope - Scope identifier
 * @param {string} blockId - Block ID
 * @param {string} newType - New block type
 * @returns {boolean} True if changed, false if block not found
 */
export function changeBlockType(state, scope, blockId, newType) {
  const block = findBlock(state, scope, blockId);
  if (!block) return false;

  const template = BLOCK_DEFAULTS[newType];
  if (!template) return false;

  // Keep id, update type and add template properties
  block.type = newType;

  // Merge in new type's defaults (but keep existing id)
  const defaults = JSON.parse(JSON.stringify(template));
  Object.keys(defaults).forEach(key => {
    if (key !== 'type') {
      block[key] = defaults[key];
    }
  });

  return true;
}

/**
 * Update a column in a two-column block
 * @param {Object} state - Global state object
 * @param {string} scope - Scope identifier
 * @param {string} blockId - Block ID
 * @param {string} side - 'left' or 'right'
 * @param {string} key - Property key
 * @param {*} value - New value
 * @returns {boolean} True if updated
 */
export function updateColumnField(state, scope, blockId, side, key, value) {
  const block = findBlock(state, scope, blockId);
  if (!block) return false;

  if (!block[side]) block[side] = {};
  block[side][key] = value;
  return true;
}

/**
 * Update column type (for twocol blocks)
 * @param {Object} state - Global state object
 * @param {string} scope - Scope identifier
 * @param {string} blockId - Block ID
 * @param {string} side - 'left' or 'right'
 * @param {string} type - New type for column
 * @returns {boolean} True if updated
 */
export function updateColumnType(state, scope, blockId, side, type) {
  const block = findBlock(state, scope, blockId);
  if (!block) return false;

  if (!block[side]) block[side] = {};
  block[side].type = type;
  return true;
}

/**
 * Update an item in a stats or skills block
 * @param {Object} state - Global state object
 * @param {string} scope - Scope identifier
 * @param {string} blockId - Block ID
 * @param {number} itemIndex - Index of item
 * @param {string} key - Property key ('num', 'label', 'name', 'pct')
 * @param {*} value - New value
 * @returns {boolean} True if updated
 */
export function updateItemProperty(state, scope, blockId, itemIndex, key, value) {
  const block = findBlock(state, scope, blockId);
  if (!block || !block.items || !block.items[itemIndex]) return false;

  block.items[itemIndex][key] = value;
  return true;
}

/**
 * Add a new item to a stats or skills block
 * @param {Object} state - Global state object
 * @param {string} scope - Scope identifier
 * @param {string} blockId - Block ID
 * @param {string} blockType - Type of block ('stats' or 'skills')
 * @returns {boolean} True if added
 */
export function addItemToBlock(state, scope, blockId, blockType) {
  const block = findBlock(state, scope, blockId);
  if (!block) return false;

  if (!block.items) block.items = [];

  if (blockType === 'stats') {
    block.items.push({ num: '', label: '' });
  } else if (blockType === 'skills') {
    block.items.push({ name: '', pct: 80 });
  } else {
    return false;
  }

  return true;
}

/**
 * Remove an item from a stats or skills block
 * @param {Object} state - Global state object
 * @param {string} scope - Scope identifier
 * @param {string} blockId - Block ID
 * @param {number} itemIndex - Index of item to remove
 * @returns {boolean} True if removed
 */
export function removeItemFromBlock(state, scope, blockId, itemIndex) {
  const block = findBlock(state, scope, blockId);
  if (!block || !block.items || itemIndex < 0 || itemIndex >= block.items.length) {
    return false;
  }

  block.items.splice(itemIndex, 1);
  return true;
}

/**
 * Reorder blocks (for drag-drop)
 * @param {Object} state - Global state object
 * @param {string} scope - Scope identifier
 * @param {string} fromId - Block ID to move
 * @param {string} toId - Block ID to insert before (or null for end)
 * @returns {boolean} True if reordered
 */
export function reorderBlocks(state, scope, fromId, toId) {
  const blocks = getBlocks(state, scope);
  const fromIndex = blocks.findIndex(b => b.id === fromId);

  if (fromIndex === -1) return false;

  const block = blocks[fromIndex];
  blocks.splice(fromIndex, 1);

  if (!toId) {
    blocks.push(block);
  } else {
    const toIndex = blocks.findIndex(b => b.id === toId);
    if (toIndex === -1) return false;
    blocks.splice(toIndex, 0, block);
  }

  return true;
}

/**
 * Get all block types available
 * @returns {Array<string>} List of block type keys
 */
export function getAvailableBlockTypes() {
  return Object.keys(BLOCK_DEFAULTS);
}

/**
 * Validate a block object
 * @param {Object} block - Block to validate
 * @returns {{valid: boolean, errors: Array}} Validation result
 */
export function validateBlock(block) {
  const errors = [];

  if (!block.id) errors.push('Block missing id');
  if (!block.type) errors.push('Block missing type');

  const template = BLOCK_DEFAULTS[block.type];
  if (!template) errors.push(`Unknown block type: ${block.type}`);

  return {
    valid: errors.length === 0,
    errors
  };
}
