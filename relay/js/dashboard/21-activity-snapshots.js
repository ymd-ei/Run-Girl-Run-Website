// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------
async function loadActivityLog() {
    if (!dashboardData) return;
    const container = document.getElementById('activityLogBody');
    if (!container) return;
    container.innerHTML = '<span style="color:var(--text-muted);font-size:0.65rem;">Loading…</span>';
    try {
        const res = await api('/api/activity_log?path=' + encodeURIComponent(dashboardData.root_path));
        const entries = (res.entries || []).slice().reverse(); // newest first
        if (!entries.length) {
            container.innerHTML = '<span style="color:var(--text-muted);font-size:0.65rem;">No activity recorded yet.</span>';
            return;
        }
        const fieldLabels = {
            status: 'Status', difficulty: 'Difficulty', assignee: 'Assignee',
            due_date: 'Due Date', notes: 'Notes', completion: 'Progress',
            project_complete: 'Project Complete', description: 'Description',
            playlist_create: 'Playlist Created', playlist_delete: 'Playlist Deleted',
            snapshot_restore: 'Snapshot Restored',
        };
        const rows = entries.slice(0, 200).map(e => {
            const asset = e.asset === '_project' ? '<span style="color:#a855f7;">project</span>' : `<span style="color:var(--accent);">${esc(e.asset)}</span>`;
            const field = fieldLabels[e.field] || e.field;
            let change = '';
            if (e.field === 'playlist_create')   change = `created <b>${esc(String(e.after||''))}</b>`;
            else if (e.field === 'playlist_delete') change = `deleted <b>${esc(String(e.before||''))}</b>`;
            else if (e.field === 'snapshot_restore') change = `restored <b>${esc(String(e.after||''))}</b>`;
            else if (e.field === 'completion')    change = `${e.before ?? '?'}% → <b>${e.after ?? '?'}%</b>`;
            else if (e.field === 'notes')         change = `notes updated`;
            else if (e.field === 'description')   change = `description updated`;
            else change = `${esc(String(e.before ?? '—'))} → <b>${esc(String(e.after ?? '—'))}</b>`;
            const ts = e.ts ? e.ts.slice(0, 16) : '';
            return `<div style="padding:3px 0;border-bottom:1px solid var(--border);display:flex;gap:0.5rem;align-items:baseline;flex-wrap:wrap;">
                <span style="color:var(--text-muted);font-size:0.6rem;flex-shrink:0;min-width:110px;">${esc(ts)}</span>
                <span style="font-size:0.65rem;">${asset} · <span style="color:var(--text-muted);">${esc(field)}</span> · ${change}</span>
            </div>`;
        }).join('');
        container.innerHTML = rows;
    } catch (err) {
        container.innerHTML = '<span style="color:#ef4444;font-size:0.65rem;">Failed to load log.</span>';
    }
}

// ---------------------------------------------------------------------------
// Snapshots / Checkpoints
// ---------------------------------------------------------------------------
async function saveCheckpoint() {
    if (!dashboardData) { showToast('No project loaded'); return; }
    const btn = document.querySelector('[onclick="saveCheckpoint()"]');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
    try {
        const res = await api('/api/snapshot/save', { root_path: dashboardData.root_path, label: 'manual' });
        if (res.ok) {
            showToast('Checkpoint saved');
            loadSnapshotList();
        } else {
            showToast('Error: ' + (res.error || 'Save failed'));
        }
    } catch (e) {
        showToast('Error saving checkpoint');
    } finally {
        if (btn) { btn.textContent = '💾 Save Checkpoint'; btn.disabled = false; }
    }
}

async function loadSnapshotList() {
    if (!dashboardData) return;
    const container = document.getElementById('snapshotList');
    if (!container) return;
    container.innerHTML = '<span style="font-size:0.68rem;color:var(--text-muted);font-family:var(--mono);">Loading…</span>';
    try {
        const res = await api('/api/snapshot/list?path=' + encodeURIComponent(dashboardData.root_path));
        const snaps = res.snapshots || [];
        if (!snaps.length) {
            container.innerHTML = '<span style="font-size:0.68rem;color:var(--text-muted);font-family:var(--mono);">No checkpoints yet.</span>';
            return;
        }
        const labelColors = { manual:'#6366f1', daily:'#888', project_complete:'#ffd700' };
        container.innerHTML = snaps.map((s, i) => {
            const lc = labelColors[s.label] || '#888';
            const isComplete = s.is_complete;
            const badge = `<span style="font-size:0.58rem;padding:1px 6px;border-radius:3px;background:${lc}22;color:${lc};border:1px solid ${lc}44;font-family:var(--mono);">${esc(s.label || 'manual')}${isComplete ? ' ★' : ''}</span>`;
            return `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border);">
                ${badge}
                <span style="font-family:var(--mono);font-size:0.65rem;color:var(--text-muted);flex:1;">${esc(s.created || '')}</span>
                <span style="font-family:var(--mono);font-size:0.62rem;color:var(--text-muted);">${s.asset_count} assets</span>
                <button class="btn-sm" onclick="restoreSnapshot(${JSON.stringify(s.filename)})" style="font-size:0.58rem;padding:2px 7px;border-color:#22c55e40;color:#22c55e;">Restore</button>
                ${!isComplete ? `<button class="btn-sm" onclick="deleteSnapshot(${JSON.stringify(s.filename)})" style="font-size:0.58rem;padding:2px 7px;border-color:#ef444440;color:#ef4444;">✕</button>` : ''}
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = '<span style="font-size:0.68rem;color:#ef4444;font-family:var(--mono);">Failed to load checkpoints.</span>';
    }
}

async function restoreSnapshot(filename) {
    if (!dashboardData) return;
    if (!confirm(`Restore this checkpoint?\n\nThis will overwrite asset data with the saved snapshot. Comments and playlists are not affected.`)) return;
    try {
        const res = await api('/api/snapshot/restore', { root_path: dashboardData.root_path, filename });
        if (res.ok) {
            showToast('Snapshot restored — reloading…');
            setTimeout(async () => {
                dashboardData = await api('/api/scan?path=' + encodeURIComponent(dashboardData.root_path) + '&force=1');
                renderAll(true);
            }, 600);
        } else {
            showToast('Error: ' + (res.error || 'Restore failed'));
        }
    } catch (e) {
        showToast('Error restoring snapshot');
    }
}

async function deleteSnapshot(filename) {
    if (!dashboardData) return;
    if (!confirm('Delete this checkpoint? This cannot be undone.')) return;
    try {
        const res = await api('/api/snapshot/delete', { root_path: dashboardData.root_path, filename });
        if (res.ok) { showToast('Checkpoint deleted'); loadSnapshotList(); }
        else showToast('Error: ' + (res.error || 'Delete failed'));
    } catch (e) {
        showToast('Error deleting checkpoint');
    }
}

// ---------------------------------------------------------------------------
