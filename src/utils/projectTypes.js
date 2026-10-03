/**
 * Project filter membership.
 *
 * A project can sit under several filters via `types: [value, …]`. Older
 * content only has a single `type` (plus a copied `typeLabel`), so a missing
 * or empty `types` is read as `[type]`. Labels are looked up in the site's
 * `filters` at render time so renaming a filter updates every card.
 */

export const DEFAULT_FILTERS = [
  { value: '2d', label: '2D' },
  { value: '3d', label: '3D' },
  { value: 'motion', label: 'Motion' }
];

/** Filter values this project belongs to (never null). */
export function projectTypes(p) {
  if (!p) return [];
  const list = Array.isArray(p.types) ? p.types.filter(v => v != null && v !== '').map(String) : [];
  if (list.length) return [...new Set(list)];
  return p.type ? [String(p.type)] : [];
}

/** Label for one filter value; falls back to the stored typeLabel, then the value. */
export function filterLabel(value, filters, p) {
  const f = (filters || DEFAULT_FILTERS).find(f => f && String(f.value) === String(value));
  if (f && f.label) return f.label;
  if (p && p.typeLabel && String(p.type) === String(value)) return p.typeLabel;
  return String(value);
}

/** All labels for a project, in its `types` order. */
export function projectTypeLabels(p, filters) {
  return projectTypes(p).map(v => filterLabel(v, filters, p));
}

/** Labels joined for card meta, e.g. "Pipeline / 3D". */
export function projectTypeText(p, filters, sep = ' / ') {
  return projectTypeLabels(p, filters).join(sep);
}

/**
 * Write a new filter list onto a project, keeping the legacy single `type`
 * (first entry) and `typeLabel` in step for older readers.
 */
export function setProjectTypes(p, types, filters) {
  const list = [...new Set((types || []).filter(v => v != null && v !== '').map(String))];
  p.types = list;
  p.type = list[0] || '';
  p.typeLabel = list.length ? filterLabel(list[0], filters) : '';
  return p;
}

/** Normalise a hashtag: drop "#", lowercase, trim. */
export function normTag(t) {
  return String(t == null ? '' : t).trim().replace(/^#+/, '').toLowerCase();
}

/** A filter's extra hashtags (stored as an array; a comma string is accepted too). */
export function filterTags(f) {
  const raw = Array.isArray(f && f.tags) ? f.tags : String((f && f.tags) || '').split(/[\s,]+/);
  return [...new Set(raw.map(normTag).filter(Boolean))];
}

/**
 * Feed rule: a post goes on the site only with #rgr (or any #rgr-…). Filters
 * then come from #rgr-<value> and from each filter's own tags, e.g. 3D with
 * tags [3danimation, blender3d]. Returns null when the post stays off the site.
 */
export function classifyPostTags(tags, filters) {
  const all = (tags || []).map(normTag).filter(Boolean);
  if (!all.some(t => t === 'rgr' || t.startsWith('rgr-'))) return null;
  const out = (filters || []).filter(f => f && f.value != null && f.value !== '').filter(f => {
    const v = normTag(f.value);
    return all.includes('rgr-' + v) || filterTags(f).some(t => all.includes(t));
  }).map(f => String(f.value));
  return { filters: out };
}
