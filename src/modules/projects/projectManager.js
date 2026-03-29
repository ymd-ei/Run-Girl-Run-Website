/**
 * Project Manager
 * Handles all project CRUD operations, ordering, and filtering
 */

/**
 * Find a project by ID
 * @param {Object} state - Global state object
 * @param {string} projectId - Project ID
 * @returns {Object|null} Project object or null
 */
export function findProject(state, projectId) {
  return state.projects.find(p => p.id === projectId) || null;
}

/**
 * Get project index
 * @param {Object} state - Global state object
 * @param {string} projectId - Project ID
 * @returns {number} Index or -1
 */
export function getProjectIndex(state, projectId) {
  return state.projects.findIndex(p => p.id === projectId);
}

/**
 * Add a new project
 * @param {Object} state - Global state object
 * @param {string} title - Project title
 * @returns {Object} New project object
 */
export function addProject(state, title) {
  if (!title || !title.trim()) {
    throw new Error('Project title is required');
  }

  // Generate ID from title
  const id = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Check for duplicate
  if (state.projects.some(p => p.id === id)) {
    throw new Error(`Project with ID "${id}" already exists`);
  }

  const newProject = {
    id,
    title: title.trim(),
    type: 'motion',
    typeLabel: 'Motion',
    year: new Date().getFullYear().toString(),
    client: '',
    duration: '',
    tags: [],
    thumbnail: '',
    videoUrl: '',
    published: true,
    blocks: [
      {
        id: 'b1',
        type: 'text-lg',
        content: title.trim(),
        align: 'left'
      },
      {
        id: 'b2',
        type: 'text-sm',
        content: `Motion · ${new Date().getFullYear()}`,
        align: 'left'
      }
    ]
  };

  state.projects.push(newProject);

  // Add to globalState.projects list for ordering
  if (!state.globalState.projects) {
    state.globalState.projects = [];
  }
  state.globalState.projects.push(id);

  return newProject;
}

/**
 * Delete a project
 * @param {Object} state - Global state object
 * @param {string} projectId - Project ID
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteProject(state, projectId) {
  const originalLength = state.projects.length;

  // Remove from projects array
  state.projects = state.projects.filter(p => p.id !== projectId);

  // Remove from ordering list
  if (state.globalState.projects) {
    state.globalState.projects = state.globalState.projects.filter(
      id => id !== projectId
    );
  }

  return state.projects.length < originalLength;
}

/**
 * Update a project property
 * @param {Object} state - Global state object
 * @param {string} projectId - Project ID
 * @param {string} key - Property key
 * @param {*} value - New value
 * @returns {boolean} True if updated, false if not found
 */
export function updateProject(state, projectId, key, value) {
  const project = findProject(state, projectId);
  if (!project) return false;

  project[key] = value;
  return true;
}

/**
 * Toggle project published state
 * @param {Object} state - Global state object
 * @param {string} projectId - Project ID
 * @returns {boolean} New published state, or null if not found
 */
export function toggleProjectPublished(state, projectId) {
  const project = findProject(state, projectId);
  if (!project) return null;

  project.published = !project.published;
  return project.published;
}

/**
 * Reorder projects (for drag-drop)
 * @param {Object} state - Global state object
 * @param {string} fromId - Project ID to move
 * @param {string} toId - Project ID to insert before
 * @returns {boolean} True if reordered
 */
export function reorderProjects(state, fromId, toId) {
  if (!state.globalState.projects) {
    state.globalState.projects = state.projects.map(p => p.id);
  }

  const list = state.globalState.projects;
  const fromIndex = list.indexOf(fromId);
  const toIndex = list.indexOf(toId);

  if (fromIndex === -1 || toIndex === -1) return false;

  // Remove from source
  const id = list.splice(fromIndex, 1)[0];

  // Insert at destination
  const targetIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
  list.splice(targetIndex, 0, id);

  // Also reorder projects array to match
  const projectFrom = state.projects.findIndex(p => p.id === fromId);
  const projectTo = state.projects.findIndex(p => p.id === toId);

  if (projectFrom !== -1 && projectTo !== -1) {
    const [moved] = state.projects.splice(projectFrom, 1);
    const finalTo = projectFrom < projectTo ? projectTo - 1 : projectTo;
    state.projects.splice(finalTo, 0, moved);
  }

  return true;
}

/**
 * Get ordered project IDs
 * @param {Object} state - Global state object
 * @returns {Array} Array of project IDs in order
 */
export function getProjectOrder(state) {
  if (!state.globalState.projects) {
    state.globalState.projects = state.projects.map(p => p.id);
  }
  return state.globalState.projects;
}

/**
 * Get ordered projects
 * @param {Object} state - Global state object
 * @returns {Array} Projects in display order
 */
export function getOrderedProjects(state) {
  const order = getProjectOrder(state);
  return order
    .map(id => findProject(state, id))
    .filter(p => p !== null && p !== undefined);
}

/**
 * Filter projects by tags
 * @param {Object} state - Global state object
 * @param {Array} filterTags - Tags to filter by
 * @returns {Array} Filtered projects
 */
export function filterProjectsByTags(state, filterTags) {
  if (!filterTags || filterTags.length === 0) {
    return getOrderedProjects(state);
  }

  return getOrderedProjects(state).filter(project => {
    if (!project.tags || project.tags.length === 0) {
      return false;
    }
    return filterTags.some(tag => project.tags.includes(tag));
  });
}

/**
 * Filter projects by visibility
 * @param {Object} state - Global state object
 * @param {boolean} [publishedOnly] - Show only published projects
 * @returns {Array} Filtered projects
 */
export function filterProjectsByStatus(state, publishedOnly = true) {
  const projects = getOrderedProjects(state);
  if (!publishedOnly) return projects;
  return projects.filter(p => p.published !== false);
}

/**
 * Get all unique tags from all projects
 * @param {Object} state - Global state object
 * @returns {Array} Array of unique tags
 */
export function getAllProjectTags(state) {
  const tags = new Set();
  state.projects.forEach(p => {
    if (p.tags && Array.isArray(p.tags)) {
      p.tags.forEach(tag => tags.add(tag));
    }
  });
  return Array.from(tags).sort();
}

/**
 * Validate a project object
 * @param {Object} project - Project to validate
 * @returns {{valid: boolean, errors: Array}} Validation result
 */
export function validateProject(project) {
  const errors = [];

  if (!project.id) errors.push('Project missing id');
  if (!project.title) errors.push('Project missing title');
  if (!project.type) errors.push('Project missing type');

  return {
    valid: errors.length === 0,
    errors
  };
}
