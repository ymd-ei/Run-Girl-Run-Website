/**
 * Lite mode, for slower devices: background videos become their posters and
 * frosted glass becomes solid (html.lite in the stylesheets). Visitors switch
 * it with any .lite-toggle button (in the footers). It starts on for
 * data-saver visitors, and each visitor's choice is remembered in their browser.
 */

const KEY = 'rgr_lite';

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved === '1';
  } catch (e) { /* storage blocked: use the default */ }
  return !!(navigator.connection && navigator.connection.saveData);
}

let lite = initial();
document.documentElement.classList.toggle('lite', lite);

export const isLite = () => lite;

/** Videos stay still in lite mode and for visitors who ask for reduced motion. */
export const stillVideos = () => lite || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Wire every .lite-toggle; `onChange(lite)` re-renders whatever the page needs. */
export function bindLiteToggles(onChange) {
  const buttons = [...document.querySelectorAll('.lite-toggle')];
  const sync = () => buttons.forEach(b => b.setAttribute('aria-pressed', String(lite)));
  sync();
  buttons.forEach(btn => btn.addEventListener('click', () => {
    lite = !lite;
    try { localStorage.setItem(KEY, lite ? '1' : '0'); } catch (e) { /* not remembered */ }
    document.documentElement.classList.toggle('lite', lite);
    sync();
    onChange(lite);
  }));
}
