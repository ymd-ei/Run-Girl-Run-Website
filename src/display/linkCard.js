/**
 * The card: /links, and the phone home page. One set of code for both — the
 * front's pieces (name, reel, rows, icons, email), the frosted reel behind, and
 * the card itself: it turns over to its back (tap the dog, swipe sideways,
 * Escape turns it back) and changes shape with one timing — the front's own
 * height, a square for the back, or the full screen when a view is open inside it.
 * Styles: styles-card.css. Markup: #flipper > #front.face.front > #front-in,
 * plus #back.face.back and the dog button #flip-open.
 */
import { stillVideos } from '../utils/lite.js';

const ROOT = new URL('../../', import.meta.url);
export const $ = id => document.getElementById(id);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const media = p => !p ? '' : /^(https?:|data:|\/)/.test(p) ? p : new URL(encodeURI(p), ROOT).href;
export const handle = url => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
export const GLIDE = 'cubic-bezier(.2,.75,.3,1)';   // after a drag: ease-out, carrying on from the finger

// Other sites (and newTab: a file like the résumé) open in their own tab
const elsewhere = url => /^https?:/.test(url) && new URL(url).origin !== location.origin;
export const row = ({ label, url, sub, icon, main, newTab }) => `
  <a class="link${main ? ' main' : ''}" href="${esc(url)}"${newTab || elsewhere(url) ? ' target="_blank" rel="noopener"' : ''}>
    <span class="ic"><i class="${icon}" aria-hidden="true"></i></span>
    <span class="tx"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
    <i class="go ph-fill ph-arrow-up-right" aria-hidden="true"></i>
  </a>`;

/** Name, role, place, availability and the dog. `person`: your name (Site settings →
    Studio identity) if set, with the studio joining the role; otherwise the studio name. */
export function renderTop(d, { person = false } = {}) {
  const studio = d.name || 'Run Girl Run';
  const p = (person && d.person) || {};
  const pFirst = (p.first || '').trim(), pLast = (p.last || '').trim();
  const named = !!(pFirst || pLast);
  const [first, ...rest] = named ? [pFirst || pLast, pFirst ? pLast : ''] : studio.split(' ');
  const last = rest.join(' ').trim();
  // your name sits on one line (it wraps only if it doesn't fit); the studio name keeps two
  $('name').innerHTML = `${esc(first)}${last ? `${named ? ' ' : '<br>'}<em>${esc(last)}</em>` : ''}`;
  $('role').textContent = named ? [d.role, studio].filter(Boolean).join(' · ') : d.role || '';
  $('where').textContent = d.location || '';
  const av = d.availability || {};
  $('avail').hidden = !av.enabled;
  document.querySelector('#avail span').textContent = av.text || '';
  if (d.logo && $('dog').getAttribute('src') !== media(d.logo)) $('dog').src = media(d.logo);   // the site's Logo setting
  return { named, studio, first: pFirst, last: pLast };
}

// ── Reel: a muted loop (the Preview clip if set, else the reel); tap = sound from
// the start. Lite mode, data-saver and reduced motion keep a still cover. Rebuilt
// only when the reel changes.
let reelKey = '';
export function renderReel(d) {
  const reel = (d.watchReel && d.watchReel.url) ? d.watchReel : d.reel || {};
  const key = JSON.stringify([reel.url, reel.preview, reel.poster, reel.type]);
  if (key === reelKey) return;
  reelKey = key;
  const box = $('reel');
  box.hidden = !(reel.url && (reel.type || 'video') === 'video');
  if (box.hidden) return;
  box.classList.remove('playing', 'still');
  box.innerHTML = `<video id="reel-video" playsinline></video>
    <button type="button" class="play" id="reel-play"><b><i class="ph-fill ph-play"></i></b> <span>Watch the reel</span> <span id="reel-len"></span></button>`;
  const v = $('reel-video');
  const preview = !stillVideos();
  if (reel.poster) v.poster = media(reel.poster);
  if (preview) {
    v.src = media(reel.preview || reel.url); v.muted = true; v.loop = true; v.autoplay = true; v.preload = 'auto';
    v.play().catch(() => {});
  } else {
    box.classList.add('still'); v.src = media(reel.url) + (reel.poster ? '' : '#t=4'); v.preload = 'metadata';
  }
  const len = el => { const s = Math.round(el.duration); if (s) $('reel-len').textContent = `· ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  if (!reel.preview) v.addEventListener('loadedmetadata', () => len(v));
  else { const m = document.createElement('video'); m.preload = 'metadata'; m.src = media(reel.url); m.addEventListener('loadedmetadata', () => len(m)); }
  $('reel-play').addEventListener('click', () => {
    box.classList.add('playing'); box.classList.remove('still');
    if (reel.preview || !v.muted) v.src = media(reel.url);
    v.muted = false; v.loop = false; v.currentTime = 0; v.controls = true;
    v.play().catch(() => {});
  });
}

/** Social icons as one row; the Instagram with "studio" in its label gets a tag. */
export const iconsHTML = links => links.map(l => {
  const studio = /studio/i.test(l.label || '');
  return `<a href="${esc(l.url)}" target="_blank" rel="noopener" aria-label="${esc(l.label || handle(l.url))}" title="${esc(l.label || '')} — ${esc(handle(l.url))}">` +
    `<i class="${l.icon}" aria-hidden="true"></i>${studio ? '<span class="tag" aria-hidden="true">studio</span>' : ''}</a>`;
}).join('');

// The clipboard API needs https; on plain http (a Wi-Fi preview) fall back to the old copy command
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
  const ta = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(ta);
  ta.select(); ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) {}
  ta.remove();
  return ok;
}

/** A button that copies the email, then says so. */
export const copyEmail = (email, label = 'Copy') => async e => {
  const btn = e.currentTarget;
  btn.textContent = await copyText(email) ? 'Copied' : 'Press & hold';   // last resort: hold the address to copy it
  setTimeout(() => (btn.textContent = label), 1600);
};

/** The dark email band. */
export function renderMail(email) {
  $('mail').hidden = !email;
  $('mail-link').href = 'mailto:' + email;
  $('mail-link').textContent = email;
  $('copy').onclick = copyEmail(email);
}

/** The hero reel, frosted, behind the whole page. True when it's there. */
export function initPageBg(d) {
  const reel = d.reel || {};
  const box = document.createElement('div'); box.className = 'page-bg'; box.setAttribute('aria-hidden', 'true');
  if (!stillVideos() && reel.url) {
    const v = Object.assign(document.createElement('video'), { muted: true, loop: true, autoplay: true, playsInline: true });
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.src = media(reel.url); box.append(v); v.play().catch(() => {});
  } else if (reel.poster) {
    box.innerHTML = `<img alt="" src="${esc(media(reel.poster))}">`;
  } else return false;
  document.body.prepend(box);
  document.body.classList.add('bg-video');
  return true;
}

/**
 * The card's shape and its turn.
 * @param {{ignore?: string, onFlip?: (toBack: boolean) => void}} opts
 *   ignore: where a swipe doesn't turn the card (popups, other gestures)
 * @returns {{setOpen, follow, settle, isOpen, isFlipped, height}}
 *   setOpen(on): grow to the screen for a view inside (or back to the front's height);
 *   follow(h): the card's height under a finger; settle(dist, total, go): time the
 *   move after the finger lets go — the same release the turn uses.
 */
export function initCard({ ignore = '#legal-modal', onFlip } = {}) {
  const flipper = $('flipper'), front = $('front'), frontIn = $('front-in'), back = $('back');
  const stage = flipper.parentElement;
  const screen = () => (window.visualViewport ? visualViewport.height : innerHeight) - 32;

  // Height: the front's own height, a square when flipped, the screen when open
  let flipped = false, open = false;
  const frontHeight = () => {
    const cs = getComputedStyle(front);
    return frontIn.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  };
  // The square: the card's full width, or the screen's height if that's shorter
  // (landscape phones)
  const side = () => Math.min(stage.offsetWidth, screen());
  // The front's content keeps its full width while the card narrows — the card crops it
  const lockFront = () => {
    const cs = getComputedStyle(front);
    const w = stage.offsetWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    frontIn.style.width = w + 'px';
    frontIn.style.marginLeft = `calc((100% - ${w}px) / 2)`;
  };
  const height = () => flipped ? side() : open ? screen() : frontHeight();
  const size = () => {
    lockFront();
    flipper.style.width = flipped ? side() + 'px' : '';
    flipper.style.height = height() + 'px';
  };
  new ResizeObserver(size).observe(frontIn);
  addEventListener('resize', size);
  if (window.visualViewport) visualViewport.addEventListener('resize', size);
  size();

  const setAngle = a => flipper.style.setProperty('--a', a + 'deg');
  // Which side faces the viewer: read from the card's real, mid-animation angle
  // (cos < 0 = past edge-on), so the swap lands exactly when the card is side-on
  const facing = backFacing => flipper.classList.toggle('back-facing', backFacing);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let watch = 0, fallback = 0;
  function followTurn() {
    cancelAnimationFrame(watch); clearTimeout(fallback);
    if (reduced.matches) return facing(flipped);                       // crossfade, no turn
    const until = performance.now() + 1200;
    const tick = () => {
      facing(new DOMMatrix(getComputedStyle(flipper).transform).m11 < 0);
      if (performance.now() < until) watch = requestAnimationFrame(tick); else facing(flipped);
    };
    tick();
    fallback = setTimeout(() => facing(flipped), 1300);                // if frames are paused
  }
  const timing = (t, ease) => { flipper.style.setProperty('--t', t); flipper.style.setProperty('--ease', ease); };
  // After a drag: carry on from where the finger let go, timed to the distance left
  const settle = (dist, total, go) => {
    const done = Math.min(1, dist / total);
    timing((0.15 + 0.5 * (go ? 1 - done : done)).toFixed(2) + 's', GLIDE);
  };
  // The card keeps turning the way it's pushed, so the angle just adds up in half
  // turns (0, 180, 360, -180…) — an odd number of half turns is the back
  let rest = 0;
  // Focus only moves when the keyboard did the flipping (Enter on the dog, Escape) —
  // moved after a tap or swipe, phones draw a focus ring on the dog
  function flip(to, dir = 1, byKeyboard = false) {
    if (to === flipped) return;
    flipped = to;
    rest += 180 * dir;
    flipper.classList.toggle('flipped', to);
    setAngle(rest);
    followTurn();
    size();
    front.inert = to; back.inert = !to;
    document.documentElement.classList.toggle('card-back', to);
    if (onFlip) onFlip(to);
    if (byKeyboard) (to ? back : $('flip-open')).focus({ preventScroll: true });
  }
  // Opening from further down the page: glide to the top first, then turn
  $('flip-open').addEventListener('click', e => {
    timing('', '');
    const kb = e.detail === 0;                                        // Enter/Space, not a tap
    if (scrollY < 4) return flip(true, 1, kb);
    scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => flip(true, 1, kb), 380);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && flipped) { timing('', ''); flip(false, 1, true); } });

  // Swipe sideways to turn the card, either way, on either side. It follows the
  // finger; past a third of the width (or a flick) it turns over. On the front only
  // a finger counts (a mouse drag there is for selecting text) and up/down still
  // scrolls; with the back up, anywhere on screen works, mouse too.
  let drag = null, dragged = false;
  addEventListener('pointerdown', e => {
    dragged = false;
    if (open || e.target.closest(ignore)) return;
    if (!flipped && (e.pointerType === 'mouse' || !e.target.closest('#front'))) return;
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, on: false };
  });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) { drag = null; return; }   // that's a scroll
      drag.on = true; dragged = true; flipper.classList.add('dragging');
    }
    drag.dx = dx;
    const a = rest + Math.max(-180, Math.min(180, dx / flipper.offsetWidth * 180));
    setAngle(a);
    if (!reduced.matches) facing(Math.cos(a * Math.PI / 180) < 0);
  });
  const release = () => {
    const d = drag; drag = null;
    if (!d || !d.on) return;
    flipper.classList.remove('dragging');
    setTimeout(() => (dragged = false), 60);                          // only the click right after
    const w = flipper.offsetWidth, dist = Math.abs(d.dx);
    const fast = dist / (performance.now() - d.t) > 0.5;              // a flick also counts
    const go = dist > w / 3 || (fast && dist > 24);
    settle(dist, w, go);
    if (go) flip(!flipped, Math.sign(d.dx)); else { setAngle(rest); followTurn(); }
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  // A swipe that started on a link shouldn't also open it
  addEventListener('click', e => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);

  return {
    /** Grow to the screen for a view inside the card, or back to the front's height. */
    setOpen(on, { timed = false } = {}) {
      if (!timed) timing('', '');
      flipper.classList.remove('dragging', 'pulling');
      open = on;
      flipper.classList.toggle('open', on);
      document.documentElement.classList.toggle('card-open', on);
      if (on && scrollY > 0) scrollTo({ top: 0 });
      size();
    },
    /** Under a finger, p from 0 (the front) to 1 (a view open): the card's height and
        the content between them follow it, with no transition. */
    follow(p) {
      p = Math.max(0, Math.min(1, p));
      flipper.classList.add('dragging', 'pulling');
      flipper.style.setProperty('--p', p);
      flipper.style.height = frontHeight() + (screen() - frontHeight()) * p + 'px';
    },
    settle, size,
    isOpen: () => open,
    isFlipped: () => flipped,
    heights: () => ({ front: frontHeight(), screen: screen() }),
  };
}
