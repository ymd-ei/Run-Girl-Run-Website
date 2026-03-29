# Backend Setup Guide

This guide walks you through deploying the editor backend to Cloudflare Workers and configuring GitHub OAuth.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com) (free tier is sufficient)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed locally
- Your GitHub account

## Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the form:
   - **Application name**: `Run Girl Run Editor`
   - **Homepage URL**: `https://rungirlrun.studio`
   - **Authorization callback URL**: `https://YOUR-BACKEND-URL/auth/callback`
     - If using Cloudflare Workers default: `https://run-girl-run-editor-backend.YOURNAME.workers.dev/auth/callback`
     - If using custom domain: `https://api.rungirlrun.studio/auth/callback`
4. Click **"Register application"**
5. **Copy your credentials:**
   - Client ID
   - Client Secret (click "Generate a new client secret" if needed)

## Step 2: Create Personal Access Token

1. Go to [GitHub Personal Access Tokens (Fine-grained)](https://github.com/settings/personal-access-tokens/new)
2. Create a token with:
   - **Token name**: `Editor Backend`
   - **Expiration**: 90 days (or longer)
   - **Resource owner**: `ymd-ei` (your account)
   - **Repository access**: `Only select repositories` → Select `Run-Girl-Run-Website`
   - **Permissions**:
     - `Contents`: Read and write
     - `Metadata`: Read-only
3. **Copy the token** (you won't see it again)

**Alternatively, if using classic tokens:**
- Go to [Personal Access Tokens (classic)](https://github.com/settings/tokens)
- Create token with scopes: `repo` (full repo access)

## Step 3: Deploy to Cloudflare Workers

### Option A: Using Wrangler CLI (Recommended)

1. **Clone or navigate to your repo:**
   ```bash
   cd Run-Girl-Run-Website
   ```

2. **Install Wrangler** (if not already installed):
   ```bash
   npm install -g wrangler
   ```

3. **Log in to Cloudflare:**
   ```bash
   wrangler login
   ```
   (Opens browser to authorize)

4. **Deploy the worker:**
   ```bash
   cd backend
   wrangler deploy
   ```

5. **You should see output like:**
   ```
   ✓ Published run-girl-run-editor-backend @ https://run-girl-run-editor-backend.YOURNAME.workers.dev
   ```

### Option B: Using Cloudflare Dashboard (Manual)

1. Go to [Cloudflare Workers Dashboard](https://dash.cloudflare.com/workers)
2. Click **"Create application"**
3. Click **"Create Worker"**
4. Copy the entire contents of `backend/worker.js` into the editor
5. Click **"Deploy"**
6. Note your worker URL (will be shown after deployment)

## Step 4: Set Environment Variables

### Using Wrangler CLI:

```bash
cd backend

# Set secrets (these are encrypted and private)
wrangler secret put GITHUB_CLIENT_ID --env production
# Paste your OAuth App Client ID, press Enter

wrangler secret put GITHUB_CLIENT_SECRET --env production
# Paste your OAuth App Client Secret, press Enter

wrangler secret put GITHUB_TOKEN --env production
# Paste your Personal Access Token, press Enter

wrangler secret put COOKIE_SECRET --env production
# Generate a random string (e.g., openssl rand -base64 32), paste it, press Enter
```

### Using Cloudflare Dashboard:

1. Go to your Worker in the dashboard
2. Click **"Settings"** → **"Variables"**
3. Add secrets:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GITHUB_TOKEN`
   - `COOKIE_SECRET`

4. Click each and paste the values

## Step 5: Update Editor Frontend

In `editor.html`, update the backend URL at the top:

```html
<script>
  const API_BASE = 'https://your-backend-url.workers.dev';
  // or if using custom domain:
  // const API_BASE = 'https://api.rungirlrun.studio';
</script>
```

Also update the OAuth callback URL in your GitHub OAuth App settings if you changed the worker URL.

## Step 6: Test Login Flow

1. Open `editor.html` in your browser
2. You should see a **"Log In with GitHub"** button
3. Click it → you'll be redirected to GitHub OAuth
4. Authorize the app
5. You should be redirected back and see **"Logged in as @ymd-ei"**
6. Try editing content and clicking **"Save All Changes"**
7. Check your repo for a new commit

## Troubleshooting

### "Invalid state parameter" on OAuth callback
- Ensure your OAuth callback URL in GitHub settings matches your worker URL exactly
- Example: `https://run-girl-run-editor-backend.yourname.workers.dev/auth/callback`

### "Access denied" after login
- Verify `ALLOWED_GITHUB_USER` in `worker.js` matches your GitHub username
- Only your account can use the editor by design

### Save fails with 401 Unauthorized
- Check your `GITHUB_TOKEN` is still valid (tokens can expire)
- Verify token has `Contents: Read and write` permission on the repo

### CORS errors in browser console
- Ensure `FRONTEND_URL` in worker.js matches your editor URL
- Update `FRONTEND_HOST` to match your domain

### Worker returning "Undefined Variable" errors
- Make sure all environment variables are set (see Step 4)
- List active secrets: `wrangler secret list --env production`

## Security Notes

- ✅ GitHub token is stored **server-side only** (never in browser)
- ✅ Session cookie is `HttpOnly` + `Secure` + `SameSite=Lax`
- ✅ OAuth state parameter prevents CSRF attacks
- ✅ Only **your GitHub account** can access the editor
- ⚠️ Worker URLs are accessible by anyone with the URL (rely on obscurity + single-user auth)

## Next: Testing Workflow

Once deployed, test the full flow:

1. ✓ Visit editor URL
2. ✓ Log in with GitHub
3. ✓ Edit content in the editor
4. ✓ Save changes
5. ✓ Verify commit appears on GitHub
6. ✓ Check [rungirlrun.studio](https://rungirlrun.studio) for updated content (1-3 min delay for Pages deploy)
7. ✓ Log out and verify save is disabled

## Rollback (If needed)

If something breaks and you need to revert:

1. Comment out the backend API calls in `editor.js` and fall back to local token mode
2. Or keep a backup of the original `editor.html` and `editor.js` before changes
3. Temporarily set environment variable to fall-back mode (if added to worker.js)

---

That's it! Your editor is now accessible from any device with secure GitHub OAuth login.
