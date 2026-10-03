// Shared editor login setup (main editor, v1 editor, modelling editor).
// Captures the session token from the GitHub sign-in redirect, removes it from
// the address bar, and resolves the backend URL. Needs site-config.js first.
(function () {
  const params = new URLSearchParams(location.search);
  const apiParam = params.get('api');
  const tokenParam = params.get('session_token');
  if (tokenParam) {
    localStorage.setItem('editor_session_token', tokenParam);
    params.delete('session_token');
    const next = `${location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    history.replaceState({}, '', next);
  }
  if (apiParam) localStorage.setItem('editor_api_base', apiParam);
  window.__V3_API_BASE = apiParam || localStorage.getItem('editor_api_base') || window.RGR_CONFIG.apiBase;
})();
