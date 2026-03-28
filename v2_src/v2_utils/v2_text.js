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
function pool(ch) {
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
 */
export function scheduleIdle(allSpanGroups) {
  if (!allSpanGroups || allSpanGroups.length === 0) return;

  function runIdle() {
    const group = allSpanGroups[Math.floor(Math.random() * allSpanGroups.length)];
    const nonSpace = group.filter(s => s.dataset.ch !== ' ');

    if (!nonSpace.length) {
      setTimeout(runIdle, 4000);
      return;
    }

    const runLen = Math.min(nonSpace.length, 2 + Math.floor(Math.random() * 4));
    const startIdx = Math.floor(Math.random() * (nonSpace.length - runLen + 1));
    const run = nonSpace.slice(startIdx, startIdx + runLen);

    run.forEach((span, i) => setTimeout(() => rescrambleSpan(span), i * 80));

    const nextDelay = 4000 + Math.random() * 5000;
    setTimeout(runIdle, nextDelay);
  }

  setTimeout(runIdle, 5500);
}
