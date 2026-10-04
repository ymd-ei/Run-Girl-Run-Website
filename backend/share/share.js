/**
 * Share worker: link previews for social feed posts.
 *
 *   https://share.rungirlrun.workers.dev/b<rkey>   a Bluesky post
 *   https://share.rungirlrun.workers.dev/i<id>     an Instagram post
 *
 * Chat apps (Discord, iMessage, Slack...) read the meta tags without running
 * scripts, so this returns a tiny page with the post's own title, text and
 * image, and sends people on to the post on the site (?post=...). A post that's
 * gone or no longer tagged #rgr falls back to the site's own preview and the
 * homepage. Nothing is stored; replies are cached briefly.
 *
 * Projects don't use this: the editor writes their pages to p/<id>/ on the site.
 */

const SOURCES = { bluesky: 'Bluesky', instagram: 'Instagram' };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const code = decodeURIComponent(url.pathname.slice(1)).replace(/\/+$/, '');
    if (!code) return Response.redirect(env.SITE, 302);

    const cache = caches.default;
    const hit = await cache.match(request);
    if (hit) return hit;

    const site = await siteData(env);
    let post = null;
    try {
      if (code.startsWith('b')) post = await blueskyPost(code.slice(1), site);
      else if (code.startsWith('i')) post = await instagramPost(code.slice(1), env);
    } catch (e) {
      post = null; // fall back to the site preview
    }
    if (post && !isTagged(post.tags)) post = null;

    const res = new Response(page(post, site, env, `${url.origin}/${code}`), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' }
    });
    ctx.waitUntil(cache.put(request, res.clone()));
    return res;
  }
};

/* ── Site settings (name, share preview, default banner, filters, Bluesky account) ── */
async function siteData(env) {
  try {
    const r = await fetch(`${env.SITE}/content.json`, { cf: { cacheTtl: 300 } });
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}

const isTagged = tags => (tags || []).some(t => t === 'rgr' || t.startsWith('rgr-'));
const normTag = t => String(t || '').trim().replace(/^#+/, '').toLowerCase();

/* ── Bluesky: read the post straight from the public API ── */
async function blueskyPost(rkey, site) {
  if (!/^[a-z0-9]+$/i.test(rkey)) return null;
  const link = (site.contact?.links || []).find(l => /bsky\.app\/profile\//.test(l.url || ''));
  const handle = link ? link.url.split('/profile/')[1].split(/[/?#]/)[0] : '';
  if (!handle) return null;
  const uri = `at://${handle}/app.bsky.feed.post/${rkey}`;
  const r = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0&parentHeight=0`);
  if (!r.ok) return null;
  const p = (await r.json()).thread?.post;
  if (!p) return null;
  const rec = p.record || {};
  const facetTags = (rec.facets || []).flatMap(f => f.features || [])
    .filter(x => x.$type === 'app.bsky.richtext.facet#tag').map(x => x.tag);
  const textTags = [...(rec.text || '').matchAll(/#([\w-]+)/g)].map(m => m[1]);
  const e = p.embed || {};
  const view = e.media || e;
  const image = view.images?.[0]?.fullsize || view.thumbnail || view.external?.thumb || '';
  return {
    id: 'bsky:' + rkey, source: 'bluesky',
    date: rec.createdAt || p.indexedAt, text: rec.text || '',
    tags: [...new Set([...facetTags, ...textTags].map(normTag))], image,
  };
}

/* ── Instagram: reuse the main worker's feed (already #rgr-only and cached) ── */
async function instagramPost(id, env) {
  if (!/^[0-9]+$/.test(id)) return null;
  const r = await fetch(`${env.FEED_API}/api/feed/instagram`);
  if (!r.ok) return null;
  const p = ((await r.json()).posts || []).find(x => x.id === 'ig:' + id);
  if (!p) return null;
  const first = p.media?.[0] || {};
  return { ...p, tags: (p.tags || []).map(normTag), image: first.type === 'video' ? first.poster : first.url };
}

/* ── The preview page ── */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripTags = s => String(s || '').replace(/(^|\s)#[\w-]+/g, '').replace(/\s+/g, ' ').trim();
const abs = (p, env) => (!p ? '' : /^https?:/i.test(p) ? p : encodeURI(`${env.SITE}/${String(p).replace(/^\/+/, '')}`));

function postTitle(post) {
  const text = stripTags(post.text);
  const first = text.split(/(?<=[.!?])\s/)[0] || '';
  const short = first.length <= 70 ? first : first.slice(0, 70).replace(/\s+\S*$/, '') + '…';
  if (!short) return `${SOURCES[post.source] || 'Social'} post`;
  return post.image ? short : `“${short}”`; // text-only posts read as a quote
}

function filterLabels(tags, site) {
  return (site.filters || []).filter(f => {
    const v = normTag(f.value);
    const extra = Array.isArray(f.tags) ? f.tags : String(f.tags || '').split(/[\s,]+/);
    return tags.includes('rgr-' + v) || extra.map(normTag).filter(Boolean).some(t => tags.includes(t));
  }).map(f => f.label || f.value);
}

function page(post, site, env, selfUrl) {
  const name = site.name || 'Run Girl Run';
  let title, desc, image, go;
  if (post) {
    const date = new Date(post.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    title = postTitle(post);
    desc = [`${name} on ${SOURCES[post.source] || 'social'}`, ...filterLabels(post.tags, site), date].join(' · ');
    const more = stripTags(post.text);
    if (more && more.length > title.length + 2) desc += ` — ${more.length > 160 ? more.slice(0, 157) + '…' : more}`;
    image = post.image || abs(site.postBanner, env) || abs(site.ogImage, env);
    go = `${env.SITE}/?post=${encodeURIComponent(post.id)}`;
  } else {
    title = site.ogTitle || name;
    desc = site.ogDescription || '';
    image = abs(site.ogImage, env);
    go = env.SITE + '/';
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — ${esc(name)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${esc(selfUrl)}">
<meta property="og:site_name" content="${esc(name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<script>window.location.replace(${JSON.stringify(go)});</script>
</head>
<body>
<p><a href="${esc(go)}">${esc(title)} — ${esc(name)}</a></p>
</body>
</html>
`;
}
