/**
 * FFXIV presence line above the "Available for work" badge (desktop home screen).
 *
 * The RGR Presence Dalamud plugin reports to the worker's /api/presence; this reads
 * it on load and once a minute while the tab is visible. Shown only while online —
 * offline (or the worker unreachable) simply hides the line. Never delays the page.
 */
const API = `${window.RGR_CONFIG?.apiBase || ''}/api/presence`;
const POLL_MS = 60 * 1000;
const TIMEOUT_MS = 4000;

// This row starts its pulse whenever it's un-hidden, so it drifts from the badge dot.
// Pin every #sh dot's pulse to the page timeline's zero so they always beat together.
function syncDots() {
  document.querySelectorAll('#sh .avail-dot').forEach(dot => {
    dot.getAnimations().forEach(a => { a.startTime = 0; });
  });
}

export function initFfxivStatus() {
  const el = document.getElementById('ffxiv-status');
  const text = document.getElementById('ffxiv-text');
  if (!el || !text || !window.RGR_CONFIG?.apiBase) return;
  // Inside the editor's preview iframe there's nothing to poll for
  if (window.self !== window.top) return;

  let timer = null;

  async function refresh() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API, { signal: ctrl.signal, cache: 'no-store' });
      const s = res.ok ? await res.json() : null;
      if (s && s.online) {
        const place = [s.zone, s.world].filter(Boolean).join(' · ');
        text.textContent = place ? `In FFXIV · ${place}` : 'In FFXIV';
        el.hidden = false;
        syncDots();
      } else {
        el.hidden = true;
      }
    } catch {
      el.hidden = true;
    } finally {
      clearTimeout(t);
    }
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    if (document.visibilityState === 'visible') {
      refresh();
      timer = setInterval(refresh, POLL_MS);
    }
  }

  document.addEventListener('visibilitychange', schedule);
  schedule();
}
