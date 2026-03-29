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
  initCountUps,
  updateContactPanelBackground,
  renderDisplayBlocks
} from './displayRenderer.js';
import { startTicker } from '../utils/svg.js';
import { phosphorIcon } from '../utils/icons.js';
import { pool, scheduleIdle } from '../utils/text.js';

let bgPlayer = null;
let contactTickersStarted = false;

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

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nameText = 'RUN GIRL RUN';

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
    document.body.classList.remove('page-loading');
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
    renderWorkSection();

    // 5b. Render lower-right updates stack from log.json
    await loadLogStack();

    // 6. Render about panel
    renderAboutPanel();

    // 7. Render contact panel
    renderContactSection();

    // 8. Set up event listeners
    setupEventListeners();

    console.log('✓ Display Bootstrap Complete');
  } catch (error) {
    console.error('✗ Display bootstrap failed:', error);
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
    const contentRes = await fetch('content.json?v=' + Date.now());
    if (!contentRes.ok) throw new Error('Failed to load content.json');
    const contentData = await contentRes.json();

    Object.assign(globalState, contentData);

    // Load projects
    const projectIds = globalState.projects || [];
    const loadedProjects = await Promise.all(
      projectIds.map(id =>
        fetch('projects/' + id + '.json?v=' + Date.now())
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

    projects.length = 0;
    projects.push(...loadedProjects.filter(p => p !== null));

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
    const src = globalState.favicon + '?v=' + Date.now();
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
    navName.textContent = globalState.name;
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
      reelEl.innerHTML = `<iframe src="${url}" allow="autoplay; fullscreen" allowfullscreen></iframe><div id="reel-block"></div>`;
    } else if (globalState.reel.type === 'vimeo') {
      reelEl.innerHTML = `<iframe id="bg-reel-iframe" src="${url}" allow="autoplay; fullscreen" allowfullscreen></iframe><div id="reel-block"></div>`;
      // Try to initialize Vimeo player if available
      if (window.Vimeo) {
        bgPlayer = new window.Vimeo.Player(document.getElementById('bg-reel-iframe'));
      }
    } else if (globalState.reel.type === 'video') {
      reelEl.innerHTML = `<video autoplay muted loop playsinline src="${url}"></video><div id="reel-block"></div>`;
    }
  } else {
    reelEl.innerHTML = `<div id="rp"><div class="pg"></div><div class="pi"><div class="bp"><div class="bpt"></div></div><p class="pl">Demo Reel Goes Here</p></div></div>`;
  }
}

/**
 * Render work section with project grid and filters
 */
function renderWorkSection() {
  const filtersEl = document.getElementById('work-filters');
  const gridEl = document.getElementById('wg');

  if (!filtersEl || !gridEl) return;

  const filters = globalState.filters || [
    { value: '2d', label: '2D' },
    { value: '3d', label: '3D' },
    { value: 'motion', label: 'Motion' }
  ];

  filtersEl.innerHTML =
    `<button class="fb active" onclick="window.display?.filterWork?.(this, 'all')">All</button>` +
    filters.map(f => `<button class="fb" onclick="window.display?.filterWork?.(this, '${f.value}')">${f.label}</button>`).join('');

  gridEl.innerHTML = renderWorkGrid(projects, globalState.theme);

  // Initialize sensitive tapes
  initSensitiveTapes(projects);

  // Initialize countup animations (lazy)
  setTimeout(initCountUps, 100);
}

/**
 * Render about panel
 */
function renderAboutPanel() {
  const aboutEl = document.getElementById('about-body');
  if (aboutEl) {
    aboutEl.innerHTML = renderDisplayBlocks(globalState.about || []);
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

  // Update hero text
  const ctHero = document.querySelector('.ct-hero');
  if (ctHero) ctHero.innerHTML = ctData.hero;

  // Update subtitle
  const ctSub = document.querySelector('.ct-sub');
  if (ctSub) ctSub.innerHTML = ctData.sub;

  // Update email label
  const ctEmailLabel = document.querySelector('.ct-email-label');
  if (ctEmailLabel) ctEmailLabel.textContent = ctData.emailLabel;

  // Update social label
  const ctSocialLabel = document.querySelector('.ct-social-label');
  if (ctSocialLabel) ctSocialLabel.textContent = ctData.socialLabel;

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
        ctBgVideo.innerHTML = `<iframe src="${vid.url}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
      } else if (vid.type === 'video') {
        ctBgVideo.innerHTML = `<video autoplay muted loop playsinline src="${vid.url}"></video>`;
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
    const response = await fetch('log.json?v=' + Date.now());
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

      spans.forEach((span, j) => {
        const ch = span.dataset.ch;
        const isSpace = ch === ' ';
        const charPool = isSpace ? [' '] : pool(ch);
        let tick = 0;
        const cycles = 6;

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
        }, delay + j * 55);
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
          const actualH = topEntry ? topEntry.offsetHeight + 5 : 18;
          inner.style.transform = `translateY(-${actualH}px)`;

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

          setTimeout(() => {
            const top = inner.querySelector('.ls-entry');
            if (top) top.remove();
            inner.style.transition = 'none';
            inner.style.transform = 'translateY(0)';
            requestAnimationFrame(() => {
              inner.style.transition = '';
            });
          }, 1250);
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

    openProject(id) {
      const project = projects.find(p => p.id === id);
      if (!project) return;

      const ppb = document.getElementById('ppb');
      if (ppb) {
        ppb.innerHTML = renderDisplayBlocks(project.blocks || []);
        ppb.scrollTop = 0;
      }

      const pp = document.getElementById('pp');
      if (pp) pp.classList.add('open');
    },

    closeProject() {
      const pp = document.getElementById('pp');
      if (pp) pp.classList.remove('open');
    },

    openLightbox() {
      if (!globalState.reel || !globalState.reel.url) {
        alert('Add your reel URL to content.json first!');
        return;
      }

      let src = globalState.reel.url;

      if (globalState.reel.type === 'youtube') {
        src = src.replace('&controls=0', '').replace('&mute=1', '');
        if (!src.includes('controls=1')) src += '&controls=1';
      } else if (globalState.reel.type === 'vimeo') {
        src = src.replace('background=1', 'background=0').replace('&muted=1', '').replace('autoplay=1', 'autoplay=0');
        if (!src.includes('autoplay')) src += '&autoplay=1';
      }

      const lbFrame = document.getElementById('lb-frame');
      if (lbFrame) {
        lbFrame.innerHTML = `<iframe id="lb-iframe" src="${src}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
      }

      const lightbox = document.getElementById('lightbox');
      if (lightbox) lightbox.classList.add('open');

      if (globalState.reel.type === 'vimeo' && window.Vimeo) {
        const lbPlayer = new window.Vimeo.Player(document.getElementById('lb-iframe'));
        lbPlayer.ready().then(() => lbPlayer.play().catch(() => {}));
      }
    },

    closeLightbox() {
      const lightbox = document.getElementById('lightbox');
      if (lightbox) lightbox.classList.remove('open');

      setTimeout(() => {
        const lbFrame = document.getElementById('lb-frame');
        if (lbFrame) lbFrame.innerHTML = '';
        if (bgPlayer) bgPlayer.play().catch(() => {});
      }, 400);
    },

    openPanel(name) {
      if (name === 'contact') {
        const contact = document.getElementById('contact-wrapper');
        const stage = document.getElementById('stage');
        const bd = document.getElementById('bd');
        if (contact) contact.classList.add('open');
        if (stage) stage.classList.add('contact-open');
        if (bd) bd.classList.add('open');
        if (!contactTickersStarted) startContactTickers();
      } else {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
        const panel = document.getElementById('panel-' + name);
        const bd = document.getElementById('bd');
        if (panel) panel.classList.add('open');
        if (bd) bd.classList.add('open');
      }
    },

    closeToRoot() {
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
      const contact = document.getElementById('contact-wrapper');
      const stage = document.getElementById('stage');
      const bd = document.getElementById('bd');
      if (contact) contact.classList.remove('open');
      if (stage) stage.classList.remove('contact-open');
      if (bd) bd.classList.remove('open');
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
  }
}

/**
 * Handle preview data from editor
 */
function setupEditorPreviewBridge() {
  if (new URLSearchParams(location.search).has('preview') && window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'preview-ready' }, '*');
  }

  window.addEventListener('message', e => {
    if (e.data.type === 'preview-data') {
      Object.assign(globalState, e.data.content);
      projects.length = 0;
      projects.push(...(e.data.projects || []));

      // Re-render everything
      applyTheme(globalState.theme);
      updateDocumentMeta();
      renderHero();
      renderWorkSection();
      renderAboutPanel();
      renderContactSection();
      loadLogStack();
    }
  });
}

export { renderDisplayBlocks };
