/**
 * Pause the decorative background loops (muted, looping, autoplaying videos)
 * after a few minutes without any mouse, keyboard, touch or scroll, and resume
 * them on the next one. A playing video makes Chrome hold a "video wake lock",
 * which keeps the screen — and so the whole laptop — awake. Left open overnight,
 * the site kept a MacBook awake until its battery died (Oct 2026).
 * Videos someone plays on purpose (the reel with sound) are never touched.
 * While resting, the frozen frame dims slowly; it brightens back as it resumes
 * (chosen from the samples/idle-demo comparison, Oct 2026).
 */

const IDLE_MS = 5 * 60 * 1000;

const DIM = 'brightness(0.55)';   // 45% darker while resting
const DIM_MS = 2000;               // fade down while it rests
const UNDIM_MS = 600;              // fade back up as it wakes

const isBackgroundLoop = v => v.muted && v.loop && v.autoplay;

// A Web Animation, so it can't clash with transitions set on the video elsewhere
// (the desktop loader fades the hero in with an inline transition)
function fade(v, on) {
  const from = getComputedStyle(v).filter;
  if (v._idleFade) v._idleFade.cancel();
  v._idleFade = v.animate(
    [{ filter: from === 'none' ? 'brightness(1)' : from }, { filter: on ? DIM : 'brightness(1)' }],
    { duration: on ? DIM_MS : UNDIM_MS, easing: 'ease', fill: on ? 'forwards' : 'none' }
  );
}

export function pauseVideosWhenIdle() {
  let timer = 0;
  let idle = false;

  const sleep = () => {
    idle = true;
    document.querySelectorAll('video').forEach(v => {
      if (isBackgroundLoop(v) && !v.paused) {
        v.dataset.idlePaused = '1';
        v.pause();                     // stays on the current frame
        fade(v, true);
      }
    });
  };

  const wake = () => {
    clearTimeout(timer);
    timer = setTimeout(sleep, IDLE_MS);
    if (!idle) return;
    idle = false;
    document.querySelectorAll('video[data-idle-paused]').forEach(v => {
      delete v.dataset.idlePaused;
      v.play().catch(() => {});
      fade(v, false);
    });
  };

  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'focus'].forEach(type =>
    window.addEventListener(type, wake, { passive: true, capture: true }));
  // Coming back to the tab or window counts as activity too (the browser may
  // restart the loops itself, and the idle clock must start again)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  wake();
}
