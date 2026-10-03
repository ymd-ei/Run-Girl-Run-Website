/**
 * Mobile site — deliberately small: the reel, a simple contact section and a
 * link to the full site for projects. Everything reads from content.json, so
 * Site settings changes show up here without separate upkeep.
 */

import { phosphorIcon } from '../utils/icons.js';
import { setRefContext, resolveRefs, resolveLinkUrl } from '../utils/refs.js';
import { privacyEmbedUrl } from '../utils/embeds.js';
import { applySiteText, availability, renderLegal, initLegalModal } from './siteChrome.js';

let data = null;

async function init() {
  initLegalModal();
  try {
    const res = await fetch('content.json');
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

  renderHero();
  renderReel();
  renderContact();
  applySiteText(data);
  renderLegal(data, document.getElementById('legal-card'));
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
  if (nameEl) nameEl.textContent = data.name || '';
  if (roleEl) roleEl.textContent = data.role || '';

  const avail = availability(data);
  const availEl = document.getElementById('hero-avail');
  if (availEl) availEl.style.display = avail.enabled ? '' : 'none';
  const availText = document.getElementById('avail-text');
  if (availText) availText.textContent = avail.text;
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
    embed.innerHTML = `<video src="${encodeURI(reel.url)}" controls playsinline preload="metadata"></video>`;
  }
  section.classList.add('has-reel');
}

function renderContact() {
  const contact = data.contact || {};
  const panel = data.contactPanel || {};

  const bgVideo = document.getElementById('ct-bg-video');
  if (bgVideo && panel.video && panel.video.url && panel.video.type === 'video') {
    bgVideo.innerHTML = `<video src="${encodeURI(panel.video.url)}" autoplay muted loop playsinline></video>`;
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

  const iconsWrap = document.getElementById('ct-icons');
  if (iconsWrap) {
    iconsWrap.innerHTML = (contact.links || []).map(link => {
      const url = resolveLinkUrl(link.url, data);
      const external = !url.startsWith('mailto:');
      return `<a class="contact-icon-btn" href="${url}"${external ? ' target="_blank" rel="noopener"' : ''} aria-label="${link.label || ''}"><i class="${phosphorIcon(url)}"></i></a>`;
    }).join('');
  }

  const resumeWrap = document.getElementById('ct-resume-wrap');
  const resumeLink = document.getElementById('ct-resume-link');
  if (resumeWrap && resumeLink && contact.resume) {
    resumeWrap.style.display = '';
    resumeLink.href = contact.resume;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
