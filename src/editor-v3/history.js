/**
 * Undo/Redo History — v3 Editor
 * Captures JSON snapshots of state on each mutation.
 * Provides undo/redo with state restoration.
 *
 * Independent copy of the v2 history module (v2 is being retired).
 */

const MAX_STACK = 50;

let undoStack = [];
let redoStack = [];
let onRestoreCallback = null;

/**
 * Initialize the history system.
 * @param {Function} onRestore - Called after undo/redo with the restored state snapshot.
 *   Signature: onRestore({ global, projects, projectCache })
 */
export function initHistory(onRestore) {
  onRestoreCallback = onRestore;
}

/**
 * Take a snapshot of the current state. Call this before each mutation.
 * @param {Object} state - The state object { global, projects, projectCache }
 */
export function pushState(state) {
  const snap = takeSnapshot(state);
  undoStack.push(snap);
  if (undoStack.length > MAX_STACK) undoStack.shift();
  redoStack = [];
  dispatchHistoryEvent();
}

/**
 * Undo: restore the previous state.
 */
export function undo(state) {
  if (undoStack.length === 0) return false;
  redoStack.push(takeSnapshot(state));
  const snap = undoStack.pop();
  restoreSnapshot(state, snap);
  dispatchHistoryEvent();
  return true;
}

/**
 * Redo: reapply the last undone state.
 */
export function redo(state) {
  if (redoStack.length === 0) return false;
  undoStack.push(takeSnapshot(state));
  const snap = redoStack.pop();
  restoreSnapshot(state, snap);
  dispatchHistoryEvent();
  return true;
}

export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }

function takeSnapshot(state) {
  return {
    global: JSON.stringify(state.global),
    projects: JSON.stringify(state.projects),
    projectCacheEntries: Array.from(state.projectCache.entries()).map(
      ([k, v]) => [k, JSON.stringify(v)]
    )
  };
}

function restoreSnapshot(state, snap) {
  state.global = JSON.parse(snap.global);
  state.projects = JSON.parse(snap.projects);
  state.projectCache.clear();
  for (const [k, v] of snap.projectCacheEntries) {
    state.projectCache.set(k, JSON.parse(v));
  }
  if (onRestoreCallback) onRestoreCallback(state);
}

function dispatchHistoryEvent() {
  window.dispatchEvent(new CustomEvent('v3-history', {
    detail: { canUndo: canUndo(), canRedo: canRedo() }
  }));
}
