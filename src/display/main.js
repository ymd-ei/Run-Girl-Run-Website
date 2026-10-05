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
import { setRefContext } from '../utils/refs.js';
import { privacyEmbedUrl, loadVimeoApi } from '../utils/embeds.js';
import { DEFAULT_FILTERS, projectTypes, projectTypeLabels } from '../utils/projectTypes.js';
import { applySiteText, availability, renderLegal, initLegalModal, siteText } from './siteChrome.js';
import { initA11y, reducedMotion } from '../utils/a11y.js';
import { isLite, bindLiteToggles } from '../utils/lite.js';
import { updateLikeUI, fetchLikeCount, sendLike, loadLikeCounts, copyShareLink as copyShare } from './likes.js';
import { renderFilterRow, markCardLikes } from './workFilters.js';
import {
  loadFeed, withFilters, postCardHTML, postBodyHTML, postHero, postTitle, fmtDate, likeKey,
  masonry, cardPositions, initThumbShapes, SOURCES
} from './feed.js';

let bgPlayer = null;
let contactTickersStarted = false;
let contactHeroIdleController = null;
let contactHeroText = { title: "Let's", accent: 'work.' };
let pendingPreviewNav = null;

// Loading screen (default): lifts once the brand intro has played; the hero video
// fades in when it can play, and the contact video keeps downloading in the
// background. ?waitload restores the old behaviour for comparison: stay up until
// the hero + contact videos can play through (capped at LOADER_MAX_MS).
const LOADER_MIN_MS = 1500;
const LOADER_MAX_MS = 7000;
const FAST_LOAD = !new URLSearchParams(location.search).has('waitload');
const loaderVideos = [];
let releaseLoaderGate = () => {};   // bootstrap calls this once every gated video is rendered
let loaderActive = false;
// Social feed (#rgr posts) shown in the Work grid next to projects
let feedPosts = [];
let workShowAll = false;
let workFilter = 'all';
let workSort = 'newest';        // 'newest' | 'likes' | 'shuffle'
let shuffleOrder = [];          // card keys in the order the last Shuffle dealt them
const likeCounts = new Map();   // likes API key -> count, filled when sorting by likes
let openItem = null;            // { kind: 'project' | 'post', id } in the #pp panel
const cardHtml = new Map();     // key -> markup last rendered, so unchanged cards are reused
const parkedCards = new Map();  // key -> card element filtered out, kept so it returns without reloading
const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let canvasEditEnabled = false;
let canvasEditActiveElement = null;
let canvasEditOriginalText = '';
let canvasEditListenersBound = false;

// Editor v3 mode: the site is running inside the v3 editor iframe. Enables
// block-root wrappers + the in-iframe selection overlay. Visitor renders are
// unaffected (this is false unless ?editor=v3 is present).
const EDITOR_V3 = new URLSearchParams(location.search).get('editor') === 'v3';

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
let curWorkBadge = null;
let curWorkBadgeDismissed = false;
let curWorkBadgeDismissTimer = null;

function ensureCursorWorkBadge() {
  if (curWorkBadge) return curWorkBadge;
  if (window.matchMedia('(pointer: coarse)').matches) return null;

  curWorkBadge = document.createElement('div');
  curWorkBadge.id = 'cur-work-badge';
  curWorkBadge.textContent = availability(globalState).text;
  document.body.appendChild(curWorkBadge);
  return curWorkBadge;
}

function updateCursorWorkBadge(x, y, visible = true) {
  if (!availability(globalState).enabled) return;
  const badge = ensureCursorWorkBadge();
  if (!badge) return;
  if (curWorkBadgeDismissed) return;

  badge.style.transform = `translate(${x}px, ${y}px) translateY(-50%)`;

  if (visible && !badge.classList.contains('is-visible')) {
    badge.classList.add('is-visible');
    if (!curWorkBadgeDismissTimer) {
      curWorkBadgeDismissTimer = setTimeout(() => {
        curWorkBadgeDismissed = true;
        badge.classList.remove('is-visible');
      }, 10000);
    }
  }
}

function hideCursorWorkBadge() {
  if (!curWorkBadge || curWorkBadgeDismissed) return;
  curWorkBadge.classList.remove('is-visible');
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

function setNativeCursorEnabled(enabled) {
  // Accessibility default: the normal system cursor unless customCursor is true in site-config.js
  const customCursor = !!(window.RGR_CONFIG && window.RGR_CONFIG.customCursor);
  document.body.classList.toggle('native-cursor', !customCursor || !!enabled);
  // native-cursor-forced = fullscreen / popups, where the work badge must hide too
  document.body.classList.toggle('native-cursor-forced', !!enabled);
}

function setReelPopupCursorDisabled(disabled) {
  document.body.classList.toggle('reel-popup-open', !!disabled);
}

function syncCursorForFullscreen() {
  const reelPopupOpen = document.body.classList.contains('reel-popup-open');
  const fullscreenActive = !!(document.fullscreenElement || document.webkitFullscreenElement);
  setNativeCursorEnabled(reelPopupOpen || fullscreenActive);
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
  const nameText = nameEl.dataset.name || document.title;

  function runLoaderName() {
    if (reducedMotion()) { nameEl.textContent = nameText; return; }
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

  loaderActive = true;
  const loaderStart = performance.now();
  let videosReady = false;
  const registered = new Promise(resolve => { releaseLoaderGate = resolve; });
  const gate = FAST_LOAD
    ? Promise.resolve()
    : registered.then(() => Promise.all(loaderVideos.map(videoCanPlayThrough)));
  Promise.race([gate, new Promise(r => setTimeout(r, LOADER_MAX_MS))]).then(() => { videosReady = true; });

  // A couple of quick randomized stops for the intro, then the bar follows the
  // real video buffering until the gate opens.
  const numStops = 2 + Math.floor(Math.random() * 2);
  const stops = [];
  let cursor = 0;
  for (let i = 0; i < numStops; i++) {
    cursor += 12 + Math.random() * 22;
    if (cursor < 70) stops.push(Math.round(cursor));
  }

  function tweenBar(from, to, duration, done) {
    // rAF is paused in background tabs; skip the animation there (and for reduced motion).
    if (document.hidden || reducedMotion()) { bar.style.width = to + '%'; return done(); }
    const startTime = performance.now();
    function step(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      bar.style.width = from + (to - from) * eased + '%';
      if (t < 1) requestAnimationFrame(step);
      else done();
    }
    requestAnimationFrame(step);
  }

  let stopIdx = 0;
  let shown = 0;
  function animateBar() {
    if (stopIdx >= stops.length || reducedMotion()) return waitForVideos();
    const target = stops[stopIdx++];
    tweenBar(shown, target, 200 + Math.random() * 180, () => {
      shown = target;
      setTimeout(animateBar, 90 + Math.random() * 160);
    });
  }

  function waitForVideos() {
    if (videosReady && performance.now() - loaderStart >= LOADER_MIN_MS) {
      tweenBar(shown, 100, 280, () => setTimeout(dismiss, 200));
      return;
    }
    // Follow real buffering, with a slow creep so the bar never looks frozen.
    const real = loaderVideoProgress() || 0;
    shown = Math.min(95, Math.max(shown + (90 - shown) * 0.008, real * 95));
    bar.style.width = shown + '%';
    setTimeout(waitForVideos, 50);
  }

  function dismiss() {
    if (!loaderActive) return;
    loaderActive = false;
    loader.classList.add('done');
    // Let the loader fade begin before revealing the full page state.
    setTimeout(() => {
      document.body.classList.remove('page-loading');
    }, 220);
  }

  setTimeout(animateBar, 120);
  // Hard cap, independent of the bar animation.
  setTimeout(dismiss, LOADER_MAX_MS + 1000);
}

/** Gate a background video behind the loading screen (first load only). */
function trackLoaderVideo(video) {
  if (!loaderActive || !video) return;
  loaderVideos.push(video);
  if (FAST_LOAD) {
    // Fade the video in once it can play. Not 'playing', which
    // never fires when autoplay is blocked (background tab, iOS Low Power).
    video.style.opacity = '0';
    video.style.transition = 'opacity .6s ease';
    const show = () => { video.style.opacity = '1'; };
    if (video.readyState >= 3) show();
    else video.addEventListener('canplay', show, { once: true });
  }
}

function videoCanPlayThrough(video) {
  return new Promise(resolve => {
    if (video.readyState >= 4 || video.error) return resolve();
    video.addEventListener('canplaythrough', resolve, { once: true });
    video.addEventListener('error', resolve, { once: true });
  });
}

/** Average buffered fraction of the gated videos, or null if unknown yet. */
function loaderVideoProgress() {
  const parts = loaderVideos.map(v => {
    if (v.readyState >= 4) return 1;
    if (!v.duration || !v.buffered.length) return 0;
    return Math.min(1, v.buffered.end(v.buffered.length - 1) / v.duration);
  });
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
}

/**
 * Bootstrap the public display site
 */
export async function bootstrap() {
  try {
    runLoaderAnimation();
    initLegalModal();
    initA11y();

    // Set up bridge immediately to avoid missing the editor's first preview push.
    setupEditorPreviewBridge();

    // 1. Load data
    await loadAllData();
    setRefContext(globalState, projects);
    applySiteChrome();

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
      // Default: only published projects (renderWorkSection filters them)
      renderWorkSection();
    }

    // 6. Render about panel
    renderAboutPanel();

    // 7. Render contact panel
    renderContactSection();
    releaseLoaderGate();

    // 8. Set up event listeners
    setupEventListeners();

    // Footer "Lite mode" switch: swap the background videos for their posters
    bindLiteToggles(() => { renderStageReel(); renderContactBg(); });

    // {project:id} shortcut links open the project in place instead of reloading.
    document.addEventListener('click', e => {
      const a = e.target.closest('a.ref-link[href^="?project="]');
      if (!a) return;
      e.preventDefault();
      window.display?.openProject?.(new URLSearchParams(a.getAttribute('href')).get('project'));
    });

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

    // 10. Social feed: tagged posts join the Work grid once they arrive.
    //     ?post=id deep links open after that.
    initThumbShapes();
    refreshFeed().then(() => {
      const postParam = params.get('post');
      if (postParam) window.display?.openPost?.(postParam, { skipHistory: true });
    });

    console.log('✓ Display Bootstrap Complete');
  } catch (error) {
    console.error('✗ Display bootstrap failed:', error);
    releaseLoaderGate();
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
 * Site-wide chrome from Site settings: editable text, availability badge,
 * Privacy & Legal popup.
 */
function applySiteChrome() {
  applySiteText(globalState);

  const avail = availability(globalState);
  const sh = document.getElementById('sh');
  if (sh) sh.style.display = avail.enabled ? '' : 'none';
  const availText = document.getElementById('avail-text');
  if (availText) availText.textContent = avail.text;
  if (curWorkBadge) {
    curWorkBadge.textContent = avail.text;
    if (!avail.enabled) curWorkBadge.classList.remove('is-visible');
  }

  renderLegal(globalState, document.getElementById('legal-card'));
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

  renderStageReel();
}

/** The looping reel behind the home screen; in lite mode just its poster. */
function renderStageReel() {
  const reelEl = document.getElementById('reel');
  if (!reelEl) return;
  bgPlayer = null;

  if (globalState.reel && globalState.reel.url && isLite()) {
    const poster = globalState.reel.poster;
    reelEl.innerHTML = (poster ? `<img src="${encodeURI(poster)}" alt="">` : '') + '<div id="reel-block"></div>';
  } else if (globalState.reel && globalState.reel.url) {
    const url = globalState.reel.url;
    if (globalState.reel.type === 'youtube') {
        reelEl.innerHTML = `<iframe title="Demo reel" src="${privacyEmbedUrl(url)}" allow="autoplay; fullscreen" allowfullscreen></iframe><div id="reel-block"></div>`;
    } else if (globalState.reel.type === 'vimeo') {
        reelEl.innerHTML = `<iframe id="bg-reel-iframe" title="Demo reel" src="${privacyEmbedUrl(url)}" allow="autoplay; fullscreen" allowfullscreen></iframe><div id="reel-block"></div>`;
      // Try to initialize Vimeo player if available
      loadVimeoApi().then(Vimeo => {
        const iframe = document.getElementById('bg-reel-iframe');
        if (Vimeo && iframe) bgPlayer = new Vimeo.Player(iframe);
      });
    } else if (globalState.reel.type === 'video') {
      const poster = globalState.reel.poster ? ` poster="${encodeURI(globalState.reel.poster)}"` : '';
      reelEl.innerHTML = `<video autoplay muted loop playsinline preload="auto"${poster} src="${encodeURI(url)}"></video><div id="reel-block"></div>`;
      const v = reelEl.querySelector('video');
      trackLoaderVideo(v);
      if (v) v.play().catch(() => {});
    }
  } else {
    reelEl.innerHTML = `<div id="rp"><div class="pg"></div><div class="pi"><div class="bp"><div class="bpt"></div></div><p class="pl">Demo Reel Goes Here</p></div></div>`;
  }
}

/**
 * Render work section with project grid and filters
 */
function renderWorkSection({ showAll = workShowAll } = {}) {
  workShowAll = showAll;
  const filtersEl = document.getElementById('work-filters');
  const gridEl = document.getElementById('wg');

  if (!filtersEl || !gridEl) return;

  const filters = globalState.filters || DEFAULT_FILTERS;

  const visibleProjects = projects.filter(p => showAll || p.published !== false);
  const activeTypes = new Set([...visibleProjects.flatMap(projectTypes), ...feedPosts.flatMap(p => p.filters)]);
  const visibleFilters = filters.filter(f => activeTypes.has(f.value));
  if (workFilter !== 'all' && !activeTypes.has(workFilter)) workFilter = 'all';

  // Sort: a quiet text dropdown on the right (Shuffle only locally or in demo mode)
  const sorts = [['newest', 'Newest'], ['likes', 'Most liked'], ...(IS_LOCAL || DEMO_MODE ? [['shuffle', 'Shuffle']] : [])];
  renderFilterRow(filtersEl, { filters: visibleFilters, active: workFilter, sorts, sort: workSort, showSort: feedPosts.length > 0 });

  // Newest first, projects and posts together. On the same day a project goes
  // ahead of a post, and projects with the same date keep their hand-set order.
  // Most liked ranks both together.
  let items = [
    ...visibleProjects.map(p => ({ key: p.id, project: true, date: projectDate(p), types: projectTypes(p), html: renderWorkGrid([p], globalState.theme, { showAll }) })),
    ...feedPosts.map(p => ({ key: likeKey(p.id), date: p.date, types: p.filters, html: postCardHTML(p, filters) })),
  ];
  items = items.map((x, i) => [x, i]).sort(([a, i], [b, j]) =>
    b.date.slice(0, 10).localeCompare(a.date.slice(0, 10))
    || (b.project ? 1 : 0) - (a.project ? 1 : 0)
    || (a.project ? i - j : new Date(b.date) - new Date(a.date)))
    .map(([x]) => x);
  if (workSort === 'shuffle') {
    const rank = new Map(shuffleOrder.map((k, i) => [k, i]));
    items = items.map((x, i) => [x, rank.has(x.key) ? rank.get(x.key) : shuffleOrder.length + i])
      .sort((a, b) => a[1] - b[1]).map(([x]) => x);
  }
  if (workSort === 'likes') items = items.map((x, i) => [x, i])
    .sort((a, b) => (likeCounts.get(b[0].key) || 0) - (likeCounts.get(a[0].key) || 0) || a[1] - b[1])
    .map(([x]) => x);

  // A filter shows only its cards; the rest re-stack around them
  if (workFilter !== 'all') items = items.filter(x => x.types.includes(workFilter));

  const before = cardPositions(gridEl);
  // Keep cards that are still shown (same markup) so their images and shapes
  // don't reload; they just slide. Cards that drop out fade away; new ones fade in.
  const existing = new Map([...gridEl.children].filter(el => el.dataset.key && !el.classList.contains('wc-leave')).map(el => [el.dataset.key, el]));
  const nodes = items.map(x => {
    const same = cardHtml.get(x.key) === x.html;
    const old = existing.get(x.key);
    if (old && same) { existing.delete(x.key); return old; }
    const parked = parkedCards.get(x.key);
    if (parked && same) {
      // Back from a filter: same element, so the image and shape are already there
      parkedCards.delete(x.key);
      clearTimeout(parked._leaveTimer);
      parked.classList.remove('wc-leave');
      delete parked.dataset.pos; // place it fresh (fades in at its new spot)
      return parked;
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = x.html;
    const el = tmp.firstElementChild;
    cardHtml.set(x.key, x.html);
    if (!el.dataset.key) {
      // Project cards need the same key the stacking uses to animate them
      el.dataset.key = x.key;
      // Projects count as their own source for the 2×2 feature (newest square one)
      const proj = visibleProjects.find(p => p.id === x.key);
      el.dataset.source = 'project';
      el.dataset.date = proj ? projectDate(proj) : '';
      el.dataset.order = visibleProjects.indexOf(proj);
    }
    return el;
  });
  existing.forEach((el, key) => {
    el.classList.add('wc-leave');
    parkedCards.set(key, el);
    el._leaveTimer = setTimeout(() => el.remove(), 400);
  });
  [...gridEl.querySelectorAll(':scope > :not(.wc)')].forEach(el => el.remove()); // e.g. an old "nothing here" note
  nodes.forEach(el => gridEl.appendChild(el));
  markCardLikes(nodes, items.map(x => x.key), likeCounts, workSort === 'likes');
  masonry(gridEl, before);

  // Initialize sensitive tapes
  initSensitiveTapes(projects, { showAll });

  // Initialize countup animations (lazy)
  setTimeout(initCountUps, 100);
}

/* Copy-email button next to the mailto link: for webmail users, or when no mail
   app opens. Falls back to selecting the text where the clipboard API is blocked. */
function setupCopyEmail(email) {
  const btn = document.getElementById('ct-copy-email');
  if (!btn) return;
  btn.hidden = !email;
  btn.dataset.email = email || '';
  if (btn.dataset.bound) return;
  btn.dataset.bound = '1';
  const label = btn.querySelector('span');
  btn.addEventListener('click', async () => {
    const value = btn.dataset.email;
    let ok = false;
    try { await navigator.clipboard.writeText(value); ok = true; } catch (e) {
      const t = document.createElement('textarea');
      t.value = value; t.setAttribute('readonly', ''); t.style.position = 'absolute'; t.style.left = '-9999px';
      document.body.appendChild(t); t.select();
      try { ok = document.execCommand('copy'); } catch (_) {}
      t.remove();
    }
    if (!ok) return;
    btn.classList.add('is-copied');
    label.textContent = 'Copied';
    clearTimeout(btn._reset);
    btn._reset = setTimeout(() => { btn.classList.remove('is-copied'); label.textContent = 'Copy email'; }, 2000);
  });
}

/** Every card the grid could show (any filter), for likes and Shuffle. */
function allCardKeys() {
  return [
    ...projects.filter(p => workShowAll || p.published !== false).map(p => p.id),
    ...feedPosts.map(p => likeKey(p.id)),
  ];
}

// Testing aids. ?demo fills the grid with placeholder posts (src/display/feedDemo.js)
// to judge the layout on any screen; visitors without ?demo never see them.
// Shuffle shows on a local copy or in demo mode only.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const DEMO_MODE = new URLSearchParams(location.search).has('demo');
const demoLiked = new Set();

async function refreshFeed() {
  try {
    feedPosts = await loadFeed(globalState);
  } catch (e) {
    console.warn('Feed failed to load:', e);
    feedPosts = [];
  }
  if (DEMO_MODE) {
    const { demoPosts, demoLikes } = await import('./feedDemo.js');
    feedPosts = withFilters([...feedPosts, ...demoPosts()], globalState);
    Object.entries(demoLikes()).forEach(([k, v]) => { if (!likeCounts.has(k)) likeCounts.set(k, v); });
    if (!document.getElementById('demo-indicator')) {
      const tag = document.createElement('div');
      tag.id = 'demo-indicator';
      tag.textContent = 'Demo content — placeholder posts';
      tag.style = 'position:fixed;bottom:1rem;left:1rem;background:#1a1a1a;color:#fff;padding:.5em 1em;border-radius:6px;font-size:.75rem;z-index:9999;opacity:.85;pointer-events:none;';
      document.body.appendChild(tag);
    }
  }
  renderWorkSection();
}

const isDemoKey = key => String(key).startsWith('demo-');

/** Counts for every card, fetched once when someone sorts by likes. */
async function loadAllLikes() {
  await loadLikeCounts(allCardKeys(), likeCounts);
}

/** A project's own date; older ones without it count as the end of their year. */
const projectDate = p => p.date || (p.year || '0') + '-12-31';

/** End of a post: two more pieces (same filter first), all 16:9. */
function moreWorkHTML(post) {
  const filters = globalState.filters || DEFAULT_FILTERS;
  const candidates = [
    ...feedPosts.filter(p => p.id !== post.id).map(p => ({ types: p.filters, date: p.date, html: postCardHTML(p, filters, { uniform: true }) })),
    ...projects.filter(p => workShowAll || p.published !== false).map(p => ({ types: projectTypes(p), date: projectDate(p), html: renderWorkGrid([p], globalState.theme, { showAll: workShowAll }) })),
  ];
  const same = candidates.filter(x => x.types.some(t => post.filters.includes(t)));
  const picks = [...same, ...candidates.filter(x => !same.includes(x)).sort((a, b) => new Date(b.date) - new Date(a.date))].slice(0, 2);
  if (!picks.length) return '';
  const label = post.filters.length === 1 && picks.every(x => x.types.includes(post.filters[0]))
    ? (filters.find(f => f.value === post.filters[0])?.label || '') + ' ' : '';
  return `<div class="more-work"><p class="more-head">More ${label}work</p><div class="wg">${picks.map(x => x.html).join('')}</div></div>`;
}

function contactPromptHTML() {
  const avail = availability(globalState);
  const headline = avail.enabled && avail.text ? avail.text : `Work with ${globalState.name || 'us'}`;
  return `<div class="bl-cta post-contact">
    <div class="bl-cta-copy">
      <p class="bl-cta-headline">${headline}</p>
      <p class="bl-cta-body">${globalState.name || ''} is an animation studio${globalState.location ? ' in ' + globalState.location : ''}. Got a project in mind?</p>
    </div>
    <button class="bl-cta-link" onclick="window.display?.openPanel?.('contact')">Get in touch</button>
  </div>`;
}

/** Open #pp with its usual slide-in (shared by projects and posts). */
function showProjectPanel(isLongform) {
  const pp = document.getElementById('pp');
  if (pp) {
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
}

/**
 * Render about panel
 */
function renderAboutPanel() {
  const aboutEl = document.getElementById('about-body');
  if (aboutEl) {
    aboutEl.innerHTML = renderDisplayBlocks(normalizeBlocks(globalState.about || []), { scope: 'about', editor: EDITOR_V3 });
    // Trigger skill bar animation when about is visible
    setTimeout(() => {
      document.querySelectorAll('#skl .skf').forEach(b => b.classList.add('go'));
    }, 340);
  }
}

/** The contact panel's looping background; in lite mode just its poster. */
function renderContactBg() {
  const ctBgVideo = document.getElementById('ct-bg-video');
  if (ctBgVideo) {
    const cp = globalState.contactPanel || {};
    const vid = cp.video && cp.video.url && cp.video.type !== 'placeholder' ? cp.video : globalState.reel;

    if (vid && vid.url && isLite()) {
      ctBgVideo.innerHTML = vid.poster ? `<img src="${encodeURI(vid.poster)}" alt="">` : '';
    } else if (vid && vid.url) {
      if (vid.type === 'vimeo' || vid.type === 'youtube') {
        ctBgVideo.innerHTML = `<iframe title="Contact panel background video" src="${privacyEmbedUrl(vid.url)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
      } else if (vid.type === 'video') {
        const poster = vid.poster ? ` poster="${encodeURI(vid.poster)}"` : '';
        ctBgVideo.innerHTML = `<video autoplay muted loop playsinline preload="auto"${poster} src="${encodeURI(vid.url)}"></video>`;
        const v = ctBgVideo.querySelector('video');
        trackLoaderVideo(v);
        if (v) v.play().catch(() => {});
      }
    }
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
  setupCopyEmail(email);
  const legalEmail = document.getElementById('legal-email');
  if (legalEmail && email) {
    legalEmail.href = 'mailto:' + email;
    legalEmail.textContent = email;
  }

  // Update footer
  const ctFooterName = document.getElementById('ct-footer-name');
  if (ctFooterName) ctFooterName.textContent = globalState.name || '';

  const ctFooterLoc = document.getElementById('ct-footer-loc');
  if (ctFooterLoc) ctFooterLoc.textContent = globalState.location || '';

  // Update social icons
  const ctIcons = document.getElementById('ct-icons');
  if (ctIcons) ctIcons.innerHTML = ctData.icons;

  // Update resume link
  const ctResumeLabel = document.getElementById('ct-resume-label');
  if (ctResumeLabel) ctResumeLabel.textContent = globalState.contactPanel?.resumeLabel || 'Credentials';
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

  renderContactBg();

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

/**
 * Set up UI event listeners
 */
function setupEventListeners() {
  // Filter work by type
  window.display = {
    filterWork(btn, type) {
      workFilter = type;
      renderWorkSection();
    },

    async sortWork(sort) {
      workSort = sort;
      if (sort === 'shuffle') {
        // Each click deals a new order; it holds until the next click
        const keys = allCardKeys();
        for (let i = keys.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [keys[i], keys[j]] = [keys[j], keys[i]];
        }
        shuffleOrder = keys;
      }
      if (sort === 'likes') await loadAllLikes();
      renderWorkSection();
    },

    openPost(id, options) {
      const post = feedPosts.find(p => p.id === id);
      if (!post) return;
      openItem = { kind: 'post', id };
      const ppb = document.getElementById('ppb');
      const s = SOURCES[post.source] || { label: post.source };
      const filters = globalState.filters || DEFAULT_FILTERS;
      // Text-only posts use the site's default banner (Site settings) if one is set
      const heroImg = postHero(post)?.url || globalState.postBanner || '';
      const heroHTML = `<div class="pp-hero${heroImg ? '' : ' pp-hero-plain'}" style="${heroImg ? `background-image:url('${heroImg.replace(/'/g, '%27')}')` : ''}">
        <div class="pp-hero-overlay"></div>
        <div class="pp-hero-actions">
          <button class="pp-hero-btn pp-like-btn" id="pp-like-btn" onclick="window.display?.toggleLike?.()" title="Like" aria-label="Like" aria-pressed="false"><i id="pp-like-icon" class="ph-fill ph-heart" aria-hidden="true"></i> <span id="pp-like-count">—</span></button>
          <button class="pp-hero-btn" id="pp-share" onclick="window.display?.copyShareLink?.()" title="Copy share link" aria-live="polite"><i class="ph-fill ph-share-network" aria-hidden="true"></i> Share</button>
        </div>
        <div class="pp-hero-content">
          <div class="pp-hero-left">
            <h2 class="pp-hero-title">${escHtml(postTitle(post))}</h2>
            <div class="pp-hero-meta">
              <span class="pp-hero-tag">${s.label}</span>
              ${post.filters.map(v => `<span class="pp-hero-tag">${escHtml(filters.find(f => f.value === v)?.label || v)}</span>`).join('')}
              <span class="pp-hero-tag">${fmtDate(post.date)}</span>
            </div>
          </div>
        </div>
      </div>`;

      if (ppb) {
        ppb.innerHTML = heroHTML + postBodyHTML(post) + `<div class="block-canvas post-end">${moreWorkHTML(post)}${contactPromptHTML()}</div>`;
        ppb.scrollTop = 0;
      }

      if (isDemoKey(likeKey(id))) updateLikeUI(likeCounts.get(likeKey(id)) || 0, demoLiked.has(likeKey(id)));
      else fetchLikeCount(likeKey(id));
      showProjectPanel(false);

      if (!options?.skipHistory) {
        const url = new URL(window.location);
        url.searchParams.delete('project');
        url.searchParams.set('post', id);
        history.pushState({ post: id }, '', url);
      }
    },

    async openProject(id, options) {
      const ppb = document.getElementById('ppb');
      if (ppb) {
        ppb.innerHTML = '<p style="font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.12em">Loading project...</p>';
        ppb.scrollTop = 0;
      }

      openItem = { kind: 'project', id };
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
          <button class="pp-hero-btn pp-like-btn" id="pp-like-btn" onclick="window.display?.toggleLike?.()" title="Like" aria-label="Like" aria-pressed="false"><i id="pp-like-icon" class="ph-fill ph-heart" aria-hidden="true"></i> <span id="pp-like-count">—</span></button>
          <button class="pp-hero-btn" id="pp-share" onclick="window.display?.copyShareLink?.()" title="Copy share link" aria-live="polite"><i class="ph-fill ph-share-network" aria-hidden="true"></i> Share</button>
        </div>
        <div class="pp-hero-content">
          <div class="pp-hero-left">
            <h2 class="pp-hero-title">${(project.title || '').replace(/ /, '<br>')}</h2>
            <div class="pp-hero-meta">
              ${projectTypeLabels(project, globalState.filters).map(l => `<span class="pp-hero-tag">${l}</span>`).join('')}
              ${project.year ? `<span class="pp-hero-tag">${project.year}</span>` : ''}
              ${project.client ? `<span class="pp-hero-tag">${project.client}</span>` : ''}
            </div>
          </div>

        </div>
      </div>`;

      if (ppb) {
        ppb.innerHTML = heroHTML + renderDisplayBlocks(normalizeBlocks(project.blocks || []), {
          scope: 'proj-' + id,
          projectId: id,
          editor: EDITOR_V3
        });
      }

      // Fetch like count
      fetchLikeCount(id);

      showProjectPanel(project.longform === true);

      // Update URL bar so the link is shareable
      if (!options?.skipHistory) {
        const url = new URL(window.location);
        url.searchParams.delete('post');
        url.searchParams.set('project', id);
        history.pushState({ project: id }, '', url);
      }
    },

    closeProject(options) {
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

      openItem = null;

      // Clear project / post from URL bar
      if (!options?.skipHistory) {
        const url = new URL(window.location);
        url.searchParams.delete('project');
        url.searchParams.delete('post');
        history.pushState({}, '', url);
      }
    },

    copyShareLink() {
      if (openItem) copyShare(openItem);
    },

    async toggleLike() {
      if (!openItem) return;
      const id = openItem.kind === 'post' ? likeKey(openItem.id) : openItem.id;
      if (isDemoKey(id)) { // demo posts never touch the real likes store
        const on = !demoLiked.has(id);
        on ? demoLiked.add(id) : demoLiked.delete(id);
        likeCounts.set(id, (likeCounts.get(id) || 0) + (on ? 1 : -1));
        updateLikeUI(likeCounts.get(id), on);
        return;
      }
      const data = await sendLike(id);
      if (data && likeCounts.has(id)) likeCounts.set(id, data.count);
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
          lbFrame.innerHTML = `<iframe id="lb-iframe" title="Demo reel player" src="${privacyEmbedUrl(src)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
        }
      }
      if (lbLabel) lbLabel.textContent = siteText(globalState, 'reelLabel');
      lightboxMode = 'reel';

      const lightbox = document.getElementById('lightbox');
      if (lightbox) lightbox.classList.add('open');
      setReelPopupCursorDisabled(true);
      setNativeCursorEnabled(true);

      if (lightboxReel.type === 'vimeo') {
        loadVimeoApi().then(Vimeo => {
          const iframe = document.getElementById('lb-iframe');
          if (!Vimeo || !iframe) return;
          const lbPlayer = new Vimeo.Player(iframe);
          lbPlayer.ready().then(() => lbPlayer.play().catch(() => {}));
        });
      }
    },

    closeLightbox() {
      const lightbox = document.getElementById('lightbox');
      if (lightbox) lightbox.classList.remove('open');
      setReelPopupCursorDisabled(false);
      syncCursorForFullscreen();

      setTimeout(() => {
        const lbFrame = document.getElementById('lb-frame');
        const lbLabel = document.getElementById('lb-label');
        if (lbFrame) lbFrame.innerHTML = '';
        if (lbLabel) lbLabel.textContent = siteText(globalState, 'reelLabel');
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
      setNativeCursorEnabled(true);
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
        if (contact) contact.classList.add('open');
        if (stage) stage.classList.add('contact-open');
        document.getElementById('ct-sliver')?.classList.add('open');
        // Slide UI elements left in sync — inline styles beat animation fills
        const _uiEls = ['nav','ht','sh','watch-reel-wrap'].map(id => document.getElementById(id)).filter(Boolean);
        _uiEls.forEach(el => { el.style.transition = 'transform .8s cubic-bezier(0.16,1,0.3,1)'; });
        requestAnimationFrame(() => { _uiEls.forEach(el => { el.style.transform = 'translateX(calc(-1 * var(--ct-panel-w)))'; }); });
        // No #bd needed — contact has its own full dark background
        replayContactHeroScramble();
        if (!contactTickersStarted) startContactTickers();
      } else {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
        const contact = document.getElementById('contact-wrapper');
        const stage = document.getElementById('stage');
        if (contact) contact.classList.remove('open');
        if (stage) stage.classList.remove('contact-open');
        document.getElementById('ct-sliver')?.classList.remove('open');
        ['nav','ht','sh','watch-reel-wrap'].forEach(id => { const el = document.getElementById(id); if (el) el.style.transform = ''; });
        const panel = document.getElementById('panel-' + name);
        const bd = document.getElementById('bd');
        if (panel) panel.classList.add('open');
        if (bd) bd.classList.add('open');
        resumeMediaIn(panel);
      }
    },

    // The skip link: straight to the first Work card, past the hero and nav
    skipToWork() {
      // Closing Work then returns focus to the Work nav button, not the skip link
      // (which would show its tag again)
      document.querySelector('#nav [data-site-text="navWork"]')?.focus({ preventScroll: true });
      this.openPanel('work');
      requestAnimationFrame(() => {
        const first = document.querySelector('#wg .wc:not(.wc-leave)');
        (first || document.getElementById('panel-work'))?.focus({ preventScroll: true });
      });
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
      document.getElementById('ct-sliver')?.classList.remove('open');
      ['nav','ht','sh','watch-reel-wrap'].forEach(id => { const el = document.getElementById(id); if (el) el.style.transform = ''; });
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

  // Browser back/forward navigation
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(location.search);
    const id = params.get('project');
    const postId = params.get('post');
    const pp = document.getElementById('pp');
    const isOpen = pp && pp.classList.contains('open');

    if (id && openItem?.id !== id) {
      window.display?.openProject(id, { skipHistory: true });
    } else if (postId && openItem?.id !== postId) {
      window.display?.openPost(postId, { skipHistory: true });
    } else if (!id && !postId && isOpen) {
      window.display?.closeProject({ skipHistory: true });
    }
  });

  // Keep native cursor visible while browser/media fullscreen is active.
  document.addEventListener('fullscreenchange', syncCursorForFullscreen);
  document.addEventListener('webkitfullscreenchange', syncCursorForFullscreen);

  // Contact panel scroll effects
  const contactWrapper = document.getElementById('contact-wrapper');
  if (contactWrapper) {
    contactWrapper.addEventListener(
      'scroll',
      () => {
        // The panel only scrolls vertically; undo any sideways shift (e.g. a
        // trackpad swipe in Safari) so content is never cut off on the left.
        if (contactWrapper.scrollLeft) contactWrapper.scrollLeft = 0;
        updateContactPanelBackground(contactWrapper.scrollTop);
      },
      { passive: true }
    );
  }

  syncCursorForFullscreen(); // applies the customCursor setting on load

  // Cursor tracking
  const cur = document.getElementById('cur');
  if (cur) {
    ensureCursorWorkBadge();

    document.addEventListener('mousemove', e => {
      const hiddenCursorMode =
        document.body.classList.contains('native-cursor-forced') ||
        document.body.classList.contains('reel-popup-open');

      if (hiddenCursorMode) {
        hideCursorWorkBadge();
        return;
      }

      if (document.body.classList.contains('native-cursor')) {
        // normal system cursor: skip the custom dot but keep the work badge beside the pointer
        updateCursorWorkBadge(e.clientX, e.clientY, true);
        return;
      }

      cur.style.left = e.clientX + 'px';
      cur.style.top = e.clientY + 'px';
      updateCursorWorkBadge(e.clientX, e.clientY, true);
    }, { passive: true });

    document.addEventListener('mouseleave', hideCursorWorkBadge, { passive: true });
    window.addEventListener('blur', hideCursorWorkBadge, { passive: true });

    const isInteractive = el =>
      el.closest('a, button, [onclick], [role="button"], label[for], .pp-hero-btn, .pp-like-btn, .nav-dot, .ct-scroll-cue, #watch-reel, .proj-card, .back-to-top, .faq-q');
    document.addEventListener('mouseover', e => {
      if (isInteractive(e.target)) document.body.classList.add('ch');
    }, { passive: true });
    document.addEventListener('mouseout', e => {
      if (isInteractive(e.target)) {
        document.body.classList.remove('ch');
      }
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
    if (EDITOR_V3) {
      import('../editor-v3/canvasOverlay.js')
        .then(m => m.initCanvasOverlay())
        .catch(err => console.warn('v3 canvas overlay failed to load', err));
    }
  }

  window.addEventListener('message', e => {
    if (e.origin !== location.origin) return;
    if (e.data.type === 'preview-data') {
      Object.assign(globalState, e.data.content);
      projectCache.clear();
      projects.length = 0;
      projects.push(...(e.data.projects || []));
      projects.forEach(rememberProject);
      setRefContext(globalState, projects);

      // Re-render everything
      applySiteChrome();
      applyTheme(globalState.theme);
      updateDocumentMeta();
      renderHero();
      renderWorkSection();
      renderAboutPanel();
      renderContactSection();
      refreshFeed();
    } else if (e.data.type === 'preview-nav') {
      // Messages can arrive before event handlers are fully initialized.
      pendingPreviewNav = e.data;
      applyPreviewNavigation(e.data);
    } else if (e.data.type === 'canvas-insert-text') {
      insertIntoCanvasEdit(String(e.data.text || ''));
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

  const rawItem = el.getAttribute('data-canvas-item');

  return {
    scope,
    field,
    blockId: el.getAttribute('data-canvas-block-id') || '',
    projectId: el.getAttribute('data-canvas-project-id') || '',
    item: rawItem == null || rawItem === '' ? null : Number(rawItem)
  };
}

function startCanvasEdit(el) {
  if (!canvasEditEnabled || !el) return;
  if (canvasEditActiveElement === el) return;

  if (canvasEditActiveElement) finishCanvasEdit(true);

  const payload = getCanvasEditPayload(el);
  if (!payload) return;

  canvasEditActiveElement = el;
  canvasEditOriginalText = el.innerHTML;
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

  const nextValue = cleanEditedHTML(el);
  if (commit && nextValue === cleanEditedHTML(htmlToElement(canvasEditOriginalText))) commit = false;
  if (!commit) {
    el.innerHTML = canvasEditOriginalText;
    window.parent.postMessage({ type: 'canvas-cancel-edit', payload }, '*');
  } else {
    el.innerHTML = nextValue; // show exactly what was saved
    window.parent.postMessage({
      type: 'canvas-commit-edit',
      payload: {
        ...payload,
        value: nextValue
      }
    }, '*');
  }

  canvasEditRange = null;
  el.removeAttribute('contenteditable');
  el.removeAttribute('spellcheck');
  el.classList.remove('canvas-edit-active');
  canvasEditActiveElement = null;
  canvasEditOriginalText = '';
}

// Inline edits keep simple formatting (line breaks, italics, bold, <rgr>
// highlights, links) instead of flattening to plain text. Anything else the
// browser or a paste adds is unwrapped to its text.
const EDIT_KEEP_TAGS = new Set(['BR', 'I', 'EM', 'B', 'STRONG', 'U', 'RGR', 'A']);

function htmlToElement(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div;
}

function cleanEditedHTML(el) {
  const root = el.cloneNode(true);
  const clean = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType !== 1) {
        if (child.nodeType !== 3) child.remove();
        return;
      }
      clean(child);
      const tag = child.tagName;
      if (tag === 'DIV' || tag === 'P') {
        // Line breaks typed with Shift+Enter can arrive as blocks.
        if (child.previousSibling) child.before(document.createElement('br'));
        child.replaceWith(...child.childNodes);
      } else if (!EDIT_KEEP_TAGS.has(tag)) {
        child.replaceWith(...child.childNodes);
      } else {
        [...child.attributes].forEach(a => {
          if (!(tag === 'A' && ['href', 'target', 'rel'].includes(a.name))) child.removeAttribute(a.name);
        });
      }
    });
  };
  clean(root);
  return root.innerHTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/(<br>\s*)+$/, '')
    .trim();
}

// Caret inside the text being edited, kept so the editor's "Insert reference"
// menu (in the parent window) can insert at the right spot.
let canvasEditRange = null;
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (!canvasEditActiveElement || !sel || !sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  if (canvasEditActiveElement.contains(r.commonAncestorContainer)) canvasEditRange = r.cloneRange();
});

function insertIntoCanvasEdit(text) {
  const el = canvasEditActiveElement;
  if (!el || !text) return;
  el.focus();
  let range = canvasEditRange && el.contains(canvasEditRange.commonAncestorContainer) ? canvasEditRange : null;
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  canvasEditRange = range.cloneRange();
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
