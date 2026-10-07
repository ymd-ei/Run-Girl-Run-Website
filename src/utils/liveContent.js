// liveContent.js — load the site's content files (content.json, project JSON,
// modelling/content.json) as fresh as possible.
//
// When the editor saves, the backend keeps a copy of those files for 15 minutes
// (backend/worker.js → /api/live) so changes show within seconds instead of
// waiting for GitHub Pages to publish. This asks the backend and the page's own
// copy at the same time: the backend's copy wins if it has one; otherwise (no
// recent save, slow, down, or over its free daily limit) the page's own copy is
// used. The page never waits on the backend for more than LIVE_WAIT_MS.
//
// Used by every page that loads content — the desktop and phone pages, the
// modelling site and /reel/ — so they all update the same way.

const API = (window.RGR_CONFIG && window.RGR_CONFIG.apiBase) || 'https://rgr-editor-backend.rungirlrun.workers.dev';
const LIVE_WAIT_MS = 800;

/**
 * Fetch a content file. `repoPath` is its path in the repo ("content.json",
 * "projects/<id>.json", "modelling/content.json"); `pageUrl` is how this page
 * reaches its own copy ("content.json", "../content.json", …). Resolves a
 * Response, like fetch().
 */
export async function liveFetch(repoPath, pageUrl) {
  // Revalidate the page's own copy (Pages lets browsers keep files 10 minutes)
  const own = fetch(pageUrl, { cache: 'no-cache' });
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), LIVE_WAIT_MS);
    const res = await fetch(`${API}/api/live?path=${encodeURIComponent(repoPath)}`, { signal: ctl.signal });
    clearTimeout(timer);
    if (res.status === 200) {
      own.catch(() => {});                 // not needed
      return res;
    }
  } catch (e) { /* slow or unreachable: use the page's copy */ }
  return own;
}

/**
 * After a save, follow one saved file until it's out: onStatus('live') once
 * visitors get it (the backend's copy matches what was saved), then
 * onStatus('published') once GitHub Pages serves it too — or onStatus('slow')
 * if Pages takes longer than ~5 minutes. Compares the actual text, so it never
 * reports an older build as done. Returns a function that stops watching.
 */
export function watchPublish(repoPath, pageUrl, savedText, onStatus) {
  let stopped = false, live = false, tries = 0;
  const sep = pageUrl.includes('?') ? '&' : '?';
  const check = async () => {
    if (stopped) return;
    tries++;
    try {
      if (!live) {
        const r = await fetch(`${API}/api/live?path=${encodeURIComponent(repoPath)}`, { cache: 'no-store' });
        if (r.status === 200 && (await r.text()) === savedText) { live = true; onStatus('live'); }
      }
      const p = await fetch(`${pageUrl}${sep}published=${Date.now()}`, { cache: 'no-store' });
      if (p.ok && (await p.text()) === savedText) {
        if (!live) onStatus('live');
        onStatus('published');
        return;
      }
    } catch (e) { /* network blip: keep trying */ }
    if (tries >= 60) { onStatus('slow'); return; }       // 60 × 5 s
    setTimeout(check, 5000);
  };
  onStatus('saving');
  check();
  return () => { stopped = true; };
}
