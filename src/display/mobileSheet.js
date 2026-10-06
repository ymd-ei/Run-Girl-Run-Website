/**
 * Mobile bottom sheet: slides up to about two thirds of the screen (taller for a
 * project or post) and closes with a swipe down (from the handle anywhere, or
 * from the content once it is scrolled to the top), the backdrop, the close
 * button, Escape or the phone's Back. Each view (About, Work, a project) is a
 * history entry, so Back steps out one level at a time; swiping down inside a
 * project or post does the same as Back.
 */

const CLOSE_DISTANCE = 0.25;   // of the sheet's height
const CLOSE_SPEED = 0.6;       // px per ms, a quick flick closes from anywhere

let sheet, body, backdrop, titleEl, backBtn, renderView;
let depth = 0;                 // history entries pushed since the sheet was closed
let opener = null;             // focus returns here on close

/**
 * @param {(view: object) => {title: string, html: string, back?: boolean, after?: Function}} render
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
  sheet.classList.toggle('tall', !!out.back);
  body.innerHTML = out.html;
  body.scrollTop = 0;
  if (out.after) out.after(body);

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

function bindSwipe() {
  let startY = 0, lastY = 0, lastT = 0, speed = 0, dy = 0;
  let tracking = false, dragging = false, fromHandle = false;

  sheet.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    tracking = true;
    dragging = false;
    dy = 0;
    speed = 0;
    startY = lastY = e.touches[0].clientY;
    lastT = e.timeStamp;
    fromHandle = !body.contains(e.target);
  }, { passive: true });

  sheet.addEventListener('touchmove', e => {
    if (!tracking) return;
    const y = e.touches[0].clientY;
    dy = y - startY;
    if (!dragging) {
      // Pull down from the handle/header, or from content that's already at its top
      if (dy > 6 && (fromHandle || body.scrollTop <= 0)) {
        dragging = true;
        sheet.classList.add('dragging');
      } else if (Math.abs(dy) > 6) {
        tracking = false;      // a normal scroll inside the content
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
    const pull = Math.max(0, y - startY);
    sheet.style.transform = `translateY(${pull}px)`;
    // Only a swipe that will close the sheet fades the page back in
    if (backBtn.hidden) backdrop.style.opacity = String(Math.max(0, 1 - pull / sheet.offsetHeight));
  }, { passive: false });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    const pull = Math.max(0, dy);
    if (pull > sheet.offsetHeight * CLOSE_DISTANCE || speed > CLOSE_SPEED) {
      if (backBtn.hidden) {
        closeSheet();
      } else {
        // In a project or post: step back to the grid, which shrinks the sheet
        sheet.style.transform = '';
        history.back();
      }
    } else {
      sheet.style.transform = '';
      backdrop.style.opacity = '';
    }
  };
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
}
