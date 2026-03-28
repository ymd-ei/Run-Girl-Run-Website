/**
 * Media Library Manager
 * Handles media file browsing and insertion
 */

import { getToken } from '../../v2_utils/v2_api.js';

const REPO = 'ymd/Run-Girl-Run-Website';
const BRANCH = 'main';

let mediaLibraryState = {
  files: [],
  callback: null,
  pathInputId: null,
  isOpen: false
};

/**
 * Open the media library modal
 * @param {Function} onInsert - Callback when user selects a media file (path) => void
 * @param {string} [pathInputId] - Optional input element ID to auto-fill
 */
export async function openMediaLibrary(onInsert, pathInputId) {
  mediaLibraryState.callback = onInsert;
  mediaLibraryState.pathInputId = pathInputId || null;
  mediaLibraryState.isOpen = true;

  const modal = document.getElementById('media-modal');
  if (modal) modal.classList.add('open');

  // Clear search
  const searchInput = document.getElementById('media-search');
  if (searchInput) {
    const input = searchInput.querySelector('input');
    if (input) input.value = '';
  }

  const grid = document.getElementById('media-grid');
  if (!grid) return;

  grid.innerHTML = '<div id="media-empty">Loading…</div>';

  const token = getToken();
  if (!token) {
    grid.innerHTML = '<div id="media-empty">GitHub token required to browse media.</div>';
    return;
  }

  try {
    mediaLibraryState.files = await fetchMediaFiles(token, 'media');
    renderMediaGrid(mediaLibraryState.files);
  } catch (e) {
    grid.innerHTML = `<div id="media-empty">Error: ${e.message}</div>`;
  }
}

/**
 * Close the media library modal
 */
export function closeMediaLibrary() {
  const modal = document.getElementById('media-modal');
  if (modal) modal.classList.remove('open');
  mediaLibraryState.isOpen = false;
  mediaLibraryState.callback = null;
}

/**
 * Fetch media files from GitHub recursively
 * @param {string} token - GitHub token
 * @param {string} path - Folder path to list
 * @returns {Promise<Array>} Array of file objects {name, path, url}
 */
export async function fetchMediaFiles(token, path) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: 'token ' + token,
        Accept: 'application/vnd.github.v3+json'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Could not load media folder');
  }

  const items = await response.json();
  const files = [];

  for (const item of items) {
    // Include files: images and videos
    if (item.type === 'file' && /\.(jpe?g|png|gif|webp|bmp|svg|mp4|webm|mov)$/i.test(item.name)) {
      files.push({
        name: item.name,
        path: item.path,
        url: item.download_url
      });
    } else if (item.type === 'dir') {
      // Recurse into subdirectories (one level deep)
      try {
        const subFiles = await fetchMediaFiles(token, item.path);
        files.push(...subFiles);
      } catch (e) {
        // Silently skip folders we can't access
      }
    }
  }

  return files;
}

/**
 * Render media grid in the modal
 * @param {Array} files - Media files to display
 */
export function renderMediaGrid(files) {
  const grid = document.getElementById('media-grid');
  if (!grid) return;

  if (!files || files.length === 0) {
    grid.innerHTML = '<div id="media-empty">No media files found.</div>';
    return;
  }

  const imageExts = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

  grid.innerHTML = files
    .map(f => {
      const isImage = imageExts.test(f.name);
      const ext = f.name.split('.').pop().toUpperCase();

      return `
        <div class="media-item" onclick="window.v2Events?.onMediaSelect?.('${f.path}')">
          <div class="media-thumb">
            ${isImage ? `<img src="${f.url}" loading="lazy" alt="${f.name}">` : `<span class="media-ext">${ext}</span>`}
          </div>
          <div class="media-name" title="${f.path}">${f.name}</div>
        </div>`;
    })
    .join('');
}

/**
 * Filter and re-render media grid
 * @param {string} query - Search query string
 */
export function filterMedia(query) {
  const q = query.toLowerCase();
  const filtered = q
    ? mediaLibraryState.files.filter(f => f.path.toLowerCase().includes(q))
    : mediaLibraryState.files;
  renderMediaGrid(filtered);
}

/**
 * Handle media file selection
 * @param {string} path - Path of the selected media file
 * @param {Object} uiState - UI state (for marking dirty files)
 * @param {string} currentPage - Current page name
 * @param {string} currentProjectId - Current project ID
 */
export function handleMediaSelect(path, uiState, currentPage, currentProjectId) {
  // Call the original callback
  if (mediaLibraryState.callback) {
    mediaLibraryState.callback(path);
  }

  // Update path input if provided
  if (mediaLibraryState.pathInputId) {
    const input = document.getElementById(mediaLibraryState.pathInputId);
    if (input) {
      input.value = path;
      input.dispatchEvent(new Event('input'));
    }
  }

  // Mark files as dirty
  if (uiState && uiState.dirtyFiles) {
    if (currentPage === 'about') {
      uiState.dirtyFiles.add('content.json');
    } else if (currentPage === 'project' && currentProjectId) {
      uiState.dirtyFiles.add('projects/' + currentProjectId + '.json');
    }
  }

  closeMediaLibrary();
}

/**
 * Get the media library state (for testing/debugging)
 * @returns {Object} Current state
 */
export function getMediaLibraryState() {
  return { ...mediaLibraryState };
}

/**
 * Initialize media library event listeners
 * @param {Function} onSearch - Called when search input changes (query) => void
 */
export function initializeMediaLibrary(onSearch) {
  const searchContainer = document.getElementById('media-search');
  if (!searchContainer) return;

  const input = searchContainer.querySelector('input');
  if (input) {
    input.addEventListener('input', e => {
      if (onSearch) {
        onSearch(e.target.value);
      } else {
        filterMedia(e.target.value);
      }
    });
  }

  // Close on backdrop click
  const modal = document.getElementById('media-modal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        closeMediaLibrary();
      }
    });
  }
}
