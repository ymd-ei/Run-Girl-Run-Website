// The CSS variables a theme sets on the live pages (desktop, phone, links page).
// Applied from content.json when the page loads, so a colour saved in the editor
// shows within seconds (live content) — the stylesheets' own values are just the
// starting point. The *-rgb versions feed the see-through shades (rgba(var(--ink-rgb), …)).
const rgb = hex => {
  const h = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
};

export function themeVars(theme = {}) {
  const t = theme || {};
  const v = {
    '--ink': t.ink, '--ink-rgb': rgb(t.ink),
    '--paper': t.paper, '--paper-rgb': rgb(t.paper),
    '--accent': t.accent, '--accent-rgb': rgb(t.accent),
    '--panel-bg': t.panelBg,
    '--ct-accent': t.ctAccent, '--ct-accent-rgb': rgb(t.ctAccent),
    '--ct-bg': t.ctBg, '--ct-hi': t.ctHi,
    '--sensitive-color': t.sensitiveColor,
  };
  return Object.fromEntries(Object.entries(v).filter(([, val]) => val));
}

/** Set the theme's variables on the page (only the colours the theme has). */
export function applyThemeVars(theme, root = document.documentElement) {
  for (const [k, val] of Object.entries(themeVars(theme))) root.style.setProperty(k, val);
}
