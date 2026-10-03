/**
 * Social feed: #rgr-tagged posts from other platforms, shown in the Work grid
 * next to projects and opened in the project panel.
 *
 * Bluesky is read straight from its public API in the visitor's browser (no
 * login, CORS-enabled). The account comes from Site settings → Social links (a
 * bsky.app/profile/… link). Substack and Instagram will need the daily job on
 * the Worker; their posts will arrive in this same shape.
 *
 * Post shape: { id, source, url, date, title?, text, html?, tags[], media[{type,url,alt,w?,h?}] }
 * The platform is the only control: retag or delete a post there and the site follows.
 */

import { classifyPostTags, filterLabel } from '../utils/projectTypes.js';

export const SOURCES = {
  bluesky:   { label: 'Bluesky',   color: '#1185fe' },
  substack:  { label: 'Substack',  color: '#ff6719' },
  instagram: { label: 'Instagram', color: '#d62976' },
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tagify = s => esc(s).replace(/(^|\s)(#[\w-]+)/g, (_, pre, tag) => `${pre}<span class="post-tag">${tag}</span>`);
const stripTags = s => String(s || '').replace(/(^|\s)#[\w-]+/g, '').trim();
export const fmtDate = d => new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = d => new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

// The likes API only accepts [a-zA-Z0-9_-], so "bsky:3lx9a1" is stored as "bsky-3lx9a1"
export const likeKey = id => String(id).replace(/[^a-zA-Z0-9_-]/g, '-');

export function postTitle(p) {
  if (p.title) return p.title;
  const first = stripTags(p.text).split(/[.!?\n]/)[0].trim();
  if (!first) return (SOURCES[p.source]?.label || 'Social') + ' post';
  return first.length <= 48 ? first : first.slice(0, 48).replace(/\s+\S*$/, '') + '…';
}

// Short enough for about two lines; cut on a word so the closing quote always shows
function quote(t) {
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > 140) t = t.slice(0, 140).replace(/\s+\S*$/, '') + '…';
  return `“${t}”`;
}

/* ── Loading ─────────────────────────────────────────── */

function blueskyHandle(site) {
  const link = (site.contact?.links || []).find(l => /bsky\.app\/profile\//.test(l.url || ''));
  return link ? link.url.split('/profile/')[1].split(/[/?#]/)[0] : '';
}

async function fetchBluesky(handle) {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=50&filter=posts_no_replies`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Bluesky HTTP ' + res.status);
  const { feed } = await res.json();
  return (feed || []).filter(f => !f.reason).map(({ post }) => {
    const rec = post.record || {};
    const rkey = post.uri.split('/').pop();
    const facetTags = (rec.facets || []).flatMap(f => f.features || [])
      .filter(x => x.$type === 'app.bsky.richtext.facet#tag').map(x => x.tag);
    const textTags = [...(rec.text || '').matchAll(/#([\w-]+)/g)].map(m => m[1]);
    const e = post.embed || {};
    const view = e.media || e; // recordWithMedia wraps the media
    let media = [];
    if (view.images?.length) {
      media = view.images.map(i => ({ type: 'image', url: i.fullsize || i.thumb, alt: i.alt || '', w: i.aspectRatio?.width, h: i.aspectRatio?.height }));
    } else if (view.$type === 'app.bsky.embed.video#view' && view.thumbnail) {
      // Bluesky video streams as HLS, which most browsers can't play inline; show the still and link out
      media = [{ type: 'image', video: true, url: view.thumbnail, alt: view.alt || '', w: view.aspectRatio?.width, h: view.aspectRatio?.height }];
    } else if (view.external?.thumb) {
      media = [{ type: 'image', url: view.external.thumb, alt: view.external.title || '' }];
    }
    return {
      id: 'bsky:' + rkey,
      source: 'bluesky',
      url: `https://bsky.app/profile/${post.author.handle}/post/${rkey}`,
      date: rec.createdAt || post.indexedAt,
      text: rec.text || '',
      tags: [...new Set([...facetTags, ...textTags])],
      media,
    };
  });
}

/**
 * Every source the site can read, merged newest first. Posts without #rgr are
 * dropped here; each kept post carries `filters` (filter values) from its tags.
 * A source that fails is skipped so the rest of the grid still shows.
 */
export async function loadFeed(site) {
  const jobs = [];
  const handle = blueskyHandle(site);
  if (handle) jobs.push(fetchBluesky(handle));
  const results = await Promise.allSettled(jobs);
  results.filter(r => r.status === 'rejected').forEach(r => console.warn('Feed source failed:', r.reason));
  return results
    .flatMap(r => (r.status === 'fulfilled' ? r.value : []))
    .map(p => ({ ...p, filters: classifyPostTags(p.tags, site.filters)?.filters }))
    .filter(p => p.filters)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/* ── Cards ───────────────────────────────────────────── */

const srcBadge = s => `<span class="src-dot"><i style="background:${s.color}"></i>${s.label}</span>`;

/**
 * A post card for the Work grid. Text-only posts become a slim quote strip;
 * `uniform` (More work) keeps every card a 16:9 thumbnail instead.
 */
export function postCardHTML(p, filters, { uniform = false, likes = '' } = {}) {
  const s = SOURCES[p.source] || { label: p.source, color: '#888' };
  const img = p.media?.[0];
  const typeText = p.filters.map(v => esc(filterLabel(v, filters))).join(' / ');
  const meta = `${typeText ? typeText + ' &middot; ' : ''}${shortDate(p.date)}${likes}`;
  const types = esc(JSON.stringify(p.filters));
  const open = `onclick="window.display?.openPost?.('${esc(p.id)}')"`;

  if (!img && !uniform) {
    return `<div class="wc wc-quote" data-types="${types}" data-key="${esc(likeKey(p.id))}" ${open}>
      <p class="q-text">${esc(quote(stripTags(p.text) || postTitle(p)))}</p>
      <p class="wcty">${srcBadge(s)}${meta}</p>
    </div>`;
  }

  const shape = !uniform && img?.w && img?.h ? ` style="aspect-ratio:${fitRatio(img.w, img.h)}"` : '';
  const thumb = !img
    ? `<div class="textthumb"><span>${esc(quote(stripTags(p.text) || postTitle(p)))}</span></div>`
    : img.type === 'video' && !img.video
      ? `<video src="${esc(img.url)}#t=0.1" muted playsinline preload="metadata"></video>`
      : `<img src="${esc(img.url)}" alt="${esc(img.alt)}" loading="lazy">`;
  return `<div class="wc" data-types="${types}" data-key="${esc(likeKey(p.id))}" ${open}>
    <div class="wci"${shape}>
      ${thumb}
      ${srcBadge(s)}
      ${p.media.length > 1 ? `<span class="src-dot src-count">${p.media.length} items</span>` : ''}
      <div class="wco">View post</div>
    </div>
    <div class="wcm">
      <p class="wct">${esc(postTitle(p))}</p>
      <p class="wcty">${meta}</p>
    </div>
  </div>`;
}

/* ── Post panel body ─────────────────────────────────── */

/* Imported article HTML is someone else's markup: keep plain formatting only. */
const ALLOWED = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'A', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'IMG', 'FIGURE', 'FIGCAPTION', 'BR', 'HR', 'PRE', 'CODE']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'BUTTON', 'SVG', 'svg', 'VIDEO', 'AUDIO']);
export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = node => {
    for (const el of [...node.children]) {
      walk(el); // children first, so anything unwrapped below is already clean
      if (DROP.has(el.tagName)) { el.remove(); continue; }
      // Substack wraps each image in a link to the full-size file; keep readers on the page
      if (el.tagName === 'A' && el.classList.contains('image-link')) { el.replaceWith(...el.childNodes); continue; }
      if (!ALLOWED.has(el.tagName)) { el.replaceWith(...el.childNodes); continue; }
      for (const a of [...el.attributes]) {
        const ok = ['href', 'src', 'alt'].includes(a.name) && !/^\s*(javascript|data):/i.test(a.value);
        if (!ok) el.removeAttribute(a.name);
      }
      if (el.tagName === 'A') { el.target = '_blank'; el.rel = 'noopener'; }
      if (el.tagName === 'IMG') el.loading = 'lazy';
      if (el.tagName === 'H1') { const h = document.createElement('h2'); h.append(...el.childNodes); el.replaceWith(h); }
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

function mediaBlock(m, p) {
  if (m.video) {
    return `<a class="bl-image post-video-still" href="${esc(p.url)}" target="_blank" rel="noopener">
      <img src="${esc(m.url)}" alt="${esc(m.alt)}" loading="lazy"><span>Play on ${esc(SOURCES[p.source]?.label || '')} ↗</span></a>`;
  }
  return m.type === 'video'
    ? `<div class="bl-image post-media"><video src="${esc(m.url)}" controls playsinline preload="metadata"></video></div>`
    : `<div class="bl-image post-media"><img src="${esc(m.url)}" alt="${esc(m.alt)}" loading="lazy"></div>`;
}

/** Hero image: the first still (never a video file). */
export const postHero = p => (p.media || []).find(m => m.type !== 'video' || m.video);

/** Everything under the hero: the full text or article, the rest of the media, then the way out. */
export function postBodyHTML(p) {
  const s = SOURCES[p.source] || { label: p.source };
  const hero = postHero(p);
  const rest = (p.media || []).filter(m => m !== hero || m.video);
  return `<div class="block-canvas post-body">
    ${p.html
      ? `<p class="post-dek">${esc(stripTags(p.text))}</p><div class="post-article">${sanitizeHtml(p.html)}</div>`
      : `<p class="bl-text-md post-text">${tagify(p.text)}</p>`}
    ${p.html ? '' : rest.map(m => mediaBlock(m, p)).join('')}
    <a class="post-origin" href="${esc(p.url)}" target="_blank" rel="noopener">Originally posted on ${esc(s.label)} ↗</a>
  </div>`;
}

/* ── Thumbnail shapes ────────────────────────────────── */

/* Work grid thumbnails keep their own shape, held between 4:5 (portrait) and
   2:1 (wide); beyond that they crop from the centre. A card sits at the 16:9
   default until its image loads. More work cards stay 16:9. */
const RATIO_MIN = 4 / 5, RATIO_MAX = 2;
export const fitRatio = (w, h) => +Math.min(RATIO_MAX, Math.max(RATIO_MIN, w / h)).toFixed(4);

function shapeThumb(el, w, h) {
  const box = el.closest('#wg .wci');
  if (box && w && h) box.style.aspectRatio = fitRatio(w, h);
}
export function initThumbShapes() {
  document.addEventListener('load', e => {
    if (e.target.tagName === 'IMG') shapeThumb(e.target, e.target.naturalWidth, e.target.naturalHeight);
  }, true);
  document.addEventListener('loadedmetadata', e => {
    if (e.target.tagName === 'VIDEO') shapeThumb(e.target, e.target.videoWidth, e.target.videoHeight);
  }, true);
}

/* ── Stacking ────────────────────────────────────────── */

/* Each card goes into the currently shortest column, in order, so tall image
   cards and slim quote strips pack without holes. Cards already on screen
   slide from their old spot; new ones fade in. */
const GAP = 16;
const cardKey = el => el.dataset.key;
export const cardPositions = grid => new Map([...grid.children].filter(el => el.dataset.pos).map(el => [cardKey(el), el.dataset.pos]));
const observers = new WeakMap();

export function masonry(grid, prev) {
  const kids = [...grid.children].filter(el => el.classList.contains('wc'));
  grid.classList.toggle('masonry', kids.length > 0);
  if (!kids.length) { grid.style.height = ''; return; }
  const w = grid.clientWidth;
  if (!w) return; // panel hidden; the observer re-runs this once it has a width
  const cols = w < 520 ? 1 : 2;
  const colW = (w - GAP * (cols - 1)) / cols;
  kids.forEach(el => { el.style.width = colW + 'px'; });
  const heights = Array(cols).fill(0);
  const placed = kids.map(el => {
    const c = heights.indexOf(Math.min(...heights));
    const at = `translate(${Math.round(c * (colW + GAP))}px, ${Math.round(heights[c])}px)`;
    heights[c] += el.offsetHeight + GAP;
    return [el, at];
  });
  grid.style.height = Math.max(...heights) - GAP + 'px';
  for (const [el, at] of placed) {
    if (el.dataset.pos === at) continue;
    const from = prev?.get(cardKey(el));
    if (!el.dataset.pos) {
      el.style.transition = 'none';
      if (from) el.style.transform = from;   // was on screen: slide from there
      else if (prev?.size) el.classList.add('wc-enter'); // newly shown: fade in
      void el.offsetWidth;                   // commit the start state
      el.style.transition = prev ? '' : 'none';
    }
    el.style.transform = at;
    el.classList.remove('wc-enter');
    el.dataset.pos = at;
  }
  if (!prev) requestAnimationFrame(() => kids.forEach(el => { el.style.transition = ''; }));

  // Re-stack when the grid resizes or a card's height changes (fonts, images).
  // Only re-attach when the cards changed: observe() always fires once.
  let ro = observers.get(grid);
  if (!ro) {
    let queued = false;
    ro = new ResizeObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; masonry(grid, cardPositions(grid)); });
    });
    observers.set(grid, ro);
  }
  if (ro.cards?.length !== kids.length || kids.some((el, i) => ro.cards[i] !== el)) {
    ro.disconnect();
    ro.observe(grid);
    kids.forEach(el => ro.observe(el));
    ro.cards = kids;
  }
}
