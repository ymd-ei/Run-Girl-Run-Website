/**
 * Color Utilities
 * Handles color conversions and theme defaults
 */

/**
 * Convert hex color to RGB string
 * @param {string} hex - Hex color (e.g., #ff0000)
 * @returns {string|null} RGB string (e.g., "255,0,0") or null if invalid
 */
export function hexToRGB(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
    : null;
}

/**
 * Theme color defaults
 */
export const THEME_DEFAULTS = {
  ink: '#1a1714',
  paper: '#f2ede4',
  accent: '#71904c',
  panelBg: '#f7f3ec',
  ctAccent: '#e03030',
  ctBg: '#080808',
  ctHi: '#ffffff',
  sensitiveColor: '#e03030'
};
