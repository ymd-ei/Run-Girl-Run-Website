/**
 * Privacy-friendly video embeds: YouTube via youtube-nocookie.com and Vimeo
 * with Do Not Track, plus an on-demand loader for the Vimeo player API (so the
 * Vimeo script only loads on pages that actually show a Vimeo video).
 */

export function privacyEmbedUrl(url) {
  let out = String(url || '');
  out = out.replace(/^(https?:)?\/\/(www\.)?youtube\.com\/embed\//i, 'https://www.youtube-nocookie.com/embed/');
  if (/player\.vimeo\.com\/video\//i.test(out) && !/[?&]dnt=/.test(out)) {
    out += (out.includes('?') ? '&' : '?') + 'dnt=1';
  }
  return out;
}

let vimeoApi = null;

/** Resolves to window.Vimeo (or null if the script can't load). */
export function loadVimeoApi() {
  if (window.Vimeo) return Promise.resolve(window.Vimeo);
  if (!vimeoApi) {
    vimeoApi = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://player.vimeo.com/api/player.js';
      s.onload = () => resolve(window.Vimeo || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }
  return vimeoApi;
}
