/**
 * Screens that slide — the app parts shared by the phone page (mobile.js) and
 * /links. A screen comes in from the right over whatever it was opened from,
 * which stays as it was underneath (a quarter to the left, dimmed) and comes back
 * as the screen leaves. A swipe to the right drags the screen away under the
 * finger. Each page keeps its own history and decides what is on top; this file
 * only builds the screens and moves them. Styles: styles-screens.css.
 */

export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const SLIDE = 420;
export const EASE = 'cubic-bezier(.32,.72,0,1)';
export const GLIDE = 'cubic-bezier(.2,.75,.3,1)';   // after a drag: ease-out, carrying on from the finger
let seq = 0;

// p: 0 = the top screen fully in, 1 = fully off to the right
function place(top, under, p, ms = 0, ease = EASE) {
  if (calm()) ms = 0;
  top.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
  top.style.transform = `translate3d(${p * 100}%,0,0)`;
  under.style.transition = top.style.transition;
  under.style.transform = `translate3d(${-(1 - p) * 25}%,0,0)`;
  under.style.setProperty('--shade-t', ms + 'ms');
  under.style.setProperty('--shade', ((1 - p) * .16).toFixed(3));
}
// When a slide has finished (unless another one took over meanwhile)
function after(el, ms, fn) {
  const id = el._nav = ++seq;
  setTimeout(() => { if (el._nav === id) fn(); }, calm() ? 0 : ms + 40);
}
const rest = el => { el.style.transition = el.style.transform = ''; el.style.removeProperty('--shade'); el.classList.remove('moving'); };
const cover = under => { rest(under); under.classList.add('away'); under.inert = true; };
const uncover = under => { under.classList.remove('away'); under.inert = false; under.classList.add('moving'); };

/** Slide `el` (already in the page) in over `under`. */
export function slideIn(el, under) {
  el.classList.add('moving'); under.classList.add('moving');
  place(el, under, 1);
  void el.offsetWidth;
  place(el, under, 0, SLIDE);
  after(el, SLIDE, () => { rest(el); cover(under); });
}

/** Slide `el` away, showing `under` again, and remove it. `p0`: where a swipe left it. */
export function slideOut(el, under, { animate = true, p0 = 0 } = {}) {
  uncover(under);
  el.inert = true;
  const done = () => { el.remove(); rest(under); };
  if (!animate || calm()) { el._nav = ++seq; return done(); }
  el.classList.add('moving');
  if (!p0) { place(el, under, 0); void el.offsetWidth; }
  const ms = Math.round(SLIDE * (.45 + .55 * (1 - p0)));       // less left to travel, less time
  place(el, under, 1, ms, p0 ? GLIDE : EASE);
  after(el, ms, done);
}

/** An empty screen: a bar (Back, and a title that shows once scrolled) over a scroller.
    `kind`: 'item' (a header runs up under the bar) or 'plain' (starts below it). */
export function screenFrame(kind = 'plain') {
  const el = document.createElement('div');
  el.className = 'screen pushed ' + kind;
  el.innerHTML = `<header class="bar"><button type="button" class="go-back" aria-label="Back"><i class="ph-fill ph-caret-left" aria-hidden="true"></i></button><span class="bar-title"></span></header>
    <div class="scroll ppbody"></div>`;
  watchScroll(el);
  return el;
}

/** Privacy & Legal as a screen, from what siteChrome.js renderLegal drew into `src`. */
export function legalScreen(src) {
  const el = screenFrame('plain');
  const title = src.querySelector('h2')?.textContent || 'Privacy & Legal';
  el.querySelector('.bar-title').textContent = title;
  const h = Object.assign(document.createElement('h2'), { className: 'large', textContent: title });
  h.setAttribute('data-mark', '');
  el.querySelector('.scroll').append(h, ...[...src.querySelectorAll('.legal-section')].map(s => s.cloneNode(true)));
  return el;
}

// pdf.js draws the PDF's pages. Fetched from jsDelivr only when a résumé is first
// opened (about 0.4 MB over the wire), so pages that never open one never load it.
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
let pdfjs = null;
const loadPdfjs = () => pdfjs || (pdfjs = new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = PDFJS + 'pdf.min.js';
  s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
  s.onerror = () => { pdfjs = null; s.remove(); fail(new Error('pdf.js did not load')); };
  document.head.append(s);
}));

/**
 * A PDF (the résumé) as a screen: its pages drawn in place to look through and zoom
 * into (pinch or double-tap), with a button to open the file itself in its own tab. If the pages can't be drawn the
 * button is still there.
 */
export function pdfScreen(url, title = 'Résumé') {
  const el = screenFrame('plain');
  el.querySelector('.bar-title').textContent = title;
  const body = el.querySelector('.scroll');
  body.innerHTML = `<h2 class="large" data-mark></h2>
    <a class="pdf-open" target="_blank" rel="noopener"><i class="ph-fill ph-arrow-square-out" aria-hidden="true"></i> Open the PDF</a>
    <p class="screen-note pdf-hint" hidden>Pinch or double-tap to zoom.</p>
    <div class="pdf-pages"><div class="pdf-page wait"></div></div>`;
  body.querySelector('.large').textContent = title;
  body.querySelector('.pdf-open').href = url;
  const pages = body.querySelector('.pdf-pages');
  const drawn = [];              // { page, canvas } for each page shown
  let zoom = 1, pass = 0;

  // One page onto a fresh canvas, `wide` CSS pixels across, as sharp as the screen
  // (within what a phone will hold in memory)
  const paint = async (page, wide) => {
    const base = page.getViewport({ scale: 1 });
    const px = Math.min(wide * Math.min(3, window.devicePixelRatio || 1), drawn.length > 2 ? 1800 : 2600);
    const view = page.getViewport({ scale: px / base.width });
    const canvas = Object.assign(document.createElement('canvas'), { className: 'pdf-page', width: view.width, height: view.height });
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: view }).promise;
    return canvas;
  };
  const label = (canvas, i, n) => { canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${title}, page ${i} of ${n}`); };

  (async () => {
    try {
      const lib = await loadPdfjs();
      const doc = await lib.getDocument(url).promise;
      const width = pages.clientWidth || 340;
      for (let i = 1; i <= Math.min(doc.numPages, 8); i++) {
        const page = await doc.getPage(i);
        if (!el.isConnected) return;                           // closed meanwhile
        const canvas = await paint(page, width);
        label(canvas, i, doc.numPages);
        if (i === 1) pages.replaceChildren(canvas); else pages.append(canvas);
        drawn.push({ page, canvas });
      }
      body.querySelector('.pdf-hint').hidden = false;
    } catch (e) {
      console.warn('PDF preview failed:', e);
      pages.innerHTML = '<p class="screen-note">The preview couldn’t be drawn here. The button above opens the PDF.</p>';
    }
  })();

  // ── Zoom: pinch, or double-tap, on the pages. The sheet grows in place (up to 4×)
  // and scrolls both ways; the spot under the fingers stays under them. Once the
  // zoom settles, the pages are drawn again at that size so the text is sharp. ──
  const setZoom = (z, x, y) => {
    z = Math.max(1, Math.min(4, z));
    const box = pages.getBoundingClientRect();
    const fx = (pages.scrollLeft + x - box.left) / zoom, fy = (y - box.top) / zoom;   // the spot, in unzoomed pixels
    zoom = z;
    pages.style.setProperty('--zoom', z);
    pages.classList.toggle('zoomed', z > 1.01);
    pages.scrollLeft = fx * z - (x - box.left);
    body.scrollTop += fy * z - (y - pages.getBoundingClientRect().top);
    const mine = ++pass;
    setTimeout(async () => {
      if (mine !== pass || !el.isConnected) return;
      for (const d of drawn) {
        const fresh = await paint(d.page, pages.clientWidth * zoom).catch(() => null);
        if (mine !== pass || !fresh) return;                   // zoomed again meanwhile
        fresh.setAttribute('role', 'img'); fresh.setAttribute('aria-label', d.canvas.getAttribute('aria-label'));
        d.canvas.replaceWith(fresh); d.canvas = fresh;
      }
    }, 350);
  };
  const spread = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  let pinch = null, tap = null;
  pages.addEventListener('touchstart', e => {
    if (e.touches.length === 2 && drawn.length) pinch = { d: spread(e.touches), z: zoom };
  }, { passive: true });
  pages.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    setZoom(pinch.z * spread(e.touches) / pinch.d, (e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
  }, { passive: false });
  pages.addEventListener('touchend', e => {
    if (pinch) { if (e.touches.length < 2) pinch = null; tap = null; return; }
    // two taps in the same spot: in to 2.5×, or back out
    const t = e.changedTouches[0], now = e.timeStamp;
    if (tap && now - tap.t < 320 && Math.hypot(t.clientX - tap.x, t.clientY - tap.y) < 30 && drawn.length) {
      e.preventDefault();
      setZoom(zoom > 1.01 ? 1 : 2.5, t.clientX, t.clientY);
      tap = null;
    } else tap = { t: now, x: t.clientX, y: t.clientY };
  });
  return el;
}

/** The bar frosts over once the screen's big title (or a project's header) has scrolled under it. */
export function watchScroll(screen) {
  const sc = screen.querySelector('.scroll'), bar = screen.querySelector('.bar');
  sc.addEventListener('scroll', () => {
    const m = screen.querySelector('[data-mark], .pp-hero');
    const at = m ? m.offsetTop + m.offsetHeight - bar.offsetHeight : 8;
    screen.classList.toggle('scrolled', sc.scrollTop > Math.max(8, at));
  }, { passive: true });
}

/** True inside a strip that scrolls sideways (a shelf): it keeps its own swipe. */
export function sideways(el, host) {
  for (; el && el !== host; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

/**
 * Swipe right anywhere on the top screen to go back: it follows the finger; past
 * a third of the width, or with a flick, `go(p)` is called (p: how far it got —
 * hand it to slideOut as p0); otherwise it settles back.
 * @param {HTMLElement} host  where the touches are listened for
 * @param {{ pair: () => [HTMLElement, HTMLElement] | null, go: (p: number) => void }} o
 *   pair: the top screen and what's under it, or null when there's nothing to go back from
 */
export function swipeBack(host, { pair, go }) {
  let g = null;
  host.addEventListener('touchstart', e => {
    g = null;
    const now = pair();
    if (!now || e.touches.length !== 1 || e.target.closest('video, input, .go-back') || sideways(e.target, host)) return;
    const t = e.touches[0];
    g = { x: t.clientX, y: t.clientY, on: false, p: 0, el: now[0], under: now[1], px: t.clientX, pt: e.timeStamp, v: 0 };
  }, { passive: true });
  host.addEventListener('touchmove', e => {
    if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.on) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (dx < 0 || Math.abs(dx) < Math.abs(dy) || !e.cancelable) { g = null; return; }         // steeper than 45°: a scroll
      g.on = true;
      g.el._nav = ++seq;                                       // takes over from a slide still finishing
      uncover(g.under); g.el.classList.add('moving');
    }
    e.preventDefault();
    const dt = e.timeStamp - g.pt;
    if (dt > 0) { g.v = (t.clientX - g.px) / dt; g.px = t.clientX; g.pt = e.timeStamp; }
    g.p = Math.max(0, Math.min(1, (dx - 10) / host.offsetWidth));
    place(g.el, g.under, g.p);
  }, { passive: false });
  const end = e => {
    const d = g; g = null;
    if (!d || !d.on) return;
    if (e.type === 'touchend' && (d.p > .33 || (d.v > .45 && d.p > .04))) return go(d.p);
    const ms = Math.round(180 + 240 * d.p);
    place(d.el, d.under, 0, ms, GLIDE);
    after(d.el, ms, () => { rest(d.el); cover(d.under); });
  };
  host.addEventListener('touchend', end);
  host.addEventListener('touchcancel', end);
}
