/**
 * The phone site (mobile.html), built to behave like an app. It reuses the desktop's
 * renderers and styles-content.css, so projects, posts and blocks look the same on
 * both, and reads everything from content.json. It lives in the /links card: it floats over the frosted reel, with
 * four tabs under it (Home, Work, About, Contact). Contact is the card's back.
 * Each tab keeps its own stack of screens: a project, a post or Privacy & Legal
 * slides in from the right over the screen it was opened from, which stays as it
 * was underneath (scroll position and all). Back, the phone's Back, Escape or a
 * swipe to the right slides it away again. Tapping the tab you're on goes back to
 * its first screen, then to the top. Swiping sideways on a tab's first screen
 * goes to the tab next to it. Pulling a tab's first screen down from its
 * top refreshes the content.
 *
 * Still a web page: every pushed screen is a history entry, so the browser's
 * Back works, and nothing needs installing. Added to the home screen
 * (app.webmanifest) it opens full screen.
 */

import { phosphorIcon } from '../utils/icons.js';
import { setRefContext, resolveRefs, resolveLinkUrl } from '../utils/refs.js';
import { applySiteText, renderLegal } from './siteChrome.js';
import { initA11y } from '../utils/a11y.js';
import { liveFetch, contentNow, keepContent } from '../utils/liveContent.js';
import { bindLiteToggles } from '../utils/lite.js';
import { pauseVideosWhenIdle } from '../utils/idleVideos.js';
import { DEFAULT_FILTERS, projectTypes, projectTypeLabels } from '../utils/projectTypes.js';
import { normalizeBlocks } from '../modules/blocks/blockManager.js';
import { renderDisplayBlocks, renderWorkGrid, initSensitiveTapes, initCountUps } from './displayRenderer.js';
import { loadFeed, postCardHTML, postBodyHTML, postHero, postTitle, fmtDate, likeKey, SOURCES } from './feed.js';
import { fetchLikeCount, sendLike, loadLikeCounts, copyShareLink } from './likes.js';
import { renderFilterRow, markCardLikes } from './workFilters.js';
import { $, media, row, renderTop, renderReel, iconsHTML, renderMail, initPageBg } from './linkCard.js';
import { calm, GLIDE, slideIn, slideOut, screenFrame, legalScreen, pdfScreen, watchScroll, sideways, swipeBack } from './screens.js';
import { showsOn } from '../utils/socials.js';
import { applyThemeVars } from '../utils/themeVars.js';

const TABS = ['home', 'work', 'about', 'contact'];

let data = null;
let projects = [];             // project cards, in the hand-set order
let posts = [];                // tagged social posts, filled in once the feed loads
const projectCache = new Map();
let workFilter = 'all';
let workSort = 'newest';       // 'newest' | 'likes'
const likeCounts = new Map();
let openItem = null;           // { kind: 'project' | 'post', id } on the screen in view
let bgKey = '';
const drawn = {};              // tabs filled so far (Work and About fill on first visit)

/* ── Start ─────────────────────────────────────────── */

async function init() {
  initA11y();
  bindNav();
  bindLiteToggles(() => {
    if (!data) return;
    initPageBg(data);
    if (!document.querySelector('#reel.playing')) renderReel(data, true);
  });
  document.addEventListener('touchstart', () => {}, { passive: true });   // iPhone only shows :active (pressed) styles with this
  pauseVideosWhenIdle();
  document.addEventListener('visibilitychange', onVisibility);

  // The last visit's content draws straight away; the fresh copy replaces it if it differs
  // (not under someone mid-read: with a project open, it waits for the next launch)
  try {
    await contentNow('content.json', d => { data = d; render(); }, () => TABS.every(t => stacks[t].length === 1));
  } catch (e) {
    if (!data) { $('rows').innerHTML = '<p class="note">Couldn’t load the site just now. Check your connection and reopen.</p>'; return; }
  }
  loadFeed(data).then(list => {
    posts = list;
    renderShelf();
    if (drawn.work) renderWork();
  }).catch(e => console.warn('Feed failed to load:', e));
}

/** Everything that comes from content.json. Safe to run again with newer content. */
function render() {
  setRefContext(data, data.projectCards || []);
  applyThemeVars(data.theme);
  if (data.theme && data.theme.panelBg) document.documentElement.style.setProperty('--card', data.theme.panelBg);
  if (data.siteTitle) document.title = data.siteTitle;
  if (data.favicon) $('favicon').href = data.favicon;

  // The hero reel, frosted, behind the card: rebuilt only when the reel itself changes
  const bg = JSON.stringify([data.reel && data.reel.url, data.reel && data.reel.poster]);
  if (bg !== bgKey) { bgKey = bg; initPageBg(data); }

  // Home
  renderTop(data);
  renderReel(data);
  const contact = data.contact || {};
  const links = (contact.links || []).filter(l => l.url && showsOn(l, 'links'))
    .map(l => ({ ...l, url: resolveLinkUrl(l.url, data), icon: phosphorIcon(l.url) || 'ph-fill ph-link' }));
  const substack = links.find(l => /substack\.com/.test(l.url));
  const lp = data.linksPage || {};
  $('rows').innerHTML =
    (substack ? row({ label: substack.label || 'Substack', sub: lp.writingSub || 'Notes from the studio', url: substack.url, icon: 'ph-fill ph-article', main: true }) : '') +
    (contact.resume ? row({ label: 'Résumé', sub: 'Look through it here', url: media(contact.resume), icon: 'ph-fill ph-file-text', newTab: true }) : '');
  const icons = iconsHTML(links.filter(l => !l.url.startsWith('mailto:') && l !== substack));
  $('icons').innerHTML = icons;

  // Contact: the words from Site settings → Contact, the email and the socials
  const panel = data.contactPanel || {};
  $('ct-title').innerHTML = (panel.title || "Let's") + ' <span class="accent-word">' + (panel.titleAccent || 'work.') + '</span>';
  $('ct-sub').innerHTML = resolveRefs(panel.sub || '');
  renderMail(contact.email || '');
  $('ct-icons').innerHTML = icons;

  applySiteText(data);
  renderLegal(data, $('legal-card'));

  const cards = new Map((data.projectCards || []).map(c => [c.id, c]));
  projects = (data.projects || []).map(id => cards.get(id)).filter(p => p && p.published !== false);
  renderShelf();
  if (drawn.work) renderWork();
  if (drawn.about) renderAbout();
  sync();
}

/* ── Tabs and stacks ───────────────────────────────── */

const stacks = Object.fromEntries(TABS.map(t => [t, [document.querySelector(`#tab-${t} .screen`)]]));
let tab = 'home';
let n = (history.state && history.state.n) || 0;   // where we are in the browser's history
const entries = [];            // one per pushed screen, in order: the tab it's on (null once that screen is gone)
let quiet = false;             // the next history step back is bookkeeping only (screens already removed)
let swipe = null;              // { p } when a swipe let go: Back carries on from there
let edgeAt = 0;                // when a touch last started at a screen edge (the browser's own back swipe)

const top = () => stacks[tab].at(-1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function bindNav() {
  TABS.forEach(t => watchScroll(stacks[t][0]));
  $('tabbar').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (b.dataset.tab !== tab) return switchTab(b.dataset.tab);
    // The tab you're on: back to its first screen, then to the top
    if (stacks[tab].length > 1) popToRoot(tab);
    else top().querySelector('.scroll').scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
  });
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) return switchTab(go.dataset.go);
    // The résumé opens as a screen to look through first; its button goes to the file
    const resume = data && data.contact && data.contact.resume && e.target.closest(`a[href="${media(data.contact.resume)}"]`);
    if (resume && !resume.closest('.pushed') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); return open({ resume: true }); }
    if (e.target.closest('.go-back')) history.back();
  });
  $('legal-open').addEventListener('click', () => open({ legal: true }));
  addEventListener('keydown', e => { if (e.key === 'Escape' && stacks[tab].length > 1) history.back(); });
  addEventListener('touchstart', e => {
    const x = e.touches[0].clientX;
    if (x < 28 || x > innerWidth - 28) edgeAt = performance.now();
  }, { passive: true });
  addEventListener('popstate', onPopState);
  bindSwipeBack();
  bindSwipeTabs();
  bindPullRefresh();

  // Cards, filter chips and header buttons call window.display, as on the desktop
  window.display = {
    openProject: id => open({ project: id }),
    openPost: id => open({ post: id }),
    filterWork(btn, type) { workFilter = type; renderWork(); },
    async sortWork(sort) {
      workSort = sort;
      if (sort === 'likes') await loadLikeCounts(workItems().map(x => x.key), likeCounts);
      renderWork();
    },
    async toggleLike() {
      if (!openItem) return;
      const id = openItem.kind === 'post' ? likeKey(openItem.id) : openItem.id;
      const res = await sendLike(id);
      if (res && likeCounts.has(id)) likeCounts.set(id, res.count);
    },
    copyShareLink() { if (openItem) copyShareLink(openItem); }
  };
}

/** Show a tab. Contact is the card's back, so going there (or coming back) turns
    the card over; `instant` skips the turn (the phone's Back landing on another tab). */
function switchTab(name, instant = false) {
  if (name === tab || !TABS.includes(name) || (flipping && !instant)) return;
  const turn = (name === 'contact') !== (tab === 'contact');
  const dir = name === 'contact' ? 1 : -1;
  tab = name;
  draw(name);
  $('tabbar').querySelectorAll('[data-tab]').forEach(b => b.dataset.tab === name ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  const show = () => {
    TABS.forEach(t => {
      const el = $('tab-' + t);
      el.classList.toggle('on', t === tab);                    // the tab now, not the one asked for: Back can change it mid-turn
      el.inert = t !== tab;
    });
    document.body.dataset.tab = tab;
    sync();
  };
  if (turn && !instant && !calm()) flipCard(dir, show); else show();
}

// Work and About fill the first time they're shown
function draw(name) {
  if (!data || drawn[name]) return;
  if (name === 'work') renderWork();
  if (name === 'about') renderAbout();
}

// The turn, in two halves: the card swings edge-on, changes side while it can't be
// seen, and swings on round. (No 3D back face to hide: Safari draws videos and
// frosted bits through one.)
let flipping = false;
function flipCard(dir, swap) {
  const card = $('tabs'), app = $('app');
  flipping = true;
  app.classList.add('flipping');
  const done = () => { flipping = false; app.classList.remove('flipping'); };
  const half = (from, to, ms, easing) => turnPart(card, from, to, ms, easing);
  half(0, 90 * dir, 240, 'cubic-bezier(.55,0,.85,.45)')
    .then(() => { swap(); return half(-90 * dir, 0, 330, 'cubic-bezier(.15,.6,.25,1)'); })
    .then(done);
}

const turned = deg => `perspective(1600px) rotateY(${deg}deg)`;
const turnPart = (card, from, to, ms, easing) =>
  card.animate([{ transform: turned(from) }, { transform: turned(to) }], { duration: calm() ? 0 : ms, easing }).finished.catch(() => {});

// Swipe sideways on a tab's first screen for the tab next to it. Home, Work and
// About sit side by side and slide with the finger inside the card; between About
// and Contact the card turns over under the finger instead. Past a third of the
// width, or with a flick, it carries on; otherwise it settles back. At either end
// the screen gives a little and springs back.
let paging = false;
function bindSwipeTabs() {
  const host = $('tabs'), app = $('app');
  const el = name => $('tab-' + name);
  let g = null;
  // Back to how the stylesheet has it
  const clear = d => {
    host.style.transform = '';
    [tab, d.to].filter(Boolean).forEach(t => { const x = el(t); x.style.transform = x.style.transition = ''; x.classList.remove('peek', 'hid'); });
  };
  const frame = dx => {
    const w = host.offsetWidth, dir = dx < 0 ? 1 : -1, to = TABS[TABS.indexOf(tab) + dir] || null;
    if (to !== g.to || dir !== g.dir) { clear(g); g.to = to; g.dir = dir; if (to) draw(to); }
    g.dx = dx;
    const cur = el(tab);
    if (!to) { g.kind = 'end'; cur.style.transform = `translate3d(${dx * .25}px,0,0)`; return; }
    const other = el(to);
    if (to === 'contact' || tab === 'contact') {
      // the turn: this side until the card is edge-on, the other side after
      g.kind = 'turn';
      g.a = Math.max(-180, Math.min(180, dx / w * 180));
      const past = Math.abs(g.a) >= 90;
      cur.classList.toggle('hid', past); other.classList.toggle('peek', past);
      host.style.transform = turned(past ? g.a - Math.sign(g.a) * 180 : g.a);
    } else {
      g.kind = 'slide';
      other.classList.add('peek');
      cur.style.transform = `translate3d(${dx}px,0,0)`;
      other.style.transform = `translate3d(${dx + dir * w}px,0,0)`;
    }
  };
  host.addEventListener('touchstart', e => {
    g = null;
    if (paging || flipping || stacks[tab].length > 1 || e.touches.length !== 1 || e.target.closest('video, input') || sideways(e.target, host)) return;
    const t = e.touches[0];
    g = { x: t.clientX, y: t.clientY, on: false, dx: 0, to: undefined, dir: 0, px: t.clientX, pt: e.timeStamp, v: 0 };
  }, { passive: true });
  host.addEventListener('touchmove', e => {
    if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.on) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) < Math.abs(dy) || !e.cancelable) { g = null; return; }         // steeper than 45°: a scroll
      g.on = true;
      app.classList.add('paging');
    }
    e.preventDefault();
    const dt = e.timeStamp - g.pt;
    if (dt > 0) { g.v = (t.clientX - g.px) / dt; g.px = t.clientX; g.pt = e.timeStamp; }
    frame(dx - Math.sign(dx) * 10);
  }, { passive: false });
  const end = e => {
    const d = g; g = null;
    if (!d || !d.on) return;
    const w = host.offsetWidth, dist = Math.abs(d.dx), done = Math.min(1, dist / w);
    const flick = Math.abs(d.v) > .45 && dist > 24 && Math.sign(d.v) === Math.sign(d.dx);
    const go = e.type === 'touchend' && !!d.to && (dist > w / 3 || flick);
    paging = true;
    const finish = () => {
      clear(d);
      if (go) switchTab(d.to, true);
      paging = false;
      setTimeout(() => app.classList.remove('paging'), 60);     // after the swap, so it doesn't also fade
    };
    if (d.kind === 'turn') {
      const cur = el(tab), other = el(d.to), sgn = Math.sign(d.a) || 1, past = Math.abs(d.a) >= 90;
      const shown = past ? d.a - sgn * 180 : d.a;               // the angle on screen now
      const ms = deg => Math.max(70, Math.abs(deg) / 180 * 520);
      const side = on => { cur.classList.toggle('hid', on); other.classList.toggle('peek', on); };
      host.style.transform = '';
      let run;
      if (go === past) run = turnPart(host, shown, 0, ms(shown), GLIDE);                       // already on the side it ends on
      else if (go) run = turnPart(host, shown, sgn * 90, ms(sgn * 90 - shown), 'ease-in')      // on round to the other side
        .then(() => { side(true); return turnPart(host, -sgn * 90, 0, ms(90), GLIDE); });
      else run = turnPart(host, shown, -sgn * 90, ms(-sgn * 90 - shown), 'ease-in')            // back round to this side
        .then(() => { side(false); return turnPart(host, sgn * 90, 0, ms(90), GLIDE); });
      run.then(finish);
    } else {
      const ms = calm() ? 0 : Math.round(160 + 300 * (go ? 1 - done : done));
      const cur = el(tab), other = d.to && el(d.to);
      [cur, other].forEach(x => { if (x) x.style.transition = `transform ${ms}ms ${GLIDE}`; });
      cur.style.transform = `translate3d(${go ? -d.dir * w : 0}px,0,0)`;
      if (other) other.style.transform = `translate3d(${go ? 0 : d.dir * w}px,0,0)`;
      setTimeout(finish, ms + 30);
    }
  };
  host.addEventListener('touchend', end);
  host.addEventListener('touchcancel', end);
}

/** Open a screen over the current one: { project } | { post } | { legal } | { resume }. */
function open(view) {
  pushScreen(view);
  entries.push(tab);
  history.pushState({ n: ++n, tab, view }, '');
}

/**
 * After any change of screen: only the screen in view keeps its element ids (two
 * projects can be open on different tabs, and the like button is found by id),
 * and videos elsewhere pause.
 */
function sync() {
  const live = top();
  document.querySelectorAll('.screen.pushed').forEach(el => {
    if (el === live) el.querySelectorAll('[data-sid]').forEach(x => { x.id = x.dataset.sid; delete x.dataset.sid; });
    else el.querySelectorAll('[id]').forEach(x => { x.dataset.sid = x.id; x.removeAttribute('id'); });
  });
  document.querySelectorAll('#tabs video').forEach(v => {          // not the frosted reel behind the card
    if (live.contains(v)) {
      if (v.dataset.resume) { delete v.dataset.resume; v.play().catch(() => {}); }
    } else if (!v.paused) {
      if (v.muted && v.loop) v.dataset.resume = '1';     // a silent loop picks up again; anything with sound stays paused
      v.pause();
    }
  });
  openItem = live.item || null;
  if (live.item && live.ready && !live.liked) {
    live.liked = true;
    fetchLikeCount(live.item.kind === 'post' ? likeKey(live.item.id) : live.item.id);
  }
}

// Locking the phone or switching apps keeps an inline video's sound playing on
// iPhone, so pause anything with sound; on return, nudge the silent loops in view
function onVisibility() {
  if (document.hidden) document.querySelectorAll('video').forEach(v => { if (!v.muted && !v.paused) v.pause(); });
  else top().querySelectorAll('video').forEach(v => { if (v.muted && v.autoplay && v.paused) v.play().catch(() => {}); });
}

/* ── Sliding screens (the moving parts are in screens.js, shared with /links) ── */

function pushScreen(view) {
  const under = top();
  const el = buildScreen(view);
  $('tab-' + tab).append(el);
  stacks[tab].push(el);
  slideIn(el, under);
  sync();
}

/** Take the top screen off the current tab. `p0`: where a swipe left it. */
function pop(how) {
  const st = stacks[tab];
  if (st.length < 2) return;
  const el = st.pop();
  slideOut(el, st.at(-1), how);
  sync();
}

function popToRoot(name) {
  const st = stacks[name];
  if (st.length < 2) return;
  st.splice(1, st.length - 2).forEach(el => el.remove());      // anything between goes unseen
  pop();
  // Those screens' history entries are spent. The ones at the end are stepped back
  // over now; any buried under another tab's are skipped when Back reaches them.
  entries.forEach((t, i) => { if (t === name) entries[i] = null; });
  let k = 0;
  while (k < entries.length && entries[entries.length - 1 - k] === null) k++;
  if (k) { quiet = true; history.go(-k); }
}

function onPopState(e) {
  const to = (e.state && e.state.n) || 0;
  if (to < n) {
    let steps = n - to, did = false;
    n = to;
    const silent = quiet; quiet = false;
    // The browser's own edge swipe already showed the page sliding: don't slide it twice
    const system = !swipe && !standalone() && performance.now() - edgeAt < 1500;
    while (steps-- > 0) {
      const t = entries.pop();
      if (silent || !t) continue;
      if (t !== tab) switchTab(t, true);
      pop({ animate: steps === 0 && !system, p0: swipe ? swipe.p : 0 });
      did = true;
    }
    swipe = null;
    if (!did && !silent && entries.length) history.back();     // landed on a spent entry: keep going
  } else if (to > n) {
    // Forward: put the screen back
    for (let i = n + 1; i < to; i++) entries.push(null);
    n = to;
    const s = e.state;
    if (s.view && TABS.includes(s.tab) && data) {
      if (s.tab !== tab) switchTab(s.tab, true);
      pushScreen(s.view);
      entries.push(s.tab);
    } else entries.push(null);
  }
}

// Swipe right anywhere on a pushed screen to go back
function bindSwipeBack() {
  swipeBack($('tabs'), {
    pair: () => { const st = stacks[tab]; return st.length > 1 ? [st.at(-1), st.at(-2)] : null; },
    go: p => { swipe = { p }; history.back(); }
  });
}

/* ── Pull down to refresh ──────────────────────────── */

// On a tab's first screen, scrolled to its top: drag the content down and the
// running dog shows in the gap; let go past the line and the site's content and
// posts are fetched again, in place (the page itself never reloads).
function bindPullRefresh() {
  const ARM = 64, MAX = 120, HOLD = 54;
  TABS.forEach(t => {
    const screen = stacks[t][0], sc = screen.querySelector('.scroll');
    const dog = document.createElement('div');
    dog.className = 'ptr'; dog.setAttribute('aria-hidden', 'true');
    dog.innerHTML = '<img alt="">';
    screen.insertBefore(dog, sc);
    let g = null, busy = false;
    // y: how far the content sits below its place
    const set = (y, ms = 0) => {
      const p = Math.min(1, y / ARM);
      sc.style.transition = ms ? `transform ${ms}ms ${GLIDE}` : 'none';
      dog.style.transition = ms ? `transform ${ms}ms ${GLIDE},opacity ${ms}ms ease` : 'none';
      sc.style.transform = y ? `translate3d(0,${y}px,0)` : '';
      dog.style.transform = `translate(-50%,${y / 2}px) translateY(-50%) scale(${.6 + .4 * p})`;
      dog.style.opacity = p < 1 ? p * .45 : .9;                 // faint until it will refresh
      if (ms && !y) setTimeout(() => { if (!g && !busy) sc.style.transition = ''; }, ms + 40);
    };
    sc.addEventListener('touchstart', e => {
      g = null;
      if (busy || stacks[t].length > 1 || e.touches.length !== 1 || sc.scrollTop > 0) return;
      g = { x: e.touches[0].clientX, y: e.touches[0].clientY, on: false, pull: 0 };
    }, { passive: true });
    sc.addEventListener('touchmove', e => {
      if (!g) return;
      const dy = e.touches[0].clientY - g.y, dx = e.touches[0].clientX - g.x;
      if (!g.on) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        if (dy < 8 || Math.abs(dx) > dy || sc.scrollTop > 0 || !e.cancelable) { g = null; return; }   // a scroll, or the shelf
        g.on = true;
        dog.firstChild.src = $('dog').src;
      }
      e.preventDefault();
      g.pull = Math.min(MAX, Math.max(0, dy - 8) * .5);           // the content gives, at half the finger's pace
      set(g.pull);
    }, { passive: false });
    const end = e => {
      const d = g; g = null;
      if (!d || !d.on) return;
      if (e.type !== 'touchend' || d.pull < ARM) return set(0, 260);
      busy = true;
      set(HOLD, 200);
      // long enough to see it happen, however quick the network is
      Promise.all([refresh().catch(err => console.warn('Refresh failed:', err)), new Promise(r => setTimeout(r, 700))])
        .then(() => { busy = false; set(0, 380); });
    };
    sc.addEventListener('touchend', end);
    sc.addEventListener('touchcancel', end);
  });
}

/** Fetch the content and the posts again and redraw the tabs' first screens. */
async function refresh() {
  const text = await (await liveFetch('content.json', 'content.json')).text();
  data = JSON.parse(text);
  keepContent(text);
  projectCache.clear();
  render();
  try { posts = await loadFeed(data); } catch (e) { console.warn('Feed failed to load:', e); }
  renderShelf();
  if (drawn.work) renderWork();
}

/* ── Screens ───────────────────────────────────────── */

const SKELETON = '<div class="skel" style="width:92%"></div><div class="skel" style="width:78%"></div><div class="skel media"></div><div class="skel" style="width:85%"></div><div class="skel" style="width:60%"></div>';

function buildScreen(view) {
  const filters = data.filters || DEFAULT_FILTERS;
  if (view.legal) return legalScreen($('legal-card'));
  if (view.resume) return pdfScreen(media(data.contact.resume));
  const el = screenFrame('item');
  const body = el.querySelector('.scroll'), title = el.querySelector('.bar-title');

  if (view.project) {
    const card = projects.find(p => p.id === view.project) || { id: view.project };
    el.item = { kind: 'project', id: view.project };
    title.textContent = card.title || '';
    // The header draws at once from the card; the rest arrives in its place
    body.innerHTML = projectHero(card, filters) + SKELETON;
    loadProject(view.project).then(project => {
      if (!el.isConnected) return;
      body.innerHTML = project
        ? projectHero(project, filters) + renderDisplayBlocks(normalizeBlocks(project.blocks || []), { scope: 'proj-' + project.id, projectId: project.id })
        : projectHero(card, filters) + '<p class="note">Unable to load this project right now.</p>';
      if (project) { title.textContent = project.title || title.textContent; el.ready = true; }
      initCountUps();
      sync();
    });
  } else {
    const post = posts.find(p => p.id === view.post);
    el.item = { kind: 'post', id: view.post };
    title.textContent = post ? postTitle(post) : '';
    body.innerHTML = post ? postHeroHTML(post, filters) + postBodyHTML(post) : '<p class="note" style="padding-top:calc(var(--top) + var(--bar-h) + 1.5rem)">This post is no longer available.</p>';
    el.ready = !!post;
    if (!post) el.classList.replace('item', 'plain');
  }
  return el;
}

/** Home's shelf: the newest few, side by side. */
function renderShelf() {
  const items = workItems().slice(0, 6);
  $('shelf').hidden = !items.length;
  $('shelf-row').innerHTML = items.map(x => x.html).join('');
  initSensitiveTapes(projects);
  // The Work grid shows the same cards; ids must stay unique, and the grid's are the ones looked up
  $('shelf-row').querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
}

function renderAbout() {
  drawn.about = true;
  $('about-body').innerHTML = renderDisplayBlocks(normalizeBlocks(data.about || []), { scope: 'about' });
  initCountUps();
}

/** Work's filter row and grid; filtering and sorting re-render just these. */
function renderWork() {
  drawn.work = true;
  const filters = data.filters || DEFAULT_FILTERS;
  let items = workItems();
  const activeTypes = new Set(items.flatMap(x => x.types));
  if (workFilter !== 'all' && !activeTypes.has(workFilter)) workFilter = 'all';

  renderFilterRow($('work-filters'), {
    filters: filters.filter(f => activeTypes.has(f.value)),
    active: workFilter,
    sorts: [['newest', 'Newest'], ['likes', 'Most liked']],
    sort: workSort,
    showSort: posts.length > 0,
    scroller: $('work-scroll')
  });

  if (workSort === 'likes') items = items.map((x, i) => [x, i])
    .sort((a, b) => (likeCounts.get(b[0].key) || 0) - (likeCounts.get(a[0].key) || 0) || a[1] - b[1])
    .map(([x]) => x);
  if (workFilter !== 'all') items = items.filter(x => x.types.includes(workFilter));

  const grid = $('work-grid');
  grid.innerHTML = items.map(x => x.html).join('');
  markCardLikes([...grid.children], items.map(x => x.key), likeCounts, workSort === 'likes');
  initSensitiveTapes(projects);
}

/** Same order as the desktop's "Newest": by day, a project ahead of a post on
    the same day, and same-day projects keep their hand-set order. */
function workItems() {
  const filters = data.filters || DEFAULT_FILTERS;
  const projectDate = p => p.date || (p.year || '0') + '-12-31';
  return [
    ...projects.map((p, i) => ({ key: p.id, types: projectTypes(p), date: projectDate(p), project: true, i, html: renderWorkGrid([p], data.theme) })),
    ...posts.map(p => ({ key: likeKey(p.id), types: p.filters, date: p.date, project: false, i: 0, html: postCardHTML(p, filters, { uniform: true }) }))
  ].sort((a, b) =>
    b.date.slice(0, 10).localeCompare(a.date.slice(0, 10))
    || (b.project ? 1 : 0) - (a.project ? 1 : 0)
    || (a.project ? a.i - b.i : new Date(b.date) - new Date(a.date))
  );
}

async function loadProject(id) {
  if (projectCache.has(id)) return projectCache.get(id);
  try {
    const res = await liveFetch('projects/' + id + '.json', 'projects/' + encodeURIComponent(id) + '.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const project = await res.json();
    projectCache.set(id, project);
    return project;
  } catch (e) {
    console.warn('Could not load project ' + id, e);
    return null;
  }
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bgImage = url => url ? ` style="background-image:url('${String(url).replace(/'/g, '%27')}')"` : '';

// Like and Share, as in the desktop project header
const heroActions = `<div class="pp-hero-actions">
      <button class="pp-hero-btn pp-like-btn" id="pp-like-btn" onclick="window.display?.toggleLike?.()" title="Like" aria-label="Like" aria-pressed="false"><i id="pp-like-icon" class="ph-fill ph-heart" aria-hidden="true"></i> <span id="pp-like-count">—</span></button>
      <button class="pp-hero-btn" id="pp-share" onclick="window.display?.copyShareLink?.()" title="Copy share link" aria-live="polite"><i class="ph-fill ph-share-network" aria-hidden="true"></i> Share</button>
    </div>`;

function projectHero(p, filters) {
  const tags = [...projectTypeLabels(p, filters), p.year, p.client].filter(Boolean);
  return `<div class="pp-hero"${bgImage(p.heroImage || p.thumbnail)}>
    <div class="pp-hero-overlay"></div>
    ${heroActions}
    <div class="pp-hero-content"><div class="pp-hero-left">
      <h2 class="pp-hero-title">${esc(p.title || '').replace(/ /, '<br>')}</h2>
      <div class="pp-hero-meta">${tags.map(t => `<span class="pp-hero-tag">${esc(t)}</span>`).join('')}</div>
    </div></div>
  </div>`;
}

function postHeroHTML(post, filters) {
  const s = SOURCES[post.source] || { label: post.source };
  const img = postHero(post)?.url || data.postBanner || '';
  const tags = [s.label, ...post.filters.map(v => filters.find(f => f.value === v)?.label || v), fmtDate(post.date)];
  return `<div class="pp-hero${img ? '' : ' pp-hero-plain'}"${bgImage(img)}>
    <div class="pp-hero-overlay"></div>
    ${heroActions}
    <div class="pp-hero-content"><div class="pp-hero-left">
      <h2 class="pp-hero-title">${esc(postTitle(post))}</h2>
      <div class="pp-hero-meta">${tags.map(t => `<span class="pp-hero-tag">${esc(t)}</span>`).join('')}</div>
    </div></div>
  </div>`;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
