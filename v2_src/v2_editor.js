/**
 * V2 Editor Bootstrap
 * Main entry point that wires together all modules and initializes the editor
 */

import { globalState, projects, pageState, uiState, createSnapshot, restoreSnapshot } from '../v2_state/v2_globalState.js';
import { HistoryManager } from '../v2_state/v2_history.js';

// UI and page management
import { showPage, showProject, buildNav, markPageStale, isPageRendered } from '../v2_modules/v2_ui/v2_pageManager.js';
import { getBlockPreview, getBlockMenuHTML, getColorFieldHTML, getBlockBodyHTML } from '../v2_modules/v2_ui/v2_formHelpers.js';
import { initializeDragDropHandlers } from '../v2_modules/v2_ui/v2_dragDrop.js';

// Blocks and rendering
import { renderBlocks, renderBlock } from '../v2_modules/v2_blocks/v2_blockRenderer.js';
import * as blockManager from '../v2_modules/v2_blocks/v2_blockManager.js';

// Projects and themes
import * as projectManager from '../v2_modules/v2_projects/v2_projectManager.js';
import * as themeManager from '../v2_modules/v2_themes/v2_themeManager.js';

// Utilities
import * as dom from '../v2_utils/v2_dom.js';
import { openMediaLibrary, closeMediaLibrary, filterMedia, handleMediaSelect, initializeMediaLibrary } from '../v2_modules/v2_media/v2_mediaLibrary.js';

// ─────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────

export async function bootstrap() {
  try {
    // 1. Load all data
    await loadAllData();

    // 2. Initialize state and managers
    initializeHistoryManager();
    initializeTheme();

    // 3. Set up UI
    buildNav(globalState, handleProjectNavClick);
    showPage(globalState, uiState, pageState.currentPage || 'global', renderEditorPage);

    // 4. Initialize event listeners
    setupKeyboardShortcuts();
    setupFormEventListeners();
    initializeDragDropHandlers();
    initializeMediaLibrary(filterMedia);

    // 5. Show initial page
    const firstPage = pageState.currentPage || 'global';
    showPage(globalState, uiState, firstPage, renderEditorPage);

    // 6. Take snapshot for undo/redo
    historyMgr.snapshot('initial load', createSnapshot(globalState, projects));

    console.log('✓ V2 Editor Bootstrap Complete');
  } catch (error) {
    console.error('✗ Bootstrap failed:', error);
    showToast('Error loading editor: ' + error.message, true);
  }
}

// ─────────────────────────────────────────
// DATA LOADING
// ─────────────────────────────────────────

export let historyMgr = new HistoryManager(50);

async function loadAllData() {
  try {
    // Load global content
    const contentRes = await fetch('content.json?v=' + Date.now());
    if (!contentRes.ok) throw new Error('Failed to load content.json');
    const contentData = await contentRes.json();

    // Copy into globalState
    Object.assign(globalState, contentData);

    // Load projects metadata
    const projectIds = globalState.projects || [];
    const loadedProjects = await Promise.all(
      projectIds.map(id =>
        fetch('projects/' + id + '.json?v=' + Date.now())
          .then(r => {
            if (!r.ok) throw new Error('Failed to load ' + id);
            return r.json();
          })
          .catch(e => {
            console.warn('Could not load project ' + id, e);
            return null;
          })
      )
    );

    // Filter out nulls
    projects.length = 0;
    projects.push(...loadedProjects.filter(p => p !== null));

    console.log(`Loaded ${projects.length} projects`);
  } catch (error) {
    throw new Error('Data loading failed: ' + error.message);
  }
}

function initializeHistoryManager() {
  // Reset history
  historyMgr.clear();
}

function initializeTheme() {
  // Ensure theme exists
  if (!globalState.theme) {
    globalState.theme = themeManager.mergeThemeWithDefaults({});
  }

  // Apply theme to CSS variables
  const vars = themeManager.generateCSSVariables(globalState.theme);
  Object.entries(vars).forEach(([key, val]) => {
    document.documentElement.style.setProperty(key, val);
  });
}

// ─────────────────────────────────────────
// PAGE RENDERING
// ─────────────────────────────────────────

function renderEditorPage(pageName) {
  if (pageName === 'project') {
    renderEditorProject(pageState.currentProjectId);
  } else if (pageName === 'global') {
    renderEditorGlobal();
  } else if (pageName === 'about') {
    renderEditorAbout();
  } else if (pageName === 'contact') {
    renderEditorContact();
  }
}

function renderEditorGlobal() {
  const pageEl = document.getElementById('page-global');
  if (!pageEl) return;

  // Build the global settings page
  pageEl.innerHTML = `
    <div class="page-title">Site Settings</div>
    <div class="page-sub">Name, role, and demo reel.</div>
    <div class="section">
      <div class="sh"><h3>Identity</h3><span class="chev">▾</span></div>
      <div class="sb">
        <div class="row2">
          <div class="field">
            <label>Name</label>
            <input value="${globalState.name || ''}" 
              oninput="window.v2Events?.onChangeGlobalField?.('name', this.value)">
          </div>
          <div class="field">
            <label>Role</label>
            <input value="${globalState.role || ''}" 
              oninput="window.v2Events?.onChangeGlobalField?.('role', this.value)">
          </div>
        </div>
      </div>
    </div>
  `;

  // Mark as rendered
  uiState.renderedPages.add('global');
}

function renderEditorAbout() {
  const pageEl = document.getElementById('page-about');
  if (!pageEl) return;

  const aboutBlocks = globalState.about || [];
  const blocksHTML = renderBlocks(aboutBlocks, globalState.theme);

  pageEl.innerHTML = `
    <div class="page-title">About</div>
    <div class="page-sub">Build your about page with blocks.</div>
    <div class="block-list" id="about-blocks">${blocksHTML}</div>
    <button class="add-block-btn" onclick="window.v2Events?.onToggleBlockMenu?.('about-menu')">+ Add Block</button>
    <div class="block-menu hidden" id="about-menu">${getBlockMenuHTML('about')}</div>
  `;

  uiState.renderedPages.add('about');
}

function renderEditorContact() {
  const pageEl = document.getElementById('page-contact');
  if (!pageEl) return;

  const cp = globalState.contactPanel || {};

  pageEl.innerHTML = `
    <div class="page-title">Contact</div>
    <div class="page-sub">Contact panel and links.</div>
    <div class="section">
      <div class="sh"><h3>Email</h3><span class="chev">▾</span></div>
      <div class="sb">
        <div class="field">
          <label>Email Label</label>
          <input value="${cp.emailLabel || 'Drop us a line'}" 
            oninput="window.v2Events?.onChangeContactField?.('emailLabel', this.value)">
        </div>
      </div>
    </div>
  `;

  uiState.renderedPages.add('contact');
}

function renderEditorProject(projectId) {
  const project = projectManager.findProject(globalState, projectId);
  if (!project) {
    showPage(globalState, uiState, 'global', renderEditorPage);
    return;
  }

  const pageEl = document.getElementById('page-project');
  if (!pageEl) return;

  const blockScope = 'proj-' + projectId;
  const blocksHTML = renderBlocks(project.blocks || [], globalState.theme);

  pageEl.innerHTML = `
    <div class="page-title">${project.title}</div>
    <div class="page-sub">Project info and content blocks.</div>
    
    <div class="section">
      <div class="sh"><h3>Info</h3><span class="chev">▾</span></div>
      <div class="sb">
        <div class="row2">
          <div class="field">
            <label>Title</label>
            <input value="${project.title}" 
              oninput="window.v2Events?.onChangeProjectField?.('${projectId}', 'title', this.value)">
          </div>
          <div class="field">
            <label>Type</label>
            <select onchange="window.v2Events?.onChangeProjectField?.('${projectId}', 'type', this.value)">
              <option value="2d" ${project.type === '2d' ? 'selected' : ''}>2D</option>
              <option value="3d" ${project.type === '3d' ? 'selected' : ''}>3D</option>
              <option value="motion" ${project.type === 'motion' ? 'selected' : ''}>Motion</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="sh"><h3>Content Blocks</h3><span class="chev">▾</span></div>
      <div class="sb">
        <div class="block-list">${blocksHTML}</div>
        <button class="add-block-btn" onclick="window.v2Events?.onToggleBlockMenu?.('proj-menu-${projectId}')">+ Add Block</button>
        <div class="block-menu hidden" id="proj-menu-${projectId}">${getBlockMenuHTML(blockScope)}</div>
      </div>
    </div>
  `;

  uiState.renderedPages.add('project');
}

// ─────────────────────────────────────────
// EVENT HANDLERS
// ─────────────────────────────────────────

function handleProjectNavClick(projectId) {
  showProject(globalState, uiState, projectId, renderEditorPage);
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Cmd/Ctrl+Z = Undo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      historyMgr.undo();
      // TODO: restore state from history
    }
    // Cmd/Ctrl+Y or Cmd/Ctrl+Shift+Z = Redo
    if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      historyMgr.redo();
      // TODO: restore state from history
    }
  });
}

function setupFormEventListeners() {
  // Prevent block drag when typing in form fields
  document.addEventListener('focusin', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      const block = e.target.closest('.bk');
      if (block) block.draggable = false;
    }
  });

  document.addEventListener('focusout', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      const block = e.target.closest('.bk');
      if (block) block.draggable = true;
    }
  });
}

// ─────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────

function showToast(message, isError = false) {
  // TODO: Implement toast notification
  console.log(isError ? '✗' : '✓', message);
}

// ─────────────────────────────────────────
// GLOBAL EVENT HANDLERS
// ─────────────────────────────────────────

window.v2Events = {
  onChangeGlobalField(key, value) {
    globalState[key] = value;
    uiState.dirtyFiles.add('content.json');
  },

  onChangeProjectField(projectId, key, value) {
    const project = projectManager.findProject(globalState, projectId);
    if (project) {
      project[key] = value;
      uiState.dirtyFiles.add('projects/' + projectId + '.json');
    }
  },

  onChangeContactField(key, value) {
    if (!globalState.contactPanel) globalState.contactPanel = {};
    globalState.contactPanel[key] = value;
    uiState.dirtyFiles.add('content.json');
  },

  onMediaSelect(path) {
    handleMediaSelect(path, uiState, pageState.currentPage, pageState.currentProjectId);
  }
};

export { createSnapshot, restoreSnapshot };
