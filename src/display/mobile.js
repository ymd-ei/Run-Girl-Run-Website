/**
 * Mobile site — deliberately small: the reel, a simple contact section, and
 * About / Work in a bottom sheet (see mobileSheet.js). The sheet reuses the
 * desktop's renderers and styles-content.css, so projects, posts and blocks
 * look the same on both. Everything reads from content.json, so Site settings
 * changes show up here without separate upkeep.
 */

import { phosphorIcon } from '../utils/icons.js';
import { setRefContext, resolveRefs, resolveLinkUrl } from '../utils/refs.js';
import { privacyEmbedUrl } from '../utils/embeds.js';
import { applySiteText, availability, renderLegal, initLegalModal, closeLegalModal } from './siteChrome.js';
import { initA11y } from '../utils/a11y.js';
import { liveFetch } from '../utils/liveContent.js';
import { isLite, stillVideos, bindLiteToggles } from '../utils/lite.js';
import { pauseVideosWhenIdle } from '../utils/idleVideos.js';
import { DEFAULT_FILTERS, projectTypes, projectTypeLabels } from '../utils/projectTypes.js';
import { normalizeBlocks } from '../modules/blocks/blockManager.js';
import { renderDisplayBlocks, renderWorkGrid, initSensitiveTapes, initCountUps } from './displayRenderer.js';
import { loadFeed, postCardHTML, postBodyHTML, postHero, postTitle, fmtDate, likeKey, SOURCES } from './feed.js';
import { fetchLikeCount, sendLike, loadLikeCounts, copyShareLink } from './likes.js';
import { renderFilterRow, markCardLikes } from './workFilters.js';
import { initSheet, openView, refreshView } from './mobileSheet.js';
import { showsOn } from '../utils/socials.js';

let data = null;
let projects = [];             // project cards, in the hand-set order
let posts = [];                // tagged social posts, filled in once the feed loads
const projectCache = new Map();
let workFilter = 'all';
let workSort = 'newest';       // 'newest' | 'likes'
const likeCounts = new Map();  // likes API key -> count, filled when sorting by likes
let openItem = null;           // { kind: 'project' | 'post', id } shown in the sheet


// Privacy & Legal swipes down to close, like the Work / About panels (same feel
// as mobileSheet.js): pull from the top, or from the text once it's scrolled to
// its top; past 30% of its height, or a flick, closes it — otherwise it springs back.
function bindLegalSwipe() {
  const modal = document.getElementById('legal-modal');
  const card = document.getElementById('legal-card');
  if (!modal || !card) return;
  const START = 12, RESIST = 0.8, CLOSE_DISTANCE = 0.3, CLOSE_SPEED = 0.6;
  let startY = 0, lastY = 0, lastT = 0, speed = 0, dy = 0, tracking = false, dragging = false, fromTop = false;
  const reset = () => { card.style.transition = card.style.transform = ''; modal.style.opacity = ''; };
  card.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || !modal.classList.contains('open')) return;
    tracking = true; dragging = false; dy = 0; speed = 0;
    startY = lastY = e.touches[0].clientY; lastT = e.timeStamp;
    fromTop = startY - card.getBoundingClientRect().top < 48;     // the grab bar / heading area
  }, { passive: true });
  card.addEventListener('touchmove', e => {
    if (!tracking) return;
    const y = e.touches[0].clientY;
    dy = y - startY;
    if (!dragging) {
      if (dy > START && (fromTop || card.scrollTop <= 0)) { dragging = true; card.style.transition = 'none'; }
      else if (Math.abs(dy) > START) { tracking = false; return; }   // a normal scroll
      else return;
    }
    e.preventDefault();
    speed = (y - lastY) / Math.max(1, e.timeStamp - lastT);
    lastY = y; lastT = e.timeStamp;
    const pull = Math.max(0, dy) * RESIST;
    card.style.transform = `translateY(${pull}px)`;
    modal.style.opacity = String(Math.max(0.2, 1 - pull / card.offsetHeight));
  }, { passive: false });
  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    const pull = Math.max(0, dy) * RESIST;
    card.style.transition = '';
    if (pull > card.offsetHeight * CLOSE_DISTANCE || speed > CLOSE_SPEED) {
      card.style.transform = 'translateY(100%)';
      modal.style.opacity = '';
      closeLegalModal();
      setTimeout(reset, 320);
    } else {
      card.style.transform = '';
      modal.style.opacity = '';
    }
  };
  card.addEventListener('touchend', end);
  card.addEventListener('touchcancel', end);
}

async function init() {
  initLegalModal();
  bindLegalSwipe();
  initA11y();
  try {
    const res = await liveFetch('content.json', 'content.json');
    data = await res.json();
  } catch (e) {
    document.body.innerHTML = '<p style="padding:2rem;color:red">Failed to load portfolio data.</p>';
    return;
  }
  setRefContext(data, data.projectCards || []);

  applyTheme(data.theme);
  if (data.siteTitle) document.title = data.siteTitle;
  const logo = document.getElementById('m-logo');
  if (logo && data.logo) {
    logo.innerHTML = `<img src="${encodeURI(data.logo)}" alt="">`;
    logo.hidden = false;
  }
  if (data.favicon) {
    const fav = document.getElementById('favicon');
    if (fav) fav.href = data.favicon;
  }

  renderHero();
  renderHeroVideo();
  renderReel();
  renderContact();
  setupLiteToggle();
  applySiteText(data);
  renderLegal(data, document.getElementById('legal-card'));
  initPanels();
  pauseSoundInBackground();
  pauseVideosWhenIdle();
  darkenBarOnScroll();
}

// The top bar's fade (styles-mobile.css .m-bar) comes in once the page has
// scrolled past the bar's own spot, i.e. when its original place is off-screen
function darkenBarOnScroll() {
  const bar = document.getElementById('m-bar');
  if (!bar) return;
  const reach = () => Math.max(...[...bar.children].map(el => el.getBoundingClientRect().bottom));
  const update = () => bar.classList.toggle('is-scrolled', window.scrollY > reach());
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* Locking the phone or switching apps keeps an inline video's sound playing on
   iPhone, so pause anything with sound (the reel, videos in projects and posts)
   when the page goes into the background. The muted background loops are left
   alone and nudged back into play on return, in case the phone paused them. */
function pauseSoundInBackground() {
  document.addEventListener('visibilitychange', () => {
    const videos = [...document.querySelectorAll('video')];
    if (document.hidden) {
      videos.forEach(v => { if (!v.muted && !v.paused) v.pause(); });
    } else {
      videos.forEach(v => { if (v.muted && v.autoplay && v.paused) v.play().catch(() => {}); });
    }
  });
}

function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;
  const map = {
    '--ink': theme.ink, '--paper': theme.paper, '--accent': theme.accent,
    '--ct-accent': theme.ctAccent, '--ct-bg': theme.ctBg, '--ct-hi': theme.ctHi
  };
  for (const [k, v] of Object.entries(map)) {
    if (v) root.style.setProperty(k, v);
  }
  if (theme.accent) {
    const hex = theme.accent.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty('--accent-rgb', `${r},${g},${b}`);
  }
}

function renderHero() {
  const nameEl = document.getElementById('hero-name');
  const roleEl = document.getElementById('hero-role');
  if (nameEl) {
    // Same split as the desktop hero: first word, then the rest in accent italics.
    const [first = '', ...rest] = (data.name || '').split(' ');
    nameEl.textContent = first;
    if (rest.length) {
      const em = document.createElement('em');
      em.textContent = rest.join(' ');
      nameEl.append(document.createElement('br'), em);
    }
  }
  if (roleEl) roleEl.textContent = data.role || '';

  const avail = availability(data);
  const availEl = document.getElementById('hero-avail');
  if (availEl) availEl.style.display = avail.enabled ? '' : 'none';
  const availText = document.getElementById('avail-text');
  if (availText) availText.textContent = avail.text;
}

// Looping hero video behind the top of the page (hero, reel, View work), treated like the contact section's
// background video. Lite mode and reduced motion get the poster only.
function renderHeroVideo() {
  const top = document.getElementById('top');
  const bg = document.getElementById('hero-bg');
  const reel = data.reel;
  if (!top || !bg || !reel || reel.type !== 'video' || !reel.url) return;
  top.classList.add('has-video');

  if (stillVideos()) {
    bg.innerHTML = reel.poster ? `<img src="${encodeURI(reel.poster)}" alt="">` : '';
    return;
  }
  const poster = reel.poster ? ` poster="${encodeURI(reel.poster)}"` : '';
  bg.innerHTML = `<video src="${encodeURI(reel.url)}"${poster} autoplay muted loop playsinline preload="auto"></video>`;
  const v = bg.querySelector('video');
  v.play().catch(() => {});
}

// Inline player for the demo reel (the watch-reel video, else the hero reel).
function renderReel() {
  const section = document.getElementById('reel-section');
  const embed = document.getElementById('reel-embed');
  const reel = (data.watchReel && data.watchReel.url) ? data.watchReel : data.reel;
  if (!section || !embed || !reel || !reel.url) return;

  if (reel.type === 'youtube' || reel.type === 'vimeo') {
    const url = privacyEmbedUrl(reel.url.replace(/autoplay=1/g, 'autoplay=0').replace(/mute=1/g, 'mute=0'));
    embed.innerHTML = `<iframe src="${encodeURI(url)}" allow="fullscreen" allowfullscreen title="Demo Reel"></iframe>`;
  } else {
    // A cover with the site's play button sits over the player until it's tapped.
    // By default the reel spot plays a muted loop behind it — the Preview clip if
    // one is set (Watch reel → Preview clip), else the reel itself; tapping plays
    // the reel with sound from the start. Lite mode, data-saver and reduced motion
    // keep the still cover: over the poster when one is set, otherwise frosted
    // glass over the hero video.
    const preview = !stillVideos();
    const own = preview && !reel.preview;          // the reel loops itself until tapped
    const poster = reel.poster ? ` poster="${encodeURI(reel.poster)}"` : '';
    const mainAttrs = own ? ' muted loop autoplay preload="auto"' : ` preload="${isLite() ? 'none' : 'metadata'}"`;
    const previewVideo = preview && reel.preview
      ? `<video class="reel-preview" src="${encodeURI(reel.preview)}" muted loop autoplay playsinline preload="auto" aria-hidden="true"></video>` : '';
    embed.innerHTML = `<video src="${encodeURI(reel.url)}"${poster} playsinline${mainAttrs}></video>${previewVideo}
      <button type="button" class="reel-cover${reel.poster ? ' has-poster' : ''}">
        <span class="reel-play" aria-hidden="true"><span class="reel-tri"></span></span>
        <span class="reel-cover-text"><span data-site-text="watchReel">Watch Reel</span><span class="reel-dur"></span></span>
      </button>`;
    embed.classList.toggle('no-poster', !reel.poster);
    embed.classList.toggle('previewing', preview);
    const video = embed.querySelector('video');
    const cover = embed.querySelector('.reel-cover');
    const pv = embed.querySelector('.reel-preview') || (own ? video : null);
    if (pv) pv.play().catch(() => {});
    video.addEventListener('loadedmetadata', () => {
      const t = Math.round(video.duration);
      if (t) embed.querySelector('.reel-dur').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    });
    cover.addEventListener('click', () => {
      embed.classList.remove('previewing');
      embed.classList.add('is-playing');
      const clip = embed.querySelector('.reel-preview');
      if (clip) clip.remove();
      if (video.muted) { video.muted = false; video.loop = false; video.currentTime = 0; }
      video.controls = true;
      video.play().catch(() => {});
      video.focus({ preventScroll: true });
    });
  }
  section.classList.add('has-reel');
}

function renderContact() {
  const contact = data.contact || {};
  const panel = data.contactPanel || {};

  renderContactVideo();

  const titleEl = document.getElementById('ct-title');
  if (titleEl) {
    const ctTitle = panel.title || "Let's";
    const ctAccent = panel.titleAccent || 'work.';
    titleEl.innerHTML = ctTitle + '<br><span class="accent-word">' + ctAccent + '</span>';
  }

  const subEl = document.getElementById('ct-sub');
  if (subEl) subEl.innerHTML = resolveRefs(panel.sub || '');

  // Same fallback labels as the desktop contact panel.
  const emailLabel = document.getElementById('ct-email-label');
  if (emailLabel) emailLabel.textContent = panel.emailLabel || 'Drop us a line';
  const socialLabel = document.getElementById('ct-social-label');
  if (socialLabel) socialLabel.textContent = panel.socialLabel || 'Find us';
  const resumeLabel = document.getElementById('ct-resume-label');
  if (resumeLabel) resumeLabel.textContent = panel.resumeLabel || 'Credentials';

  const emailLink = document.getElementById('ct-email-link');
  if (emailLink && contact.email) {
    emailLink.href = 'mailto:' + contact.email;
    emailLink.textContent = contact.email;
  }
  setupCopyEmail(contact.email);

  const iconsWrap = document.getElementById('ct-icons');
  if (iconsWrap) {
    iconsWrap.innerHTML = (contact.links || []).filter(l => showsOn(l, 'contact')).map(link => {
      const url = resolveLinkUrl(link.url, data);
      const external = !url.startsWith('mailto:');
      return `<a class="contact-icon-btn" href="${url}"${external ? ' target="_blank" rel="noopener"' : ''} aria-label="${link.label || url.replace(/^(mailto:|https?:\/\/(www\.)?)/, '').split(/[/?#]/)[0]}"><i class="${phosphorIcon(url)}" aria-hidden="true"></i></a>`;
    }).join('');
  }

  const resumeWrap = document.getElementById('ct-resume-wrap');
  const resumeLink = document.getElementById('ct-resume-link');
  if (resumeWrap && resumeLink && contact.resume) {
    resumeWrap.style.display = '';
    resumeLink.href = contact.resume;
  }
}

/* ── About / Work sheet ─────────────────────────────── */

function initPanels() {
  const cards = new Map((data.projectCards || []).map(c => [c.id, c]));
  projects = (data.projects || []).map(id => cards.get(id)).filter(p => p && p.published !== false);
  if (data.theme && data.theme.panelStyle === 'dark') document.body.classList.add('panel-frost');

  // Work and About are built now and parked below the screen; their tabs raise them
  initSheet(renderView);

  // Cards, filter chips and header buttons call window.display, as on the desktop
  window.display = {
    openProject: id => openView({ sheet: 'work', project: id }),
    openPost: id => openView({ sheet: 'work', post: id }),
    filterWork(btn, type) {
      workFilter = type;
      renderWork();
    },
    async sortWork(sort) {
      workSort = sort;
      if (sort === 'likes') await loadLikeCounts(workItems().map(x => x.key), likeCounts);
      renderWork();
    },
    async toggleLike() {
      if (!openItem) return;
      const id = openItem.kind === 'post' ? likeKey(openItem.id) : openItem.id;
      const res = await sendLike(id);
      if (res && likeCounts.has(id)) likeCounts.set(id, res.count);
    },
    copyShareLink() {
      if (openItem) copyShareLink(openItem);
    }
  };

  loadFeed(data).then(list => {
    posts = list;
    refreshView('work');
  }).catch(e => console.warn('Feed failed to load:', e));
}

function renderView(view) {
  const filters = data.filters || DEFAULT_FILTERS;
  openItem = view.project ? { kind: 'project', id: view.project } : view.post ? { kind: 'post', id: view.post } : null;
  const label = key => document.getElementById(`sheet-${key}-title`)?.textContent || key;

  if (view.sheet === 'about') {
    return {
      title: label('about'),
      tall: true,               // one long page, so it opens tall like an article
      html: renderDisplayBlocks(normalizeBlocks(data.about || []), { scope: 'about' }),
      after: () => initCountUps()
    };
  }

  if (view.project) {
    const card = projects.find(p => p.id === view.project) || { id: view.project };
    return {
      title: label('work'),
      back: true,
      html: projectHero(card, filters) + '<p class="sheet-loading">Loading…</p>',
      after: el => loadProject(view.project).then(project => {
        if (!el.isConnected || history.state?.project !== view.project) return;
        el.innerHTML = project
          ? projectHero(project, filters) + renderDisplayBlocks(normalizeBlocks(project.blocks || []), { scope: 'proj-' + project.id, projectId: project.id })
          : projectHero(card, filters) + '<p class="sheet-loading">Unable to load this project right now.</p>';
        initCountUps();
        if (project) fetchLikeCount(project.id);
      })
    };
  }

  if (view.post) {
    const post = posts.find(p => p.id === view.post);
    return {
      title: label('work'),
      back: true,
      html: post ? postHeroHTML(post, filters) + postBodyHTML(post) : '<p class="sheet-loading">This post is no longer available.</p>',
      after: () => { if (post) fetchLikeCount(likeKey(post.id)); }
    };
  }

  return {
    title: label('work'),
    html: '<div class="wf" id="m-work-filters"></div><div class="wg" id="m-wg" data-cols="3"></div>',
    after: () => renderWork()
  };
}

/** The Work sheet's filter row and grid; filtering and sorting re-render just these. */
function renderWork() {
  const row = document.getElementById('m-work-filters');
  const grid = document.getElementById('m-wg');
  if (!row || !grid) return;
  const filters = data.filters || DEFAULT_FILTERS;
  let items = workItems();
  const activeTypes = new Set(items.flatMap(x => x.types));
  if (workFilter !== 'all' && !activeTypes.has(workFilter)) workFilter = 'all';

  renderFilterRow(row, {
    filters: filters.filter(f => activeTypes.has(f.value)),
    active: workFilter,
    sorts: [['newest', 'Newest'], ['likes', 'Most liked']],
    sort: workSort,
    showSort: posts.length > 0,
    scroller: document.getElementById('sheet-body')
  });

  if (workSort === 'likes') items = items.map((x, i) => [x, i])
    .sort((a, b) => (likeCounts.get(b[0].key) || 0) - (likeCounts.get(a[0].key) || 0) || a[1] - b[1])
    .map(([x]) => x);
  if (workFilter !== 'all') items = items.filter(x => x.types.includes(workFilter));

  grid.innerHTML = items.map(x => x.html).join('');
  markCardLikes([...grid.children], items.map(x => x.key), likeCounts, workSort === 'likes');
  initSensitiveTapes(projects);
}

/** Same order as the desktop's "Newest": by day, a project ahead of a post on
    the same day, and same-day projects keep their hand-set order. */
function workItems() {
  const filters = data.filters || DEFAULT_FILTERS;
  const projectDate = p => p.date || (p.year || '0') + '-12-31';
  return [
    ...projects.map((p, i) => ({ key: p.id, types: projectTypes(p), date: projectDate(p), project: true, i, html: renderWorkGrid([p], data.theme) })),
    ...posts.map(p => ({ key: likeKey(p.id), types: p.filters, date: p.date, project: false, i: 0, html: postCardHTML(p, filters, { uniform: true }) }))
  ].sort((a, b) =>
    b.date.slice(0, 10).localeCompare(a.date.slice(0, 10))
    || (b.project ? 1 : 0) - (a.project ? 1 : 0)
    || (a.project ? a.i - b.i : new Date(b.date) - new Date(a.date))
  );
}

async function loadProject(id) {
  if (projectCache.has(id)) return projectCache.get(id);
  try {
    const res = await liveFetch('projects/' + id + '.json', 'projects/' + encodeURIComponent(id) + '.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const project = await res.json();
    projectCache.set(id, project);
    return project;
  } catch (e) {
    console.warn('Could not load project ' + id, e);
    return null;
  }
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bgImage = url => url ? ` style="background-image:url('${String(url).replace(/'/g, '%27')}')"` : '';

// Like and Share, as in the desktop project header
const heroActions = `<div class="pp-hero-actions">
      <button class="pp-hero-btn pp-like-btn" id="pp-like-btn" onclick="window.display?.toggleLike?.()" title="Like" aria-label="Like" aria-pressed="false"><i id="pp-like-icon" class="ph-fill ph-heart" aria-hidden="true"></i> <span id="pp-like-count">—</span></button>
      <button class="pp-hero-btn" id="pp-share" onclick="window.display?.copyShareLink?.()" title="Copy share link" aria-live="polite"><i class="ph-fill ph-share-network" aria-hidden="true"></i> Share</button>
    </div>`;

// The desktop project header
function projectHero(p, filters) {
  const tags = [...projectTypeLabels(p, filters), p.year, p.client].filter(Boolean);
  return `<div class="pp-hero"${bgImage(p.heroImage || p.thumbnail)}>
    <div class="pp-hero-overlay"></div>
    ${heroActions}
    <div class="pp-hero-content"><div class="pp-hero-left">
      <h2 class="pp-hero-title">${esc(p.title || '').replace(/ /, '<br>')}</h2>
      <div class="pp-hero-meta">${tags.map(t => `<span class="pp-hero-tag">${esc(t)}</span>`).join('')}</div>
    </div></div>
  </div>`;
}

function postHeroHTML(post, filters) {
  const s = SOURCES[post.source] || { label: post.source };
  const img = postHero(post)?.url || data.postBanner || '';
  const tags = [s.label, ...post.filters.map(v => filters.find(f => f.value === v)?.label || v), fmtDate(post.date)];
  return `<div class="pp-hero${img ? '' : ' pp-hero-plain'}"${bgImage(img)}>
    <div class="pp-hero-overlay"></div>
    ${heroActions}
    <div class="pp-hero-content"><div class="pp-hero-left">
      <h2 class="pp-hero-title">${esc(postTitle(post))}</h2>
      <div class="pp-hero-meta">${tags.map(t => `<span class="pp-hero-tag">${esc(t)}</span>`).join('')}</div>
    </div></div>
  </div>`;
}

// The contact section's looping background (its poster in lite mode)
function renderContactVideo() {
  const bg = document.getElementById('ct-bg-video');
  const video = (data.contactPanel || {}).video;
  if (!bg || !video || !video.url || video.type !== 'video') return;
  if (stillVideos()) {
    bg.innerHTML = video.poster ? `<img src="${encodeURI(video.poster)}" alt="">` : '';
    return;
  }
  bg.innerHTML = `<video src="${encodeURI(video.url)}" autoplay muted loop playsinline></video>`;
  bg.querySelector('video').play().catch(() => {});
}

// Footer switch: re-render the backgrounds; the reel only fetches once tapped
function setupLiteToggle() {
  bindLiteToggles(() => {
    renderHeroVideo();
    renderContactVideo();
    // Rebuild the reel spot (preview loop on/off) unless the reel is being watched
    if (!document.querySelector('#reel-embed.is-playing')) renderReel();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
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
