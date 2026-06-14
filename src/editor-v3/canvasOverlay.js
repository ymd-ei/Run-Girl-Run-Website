/**
 * Canvas Overlay — v3 Editor (runs INSIDE the site iframe)
 *
 * Loaded by src/display/main.js only when ?editor=v3 is present. Adds block-level
 * selection on top of the real rendered site:
 *   - each block gets edit-mode padding so there is a clickable margin around the
 *     content; clicking that margin selects the whole block (clicking the text
 *     itself still starts inline editing)
 *   - hover outline on each block
 *   - a "+" button in the GAP below a block to insert a new block after it
 *
 * Controls use position:fixed so they are never clipped by the panel's internal
 * scroll. Block actions (move / duplicate / delete / change type) live in the
 * editor's inspector, opened by selecting a block. Never mutates content.
 */

const BLOCK_TYPES = [
  { type: 'text-lg', label: 'Large Text' },
  { type: 'text-md', label: 'Body Text' },
  { type: 'text-sm', label: 'Small Text' },
  { type: 'quote', label: 'Quote' },
  { type: 'image', label: 'Image' },
  { type: 'gallery', label: 'Gallery' },
  { type: 'video', label: 'Video' },
  { type: 'beforeafter', label: 'Before / After' },
  { type: 'alpha-art', label: 'Alpha Art' },
  { type: 'twocol', label: 'Two Columns' },
  { type: 'stats', label: 'Stats' },
  { type: 'skills', label: 'Skills' },
  { type: 'process', label: 'Process' },
  { type: 'faq', label: 'FAQ' },
  { type: 'callout', label: 'Callout' },
  { type: 'cta', label: 'CTA Banner' },
  { type: 'divider', label: 'Divider' }
];

let insertBtn = null, typeMenu = null;
let hoverBlock = null;     // block the insert control is anchored to
let selectedBlock = null;  // block currently selected (inspector open)
let hideTimer = null;

function send(type, payload) {
  window.parent.postMessage({ type, payload }, location.origin);
}

function blockInfo(el) {
  return {
    scope: el.getAttribute('data-canvas-scope') || '',
    blockId: el.getAttribute('data-canvas-block-id') || '',
    blockType: el.getAttribute('data-canvas-block-type') || '',
    projectId: el.getAttribute('data-canvas-project-id') || ''
  };
}

function injectStyles() {
  if (document.getElementById('cv-overlay-style')) return;
  const s = document.createElement('style');
  s.id = 'cv-overlay-style';
  s.textContent = `
    /* The public site hides the cursor globally (*{cursor:none!important}) with
       no custom cursor on these panels. In edit mode that leaves the canvas with
       no visible pointer, so restore sensible cursors (scoped to edit mode only,
       never affecting normal visitors). */
    body.canvas-edit-enabled, body.canvas-edit-enabled * { cursor: default !important; }
    body.canvas-edit-enabled [data-canvas-editable="true"],
    body.canvas-edit-enabled [contenteditable="true"] { cursor: text !important; }
    body.canvas-edit-enabled a,
    body.canvas-edit-enabled button,
    body.canvas-edit-enabled .cv-block,
    body.canvas-edit-enabled .bl-faq-trigger,
    body.canvas-edit-enabled .bl-before-after-handle { cursor: pointer !important; }

    /* Clickable selection padding around each block. The padding is the "click to
       select" target; the inner content keeps its inline-edit behaviour. */
    body.canvas-edit-enabled .cv-block {
      position: relative; border-radius: 6px; padding: 10px 12px;
      transition: box-shadow .1s, background-color .1s;
    }
    body.canvas-edit-enabled .cv-block.cv-hover { box-shadow: 0 0 0 1.5px rgba(125,82,255,.4); background: rgba(125,82,255,.04); }
    body.canvas-edit-enabled .cv-block.cv-selected { box-shadow: 0 0 0 2px #7d52ff; background: rgba(125,82,255,.06); }

    #cv-insert {
      position: fixed; z-index: 2147483000;
      display: none; align-items: center; justify-content: center;
      width: 24px; height: 24px; font-size: 16px; font-weight: 600;
      background: #5e30eb; color: #fff; border: 1px solid #5e30eb; border-radius: 50%;
      box-shadow: 0 4px 14px rgba(0,0,0,.45); user-select: none;
      font-family: 'DM Sans', system-ui, sans-serif;
    }
    #cv-insert.show { display: inline-flex; }
    #cv-insert:hover { background: #7d52ff; transform: scale(1.08); }

    #cv-typemenu {
      position: fixed; z-index: 2147483001; display: none;
      background: #17171c; border: 1px solid #2a2a33; border-radius: 9px;
      box-shadow: 0 12px 34px rgba(0,0,0,.55); padding: 5px;
      max-height: 320px; overflow-y: auto; width: 172px;
      font-family: 'DM Sans', system-ui, sans-serif;
    }
    #cv-typemenu.show { display: block; }
    #cv-typemenu .cv-tm-head { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #8a8a96; padding: 6px 8px 4px; }
    #cv-typemenu button {
      width: 100%; text-align: left; background: transparent; border: 0;
      color: #e9e9ef; padding: 7px 9px; border-radius: 6px; font-size: 12.5px;
    }
    #cv-typemenu button:hover { background: #2a2a33; }

    /* Win over the broad 'body.canvas-edit-enabled *' cursor reset above. */
    body.canvas-edit-enabled #cv-insert,
    body.canvas-edit-enabled #cv-typemenu,
    body.canvas-edit-enabled #cv-typemenu button { cursor: pointer !important; }
  `;
  document.head.appendChild(s);
}

function build() {
  insertBtn = document.createElement('div');
  insertBtn.id = 'cv-insert';
  insertBtn.title = 'Insert a block here';
  insertBtn.textContent = '+';
  document.body.appendChild(insertBtn);

  typeMenu = document.createElement('div');
  typeMenu.id = 'cv-typemenu';
  typeMenu.innerHTML = `<div class="cv-tm-head">Insert block</div>` +
    BLOCK_TYPES.map(t => `<button data-type="${t.type}">${t.label}</button>`).join('');
  document.body.appendChild(typeMenu);

  [insertBtn, typeMenu].forEach(el => {
    el.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    el.addEventListener('mousedown', e => e.preventDefault());
  });

  insertBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!hoverBlock) return;
    const r = insertBtn.getBoundingClientRect();
    typeMenu.style.left = Math.min(r.left, window.innerWidth - 184) + 'px';
    typeMenu.style.top = (r.bottom + 4) + 'px';
    typeMenu.classList.add('show');
  });

  typeMenu.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn || !hoverBlock) return;
    e.stopPropagation();
    const info = blockInfo(hoverBlock);
    send('canvas-action', { op: 'add', blockType: btn.getAttribute('data-type'), afterBlockId: info.blockId, scope: info.scope, projectId: info.projectId });
    closeTypeMenu();
  });
}

function closeTypeMenu() { typeMenu && typeMenu.classList.remove('show'); }

function positionInsert() {
  if (!hoverBlock) return;
  const r = hoverBlock.getBoundingClientRect();
  insertBtn.style.left = (r.left + r.width / 2 - 12) + 'px';
  insertBtn.style.top = (r.bottom - 4) + 'px';
}

function showControls(block) {
  clearTimeout(hideTimer);
  if (hoverBlock && hoverBlock !== block) hoverBlock.classList.remove('cv-hover');
  hoverBlock = block;
  block.classList.add('cv-hover');
  insertBtn.classList.add('show');
  positionInsert();
}

function hideControls() {
  if (hoverBlock) hoverBlock.classList.remove('cv-hover');
  hoverBlock = null;
  insertBtn.classList.remove('show');
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (typeMenu.classList.contains('show')) return;
    const over = el => el && el.matches(':hover');
    if (over(hoverBlock) || over(insertBtn)) return;
    hideControls();
  }, 160);
}

function selectBlock(block) {
  if (selectedBlock) selectedBlock.classList.remove('cv-selected');
  selectedBlock = block;
  block.classList.add('cv-selected');
  send('canvas-select-block', blockInfo(block));
}

export function initCanvasOverlay() {
  injectStyles();
  build();

  document.addEventListener('mouseover', e => {
    if (!document.body.classList.contains('canvas-edit-enabled')) return;
    const block = e.target.closest('.cv-block');
    if (block) showControls(block);
  });
  document.addEventListener('mouseout', e => {
    if (!hoverBlock) return;
    const to = e.relatedTarget;
    if (to && (hoverBlock.contains(to) || insertBtn.contains(to) || typeMenu.contains(to))) return;
    scheduleHide();
  });

  // Click selects the block — unless the click landed on the inline-editable text
  // (which starts editing) or an interactive element. Clicking the block's
  // padding / any non-text area selects it.
  document.addEventListener('click', e => {
    if (!document.body.classList.contains('canvas-edit-enabled')) return;
    if (e.target.closest('#cv-insert, #cv-typemenu')) return;
    if (e.target.closest('[data-canvas-editable="true"]')) return;
    if (e.target.closest('a, button, input, textarea, video, .bl-faq-trigger, .bl-before-after-handle')) return;
    const block = e.target.closest('.cv-block');
    if (block) selectBlock(block);
  }, true);

  document.addEventListener('click', e => {
    if (!e.target.closest('#cv-typemenu, #cv-insert')) closeTypeMenu();
  });

  document.addEventListener('scroll', () => { if (hoverBlock) positionInsert(); }, true);
  window.addEventListener('resize', () => { if (hoverBlock) positionInsert(); closeTypeMenu(); });
}
