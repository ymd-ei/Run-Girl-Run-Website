// site-data.js — single source of truth for the modelling portfolio.
//
// content.json (committed by editor.html via the backend) holds { profile, works[] }.
// Every viewer page and the editor load it through loadContent() so there is
// exactly one place that defines the data shape and path handling.
//
// Name, email, résumé and social links are NOT stored here: they come from the
// main site's Site settings (../content.json) so both sites stay in sync.
//
// Paths inside content.json are stored repo-relative (e.g. "media/models/x.glb",
// "media/foo.png") so they match what the media backend returns. Pages live in
// /modelling/, so call mediaUrl() to turn them into page-relative "../media/…".

// Embedded fallback — keeps pages working if content.json is missing or fetch
// fails (e.g. opened over file://). Mirrors content.json.
import { liveFetch } from '../src/utils/liveContent.js';

export const DEFAULTS = {
  brand: 'Run Girl Run',
  profile: {
    bio: '',
    email: '',
    resumeUrl: '',
    headerImage: '',
    socials: [],
  },
  works: [
    { id: 'work-1781485420687', title: 'Mumei', model: 'media/models/Mumei_Walk_Cycle.glb',
      description: '', tags: ['Character', 'Rigging'], featured: true, images: [] },
  ],
};

/**
 * Turn a repo-relative media path into one resolvable from /modelling/ pages.
 * Leaves absolute URLs, data URIs and already-relative ("../…") paths untouched.
 */
export function mediaUrl(p) {
  if (!p) return '';
  if (/^(https?:|data:|blob:|\.\.\/|\/)/.test(p)) return p;
  // Anything left is a repo-relative path (media/…, resume/…). Pages live in
  // /modelling/, so step up one level to reach the repo root.
  return '../' + p;
}

// Content comes through liveFetch (src/utils/liveContent.js): seconds after an
// editor save, instead of waiting for GitHub Pages to publish.
async function fetchJson(repoPath, url) {
  try {
    const res = await liveFetch(repoPath, url);
    if (res.ok) return await res.json();
  } catch (_) { /* caller falls back */ }
  return null;
}

/** The main site's Site settings (name, email, résumé, social links), or null. */
export async function loadSiteSettings() {
  return fetchJson('content.json', '../content.json');
}

/** Fetch + normalise content.json. Always resolves (falls back to DEFAULTS). */
export async function loadContent() {
  const [own, site] = await Promise.all([fetchJson('modelling/content.json', 'content.json'), loadSiteSettings()]);
  return withSiteSettings(normalize(own || DEFAULTS), site);
}

// Overlay the shared identity/contact values from the main site.
export function withSiteSettings(content, site) {
  if (!site) return content;
  const c = site.contact || {};
  const email = c.email || content.profile.email;
  content.brand = site.name || content.brand;
  content.profile = {
    ...content.profile,
    email,
    resumeUrl: c.resume || content.profile.resumeUrl,
    socials: (c.links || [])
      .map(l => ({ ...l, url: String(l.url || '').replace(/\{email\}/g, email) }))
      .filter(l => l.url && !l.url.startsWith('mailto:'))
      .map(l => ({ label: l.label || '', handle: l.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), url: l.url }))
  };
  return content;
}

/** Fill in missing fields so callers can rely on the shape. */
export function normalize(data) {
  const d = data || {};
  return {
    brand: d.brand || DEFAULTS.brand,
    profile: { ...DEFAULTS.profile, ...(d.profile || {}) },
    works: Array.isArray(d.works) ? d.works.map(normalizeWork) : [],
  };
}

function normalizeWork(w) {
  return {
    id: w.id || '',
    title: w.title || '',
    model: w.model || '',
    description: w.description || '',
    tags: Array.isArray(w.tags) ? w.tags : [],
    featured: !!w.featured,
    images: Array.isArray(w.images) ? w.images : [],
    // camera is optional; absent ⇒ viewer auto-frames (see model-view.applyCamera)
    ...(w.camera ? { camera: { lift: +w.camera.lift || 0, dolly: +w.camera.dolly || 5.5 } } : {}),
    // material is optional; 'original' ⇒ render the authored material instead of
    // the portfolio grey (see model-view.applyMaterialMode). Absent ⇒ grey.
    ...(w.material === 'original' ? { material: 'original' } : {}),
  };
}

/** The featured work, or the first one. */
export function featuredWork(works) {
  return works.find(w => w.featured) || works[0] || null;
}
