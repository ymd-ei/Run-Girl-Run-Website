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
 * 
 * Setup GitHub OAuth App at: https://github.com/settings/developers
 * - Authorization callback URL: https://your-backend-url/auth/callback
 */

const GITHUB_OWNER = 'ymd-ei';
const GITHUB_REPO = 'Run-Girl-Run-Website';
const GITHUB_BRANCH = 'main';
const ALLOWED_GITHUB_USER = 'ymd-ei'; // Only allow YOUR username

/**
 * Main request handler
 */
async function handleRequest(request, env) {
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

  return new Response('Not found', { status: 404 });
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

  return new Response('Method not allowed', { status: 405 });
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
 * Helper: Upload file to GitHub
 */
async function uploadFileToGitHub(token, path, base64Content, env) {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'rgr-editor-backend'
      },
      body: JSON.stringify({
        message: `Upload: ${path}`,
        content: base64Content,
        branch: GITHUB_BRANCH
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Upload failed');
  }

  const data = await response.json();
  return { path: data.content.path };
}

/**
 * Helper: List media files in folder
 */
async function listMediaFiles(token, env) {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/media`,
    {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'rgr-editor-backend'
      }
    }
  );

  if (response.status === 404) return [];
  if (!response.ok) throw new Error('Failed to list media');

  const data = await response.json();
  return data.map(f => ({
    name: f.name,
    path: f.path,
    size: f.size,
    url: f.download_url
  }));
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
function corsResponse(response, request, env) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get('Origin');
  const frontendHost = env.FRONTEND_HOST || 'localhost';
  
  // Only allow same-origin requests (editor frontend)
  if (origin && (origin.includes(frontendHost) || origin.includes('localhost'))) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
  fetch: (request, env) => handleRequest(request, env)
};
