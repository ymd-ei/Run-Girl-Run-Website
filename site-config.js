// Shared settings for the site and the editors. Change a value here and every
// page picks it up. Load this before any script that reads window.RGR_CONFIG.
window.RGR_CONFIG = {
  apiBase: 'https://rgr-editor-backend.rungirlrun.workers.dev', // Cloudflare Worker (editor saves + likes)
  repo: 'ymd-ei/Run-Girl-Run-Website' // GitHub repo the site deploys from
};
