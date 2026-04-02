function setCanvasButtons(enabled) {
  const onBtn = document.getElementById('canvas-mode-on');
  const offBtn = document.getElementById('canvas-mode-off');
  if (!onBtn || !offBtn) return;

  onBtn.classList.toggle('active', !!enabled);
  offBtn.classList.toggle('active', !enabled);
}

function setFocusPreviewButton(enabled) {
  const label = document.getElementById('focus-preview-floating-label');
  const button = document.getElementById('focus-preview-floating');
  if (button) button.classList.toggle('active', !!enabled);
  if (label) label.textContent = enabled ? 'Show Panel' : 'Hide Panel';
}

function applyFocusPreview(enabled) {
  document.body.classList.toggle('v2-focus-preview', !!enabled);
  setFocusPreviewButton(enabled);

  try {
    sessionStorage.setItem('editor_v2_focus_preview', enabled ? '1' : '0');
  } catch (_) {
    // Ignore session storage failures in restricted contexts.
  }
}

function applyCanvasMode(enabled) {
  if (typeof window.setCanvasEditMode === 'function') {
    window.setCanvasEditMode(!!enabled);
  }
  setCanvasButtons(enabled);
}

window.__editorV2SetMode = applyCanvasMode;

function waitForLegacyEditorReady(attempts = 160) {
  if (typeof window.setCanvasEditMode === 'function') {
    applyCanvasMode(true);
    return;
  }

  if (attempts <= 0) {
    console.warn('Editor v2 could not attach canvas mode API');
    return;
  }

  setTimeout(() => waitForLegacyEditorReady(attempts - 1), 50);
}

function wireModeButtons() {
  const onBtn = document.getElementById('canvas-mode-on');
  const offBtn = document.getElementById('canvas-mode-off');
  const floatingFocusBtn = document.getElementById('focus-preview-floating');

  const toggleFocusPreview = () => {
    const next = !document.body.classList.contains('v2-focus-preview');
    applyFocusPreview(next);
  };

  if (onBtn) {
    onBtn.addEventListener('click', () => applyCanvasMode(true));
  }
  if (offBtn) {
    offBtn.addEventListener('click', () => applyCanvasMode(false));
  }
  if (floatingFocusBtn) {
    floatingFocusBtn.addEventListener('click', toggleFocusPreview);
  }

  setCanvasButtons(true);
  setFocusPreviewButton(document.body.classList.contains('v2-focus-preview'));
}

function initEditorV2() {
  const storedFocusMode = (() => {
    try {
      return sessionStorage.getItem('editor_v2_focus_preview') === '1';
    } catch (_) {
      return false;
    }
  })();

  if (storedFocusMode) {
    document.body.classList.add('v2-focus-preview');
  }

  wireModeButtons();
  waitForLegacyEditorReady();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditorV2, { once: true });
} else {
  initEditorV2();
}
