/**
 * Page Manager
 * Handles page navigation and rendering state
 */

/**
 * Switch to a page (global, about, contact, project)
 * @param {Object} state - Global state object
 * @param {Object} uiState - UI state object (has renderedPages Set)
 * @param {string} name - Page name
 * @param {Function} renderPage - Optional render function (id) => void
 */
export function showPage(state, uiState, name, renderPage) {
  // Hide all pages
  const pageNames = ['global', 'about', 'contact', 'project'];
  pageNames.forEach(n => {
    const el = document.getElementById('page-' + n);
    if (el) el.style.display = 'none';
    const nav = document.getElementById('nav-' + n);
    if (nav) nav.classList.remove('active');
  });

  // Clear project nav highlights
  if (state.projects) {
    state.projects.forEach(p => {
      const el = document.getElementById('nav-proj-' + p.id);
      if (el) el.classList.remove('active');
    });
  }

  // Show selected page
  const pageEl = document.getElementById('page-' + name);
  if (pageEl) pageEl.style.display = '';

  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');

  // Update state
  state.pageState.currentPage = name;
  if (name !== 'project') {
    state.pageState.currentProjectId = null;
  }

  // Render if needed (lazy rendering)
  if (!uiState.renderedPages.has(name)) {
    if (renderPage) {
      renderPage(name);
    }
    uiState.renderedPages.add(name);
  }
}

/**
 * Switch to a specific project page
 * @param {Object} state - Global state object
 * @param {Object} uiState - UI state object
 * @param {string} projectId - Project ID
 * @param {Function} renderProject - render(projectId) => void
 */
export function showProject(state, uiState, projectId, renderProject) {
  showPage(state, uiState, 'project', null);
  state.pageState.currentProjectId = projectId;

  // Highlight in nav
  const el = document.getElementById('nav-proj-' + projectId);
  if (el) el.classList.add('active');

  // Render project
  if (renderProject) {
    renderProject(projectId);
  }
}

/**
 * Build the project navigation sidebar
 * @param {Object} state - Global state object
 * @param {Function} onProjectClick - (projectId) => void
 */
export function buildNav(state, onProjectClick) {
  const navContainer = document.getElementById('project-nav');
  if (!navContainer) return;

  const projectOrder = getProjectOrder(state);

  navContainer.innerHTML = projectOrder
    .map(projectId => {
      const project = state.projects.find(p => p.id === projectId);
      if (!project) return '';

      return `
        <button class="ni" id="nav-proj-${projectId}" 
          draggable="true"
          ondragstart="window.dragDropState?.onNavProjectDragStart(event, '${projectId}')"
          ondragover="window.dragDropState?.onNavProjectDragOver(event)"
          ondragend="window.dragDropState?.onNavProjectDragEnd(event)"
          ondrop="window.dragDropState?.onNavProjectDrop(event, '${projectId}')"
          ondragleave="window.dragDropState?.onNavProjectDragLeave(event)">
          <span style="color:var(--muted);font-size:.7rem;margin-right:.2rem;cursor:grab">&#9776;</span>
          <div class="dot"></div>
          <span onclick="window.events?.onProjectNavClick?.('${projectId}')" style="flex:1;text-align:left">${project.title}</span>
          <span class="badge">${project.type || 'motion'}</span>
        </button>
      `;
    })
    .join('');
}

/**
 * Get project order (respects globalState.projects array)
 * @param {Object} state - Global state
 * @returns {string[]} Array of project IDs in order
 */
export function getProjectOrder(state) {
  if (!state.globalState.projects) {
    state.globalState.projects = state.projects.map(p => p.id);
  }
  return state.globalState.projects;
}

/**
 * Mark a page as stale (needs re-render)
 * @param {Object} uiState - UI state object
 * @param {string} pageName - Page name
 */
export function markPageStale(uiState, pageName) {
  if (uiState.renderedPages) {
    uiState.renderedPages.delete(pageName);
  }
}

/**
 * Mark all pages as stale
 * @param {Object} uiState - UI state object
 */
export function markAllPageStale(uiState) {
  if (uiState.renderedPages) {
    uiState.renderedPages.clear();
  }
}

/**
 * Check if a page has been rendered
 * @param {Object} uiState - UI state object
 * @param {string} pageName - Page name
 * @returns {boolean}
 */
export function isPageRendered(uiState, pageName) {
  return uiState.renderedPages && uiState.renderedPages.has(pageName);
}

/**
 * Get current page
 * @param {Object} state - Global state
 * @returns {string} Current page name
 */
export function getCurrentPage(state) {
  return state.pageState.currentPage || 'global';
}

/**
 * Get current project ID
 * @param {Object} state - Global state
 * @returns {string|null} Current project ID or null
 */
export function getCurrentProjectId(state) {
  return state.pageState.currentProjectId || null;
}
