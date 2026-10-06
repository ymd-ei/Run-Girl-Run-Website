/**
 * Mobile bottom sheet. The Work grid opens over two thirds of the screen;
 * About, a project or a post open tall. Swipes only start on the top strip
 * (handle + title row); the content just scrolls. Swiping down closes the
 * sheet, and in a project or post it does the same as Back. The backdrop, the
 * close button, Escape and the phone's Back also work. Each view (About, Work,
 * a project) is a history entry, so Back steps out one level at a time.
 */

const CLOSE_DISTANCE = 0.25;   // of the sheet's height
const CLOSE_SPEED = 0.6;       // px per ms: a flick this fast closes (or goes back) whatever the distance
const GRID = 0.67;             // the Work sheet's share of the screen; keep in step with .sheet in styles-mobile.css
const RUBBER = 0.15;           // how far past the grid's height a swipe back still moves the sheet

let sheet, body, backdrop, titleEl, backBtn, renderView;
let depth = 0;                 // history entries pushed since the sheet was closed
let opener = null;             // focus returns here on close
let settleFrom = null;         // a swipe back from a project: the sheet's top where the finger let go

/**
 * @param {(view: object) => {title: string, html: string, back?: boolean, tall?: boolean, after?: Function}} render
 */
export function initSheet(render) {
  renderView = render;
  sheet = document.getElementById('sheet');
  body = document.getElementById('sheet-body');
  backdrop = document.getElementById('sheet-bd');
  titleEl = document.getElementById('sheet-title');
  backBtn = document.getElementById('sheet-back');
  if (!sheet) return;

  backdrop.addEventListener('click', closeSheet);
  document.getElementById('sheet-close').addEventListener('click', closeSheet);
  backBtn.addEventListener('click', () => history.back());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet();
  });
  window.addEventListener('popstate', e => {
    // Each entry remembers how deep it is, so Back and Forward both stay in step
    const view = e.state && e.state.sheet ? e.state : null;
    depth = view ? view.depth : 0;
    show(view);
  });
  bindSwipe();
}

/** Open a view: { sheet: 'about' | 'work', project?, post? } */
export function openView(view) {
  if (!sheet.classList.contains('open')) opener = document.activeElement;
  depth++;
  view = { ...view, depth };
  history.pushState(view, '');
  show(view);
}

/** Re-render the open view in place (e.g. the Work grid once posts arrive). */
export function refreshView() {
  const view = history.state;
  if (sheet.classList.contains('open') && view && view.sheet) show(view);
}

export function closeSheet() {
  if (depth > 0) {
    history.go(-depth);        // popstate lands on the page's own entry and closes
  } else {
    show(null);
  }
}

function show(view) {
  const wasOpen = sheet.classList.contains('open');
  if (!view) {
    sheet.classList.remove('open', 'dragging');
    sheet.style.transform = '';
    backdrop.classList.remove('open');
    backdrop.style.opacity = '';
    setInert(false);
    document.documentElement.classList.remove('sheet-open');
    if (opener && opener.focus) opener.focus({ preventScroll: true });
    opener = null;
    return;
  }

  const out = renderView(view);
  titleEl.textContent = out.title;
  backBtn.hidden = !out.back;
  sheet.classList.toggle('tall', !!(out.tall || out.back));
  body.innerHTML = out.html;
  body.scrollTop = 0;
  if (out.after) out.after(body);

  if (wasOpen) {
    // Switching views inside the open sheet: the new content fades in
    body.classList.remove('sheet-swap');
    void body.offsetWidth;
    body.classList.add('sheet-swap');
  }
  if (wasOpen && settleFrom !== null) {
    // After a swipe back, carry on from where the finger let go and settle at
    // the new (shorter) height in one move, instead of springing back up first
    sheet.style.transform = '';
    const top = sheet.getBoundingClientRect().top;
    sheet.style.transform = `translateY(${settleFrom - top}px)`;
    void sheet.offsetHeight;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    settleFrom = null;
  }

  sheet.classList.add('open');
  backdrop.classList.add('open');
  setInert(true);
  document.documentElement.classList.add('sheet-open');
  if (!wasOpen) sheet.focus({ preventScroll: true });
}

// The page behind the sheet can't be tabbed into or read while it is open.
function setInert(on) {
  document.querySelectorAll('body > :not(#sheet):not(#sheet-bd):not(script)').forEach(el => {
    if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
  });
}

// How far a project's (tall) sheet drops to reach the grid's height
const backDistance = () => Math.max(0, sheet.offsetHeight - window.innerHeight * GRID);

function bindSwipe() {
  let startY = 0, lastY = 0, lastT = 0, speed = 0, dy = 0;
  let tracking = false, dragging = false;

  // Only the top strip (handle + title row) drags; the content scrolls as usual
  sheet.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || body.contains(e.target)) return;
    tracking = true;
    dragging = false;
    dy = 0;
    speed = 0;
    startY = lastY = e.touches[0].clientY;
    lastT = e.timeStamp;
  }, { passive: true });

  sheet.addEventListener('touchmove', e => {
    if (!tracking) return;
    const y = e.touches[0].clientY;
    dy = y - startY;
    if (!dragging) {
      if (dy > 6) {
        dragging = true;
        sheet.classList.add('dragging');
      } else {
        if (dy < -6) tracking = false;   // an upward drag isn't a close
        return;
      }
    }
    e.preventDefault();
    const dt = Math.max(1, e.timeStamp - lastT);
    speed = (y - lastY) / dt;
    lastY = y;
    lastT = e.timeStamp;
    let pull = Math.max(0, dy);
    if (!backBtn.hidden) {
      // In a project or post the swipe heads for the grid's height: past that
      // line the drag gets heavy, so the sheet isn't pulled below where it lands
      const line = backDistance();
      if (pull > line) pull = line + (pull - line) * RUBBER;
    }
    sheet.style.transform = `translateY(${pull}px)`;
    // Only a swipe that will close the sheet fades the page back in
    if (backBtn.hidden) backdrop.style.opacity = String(Math.max(0, 1 - pull / sheet.offsetHeight));
  }, { passive: false });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    const pull = Math.max(0, dy);
    const far = backBtn.hidden ? pull > sheet.offsetHeight * CLOSE_DISTANCE : pull > backDistance() * 0.5;
    if (far || speed > CLOSE_SPEED) {
      if (backBtn.hidden) {
        sheet.classList.remove('dragging');
        closeSheet();
      } else {
        // In a project or post: step back to the grid. The sheet holds still
        // where it is until the grid renders, then settles from there (show)
        settleFrom = sheet.getBoundingClientRect().top;
        history.back();
        setTimeout(() => {      // in case Back never lands
          if (settleFrom === null) return;
          settleFrom = null;
          sheet.classList.remove('dragging');
          sheet.style.transform = '';
        }, 600);
      }
    } else {
      sheet.classList.remove('dragging');
      sheet.style.transform = '';
      backdrop.style.opacity = '';
    }
  };
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
}
