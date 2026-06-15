// site-data.js — single source of truth for the modelling portfolio.
//
// content.json (committed by editor.html via the backend) holds { brand, profile,
// works[] }. Every viewer page and the editor load it through loadContent() so
// there is exactly one place that defines the data shape and path handling.
//
// Paths inside content.json are stored repo-relative (e.g. "media/models/x.glb",
// "media/foo.png") so they match what the media backend returns. Pages live in
// /modelling/, so call mediaUrl() to turn them into page-relative "../media/…".

// Embedded fallback — keeps pages working if content.json is missing or fetch
// fails (e.g. opened over file://). Mirrors content.json.
export const DEFAULTS = {
  brand: 'Run Girl Run',
  profile: {
    bio: '3D artist & creative director based in Tokyo. Specialising in character art, game assets, and real-time visuals.',
    email: 'hello@rungirl.run',
    resumeUrl: '',
    headerImage: '',
    socials: [
      { label: 'Instagram', handle: '@rungirl.run', url: '#' },
      { label: 'ArtStation', handle: 'artstation.com/rungirl', url: '#' },
      { label: 'Twitter', handle: '@rungirl_run', url: '#' },
    ],
  },
  works: [
    { id: 'akali', title: 'Akali', model: 'media/models/AKALI.glb',
      description: 'High-detail 3D character model.', tags: ['character', 'game-art'], featured: true, images: [] },
  ],
};

/**
 * Turn a repo-relative media path into one resolvable from /modelling/ pages.
 * Leaves absolute URLs, data URIs and already-relative ("../…") paths untouched.
 */
export function mediaUrl(p) {
  if (!p) return '';
  if (/^(https?:|data:|blob:|\.\.\/|\/)/.test(p)) return p;
  if (p.startsWith('media/')) return '../' + p;
  return p;
}

/** Fetch + normalise content.json. Always resolves (falls back to DEFAULTS). */
export async function loadContent() {
  try {
    const res = await fetch('content.json', { cache: 'no-cache' });
    if (res.ok) return normalize(await res.json());
  } catch (_) { /* fall through to defaults */ }
  return normalize(DEFAULTS);
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
  };
}

/** The featured work, or the first one. */
export function featuredWork(works) {
  return works.find(w => w.featured) || works[0] || null;
}
