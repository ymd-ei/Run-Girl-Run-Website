/**
 * Mobile Work / About panels. Each is a real panel parked just below the screen,
 * built and ready, with only its folder tab showing (Work on the left, About on
 * the right). Pulling a tab up drags the panel itself into view (let go past 30%,
 * or flick, and it rises; otherwise it drops back); tapping the tab raises it.
 * Work rises to two thirds; About, a project or a post rise tall.
 *
 * Swiping down from the tab/header, or from the content once it's scrolled to its
 * top, parks the panel again; in a project or post it does the same as Back. The
 * backdrop, the close button, Escape and the phone's Back also work. Each view
 * (Work, About, a project) is a history entry, so Back steps out one level at a time.
 */

const CLOSE_DISTANCE = 0.3;    // of the panel's height
const START = 12;              // px of pull before the panel starts to move
const RESIST = 0.8;            // a downward drag follows the finger at this share, so it feels a little heavy
const CLOSE_SPEED = 0.6;       // px per ms: a flick this fast moves it whatever the distance
const GRID = 0.67;             // the Work panel's share of the screen; keep in step with .sheet in styles-mobile.css
const RUBBER = 0.15;           // how far past the grid's height a swipe back still moves the panel
const R = 12;                  // tab corner and fillet radius (px)

let renderView, backdrop;
const sheets = {};             // name → { el, panel, body, tab, back, view }
let depth = 0;                 // history entries pushed since a panel was raised
let opener = null;             // focus returns here when the panel parks
let settleFrom = null;         // a swipe back from a project: the panel's top where the finger let go

/**
 * @param {(view: object) => {html: string, back?: boolean, tall?: boolean, after?: Function}} render
 */
export function initSheet(render) {
  renderView = render;
  backdrop = document.getElementById('sheet-bd');
  document.querySelectorAll('.sheet[data-sheet]').forEach(el => {
    const name = el.dataset.sheet;
    const s = sheets[name] = {
      name, el,
      panel: el.querySelector('.sheet-panel'),
      body: el.querySelector('.sheet-body'),
      tab: el.querySelector('.sheet-tab'),
      back: el.querySelector('.sheet-back'),
      view: null
    };
    paint(s, { sheet: name });                 // built now, so it's ready when pulled up
    s.tab.addEventListener('click', () => (raised() === s ? closeSheet() : openView({ sheet: name })));
    el.querySelector('.sheet-close').addEventListener('click', closeSheet);
    if (s.back) s.back.addEventListener('click', () => history.back());
    bindSwipeDown(s);
    bindSwipeUp(s);
  });
  if (!sheets.work && !sheets.about) return;

  // A reload while a panel was up keeps its history entry; start clean, or a
  // later Back would land on it and raise the panel
  if (history.state && history.state.sheet) history.replaceState(null, '');

  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && raised()) closeSheet();
  });
  window.addEventListener('popstate', e => {
    // Each entry remembers how deep it is, so Back and Forward both stay in step
    const view = e.state && e.state.sheet ? e.state : null;
    depth = view ? view.depth : 0;
    show(view);
  });

  drawAll();
  window.addEventListener('resize', drawAll);
  document.fonts?.ready.then(drawAll);
}

const raised = () => Object.values(sheets).find(s => s.el.classList.contains('raised')) || null;

/** Raise a view: { sheet: 'work' | 'about', project?, post? } */
export function openView(view) {
  if (!raised()) opener = document.activeElement;
  depth++;
  view = { ...view, depth };
  history.pushState(view, '');
  show(view);
}

/** Re-render a panel's grid in place (e.g. Work once posts arrive); never a project being read. */
export function refreshView(name) {
  const s = sheets[name];
  if (s && s.view && !s.view.project && !s.view.post) {
    const top = s.body.scrollTop;
    paint(s, s.view);
    s.body.scrollTop = top;
  }
}

export function closeSheet() {
  if (depth > 0) history.go(-depth);   // popstate lands on the page's own entry and parks it
  else show(null);
}

function show(view) {
  const current = raised();
  if (!view) {
    if (current) park(current);
    backdrop.classList.remove('open');
    backdrop.style.opacity = '';
    setInert(false);
    document.documentElement.classList.remove('sheet-open');
    if (opener && opener.focus) opener.focus({ preventScroll: true });
    opener = null;
    return;
  }

  const s = sheets[view.sheet];
  if (!s) return;
  if (current && current !== s) park(current);
  const sameView = s.view && s.view.project === view.project && s.view.post === view.post;
  if (!sameView) paint(s, view, current === s);

  if (current === s && settleFrom !== null) {
    // After a swipe back, carry on from where the finger let go and settle at
    // the new (shorter) height in one move, instead of springing back up first
    s.el.style.transform = '';
    const top = s.el.getBoundingClientRect().top;
    s.el.style.transform = `translateY(${settleFrom - top}px)`;
    void s.el.offsetHeight;
    s.el.classList.remove('dragging');
    s.el.style.transform = '';
    settleFrom = null;
  }

  raise(s);
  backdrop.classList.add('open');
  setInert(true);
  document.documentElement.classList.add('sheet-open');
  if (current !== s) s.el.focus({ preventScroll: true });
}

// Fill a panel with a view (Back, height, content); `fade` when switching views in view
function paint(s, view, fade = false) {
  const out = renderView(view);
  s.view = { sheet: s.name, project: view.project, post: view.post };
  if (s.back) s.back.hidden = !out.back;
  s.el.classList.toggle('tall', !!(out.tall || out.back));
  s.body.innerHTML = out.html;
  s.body.scrollTop = 0;
  if (out.after) out.after(s.body);
  if (fade) {
    s.body.classList.remove('sheet-swap');
    void s.body.offsetWidth;
    s.body.classList.add('sheet-swap');
  }
}

function raise(s) {
  Object.values(sheets).forEach(o => o.el.classList.toggle('active', o === s));
  s.el.classList.add('raised');
  s.el.setAttribute('role', 'dialog');
  s.el.setAttribute('aria-modal', 'true');
  s.el.tabIndex = -1;
  s.panel.inert = false;
  s.tab.setAttribute('aria-expanded', 'true');
  drawAll();
}

function park(s) {
  s.el.classList.remove('raised', 'dragging');
  s.el.style.transform = '';
  s.el.removeAttribute('role');
  s.el.removeAttribute('aria-modal');
  s.el.removeAttribute('tabindex');
  s.panel.inert = true;
  s.tab.setAttribute('aria-expanded', 'false');
  // A project or post goes back to the grid once the panel is out of sight
  if (s.view && (s.view.project || s.view.post)) setTimeout(() => { if (!s.el.classList.contains('raised')) paint(s, { sheet: s.name }); }, 450);
  drawAll();
}

// The page behind can't be tabbed into or read while a panel is up (parked tabs stay reachable)
function setInert(on) {
  document.querySelectorAll('body > :not(.sheet):not(#sheet-bd):not(script)').forEach(el => {
    if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
  });
}

// ── One shape for tab + fillets + panel ──
// A tab is rounded on top and flares into the panel's edge with concave fillets.
// The outline clips the .tab-shape layer (one fill, one blur) and draws its edge
// line (an SVG path along the top only).
function tabOutline(L, W, T) {
  return `L${L - R} ${T} A${R} ${R} 0 0 0 ${L} ${T - R} L${L} ${R} A${R} ${R} 0 0 1 ${L + R} 0 ` +
         `L${L + W - R} 0 A${R} ${R} 0 0 1 ${L + W} ${R} L${L + W} ${T - R} A${R} ${R} 0 0 0 ${L + W + R} ${T} `;
}
function drawShape(s, withBase) {
  const layer = s.el.querySelector('.tab-shape');
  const W = layer.clientWidth, T = s.tab.offsetHeight, B = 4000;   // B: far below; the box clips it
  const r = s.tab.getBoundingClientRect(), box = s.el.getBoundingClientRect();
  const L = r.left - box.left, TW = r.width;
  let clip, edge;
  if (withBase) {
    edge = `M0 ${T} ` + tabOutline(L, TW, T) + `L${W} ${T}`;
    clip = edge + ` L${W} ${B} L0 ${B} Z`;
  } else {
    edge = `M${L - R} ${T} ` + tabOutline(L, TW, T);
    clip = edge + 'Z';
  }
  layer.style.clipPath = `path('${clip}')`;
  layer.querySelector('path').setAttribute('d', edge);
}
// Parked panels overlap in the home-indicator strip at the bottom, so only one of
// them draws its full width there (the raised or active one, else Work); the
// other is just its tab. Two see-through fills on top of each other would show.
function drawAll() {
  const list = Object.values(sheets);
  const owner = list.find(s => s.el.classList.contains('raised')) || list.find(s => s.el.classList.contains('active')) || sheets.work || list[0];
  list.forEach(s => drawShape(s, s === owner));
}

/**
 * Swipe the tab up to pull the panel into view under the finger: let go past
 * 30% of its travel (or flick up) and it rises; short of that it drops back.
 */
function bindSwipeUp(s) {
  let startY = 0, lastY = 0, lastT = 0, speed = 0, lift = 0, park0 = 0;
  let tracking = false, dragging = false;

  s.tab.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || raised()) return;
    tracking = true;
    dragging = false;
    speed = 0;
    lift = 0;
    startY = lastY = e.touches[0].clientY;
    lastT = e.timeStamp;
  }, { passive: true });

  s.tab.addEventListener('touchmove', e => {
    if (!tracking) return;
    const y = e.touches[0].clientY;
    const up = startY - y;
    if (!dragging) {
      if (up > START) {
        dragging = true;
        opener = s.tab;
        Object.values(sheets).forEach(o => o.el.classList.toggle('active', o === s));
        drawAll();
        s.el.classList.add('dragging');
        park0 = new DOMMatrix(getComputedStyle(s.el).transform).m42;   // where it's parked
        backdrop.classList.add('open');
      } else {
        if (up < -START) tracking = false;
        return;
      }
    }
    e.preventDefault();
    const dt = Math.max(1, e.timeStamp - lastT);
    speed = (lastY - y) / dt;          // positive = moving up
    lastY = y;
    lastT = e.timeStamp;
    lift = Math.min(park0, Math.max(0, up - START));
    s.el.style.transform = `translateY(${park0 - lift}px)`;
    backdrop.style.opacity = String(lift / park0);
  }, { passive: false });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    s.el.classList.remove('dragging');
    void s.el.offsetHeight;            // transitions back on before it moves
    backdrop.style.opacity = '';
    s.el.style.transform = '';
    if (lift > park0 * CLOSE_DISTANCE || speed > CLOSE_SPEED) {
      openView({ sheet: s.name });     // rises the rest of the way from where it is
    } else {
      backdrop.classList.remove('open');   // drops back to its parked spot
      opener = null;
    }
  };
  s.tab.addEventListener('touchend', end);
  s.tab.addEventListener('touchcancel', end);
}

// How far a project's (tall) panel drops to reach the grid's height
const backDistance = s => Math.max(0, s.el.offsetHeight - window.innerHeight * GRID);
const inSubView = s => s.back && !s.back.hidden;

function bindSwipeDown(s) {
  let startY = 0, lastY = 0, lastT = 0, speed = 0, dy = 0;
  let tracking = false, dragging = false, fromHandle = false;

  s.el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || !s.el.classList.contains('raised')) return;
    tracking = true;
    dragging = false;
    fromHandle = !s.body.contains(e.target);
    dy = 0;
    speed = 0;
    startY = lastY = e.touches[0].clientY;
    lastT = e.timeStamp;
  }, { passive: true });

  s.el.addEventListener('touchmove', e => {
    if (!tracking) return;
    const y = e.touches[0].clientY;
    dy = y - startY;
    if (!dragging) {
      // Pull down from the tab/header, or from content that's already at its top
      if (dy > START && (fromHandle || s.body.scrollTop <= 0)) {
        dragging = true;
        s.el.classList.add('dragging');
      } else if (Math.abs(dy) > START) {
        tracking = false;      // a normal scroll inside the content (or an upward drag)
        return;
      } else {
        return;
      }
    }
    e.preventDefault();
    const dt = Math.max(1, e.timeStamp - lastT);
    speed = (y - lastY) / dt;
    lastY = y;
    lastT = e.timeStamp;
    let pull = Math.max(0, dy) * RESIST;
    if (inSubView(s)) {
      // In a project or post the swipe heads for the grid's height: past that
      // line the drag gets heavy, so the panel isn't pulled below where it lands
      const line = backDistance(s);
      if (pull > line) pull = line + (pull - line) * RUBBER;
    }
    s.el.style.transform = `translateY(${pull}px)`;
    // Only a swipe that will park the panel fades the page back in
    if (!inSubView(s)) backdrop.style.opacity = String(Math.max(0, 1 - pull / s.el.offsetHeight));
  }, { passive: false });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    const pull = Math.max(0, dy);
    const far = inSubView(s) ? pull > backDistance(s) * 0.5 : pull > s.el.offsetHeight * CLOSE_DISTANCE;
    if (far || speed > CLOSE_SPEED) {
      if (!inSubView(s)) {
        s.el.classList.remove('dragging');   // park() then slides it on down from where it is
        closeSheet();
      } else {
        // In a project or post: step back to the grid. The panel holds still
        // where it is until the grid renders, then settles from there (show)
        settleFrom = s.el.getBoundingClientRect().top;
        history.back();
        setTimeout(() => {      // in case Back never lands
          if (settleFrom === null) return;
          settleFrom = null;
          s.el.classList.remove('dragging');
          s.el.style.transform = '';
        }, 600);
      }
    } else {
      s.el.classList.remove('dragging');
      s.el.style.transform = '';
      backdrop.style.opacity = '';
    }
  };
  s.el.addEventListener('touchend', end);
  s.el.addEventListener('touchcancel', end);
}
