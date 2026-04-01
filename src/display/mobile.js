import { renderBlock } from '../modules/blocks/blockRenderer.js';
import { generateThumbSVG } from '../utils/svg.js';

const SOCIAL_ICON_MAP = {
  'e-mail': 'ph-envelope',
  'email': 'ph-envelope',
  'twitter': 'ph-x-logo',
  'instagram': 'ph-instagram-logo',
  'linkedin': 'ph-linkedin-logo',
  'vimeo': 'ph-play',
  'youtube': 'ph-youtube-logo',
  'github': 'ph-github-logo',
  'pixiv': 'ph-palette',
  'behance': 'ph-behance-logo',
  'dribbble': 'ph-dribbble-logo',
};

const LIKES_API = 'https://rgr-editor-backend.rungirlrun.workers.dev/api/likes';

function getVisitorId() {
  let vid = localStorage.getItem('rgr_vid');
  if (!vid) { vid = crypto.randomUUID(); localStorage.setItem('rgr_vid', vid); }
  return vid;
}

let data = null;
let activeFilter = 'all';

async function init() {
  try {
    const res = await fetch('content.json');
    data = await res.json();
  } catch (e) {
    document.body.innerHTML = '<p style="padding:2rem;color:red">Failed to load portfolio data.</p>';
    return;
  }

  applyTheme(data.theme);
  if (data.siteTitle) document.title = data.siteTitle;
  if (data.favicon) {
    const fav = document.getElementById('favicon');
    if (fav) fav.href = data.favicon;
  }

  renderHero();
  renderReel();
  renderFilters();
  renderWorkGrid();
  renderAbout();
  renderContact();
  renderFooter();
  setupEvents();

  // Deep-link: open a project if ?project=id is in the URL
  const params = new URLSearchParams(window.location.search);
  const projectParam = params.get('project');
  if (projectParam) openProject(projectParam);
}

function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;
  const map = {
    '--ink': theme.ink, '--paper': theme.paper, '--accent': theme.accent,
    '--panel-bg': theme.panelBg, '--ct-accent': theme.ctAccent,
    '--ct-bg': theme.ctBg, '--ct-hi': theme.ctHi,
    '--color-sensitive': theme.sensitiveColor,
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
  if (nameEl) nameEl.textContent = data.name || '';
  if (roleEl) roleEl.textContent = data.role || '';
}

function renderReel() {
  const section = document.getElementById('reel-section');
  const embed = document.getElementById('reel-embed');
  const reelData = (data.watchReel && data.watchReel.url) ? data.watchReel : data.reel;
  if (!section || !embed || !reelData || !reelData.url) return;

  embed.innerHTML = `<button class="watch-reel-btn" id="watch-reel-btn">
    <span class="wr-play"><span class="wr-tri"></span></span>
    Watch Reel
  </button>`;
  section.classList.add('has-reel');

  document.getElementById('watch-reel-btn').addEventListener('click', () => openReelLightbox(reelData));
}

function openReelLightbox(reelData) {
  const lightbox = document.getElementById('reel-lightbox');
  const frame = document.getElementById('rl-frame');
  if (!lightbox || !frame) return;

  let src = reelData.url;
  if (reelData.type === 'youtube') {
    src = src.replace('&controls=0', '').replace('&mute=1', '');
    if (!src.includes('controls=1')) src += '&controls=1';
    frame.innerHTML = `<iframe title="Demo reel" src="${src}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  } else if (reelData.type === 'vimeo') {
    src = src.replace('background=1', 'background=0').replace('&muted=1', '').replace('autoplay=1', 'autoplay=0');
    if (!src.includes('autoplay')) src += '&autoplay=1';
    frame.innerHTML = `<iframe title="Demo reel" src="${src}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  } else {
    frame.innerHTML = `<video src="${src}" controls autoplay playsinline></video>`;
  }

  lightbox.classList.add('open');
}

function closeReelLightbox() {
  const lightbox = document.getElementById('reel-lightbox');
  if (!lightbox) return;
  lightbox.classList.remove('open');
  setTimeout(() => {
    const frame = document.getElementById('rl-frame');
    if (frame) frame.innerHTML = '';
  }, 300);
}

function renderFilters() {
  const wrap = document.getElementById('work-filters');
  if (!wrap || !data.filters) return;

  let html = '<button class="filter-btn active" data-filter="all">All</button>';
  for (const f of data.filters) {
    html += `<button class="filter-btn" data-filter="${f.value}">${f.label}</button>`;
  }
  wrap.innerHTML = html;
}

function renderWorkGrid() {
  const grid = document.getElementById('work-grid');
  if (!grid || !data.projectCards) return;

  const drafts = new URLSearchParams(location.search).get('drafts') === 'all';

  let html = '';
  for (const card of data.projectCards) {
    if (!card.published && !drafts) continue;

    const filterType = (card.type || '').toLowerCase();
    let thumbHTML;
    if (card.thumbnail) {
      thumbHTML = `<img src="${card.thumbnail}" alt="${card.title || ''}" loading="lazy">`;
    } else {
      thumbHTML = `<div class="tph">${generateThumbSVG(card.type, data.theme?.accent || '#5e30eb', data.theme?.paper || '#e8e3da')}</div>`;
    }

    const isSensitive = card.sensitive;
    const sensitiveClass = isSensitive ? ' sensitive' : '';
    const sensitiveLabel = isSensitive && card.sensitiveLabel
      ? `<span class="work-card-sensitive-label">${card.sensitiveLabel}</span>`
      : '';

    html += `<a class="work-card" href="#" data-project="${card.id}" data-type="${filterType}">
      <div class="work-card-img${sensitiveClass}"${isSensitive && card.sensitiveColor ? ` style="--sensitive-color:${card.sensitiveColor}"` : ''}>
        ${thumbHTML}${sensitiveLabel}
      </div>
      <div class="work-card-meta">
        <span class="work-card-title">${card.title || ''}</span>
        <span class="work-card-type">${card.typeLabel || card.type || ''} · ${card.year || ''}</span>
      </div>
    </a>`;
  }
  grid.innerHTML = html;
}

function renderAbout() {
  const container = document.getElementById('about-blocks');
  if (!container || !data.about) return;

  const html = data.about.map(block => renderBlock(block, data.theme || {})).join('');
  container.innerHTML = html;
}

function renderContact() {
  const contact = data.contact || {};
  const panel = data.contactPanel || {};

  // Background video
  const bgVideo = document.getElementById('ct-bg-video');
  if (bgVideo && panel.video && panel.video.url) {
    bgVideo.innerHTML = `<video src="${panel.video.url}" autoplay muted loop playsinline></video>`;
    const v = bgVideo.querySelector('video');
    if (v) v.play().catch(() => {});
  }

  const titleEl = document.getElementById('ct-title');
  if (titleEl) {
    const ctTitle = panel.title || "Let's";
    const ctAccent = panel.titleAccent || 'work.';
    titleEl.innerHTML = ctTitle + '<br><span class="accent-word">' + ctAccent + '</span>';
  }

  const subEl = document.getElementById('ct-sub');
  if (subEl) subEl.innerHTML = panel.sub || '';

  const emailLabel = document.getElementById('ct-email-label');
  if (emailLabel) emailLabel.textContent = panel.emailLabel || 'Get in touch';

  const emailLink = document.getElementById('ct-email-link');
  if (emailLink && contact.email) {
    emailLink.href = 'mailto:' + contact.email;
    emailLink.textContent = contact.email;
  }

  const socialLabel = document.getElementById('ct-social-label');
  if (socialLabel) socialLabel.textContent = panel.socialLabel || 'Find us';

  const iconsWrap = document.getElementById('ct-icons');
  if (iconsWrap && contact.links) {
    let iconsHTML = '';
    for (const link of contact.links) {
      const key = (link.label || '').toLowerCase();
      const iconName = SOCIAL_ICON_MAP[key] || 'ph-link';
      iconsHTML += `<a class="contact-icon-btn" href="${link.url}" target="_blank" rel="noopener" aria-label="${link.label}"><i class="ph-fill ${iconName}"></i></a>`;
    }
    iconsWrap.innerHTML = iconsHTML;
  }

  const resumeWrap = document.getElementById('ct-resume-wrap');
  const resumeLink = document.getElementById('ct-resume-link');
  if (resumeWrap && resumeLink && contact.resume) {
    resumeWrap.style.display = '';
    resumeLink.href = contact.resume;
  }
}

function renderFooter() {
  const nameEl = document.getElementById('footer-name');
  const locEl = document.getElementById('footer-loc');
  if (nameEl) nameEl.textContent = data.name || '';
  if (locEl) locEl.textContent = data.location || '';
}

function setupEvents() {
  // Filter buttons
  const filterWrap = document.getElementById('work-filters');
  if (filterWrap) {
    filterWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      activeFilter = btn.dataset.filter;
      filterWrap.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      applyFilter();
    });
  }

  // Project card clicks
  const grid = document.getElementById('work-grid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      e.preventDefault();
      const card = e.target.closest('.work-card');
      if (!card) return;
      openProject(card.dataset.project);
    });
  }

  // Back buttons
  const backBtn = document.getElementById('project-back');
  const backBtnBottom = document.getElementById('project-back-bottom');
  const goBack = () => closeProject();
  if (backBtn) backBtn.addEventListener('click', goBack);
  if (backBtnBottom) backBtnBottom.addEventListener('click', goBack);

  // Share button
  const shareBtn = document.getElementById('project-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('project');
      if (!id) return;
      const shareUrl = `https://rungirlrun.studio/p/${id}/`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        const orig = shareBtn.innerHTML;
        shareBtn.innerHTML = '&#x2713; Copied!';
        setTimeout(() => { shareBtn.innerHTML = orig; }, 2000);
      });
    });
  }

  // FAQ toggle delegation
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-faq-trigger]');
    if (!trigger) return;
    const item = trigger.closest('[data-faq-item]');
    if (!item) return;
    const root = item.closest('[data-faq]');
    if (!root) return;
    const shouldOpen = !item.classList.contains('open');
    root.querySelectorAll('[data-faq-item]').forEach(entry => {
      const isTarget = entry === item && shouldOpen;
      entry.classList.toggle('open', isTarget);
      const panel = entry.querySelector('[data-faq-panel]');
      const trig = entry.querySelector('[data-faq-trigger]');
      if (panel) panel.hidden = !isTarget;
      if (trig) trig.setAttribute('aria-expanded', isTarget ? 'true' : 'false');
    });
  });

  // Reel lightbox close
  const rlBackdrop = document.getElementById('rl-backdrop');
  const rlClose = document.getElementById('rl-close');
  if (rlBackdrop) rlBackdrop.addEventListener('click', closeReelLightbox);
  if (rlClose) rlClose.addEventListener('click', closeReelLightbox);

  // Back to top button
  const topBtn = document.getElementById('back-to-top');
  if (topBtn) {
    window.addEventListener('scroll', () => {
      topBtn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    topBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Before/after slider touch support
  document.addEventListener('touchstart', (e) => {
    const handle = e.target.closest('[data-before-after-handle]');
    if (!handle) return;
    const container = handle.closest('[data-before-after]');
    if (!container) return;

    const frame = container.querySelector('[data-before-after-frame]') || container;
    let startX = e.touches[0].clientX;
    let startY = e.touches[0].clientY;
    let locked = false;
    let dismissed = false;

    function onMove(ev) {
      if (dismissed) return;
      const touch = ev.touches[0];
      if (!touch) return;

      if (!locked) {
        const dx = Math.abs(touch.clientX - startX);
        const dy = Math.abs(touch.clientY - startY);
        if (dy > dx) { dismissed = true; return; }
        if (dx > 6) locked = true;
        else return;
      }

      ev.preventDefault();
      const rect = frame.getBoundingClientRect();
      if (!rect.width) return;
      const pos = ((touch.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(100, Math.max(0, pos));
      container.style.setProperty('--before-after-pos', `${clamped}%`);
      handle.setAttribute('aria-valuenow', String(Math.round(clamped)));
    }

    function onEnd() {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    }

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, { passive: true });
}

function applyFilter() {
  const cards = document.querySelectorAll('.work-card');
  cards.forEach(card => {
    if (activeFilter === 'all' || card.dataset.type === activeFilter) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

async function openProject(id) {
  const detail = document.getElementById('project-detail');
  const blocks = document.getElementById('project-blocks');
  const work = document.getElementById('work');
  if (!detail || !blocks) return;

  blocks.innerHTML = '<p style="color:var(--muted);font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;padding:1rem 0">Loading…</p>';
  detail.style.display = '';
  if (work) work.style.display = 'none';
  detail.scrollIntoView({ behavior: 'smooth' });

  // Update URL bar so the link is shareable
  const url = new URL(window.location);
  url.searchParams.set('project', id);
  history.pushState({ project: id }, '', url);

  try {
    const res = await fetch(`projects/${encodeURIComponent(id)}.json`);
    if (!res.ok) throw new Error('Not found');
    const project = await res.json();

    // Find project meta from content.json
    const meta = (data.projects || []).find(p => p.id === id) || {};
    const bgImg = project.heroImage || meta.heroImage || project.thumbnail || meta.thumbnail || '';
    const title = project.title || meta.title || id;
    const tags = (project.tags || meta.tags || []).map(t => `<span class="pp-hero-tag">${t}</span>`).join('');

    const heroHtml = `<div class="pp-hero" style="background-image:url('${bgImg}')">
      <div class="pp-hero-overlay"></div>
      <div class="pp-hero-actions">
        <button class="pp-hero-btn pp-like-btn" id="pp-like-btn" onclick="window.mobileToggleLike?.()" title="Like"><i id="pp-like-icon" class="ph-fill ph-heart"></i> <span id="pp-like-count"></span></button>
        <button class="pp-hero-btn" id="pp-share" onclick="window.mobileShareLink?.()" title="Copy share link"><i class="ph-fill ph-share-network"></i> Share</button>
      </div>
      <div class="pp-hero-content">
        <div class="pp-hero-left">
          <h2 class="pp-hero-title">${(title || '').replace(/ /, '<br>')}</h2>
          ${tags ? `<div class="pp-hero-meta">${tags}</div>` : ''}
        </div>

      </div>
    </div>`;

    const html = (project.blocks || []).map(b => renderBlock(b, data.theme || {})).join('');
    blocks.innerHTML = heroHtml + html;

    fetchLikeCount(id);
  } catch {
    blocks.innerHTML = '<p style="color:var(--muted);font-size:.8rem;padding:1rem 0">Project not found.</p>';
  }
}

function updateLikeUI(count, liked) {
  const icon = document.getElementById('pp-like-icon');
  const countEl = document.getElementById('pp-like-count');
  const btn = document.getElementById('pp-like-btn');
  if (icon) icon.className = liked ? 'ph-fill ph-heart' : 'ph-fill ph-heart';
  if (countEl) countEl.textContent = count > 0 ? count : '';
  if (btn) btn.classList.toggle('liked', !!liked);
}

async function fetchLikeCount(id) {
  try {
    const vid = getVisitorId();
    const res = await fetch(`${LIKES_API}/${encodeURIComponent(id)}?vid=${encodeURIComponent(vid)}`);
    const d = await res.json();
    updateLikeUI(d.count, d.liked);
  } catch (e) { console.warn('Failed to fetch likes:', e); }
}

window.mobileToggleLike = async function() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('project');
  if (!id) return;
  try {
    const res = await fetch(`${LIKES_API}/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vid: getVisitorId() })
    });
    const d = await res.json();
    updateLikeUI(d.count, d.liked);
  } catch (e) { console.warn('Like failed:', e); }
};

window.mobileShareLink = function() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('project');
  if (!id) return;
  const shareUrl = `https://rungirlrun.studio/p/${id}/`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    const btn = document.getElementById('pp-share');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '&#x2713; Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    }
  });
};

function closeProject() {
  const detail = document.getElementById('project-detail');
  const work = document.getElementById('work');
  if (detail) detail.style.display = 'none';
  if (work) {
    work.style.display = '';
    work.scrollIntoView({ behavior: 'smooth' });
  }

  // Clear project from URL bar
  const url = new URL(window.location);
  url.searchParams.delete('project');
  history.pushState({}, '', url);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
