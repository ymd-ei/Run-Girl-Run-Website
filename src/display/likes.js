/**
 * Likes and share links for projects and posts, shared by the desktop and
 * mobile pages. Both put the same like button in the project header
 * (#pp-like-btn / #pp-like-icon / #pp-like-count), so the UI update is shared too.
 */

const LIKES_API = `${window.RGR_CONFIG?.apiBase || ''}/api/likes`;
const IN_PREVIEW = new URLSearchParams(location.search).has('preview');

// The anonymous like ID is only created when a visitor likes something
// (create=true); viewing a project just reads an existing one.
export function getVisitorId(create = false) {
  let vid = localStorage.getItem('rgr_vid');
  if (!vid && create) {
    vid = crypto.randomUUID();
    localStorage.setItem('rgr_vid', vid);
  }
  return vid;
}

/** The header's like button: the heart, the count and its accessible name. */
export function updateLikeUI(count, liked) {
  const icon = document.getElementById('pp-like-icon');
  const countEl = document.getElementById('pp-like-count');
  const btn = document.getElementById('pp-like-btn');
  if (icon) icon.className = 'ph-fill ph-heart';
  if (countEl) countEl.textContent = count > 0 ? count : '';
  if (btn) {
    btn.classList.toggle('liked', !!liked);
    btn.setAttribute('aria-pressed', String(!!liked));
    btn.setAttribute('aria-label', count > 0 ? `Like (${count} ${count === 1 ? 'like' : 'likes'})` : 'Like');
  }
}

/** Like count for one project or post (sessionStorage-cached per tab session). */
export async function fetchLikeCount(id) {
  if (IN_PREVIEW) return;

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
    const res = await fetch(`${LIKES_API}/${encodeURIComponent(id)}${vid ? `?vid=${encodeURIComponent(vid)}` : ''}`);
    const data = await res.json();
    sessionStorage.setItem(cacheKey, JSON.stringify({ count: data.count, liked: data.liked }));
    updateLikeUI(data.count, data.liked);
  } catch (e) {
    console.warn('Failed to fetch likes:', e);
  }
}

/** Toggle this visitor's like. Returns the new { count, liked }, or null if it failed. */
export async function sendLike(id) {
  const vid = getVisitorId(true);
  try {
    const res = await fetch(`${LIKES_API}/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vid })
    });
    const data = await res.json();
    sessionStorage.setItem(`rgr_likes_${id}`, JSON.stringify({ count: data.count, liked: data.liked }));
    updateLikeUI(data.count, data.liked);
    return data;
  } catch (e) {
    console.warn('Like failed:', e);
    return null;
  }
}

/** Counts for every card key not already in `counts`, for "Most liked". */
export async function loadLikeCounts(keys, counts) {
  if (IN_PREVIEW) return;
  const vid = getVisitorId();
  await Promise.allSettled(keys.filter(k => k && !counts.has(k)).map(async key => {
    const res = await fetch(`${LIKES_API}/${encodeURIComponent(key)}${vid ? `?vid=${encodeURIComponent(vid)}` : ''}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    counts.set(key, (await res.json()).count || 0);
  }));
}

/**
 * The link to copy for a project or post. Projects have share pages on the site
 * (p/<id>/, written by the editor). Posts go through the share worker, which
 * builds their link preview on request: b<rkey> = Bluesky, i<id> = Instagram.
 * Anything else (e.g. demo posts) links to the post on the site.
 */
export function shareUrl(item) {
  if (item.kind !== 'post') return `https://rungirlrun.studio/p/${item.id}/`;
  const [src, key] = String(item.id).split(':');
  const code = { bsky: 'b', ig: 'i' }[src];
  const base = window.RGR_CONFIG?.shareBase;
  return code && key && base
    ? `${base}/${code}${key}`
    : `https://rungirlrun.studio/?post=${encodeURIComponent(item.id)}`;
}

/** Copy the share link and show "Copied!" on the button for two seconds. */
export function copyShareLink(item) {
  navigator.clipboard.writeText(shareUrl(item)).then(() => {
    const btn = document.getElementById('pp-share');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '&#x2713; Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    }
  });
}
