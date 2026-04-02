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

  const floatingFocusBtn = document.getElementById('focus-preview-floating');
  if (floatingFocusBtn) {
    floatingFocusBtn.addEventListener('click', () => {
      const next = !document.body.classList.contains('v2-focus-preview');
      applyFocusPreview(next);
    });
  }

  setFocusPreviewButton(document.body.classList.contains('v2-focus-preview'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditorV2, { once: true });
} else {
  initEditorV2();
}
