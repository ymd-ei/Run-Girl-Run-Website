/**
 * {shortcut} references — resolve shortcuts against site content so a value
 * stored once in Site settings (e.g. contact.email) can be reused anywhere.
 *
 * Built-in: {name} {role} {location} {email} {resume} {year} {project:<id>}
 * Social links: each link's `ref` (or its slugified label), e.g. {instagram}.
 *
 * Inside the editors (?preview) shortcuts are left as-is, so inline edits save
 * the shortcut rather than the resolved value.
 */

let ctx = {
  global: {},
  projects: [],
  raw: new URLSearchParams(location.search).has('preview')
};

/** Point resolution at the current site data. Call whenever data changes. */
export function setRefContext(global, projects) {
  ctx.global = global || {};
  ctx.projects = projects || [];
}

export function getSiteGlobal() {
  return ctx.global;
}

/** Turn a link label into a shortcut code: "Bluesky" → "bluesky". */
export function slugRef(label) {
  return String(label || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const BUILTIN_REFS = ['name', 'role', 'location', 'email', 'resume', 'year'];

/**
 * All available shortcuts → { text, href? }.
 * Built-ins win over social links that happen to share a code.
 */
export function refValues(global = ctx.global) {
  const g = global || {};
  const c = g.contact || {};
  const builtins = {
    name: { text: g.name || '' },
    role: { text: g.role || '' },
    location: { text: g.location || '' },
    email: { text: c.email || '', href: c.email ? 'mailto:' + c.email : '' },
    resume: { text: (g.siteText && g.siteText.resumeLink) || 'Resume', href: c.resume || '' },
    year: { text: String(new Date().getFullYear()) }
  };

  // Social link URLs may themselves use built-ins (e.g. "mailto:{email}").
  const map = {};
  for (const link of c.links || []) {
    const key = link.ref || slugRef(link.label);
    if (!key) continue;
    map[key] = { text: link.label || key, href: substitute(link.url || '', g, 'url', builtins) };
  }
  return Object.assign(map, builtins);
}

const REF_PATTERN = /\{(project:[a-z0-9_-]+|[a-z0-9][a-z0-9_-]*)\}/gi;

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function projectRef(id, mode) {
  const p = (ctx.projects || []).find(x => x.id === id);
  if (!p) return null;
  const title = p.title || id;
  if (mode !== 'html' || p.published === false) return mode === 'url' ? `?project=${id}` : title;
  return `<a href="?project=${encodeURIComponent(id)}" class="ref-link">${escHtml(title)}</a>`;
}

// mode: 'html' → links become <a>; 'text' → plain words; 'url' → a whole-field
// shortcut gives its link target, embedded shortcuts give their text.
function substitute(str, global, mode, values) {
  if (typeof str !== 'string' || str.indexOf('{') === -1) return str;
  const vals = values || refValues(global);
  const whole = mode === 'url' && /^\{[^{}]+\}$/.test(str.trim());

  return str.replace(REF_PATTERN, (match, code) => {
    const key = code.toLowerCase();
    if (key.startsWith('project:')) {
      const out = projectRef(key.slice(8), mode);
      return out == null ? match : out;
    }
    const v = vals[key];
    if (!v) return match;
    if (mode === 'url') return whole ? (v.href || v.text) : v.text;
    if (mode === 'html' && v.href) {
      const external = /^https?:/i.test(v.href);
      return `<a href="${escHtml(v.href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${escHtml(v.text)}</a>`;
    }
    return mode === 'html' ? escHtml(v.text) : v.text;
  });
}

/** Resolve shortcuts in display text (HTML allowed). */
export function resolveRefs(str, mode = 'html') {
  if (ctx.raw) return str;
  return substitute(str, ctx.global, mode);
}

/** Resolve shortcuts inside a link URL, e.g. "mailto:{email}" or "{instagram}". */
export function resolveLinkUrl(url, globalState) {
  return substitute(String(url || ''), globalState || ctx.global, 'url');
}

const URL_KEY = /(src|url|href)$/i;
const ATTR_KEY = /alt$/i; // rendered inside an HTML attribute: plain words only

/** Copy of a block with every string field resolved (URL-ish keys in url mode). */
export function resolveBlockRefs(block) {
  if (ctx.raw || !block) return block;
  const vals = refValues(ctx.global);
  const modeFor = key => (URL_KEY.test(key) ? 'url' : ATTR_KEY.test(key) ? 'text' : 'html');
  const walk = (v, key) => {
    if (typeof v === 'string') return substitute(v, ctx.global, modeFor(key || ''), vals);
    if (Array.isArray(v)) return v.map(x => walk(x, key));
    if (v && typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v)) out[k] = walk(v[k], k);
      return out;
    }
    return v;
  };
  return walk(block, '');
}

/** Rows for the editor's References list. */
export function listRefs(global, projects) {
  const vals = refValues(global);
  const rows = BUILTIN_REFS.map(k => ({ code: `{${k}}`, value: vals[k].href && k !== 'email' ? vals[k].href : vals[k].text, group: 'Site' }));
  for (const link of (global && global.contact && global.contact.links) || []) {
    const key = link.ref || slugRef(link.label);
    if (!key) continue;
    const clash = BUILTIN_REFS.includes(key);
    rows.push({ code: `{${key}}`, value: clash ? 'Clashes with a built-in shortcut — rename it' : vals[key].href, group: 'Social links', warn: clash });
  }
  for (const p of projects || []) {
    rows.push({ code: `{project:${p.id}}`, value: (p.title || p.id) + (p.published === false ? ' (unpublished, shows as plain text)' : ''), group: 'Projects' });
  }
  return rows;
}
