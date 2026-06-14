# Run Girl Run — Website

Portfolio site for [rungirlrun.studio](https://rungirlrun.studio), a 3D character animation studio based in Toronto.

## Local Development

Requires **Python 3** (for a simple HTTP server).

**macOS:** double-click `start.command`
**Windows:** double-click `start.bat`

Both launch a local server at **http://localhost:8080** and open the browser automatically.
The editor is available at **http://localhost:8080/editor.html** (the WYSIWYG editor — edits
the real site in an iframe). The original form-based editor is kept as a fallback at
**editor-v1.html**.

## Project Structure

```
index.html          → Desktop homepage (redirects mobile to mobile.html)
mobile.html         → Mobile layout
editor.html         → WYSIWYG editor (edits the live site in an iframe; GitHub OAuth to save)
editor-v1.html      → Legacy form-based editor (fallback)
content.json        → Site content (hero, contact, project order)
projects/           → Individual project data (JSON per project)
media/              → Images and video assets
src/                → Source JS modules (display, editor, state, utils)
styles-main.css     → Desktop styles
styles-mobile.css   → Mobile styles
styles-editor.css   → Editor styles
```

## Editor Backend

The editor saves changes via a Cloudflare Worker that commits to this repo through GitHub's API. See [backend/SETUP.md](backend/SETUP.md) for deployment and OAuth configuration.

## Media

See [MEDIA-GUIDE.md](MEDIA-GUIDE.md) for image/video dimensions and export guidelines.

## Deployment

The site is hosted on **GitHub Pages** with a custom domain (`rungirlrun.studio`). Pushing to the default branch deploys automatically.
