/**
 * DOM Utility Helpers
 * Simplifies common DOM operations and event handling
 */

/**
 * Query selector wrapper
 * @param {string} selector - CSS selector
 * @param {Element} [parent] - Optional parent element
 * @returns {Element|null}
 */
export function query(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Query selector all wrapper
 * @param {string} selector - CSS selector
 * @param {Element} [parent] - Optional parent element
 * @returns {NodeList}
 */
export function queryAll(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * Attach event listener with auto-cleanup support
 * @param {Element} element - DOM element
 * @param {string} event - Event name (e.g., 'click')
 * @param {Function} handler - Event handler
 * @param {Object} [options] - addEventListener options
 */
export function on(element, event, handler, options = {}) {
  if (!element) return;
  element.addEventListener(event, handler, options);
}

/**
 * Remove event listener
 * @param {Element} element - DOM element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 */
export function off(element, event, handler) {
  if (!element) return;
  element.removeEventListener(event, handler);
}

/**
 * Event delegation: attach listener to parent, filter by selector
 * @param {Element} parent - Parent element
 * @param {string} selector - Child selector to match
 * @param {string} event - Event name
 * @param {Function} handler - Handler receives (event, matchedElement)
 */
export function delegate(parent, selector, event, handler) {
  on(parent, event, (e) => {
    const target = e.target.closest(selector);
    if (target) {
      handler(e, target);
    }
  });
}

/**
 * Add CSS class to element
 * @param {Element} element - DOM element
 * @param {string} className - Class name
 */
export function addClass(element, className) {
  if (element) element.classList.add(className);
}

/**
 * Remove CSS class from element
 * @param {Element} element - DOM element
 * @param {string} className - Class name
 */
export function removeClass(element, className) {
  if (element) element.classList.remove(className);
}

/**
 * Toggle CSS class
 * @param {Element} element - DOM element
 * @param {string} className - Class name
 * @param {boolean} [force] - Force state
 */
export function toggleClass(element, className, force) {
  if (element) element.classList.toggle(className, force);
}

/**
 * Check if element has class
 * @param {Element} element - DOM element
 * @param {string} className - Class name
 * @returns {boolean}
 */
export function hasClass(element, className) {
  return element ? element.classList.contains(className) : false;
}

/**
 * Set HTML content (use carefully to avoid XSS)
 * @param {Element} element - DOM element
 * @param {string} html - HTML string
 */
export function setHTML(element, html) {
  if (element) element.innerHTML = html;
}

/**
 * Set text content (safe)
 * @param {Element} element - DOM element
 * @param {string} text - Text string
 */
export function setText(element, text) {
  if (element) element.textContent = text;
}

/**
 * Get attribute value
 * @param {Element} element - DOM element
 * @param {string} attr - Attribute name
 * @returns {string|null}
 */
export function getAttribute(element, attr) {
  return element ? element.getAttribute(attr) : null;
}

/**
 * Set attribute value
 * @param {Element} element - DOM element
 * @param {string} attr - Attribute name
 * @param {string} value - Attribute value
 */
export function setAttribute(element, attr, value) {
  if (element) element.setAttribute(attr, value);
}

/**
 * Set multiple attributes
 * @param {Element} element - DOM element
 * @param {Object} attrs - Object of {attr: value}
 */
export function setAttributes(element, attrs) {
  if (!element) return;
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

/**
 * Get data attribute
 * @param {Element} element - DOM element
 * @param {string} key - Data key (without 'data-' prefix)
 * @returns {string|null}
 */
export function getData(element, key) {
  return element ? element.dataset[key] : null;
}

/**
 * Set data attribute
 * @param {Element} element - DOM element
 * @param {string} key - Data key (without 'data-' prefix)
 * @param {string} value - Data value
 */
export function setData(element, key, value) {
  if (element) element.dataset[key] = value;
}

/**
 * Get computed style value
 * @param {Element} element - DOM element
 * @param {string} prop - CSS property name
 * @returns {string}
 */
export function getStyle(element, prop) {
  return element ? window.getComputedStyle(element).getPropertyValue(prop) : "";
}

/**
 * Set style property
 * @param {Element} element - DOM element
 * @param {string} prop - CSS property name
 * @param {string} value - CSS value
 */
export function setStyle(element, prop, value) {
  if (element) element.style[prop] = value;
}

/**
 * Set multiple style properties
 * @param {Element} element - DOM element
 * @param {Object} styles - Object of {prop: value}
 */
export function setStyles(element, styles) {
  if (!element) return;
  Object.entries(styles).forEach(([prop, value]) => {
    element.style[prop] = value;
  });
}

/**
 * Create element
 * @param {string} tag - Tag name
 * @param {Object} [options] - {className, id, attrs, styles, html}
 * @returns {Element}
 */
export function createElement(tag, options = {}) {
  const el = document.createElement(tag);
  if (options.className) addClass(el, options.className);
  if (options.id) el.id = options.id;
  if (options.attrs) setAttributes(el, options.attrs);
  if (options.styles) setStyles(el, options.styles);
  if (options.html) setHTML(el, options.html);
  if (options.text) setText(el, options.text);
  return el;
}

/**
 * Append child element(s)
 * @param {Element} parent - Parent element
 * @param {...Element} children - Child elements
 */
export function append(parent, ...children) {
  if (parent) parent.append(...children);
}

/**
 * Insert before
 * @param {Element} referenceNode - Reference node
 * @param {Element} newNode - Node to insert
 */
export function insertBefore(referenceNode, newNode) {
  if (referenceNode && referenceNode.parentNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode);
  }
}

/**
 * Remove element
 * @param {Element} element - Element to remove
 */
export function remove(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * Check if element is visible (display !== 'none')
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
export function isVisible(element) {
  return element ? window.getComputedStyle(element).display !== "none" : false;
}

/**
 * Show element
 * @param {Element} element - DOM element
 */
export function show(element) {
  if (element) element.style.display = "";
}

/**
 * Hide element
 * @param {Element} element - DOM element
 */
export function hide(element) {
  if (element) element.style.display = "none";
}
