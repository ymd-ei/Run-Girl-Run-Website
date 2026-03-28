/**
 * GitHub API & Token Management
 * Handles authentication and file operations with GitHub
 */

// Configuration (these should match your original setup)
const REPO = 'ymd_ei/Run-Girl-Run-Website'; // Update to your repo
const BRANCH = 'main'; // Update if using different branch

// Cache for SHAs to avoid conflicts on rapid saves
const shaCache = {};

/**
 * Get stored GitHub token from localStorage
 * @returns {string} GitHub token or empty string
 */
export function getToken() {
  return localStorage.getItem('gh_token') || '';
}

/**
 * Set GitHub token in localStorage
 * @param {string} token - GitHub personal access token
 */
export function setToken(token) {
  localStorage.setItem('gh_token', token);
}

/**
 * Clear stored GitHub token
 */
export function clearToken() {
  localStorage.removeItem('gh_token');
}

/**
 * Get SHA of a file from GitHub (for committing updates)
 * @param {string} token - GitHub token
 * @param {string} path - File path in repo
 * @returns {Promise<string|null>} SHA of file or null if not found
 */
export async function ghGetSha(token, path) {
  // Use cached SHA if available — avoids stale SHA on rapid saves
  if (shaCache[path]) return shaCache[path];

  const response = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: 'token ' + token,
        Accept: 'application/vnd.github.v3+json'
      }
    }
  );

  if (response.status === 404) return null;

  const data = await response.json();
  return data.sha || null;
}

/**
 * Put file to GitHub (create or update)
 * @param {string} token - GitHub token
 * @param {string} path - File path in repo
 * @param {string} content - File content (as string)
 * @param {string} sha - Current SHA (for update) or null for create
 * @param {string} message - Commit message
 * @returns {Promise<Object>} GitHub response
 * @throws {Error} If request fails
 */
export async function ghPutFile(token, path, content, sha, message) {
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: BRANCH
  };

  if (sha) body.sha = sha;

  const response = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: 'token ' + token,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || response.status);
  }

  const result = await response.json();

  // Cache the new SHA so rapid saves don't conflict
  if (result.content && result.content.sha) {
    shaCache[path] = result.content.sha;
  }

  return result;
}

/**
 * Save all files to GitHub
 * @param {Object} state - Global state object ({globalState, projects})
 * @param {Set} dirtyFiles - Set of file paths requiring save
 * @param {Function} onProgress - Callback(message) for progress updates
 * @returns {Promise<void>}
 * @throws {Error} If save fails
 */
export async function saveAllToGitHub(state, dirtyFiles, onProgress = () => {}) {
  let token = getToken();

  if (!token) {
    token = prompt('Enter your GitHub personal access token (stored locally in browser only):');
    if (!token) throw new Error('Token required to save');
    setToken(token);
  }

  // Build file list from dirtyFiles — fall back to all if somehow empty
  const toSave =
    dirtyFiles.size > 0
      ? [...dirtyFiles]
      : ['content.json', ...state.projects.map(p => `projects/${p.id}.json`)];

  // Build data map
  const dataMap = {
    'content.json': JSON.stringify(state.globalState, null, 2),
    ...Object.fromEntries(
      state.projects.map(p => [`projects/${p.id}.json`, JSON.stringify(p, null, 2)])
    )
  };

  // Save each file
  for (const path of toSave) {
    if (!dataMap[path]) continue;

    const sha = await ghGetSha(token, path);
    await ghPutFile(token, path, dataMap[path], sha, `Editor: update ${path}`);
    onProgress(`Saved ${path}`);
  }

  return {
    success: true,
    filesCount: toSave.length,
    files: toSave
  };
}
