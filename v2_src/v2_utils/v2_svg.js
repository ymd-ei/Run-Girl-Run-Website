/**
 * SVG Generation Utilities
 * Creates inline SVG thumbnails for different project types
 */

/**
 * Generate thumbnail SVG for project types
 * @param {string} type - Project type ('2d', '3d', 'motion')
 * @param {string} [accentColor] - Accent color (default: #71904c)
 * @param {string} [bgColor] - Background color (default: #e8e3da)
 * @returns {string} SVG markup
 */
export function generateThumbSVG(type, accentColor, bgColor) {
  accentColor = accentColor || '#71904c';
  bgColor = bgColor || '#e8e3da';
  const inkColor = '#1a1714';

  const svgs = {
    '2d': `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="${bgColor}"/><circle cx="200" cy="145" r="70" fill="none" stroke="${accentColor}" stroke-width="1.5"/><circle cx="200" cy="145" r="38" fill="${accentColor}" opacity="0.08"/><line x1="200" y1="75" x2="200" y2="215" stroke="${accentColor}" stroke-width="0.8" opacity="0.3"/><line x1="130" y1="145" x2="270" y2="145" stroke="${accentColor}" stroke-width="0.8" opacity="0.3"/><circle cx="200" cy="87" r="5" fill="${accentColor}"/></svg>`,

    '3d': `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="${bgColor}"/><polygon points="200,55 305,148 200,178 95,148" fill="none" stroke="${accentColor}" stroke-width="1.5"/><polygon points="200,178 305,148 305,222 200,252" fill="${accentColor}" opacity="0.06" stroke="${accentColor}" stroke-width="0.8"/><polygon points="200,178 95,148 95,222 200,252" fill="${inkColor}" opacity="0.03" stroke="${inkColor}" stroke-width="0.5"/><circle cx="200" cy="55" r="4" fill="${accentColor}"/></svg>`,

    'motion': `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="${bgColor}"/><rect x="80" y="115" width="240" height="2.5" fill="${accentColor}" rx="1"/><rect x="80" y="128" width="180" height="2" fill="${inkColor}" opacity="0.18" rx="1"/><rect x="80" y="141" width="210" height="2" fill="${inkColor}" opacity="0.12" rx="1"/><rect x="80" y="75" width="55" height="20" rx="2" fill="${accentColor}"/></svg>`
  };

  return svgs[type] || svgs.motion;
}

/**
 * Start ticker animation for marquee-style scrolling
 * @param {Element} track - Element to animate
 * @param {number} speed - Speed in pixels per frame (positive = left scroll)
 */
export function startTicker(track, speed) {
  if (!track) return;
  if (track._tickerRunning) return;
  track._tickerRunning = true;

  const trackW = track.scrollWidth;
  const absSpeed = Math.abs(speed);
  const movingLeft = speed > 0;
  const loopPoint = trackW / 4;
  let offset = movingLeft ? 0 : -loopPoint;
  let raf;

  function tick() {
    offset += movingLeft ? -absSpeed : absSpeed;
    if (movingLeft && offset < -loopPoint) offset = 0;
    if (!movingLeft && offset > 0) offset = -loopPoint;
    track.style.transform = `translateX(${offset}px)`;
    raf = requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(tick);
    }
  });

  raf = requestAnimationFrame(tick);
}

/**
 * Start sensitive ticker (responsive to scroll)
 * @param {Element} track - Element to animate
 * @param {number} speed - Speed in pixels per frame
 */
export function startSensitiveTicker(track, speed) {
  if (!track || track._tickerRunning) return;
  track._tickerRunning = true;

  const trackW = track.scrollWidth;
  const loopPoint = trackW / 4;
  let offset = 0;
  let raf;

  function tick() {
    offset -= speed;
    if (offset < -loopPoint) offset = 0;
    track.style.transform = `translateX(${offset}px)`;
    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);
}
