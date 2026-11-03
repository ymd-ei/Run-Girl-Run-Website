// Colours from Site settings → Theme for the working tools (/tools, /grid, /textures), same as
// the other pages. Opened as a loose file this just fails quietly and the page keeps its starting colours.
import { liveFetch } from './liveContent.js';
import { applyThemeVars } from './themeVars.js';

// the accent buttons' text: whichever reads on the accent colour
const onAccent = hex => {
  const v = parseInt(String(hex).replace('#', ''), 16);
  return 0.299 * (v >> 16) + 0.587 * (v >> 8 & 255) + 0.114 * (v & 255) > 165 ? '#1a1714' : '#fff';
};

liveFetch('content.json', new URL('../../content.json', import.meta.url).href).then(r => r.json()).then(({ theme }) => {
  applyThemeVars(theme);
  if (theme?.accent) document.documentElement.style.setProperty('--on-accent', onAccent(theme.accent));
  window.dispatchEvent(new Event('resize'));   // canvases redraw in the new colours
}).catch(() => {});
