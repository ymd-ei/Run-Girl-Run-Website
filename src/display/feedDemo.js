/**
 * Demo content for the social feed: placeholder posts that fill the Work grid
 * so the stacked layout can be judged before there are real posts. Loaded only
 * when the URL has ?demo (see refreshFeed in main.js); visitors never see it.
 *
 * Images are plain gradient placeholders labelled with their shape, plus a few
 * of the site's own media files. Likes on demo posts stay local.
 */

const DAY = 24 * 60 * 60 * 1000;
const ago = days => new Date(Date.now() - days * DAY).toISOString();

// A gradient placeholder at a given shape, labelled so it's obviously a proxy
function placeholder(w, h, label, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},55%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},45%,28%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" fill="rgba(255,255,255,.85)" font-family="sans-serif" font-size="${Math.round(Math.min(w, h) / 7)}"
      text-anchor="middle" dominant-baseline="middle">${label}</text>
  </svg>`;
  return { type: 'image', url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), alt: `Placeholder ${label}`, w, h };
}

const ARTICLE = `<p>A short placeholder article, standing in for a Substack post so the panel can be checked with headings, images and lists.</p>
<h2>Blocking the jump</h2>
<p>Three keys carry the whole thing: contact, down and recover. The down pose holds two frames longer than feels right.</p>
<blockquote>If a landing feels floaty, the down pose is leaving too early.</blockquote>
<h2>What changed in the polish pass</h2>
<ul><li>Hips lead, shoulders follow</li><li>Overlap on the hair, one frame later</li><li>Settle the hands last</li></ul>
<p>Next week: the face.</p>`;

/** Demo posts in the feed's post shape, tagged so the site's own filter rules place them. */
export function demoPosts() {
  return [
    { id: 'demo:1', source: 'instagram', date: ago(1), text: 'Turnaround pass for the dance loop, swipe for the rough #rgr-3d', tags: ['rgr-3d'],
      media: [placeholder(1080, 1350, '4:5', 265), placeholder(1080, 1350, '4:5 · 2', 285)] },
    { id: 'demo:2', source: 'bluesky', date: ago(2), text: 'New rig day. #rgr', tags: ['rgr'], media: [] },
    { id: 'demo:3', source: 'bluesky', date: ago(4), text: 'Spent the weekend rebuilding the shoulder rig for the dance loop. The arm swings finally hold their shape and the elbows stop popping on the big poses. Face next. #rgr-3d', tags: ['rgr-3d'], media: [] },
    { id: 'demo:4', source: 'instagram', date: ago(6), text: 'Loop study, smaller and loopier #rgr-2d', tags: ['rgr-2d'],
      media: [placeholder(1080, 1080, '1:1', 20)] },
    { id: 'demo:5', source: 'substack', date: ago(9), title: 'Process notes: animating weight without mocap', text: 'Three keys, a kitchen step stool and a lot of patience. #rgr-3d', tags: ['rgr-3d'],
      html: ARTICLE, media: [placeholder(1600, 900, '16:9 cover', 200)] },
    { id: 'demo:6', source: 'bluesky', date: ago(12), text: 'Batch thumbnail renders overnight, a little pipeline win #rgr-pipeline', tags: ['rgr-pipeline'],
      media: [placeholder(1500, 1000, '3:2', 160)] },
    { id: 'demo:7', source: 'instagram', date: ago(15), text: 'Reel cut, vertical edit #rgr', tags: ['rgr'],
      media: [{ type: 'video', url: 'media/ZLD.Rack-Hit0025-0350.mp4', poster: placeholder(1080, 1920, '9:16 → 4:5', 320).url }] },
    { id: 'demo:8', source: 'bluesky', date: ago(19), text: 'Wide establishing frame for the new short #rgr-3d #rgr-design', tags: ['rgr-3d', 'rgr-design'],
      media: [placeholder(2000, 1000, '2:1', 230)] },
    { id: 'demo:9', source: 'bluesky', date: ago(23), text: 'Reminder to self: hold the down pose one more frame. #rgr', tags: ['rgr'], media: [] },
    { id: 'demo:10', source: 'instagram', date: ago(28), text: 'Card animation, twelve frames #rgr-rfb', tags: ['rgr-rfb'],
      media: [placeholder(1080, 1350, '4:5', 0)] },
    { id: 'demo:11', source: 'substack', date: ago(34), title: 'What a card animation actually takes', text: 'Twelve frames, four revisions, one patient art director. #rgr-rfb', tags: ['rgr-rfb'],
      html: ARTICLE, media: [] },
    { id: 'demo:12', source: 'bluesky', date: ago(41), text: 'Pancake stack lighting test #rgr-design', tags: ['rgr-design'],
      media: [{ type: 'image', url: 'media/pancake_syyrup.png', alt: 'Pancake render', w: 2880, h: 1920 }] },
    { id: 'demo:13', source: 'instagram', date: ago(50), text: 'Woke Up, hero frame #rgr-3d', tags: ['rgr-3d'],
      media: [{ type: 'image', url: 'media/woke-up_hero.webp', alt: 'Woke Up hero frame', w: 920, h: 519 }] },
    { id: 'demo:14', source: 'bluesky', date: ago(63), text: 'Started keeping a little animation diary here. Small tests, failed takes, the occasional win. Tag along if you like watching things slowly get better. #rgr', tags: ['rgr'], media: [] },
  ].map(p => ({ url: '#', ...p }));
}

/** Made-up like counts so Most liked has something to sort. */
export function demoLikes() {
  return { 'demo-1': 24, 'demo-2': 3, 'demo-3': 11, 'demo-4': 17, 'demo-5': 9, 'demo-6': 2, 'demo-7': 31, 'demo-8': 6, 'demo-9': 1, 'demo-10': 14, 'demo-11': 4, 'demo-12': 8, 'demo-13': 19, 'demo-14': 5 };
}
