/**
 * Text Animation Utilities
 * Handles text scrambling and idle animations
 */

/**
 * Keyboard proximity map for scramble effect
 */
const nearby = {
  'a': 'sqerz', 'b': 'vdnp', 'c': 'xzvo', 'd': 'efbs', 'e': 'wadr', 'f': 'tgde', 'g': 'tfhy', 'h': 'jgyn',
  'i': 'lkuo', 'j': 'iukh', 'k': 'ljix', 'l': 'kpio', 'm': 'nwkb', 'n': 'mbhv', 'o': 'iplc', 'p': 'oqbl',
  'q': 'wpa', 'r': 'etdf', 's': 'azxe', 't': 'ryfg', 'u': 'yhio', 'v': 'bcfx', 'w': 'qase', 'x': 'czv',
  'y': 'uhtg', 'z': 'xsa',
  'A': 'SQERZ', 'B': 'VDNP', 'C': 'XZVO', 'D': 'EFBS', 'E': 'WADR', 'F': 'TGDE', 'G': 'TFHY', 'H': 'JGYN',
  'I': 'LKUO', 'J': 'IUKH', 'K': 'LJIX', 'L': 'KPIO', 'M': 'NWKB', 'N': 'MBHV', 'O': 'IPLC', 'P': 'OQBL',
  'Q': 'WPA', 'R': 'ETDF', 'S': 'AZXE', 'T': 'RYFG', 'U': 'YHIO', 'V': 'BCFX', 'W': 'QASE', 'X': 'CZV',
  'Y': 'UHTG', 'Z': 'XSA', ' ': ' '
};

/**
 * Get a pool of characters similar to the input character
 * @param {string} ch - Character to get pool for
 * @returns {string[]} Array of similar characters
 */
export function pool(ch) {
  const p = nearby[ch] || nearby[ch.toLowerCase()] || 'abcdefghijklmnopqrstuvwxyz';
  return (p + ch).split('');
}

/**
 * Animate a single span with character scramble effect
 * @param {Element} span - Span element with data-ch attribute
 */
export function rescrambleSpan(span) {
  const ch = span.dataset.ch;
  if (ch === ' ') return;

  const charPool = pool(ch);
  const cycles = 6;
  let tick = 0;

  function cycle() {
    if (tick < cycles) {
      const overshoot = Math.max(0, tick - (cycles - 3));
      const speed = 110 * (1 + overshoot * 1.6);
      span.textContent = charPool[tick % charPool.length];
      tick++;
      setTimeout(cycle, speed);
    } else {
      span.textContent = ch;
    }
  }

  cycle();
}

/**
 * Schedule idle text scrambling animations
 * @param {Array<Array<Element>>} allSpanGroups - Groups of span elements
 * @param {Object} options - Idle timing options
 * @returns {{cancel: Function}|null} Controller to stop scheduled idle cycles
 */
export function scheduleIdle(allSpanGroups, options = {}) {
  if (!allSpanGroups || allSpanGroups.length === 0) return;

  const initialDelay = Number.isFinite(options.initialDelay) ? options.initialDelay : 5500;
  const minDelay = Number.isFinite(options.minDelay) ? options.minDelay : 4000;
  const maxDelay = Number.isFinite(options.maxDelay) ? options.maxDelay : 9000;
  const minRunLen = Number.isFinite(options.minRunLen) ? options.minRunLen : 2;
  const maxRunLen = Number.isFinite(options.maxRunLen) ? options.maxRunLen : 5;
  const staggerMs = Number.isFinite(options.staggerMs) ? options.staggerMs : 80;

  let cancelled = false;
  const timers = new Set();

  function queue(task, delay) {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!cancelled) task();
    }, delay);
    timers.add(id);
    return id;
  }

  function cancel() {
    cancelled = true;
    timers.forEach(id => clearTimeout(id));
    timers.clear();
  }

  function runIdle() {
    if (cancelled) return;

    const group = allSpanGroups[Math.floor(Math.random() * allSpanGroups.length)];
    const nonSpace = group.filter(s => s.dataset.ch !== ' ');

    if (!nonSpace.length) {
      queue(runIdle, minDelay);
      return;
    }

    const runLen = Math.min(nonSpace.length, minRunLen + Math.floor(Math.random() * Math.max(1, maxRunLen - minRunLen + 1)));
    const startIdx = Math.floor(Math.random() * (nonSpace.length - runLen + 1));
    const run = nonSpace.slice(startIdx, startIdx + runLen);

    run.forEach((span, i) => queue(() => rescrambleSpan(span), i * staggerMs));

    const nextDelay = minDelay + Math.random() * Math.max(0, maxDelay - minDelay);
    queue(runIdle, nextDelay);
  }

  queue(runIdle, initialDelay);
  return { cancel };
}
