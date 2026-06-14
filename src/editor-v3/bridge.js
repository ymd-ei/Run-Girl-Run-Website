/**
 * Bridge — v3 Editor (parent side)
 *
 * Drives the real site running inside an iframe via postMessage. The site side
 * lives in src/display/main.js (setupEditorPreviewBridge / canvas edit handlers).
 *
 * Outgoing (parent -> iframe):
 *   preview-data       { content, projects }   push full state, iframe re-renders
 *   preview-nav        { panel, projectId }     navigate to home/about/contact/project
 *   canvas-edit-mode   { enabled }              toggle edit chrome (body.canvas-edit-enabled)
 *   canvas-structure   { op, scope, blockId, projectId, payload }   re-render hook (future)
 *
 * Incoming (iframe -> parent):
 *   preview-ready                               iframe booted, ready for data
 *   canvas-start-edit  { payload }              user began inline editing an element
 *   canvas-commit-edit { payload:{...,value} }  inline edit committed
 *   canvas-cancel-edit { payload }              inline edit cancelled
 *   canvas-select-block{ payload }              user selected a whole block (new)
 *   canvas-action      { payload }              block toolbar action (new)
 */

let frameEl = null;
let handlers = {};
let ready = false;
const pendingOutbound = [];

function post(message) {
  if (!frameEl || !frameEl.contentWindow) return;
  // Queue data/nav until the iframe announces readiness; edit-mode can flush after.
  frameEl.contentWindow.postMessage(message, location.origin);
}

/**
 * Initialize the bridge against an iframe element.
 * @param {HTMLIFrameElement} iframe
 * @param {Object} h - handler callbacks:
 *   onReady, onStartEdit, onCommitEdit, onCancelEdit, onSelectBlock, onAction
 */
export function initBridge(iframe, h = {}) {
  frameEl = iframe;
  handlers = h;
  ready = false;

  window.addEventListener('message', e => {
    if (e.origin !== location.origin) return;
    const data = e.data || {};
    switch (data.type) {
      case 'preview-ready':
        ready = true;
        flushPending();
        handlers.onReady && handlers.onReady();
        break;
      case 'canvas-start-edit':
        handlers.onStartEdit && handlers.onStartEdit(data.payload);
        break;
      case 'canvas-commit-edit':
        handlers.onCommitEdit && handlers.onCommitEdit(data.payload);
        break;
      case 'canvas-cancel-edit':
        handlers.onCancelEdit && handlers.onCancelEdit(data.payload);
        break;
      case 'canvas-select-block':
        handlers.onSelectBlock && handlers.onSelectBlock(data.payload);
        break;
      case 'canvas-action':
        handlers.onAction && handlers.onAction(data.payload);
        break;
    }
  });
}

function flushPending() {
  while (pendingOutbound.length) {
    post(pendingOutbound.shift());
  }
}

function sendOrQueue(message) {
  if (ready) post(message);
  else pendingOutbound.push(message);
}

export function isReady() {
  return ready;
}

/** Push the full editor state into the iframe so it re-renders. */
export function pushData(content, projects) {
  sendOrQueue({ type: 'preview-data', content, projects });
}

/** Navigate the iframe to a panel: 'home' | 'about' | 'contact' | 'project'. */
export function navigate(panel, projectId) {
  sendOrQueue({ type: 'preview-nav', panel, projectId });
}

/** Toggle in-place edit mode (hover/selection chrome) inside the iframe. */
export function setEditMode(enabled) {
  sendOrQueue({ type: 'canvas-edit-mode', enabled: !!enabled });
}

/** Ask the iframe to re-render after a structural change (selection-preserving). */
export function sendStructure(op, info = {}) {
  sendOrQueue({ type: 'canvas-structure', op, ...info });
}
