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
index.html          → Desktop homepage (redirects phones to mobile.html, except ?project= links)
mobile.html         → Slim mobile page: reel, contact, "View work" link to the full site
site-config.js      → Shared settings (backend URL, repo, branch) for every page
editor-auth.js      → Shared editor sign-in capture (main, v1 and modelling editors)
_config.yml         → Files GitHub Pages should not publish
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

## Site settings & shortcuts

Site-wide values (name, email, social links, branding, SEO, theme, filters, availability badge,
site text, Privacy & Legal) live in **Site settings** in the editor. Any text can use
`{shortcuts}` such as `{name}`, `{email}`, `{year}`, `{instagram}` or `{project:<id>}`; they
resolve on the live site (`src/utils/refs.js`) and stay as-is inside the editors. Saving also
writes the title / social-preview tags into `index.html` and `mobile.html` so link previews and
search engines see them. The modelling site reads name, email, résumé and socials from here too.

## Editor Backend

The editor saves changes via a Cloudflare Worker that commits to this repo through GitHub's API. See [backend/SETUP.md](backend/SETUP.md) for deployment and OAuth configuration.

## Media

See [MEDIA-GUIDE.md](MEDIA-GUIDE.md) for image/video dimensions and export guidelines.

## Social feed

See [SOCIAL-FEED-GUIDE.md](SOCIAL-FEED-GUIDE.md) for tagging posts with `#rgr`, the accounts involved, and replacing the Instagram token.

## Accessibility

The site should work by keyboard and screen reader and respect reduced-motion settings, without
changing how it looks to mouse users. Most of it lives in `src/utils/a11y.js` and the
"ACCESSIBILITY" section at the end of `styles-main.css`.

- **Skip link:** the first Tab on the home screen shows a "Skip to work" tag under the nav;
  Enter opens Work with focus on the first card. Mouse users never see it.
- **Keyboard:** Work cards (projects, posts, quote strips, More work) are focusable buttons:
  Tab to them, Enter or Space to open. Tab order follows the grid's DOM order, which is the
  masonry reading order. Focus rings only show for keyboard use (`:focus-visible`): accent on
  light panels, paper-white on the dark frost panels, contact panel and home screen.
- **Panels are dialogs:** Work, About, the project/post panel, Contact, the reel lightbox and
  Privacy & Legal have `role="dialog"` and a label. Opening one moves focus into it, Tab stays
  inside it, and closing it (✕, Back, Escape, backdrop) returns focus to whatever opened it.
  Closed panels are `inert`, so their off-screen contents aren't tabbable. This is driven by the
  `open` class, so new ways of opening a panel get it for free. Inside the editor's preview
  iframe focus is never moved.
- **Keyboard-only close buttons:** the contact panel's ✕ and a "Close" in Privacy & Legal are
  invisible until tabbed to (mouse users close by clicking outside).
- **Filter row:** chips have `aria-pressed`; "More ▾" and the sort menu are disclosure buttons
  with `aria-expanded`. Escape closes an open menu without closing the panel; focus stays on the
  same control after a filter or sort re-renders the row.
- **Reduced motion** (`prefers-reduced-motion: reduce`): slides, fades and looping CSS
  animations become instant; the loader shows the name without the scramble and the bar just
  follows loading; headline scrambles and their idle flicker, the contact tickers and the
  sensitive-content tapes don't run. Background videos still play.
- **Images:** project card thumbnails are decorative (the title is right below). Bluesky alt
  text comes through as written; Instagram has no alt text in its API, so the Worker uses the
  caption with hashtags stripped (`captionAlt` in `backend/worker.js`). Icon-only links and
  buttons (socials, like, share, ✕) have labels; the like button reports its count and state.
- **Left as is on purpose:** the small card meta text at 3 columns (`.wcty`).

To check by hand: open `?demo` (fills the Work grid), put the mouse away and use Tab /
Shift+Tab / Enter / Space / Escape only. For reduced motion, turn on "Reduce motion" in the OS
accessibility settings (or emulate `prefers-reduced-motion` in Chrome DevTools → Rendering).

## Deployment

The site is hosted on **GitHub Pages** with a custom domain (`rungirlrun.studio`). Pushing to the default branch deploys automatically.
