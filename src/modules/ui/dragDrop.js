/**
 * Drag-Drop Manager
 * Consolidated drag-drop handlers for projects and blocks
 */

/**
 * Global drag-drop state (shared across handlers)
 */
export const dragDropState = {
  currentDragId: null,
  dragType: null, // 'project' or 'block'
  sourceScope: null,

  /// ─ Project drag handlers ─
  onNavProjectDragStart(event, projectId) {
    this.currentDragId = projectId;
    this.dragType = 'project';
    event.currentTarget.style.opacity = '0.4';
    event.dataTransfer.effectAllowed = 'move';
  },

  onNavProjectDragEnd(event) {
    event.currentTarget.style.opacity = '1';
    this.currentDragId = null;
    this.dragType = null;
    document.querySelectorAll('.ni').forEach(el => {
      el.classList.remove('proj-drag-over');
    });
  },

  onNavProjectDragOver(event) {
    event.preventDefault();
    if (this.dragType !== 'project' || !this.currentDragId) return;
    document.querySelectorAll('.ni[draggable]').forEach(el => {
      el.classList.remove('proj-drag-over');
    });
    event.currentTarget.classList.add('proj-drag-over');
  },

  onNavProjectDragLeave(event) {
    event.currentTarget.classList.remove('proj-drag-over');
  },

  onNavProjectDrop(event, targetProjectId) {
    event.preventDefault();
    document.querySelectorAll('.ni').forEach(el => {
      el.classList.remove('proj-drag-over');
    });

    if (this.dragType !== 'project' || !this.currentDragId || this.currentDragId === targetProjectId) {
      return;
    }

    // Delegate to event handler
    if (window.events && window.events.onProjectReorder) {
      window.events.onProjectReorder(this.currentDragId, targetProjectId);
    }
  },

  /// ─ Block drag handlers ─
  onBlockDragStart(event) {
    const el = event.currentTarget;
    this.currentDragId = el.dataset.bid;
    this.sourceScope = el.dataset.scope;
    this.dragType = 'block';
    el.style.opacity = '0.4';
    event.dataTransfer.effectAllowed = 'move';
  },

  onBlockDragEnd(event) {
    event.currentTarget.style.opacity = '1';
    this.currentDragId = null;
    this.sourceScope = null;
    this.dragType = null;
  },

  onBlockDragOver(event) {
    event.preventDefault();
    if (this.dragType !== 'block') return;
    event.dataTransfer.dropEffect = 'move';
  },

  onBlockDrop(event, targetBlockId, targetScope) {
    event.preventDefault();
    if (this.dragType !== 'block' || !this.currentDragId) return;

    // Delegate to event handler
    if (window.events && window.events.onBlockReorder) {
      window.events.onBlockReorder(
        this.sourceScope,
        this.currentDragId,
        targetScope || this.sourceScope,
        targetBlockId
      );
    }
  },

  /// ─ Global settings project drag (legacy for compat) ─
  onSettingsDragStart(event) {
    this.currentDragId = event.currentTarget.dataset.id;
    this.dragType = 'settings-project';
    event.currentTarget.style.opacity = '0.4';
  },

  onSettingsDragEnd(event) {
    event.currentTarget.style.opacity = '1';
    this.currentDragId = null;
    this.dragType = null;
  },

  onSettingsDragOver(event) {
    event.preventDefault();
  },

  onSettingsDrop(event) {
    event.preventDefault();
    if (this.dragType !== 'settings-project' || !this.currentDragId) return;

    const targetId = event.currentTarget.dataset.id;
    if (this.currentDragId === targetId) return;

    // Delegate to event handler
    if (window.events && window.events.onProjectReorderInSettings) {
      window.events.onProjectReorderInSettings(this.currentDragId, targetId);
    }
  }
};

/**
 * Initialize drag-drop state globally
 * Call this in bootstrap to make handlers available in HTML attributes
 */
export function initializeDragDropHandlers() {
  window.dragDropState = dragDropState;
}

/**
 * Create drag-drop HTML attributes for a project nav item
 * @param {string} projectId - Project ID
 * @returns {Object} Object with ondragstart, ondragend, etc.
 */
export function getProjectDragAttrs(projectId) {
  return {
    draggable: 'true',
    'ondragstart': `window.dragDropState.onNavProjectDragStart(event, '${projectId}')`,
    'ondragend': `window.dragDropState.onNavProjectDragEnd(event)`,
    'ondragover': `window.dragDropState.onNavProjectDragOver(event)`,
    'ondrop': `window.dragDropState.onNavProjectDrop(event, '${projectId}')`,
    'ondragleave': `window.dragDropState.onNavProjectDragLeave(event)`
  };
}

/**
 * Create drag-drop HTML attributes for a block item
 * @param {string} blockId - Block ID
 * @param {string} scope - Scope
 * @returns {Object} Object with ondragstart, ondragend, etc.
 */
export function getBlockDragAttrs(blockId, scope) {
  return {
    draggable: 'true',
    'data-bid': blockId,
    'data-scope': scope,
    'ondragstart': `window.dragDropState.onBlockDragStart(event)`,
    'ondragend': `window.dragDropState.onBlockDragEnd(event)`,
    'ondragover': `window.dragDropState.onBlockDragOver(event)`,
    'ondrop': `window.dragDropState.onBlockDrop(event, '${blockId}', '${scope}')`
  };
}

/**
 * Helper to convert attrs object to HTML string
 * @param {Object} attrs - Attributes object
 * @returns {string} HTML attribute string
 */
export function attrsToString(attrs) {
  return Object.entries(attrs)
    .map(([key, val]) => `${key}="${val}"`)
    .join(' ');
}
