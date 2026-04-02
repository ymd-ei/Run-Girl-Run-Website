/**
 * Display Main Bootstrap
 * Initializes the public-facing portfolio website
 */

import { globalState, projects } from '../state/globalState.js';
import {
  applyTheme,
  renderWorkGrid,
  initSensitiveTapes,
  renderContactPanel,
  scrambleHero,
  scrambleContactHero,
  initCountUps,
  updateContactPanelBackground,
  renderDisplayBlocks
} from './displayRenderer.js';
import { startTicker } from '../utils/svg.js';
import { phosphorIcon } from '../utils/icons.js';
import { pool, scheduleIdle } from '../utils/text.js';
import { normalizeBlocks } from '../modules/blocks/blockManager.js';

let bgPlayer = null;
let contactTickersStarted = false;
let contactHeroIdleController = null;
let contactHeroText = { title: "Let's", accent: 'work.' };
let pendingPreviewNav = null;
let canvasEditEnabled = false;
let canvasEditActiveElement = null;
let canvasEditOriginalText = '';
let canvasEditListenersBound = false;

function ensureCanvasEditStyles() {
  if (document.getElementById('canvas-edit-style')) return;

  const style = document.createElement('style');
  style.id = 'canvas-edit-style';
  style.textContent = `
    body.canvas-edit-enabled [data-canvas-editable="true"] {
      outline: 1px dashed rgba(255, 255, 255, 0.35);
      outline-offset: 2px;
    }

    body.canvas-edit-enabled [data-canvas-editable="true"]:hover {
      outline-color: rgba(255, 255, 255, 0.85);
    }

    .canvas-edit-active {
      outline: 1px solid rgba(255, 255, 255, 0.95) !important;
      background: rgba(255, 255, 255, 0.08);
    }
  `;

  document.head.appendChild(style);
}
let lightboxMode = 'reel';
const projectCache = new Map();
let activeBeforeAfter = null;

const LIKES_API = 'https://rgr-editor-backend.rungirlrun.workers.dev/api/likes';

function getVisitorId() {
  let vid = localStorage.getItem('rgr_vid');
  if (!vid) {
    vid = crypto.randomUUID();
    localStorage.setItem('rgr_vid', vid);
  }
  return vid;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setBeforeAfterPosition(container, position) {
  if (!container) return;

  const next = clamp(position, 0, 100);
  container.style.setProperty('--before-after-pos', `${next}%`);

  const handle = container.querySelector('[data-before-after-handle]');
  if (handle) {
    handle.setAttribute('aria-valuenow', String(Math.round(next)));
  }
}

function getBeforeAfterPosition(container, clientX) {
  const frame = container.querySelector('[data-before-after-frame]') || container;
  const rect = frame.getBoundingClientRect();
  if (!rect.width) return 67;
  return ((clientX - rect.left) / rect.width) * 100;
}

function syncFaqItem(item, open) {
  if (!item) return;

  item.classList.toggle('open', open);

  const trigger = item.querySelector('[data-faq-trigger]');
  const panel = item.querySelector('[data-faq-panel]');

  if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (panel) panel.hidden = !open;
}

function toggleFaqItem(item) {
  const root = item?.closest('[data-faq]');
  if (!root) return;

  const shouldOpen = !item.classList.contains('open');
  root.querySelectorAll('[data-faq-item]').forEach(entry => {
    syncFaqItem(entry, shouldOpen && entry === item);
  });
}

function replayContactHeroScramble() {
  if (contactHeroIdleController && typeof contactHeroIdleController.cancel === 'function') {
    contactHeroIdleController.cancel();
  }

  contactHeroIdleController = scrambleContactHero(contactHeroText.title, contactHeroText.accent, {
    // Intentionally varied cadence vs main hero while keeping the same visual language.
    initialDelay: 3600,
    minDelay: 3000,
    maxDelay: 7600,
    minRunLen: 2,
    maxRunLen: 5,
    staggerMs: 70
  });
}

function suspendMediaIn(root) {
  if (!root) return;

  root.querySelectorAll('video').forEach(video => {
    try {
      video.pause();
      video.currentTime = 0;
    } catch (_) {
      // Ignore media pause errors from transient or detached nodes.
    }
  });

  root.querySelectorAll('iframe').forEach(frame => {
    const src = frame.getAttribute('src');
    if (!src || src === 'about:blank') return;
    frame.dataset.savedSrc = src;
    frame.setAttribute('src', 'about:blank');
  });
}

function resumeMediaIn(root) {
  if (!root) return;

  root.querySelectorAll('iframe[data-saved-src]').forEach(frame => {
    const savedSrc = frame.dataset.savedSrc;
    if (!savedSrc) return;
    frame.setAttribute('src', savedSrc);
    delete frame.dataset.savedSrc;
  });

  root.querySelectorAll('video[autoplay]').forEach(video => {
    video.play().catch(() => {});
  });
}

/**
 * Run the loader animation with randomized percentage stops.
 */
function runLoaderAnimation() {
  if (new URLSearchParams(location.search).has('preview')) {
    const loaderEl = document.getElementById('loader');
    if (loaderEl) loaderEl.style.display = 'none';
    return;
  }

  document.body.classList.add('page-loading');

  const nameEl = document.getElementById('loader-name');
  const bar = document.getElementById('loader-bar');
  const loader = document.getElementById('loader');
  if (!nameEl || !bar || !loader) return;

  // Ensure the loader can replay correctly on hard reloads and bfcache restores.
  loader.classList.remove('done');
  bar.style.width = '0%';
  nameEl.innerHTML = '';

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const nameText = 'Run Girl Run';

  function runLoaderName() {
    nameEl.innerHTML = nameText
      .split('')
      .map(ch =>
        ch === ' '
          ? '<span style="width:.4em;display:inline-block"> </span>'
          : `<span style="opacity:0">${ch}</span>`
      )
      .join('');

    const allSpans = [...nameEl.querySelectorAll('span:not([style*="width"])')];
    const finalChars = nameText.split('').filter(c => c !== ' ');

    setTimeout(() => {
      allSpans.forEach(sp => {
        sp.style.opacity = '1';
        sp.textContent = chars[Math.floor(Math.random() * chars.length)];
      });

      const noiseTimer = setInterval(() => {
        allSpans.forEach(sp => {
          if (!sp.dataset.settled) {
            sp.textContent = chars[Math.floor(Math.random() * chars.length)];
          }
        });
      }, 55);

      allSpans.forEach((sp, i) => {
        setTimeout(() => {
          sp.dataset.settled = '1';
          sp.textContent = finalChars[i];
          if (i === allSpans.length - 1) clearInterval(noiseTimer);
        }, i * 120);
      });
    }, 80);
  }

  runLoaderName();

  const numStops = 2 + Math.floor(Math.random() * 2);
  const stops = [];
  let cursor = 0;
  for (let i = 0; i < numStops; i++) {
    cursor += 15 + Math.random() * 35;
    if (cursor < 90) stops.push(Math.round(cursor));
  }
  stops.push(100);

  let stopIdx = 0;
  function animateBar() {
    if (stopIdx >= stops.length) return;
    const target = stops[stopIdx];
    const prev = stopIdx === 0 ? 0 : stops[stopIdx - 1];
    const range = target - prev;
    const duration = 280 + Math.random() * 340;
    const startTime = performance.now();

    function step(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      bar.style.width = prev + range * eased + '%';
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        bar.style.width = target + '%';
        stopIdx++;
        if (target < 100) {
          const pause = 180 + Math.random() * 420;
          setTimeout(animateBar, pause);
        } else {
          setTimeout(dismiss, 260);
        }
      }
    }

    requestAnimationFrame(step);
  }

  function dismiss() {
    loader.classList.add('done');
    // Let the loader fade begin before revealing the full page state.
    setTimeout(() => {
      document.body.classList.remove('page-loading');
    }, 220);
  }

  setTimeout(animateBar, 120);
  setTimeout(() => {
    if (!loader.classList.contains('done')) dismiss();
  }, 4000);
}

/**
 * Bootstrap the public display site
 */
export async function bootstrap() {
  try {
    runLoaderAnimation();

    // Set up bridge immediately to avoid missing the editor's first preview push.
    setupEditorPreviewBridge();

    // 1. Load data
    await loadAllData();

    // 2. Apply theme
    applyTheme(globalState.theme);

    // 3. Update document meta
    updateDocumentMeta();

    // 4. Render hero section
    renderHero();

    // 5. Render work grid with filters
    // Draft viewing mode: ?drafts=all shows all projects including drafts
    // Persists for the session so navigation doesn't lose it
    const params = new URLSearchParams(window.location.search);
    if (params.has('drafts')) sessionStorage.setItem('rgr_preview', params.get('drafts'));
    const previewMode = sessionStorage.getItem('rgr_preview') === 'all';

    if (previewMode) {
      renderWorkSection({ showAll: true });
      const indicator = document.createElement('div');
      indicator.textContent = '\u{1F441} Preview Mode \u2014 drafts visible';
      indicator.style = 'position:fixed;bottom:1rem;right:1rem;background:#1a1a1a;color:#fff;padding:.5em 1em;border-radius:6px;font-size:.75rem;z-index:9999;opacity:.85;pointer-events:none;';
      document.body.appendChild(indicator);
    } else {
      // Default: filter to only published projects
      const publishedProjects = projects.filter(p => p.published);
      const origProjects = [...projects];
      projects.length = 0;
      projects.push(...publishedProjects);
      renderWorkSection();
      projects.length = 0;
      projects.push(...origProjects);
    }

    // 5b. Render lower-right updates stack from log.json without blocking first paint.
    void loadLogStack();

    // 6. Render about panel
    renderAboutPanel();

    // 7. Render contact panel
    renderContactSection();

    // 8. Set up event listeners
    setupEventListeners();

    // Apply any queued navigation state received before controls were ready.
    if (pendingPreviewNav) {
      applyPreviewNavigation(pendingPreviewNav);
      pendingPreviewNav = null;
    }

    // 9. Deep-link: open a project if ?project=id is in the URL
    const projectParam = params.get('project');
    if (projectParam) {
      window.display?.openProject?.(projectParam);
    }

    console.log('✓ Display Bootstrap Complete');
  } catch (error) {
    console.error('✗ Display bootstrap failed:', error);
  }
}

function applyPreviewNavigation(message) {
  if (!message) return;

  const panel = message.panel;
  if (panel === 'home') {
    window.display?.closeToRoot?.();
    return;
  }

  if (panel === 'about' || panel === 'contact') {
    window.display?.openPanel?.(panel);
    return;
  }

  if (panel === 'project' && message.projectId) {
    const workPanel = document.getElementById('panel-work');
    const bd = document.getElementById('bd');
    if (workPanel) workPanel.classList.add('open');
    if (bd) bd.classList.add('open');
    window.display?.openProject?.(message.projectId);
  }
}

function rememberProject(project) {
  if (project && project.id) projectCache.set(project.id, project);
}

async function fetchProjectById(id) {
  const cached = projectCache.get(id);
  if (cached && Array.isArray(cached.blocks)) return cached;

  try {
    const res = await fetch('projects/' + id + '.json');
    if (!res.ok) throw new Error('Failed to load ' + id);
    const full = await res.json();
    rememberProject(full);

    const idx = projects.findIndex(p => p.id === id);
    if (idx >= 0) projects[idx] = full;
    else projects.push(full);

    return full;
  } catch (error) {
    console.warn('Could not load project ' + id, error);
    return null;
  }
}

/**
 * Load all data from JSON files
 */
async function loadAllData() {
  try {
    // Check for preview mode (coming from editor)
    const isPreview = new URLSearchParams(location.search).has('preview');
    if (isPreview) {
      // Will be populated by preview bridge
      return;
    }

    // Load global content
    const contentRes = await fetch('content.json');
    if (!contentRes.ok) throw new Error('Failed to load content.json');
    const contentData = await contentRes.json();

    Object.assign(globalState, contentData);
    projectCache.clear();

    // Load project cards if available. This keeps initial payload light and
    // defers full block bodies until openProject is called.
    const projectIds = globalState.projects || [];
    const projectCards = Array.isArray(globalState.projectCards) ? globalState.projectCards : [];

    if (projectCards.length) {
      const cardById = new Map(projectCards.map(card => [card.id, card]));
      const orderedCards = projectIds
        .map(id => cardById.get(id))
        .filter(card => card && card.id);

      projects.length = 0;
      projects.push(...orderedCards);

      console.log(`Loaded ${projects.length} project cards`);
      return;
    }

    // Backward-compatible fallback: no projectCards metadata yet, so load all.
    const loadedProjects = await Promise.all(
      projectIds.map(id =>
        fetch('projects/' + id + '.json')
          .then(r => {
            if (!r.ok) throw new Error('Failed to load ' + id);
            return r.json();
          })
          .catch(e => {
            console.warn('Could not load project ' + id, e);
            return null;
          })
      )
    );

    const fullProjects = loadedProjects.filter(p => p !== null);
    fullProjects.forEach(rememberProject);

    projects.length = 0;
    projects.push(...fullProjects);

    console.log(`Loaded ${projects.length} projects`);
  } catch (error) {
    throw new Error('Data loading failed: ' + error.message);
  }
}

/**
 * Update document title and favicon
 */
function updateDocumentMeta() {
  document.title = globalState.siteTitle || globalState.name || 'Portfolio';

  if (globalState.favicon) {
    const src = globalState.favicon;
    const favicon = document.getElementById('favicon');
    const faviconApple = document.getElementById('favicon-apple');
    const faviconMask = document.getElementById('favicon-mask');

    if (favicon) favicon.href = src;
    if (faviconApple) faviconApple.href = src;
    if (faviconMask) faviconMask.href = src;
  }
}

/**
 * Render hero section with name and role
 */
function renderHero() {
  const navName = document.getElementById('nav-name');
  if (navName) {
    if (globalState.logo) {
      navName.innerHTML = `<img src="${globalState.logo}" alt="${globalState.name || ''}" style="height:2em;max-width:40vw;object-fit:contain;vertical-align:middle">`;
    } else {
      navName.textContent = globalState.name;
    }
  }

  const parts = (globalState.name || '').split(' ');
  const line1 = parts[0] || '';
  const line2 = parts.slice(1).join(' ') || '';

  scrambleHero(globalState.role || '', line1, line2);

  // Render demo reel
  const reelEl = document.getElementById('reel');
  if (!reelEl) return;

  if (globalState.reel && globalState.reel.url) {
    const url = globalState.reel.url;
    if (globalState.reel.type === 'youtube') {
        reelEl.innerHTML = `<iframe title="Demo reel" src="${url}" allow="autoplay; fullscreen" allowfullscreen></iframe><div id="reel-block"></div>`;
    } else if (globalState.reel.type === 'vimeo') {
        reelEl.innerHTML = `<iframe id="bg-reel-iframe" title="Demo reel" src="${url}" allow="autoplay; fullscreen" allowfullscreen></iframe><div id="reel-block"></div>`;
      // Try to initialize Vimeo player if available
      if (window.Vimeo) {
        bgPlayer = new window.Vimeo.Player(document.getElementById('bg-reel-iframe'));
      }
    } else if (globalState.reel.type === 'video') {
      reelEl.innerHTML = `<video autoplay muted loop playsinline preload="auto" src="${url}"></video><div id="reel-block"></div>`;
      const v = reelEl.querySelector('video');
      if (v) v.play().catch(() => {});
    }
  } else {
    reelEl.innerHTML = `<div id="rp"><div class="pg"></div><div class="pi"><div class="bp"><div class="bpt"></div></div><p class="pl">Demo Reel Goes Here</p></div></div>`;
  }
}

/**
 * Render work section with project grid and filters
 */
function renderWorkSection({ showAll = false } = {}) {
  const filtersEl = document.getElementById('work-filters');
  const gridEl = document.getElementById('wg');

  if (!filtersEl || !gridEl) return;

  const filters = globalState.filters || [
    { value: '2d', label: '2D' },
    { value: '3d', label: '3D' },
    { value: 'motion', label: 'Motion' }
  ];

  const visibleProjects = projects.filter(p => showAll || p.published !== false);
  const activeTypes = new Set(visibleProjects.map(p => p.type));
  const visibleFilters = filters.filter(f => activeTypes.has(f.value));

  filtersEl.innerHTML =
    `<button class="fb active" onclick="window.display?.filterWork?.(this, 'all')">All</button>` +
    visibleFilters.map(f => `<button class="fb" onclick="window.display?.filterWork?.(this, '${f.value}')">${f.label}</button>`).join('');

  gridEl.innerHTML = renderWorkGrid(projects, globalState.theme, { showAll });

  // Initialize sensitive tapes
  initSensitiveTapes(projects, { showAll });

  // Initialize countup animations (lazy)
  setTimeout(initCountUps, 100);
}

/**
 * Render about panel
 */
function renderAboutPanel() {
  const aboutEl = document.getElementById('about-body');
  if (aboutEl) {
    aboutEl.innerHTML = renderDisplayBlocks(normalizeBlocks(globalState.about || []), { scope: 'about' });
    // Trigger skill bar animation when about is visible
    setTimeout(() => {
      document.querySelectorAll('#skl .skf').forEach(b => b.classList.add('go'));
    }, 340);
  }
}

/**
 * Render contact section (including tickers)
 */
function renderContactSection() {
  const ctData = renderContactPanel(globalState);

  contactHeroText = {
    title: ctData.heroTitle || "Let's",
    accent: ctData.heroAccent || 'work.'
  };

  // Update hero text
  const ctHero = document.querySelector('.ct-hero');
  if (ctHero) ctHero.innerHTML = ctData.hero;

  // Update subtitle
  const ctSub = document.querySelector('.ct-sub');
  if (ctSub) {
    ctSub.innerHTML = ctData.sub;
    ctSub.setAttribute('data-canvas-editable', 'true');
    ctSub.setAttribute('data-canvas-scope', 'contact');
    ctSub.setAttribute('data-canvas-field', 'sub');
  }

  // Update email label
  const ctEmailLabel = document.querySelector('.ct-email-label');
  if (ctEmailLabel) {
    ctEmailLabel.textContent = ctData.emailLabel;
    ctEmailLabel.setAttribute('data-canvas-editable', 'true');
    ctEmailLabel.setAttribute('data-canvas-scope', 'contact');
    ctEmailLabel.setAttribute('data-canvas-field', 'emailLabel');
  }

  // Update social label
  const ctSocialLabel = document.querySelector('.ct-social-label');
  if (ctSocialLabel) {
    ctSocialLabel.textContent = ctData.socialLabel;
    ctSocialLabel.setAttribute('data-canvas-editable', 'true');
    ctSocialLabel.setAttribute('data-canvas-scope', 'contact');
    ctSocialLabel.setAttribute('data-canvas-field', 'socialLabel');
  }

  // Update location
  const ctLocation = document.getElementById('ct-location');
  if (ctLocation) {
    ctLocation.textContent = (globalState.name || '') + (globalState.location ? '\u00a0·\u00a0' + globalState.location : '');
  }

  // Update email link
  const email = globalState.contact?.email || '';
  const ctEmailLink = document.getElementById('ct-email-link');
  if (ctEmailLink) {
    ctEmailLink.href = email ? 'mailto:' + email : '#';
  }
  const ctEmailText = document.getElementById('ct-email-text');
  if (ctEmailText) ctEmailText.textContent = email;

  // Update footer
  const ctFooterName = document.getElementById('ct-footer-name');
  if (ctFooterName) ctFooterName.textContent = globalState.name || '';

  const ctFooterLoc = document.getElementById('ct-footer-loc');
  if (ctFooterLoc) ctFooterLoc.textContent = globalState.location || '';

  // Update social icons
  const ctIcons = document.getElementById('ct-icons');
  if (ctIcons) ctIcons.innerHTML = ctData.icons;

  // Update resume link
  const ctResumeWrap = document.getElementById('ct-resume-wrap');
  if (ctResumeWrap) {
    if (globalState.contact?.resume) {
      ctResumeWrap.style.display = '';
      const ctResumeLink = document.getElementById('ct-resume-link');
      if (ctResumeLink) ctResumeLink.href = globalState.contact.resume;
    } else {
      ctResumeWrap.style.display = 'none';
    }
  }

  // Update tickers
  const tickerTopTrack = document.querySelector('#ct-ticker-top .ticker-track');
  if (tickerTopTrack) tickerTopTrack.innerHTML = ctData.tickerTop;

  const tickerMidTrack = document.querySelector('#ct-ticker-mid .ticker-track');
  if (tickerMidTrack) tickerMidTrack.innerHTML = ctData.tickerMid;

  // Update contact panel background video
  const ctBgVideo = document.getElementById('ct-bg-video');
  if (ctBgVideo) {
    const cp = globalState.contactPanel || {};
    const vid = cp.video && cp.video.url && cp.video.type !== 'placeholder' ? cp.video : globalState.reel;

    if (vid && vid.url) {
      if (vid.type === 'vimeo' || vid.type === 'youtube') {
        ctBgVideo.innerHTML = `<iframe title="Contact panel background video" src="${vid.url}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
      } else if (vid.type === 'video') {
        ctBgVideo.innerHTML = `<video autoplay muted loop playsinline preload="auto" src="${vid.url}"></video>`;
        const v = ctBgVideo.querySelector('video');
        if (v) v.play().catch(() => {});
      }
    }
  }

  // Apply contact theme colors
  const theme = globalState.theme || {};
  document.documentElement.style.setProperty('--ct-accent', theme.ctAccent || '#ff4361');
  document.documentElement.style.setProperty('--ct-bg', theme.ctBg || '#080808');
  document.documentElement.style.setProperty('--ct-hi', theme.ctHi || '#ffffff');
  document.documentElement.style.setProperty('--ct-muted', 'rgba(255,255,255,0.6)');

  startContactTickers();

  const contactWrapper = document.getElementById('contact-wrapper');
  if (contactWrapper && contactWrapper.classList.contains('open')) {
    replayContactHeroScramble();
  }
}

function startContactTickers() {
  const topTrack = document.querySelector('#ct-ticker-top .ticker-track');
  const midTrack = document.querySelector('#ct-ticker-mid .ticker-track');

  if (topTrack && !topTrack._tickerRunning) {
    startTicker(topTrack, -0.6);
  }
  if (midTrack && !midTrack._tickerRunning) {
    startTicker(midTrack, 0.5);
  }

  contactTickersStarted = true;
}

function runWhenLayoutStable(task) {
  const run = () => {
    // Double RAF gives the browser a frame to apply final styles before layout reads.
    requestAnimationFrame(() => {
      requestAnimationFrame(task);
    });
  };

  if (document.readyState === 'complete') {
    run();
    return;
  }

  window.addEventListener('load', run, { once: true });
}

async function loadLogStack() {
  const inner = document.getElementById('ls-inner');
  const stack = document.getElementById('log-stack');
  if (!inner || !stack) return;

  try {
    const response = await fetch('log.json');
    if (!response.ok) throw new Error('Failed to load log.json');
    const entries = await response.json();

    if (!Array.isArray(entries) || entries.length === 0) {
      inner.innerHTML = '';
      stack.style.height = '0px';
      return;
    }

    inner.innerHTML = '';

    const SHOW = 8;
    let rotateIdx = entries.length - 1;
    const recent = entries.slice(-SHOW);
    const logSpanGroups = [];

    function buildEntry(text, opacity) {
      const span = document.createElement('span');
      span.className = 'ls-entry';
      span.dataset.opacity = opacity;
      span.innerHTML = String(text || '')
        .split('')
        .map(ch =>
          ch === ' '
            ? '<span class="sc-char" data-ch=" " style="opacity:0">&nbsp;</span>'
            : `<span class="sc-char" data-ch="${ch}" style="opacity:0">${ch}</span>`
        )
        .join('');
      return span;
    }

    function scrambleEntry(entry, delay) {
      const spans = Array.from(entry.querySelectorAll('.sc-char'));
      logSpanGroups.push(spans);

      const revealWindowMs = 550;
      const revealableChars = spans.filter(span => span.dataset.ch !== ' ').length;
      const perCharDelay = revealableChars > 1 ? revealWindowMs / (revealableChars - 1) : 0;
      let revealIndex = 0;

      spans.forEach(span => {
        const ch = span.dataset.ch;
        const isSpace = ch === ' ';
        const charPool = isSpace ? [' '] : pool(ch);
        let tick = 0;
        const cycles = 6;
        const staggerDelay = isSpace ? revealIndex * perCharDelay : revealIndex++ * perCharDelay;

        setTimeout(() => {
          span.style.opacity = '1';
          if (isSpace) {
            span.innerHTML = '&nbsp;';
            return;
          }

          function cycle() {
            if (tick < cycles) {
              const overshoot = Math.max(0, tick - (cycles - 3));
              span.textContent = charPool[tick % charPool.length];
              tick++;
              setTimeout(cycle, 90 * (1 + overshoot * 1.4));
            } else {
              span.textContent = ch;
            }
          }

          cycle();
        }, delay + staggerDelay);
      });

      return spans;
    }

    recent.forEach((entry, i) => {
      const opacity = 0.1 + (i / (recent.length - 1 || 1)) * 0.9;
      const row = buildEntry(entry.text, opacity);
      inner.appendChild(row);
      const delay = 1400 + i * 120;
      setTimeout(() => {
        row.style.opacity = opacity;
        scrambleEntry(row, 0);
      }, delay);
    });

    setTimeout(() => {
      runWhenLayoutStable(() => {
        stack.style.height = inner.offsetHeight + 'px';
      });
    }, 1400 + recent.length * 120 + 500);

    const logIdleStart = 1400 + recent.length * 120 + 2000;
    setTimeout(() => scheduleIdle(logSpanGroups), logIdleStart);

    if (entries.length > 1) {
      function rotateStack() {
        rotateIdx = (rotateIdx + 1) % entries.length;
        const newEntry = buildEntry(entries[rotateIdx].text, 0);
        newEntry.style.opacity = '0';
        inner.appendChild(newEntry);

        runWhenLayoutStable(() => {
          const topEntry = inner.querySelector('.ls-entry');
          const innerStyles = window.getComputedStyle(inner);
          const gap = parseFloat(innerStyles.rowGap || innerStyles.gap || '0') || 0;
          const shiftRaw = topEntry ? topEntry.getBoundingClientRect().height + gap : 18;
          const shift = Math.max(18, Math.round(shiftRaw));

          let finalized = false;
          let cleanupFallback = null;

          const finalizeRotation = () => {
            if (finalized) return;
            finalized = true;
            if (cleanupFallback) clearTimeout(cleanupFallback);

            const top = inner.querySelector('.ls-entry');
            if (top) top.remove();
            inner.style.transition = 'none';
            inner.style.transform = 'translateY(0)';
            requestAnimationFrame(() => {
              inner.style.transition = '';
            });
          };

          const onTransformEnd = event => {
            if (event.target !== inner || event.propertyName !== 'transform') return;
            inner.removeEventListener('transitionend', onTransformEnd);
            finalizeRotation();
          };

          inner.addEventListener('transitionend', onTransformEnd);
          inner.style.transform = `translateY(-${shift}px)`;

          setTimeout(() => {
            newEntry.style.opacity = '1';
            const allEntries = Array.from(inner.querySelectorAll('.ls-entry'));
            const top = allEntries[0];
            if (top) top.style.opacity = '0';

            allEntries.slice(1).forEach((item, i) => {
              item.dataset.opacity = 0.1 + (i / (SHOW - 1)) * 0.9;
              item.style.opacity = item.dataset.opacity;
            });

            const spans = scrambleEntry(newEntry, 0);
            logSpanGroups.push(spans);
            if (logSpanGroups.length > SHOW) logSpanGroups.shift();
          }, 600);

          cleanupFallback = setTimeout(() => {
            inner.removeEventListener('transitionend', onTransformEnd);
            finalizeRotation();
          }, 1500);
        });

        setTimeout(rotateStack, 12000);
      }

      setTimeout(rotateStack, logIdleStart + 12000);
    }
  } catch (error) {
    console.warn('Could not load log stack:', error);
  }
}

/**
 * Update like button UI
 */
function updateLikeUI(count, liked) {
  const icon = document.getElementById('pp-like-icon');
  const countEl = document.getElementById('pp-like-count');
  const btn = document.getElementById('pp-like-btn');
  if (icon) icon.className = liked ? 'ph-fill ph-heart' : 'ph-fill ph-heart';
  if (countEl) countEl.textContent = count > 0 ? count : '';
  if (btn) btn.classList.toggle('liked', !!liked);
}

/**
 * Fetch like count for a project (sessionStorage-cached per tab session)
 */
async function fetchLikeCount(id) {
  if (new URLSearchParams(location.search).has('preview')) return;

  const cacheKey = `rgr_likes_${id}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { count, liked } = JSON.parse(cached);
      updateLikeUI(count, liked);
      return;
    } catch (_) { /* fall through to fetch */ }
  }

  try {
    const vid = getVisitorId();
    const res = await fetch(`${LIKES_API}/${encodeURIComponent(id)}?vid=${encodeURIComponent(vid)}`);
    const data = await res.json();
    sessionStorage.setItem(cacheKey, JSON.stringify({ count: data.count, liked: data.liked }));
    updateLikeUI(data.count, data.liked);
  } catch (e) {
    console.warn('Failed to fetch likes:', e);
  }
}

/**
 * Set up UI event listeners
 */
function setupEventListeners() {
  // Filter work by type
  window.display = {
    filterWork(btn, type) {
      document.querySelectorAll('.fb').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('#wg .wc').forEach(c => {
        const show = type === 'all' || c.dataset.type === type;
        c.style.opacity = show ? '1' : '0.15';
        c.style.pointerEvents = show ? '' : 'none';
      });
    },

    async openProject(id) {
      const ppb = document.getElementById('ppb');
      if (ppb) {
        ppb.innerHTML = '<p style="font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.12em">Loading project...</p>';
        ppb.scrollTop = 0;
      }

      const project = await fetchProjectById(id);
      if (!project) {
        if (ppb) ppb.innerHTML = '<p style="font-size:.75rem;color:var(--muted)">Unable to load this project right now.</p>';
        return;
      }

      // Build hero header
      const heroImg = project.heroImage || project.thumbnail || '';
      const heroStyle = heroImg ? `background-image:url('${heroImg}')` : '';
      const heroHTML = `<div class="pp-hero" style="${heroStyle}">
        <div class="pp-hero-overlay"></div>
        <div class="pp-hero-actions">
          <button class="pp-hero-btn pp-like-btn" id="pp-like-btn" onclick="window.display?.toggleLike?.()" title="Like"><i id="pp-like-icon" class="ph-fill ph-heart"></i> <span id="pp-like-count">—</span></button>
          <button class="pp-hero-btn" id="pp-share" onclick="window.display?.copyShareLink?.()" title="Copy share link"><i class="ph-fill ph-share-network"></i> Share</button>
        </div>
        <div class="pp-hero-content">
          <div class="pp-hero-left">
            <h2 class="pp-hero-title">${(project.title || '').replace(/ /, '<br>')}</h2>
            <div class="pp-hero-meta">
              ${project.typeLabel ? `<span class="pp-hero-tag">${project.typeLabel}</span>` : ''}
              ${project.year ? `<span class="pp-hero-tag">${project.year}</span>` : ''}
              ${project.client ? `<span class="pp-hero-tag">${project.client}</span>` : ''}
            </div>
          </div>

        </div>
      </div>`;

      if (ppb) {
        ppb.innerHTML = heroHTML + renderDisplayBlocks(normalizeBlocks(project.blocks || []), {
          scope: 'proj-' + id,
          projectId: id
        });
      }

      // Fetch like count
      fetchLikeCount(id);

      const pp = document.getElementById('pp');
      if (pp) {
        const isLongform = project.longform === true;
        // Reset to base state so the next open animation always starts from
        // the correct origin (bottom for longform, right side for default).
        pp.classList.remove('open');
        pp.classList.add('no-transition');
        pp.classList.toggle('longform', isLongform);
        // Force style flush before re-opening so CSS transitions reliably run.
        void pp.offsetWidth;
        pp.classList.remove('no-transition');
        requestAnimationFrame(() => {
          pp.classList.add('open');
        });
      }

      const bd = document.getElementById('bd');
      if (bd) {
        bd.classList.add('open');
        bd.classList.add('project-open');
      }

      // Update URL bar so the link is shareable
      const url = new URL(window.location);
      url.searchParams.set('project', id);
      history.pushState({ project: id }, '', url);
    },

    closeProject() {
      const pp = document.getElementById('pp');
      if (pp) {
        suspendMediaIn(pp);
        pp.classList.remove('open');
      }

      const bd = document.getElementById('bd');
      if (bd) {
        bd.classList.remove('project-open');
        // If no panel is open behind the project, also remove the backdrop
        const anyPanelOpen = document.querySelector('.panel.open') || document.querySelector('#contact-wrapper.open');
        if (!anyPanelOpen) bd.classList.remove('open');
      }

      // Clear project from URL bar
      const url = new URL(window.location);
      url.searchParams.delete('project');
      history.pushState({}, '', url);
    },

    copyShareLink() {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('project');
      if (!id) return;
      const shareUrl = `https://rungirlrun.studio/p/${id}/`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        const btn = document.querySelector('.pp-hero-btn:last-child') || document.getElementById('pp-share');
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = '&#x2713; Copied!';
          setTimeout(() => { btn.innerHTML = orig; }, 2000);
        }
      });
    },

    async toggleLike() {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('project');
      if (!id) return;
      const vid = getVisitorId();
      try {
        const res = await fetch(`${LIKES_API}/${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vid })
        });
        const data = await res.json();
        sessionStorage.setItem(`rgr_likes_${id}`, JSON.stringify({ count: data.count, liked: data.liked }));
        updateLikeUI(data.count, data.liked);
      } catch (e) {
        console.warn('Like failed:', e);
      }
    },

    openLightbox() {
      const lightboxReel = globalState.watchReel && globalState.watchReel.url ? globalState.watchReel : globalState.reel;
      if (!lightboxReel || !lightboxReel.url) {
        alert('Add your reel URL to content.json first!');
        return;
      }

      let src = lightboxReel.url;

      if (lightboxReel.type === 'youtube') {
        src = src.replace('&controls=0', '').replace('&mute=1', '');
        if (!src.includes('controls=1')) src += '&controls=1';
      } else if (lightboxReel.type === 'vimeo') {
        src = src.replace('background=1', 'background=0').replace('&muted=1', '').replace('autoplay=1', 'autoplay=0');
        if (!src.includes('autoplay')) src += '&autoplay=1';
      }

      const lbFrame = document.getElementById('lb-frame');
      const lbLabel = document.getElementById('lb-label');
      if (lbFrame) {
        if (lightboxReel.type === 'video') {
          lbFrame.innerHTML = `<video id="lb-video" controls autoplay playsinline preload="auto" src="${src}" style="width:100%;height:100%;max-height:80vh;"></video>`;
        } else {
          lbFrame.innerHTML = `<iframe id="lb-iframe" title="Demo reel player" src="${src}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
        }
      }
      if (lbLabel) lbLabel.textContent = 'Demo Reel';
      lightboxMode = 'reel';

      const lightbox = document.getElementById('lightbox');
      if (lightbox) lightbox.classList.add('open');

      if (lightboxReel.type === 'vimeo' && window.Vimeo) {
        const lbPlayer = new window.Vimeo.Player(document.getElementById('lb-iframe'));
        lbPlayer.ready().then(() => lbPlayer.play().catch(() => {}));
      }
    },

    closeLightbox() {
      const lightbox = document.getElementById('lightbox');
      if (lightbox) lightbox.classList.remove('open');

      setTimeout(() => {
        const lbFrame = document.getElementById('lb-frame');
        const lbLabel = document.getElementById('lb-label');
        if (lbFrame) lbFrame.innerHTML = '';
        if (lbLabel) lbLabel.textContent = 'Demo Reel';
        if (lightboxMode === 'reel' && bgPlayer) bgPlayer.play().catch(() => {});
        lightboxMode = 'reel';
      }, 400);
    },

    openImageLightbox(src, alt) {
      if (!src) return;
      const lbFrame = document.getElementById('lb-frame');
      const lbLabel = document.getElementById('lb-label');
      const lightbox = document.getElementById('lightbox');
      if (!lbFrame || !lightbox) return;

      lbFrame.innerHTML = `<img id="lb-image" src="${src}" alt="${alt || ''}">`;
      if (lbLabel) lbLabel.textContent = 'Gallery Image';
      lightboxMode = 'image';
      lightbox.classList.add('open');
    },

    openPanel(name) {
      const projectPanel = document.getElementById('pp');
      if (projectPanel && projectPanel.classList.contains('open')) {
        this.closeProject();
      }

      const aboutPanel = document.getElementById('panel-about');
      const workPanel = document.getElementById('panel-work');
      const contactPanel = document.getElementById('contact-wrapper');
      suspendMediaIn(aboutPanel);
      suspendMediaIn(workPanel);
      // Contact background video runs continuously; only suspend on close, not on panel switches.

      if (name === 'contact') {
        const contact = document.getElementById('contact-wrapper');
        const stage = document.getElementById('stage');
        const bd = document.getElementById('bd');
        if (contact) contact.classList.add('open');
        if (stage) stage.classList.add('contact-open');
        if (bd) bd.classList.add('open');
        replayContactHeroScramble();
        if (!contactTickersStarted) startContactTickers();
      } else {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
        const contact = document.getElementById('contact-wrapper');
        const stage = document.getElementById('stage');
        if (contact) contact.classList.remove('open');
        if (stage) stage.classList.remove('contact-open');
        const panel = document.getElementById('panel-' + name);
        const bd = document.getElementById('bd');
        if (panel) panel.classList.add('open');
        if (bd) bd.classList.add('open');
        resumeMediaIn(panel);
      }
    },

    closeToRoot() {
      const aboutPanel = document.getElementById('panel-about');
      const workPanel = document.getElementById('panel-work');
      const contactPanel = document.getElementById('contact-wrapper');
      const projectPanel = document.getElementById('pp');
      suspendMediaIn(aboutPanel);
      suspendMediaIn(workPanel);
      // Contact background video runs continuously — never suspend it.
      suspendMediaIn(projectPanel);

      document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
      const contact = document.getElementById('contact-wrapper');
      const stage = document.getElementById('stage');
      const bd = document.getElementById('bd');
      if (contact) contact.classList.remove('open');
      if (stage) stage.classList.remove('contact-open');
      if (bd) {
        bd.classList.remove('open');
        bd.classList.remove('project-open');
      }

      if (contactHeroIdleController && typeof contactHeroIdleController.cancel === 'function') {
        contactHeroIdleController.cancel();
        contactHeroIdleController = null;
      }
    },

    smartClose() {
      // Close project if open, else close panels
      const pp = document.getElementById('pp');
      if (pp && pp.classList.contains('open')) {
        this.closeProject();
      } else {
        this.closeToRoot();
      }
    }
  };

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('lightbox')?.classList.contains('open')) {
        window.display?.closeLightbox?.();
      } else {
        window.display?.smartClose?.();
      }
    }
  });

  // Contact panel scroll effects
  const contactWrapper = document.getElementById('contact-wrapper');
  if (contactWrapper) {
    contactWrapper.addEventListener(
      'scroll',
      () => {
        updateContactPanelBackground(contactWrapper.scrollTop);
      },
      { passive: true }
    );
  }

  // Cursor tracking
  const cur = document.getElementById('cur');
  if (cur) {
    document.addEventListener('mousemove', e => {
      cur.style.left = e.clientX + 'px';
      cur.style.top = e.clientY + 'px';
    }, { passive: true });

    const isInteractive = el =>
      el.closest('a, button, [onclick], [role="button"], label[for], .pp-hero-btn, .pp-like-btn, .nav-dot, .ct-scroll-cue, #watch-reel, .proj-card, .back-to-top, .faq-q');
    document.addEventListener('mouseover', e => {
      if (isInteractive(e.target)) document.body.classList.add('ch');
    }, { passive: true });
    document.addEventListener('mouseout', e => {
      if (isInteractive(e.target)) document.body.classList.remove('ch');
    }, { passive: true });
  }

  // Open gallery items from project content in the shared lightbox.
  document.addEventListener('click', e => {
    const img = e.target.closest('.bl-gallery-open');
    if (!img) return;
    e.preventDefault();
    window.display?.openImageLightbox?.(img.dataset.fullSrc || img.src, img.dataset.fullAlt || img.alt || '');
  });

  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-faq-trigger]');
    if (!trigger) return;
    toggleFaqItem(trigger.closest('[data-faq-item]'));
  });

  document.addEventListener('pointerdown', e => {
    const handle = e.target.closest('[data-before-after-handle]');
    if (!handle) return;
    const container = handle.closest('[data-before-after]');
    if (!container) return;
    activeBeforeAfter = container;
    setBeforeAfterPosition(container, getBeforeAfterPosition(container, e.clientX));
  });

  document.addEventListener('pointermove', e => {
    if (!activeBeforeAfter) return;
    setBeforeAfterPosition(activeBeforeAfter, getBeforeAfterPosition(activeBeforeAfter, e.clientX));
  });

  document.addEventListener('pointerup', () => {
    activeBeforeAfter = null;
  });

  document.addEventListener('pointercancel', () => {
    activeBeforeAfter = null;
  });

  document.addEventListener('keydown', e => {
    const handle = e.target.closest('[data-before-after-handle]');
    if (!handle) return;

    const container = handle.closest('[data-before-after]');
    if (!container) return;

    const current = parseFloat(container.style.getPropertyValue('--before-after-pos')) || 67;
    let next = current;

    if (e.key === 'ArrowLeft') next = current - 2;
    if (e.key === 'ArrowRight') next = current + 2;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = 100;

    if (next !== current) {
      e.preventDefault();
      setBeforeAfterPosition(container, next);
    }
  });
}

/**
 * Handle preview data from editor
 */
function setupEditorPreviewBridge() {
  if (new URLSearchParams(location.search).has('preview') && window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'preview-ready' }, '*');
    setupCanvasEditListeners();
  }

  window.addEventListener('message', e => {
    if (e.data.type === 'preview-data') {
      Object.assign(globalState, e.data.content);
      projectCache.clear();
      projects.length = 0;
      projects.push(...(e.data.projects || []));
      projects.forEach(rememberProject);

      // Re-render everything
      applyTheme(globalState.theme);
      updateDocumentMeta();
      renderHero();
      renderWorkSection();
      renderAboutPanel();
      renderContactSection();
      loadLogStack();
    } else if (e.data.type === 'preview-nav') {
      // Messages can arrive before event handlers are fully initialized.
      pendingPreviewNav = e.data;
      applyPreviewNavigation(e.data);
    } else if (e.data.type === 'canvas-edit-mode') {
      canvasEditEnabled = !!e.data.enabled;
      document.body.classList.toggle('canvas-edit-enabled', canvasEditEnabled);
      if (!canvasEditEnabled && canvasEditActiveElement) {
        finishCanvasEdit(false);
      }
    }
  });
}

function getCanvasEditPayload(el) {
  if (!el) return null;

  const scope = el.getAttribute('data-canvas-scope') || '';
  const field = el.getAttribute('data-canvas-field') || '';
  if (!scope || !field) return null;

  return {
    scope,
    field,
    blockId: el.getAttribute('data-canvas-block-id') || '',
    projectId: el.getAttribute('data-canvas-project-id') || ''
  };
}

function startCanvasEdit(el) {
  if (!canvasEditEnabled || !el) return;
  if (canvasEditActiveElement === el) return;

  if (canvasEditActiveElement) finishCanvasEdit(true);

  const payload = getCanvasEditPayload(el);
  if (!payload) return;

  canvasEditActiveElement = el;
  canvasEditOriginalText = el.textContent || '';
  el.setAttribute('contenteditable', 'true');
  el.setAttribute('spellcheck', 'false');
  el.classList.add('canvas-edit-active');
  el.focus();

  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  window.parent.postMessage({ type: 'canvas-start-edit', payload }, '*');
}

function finishCanvasEdit(commit) {
  const el = canvasEditActiveElement;
  if (!el) return;

  const payload = getCanvasEditPayload(el);
  if (!payload) return;

  const nextValue = (el.textContent || '').trim();
  if (!commit) {
    el.textContent = canvasEditOriginalText;
    window.parent.postMessage({ type: 'canvas-cancel-edit', payload }, '*');
  } else {
    window.parent.postMessage({
      type: 'canvas-commit-edit',
      payload: {
        ...payload,
        value: nextValue
      }
    }, '*');
  }

  el.removeAttribute('contenteditable');
  el.removeAttribute('spellcheck');
  el.classList.remove('canvas-edit-active');
  canvasEditActiveElement = null;
  canvasEditOriginalText = '';
}

function setupCanvasEditListeners() {
  if (canvasEditListenersBound) return;
  canvasEditListenersBound = true;
  ensureCanvasEditStyles();

  document.addEventListener('click', e => {
    if (!canvasEditEnabled) return;
    const target = e.target.closest('[data-canvas-editable="true"]');
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();
    startCanvasEdit(target);
  });

  document.addEventListener('keydown', e => {
    if (!canvasEditEnabled || !canvasEditActiveElement) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      finishCanvasEdit(false);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      finishCanvasEdit(true);
    }
  });

  document.addEventListener('focusout', e => {
    if (!canvasEditEnabled || !canvasEditActiveElement) return;
    if (e.target !== canvasEditActiveElement) return;

    setTimeout(() => {
      if (!canvasEditActiveElement) return;
      if (document.activeElement === canvasEditActiveElement) return;
      finishCanvasEdit(true);
    }, 0);
  });
}

export { renderDisplayBlocks };
