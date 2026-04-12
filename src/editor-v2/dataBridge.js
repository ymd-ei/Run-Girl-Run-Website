/**
 * Data Bridge — v2 Editor
 * Loads content.json + project JSONs into editor state
 */

export const state = {
  global: {},
  projects: [],
  projectCache: new Map()
};

/**
 * Load all site data from content.json and project files
 */
export async function loadSiteData() {
  const res = await fetch('content.json');
  if (!res.ok) throw new Error('Failed to load content.json');
  const data = await res.json();

  state.global = data;
  state.projectCache.clear();

  // Load project cards (lightweight metadata)
  const projectIds = data.projects || [];
  const cards = Array.isArray(data.projectCards) ? data.projectCards : [];

  if (cards.length) {
    const cardById = new Map(cards.map(c => [c.id, c]));
    state.projects = projectIds.map(id => cardById.get(id)).filter(Boolean);
  } else {
    // Fallback: load full project JSONs
    const loaded = await Promise.all(
      projectIds.map(id =>
        fetch('projects/' + id + '.json')
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );
    state.projects = loaded.filter(Boolean);
  }

  state.projects.forEach(p => {
    if (p && p.id) state.projectCache.set(p.id, p);
  });

  return state;
}

/**
 * Load full project data (blocks) by ID
 */
export async function loadProject(id) {
  const cached = state.projectCache.get(id);
  if (cached && Array.isArray(cached.blocks)) return cached;

  const res = await fetch('projects/' + id + '.json');
  if (!res.ok) return null;
  const full = await res.json();

  state.projectCache.set(id, full);

  const idx = state.projects.findIndex(p => p.id === id);
  if (idx >= 0) state.projects[idx] = full;

  return full;
}
