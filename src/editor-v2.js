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

function waitForLegacyEditorReady(attempts = 80) {
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

window.addEventListener('DOMContentLoaded', () => {
  const onBtn = document.getElementById('canvas-mode-on');
  const offBtn = document.getElementById('canvas-mode-off');

  if (onBtn) {
    onBtn.addEventListener('click', () => applyCanvasMode(true));
  }
  if (offBtn) {
    offBtn.addEventListener('click', () => applyCanvasMode(false));
  }

  waitForLegacyEditorReady();
});
