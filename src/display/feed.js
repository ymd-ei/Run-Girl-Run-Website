/**
 * Social feed: #rgr-tagged posts from other platforms, shown in the Work grid
 * next to projects and opened in the project panel.
 *
 * Bluesky is read straight from its public API in the visitor's browser (no
 * login, CORS-enabled). The account comes from Site settings → Social links (a
 * bsky.app/profile/… link). Instagram needs the account's token, so the Worker
 * reads it (/api/feed/instagram) whenever an instagram.com link is in Social
 * links. Substack goes through the Worker too (/api/feed/substack), for a
 * <name>.substack.com or substack.com/@<name> link.
 *
 * Post shape: { id, source, url, date, title?, text, html?, tags[], media[{type,url,alt,poster?,w?,h?}] }
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

async function fetchInstagram() {
  const base = window.RGR_CONFIG?.apiBase || '';
  const res = await fetch(`${base}/api/feed/instagram`);
  if (res.status === 503) return []; // not connected yet
  if (!res.ok) throw new Error('Instagram feed HTTP ' + res.status);
  return (await res.json()).posts || [];
}

function substackPub(site) {
  for (const l of site.contact?.links || []) {
    const m = String(l.url || '').match(/^https?:\/\/(?:([a-z0-9-]+)\.substack\.com|(?:www\.)?substack\.com\/@([a-z0-9_-]+))/i);
    const name = m && (m[1] !== 'www' ? m[1] : null) || m && m[2];
    if (name) return name.toLowerCase();
  }
  return '';
}

async function fetchSubstack(pub) {
  const base = window.RGR_CONFIG?.apiBase || '';
  const res = await fetch(`${base}/api/feed/substack?pub=${encodeURIComponent(pub)}`);
  if (!res.ok) throw new Error('Substack feed HTTP ' + res.status);
  return (await res.json()).posts || [];
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
  if ((site.contact?.links || []).some(l => /instagram\.com\//.test(l.url || ''))) jobs.push(fetchInstagram());
  const pub = substackPub(site);
  if (pub) jobs.push(fetchSubstack(pub));
  const results = await Promise.allSettled(jobs);
  results.filter(r => r.status === 'rejected').forEach(r => console.warn('Feed source failed:', r.reason));
  return withFilters(results.flatMap(r => (r.status === 'fulfilled' ? r.value : [])), site);
}

/** Keep #rgr posts, give each its filters, newest first. */
export function withFilters(posts, site) {
  return posts
    .map(p => ({ ...p, filters: classifyPostTags(p.tags, site.filters)?.filters }))
    .filter(p => p.filters)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/* ── Cards ───────────────────────────────────────────── */

const srcBadge = s => `<span class="src-dot"><i style="background:${s.color}" aria-hidden="true"></i>${s.label}</span>`;

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
  // Cards are buttons for keyboard and screen reader users (Enter/Space: see utils/a11y.js)
  const open = `role="button" tabindex="0" onclick="window.display?.openPost?.('${esc(p.id)}')"`;

  if (!img && !uniform) {
    return `<div class="wc wc-quote" data-types="${types}" data-key="${esc(likeKey(p.id))}" ${open}>
      <p class="q-text">${esc(quote(stripTags(p.text) || postTitle(p)))}</p>
      <p class="wcty">${srcBadge(s)} ${meta}</p>
    </div>`;
  }

  const shape = !uniform && img?.w && img?.h ? ` style="aspect-ratio:${fitRatio(img.w, img.h)}"` : '';
  const thumb = !img
    ? `<div class="textthumb"><span>${esc(quote(stripTags(p.text) || postTitle(p)))}</span></div>`
    : img.type === 'video' && img.poster
      ? `<img src="${esc(img.poster)}" alt="" loading="lazy">`
      : img.type === 'video' && !img.video
        ? `<video src="${esc(img.url)}#t=0.1" muted playsinline preload="metadata"></video>`
        : `<img src="${esc(img.url)}" alt="${esc(img.alt)}" loading="lazy">`;
  const ratio = !uniform && img?.w && img?.h ? ` data-ratio="${fitRatio(img.w, img.h)}"` : '';
  return `<div class="wc" data-types="${types}" data-key="${esc(likeKey(p.id))}" data-source="${esc(p.source)}" data-date="${esc(p.date)}"${ratio} ${open}>
    <div class="wci"${shape}>
      ${thumb}
      ${srcBadge(s)}
      ${p.media.length > 1 ? `<span class="src-dot src-count">${p.media.length} items</span>` : ''}
      <div class="wco" aria-hidden="true">View post</div>
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
      // Substack's own "subscribe" box sends readers away; the post ends with our own way out
      if (el.matches('.subscription-widget-wrap-editor, [data-component-name="SubscribeWidgetToDOM"]')) { el.remove(); continue; }
      // Substack's uploaded video is only an id in the article; its /src link redirects to the file
      if (el.classList.contains('native-video-embed')) {
        let id = '';
        try { id = JSON.parse(el.dataset.attrs || '{}').mediaUploadId || ''; } catch { /* no id: drop it */ }
        if (/^[0-9a-f-]{36}$/i.test(id)) {
          const box = document.createElement('div');
          box.className = 'bl-video';
          const v = document.createElement('video');
          v.src = `https://substack.com/api/v1/video/upload/${id}/src?type=mp4#t=0.1`;
          v.controls = true; v.playsInline = true; v.preload = 'metadata';
          box.append(v);
          el.replaceWith(box);
        } else el.remove();
        continue;
      }
      if (DROP.has(el.tagName)) { el.remove(); continue; }
      // Substack wraps each image in a link to the full-size file; keep readers on the page
      if (el.tagName === 'A' && el.classList.contains('image-link')) { el.replaceWith(...el.childNodes); continue; }
      if (!ALLOWED.has(el.tagName)) { el.replaceWith(...el.childNodes); continue; }
      for (const a of [...el.attributes]) {
        const ok = ['href', 'src', 'alt'].includes(a.name) && !/^\s*(javascript|data):/i.test(a.value);
        if (!ok) el.removeAttribute(a.name);
      }
      if (el.tagName === 'A') { el.target = '_blank'; el.rel = 'noopener'; el.className = 'post-tag'; } // links wear the hashtag look
      if (el.tagName === 'IMG') el.loading = 'lazy';
      if (el.tagName === 'H1') { const h = document.createElement('h2'); h.append(...el.childNodes); el.replaceWith(h); }
    }
  };
  walk(doc.body);
  restyle(doc);
  return doc.body.innerHTML;
}

/* Dress cleaned article HTML in the site's own widgets (styles-main.css .bl-*) */
const mk = (doc, tag, cls, html = '') => { const e = doc.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
// Substack writes paragraph breaks inside one <p> as <br><br>
const paras = html => html.split(/(?:<br\s*\/?>\s*){2,}/i).map(x => x.replace(/^(?:\s|<br\s*\/?>)+|(?:\s|<br\s*\/?>)+$/gi, '')).filter(Boolean);

function restyle(doc) {
  const body = doc.body;
  for (const p of [...body.querySelectorAll('p')]) {
    const parts = paras(p.innerHTML);
    if (parts.length > 1) p.replaceWith(...parts.map(x => mk(doc, 'p', '', x)));
  }
  // The process widget is a list (<ol class="bl-process">), so Substack lists just
  // take its classes. Each item is a box (bold opening line as the title, then the
  // first paragraph) followed by the rest of the item's text, inside one list item.
  // An image right after a list becomes the picture of its last box; further images
  // stay in the article, and a list that comes after them carries on the numbering.
  const imgOf = el => {
    if (el.tagName === 'IMG') return el;
    const imgs = el.querySelectorAll('img');
    const plain = el.tagName === 'P' ? !el.textContent.trim() : el.tagName === 'FIGURE';
    return plain && imgs.length === 1 ? imgs[0] : null;
  };
  let count = 0, last = null; // steps so far, and the last list (numbering resumes only across images)
  for (const list of [...body.querySelectorAll('ol, ul')]) {
    if (list.closest('.bl-process') && list.closest('.bl-process') !== list) continue;
    let between = list.previousElementSibling;
    while (between && imgOf(between)) between = between.previousElementSibling;
    count = last && between === last && last.tagName === list.tagName ? count : 0;
    if (count) list.style.counterReset = 'step ' + count;
    list.className = 'bl-process';
    for (const li of list.children) {
      li.className = 'bl-process-item';
      if (!li.querySelector(':scope > p')) li.innerHTML = `<p>${li.innerHTML}</p>`; // item without paragraphs
      const f = li.firstElementChild;
      const lead = f.children.length === 1 && f.firstElementChild.tagName === 'STRONG'
        && f.textContent.trim() === f.firstElementChild.textContent.trim() ? f.textContent.trim() : '';
      if (lead) { const h = mk(doc, 'h4'); h.textContent = lead; f.replaceWith(h); }
      const kids = [...li.children];
      const firstP = kids.findIndex(c => c.tagName === 'P');
      const copy = mk(doc, 'div', 'bl-process-copy');
      copy.append(...kids.slice(0, firstP + 1));
      const card = mk(doc, 'div', 'bl-process-step');
      card.append(copy);
      li.replaceChildren(card, ...kids.slice(firstP + 1));
      count++;
    }
    const next = list.nextElementSibling, pic = next && imgOf(next);
    if (pic) {
      const card = list.lastElementChild.firstElementChild;
      const cap = next.querySelector('figcaption')?.textContent.trim();
      card.classList.add('has-image');
      card.prepend(mk(doc, 'img', 'bl-process-step-image'), mk(doc, 'div', 'bl-process-step-overlay'));
      card.firstElementChild.src = pic.getAttribute('src');
      card.firstElementChild.alt = pic.getAttribute('alt') || cap || '';
      next.remove();
    }
    last = list;
  }
  // Images next to each other become the site's gallery (2 columns for 2 or 4, else 3)
  const run = [];
  const flush = () => {
    if (run.length > 1) {
      const cols = run.length % 3 === 0 || run.length > 4 ? 3 : 2;
      const gal = mk(doc, 'div', `bl-gallery cols-${cols}`);
      for (const el of run) {
        const img = imgOf(el), cap = el.querySelector?.('figcaption')?.textContent.trim();
        const fig = mk(doc, 'figure', 'bl-gallery-item');
        const pic = mk(doc, 'img', 'bl-gallery-open');
        pic.src = pic.dataset.fullSrc = img.getAttribute('src');
        pic.alt = pic.dataset.fullAlt = img.getAttribute('alt') || cap || '';
        fig.append(pic);
        if (cap) { const fc = mk(doc, 'figcaption'); fc.textContent = cap; fig.append(fc); }
        gal.append(fig);
      }
      run[0].before(gal);
      run.forEach(el => el.remove());
    }
    run.length = 0;
  };
  for (const el of [...body.children]) { if (imgOf(el)) run.push(el); else flush(); }
  flush();
  for (const q of body.querySelectorAll('blockquote')) q.replaceWith(mk(doc, 'div', 'bl-quote', `<p>${q.textContent.trim()}</p>`));
  for (const hr of body.querySelectorAll('hr')) hr.replaceWith(mk(doc, 'div', 'bl-divider'));
}

function mediaBlock(m, p) {
  if (m.video) {
    return `<a class="bl-image post-video-still" href="${esc(p.url)}" target="_blank" rel="noopener">
      <img src="${esc(m.url)}" alt="${esc(m.alt)}" loading="lazy"><span>Play on ${esc(SOURCES[p.source]?.label || '')} ↗</span></a>`;
  }
  return m.type === 'video'
    ? `<div class="bl-image post-media"><video src="${esc(m.url)}"${m.poster ? ` poster="${esc(m.poster)}"` : ''} controls playsinline preload="metadata"></video></div>`
    : `<div class="bl-image post-media"><img src="${esc(m.url)}" alt="${esc(m.alt)}" loading="lazy"></div>`;
}

/** Hero image: the first still (never a video file). */
export const postHero = p => {
  const m = (p.media || []).find(x => x.type !== 'video' || x.video || x.poster);
  return m && m.type === 'video' && m.poster ? { ...m, url: m.poster, fromVideo: true } : m;
};

/** Everything under the hero: the full text or article, the rest of the media, then the way out. */
export function postBodyHTML(p) {
  const s = SOURCES[p.source] || { label: p.source };
  const hero = postHero(p);
  // A video whose poster became the banner still plays below
  const rest = (p.media || []).filter(m => m.url !== hero?.url || m.video || hero?.fromVideo);
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
  if (!box || !w || !h) return;
  box.style.aspectRatio = fitRatio(w, h);
  const card = box.closest('.wc');
  if (card) card.dataset.ratio = fitRatio(w, h); // lets wide thumbnails span two columns
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
const SPAN_SLACK = 120; // px: how uneven two columns may be for a card to span both
const WIDE_RATIO = 1.7;  // thumbnails this wide or wider (16:9, 2:1) may span two columns

const SQUARE_MIN = 0.8, SQUARE_MAX = 1.25; // near-square thumbnails (4:5 to 5:4)
const isSquare = el => +el.dataset.ratio >= SQUARE_MIN && +el.dataset.ratio <= SQUARE_MAX;

/* For each source (projects, Instagram, Bluesky, Substack) only the newest card
   with a near-square thumbnail may become a 2×2 feature. Projects compare by
   year, then by their place in the project order. */
function squareFeatures(kids) {
  const best = new Map();
  for (const el of kids) {
    if (!isSquare(el)) continue;
    const src = el.dataset.source || 'project';
    const cur = best.get(src);
    const newer = !cur || el.dataset.date > cur.dataset.date
      || (el.dataset.date === cur.dataset.date && +(el.dataset.order || 0) < +(cur.dataset.order || 0));
    if (newer) best.set(src, el);
  }
  return new Set(best.values());
}

// Quote strips, wide thumbnails and each source's newest near-square card may
// take two columns (a square at double width becomes a 2×2 feature)
const canSpan = (el, features) => el.classList.contains('wc-quote') || +el.dataset.ratio >= WIDE_RATIO || features.has(el);
const cardKey = el => el.dataset.key;
export const cardPositions = grid => new Map([...grid.children].filter(el => el.dataset.pos && !el.classList.contains('wc-leave')).map(el => [cardKey(el), el.dataset.pos]));
const observers = new WeakMap();

export function masonry(grid, prev) {
  const kids = [...grid.children].filter(el => el.classList.contains('wc') && !el.classList.contains('wc-leave'));
  grid.classList.toggle('masonry', kids.length > 0);
  if (!kids.length) { grid.style.height = ''; return; }
  const w = grid.clientWidth;
  if (!w) return; // panel hidden; the observer re-runs this once it has a width
  const cols = w < 520 ? 1 : w < 600 ? 2 : 3;
  grid.dataset.cols = cols; // styles-main.css compacts card text at 3 columns
  const colW = (w - GAP * (cols - 1)) / cols;
  const heights = Array(cols).fill(0);
  const features = squareFeatures(kids);
  const placed = kids.map(el => {
    const shortest = heights.indexOf(Math.min(...heights));
    // At 3 columns a quote strip or wide thumbnail spans two neighbouring
    // columns when they're close in height and it wouldn't sit much lower
    // than a 1-wide card would
    let c = shortest, span = 1;
    if (cols >= 3 && canSpan(el, features)) {
      for (let i = 0; i < cols - 1; i++) {
        const top = Math.max(heights[i], heights[i + 1]);
        const even = Math.abs(heights[i] - heights[i + 1]) <= SPAN_SLACK;
        if (even && top - heights[shortest] <= SPAN_SLACK && (span === 1 || top < Math.max(heights[c], heights[c + 1]))) { c = i; span = 2; }
      }
    }
    el.classList.toggle('wc-wide', span === 2);
    el.style.width = (span === 2 ? colW * 2 + GAP : colW) + 'px';
    const top = span === 2 ? Math.max(heights[c], heights[c + 1]) : heights[c];
    const at = `translate(${Math.round(c * (colW + GAP))}px, ${Math.round(top)}px)`;
    const bottom = top + el.offsetHeight + GAP;
    heights[c] = bottom;
    if (span === 2) heights[c + 1] = bottom;
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
