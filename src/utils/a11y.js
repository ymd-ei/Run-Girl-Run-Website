/**
 * Accessibility helpers for the display site: reduced motion, keyboard-
 * operable cards, and dialog behaviour for the panels.
 *
 * The panels open and close by toggling an `open` class from many places in
 * main.js, so the dialog handling watches that class instead of hooking every
 * call site: a closed panel is `inert` (its offscreen contents leave the tab
 * order), an opened one takes focus, and closing it hands focus back to
 * whatever opened it.
 */

/** True when the visitor has asked their system for less motion. */
export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Topmost first: when two are open (a project over Work), the first one wins.
const DIALOGS = ['legal-modal', 'lightbox', 'pp', 'contact-wrapper', 'panel-about', 'panel-work'];
// Controls that sit outside a dialog's element but belong to it
const EXTRAS = { 'contact-wrapper': ['ct-close'] };

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,iframe,video[controls],[tabindex]:not([tabindex="-1"])';

const returnTo = new Map(); // dialog -> element focused before it opened

// Inside the editor's preview iframe, moving focus would pull it out of the editor's own fields
const embedded = window.parent !== window;

const isOpen = el => el.classList.contains('open');
const openDialogs = () => DIALOGS.map(id => document.getElementById(id)).filter(el => el && isOpen(el));
const parts = d => [...(EXTRAS[d.id] || []).map(id => document.getElementById(id)).filter(Boolean), d];
const usable = el => el && el.isConnected && el !== document.body && !el.closest('[inert]') && el.getClientRects().length > 0;
const lostFocus = () => {
  const a = document.activeElement;
  return !a || a === document.body || !!a.closest('[inert]');
};

function setInert(d, inert) {
  parts(d).forEach(el => { el.inert = inert; });
}

function labelProjectPanel(d) {
  const title = d.querySelector('.pp-hero-title');
  // textContent, not innerText (which follows text-transform); the <br> splits words
  const text = title ? [...title.childNodes].map(n => (n.nodeName === 'BR' ? ' ' : n.textContent)).join('').replace(/\s+/g, ' ').trim() : '';
  d.setAttribute('aria-label', text || 'Project');
}

function onOpen(d) {
  setInert(d, false);
  const from = document.activeElement;
  if (from && from !== document.body && !d.contains(from)) returnTo.set(d, from);
  if (d.id === 'pp') labelProjectPanel(d);
  if (!embedded) d.focus({ preventScroll: true });
}

function onClose(d) {
  setInert(d, true);
  const back = returnTo.get(d);
  returnTo.delete(d);
  if (embedded) return;
  if (!lostFocus() && !d.contains(document.activeElement)) return;
  if (usable(back)) back.focus({ preventScroll: true });
}

function trapTab(e) {
  if (e.key !== 'Tab') return;
  const top = openDialogs()[0];
  if (!top) return;
  const items = parts(top).flatMap(el => [...(el.matches(FOCUSABLE) ? [el] : []), ...el.querySelectorAll(FOCUSABLE)])
    .filter(usable);
  if (!items.length) { e.preventDefault(); return; }
  const first = items[0], last = items[items.length - 1];
  const a = document.activeElement;
  const inside = parts(top).some(el => el.contains(a));
  if (e.shiftKey && (!inside || a === first || a === top)) { e.preventDefault(); last.focus(); }
  // From the dialog itself (just opened), go to its first control, even one outside it (contact ✕)
  else if (!e.shiftKey && (!inside || a === last || a === top)) { e.preventDefault(); first.focus(); }
}

/** Enter or Space on a non-button element with role="button" (Work cards) clicks it. */
function activateRoleButton(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target;
  if (!(el instanceof Element) || el.tagName === 'BUTTON' || el.getAttribute('role') !== 'button') return;
  e.preventDefault();
  el.click();
}

export function initA11y() {
  const watched = DIALOGS.map(id => document.getElementById(id)).filter(Boolean);
  watched.forEach(d => {
    if (!d.hasAttribute('tabindex')) d.tabIndex = -1;
    setInert(d, !isOpen(d));
    d._wasOpen = isOpen(d);
  });
  const mo = new MutationObserver(records => {
    const changed = new Set(records.map(r => r.target));
    const closed = [];
    changed.forEach(d => {
      const now = isOpen(d);
      if (now === d._wasOpen) return;
      d._wasOpen = now;
      if (now) onOpen(d); else closed.push(d);
    });
    // Close the topmost first so focus walks back down the stack
    closed.sort((a, b) => DIALOGS.indexOf(a.id) - DIALOGS.indexOf(b.id)).forEach(onClose);
    if (closed.length && lostFocus() && !embedded) openDialogs()[0]?.focus({ preventScroll: true });
  });
  watched.forEach(d => mo.observe(d, { attributes: true, attributeFilter: ['class'] }));
  document.addEventListener('keydown', trapTab);
  document.addEventListener('keydown', activateRoleButton);
}
