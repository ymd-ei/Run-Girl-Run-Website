/**
 * Floating Toolbar — v2 Editor
 * Appears above text blocks on double-click for inline contenteditable editing.
 * Bold, italic, underline, link, alignment controls.
 */

let toolbarEl = null;
let activeElement = null;
let originalContent = '';
let onCommitCallback = null;

/**
 * Initialize the floating toolbar.
 * @param {Function} onCommit - Called with (scope, blockId, field, value) when editing is committed.
 */
export function initToolbar(onCommit) {
  onCommitCallback = onCommit;
  createToolbarDOM();
  bindGlobalEvents();
}

function createToolbarDOM() {
  if (document.getElementById('v2-float-toolbar')) return;

  const bar = document.createElement('div');
  bar.id = 'v2-float-toolbar';
  bar.className = 'v2-float-toolbar';
  bar.innerHTML = `
    <button data-cmd="bold" title="Bold"><b>B</b></button>
    <button data-cmd="italic" title="Italic"><i>I</i></button>
    <button data-cmd="underline" title="Underline"><u>U</u></button>
    <button data-cmd="rgr" title="RGR Badge" class="v2-ft-rgr">RGR</button>
    <span class="v2-ft-sep"></span>
    <button data-cmd="align-left" title="Align Left">&#x21E4;</button>
    <button data-cmd="align-center" title="Center">&#x21D4;</button>
    <button data-cmd="align-right" title="Align Right">&#x21E5;</button>
    <span class="v2-ft-sep"></span>
    <button data-cmd="done" title="Done (Enter)">&#x2713;</button>
    <button data-cmd="cancel" title="Cancel (Esc)">&#x2715;</button>
  `;
  document.body.appendChild(bar);
  toolbarEl = bar;

  bar.addEventListener('mousedown', e => {
    // Prevent toolbar clicks from stealing focus from contenteditable
    e.preventDefault();
  });

  bar.addEventListener('click', e => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    handleCommand(btn.dataset.cmd);
  });
}

function handleCommand(cmd) {
  if (!activeElement) return;

  switch (cmd) {
    case 'bold':
      document.execCommand('bold', false);
      break;
    case 'italic':
      document.execCommand('italic', false);
      break;
    case 'underline':
      document.execCommand('underline', false);
      break;
    case 'rgr': {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) break;
      const range = sel.getRangeAt(0);
      // Check if already inside an <rgr> — if so, unwrap
      const parentRgr = sel.anchorNode.parentElement?.closest('rgr');
      if (parentRgr) {
        const frag = document.createDocumentFragment();
        while (parentRgr.firstChild) frag.appendChild(parentRgr.firstChild);
        parentRgr.replaceWith(frag);
      } else {
        const badge = document.createElement('rgr');
        badge.appendChild(range.extractContents());
        range.insertNode(badge);
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(badge);
        sel.addRange(newRange);
      }
      break;
    }
    case 'align-left':
    case 'align-center':
    case 'align-right': {
      const align = cmd.replace('align-', '');
      // Update the block data via callback
      const scope = activeElement.getAttribute('data-canvas-scope');
      const blockId = activeElement.getAttribute('data-canvas-block-id');
      if (scope && blockId && onCommitCallback) {
        onCommitCallback(scope, blockId, 'align', align);
      }
      // Visually apply alignment
      activeElement.classList.remove('ac', 'ar');
      if (align === 'center') activeElement.classList.add('ac');
      if (align === 'right') activeElement.classList.add('ar');
      break;
    }
    case 'done':
      finishEdit(true);
      break;
    case 'cancel':
      finishEdit(false);
      break;
  }
}

/**
 * Start inline editing on a text element
 */
export function startEdit(el) {
  if (activeElement === el) return;
  if (activeElement) finishEdit(true);

  if (!el) return;

  activeElement = el;
  originalContent = el.innerHTML;

  el.setAttribute('contenteditable', 'true');
  el.setAttribute('spellcheck', 'false');
  el.classList.add('v2-inline-editing');
  el.focus();

  // Place cursor at end
  const sel = window.getSelection();
  if (sel) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  positionToolbar(el);
  showToolbar();
}

/**
 * End inline editing
 */
export function finishEdit(commit) {
  if (!activeElement) return;

  const el = activeElement;
  const scope = el.getAttribute('data-canvas-scope');
  const blockId = el.getAttribute('data-canvas-block-id');
  const field = el.getAttribute('data-canvas-field');

  if (commit && scope && blockId && field && onCommitCallback) {
    const value = el.innerHTML.trim();
    onCommitCallback(scope, blockId, field, value);
  } else if (!commit) {
    el.innerHTML = originalContent;
  }

  el.removeAttribute('contenteditable');
  el.removeAttribute('spellcheck');
  el.classList.remove('v2-inline-editing');

  activeElement = null;
  originalContent = '';
  hideToolbar();
}

export function isEditing() {
  return activeElement !== null;
}

// ── Toolbar positioning ──

function positionToolbar(el) {
  if (!toolbarEl || !el) return;

  const rect = el.getBoundingClientRect();
  const tbHeight = toolbarEl.offsetHeight || 36;
  const gap = 8;

  let top = rect.top - tbHeight - gap;
  if (top < 4) top = rect.bottom + gap;

  toolbarEl.style.top = top + 'px';
  toolbarEl.style.left = Math.max(4, rect.left) + 'px';
}

function showToolbar() {
  if (toolbarEl) toolbarEl.classList.add('visible');
}

function hideToolbar() {
  if (toolbarEl) toolbarEl.classList.remove('visible');
}

// ── Global event handlers ──

function bindGlobalEvents() {
  document.addEventListener('keydown', e => {
    if (!activeElement) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finishEdit(false);
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      finishEdit(true);
    }
  });

  // Click outside the active element → commit
  document.addEventListener('mousedown', e => {
    if (!activeElement) return;
    if (activeElement.contains(e.target)) return;
    if (toolbarEl && toolbarEl.contains(e.target)) return;
    finishEdit(true);
  });
}
