/**
 * Theme Manager
 * Handles theme colors and styling configuration
 */

import { THEME_DEFAULTS } from '../../v2_utils/v2_colors.js';

/**
 * Get or initialize theme object
 * @param {Object} state - Global state object
 * @returns {Object} Theme object
 */
export function getTheme(state) {
  if (!state.globalState.theme) {
    state.globalState.theme = { ...THEME_DEFAULTS };
  }
  return state.globalState.theme;
}

/**
 * Set a theme color
 * @param {Object} state - Global state object
 * @param {string} key - Color key (e.g., 'accent', 'paper', 'ink')
 * @param {string} value - Color value (hex or named)
 * @returns {boolean} True if set, false if invalid
 */
export function setThemeColor(state, key, value) {
  if (!value || typeof value !== 'string') return false;

  const theme = getTheme(state);
  theme[key] = value;
  return true;
}

/**
 * Get a specific theme color
 * @param {Object} state - Global state object
 * @param {string} key - Color key
 * @param {string} [defaultValue] - Default if not found
 * @returns {string} Color value
 */
export function getThemeColor(state, key, defaultValue = '') {
  const theme = getTheme(state);
  return theme[key] || defaultValue;
}

/**
 * Reset theme to defaults
 * @param {Object} state - Global state object
 */
export function resetTheme(state) {
  state.globalState.theme = { ...THEME_DEFAULTS };
}

/**
 * Get all theme colors as object
 * @param {Object} state - Global state object
 * @returns {Object} Theme object
 */
export function getFullTheme(state) {
  return getTheme(state);
}

/**
 * Apply theme colors to CSS variables (for display)
 * @param {Object} theme - Theme object
 * @returns {Object} CSS variables as {--var-name: value}
 */
export function generateCSSVariables(theme = {}) {
  const combined = { ...THEME_DEFAULTS, ...theme };

  return {
    '--color-accent': combined.accent || THEME_DEFAULTS.accent,
    '--color-paper': combined.paper || THEME_DEFAULTS.paper,
    '--color-ink': combined.ink || THEME_DEFAULTS.ink,
    '--color-panel-bg': combined.panelBg || THEME_DEFAULTS.panelBg,
    '--color-contact-accent': combined.ctAccent || THEME_DEFAULTS.ctAccent,
    '--color-contact-bg': combined.ctBg || THEME_DEFAULTS.ctBg,
    '--color-contact-hi': combined.ctHi || THEME_DEFAULTS.ctHi,
    '--color-sensitive': combined.sensitiveColor || THEME_DEFAULTS.sensitiveColor
  };
}

/**
 * Check if a color is valid hex
 * @param {string} color - Color string
 * @returns {boolean}
 */
export function isValidHexColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

/**
 * Get color name for display
 * @param {string} key - Theme key
 * @returns {string} Display name
 */
export function getColorDisplayName(key) {
  const names = {
    accent: 'Accent Color',
    paper: 'Background Color',
    ink: 'Text Color',
    panelBg: 'Panel Background',
    ctAccent: 'Contact Accent',
    ctBg: 'Contact Background',
    ctHi: 'Contact Highlight',
    sensitiveColor: 'Sensitive Color'
  };
  return names[key] || key;
}

/**
 * Get list of customizable color keys
 * @returns {Array} Color keys
 */
export function getCustomizableColors() {
  return [
    'accent',
    'paper',
    'ink',
    'panelBg',
    'ctAccent',
    'ctBg',
    'ctHi',
    'sensitiveColor'
  ];
}

/**
 * Validate theme object
 * @param {Object} theme - Theme to validate
 * @returns {{valid: boolean, errors: Array}} Validation result
 */
export function validateTheme(theme) {
  const errors = [];

  Object.entries(theme).forEach(([key, value]) => {
    if (!isValidHexColor(value)) {
      errors.push(`${key} is not a valid hex color: ${value}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Merge theme with defaults (fills in missing values)
 * @param {Object} theme - Partial theme object
 * @returns {Object} Complete theme with defaults
 */
export function mergeThemeWithDefaults(theme) {
  return {
    ...THEME_DEFAULTS,
    ...theme
  };
}
