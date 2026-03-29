/**
 * Undo/Redo History Management
 * Manages state snapshots and navigation through history
 * Refactored to accept state as parameter (no global dependencies)
 */

/**
 * History manager for undo/redo
 * @param {Object} maxSize - Maximum snapshots to store (default: 50)
 */
export class HistoryManager {
  constructor(maxSize = 50) {
    this.states = [];
    this.currentIndex = -1;
    this.maxSize = maxSize;
  }

  /**
   * Create a snapshot of current state
   * @param {Object} state - Current state object {globalState, projects, pageState}
   * @param {string} label - Label for this snapshot (for debugging)
   */
  snapshot(state, label = '') {
    // Trim any future states if we branched (user made new change after undo)
    this.states = this.states.slice(0, this.currentIndex + 1);

    // Create immutable copy
    const stateSnapshot = {
      label,
      globalState: JSON.parse(JSON.stringify(state.globalState)),
      projects: JSON.parse(JSON.stringify(state.projects)),
      pageState: JSON.parse(JSON.stringify(state.pageState))
    };

    this.states.push(stateSnapshot);

    // Trim old snapshots if exceeding max size
    if (this.states.length > this.maxSize) {
      this.states.shift();
    } else {
      this.currentIndex++;
    }
  }

  /**
   * Undo to previous state
   * @returns {Object} Previous state snapshot, or null if at beginning
   */
  undo() {
    if (this.currentIndex <= 0) return null;
    this.currentIndex--;
    return this.states[this.currentIndex];
  }

  /**
   * Redo to next state
   * @returns {Object} Next state snapshot, or null if at end
   */
  redo() {
    if (this.currentIndex >= this.states.length - 1) return null;
    this.currentIndex++;
    return this.states[this.currentIndex];
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.currentIndex < this.states.length - 1;
  }

  /**
   * Get label of current snapshot (for UI display)
   * @returns {string} Label or empty string
   */
  getCurrentLabel() {
    if (this.currentIndex < 0 || this.currentIndex >= this.states.length) {
      return '';
    }
    return this.states[this.currentIndex].label || '';
  }

  /**
   * Get total number of snapshots
   * @returns {number}
   */
  getSize() {
    return this.states.length;
  }

  /**
   * Clear all history
   */
  clear() {
    this.states = [];
    this.currentIndex = -1;
  }
}

/**
 * Restore state object from snapshot
 * Mutates the state objects in place
 * @param {Object} state - State object to mutate
 * @param {Object} snapshot - Snapshot from history
 */
export function restoreStateFromSnapshot(state, snapshot) {
  if (!snapshot) return;

  // Copy snapshot values back into state objects
  Object.assign(state.globalState, snapshot.globalState);

  // Replace projects array
  state.projects.length = 0;
  state.projects.push(...snapshot.projects);

  // Restore page state
  Object.assign(state.pageState, snapshot.pageState);
}

/**
 * Create immutable copy of state for storage
 * @param {Object} state - State object to snapshot
 * @returns {Object} Immutable snapshot
 */
export function createStateSnapshot(state) {
  return {
    globalState: JSON.parse(JSON.stringify(state.globalState)),
    projects: JSON.parse(JSON.stringify(state.projects)),
    pageState: JSON.parse(JSON.stringify(state.pageState))
  };
}
