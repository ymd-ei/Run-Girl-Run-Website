// ---------------------------------------------------------------------------
// v4: v3's Library becomes "Sources": folders each person adds for themselves
// (the asset library, R&D, a reference stash...). Same tabs and table as v3.
// ---------------------------------------------------------------------------
(function () {
    const btn = document.querySelector('#topAppBar [onclick="openLibrary()"]');
    if (btn) { btn.innerHTML = '&#128193; Sources'; btn.title = 'Your sources: folders you add for yourself'; }
    const title = document.querySelector('#libraryModal .lib-header-title');
    if (title) title.innerHTML = '&#128193; Sources';

})();

window.renderLibEmpty = function () {
    document.getElementById('libBody').innerHTML = `<div class="lib-empty">
        Sources are folders you add for yourself, like the asset library, R&amp;D or a reference stash.<br>
        Only you see your list. Click the <strong>+</strong> tab above to add one.</div>`;
};

// Tab tooltip: say it's a personal list
const _v3RenderLibTabs = window.renderLibTabs;
window.renderLibTabs = function () {
    _v3RenderLibTabs.apply(this, arguments);
    const add = document.querySelector('#libTabs .lib-tab-add');
    if (add) add.title = 'Add a source (only you see your list)';
};
