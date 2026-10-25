// Relay loader: waits for sign-in (relay-client.js), then loads the dashboard modules in order.
(function loadDashboardModules() {
    var modules = [
        'js/dashboard/10-utils-shared.js',
        'js/dashboard/20-project-info.js',
        'js/dashboard/21-activity-snapshots.js',
        'js/dashboard/22-filebrowser-tabs.js',
        'js/dashboard/30-render-stats-filters.js',
        'js/dashboard/31-calendar-table.js',
        'js/dashboard/32-bulk-context-actions.js',
        'js/dashboard/40-settings-picker.js',
        'js/dashboard/50-library.js',
        'js/dashboard/60-v4-home.js',
        'js/dashboard/61-v4-assets.js',
        'js/dashboard/62-v4-people.js',
        'js/dashboard/63-v4-sources.js',
        'js/dashboard/64-v4-buttons.js',
        'js/dashboard/65-v4-project-settings.js',
        'js/dashboard/66-v4-calendar.js',
        'js/dashboard/67-v4-mine.js'
    ];

    function loadAt(index) {
        if (index >= modules.length) return;
        var s = document.createElement('script');
        s.src = modules[index];
        s.async = false;
        s.onload = function() { loadAt(index + 1); };
        document.head.appendChild(s);
    }

    (window.__relay ? window.__relay.ready : Promise.resolve(true)).then(function (signedIn) { if (signedIn) loadAt(0); });
})();
