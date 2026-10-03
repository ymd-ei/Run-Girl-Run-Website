/**
 * {shortcut} references — resolves shortcuts against site content so a value
 * stored once (e.g. contact.email) can be reused anywhere.
 */

/** Resolve shortcuts inside a link URL, e.g. "mailto:{email}". */
export function resolveLinkUrl(url, globalState) {
  const email = globalState?.contact?.email || '';
  return String(url || '').replace(/\{email\}/g, email);
}
