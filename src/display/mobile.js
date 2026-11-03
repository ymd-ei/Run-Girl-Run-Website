/**
 * Mobile site — the /links card as the home page (linkCard.js, the same code as
 * /links): the studio name, the reel, Work / About / Résumé and the email, with
 * Contact on the card's back (tap the dog or swipe sideways). Work, About,
 * projects, posts and Privacy & Legal open inside the card (cardViews.js). They
 * reuse the desktop's renderers and styles-content.css, so projects, posts and
 * blocks look the same on both. Everything reads from content.json, so Site
 * settings changes show up here without separate upkeep.
 */

import { phosphorIcon } from '../utils/icons.js';
import { setRefContext, resolveRefs, resolveLinkUrl } from '../utils/refs.js';
import { applySiteText, renderLegal } from './siteChrome.js';
import { initA11y } from '../utils/a11y.js';
import { liveFetch } from '../utils/liveContent.js';
import { bindLiteToggles } from '../utils/lite.js';
import { pauseVideosWhenIdle } from '../utils/idleVideos.js';
import { DEFAULT_FILTERS, projectTypes, projectTypeLabels } from '../utils/projectTypes.js';
import { normalizeBlocks } from '../modules/blocks/blockManager.js';
import { renderDisplayBlocks, renderWorkGrid, initSensitiveTapes, initCountUps } from './displayRenderer.js';
import { loadFeed, postCardHTML, postBodyHTML, postHero, postTitle, fmtDate, likeKey, SOURCES } from './feed.js';
import { fetchLikeCount, sendLike, loadLikeCounts, copyShareLink } from './likes.js';
import { renderFilterRow, markCardLikes } from './workFilters.js';
import { initSheet, openView, refreshView, useCard, pullUp } from './cardViews.js';
import { $, media, row, renderTop, renderReel, iconsHTML, renderMail, copyEmail, initPageBg, initCard } from './linkCard.js';
import { showsOn } from '../utils/socials.js';
import { applyThemeVars } from '../utils/themeVars.js';

let data = null;
let projects = [];             // project cards, in the hand-set order
let posts = [];                // tagged social posts, filled in once the feed loads
const projectCache = new Map();
let workFilter = 'all';
let workSort = 'newest';       // 'newest' | 'likes'
const likeCounts = new Map();  // likes API key -> count, filled when sorting by likes
let openItem = null;           // { kind: 'project' | 'post', id } open in the card


async function init() {
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
  if (data.favicon) {
    const fav = document.getElementById('favicon');
    if (fav) fav.href = data.favicon;
  }

  renderCard();
  setupLiteToggle();
  applySiteText(data);
  renderLegal(data, document.getElementById('legal-card'));
  initPanels();
  pauseSoundInBackground();
  pauseVideosWhenIdle();
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
  // Same set as the desktop (src/utils/themeVars.js) — incl. panel background
  // and the see-through ink / paper shades
  applyThemeVars(theme);
}

/* ── The card ─────────────────────────────────────── */

function renderCard() {
  if (data.theme && data.theme.panelBg) document.documentElement.style.setProperty('--card', data.theme.panelBg);
  renderTop(data);                // the studio name (/links shows your own name)
  renderReel(data);

  const contact = data.contact || {};
  const links = (contact.links || []).filter(l => l.url && showsOn(l, 'links'))
    .map(l => ({ ...l, url: resolveLinkUrl(l.url, data), icon: phosphorIcon(l.url) || 'ph-fill ph-link' }));
  const substack = links.find(l => /substack\.com/.test(l.url));

  // Work and About open in the card; the résumé opens in its own tab, so closing
  // it lands back here as it was (Back would reload the page)
  $('bands').innerHTML = [['work', 'navWork', 'Work'], ['about', 'navAbout', 'About']].map(([view, key, label]) =>
    `<button type="button" class="band" data-view="${view}"><span data-site-text="${key}">${label}</span><i class="ph-fill ph-arrow-up" aria-hidden="true"></i></button>`).join('') +
    (contact.resume ? `<a class="band" href="${media(contact.resume)}" target="_blank" rel="noopener"><span>Résumé</span><i class="ph-fill ph-arrow-up-right" aria-hidden="true"></i></a>` : '');

  const lp = data.linksPage || {};
  $('writing').innerHTML = substack
    ? row({ label: substack.label || 'Substack', sub: lp.writingSub || 'Notes from the studio', url: substack.url, icon: 'ph-fill ph-article', main: true }) : '';
  const icons = iconsHTML(links.filter(l => !l.url.startsWith('mailto:') && l !== substack));
  $('icons').innerHTML = icons;

  const email = contact.email || '';
  renderMail(email);

  // The back: Contact — the words from Site settings → Contact, the email and the socials
  const panel = data.contactPanel || {};
  $('ct-title').innerHTML = (panel.title || "Let's") + '<br><span class="accent-word">' + (panel.titleAccent || 'work.') + '</span>';
  $('ct-sub').innerHTML = resolveRefs(panel.sub || '');
  $('ct-mail').href = 'mailto:' + email;
  $('ct-mail').textContent = email;
  $('ct-copy').onclick = copyEmail(email);
  $('ct-icons').innerHTML = icons;

  initPageBg(data);
  useCard(initCard({ ignore: '#legal-modal, .card-view, .reel.playing' }));
  document.querySelectorAll('[data-view]').forEach(b => {
    b.addEventListener('click', () => openView({ sheet: b.dataset.view }));
    pullUp(b, { sheet: b.dataset.view });
  });
  $('legal-open').addEventListener('click', () => openView({ sheet: 'legal' }));
}

/* ── Work / About, inside the card ─────────────────────── */

function initPanels() {
  const cards = new Map((data.projectCards || []).map(c => [c.id, c]));
  projects = (data.projects || []).map(id => cards.get(id)).filter(p => p && p.published !== false);
  // Work and About open inside the card, light like it
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
  const label = key => document.querySelector(`[data-view="${key}"] span`)?.textContent || key;

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

// Footer switch: re-render the background; the reel only fetches once tapped
function setupLiteToggle() {
  bindLiteToggles(() => {
    initPageBg(data);
    // Rebuild the reel (preview loop on/off) unless it's being watched
    if (!document.querySelector('#reel.playing')) renderReel(data, true);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
