/**
 * Views inside the card (linkCard.js): Privacy & Legal on /links; on the phone
 * home page (mobile.html) also Work, About, projects and posts, driven by mobile.js.
 *
 * Nothing new appears: the card grows to the screen with the /links card's timing
 * (linkCard.js), its home steps aside and the view comes in. Pull a Work or About
 * button up and the card grows under the finger; pull the view down (from its top
 * bar, or from the content once it's scrolled to its top) and it shrinks under the
 * finger. Past a third of the way, or a flick, it carries on; otherwise it settles
 * back — the same release as the card's turn. In a project or post, the pull down
 * is Back. Each view is a history entry, so the phone's Back steps out one level.
 */
import { $ } from './linkCard.js';

const START = 6;               // px of pull before the card starts to follow
const FLICK = 0.5;             // px per ms: a flick carries on whatever the distance

let renderView = null, card = null;
let current = null;            // { sheet, project?, post? } on show, or null
let depth = 0;                 // history entries pushed since the card opened
let opener = null;             // focus returns here when the card closes
let timedNext = false;         // the next open/close carries on from a finger

/** Called by mobile.js with its view renderer (same as the live panels). */
export function initSheet(render) {
  renderView = render;
  // A reload while a view was up keeps its history entry; start clean
  if (history.state && history.state.sheet) history.replaceState(null, '');
  addEventListener('popstate', e => {
    const view = e.state && e.state.sheet ? e.state : null;
    depth = view ? view.depth : 0;
    show(view);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && current) closeSheet(); });
}

/** Called by the page once the card is set up. */
export function useCard(c) {
  card = c;
  $('card-view-back').addEventListener('click', () => history.back());
  $('card-view-close').addEventListener('click', closeSheet);
  bindPullDown();
}

/** Open a view: { sheet: 'work' | 'about' | 'legal', project?, post? } */
export function openView(view) {
  if (!current) opener = document.activeElement;
  depth++;
  view = { ...view, depth };
  history.pushState(view, '');
  show(view);
}

/** Re-render Work's grid in place (once posts arrive); never a project being read. */
export function refreshView(name) {
  if (current && current.sheet === name && !current.project && !current.post) {
    const body = $('sheet-body'), top = body.scrollTop;
    paint(current);
    body.scrollTop = top;
  }
}

export function closeSheet() {
  if (depth > 0) history.go(-depth);   // popstate lands on the page's own entry and closes it
  else show(null);
}

function show(view) {
  const timed = timedNext; timedNext = false;
  if (!view) {
    current = null;
    card.setOpen(false, { timed });
    $('card-view').inert = true;
    if (opener && opener.focus) opener.focus({ preventScroll: true });
    opener = null;
    return;
  }
  const same = current && current.sheet === view.sheet && current.project === view.project && current.post === view.post;
  if (!same) paint(view, !!current);
  if (!card.isOpen()) card.setOpen(true, { timed });
  else if (timed) card.setOpen(true, { timed });      // a pull that let go: settle back to full
  $('card-view').inert = false;
}

// Fill the card's view; `swap` slides it in when moving between views
function paint(view, swap = false) {
  // Privacy & Legal: siteChrome.js's text, with its own heading as the card's title
  const out = view.sheet === 'legal'
    ? { title: $('legal-title')?.textContent || 'Privacy & Legal', html: $('legal-card').innerHTML }
    : renderView(view);
  current = { sheet: view.sheet, project: view.project, post: view.post };
  $('card-view-title').textContent = out.title || '';
  $('card-view-back').hidden = !out.back;
  const body = $('sheet-body');
  body.innerHTML = out.html;
  body.querySelectorAll('.legal-close, h2#legal-title').forEach(el => el.remove());
  body.scrollTop = 0;
  if (out.after) out.after(body);
  if (swap) {
    body.classList.remove('swap');
    void body.offsetWidth;
    body.classList.add('swap');
  }
}

// How far a finger travels for the whole change: half the screen. The card itself
// only grows a little on a phone, so its content moves with the finger too.
const travel = () => card.heights().screen * 0.5;

// ── Pull a button up: the card grows and its view comes in under the finger ──
export function pullUp(el, view) {
  let x0 = 0, y0 = 0, t0 = 0, pull = 0, on = false, pulledAt = 0;
  // a pull isn't also a tap
  el.addEventListener('click', e => { if (performance.now() - pulledAt < 400) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || current || card.isFlipped()) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = e.timeStamp; pull = 0; on = false;
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (!y0) return;
    const dy = y0 - e.touches[0].clientY, dx = e.touches[0].clientX - x0;
    if (!on) {
      if (Math.abs(dx) > Math.abs(dy) || dy < -START) { if (Math.max(Math.abs(dx), Math.abs(dy)) > START) y0 = 0; return; }   // sideways turns the card
      if (dy < START) return;
      on = true;
      opener = el;
      paint(view);                                                    // built now, so it comes in under the finger
    }
    e.preventDefault();
    pull = Math.max(0, dy - START);
    card.follow(pull / travel());
  }, { passive: false });
  const end = e => {
    if (!y0) return;
    y0 = 0;
    if (!on) return;
    on = false;
    const total = travel();
    const go = pull > total / 3 || (pull > 24 && pull / (e.timeStamp - t0) > FLICK);
    card.settle(pull, total, go);
    timedNext = true;
    pulledAt = performance.now();
    if (go) openView(view);
    else { current = null; show(null); }
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}

// ── Pull the view down: the card shrinks and the home comes back under the finger.
// In a project or post the content moves instead, and letting go past the line is Back.
function bindPullDown() {
  const viewEl = $('card-view'), body = $('sheet-body');
  let y0 = 0, t0 = 0, pull = 0, on = false, fromHead = false, inner = false;
  viewEl.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || !current) return;
    y0 = e.touches[0].clientY; t0 = e.timeStamp; pull = 0; on = false;
    fromHead = !!e.target.closest('.card-view-head');
  }, { passive: true });
  viewEl.addEventListener('touchmove', e => {
    if (!y0) return;
    const dy = e.touches[0].clientY - y0;
    if (!on) {
      if (dy > START && (fromHead || body.scrollTop <= 0)) { on = true; inner = !!(current.project || current.post); }
      else if (Math.abs(dy) > START) { y0 = 0; return; }        // a normal scroll
      else return;
    }
    e.preventDefault();
    pull = Math.max(0, dy - START);
    const p = Math.min(1, pull / travel());
    if (inner) { body.style.transition = 'none'; body.style.transform = `translateY(${pull}px)`; body.style.opacity = 1 - p * .6; }
    else card.follow(1 - p);
  }, { passive: false });
  const end = e => {
    if (!y0) return;
    y0 = 0;
    if (!on) return;
    on = false;
    const total = travel();
    const go = pull > total / 3 || (pull > 24 && pull / (e.timeStamp - t0) > FLICK);
    if (inner) {
      // the same release, on the content
      const done = Math.min(1, pull / total);
      body.style.transition = `transform ${(0.15 + 0.5 * done).toFixed(2)}s cubic-bezier(.2,.75,.3,1),opacity .2s`;
      body.style.transform = body.style.opacity = '';
      setTimeout(() => (body.style.transition = ''), 700);
      if (go) history.back();
      return;
    }
    card.settle(pull, total, go);
    timedNext = true;
    if (!go) return show(current);                                // settles back to full
    closeSheet();
  };
  viewEl.addEventListener('touchend', end);
  viewEl.addEventListener('touchcancel', end);
}
