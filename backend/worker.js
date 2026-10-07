/**
 * Cloudflare Worker - Editor Auth & API Backend
 * 
 * Deploy to: https://dash.cloudflare.com
 * Environment variables needed:
 *   - GITHUB_CLIENT_ID: OAuth App Client ID
 *   - GITHUB_CLIENT_SECRET: OAuth App Client Secret
 *   - GITHUB_TOKEN: Personal Access Token (for commits)
 *   - FRONTEND_URL: Editor frontend URL (e.g., https://editor.youromain.com)
 *   - FRONTEND_HOST: Editor frontend hostname for CORS (e.g., rungirlrun.studio)
 *   - COOKIE_SECRET: Random string for signing sessions
 *   - IG_TOKEN (optional): Instagram access token for the social feed. Only the
 *     first one is read from here; the worker keeps renewed tokens in KV.
 * 
 * Setup GitHub OAuth App at: https://github.com/settings/developers
 * - Authorization callback URL: https://your-backend-url/auth/callback
 */

const GITHUB_OWNER = 'ymd-ei';
const GITHUB_REPO = 'Run-Girl-Run-Website';
const GITHUB_BRANCH = 'main';

// Encode each part of a repo path for GitHub's contents URLs. File names can
// hold spaces and other characters — macOS screenshots put a narrow no-break
// space before "AM" — which broke deletes ("Failed to fetch file for deletion").
const ghPath = p => String(p).split('/').map(encodeURIComponent).join('/');
const ALLOWED_GITHUB_USER = 'ymd-ei'; // Only allow YOUR username
const MAX_DIRECT_MEDIA_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Main request handler
 */
async function handleRequest(request, env) {
  try {
    return await handleRequestInner(request, env);
  } catch (err) {
    return corsResponse(new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }), request, env);
  }
}

async function handleRequestInner(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return corsResponse(new Response(''), request, env);
  }

  if (path === '/health') {
    return corsResponse(
      new Response(JSON.stringify({ ok: true, service: 'editor-backend' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }),
      request,
      env
    );
  }

  // Auth routes
  if (path === '/auth/login') {
    return handleLogin(request, env);
  }
  if (path === '/auth/callback') {
    return handleCallback(request, env);
  }
  if (path === '/auth/check') {
    return handleAuthCheck(request, env);
  }
  if (path === '/auth/logout') {
    return handleLogout(request, env);
  }

  // Protected API routes (require session)
  if (path === '/api/save') {
    return handleSave(request, env);
  }
  if (path === '/api/media') {
    return handleMedia(request, env);
  }

  // Public API routes (no auth required)
  if (path === '/api/live') {
    return handleLive(request, env);
  }
  if (path === '/api/feed/instagram') {
    return handleInstagramFeed(request, env);
  }
  if (path === '/api/feed/substack') {
    return handleSubstackFeed(request, env);
  }
  const likesMatch = path.match(/^\/api\/likes\/([a-zA-Z0-9_-]+)$/);
  if (likesMatch) {
    return handleLikes(request, env, likesMatch[1]);
  }

  return new Response('Not found', { status: 404 });
}

// ── Live content: saved files served before GitHub Pages has published ─────
// On each save the content files are also kept in KV (prefix "live:", in the
// LIKES namespace) for LIVE_TTL. The site asks /api/live first and falls back
// to its own copy on GitHub Pages. The copies expire once Pages has long
// caught up, so changes pushed with git are never hidden for longer than that.
const LIVE_TTL = 15 * 60;   // seconds (Pages usually publishes within 1–3 min)
const LIVE_FILES = /^(content\.json|modelling\/content\.json|projects\/[A-Za-z0-9_-]+\.json)$/;

async function keepLiveCopies(files, env) {
  const puts = Object.entries(files)
    .filter(([path, text]) => LIVE_FILES.test(path) && typeof text === 'string')
    .map(([path, text]) => env.LIKES.put(`live:${path}`, text, { expirationTtl: LIVE_TTL }));
  // Never fail a save because the live copy couldn't be written
  await Promise.allSettled(puts);
}

async function handleLive(request, env) {
  const path = new URL(request.url).searchParams.get('path') || '';
  const reply = (body, status, headers) => corsResponse(new Response(body, { status, headers }), request, env);
  if (request.method !== 'GET' || !LIVE_FILES.test(path)) {
    return reply(JSON.stringify({ error: 'Bad path' }), 400, { 'Content-Type': 'application/json' });
  }
  const text = await env.LIKES.get(`live:${path}`);
  if (text === null) return reply(null, 204, { 'Cache-Control': 'no-store' });   // nothing newer: use the site's copy
  return reply(text, 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
}

/**
 * /auth/login - Redirect to GitHub OAuth
 */
function handleLogin(request, env) {
  const state = generateRandomString(32);
  const clientId = env.GITHUB_CLIENT_ID;
  const backendOrigin = new URL(request.url).origin;
  const redirectUri = `${backendOrigin}/auth/callback`;
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=repo&` +
    `state=${state}`;

  // Store state in secure cookie for CSRF validation
  const response = new Response(null, {
    status: 302,
    headers: {
      'Location': githubAuthUrl,
      'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`
    }
  });

  return corsResponse(response, request, env);
}

/**
 * /auth/callback - GitHub OAuth callback
 */
async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = getCookie(request, 'oauth_state');

  // Validate CSRF state
  if (!state || state !== storedState) {
    return new Response('Invalid state parameter', { status: 403 });
  }

  if (!code) {
    return new Response('No authorization code', { status: 400 });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'rgr-editor-backend'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: `${new URL(request.url).origin}/auth/callback`
      })
    });

    const tokenData = await parseJsonOrText(tokenResponse);
    if (!tokenResponse.ok || tokenData.error) {
      const detail =
        tokenData.error_description ||
        tokenData.error ||
        tokenData.message ||
        tokenData.raw ||
        tokenResponse.status;
      return new Response(`OAuth error: ${detail}`, { status: 401 });
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return new Response('OAuth error: Missing access token', { status: 401 });
    }

    // Verify user is allowed (check GitHub username)
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'rgr-editor-backend'
      }
    });

    const userData = await parseJsonOrText(userResponse);
    if (!userResponse.ok || !userData.login) {
      const detail = userData.message || userData.error || userData.raw || userResponse.status;
      return new Response(`GitHub user lookup failed: ${detail}`, { status: 401 });
    }

    // Only allow specific GitHub user
    if (userData.login !== ALLOWED_GITHUB_USER) {
      return new Response(`Access denied. Only ${ALLOWED_GITHUB_USER} can edit.`, { status: 403 });
    }

    // Create session
    const sessionData = {
      user: userData.login,
      token: accessToken,
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };

    const sessionToken = await signSession(sessionData, env.COOKIE_SECRET);

    // Redirect back to editor with session cookie
    const frontendUrl = env.FRONTEND_URL || new URL(request.url).origin;
    const returnUrl = withSessionOk(frontendUrl, sessionToken);
    const response = new Response(null, {
      status: 302,
      headers: {
        'Location': returnUrl,
        'Set-Cookie': `editor_session=${sessionToken}; HttpOnly; Secure; SameSite=None; Max-Age=604800; Path=/`
      }
    });

    return corsResponse(response, request, env);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(`Callback error: ${error.message}`, { status: 500 });
  }
}

/**
 * /auth/check - Verify current session
 */
async function handleAuthCheck(request, env) {
  const session = await getSession(request, env);

  if (!session) {
    return corsResponse(new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }), request, env);
  }

  return corsResponse(new Response(JSON.stringify({
    authenticated: true,
    user: session.user
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }), request, env);
}

/**
 * /auth/logout - Clear session cookie
 */
async function handleLogout(request, env) {
  const response = new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'editor_session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/'
    }
  });

  return corsResponse(response, request, env);
}

/**
 * /api/save - Commit files to GitHub
 */
async function handleSave(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Require authentication
  const session = await getSession(request, env);
  if (!session) {
    return corsResponse(new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    }), request, env);
  }

  try {
    const { files, message } = await request.json();

    if (!files || Object.keys(files).length === 0) {
      return corsResponse(new Response(JSON.stringify({ error: 'No files provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }), request, env);
    }

    // Commit files to GitHub (batch commit using Git API)
    const commitResult = await commitFilesToGitHub(session.token, files, message, env);

    // Serve the saved content right away while GitHub Pages publishes (see /api/live)
    await keepLiveCopies(files, env);

    return corsResponse(new Response(JSON.stringify({
      success: true,
      commit: commitResult.sha,
      filesCount: Object.keys(files).length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }), request, env);
  } catch (error) {
    console.error('Save error:', error);
    return corsResponse(new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }), request, env);
  }
}

/**
 * /api/media - List and upload media
 */
async function handleMedia(request, env) {
  const session = await getSession(request, env);
  if (!session) {
    return corsResponse(new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    }), request, env);
  }

  if (request.method === 'GET') {
    // List media files
    try {
      const files = await listMediaFiles(session.token, env);
      return corsResponse(new Response(JSON.stringify({ files }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }), request, env);
    } catch (error) {
      return corsResponse(new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }), request, env);
    }
  }

  if (request.method === 'POST') {
    // Upload media file
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      const folder = formData.get('folder') || 'media';

      if (!file) {
        return corsResponse(new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }), request, env);
      }

      if (typeof file.size === 'number' && file.size > MAX_DIRECT_MEDIA_UPLOAD_BYTES) {
        return corsResponse(new Response(JSON.stringify({
          error: `File too large for editor upload. Limit is ${Math.round(MAX_DIRECT_MEDIA_UPLOAD_BYTES / (1024 * 1024))}MB. Add it to media/ locally and git push.`
        }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' }
        }), request, env);
      }

      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const path = `${folder}/${file.name}`;

      const uploadResult = await uploadFileToGitHub(session.token, path, base64, env);

      return corsResponse(new Response(JSON.stringify({
        success: true,
        path: uploadResult.path
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }), request, env);
    } catch (error) {
      return corsResponse(new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }), request, env);
    }
  }

  if (request.method === 'DELETE') {
    try {
      const { path } = await request.json();

      if (!path || typeof path !== 'string') {
        return corsResponse(new Response(JSON.stringify({ error: 'Missing media path' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }), request, env);
      }

      const cleanedPath = path.replace(/^\/+/, '');
      if (!cleanedPath.startsWith('media/')) {
        return corsResponse(new Response(JSON.stringify({ error: 'Invalid media path' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }), request, env);
      }

      await deleteFileFromGitHub(session.token, cleanedPath);

      return corsResponse(new Response(JSON.stringify({
        success: true,
        path: cleanedPath
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }), request, env);
    } catch (error) {
      return corsResponse(new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }), request, env);
    }
  }

  return corsResponse(new Response('Method not allowed', { status: 405 }), request, env);
}

/**
 * Helper: Commit files to GitHub using Git Data API (batch)
 */
async function commitFilesToGitHub(token, filesMap, message, env) {
  // Get current branch ref
  const refRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_BRANCH}`,
    {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'rgr-editor-backend'
      }
    }
  );

  if (!refRes.ok) throw new Error('Failed to fetch branch ref');
  const refData = await refRes.json();
  const parentCommitSha = refData.object.sha;

  // Get parent commit to access tree
  const commitRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${parentCommitSha}`,
    {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'rgr-editor-backend'
      }
    }
  );

  if (!commitRes.ok) throw new Error('Failed to fetch parent commit');
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // Create new tree with updated files
  const treeEntries = Object.entries(filesMap).map(([path, content]) => ({
    path,
    mode: '100644',
    type: 'blob',
    content
  }));

  const treeRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'rgr-editor-backend'
      },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries
      })
    }
  );

  if (!treeRes.ok) throw new Error('Failed to create tree');
  const treeData = await treeRes.json();

  // Create commit
  const newCommitRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'rgr-editor-backend'
      },
      body: JSON.stringify({
        message,
        tree: treeData.sha,
        parents: [parentCommitSha]
      })
    }
  );

  if (!newCommitRes.ok) throw new Error('Failed to create commit');
  const newCommitData = await newCommitRes.json();

  // Update branch ref
  const updateRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'rgr-editor-backend'
      },
      body: JSON.stringify({
        sha: newCommitData.sha,
        force: false
      })
    }
  );

  if (!updateRes.ok) throw new Error('Failed to update branch');

  return newCommitData;
}

/**
 * Helper: Upload file to GitHub via Git Data API (blob → tree → commit)
 * Uses blob endpoint instead of Contents API to avoid timeout on larger files
 */
async function uploadFileToGitHub(token, path, base64Content, env) {
  const ghHeaders = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'rgr-editor-backend'
  };
  const readHeaders = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'rgr-editor-backend'
  };
  const base = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

  // 1. Create blob
  const blobRes = await fetch(`${base}/git/blobs`, {
    method: 'POST',
    headers: ghHeaders,
    body: JSON.stringify({ content: base64Content, encoding: 'base64' })
  });
  if (!blobRes.ok) {
    const err = await parseJsonOrText(blobRes);
    throw new Error(err.message || `Blob creation failed (${blobRes.status})`);
  }
  const blobData = await blobRes.json();

  // 2. Get current branch ref
  const refRes = await fetch(`${base}/git/ref/heads/${GITHUB_BRANCH}`, { headers: readHeaders });
  if (!refRes.ok) throw new Error('Failed to fetch branch ref');
  const refData = await refRes.json();
  const parentSha = refData.object.sha;

  // 3. Get parent commit tree
  const commitRes = await fetch(`${base}/git/commits/${parentSha}`, { headers: readHeaders });
  if (!commitRes.ok) throw new Error('Failed to fetch parent commit');
  const commitData = await commitRes.json();

  // 4. Create tree with new file
  const treeRes = await fetch(`${base}/git/trees`, {
    method: 'POST',
    headers: ghHeaders,
    body: JSON.stringify({
      base_tree: commitData.tree.sha,
      tree: [{ path, mode: '100644', type: 'blob', sha: blobData.sha }]
    })
  });
  if (!treeRes.ok) throw new Error('Failed to create tree');
  const treeData = await treeRes.json();

  // 5. Create commit
  const newCommitRes = await fetch(`${base}/git/commits`, {
    method: 'POST',
    headers: ghHeaders,
    body: JSON.stringify({ message: `Upload: ${path}`, tree: treeData.sha, parents: [parentSha] })
  });
  if (!newCommitRes.ok) throw new Error('Failed to create commit');
  const newCommitData = await newCommitRes.json();

  // 6. Update branch ref
  const updateRes = await fetch(`${base}/git/refs/heads/${GITHUB_BRANCH}`, {
    method: 'PATCH',
    headers: ghHeaders,
    body: JSON.stringify({ sha: newCommitData.sha, force: false })
  });
  if (!updateRes.ok) throw new Error('Failed to update branch');

  return { path };
}

/**
 * Helper: Delete file from GitHub
 */
async function deleteFileFromGitHub(token, path) {
  const getResponse = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${ghPath(path)}`,
    {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'rgr-editor-backend'
      }
    }
  );

  if (getResponse.status === 404) {
    throw new Error('File not found');
  }
  if (!getResponse.ok) {
    const error = await parseJsonOrText(getResponse);
    throw new Error(error.message || 'Failed to fetch file for deletion');
  }

  const fileData = await getResponse.json();
  const deleteResponse = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${ghPath(path)}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'rgr-editor-backend'
      },
      body: JSON.stringify({
        message: `Delete: ${path}`,
        sha: fileData.sha,
        branch: GITHUB_BRANCH
      })
    }
  );

  if (!deleteResponse.ok) {
    const error = await parseJsonOrText(deleteResponse);
    throw new Error(error.message || 'Delete failed');
  }

  return true;
}

/**
 * Helper: List media files in folder
 */
async function listMediaFiles(token, env) {
  return listMediaFilesRecursive(token, 'media');
}

async function listMediaFilesRecursive(token, folderPath) {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${ghPath(folderPath)}`,
    {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'rgr-editor-backend'
      }
    }
  );

  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Failed to list ${folderPath}`);

  const data = await response.json();
  const files = [];

  for (const entry of data) {
    if (entry.type === 'file') {
      files.push({
        name: entry.name,
        path: entry.path,
        size: entry.size,
        url: entry.download_url
      });
      continue;
    }

    if (entry.type === 'dir') {
      const nestedFiles = await listMediaFilesRecursive(token, entry.path);
      files.push(...nestedFiles);
    }
  }

  return files;
}

/**
 * Helper: Get session from cookie
 */
async function getSession(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const sessionToken = bearer || getCookie(request, 'editor_session');
  if (!sessionToken) return null;

  try {
    const session = await verifySession(sessionToken, env.COOKIE_SECRET);
    return session;
  } catch (error) {
    console.error('Session verify error:', error);
    return null;
  }
}

/**
 * Helper: Sign session data (simple HMAC + JSON)
 */
async function signSession(data, secret) {
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(json));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).substring(0, 32);
  return `${btoa(json)}.${sig}`;
}

/**
 * Helper: Verify and decode session
 */
async function verifySession(sessionToken, secret) {
  const [data, sig] = sessionToken.split('.');
  if (!data || !sig) throw new Error('Invalid session token');

  const json = atob(data);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(json));
  const expectedSigStr = btoa(String.fromCharCode(...new Uint8Array(expectedSig))).substring(0, 32);

  if (sig !== expectedSigStr) throw new Error('Session tampered');

  const session = JSON.parse(json);
  if (session.exp < Date.now()) throw new Error('Session expired');

  return session;
}

/**
 * Helper: Extract cookie value
 */
function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const cookie = cookies.find(c => c.startsWith(name + '='));
  return cookie ? cookie.substring(name.length + 1) : null;
}

/**
 * Helper: Generate random string
 */
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function withSessionOk(frontendUrl, sessionToken) {
  try {
    const u = new URL(frontendUrl);
    u.searchParams.set('session_ok', '1');
    if (sessionToken) {
      u.searchParams.set('session_token', sessionToken);
    }
    return u.toString();
  } catch {
    // Fallback for malformed env values.
    const hasQuery = (frontendUrl || '').includes('?');
    const tokenPart = sessionToken ? `&session_token=${encodeURIComponent(sessionToken)}` : '';
    return `${frontendUrl}${hasQuery ? '&' : '?'}session_ok=1${tokenPart}`;
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function parseJsonOrText(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * Helper: Add CORS headers
 */
function likesResponse(data, status, request, env) {
  return corsResponse(new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  }), request, env);
}

/* ── Social feed: Instagram ─────────────────────────────
 * The site can't read Instagram itself (it needs the account's token), so the
 * worker does: it returns only #rgr-tagged posts, in the feed's post shape,
 * cached for 10 minutes. Instagram's media links expire, so posts are always
 * read fresh rather than stored.
 *
 * Token: set once with `wrangler secret put IG_TOKEN`. Tokens last 60 days, so
 * the worker renews any token over a week old (on requests and on the daily
 * cron) and keeps the current one in KV under `ig:token`.
 */
const IG_FEED_CACHE_KEY = 'feed:instagram';
const IG_FEED_TTL = 600; // seconds
const IG_REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

async function getInstagramToken(env) {
  const stored = env.LIKES ? await env.LIKES.get('ig:token', 'json') : null;
  // A newly set secret wins over an older stored token
  if (env.IG_TOKEN && (!stored || stored.seed !== env.IG_TOKEN)) {
    const fresh = { token: env.IG_TOKEN, seed: env.IG_TOKEN, refreshedAt: Date.now() };
    if (env.LIKES) await env.LIKES.put('ig:token', JSON.stringify(fresh));
    return fresh;
  }
  return stored;
}

async function refreshInstagramToken(env, force = false) {
  const current = await getInstagramToken(env);
  if (!current?.token) return null;
  if (!force && Date.now() - current.refreshedAt < IG_REFRESH_AFTER_MS) return current;
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current.token)}`);
  if (!res.ok) return current; // keep using the old one until it actually expires
  const data = await res.json();
  if (!data.access_token) return current;
  const next = { token: data.access_token, seed: current.seed, refreshedAt: Date.now() };
  if (env.LIKES) await env.LIKES.put('ig:token', JSON.stringify(next));
  return next;
}

function captionAlt(caption) {
  const t = String(caption || '').replace(/(^|\s)#[\w-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length <= 150 ? t : t.slice(0, 150).replace(/\s+\S*$/, '') + '…';
}

function instagramPost(m) {
  const caption = m.caption || '';
  const tags = [...caption.matchAll(/#([\w-]+)/g)].map(x => x[1].toLowerCase());
  // Instagram's API has no per-image alt text, so describe images with the
  // caption (hashtags stripped, trimmed to a screen-reader-friendly length)
  const alt = captionAlt(caption);
  const asMedia = x => x.media_type === 'VIDEO'
    ? { type: 'video', url: x.media_url, poster: x.thumbnail_url || '', alt }
    : { type: 'image', url: x.media_url, alt };
  const items = m.media_type === 'CAROUSEL_ALBUM' && m.children?.data?.length ? m.children.data : [m];
  return {
    id: 'ig:' + m.id,
    source: 'instagram',
    url: m.permalink,
    // Instagram writes +0000; Safari only parses +00:00
    date: String(m.timestamp || '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'),
    text: caption,
    tags: [...new Set(tags)],
    media: items.filter(x => x.media_url).map(asMedia),
  };
}

async function handleInstagramFeed(request, env) {
  const json = (data, status = 200) => corsResponse(new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
  }), request, env);

  const cached = env.LIKES ? await env.LIKES.get(IG_FEED_CACHE_KEY, 'json') : null;
  if (cached) return json(cached);

  const tok = await refreshInstagramToken(env);
  if (!tok?.token) return json({ posts: [], error: 'Instagram not connected' }, 503);

  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}';
  const res = await fetch(`https://graph.instagram.com/me/media?fields=${encodeURIComponent(fields)}&limit=50&access_token=${encodeURIComponent(tok.token)}`);
  if (!res.ok) return json({ posts: [], error: 'Instagram HTTP ' + res.status }, 502);
  const data = await res.json();

  // Only tagged posts ever leave the worker
  const posts = (data.data || []).map(instagramPost)
    .filter(p => p.tags.some(t => t === 'rgr' || t.startsWith('rgr-')));
  const body = { posts, fetchedAt: new Date().toISOString() };
  if (env.LIKES) await env.LIKES.put(IG_FEED_CACHE_KEY, JSON.stringify(body), { expirationTtl: IG_FEED_TTL });
  return json(body);
}

/* ── Social feed: Substack ──────────────────────────────
 * Substack sends no CORS header, so the browser can't read it; the worker does.
 * The public RSS has no tags, so this uses the archive endpoint (post tags,
 * free/paid flag). Only free posts tagged #rgr leave the worker, with their
 * full article HTML, cached for 10 minutes per publication.
 * Called as /api/feed/substack?pub=<name> for <name>.substack.com.
 */
const SUBSTACK_FEED_TTL = 600; // seconds
const SUBSTACK_MAX_POSTS = 12;

function substackPost(p, base) {
  const tags = (p.postTags || []).map(t => String(t.name || '').trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
  return {
    id: 'sub:' + p.slug,
    source: 'substack',
    url: p.canonical_url || `${base}/p/${p.slug}`,
    date: p.post_date,
    title: p.title || '',
    text: p.subtitle || p.description || '',
    html: p.body_html || '',
    tags,
    media: p.cover_image ? [{ type: 'image', url: p.cover_image, alt: p.title || '' }] : [],
  };
}

async function handleSubstackFeed(request, env) {
  const json = (data, status = 200) => corsResponse(new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
  }), request, env);

  // Only <name>.substack.com: the worker must not become an open proxy
  const pub = (new URL(request.url).searchParams.get('pub') || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(pub)) return json({ posts: [], error: 'Bad publication' }, 400);
  const base = `https://${pub}.substack.com`;
  const cacheKey = `feed:substack:${pub}`;

  const cached = env.LIKES ? await env.LIKES.get(cacheKey, 'json') : null;
  if (cached) return json(cached);

  const list = await fetch(`${base}/api/v1/archive?sort=new&offset=0&limit=50`, { headers: { 'User-Agent': 'RGR-feed' } });
  if (!list.ok) return json({ posts: [], error: 'Substack HTTP ' + list.status }, 502);
  const tagged = (await list.json())
    .filter(p => p.audience === 'everyone')
    .filter(p => (p.postTags || []).some(t => { const n = String(t.name || '').toLowerCase(); return n === 'rgr' || n.startsWith('rgr-'); }))
    .slice(0, SUBSTACK_MAX_POSTS);

  // The archive has no article bodies; each post's own endpoint does
  const full = await Promise.all(tagged.map(async p => {
    const r = await fetch(`${base}/api/v1/posts/${encodeURIComponent(p.slug)}`, { headers: { 'User-Agent': 'RGR-feed' } });
    return r.ok ? { ...p, ...(await r.json()) } : null;
  }));
  const body = { posts: full.filter(Boolean).map(p => substackPost(p, base)), fetchedAt: new Date().toISOString() };
  if (env.LIKES) await env.LIKES.put(cacheKey, JSON.stringify(body), { expirationTtl: SUBSTACK_FEED_TTL });
  return json(body);
}

/**
 * /api/likes/:projectId - Get or toggle likes (public, no auth)
 */
async function handleLikes(request, env, projectId) {
  if (!env.LIKES) {
    return likesResponse({ error: 'Likes not configured' }, 503, request, env);
  }

  if (request.method === 'GET') {
    const data = await env.LIKES.get(`likes:${projectId}`, 'json') || { count: 0, visitors: [] };
    const visitorId = new URL(request.url).searchParams.get('vid') || '';
    const liked = visitorId ? data.visitors.includes(visitorId) : false;
    return likesResponse({ count: data.count, liked }, 200, request, env);
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const visitorId = body.vid;
    if (!visitorId || typeof visitorId !== 'string' || visitorId.length > 64) {
      return likesResponse({ error: 'Invalid visitor ID' }, 400, request, env);
    }

    const data = await env.LIKES.get(`likes:${projectId}`, 'json') || { count: 0, visitors: [] };
    const alreadyLiked = data.visitors.includes(visitorId);

    if (alreadyLiked) {
      data.visitors = data.visitors.filter(v => v !== visitorId);
      data.count = Math.max(0, data.count - 1);
    } else {
      data.visitors.push(visitorId);
      data.count = data.count + 1;
    }

    await env.LIKES.put(`likes:${projectId}`, JSON.stringify(data));
    return likesResponse({ count: data.count, liked: !alreadyLiked }, 200, request, env);
  }

  return corsResponse(new Response('Method not allowed', { status: 405 }), request, env);
}

function corsResponse(response, request, env) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get('Origin');
  const frontendHost = env.FRONTEND_HOST || 'localhost';
  
  // The allowed origin is echoed back, so caches must keep one copy per origin
  // (otherwise a reply cached for localhost gets reused on the live site)
  headers.append('Vary', 'Origin');

  // Only allow same-origin requests (editor frontend)
  if (origin && (origin.includes(frontendHost) || origin.includes('localhost'))) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Cloudflare Worker entry
export default {
  fetch: (request, env) => handleRequest(request, env),
  // Daily cron (wrangler.toml): keep the Instagram token renewed even if nobody visits
  scheduled: (event, env, ctx) => ctx.waitUntil(refreshInstagramToken(env))
};
