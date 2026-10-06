/**
 * Ticker tapes (the contact strips and the "mature" tape on Work cards).
 *
 * The strip is measured once and the motion is handed to the browser as a
 * Web Animation, so it runs on the graphics chip with no script per frame,
 * keeps the same speed on 60 Hz and 120 Hz screens, and disappears with its
 * strip when the grid redraws (the old per-frame loops kept running forever).
 * Chosen from samples/ticker-demo (Oct 2026).
 *
 * Tracks hold four copies of their words, so one copy is the loop length.
 * The pinstripes are a layer the ticker adds to the tape and moves with the
 * words ("printed on"), so they share the speed, the hover slow-down and pauses.
 */

import { reducedMotion } from './a11y.js';

const HOVER_RATE = 0.25;   // slows to a quarter while the pointer is over it

// Pinstripe tile widths: a stripe repeats every (gap + line) px across the -55° stripes,
// which is period / sin 55° horizontally. Keep in step with .tape-stripes in the stylesheets.
const SIN55 = Math.sin(55 * Math.PI / 180);
export const STRIPE_CONTACT = 19.5 / SIN55;   // 18px gap + 1.5px line ≈ 23.805px
export const STRIPE_MATURE = 21 / SIN55;      // 20px gap + 1px line ≈ 25.636px

/**
 * @param {HTMLElement} track  the .ticker-track / .wci-tape-track to move
 * @param {object} o
 * @param {number} o.speed     px per second at the text size `o.basePx`
 * @param {number} o.basePx    text size (px) the speed was judged at
 * @param {boolean} [o.right]  move to the right instead of the left
 * @param {HTMLElement} [o.hoverTarget]  element whose hover slows the tape
 * @param {boolean} [o.followSize]  re-measure when the tape changes size (text that scales with the window)
 * @param {number} [o.stripe]  width of one pinstripe tile in px (the stripe period / sin 55°)
 * @returns {{ pause(): void, play(): void }}
 */
export function startTicker(track, { speed, basePx, right = false, hoverTarget, followSize = false, stripe = 0 }) {
  const none = { pause() {}, play() {} };
  if (!track) return none;
  if (track._ticker) return track._ticker;

  // The stripe layer: one tile wider on each side, styled in the stylesheets (.tape-stripes)
  let stripes = null;
  if (stripe && track.parentElement) {
    stripes = document.createElement('i');
    stripes.className = 'tape-stripes';
    stripes.setAttribute('aria-hidden', 'true');
    track.parentElement.appendChild(stripes);
  }
  if (reducedMotion()) return none;  // reduced motion: tapes and stripes stay still

  let anim = null, stripeAnim = null, loop = 0, scale = 1, paused = false, hovering = false;

  // Speed follows the text size, so a narrow window's smaller text reads at the same pace
  function measure() {
    const word = track.firstElementChild?.firstElementChild || track.firstElementChild;
    const newLoop = track.scrollWidth / 4;
    const newScale = word ? parseFloat(getComputedStyle(word).fontSize) / basePx : 1;
    const changed = Math.abs(newLoop - loop) > 0.5 || newScale !== scale;
    loop = newLoop;
    scale = newScale;
    return changed;
  }

  // px per second right now: the set speed, scaled to the text, slowed on hover
  function pxPerSec() {
    if (paused || !loop) return 0;
    return speed * scale * (hovering ? HOVER_RATE : 1);
  }

  function build(progress = 0) {
    if (anim) anim.cancel();
    anim = track.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(${-loop}px)` }],
      { duration: 1000, iterations: Infinity, easing: 'linear', direction: right ? 'reverse' : 'normal' }
    );
    anim.currentTime = progress * 1000;
    if (stripes && !stripeAnim) {
      stripeAnim = stripes.animate(
        [{ transform: 'translateX(0)' }, { transform: `translateX(${right ? stripe : -stripe}px)` }],
        { duration: 1000, iterations: Infinity, easing: 'linear' }
      );
    }
    sync();
  }

  // Both animations last 1 s, so a playback rate is loops (or stripes) per second
  function run(a, perSec) {
    if (!a) return;
    if (perSec === 0) a.pause();
    else {
      a.updatePlaybackRate(perSec);
      if (a.playState !== 'running') a.play();
    }
  }
  function sync() {
    const v = pxPerSec();
    run(anim, v / (loop || 1));
    run(stripeAnim, v / (stripe || 1));
  }

  // Rebuild at the same place in the loop when the length changes
  function remeasure() {
    if (!measure()) return;
    const progress = anim ? (anim.currentTime % 1000) / 1000 : 0;
    build(progress);
  }

  measure();
  build();
  if (followSize) new ResizeObserver(remeasure).observe(track.parentElement || track);
  document.fonts?.ready.then(remeasure);

  if (hoverTarget) {
    hoverTarget.addEventListener('pointerenter', () => { hovering = true; sync(); });
    hoverTarget.addEventListener('pointerleave', () => { hovering = false; sync(); });
  }

  track._ticker = {
    pause() { paused = true; sync(); },
    play() { paused = false; sync(); }
  };
  return track._ticker;
}
