/**
 * Global State for v2 Editor & Display
 * Replaces the abbreviated 'C' with clear, readable object names
 */

export const globalState = {
  // Site metadata
  name: "",
  role: "",
  location: "",
  
  // Reel/video embed
  reel: {
    type: "", // 'youtube', 'vimeo', etc.
    url: ""
  },
  
  // Contact panel
  contactPanel: {
    intro: "",
    video: { type: "", url: "" },
    email: ""
  },
  
  // Contact links
  contactLinks: [],
  
  // Theme/colors
  theme: {
    accent: "#71904c",
    paper: "#e8e3da",
    patternEnabled: false,
    patternColor: "",
    patternScale: 1
  },
  
  // Filters for portfolio
  filters: [
    { value: "2d", label: "2D" },
    { value: "3d", label: "3D" },
    { value: "motion", label: "Motion" }
  ]
};

export const projects = [];

export const pageState = {
  currentPage: "global", // 'global', 'about', 'contact', 'project'
  currentProjectId: null,
  isEditMode: false
};

export const uiState = {
  cursorElement: null,
  renderedPages: new Set(), // tracks which pages have been rendered
  openBlocks: new Set(),    // expanded block editors
  dirtyFiles: new Set()     // files needing save
};

/**
 * Undo/Redo History
 */
export const history = {
  states: [],
  currentIndex: -1,
  maxSize: 50
};

/**
 * Utility to create a snapshot of current state
 */
export function createSnapshot() {
  return {
    globalState: JSON.parse(JSON.stringify(globalState)),
    projects: JSON.parse(JSON.stringify(projects)),
    pageState: JSON.parse(JSON.stringify(pageState))
  };
}

/**
 * Utility to restore state from snapshot
 */
export function restoreSnapshot(snapshot) {
  Object.assign(globalState, snapshot.globalState);
  projects.length = 0;
  projects.push(...snapshot.projects);
  Object.assign(pageState, snapshot.pageState);
}

/**
 * Initialize cursor element reference
 */
export function initCursor() {
  uiState.cursorElement = document.getElementById("cur");
  if (!uiState.cursorElement) {
    console.warn("Cursor element (#cur) not found in DOM");
  }
}
