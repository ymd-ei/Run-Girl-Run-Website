// ---------------------------------------------------------------------------
// v4: button consolidation. Complete leaves the project header and lives in
// Project Settings → Files & media, behind a confirmation (it clears playblasts from the cloud).
// ---------------------------------------------------------------------------

function v4AskComplete() {
    let m = document.getElementById('v4ConfirmComplete');
    if (!m) {
        m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'v4ConfirmComplete';
        m.onclick = e => { if (e.target === m) m.classList.remove('open'); };
        m.innerHTML = '<div class="modal" id="v4ConfirmBody"></div>';
        document.body.appendChild(m);
    }
    const name = dashboardData.root_path.split(/[/\\]/).pop();
    const done = dashboardData.project_complete;
    document.getElementById('v4ConfirmBody').innerHTML = done ? `
        <h2>Reopen ${esc(name)}?</h2>
        <p class="v4-muted" style="margin-bottom:1.25rem;">It goes back to active.</p>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
            <button class="btn-sm" onclick="document.getElementById('v4ConfirmComplete').classList.remove('open')">Cancel</button>
            <button class="btn-sm" style="border-color:var(--accent);color:var(--accent);" onclick="document.getElementById('v4ConfirmComplete').classList.remove('open');toggleProjectComplete()">Reopen project</button>
        </div>` : `
        <h2>Mark ${esc(name)} complete?</h2>
        <p class="v4-muted" style="margin-bottom:1.25rem;">Next you pick the final media.</p>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
            <button class="btn-sm" onclick="document.getElementById('v4ConfirmComplete').classList.remove('open')">Cancel</button>
            <button class="btn-sm" style="border-color:#ffd70066;color:#ffd700;" onclick="document.getElementById('v4ConfirmComplete').classList.remove('open');v4DoComplete()">&#9733; Mark complete</button>
        </div>`;
    m.classList.add('open');
}

// v3 bug fix: cancelling the final-media picker left the project half-complete
// (flagged complete in memory, never saved or shown). Cancel now leaves it active.
let _v4CompletePending = false;
function v4DoComplete() { _v4CompletePending = true; toggleProjectComplete(); }
const _v3FbCancel = window._fbCancel, _v3FbConfirm = window._fbConfirm;
window._fbCancel = function () {
    if (_v4CompletePending) {
        _v4CompletePending = false;
        dashboardData.project_complete = false; dashboardData.completed_date = '';
        showToast('Not marked complete. Pick the final media to finish.');
    }
    return _v3FbCancel.apply(this, arguments);
};
window._fbConfirm = function () { _v4CompletePending = false; return _v3FbConfirm.apply(this, arguments); };

// Menu wording: say which folder opens; the activity log now lives in Project Settings → Activity.
(function () {
    const menu = document.getElementById('projectOverflowMenu'); if (!menu) return;
    [...menu.querySelectorAll('.overflow-item')].forEach(it => {
        const oc = it.getAttribute('onclick') || '';
        if (oc.includes('openProjectFolder')) it.innerHTML = '&#128193; Open project folder';
    });
})();
