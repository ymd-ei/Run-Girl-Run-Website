function setCanvasButtons(enabled) {
  const onBtn = document.getElementById('canvas-mode-on');
  const offBtn = document.getElementById('canvas-mode-off');
  if (!onBtn || !offBtn) return;

  onBtn.classList.toggle('active', !!enabled);
  offBtn.classList.toggle('active', !enabled);
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

  if (onBtn) {
    onBtn.addEventListener('click', () => applyCanvasMode(true));
  }
  if (offBtn) {
    offBtn.addEventListener('click', () => applyCanvasMode(false));
  }

  setCanvasButtons(true);
}

function initEditorV2() {
  wireModeButtons();
  waitForLegacyEditorReady();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditorV2, { once: true });
} else {
  initEditorV2();
}
