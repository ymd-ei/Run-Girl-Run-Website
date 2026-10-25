// Relay v4 client: connects the dashboard to the Relay worker.
// - Sign-in: owner setup (first run), invite and device links (#link=…), or a signed-out screen.
// - Every fetch('/api/…') the dashboard makes goes to the worker with the session token.
// - Things only a computer with the studio folder can do (browse, open files, app settings) go to the
//   desktop app's bridge (window.relayDesktop, from the Electron preload) when Relay runs inside the app.
// - <video>/<img> sources of /api/video?path=… become signed media URLs on the worker.
(function () {
    let devWorker = ''; try { devWorker = localStorage.getItem('relay_worker') || ''; } catch (e) {}   // development: point at a local worker
    const WORKER = (window.RELAY_WORKER || devWorker || 'https://rgr-relay.rungirlrun.workers.dev').replace(/\/$/, '');
    const desktop = window.relayDesktop || null;
    let tok = ''; try { tok = localStorage.getItem('relay_token') || ''; } catch (e) {}
    document.documentElement.classList.add(desktop ? 'relay-desktop' : 'relay-web');

    // ── who's signed in ──
    const relay = window.__relay = {
        worker: WORKER, desktop, me: null,
        viewer() { return relay.me || { name: '', studioRole: 'Member' }; },
        roleIn(path) {
            const m = relay.me; if (!m) return null;
            if (m.studioRole === 'Owner' || m.studioRole === 'Admin') return 'Lead';
            let d = null; try { d = dashboardData; } catch (e) {}   // the dashboard's global (a let, so not on window)
            const p = d && d.root_path === path && (d.people || []).find(x => x.id === m.id);
            return p ? p.role : (relay.roles[path] || null);
        },
        roles: {},
        mediaUrl(path) { return `${WORKER}/media?key=${encodeURIComponent(path)}&t=${encodeURIComponent(tok)}`; },
        async refreshMe() { const r = await realFetch(WORKER + '/api/me', { headers: authHeaders() }); if (r.ok) relay.me = await r.json(); return relay.me; },
        signOut: async () => { try { await realFetch(WORKER + '/auth/signout', { method: 'POST', headers: authHeaders() }); } catch (e) {} setToken(''); location.reload(); },
    };
    const authHeaders = () => ({ 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
    function setToken(t) { tok = t; try { t ? localStorage.setItem('relay_token', t) : localStorage.removeItem('relay_token'); } catch (e) {} if (desktop && desktop.setToken) desktop.setToken(t); }

    const realFetch = window.fetch.bind(window);
    const jsonRes = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    // Routes the web page can't do on its own
    const DESKTOP_ROUTES = ['get_config', 'set_studio_root', 'create_studio', 'set_startup', 'list_dir', 'open_file', 'shutdown', 'video_local'];
    const WEB_FALLBACK = {
        get_config: () => ({ studio_root: '', launch_on_startup: false, web: true }),
        list_dir: () => ({ error: 'Browsing the studio folder needs the Relay app on this computer.', entries: [] }),
        open_file: body => { openInApp(body.filepath); return { ok: true }; },
        shutdown: () => ({ ok: true }),
    };
    // On the web, Open hands the file to the Relay app through a relay:// link (the app opens it from the server).
    function openInApp(path) {
        if (!path) return;
        const a = document.createElement('a'); a.href = 'relay://open?path=' + encodeURIComponent(path); a.click();
        setTimeout(() => window.showToast && showToast('Opening in the Relay app… (needs Relay installed on this computer)'), 300);
    }
    // Review is out of this build: answer its calls with nothing so the dashboard carries on
    const REVIEW_ROUTES = { playlists: () => ({ playlists: [] }), playlist: () => ({ error: 'Review is not in this version.' }) };

    window.fetch = async function (url, opts) {
        const u = typeof url === 'string' ? url : (url && url.url) || String(url);
        if (!u.startsWith('/api/')) return realFetch(url, opts);
        const [p, qs] = u.slice(5).split('?');
        let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
        if (REVIEW_ROUTES[p]) return jsonRes(REVIEW_ROUTES[p]());
        if (DESKTOP_ROUTES.includes(p)) {
            if (desktop) return jsonRes(await desktop.call(p, body, Object.fromEntries(new URLSearchParams(qs || ''))));
            return jsonRes(WEB_FALLBACK[p] ? WEB_FALLBACK[p](body) : { error: 'This needs the Relay app on this computer.' });
        }
        const r = await realFetch(WORKER + u, { method: (opts && opts.method) || (opts && opts.body ? 'POST' : 'GET'), headers: authHeaders(), body: opts && opts.body });
        if (r.status === 401) { setToken(''); showSignin('Your sign-in ended. Sign in again to keep going.'); }
        if (p === 'create_project' && r.ok && desktop) { const j = await r.clone().json(); await desktop.call('create_project_folder', { path: j.path }); }
        return r;
    };

    // <video src="/api/video?path=…"> and images → the worker's media copy (or the local file inside the app)
    function rewrite(el) {
        const s = el.getAttribute('src');
        if (!s || !s.startsWith('/api/video?path=')) return;
        const path = decodeURIComponent(s.slice('/api/video?path='.length));
        el.setAttribute('src', desktop && desktop.localMediaUrl ? desktop.localMediaUrl(path) : relay.mediaUrl(path));
    }
    new MutationObserver(list => list.forEach(m => {
        if (m.type === 'attributes') rewrite(m.target);
        m.addedNodes && m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.matches('video,img,source')) rewrite(n); n.querySelectorAll && n.querySelectorAll('video,img,source').forEach(rewrite); });
    })).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });

    // ── sign-in screen ──
    let githubOn = false;
    function showSignin(message, mode) {
        let el = document.getElementById('relaySignin');
        if (!el) { el = document.createElement('div'); el.id = 'relaySignin'; el.className = 'relay-signin'; document.body.appendChild(el); }
        const setup = mode === 'setup';
        el.innerHTML = `<div class="setup-card relay-signin-card" role="dialog" aria-labelledby="relaySigninTitle">
            <h1 id="relaySigninTitle" style="margin-bottom:0.15rem;">Relay</h1>
            <p class="relay-signin-sub">by Run Girl Run Studio</p>
            ${setup ? `
              ${githubOn ? `<button class="btn-sm relay-signin-go" onclick="__relayGithub()">Sign in with GitHub</button><p class="relay-signin-msg relay-signin-small">Studio owner. Or set up with the code:</p>` : ''}
              <div class="field"><label for="rsCode">Setup code</label><input id="rsCode" autocomplete="off" spellcheck="false"></div>
              <div class="field"><label for="rsName">Your name</label><input id="rsName" autocomplete="name"></div>
              <div class="field"><label for="rsEmail">Email</label><input id="rsEmail" type="email" autocomplete="email"></div>
              <button class="btn-sm relay-signin-go" onclick="__relaySetup()">Set up the studio</button>` : `
              ${message ? `<p class="relay-signin-msg">${message}</p>` : ''}
              ${desktop ? `<div class="field"><label for="rsLink">Invite or sign-in link</label>
                <div style="display:flex;gap:0.4rem;"><input id="rsLink" style="flex:1;" spellcheck="false" placeholder="https://rungirlrun.studio/relay/#link=…" onkeydown="if(event.key==='Enter')__relayPasteLink()"><button class="btn-sm" onclick="__relayPasteLink()">Sign in</button></div></div>`
              : (message ? '' : `<p class="relay-signin-msg">Open the invite link you were sent. Already signed in on another device? Make a link there in Your settings.</p>`)}
              ${githubOn ? `<button class="relay-signin-owner" onclick="__relayGithub()">Studio owner? Sign in with GitHub</button>` : ''}`}
            <div class="relay-signin-err" id="rsErr" role="alert"></div></div>`;
        el.style.display = 'flex';
        if (setup) setTimeout(() => document.getElementById('rsCode').focus(), 50);
    }
    // In the app, GitHub opens in the browser and the app waits for the sign-in to finish (no link back needed)
    window.__relayGithub = async function () {
        if (!desktop) { location.href = `${WORKER}/auth/github/start?return=${encodeURIComponent(location.origin + location.pathname)}`; return; }
        const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
        desktop.openExternal(`${WORKER}/auth/github/start?return=${encodeURIComponent('poll:' + nonce)}`);
        const err = document.getElementById('rsErr'); if (err) { err.style.color = 'var(--text-muted)'; err.textContent = 'Finish signing in in your browser…'; }
        for (let i = 0; i < 150; i++) {   // up to 5 minutes
            await new Promise(r => setTimeout(r, 2000));
            const j = await realFetch(WORKER + '/auth/github/poll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nonce }) }).then(r => r.json()).catch(() => ({}));
            if (j.link) { await useLink(j.link); return; }
        }
        if (err) { err.style.color = ''; err.textContent = 'Sign-in timed out. Try again.'; }
    };
    // A sign-in link pasted into the app (from an invite, or "Sign in on another device")
    async function useLink(t) {
        const r = await realFetch(WORKER + '/auth/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t, label: navigator.userAgent.slice(0, 80) }) });
        const j = await r.json();
        if (!r.ok) { const err = document.getElementById('rsErr'); if (err) { err.style.color = ''; err.textContent = j.error || 'That link didn’t work.'; } return; }
        setToken(j.token); location.reload();
    }
    window.__relayPasteLink = () => { const v = (document.getElementById('rsLink').value.match(/link=([a-f0-9]+)/) || document.getElementById('rsLink').value.match(/^([a-f0-9]{20,})$/) || [])[1]; if (v) useLink(v); else document.getElementById('rsErr').textContent = 'Paste the whole sign-in link.'; };
    window.__relaySetup = async function () {
        const v = id => document.getElementById(id).value.trim();
        const r = await realFetch(WORKER + '/auth/setup', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ code: v('rsCode'), name: v('rsName'), email: v('rsEmail'), label: navigator.userAgent.slice(0, 80) }) });
        const j = await r.json();
        if (!r.ok) { document.getElementById('rsErr').textContent = j.error || 'Something went wrong.'; return; }
        setToken(j.token); location.reload();
    };

    // Runs before the dashboard modules: settle who's signed in, then let them load.
    relay.ready = (async () => {
        const link = (location.hash.match(/link=([a-f0-9]+)/) || [])[1];
        if (link) {
            history.replaceState(null, '', location.pathname + location.search);
            const r = await realFetch(WORKER + '/auth/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: link, label: navigator.userAgent.slice(0, 80) }) });
            const j = await r.json();
            if (r.ok) setToken(j.token); else { showSignin(j.error); return false; }
        }
        if (!tok && desktop && desktop.getToken) tok = (await desktop.getToken()) || '';
        if (tok && await relay.refreshMe()) { if (desktop && desktop.setToken) desktop.setToken(tok); return true; }
        setToken('');
        const st = await realFetch(WORKER + '/auth/status').then(r => r.json()).catch(() => ({}));
        githubOn = !!st.github;
        showSignin(st.setup_needed === undefined ? 'Can’t reach Relay right now. Check your connection.' : '', st.setup_needed ? 'setup' : '');
        return false;
    })();
})();
