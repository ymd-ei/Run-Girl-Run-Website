/**
 * Display Renderer
 * Renders the public-facing portfolio pages
 */

import { generateThumbSVG, startTicker, startSensitiveTicker } from '../utils/svg.js';
import { pool, scheduleIdle } from '../utils/text.js';
import { phosphorIcon } from '../utils/icons.js';
import { renderBlock, renderBlocks } from '../modules/blocks/blockRenderer.js';

/**
 * Apply theme colors to CSS variables
 * @param {Object} theme - Theme object
 */
export function applyTheme(theme) {
  if (!theme) return;

  const vars = {
    '--color-accent': theme.accent || '#5e30eb',
    '--color-paper': theme.paper || '#f2ede4',
    '--color-ink': theme.ink || '#1a1714',
    '--color-panel-bg': theme.panelBg || '#f7f3ec',
    '--color-contact-accent': theme.ctAccent || '#ff7828',
    '--color-contact-bg': theme.ctBg || '#080808',
    '--color-contact-hi': theme.ctHi || '#ffffff',
    '--color-sensitive': theme.sensitiveColor || '#e03030'
  };

  Object.entries(vars).forEach(([key, val]) => {
    document.documentElement.style.setProperty(key, val);
  });
}

/**
 * Generate thumbnail SVG for project cards
 * @param {string} type - Project type (2d, 3d, motion)
 * @param {string} accentColor - Accent color
 * @param {string} bgColor - Background color
 * @returns {string} SVG HTML
 */
export function getProjectThumbnail(type, accentColor, bgColor) {
  const svg = generateThumbSVG(type, accentColor, bgColor);
  return `<div class="tph">${svg}</div>`;
}

/**
 * Render a single block for display (not editing)
 * @param {Object} block - Block object
 * @returns {string} HTML
 */
export function renderDisplayBlock(block) {
  return renderBlock(block);
}

/**
 * Render all blocks
 * @param {Array} blocks - Array of block objects
 * @returns {string} HTML
 */
export function renderDisplayBlocks(blocks) {
  return renderBlocks(blocks || []);
}

/**
 * Animate count-up numbers in stats blocks
 * @param {HTMLElement} el - Element with data-target attribute
 */
export function countUp(el) {
  const raw = el.dataset.target;
  const stripped = raw.replace(/,/g, '');
  const match = stripped.match(/^([\d.]+)([^\d.]*)$/);

  if (!match) {
    el.textContent = raw;
    return;
  }

  const end = parseFloat(match[1]);
  const suffix = match[2] || '';
  const useCommas = /,/.test(raw);
  const duration = 1800;
  const steps = 60;
  const interval = duration / steps;

  let step = 0;
  el.textContent = '0' + suffix;

  const timer = setInterval(() => {
    step++;
    const progress = step / steps;
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(end * ease);
    const formatted = useCommas ? current.toLocaleString() : current;
    el.textContent = formatted + suffix;

    if (step >= steps) {
      el.textContent = raw;
      clearInterval(timer);
    }
  }, interval);
}

/**
 * Initialize count-up animations for all stats blocks (lazy, on scroll)
 */
export function initCountUps() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.sn[data-target]').forEach(el => countUp(el));
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  document.querySelectorAll('.bl-stats').forEach(el => observer.observe(el));
}

/**
 * Animate hero text with character scrambling
 * @param {string} role - Role/title text
 * @param {string} line1 - First name line
 * @param {string} line2 - Second name line (optional)
 */
export function scrambleHero(role, line1, line2) {
  const roleEl = document.getElementById('hero-role');
  const nameEl = document.getElementById('hero-name');

  if (!roleEl || !nameEl) return;

  roleEl.innerHTML = role
    .split('')
    .map(ch =>
      ch === ' '
        ? `<span class="sc-char" data-ch=" " style="opacity:0">&nbsp;</span>`
        : `<span class="sc-char" data-ch="${ch}" style="opacity:0">${ch}</span>`
    )
    .join('');

  nameEl.innerHTML = line1
    .split('')
    .map(ch => `<span class="sc-char" data-ch="${ch}" style="opacity:0">${ch}</span>`)
    .join('') +
    (line2
      ? '<br>' +
        line2
          .split('')
          .map(
            ch =>
              `<span class="sc-char sc-em" data-ch="${ch}" style="opacity:0;color:var(--accent);font-style:italic;">${ch}</span>`
          )
          .join('')
      : '');

  function animateSpans(spans, startDelay, revealWindowMs, cycleMs, cycles) {
    const revealableChars = spans.filter(span => span.dataset.ch !== ' ').length;
    const perCharDelay = revealableChars > 1 ? revealWindowMs / (revealableChars - 1) : 0;
    let revealIndex = 0;

    spans.forEach(span => {
      const ch = span.dataset.ch;
      const isSpace = ch === ' ';
      const staggerDelay = isSpace ? revealIndex * perCharDelay : revealIndex++ * perCharDelay;
      const delay = startDelay + staggerDelay;

      setTimeout(() => {
        span.style.opacity = '1';

        if (isSpace) {
          span.innerHTML = '&nbsp;';
          return;
        }

        const p = pool(ch);
        let tick = 0;

        function cycle() {
          if (tick < cycles) {
            const overshoot = Math.max(0, tick - (cycles - 4));
            const speed = cycleMs * (1 + overshoot * 1.4);
            span.textContent = p[tick % p.length];
            tick++;
            setTimeout(cycle, speed);
          } else {
            span.textContent = ch;
          }
        }

        cycle();
      }, delay);
    });
  }

  const START = 600;
  const roleRevealWindowMs = 540;
  const nameRevealWindowMs = 840;
  const accentRevealWindowMs = 700;
  const roleSpans = Array.from(roleEl.querySelectorAll('.sc-char'));
  const nameSpans = Array.from(nameEl.querySelectorAll('.sc-char:not(.sc-em)'));
  const emSpans = Array.from(nameEl.querySelectorAll('.sc-em'));

  animateSpans(roleSpans, START, roleRevealWindowMs, 90, 7);

  const nameLine1Start = START + roleRevealWindowMs * 0.55;
  animateSpans(nameSpans, nameLine1Start, nameRevealWindowMs, 100, 8);

  const nameLine2Start = nameLine1Start + nameRevealWindowMs * 0.4;
  animateSpans(emSpans, nameLine2Start, accentRevealWindowMs, 100, 8);

  scheduleIdle([roleSpans, nameSpans, emSpans]);
}

/**
 * Animate contact hero text with character scrambling
 * @param {string} title - Main contact hero line
 * @param {string} accent - Accent line text
 * @param {Object} idleOptions - Optional idle schedule overrides
 * @returns {{cancel: Function}|null} Controller to stop idle scrambling
 */
export function scrambleContactHero(title, accent, idleOptions = {}) {
  const heroEl = document.querySelector('.ct-hero');
  if (!heroEl) return null;

  const mainLine = String(title || '').trim() || "Let's";
  const accentLine = String(accent || '').trim() || 'work.';

  heroEl.innerHTML =
    mainLine
      .split('')
      .map(ch =>
        ch === ' '
          ? '<span class="sc-char ct-line-1" data-ch=" " style="opacity:0">&nbsp;</span>'
          : `<span class="sc-char ct-line-1" data-ch="${ch}" style="opacity:0">${ch}</span>`
      )
      .join('') +
    '<br><span class="accent-word">' +
    accentLine
      .split('')
      .map(ch =>
        ch === ' '
          ? '<span class="sc-char ct-line-2" data-ch=" " style="opacity:0">&nbsp;</span>'
          : `<span class="sc-char ct-line-2" data-ch="${ch}" style="opacity:0">${ch}</span>`
      )
      .join('') +
    '</span>';

  function animateSpans(spans, startDelay, revealWindowMs, cycleMs, cycles) {
    const revealableChars = spans.filter(span => span.dataset.ch !== ' ').length;
    const perCharDelay = revealableChars > 1 ? revealWindowMs / (revealableChars - 1) : 0;
    let revealIndex = 0;

    spans.forEach(span => {
      const ch = span.dataset.ch;
      const isSpace = ch === ' ';
      const staggerDelay = isSpace ? revealIndex * perCharDelay : revealIndex++ * perCharDelay;
      const delay = startDelay + staggerDelay;

      setTimeout(() => {
        span.style.opacity = '1';

        if (isSpace) {
          span.innerHTML = '&nbsp;';
          return;
        }

        const p = pool(ch);
        let tick = 0;

        function cycle() {
          if (tick < cycles) {
            const overshoot = Math.max(0, tick - (cycles - 4));
            const speed = cycleMs * (1 + overshoot * 1.4);
            span.textContent = p[tick % p.length];
            tick++;
            setTimeout(cycle, speed);
          } else {
            span.textContent = ch;
          }
        }

        cycle();
      }, delay);
    });
  }

  const START = 160;
  const titleRevealWindowMs = 900;
  const accentRevealWindowMs = 760;
  const titleSpans = Array.from(heroEl.querySelectorAll('.sc-char.ct-line-1'));
  const accentSpans = Array.from(heroEl.querySelectorAll('.sc-char.ct-line-2'));

  animateSpans(titleSpans, START, titleRevealWindowMs, 90, 7);

  const accentStart = START + titleRevealWindowMs * 0.55;
  animateSpans(accentSpans, accentStart, accentRevealWindowMs, 100, 8);

  // Safari blend mode bug workaround: force repaint after scramble
  setTimeout(() => {
    // Toggle a dummy class to force Safari to reapply blend mode
    heroEl.classList.add('safari-blend-nudge');
    // Remove after a tick
    setTimeout(() => heroEl.classList.remove('safari-blend-nudge'), 32);
  }, START + titleRevealWindowMs + accentRevealWindowMs + 100);

  return scheduleIdle([titleSpans, accentSpans], idleOptions);
}

/**
 * Render work grid with project cards
 * @param {Array} projects - Array of projects
 * @param {Object} theme - Theme object for thumbnails
 * @returns {string} HTML
 */
export function renderWorkGrid(projects, theme, { showAll = false } = {}) {
  const accentColor = theme?.accent || '#5e30eb';
  const bgColor = theme?.paper || '#e8e3da';

  return projects
    .filter(p => showAll || p.published !== false)
    .map(p => {
      const isSensitive = p.sensitive;
      const label = p.sensitiveLabel || 'MATURE';
      const color = p.sensitiveColor || theme?.sensitiveColor || '#e03030';

      const sensitiveOverlay = isSensitive
        ? `<div class="wci-sensitive">
          <div class="wci-tape" id="st-${p.id}" style="--sensitive-color:${color}">
            <div class="wci-tape-track"></div>
          </div>
        </div>`
        : '';

      const thumbnail = p.thumbnail
        ? `<img src="${p.thumbnail}" alt="${p.title}">`
        : getProjectThumbnail(p.type, accentColor, bgColor);

      return `<div class="wc" data-type="${p.type}" onclick="window.display?.openProject?.('${p.id}')">
        <div class="wci ${isSensitive ? 'wci-blur' : ''}">
          ${thumbnail}
          <div class="wco"></div>
          ${sensitiveOverlay}
        </div>
        <div class="wcm">
          <p class="wct">${p.title}</p>
          <p class="wcty">${p.typeLabel || p.type} &middot; ${p.year}</p>
        </div>
      </div>`;
    })
    .join('');
}

/**
 * Initialize sensitive tape animations
 * @param {Array} projects - Projects with sensitive flag
 */
export function initSensitiveTapes(projects, { showAll = false } = {}) {
  projects.filter(p => (showAll || p.published !== false) && p.sensitive).forEach(p => {
    const tape = document.querySelector(`#st-${p.id} .wci-tape-track`);
    if (!tape) return;

    const label = p.sensitiveLabel || 'MATURE';
    const items = Array(12).fill(label);

    tape.innerHTML = items
      .map(
        w =>
          `<span style="display:inline-flex;align-items:center;padding:0 .3rem"><span class="wci-tape-word">${w}</span><span class="wci-tape-dot"></span></span>`
      )
      .join('');

    const angle = (8 + Math.random() * 10) * (Math.random() > 0.5 ? 1 : -1);
    document.getElementById('st-' + p.id).style.transform = `rotate(${angle}deg)`;
    document.getElementById('st-' + p.id).style.top = '35%';

    startSensitiveTicker(tape, 0.4);
  });
}

/**
 * Render contact panel content
 * @param {Object} globalState - Global state with contactPanel data
 * @returns {{hero: string, heroTitle: string, heroAccent: string, sub: string, tickerTop: string, tickerMid: string, icons: string}}
 */
export function renderContactPanel(globalState) {
  const cp = globalState.contactPanel || {};
  const defaultTicker = [
    '3D Animation',
    'Motion Design',
    'Original Films',
    'Character Animation',
    'In-House Production',
    '2D Animation',
    'Rigging',
    'Compositing',
    'Visual Development',
    'Original Features'
  ];

  const ctTitle = cp.title || "Let's";
  const ctAccent = cp.titleAccent || 'work.';
  const ctSub = cp.sub || "Animation, motion, original features — whatever the idea, we're built for it. Let's talk.";

  const hero = ctTitle + '<br><span class="accent-word">' + ctAccent + '</span>';
  const sub = ctSub;

  function makeTickerHTML(items) {
    const copies = [...items, ...items, ...items, ...items];
    return copies
      .map(w => `<span class="ticker-item"><span class="ticker-word">${w}</span><span class="ticker-dot"></span></span>`)
      .join('');
  }

  const topItems = cp.tickerTop && cp.tickerTop.length ? cp.tickerTop : defaultTicker;
  const midItems = cp.tickerMid && cp.tickerMid.length ? cp.tickerMid : defaultTicker;

  const icons = (globalState.contact?.links || [])
    .map(
      l => `
        <a href="${l.url}" target="${l.url.startsWith('mailto') ? '_self' : '_blank'}" rel="noopener" class="ct-icon-btn" title="${l.label}">
          <i class="${phosphorIcon(l.url)}"></i>
        </a>`
    )
    .join('');

  return {
    hero,
    heroTitle: ctTitle,
    heroAccent: ctAccent,
    sub,
    emailLabel: cp.emailLabel || 'Drop us a line',
    socialLabel: cp.socialLabel || 'Find us',
    tickerTop: makeTickerHTML(topItems),
    tickerMid: makeTickerHTML(midItems),
    icons
  };
}

/**
 * Handle scroll effects in contact panel
 * @param {number} scrollY - Current scroll position
 */
export function updateContactPanelBackground(scrollY) {
  const progress = Math.min(scrollY / window.innerHeight, 1);
  const vid = document.getElementById('ct-bg-video');
  const dark = document.getElementById('ct-bg-dark');

  if (vid) {
    vid.style.filter = `saturate(0.55) brightness(0.9) blur(${progress * 16}px)`;
  }
  if (dark) {
    dark.style.background = `rgba(8,8,8,${progress * 0.68})`;
  }
}

/**
 * Jitter sensitive tape rotation
 */
export function jitterTapes() {
  const topAngle = 17 + Math.random() * 6;
  const midAngle = -5 + Math.random() * 5;
  const top = document.querySelector('.ct-ticker.tape-top');
  const mid = document.querySelector('.ct-ticker.tape-mid');

  if (top) top.style.transform = `rotate(${topAngle}deg)`;
  if (mid) mid.style.transform = `rotate(${midAngle}deg)`;
}
