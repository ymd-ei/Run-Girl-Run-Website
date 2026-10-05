/**
 * Site chrome shared by the desktop and mobile sites: editable site text,
 * the "Available for work" badge and the Privacy & Legal popup — all driven
 * by Site settings in content.json.
 */

import { resolveRefs, resolveLinkUrl } from '../utils/refs.js';

// Defaults match the text that used to be hard-coded in the pages.
export const SITE_TEXT_DEFAULTS = {
  navWork: 'Work',
  navAbout: 'About',
  navContact: 'Contact',
  watchReel: 'Watch Reel',
  reelLabel: 'Demo Reel',
  contactCue: 'See how to reach us',
  resumeLink: 'View Resume',
  back: 'Back',
  legalLink: 'Privacy & Legal',
  footer: '© {year} {name}',
  liteMode: 'Lite mode'
};

// Editor labels, in display order.
export const SITE_TEXT_FIELDS = [
  ['navWork', 'Nav: Work'],
  ['navAbout', 'Nav: About'],
  ['navContact', 'Nav: Contact'],
  ['watchReel', 'Watch reel button'],
  ['reelLabel', 'Reel popup label'],
  ['contactCue', 'Contact scroll cue'],
  ['resumeLink', 'Resume link'],
  ['back', 'Project back button'],
  ['legalLink', 'Privacy & Legal link'],
  ['footer', 'Footer'],
  ['liteMode', 'Mobile: lite mode switch']
];

export const LEGAL_DEFAULTS = {
  copyright:
    'All original animation, films, and creative work on this site are © {year} {name}. All rights reserved. Do not reproduce or distribute without permission.\n\n' +
    'Fan works and mods reference characters and trademarks owned by their respective owners; {name} is not affiliated with or endorsed by them.',
  privacy:
    "This site has no accounts, forms, ads, or analytics. If you like a project, an anonymous random ID is saved in your browser so the site remembers your like; it isn't linked to your name, email, or anything that identifies you.\n\n" +
    'The site is hosted on [GitHub Pages](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement), the like counter runs on [Cloudflare](https://www.cloudflare.com/privacypolicy/), and fonts and icons load from [Google Fonts](https://policies.google.com/privacy) and [jsDelivr](https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net). Some videos are hosted on [Vimeo](https://vimeo.com/privacy) or [YouTube](https://policies.google.com/privacy). These services may log your IP address under their own privacy policies.\n\n' +
    'Questions? Reach us at {email}.',
  ai:
    'This website was built with the assistance of [GitHub Copilot](https://github.com/features/copilot) and [Claude](https://www.anthropic.com/claude) (Anthropic). All animation, films, and creative work featured on this site were made entirely by humans — no AI was involved in any of the works shown.'
};

const LEGAL_SECTIONS = [
  ['copyright', 'Copyright'],
  ['privacy', 'Privacy'],
  ['ai', 'AI Disclosure']
];

export function siteText(global, key) {
  const v = global && global.siteText && global.siteText[key];
  return v != null && v !== '' ? v : SITE_TEXT_DEFAULTS[key];
}

/** Fill every [data-site-text="key"] element; shortcuts are resolved. */
export function applySiteText(global, root = document) {
  root.querySelectorAll('[data-site-text]').forEach(el => {
    const text = siteText(global, el.getAttribute('data-site-text'));
    if (text != null) el.innerHTML = resolveRefs(escHtml(text));
  });
}

export function availability(global) {
  const a = (global && global.availability) || {};
  return { enabled: a.enabled !== false, text: a.text || 'Available for work' };
}

// Paragraphs split on blank lines; [text](url) links; then {shortcuts}.
function legalParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const linked = p.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
        const href = resolveLinkUrl(url);
        const external = /^https?:/i.test(href);
        return `<a href="${escHtml(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
      });
      return `<p>${resolveRefs(linked).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

/** Render the Privacy & Legal card contents. */
export function renderLegal(global, card) {
  if (!card) return;
  const legal = (global && global.legal) || LEGAL_DEFAULTS;
  const sections = LEGAL_SECTIONS
    .filter(([key]) => String(legal[key] || '').trim())
    .map(([key, title]) => `<div class="legal-section"><h3>${title}</h3>${legalParagraphs(legal[key])}</div>`)
    .join('');
  // The Close button shows only when it has keyboard focus (mouse users click outside or press Escape)
  card.innerHTML = '<button class="legal-close" onclick="closeLegalModal()">Close</button>'
    + `<h2 id="legal-title">${resolveRefs(escHtml(siteText(global, 'legalLink')))}</h2>${sections}`;
}

export function openLegalModal() {
  const m = document.getElementById('legal-modal');
  if (!m) return;
  m.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('open')));
}

export function closeLegalModal() {
  const m = document.getElementById('legal-modal');
  if (!m || !m.classList.contains('open')) return false;
  m.classList.remove('open');
  setTimeout(() => { m.style.display = 'none'; }, 280);
  return true;
}

/** Wire the popup's open/close globals (pages call openLegalModal() inline). */
export function initLegalModal() {
  window.openLegalModal = openLegalModal;
  window.closeLegalModal = closeLegalModal;
  // Escape closes only the popup, not the panel it was opened from
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && closeLegalModal()) e.stopImmediatePropagation(); });
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
