# Session handoff — Oct 5–6, 2026

Where the site stands after the Oct 5–6 sessions, what was decided, and what's still open.
Everything below is **live on rungirlrun.studio** (last commit `70222d2` on `main`) unless marked otherwise.

## Oct 6 (evening): modelling site + editor uploads

Live (commits `5d36744` → `8613b26`):
- **Modelling site cleanup**: old unlinked pages (`works`, `work`, `work-lite`, `contact`), their styles and
  ~6 MB of unused models removed. The live view now allows the editor's full camera distance (was capped at 12).
- **Keyboard**: Enter opens Works and moves into the list; Escape closes the top layer only; focus goes to
  Back and returns to the opener; closed panels leave the Tab order.
- **One idle clock**: after **2 minutes** without input the animation and turntable ease to a stop, then
  drawing stops on a faded frame; any input brings it back. (No separate turntable timer any more.)
- The page no longer pauses on `document.hidden` (embedded viewers report hidden while on screen and froze it).
- **Pancakes model**: embedded texture re-encoded as WebP — 4.46 MB → 0.49 MB.
- **Editor uploads are web-friendly**: "Make web-friendly (WebP)" next to Upload (main + modelling editor,
  library page and picker) converts images and `.glb` textures to WebP in the browser. Videos still need a
  web copy (see `MEDIA-GUIDE.md`). Not yet tried with a real signed-in upload — check the toast on the next one.

Parked on the local branch **`modelling-shot-camera`** (not pushed; waiting for a real Blender file with a camera):
- A `.glb` with its own camera plays through a marker frame like an animation layout sheet: 4 accent
  strokes (9 px, 0.8 opacity, title blend), 2 × the title width, drawn once per load; the 3D isn't clipped.
  The frame shows only while following the shot. Drag takes over in place; "Back to shot" + glide back after 3 min.
- Frame label `a1…e24` at 24 fps in a pencil circle (circle redraws on 4s). Hand-drawn scans can replace
  the font + circle — spec in `MEDIA-GUIDE.md` on that branch, switch with `HAND_MARKS`.
- Smoother/lighter rendering: screen rate capped at 60, draws only when something changes, Lite mode
  (main site's switch) = 30 fps + plain resolution + no turntable, reduced motion = no turntable.
  The live site still draws at a fixed 30 fps.
- Test file `samples/shot-test/mumei-shot.glb` (on the branch). To pick up: `git switch modelling-shot-camera`,
  point Mumei's `model` at that file in `modelling/content.json` (locally only), preview `/modelling/`.

## What changed

### Phone page (`mobile.html`)
- **Top of page**: the hero video plays behind the reel player and the name, treated like the
  Contact section's background (same gradient). The reel is first, then "3D Animator / Run *Girl Run*".
- **Top bar**: the running dog (left) and "Available for work" (right) stay pinned while scrolling;
  a light dark fade appears behind them only once their original spot has scrolled away.
- **Reel player**: a play cover in the site's style. With a poster set (editor → Home → Watch reel →
  Poster image) it sits on the poster; without one it's frosted glass over the hero video with
  "Watch Reel" and the running time. No poster is set yet — add one whenever you have it.
- **Work / About panels**: two real panels parked just below the screen, with only their folder tab
  showing (Work left, About right). Pull a tab up (or tap it) to raise the panel; swipe down (from the
  tab, or from the content once it's scrolled to the top), Back, Escape, or tap the tab again to park it.
  - Work rises to two thirds; About, a project or a post rise to 92% (tab included).
  - Inside a project/post, swiping down = Back (the panel settles to the grid height from the finger).
  - Work has the desktop's filters, Newest / Most liked sort, likes and share; projects and posts
    open inside the panel. Even 2-column grid (no tile layout on mobile — decided).
  - Tab + fillets + panel are drawn as one shape (one fill, blur and edge line).
  - The hero's Work/About links were removed; the tabs are the nav (real, focusable buttons).
- **Lite mode** switch in the footer (also on desktop, see below).
- Videos with sound pause when the phone locks or the page goes to the background.

### Desktop + shared
- **Shared code** (change once, both pages update):
  `styles-content.css` (work cards, posts, project header, content blocks),
  `src/display/likes.js`, `src/display/workFilters.js`, `src/utils/lite.js`,
  `src/utils/idleVideos.js`, `src/utils/ticker.js`.
- **Lite mode** (footer switch on both pages; desktop has it in the Work, About and Contact footers):
  background videos → their posters, no frosted blur. On by default for data-saver visitors;
  remembered per browser.
- **Idle pause**: after 5 minutes without input, the muted background loops pause and dim 45%;
  any input brings them back. This fixed the laptop staying awake overnight (Chrome's video wake lock).
  Confirmed working on a real idle page.
- **Ticker tapes** (contact strips + mature tape): browser-driven animation (same speed on 60/120 Hz
  screens, no per-frame script, no leak), slow down on hover, contact strips pause while the panel is
  closed, whole-tape "difference" blend like the contact heading, pinstripes move with the words,
  mature tape stripe spacing fixed.
- Work thumbnails stay on their own GPU layer (hover jitter fix — Chrome; see Safari below).
- Welcome Message thumbnail is now WebP (1.5 MB → 32 KB); the PNG stays as the link-preview image.

## Decisions to keep
- Mobile is **low maintenance / low priority**: small duplicated bits between `main.js` and
  `mobile.js` (project/post header markup, Newest sort, copy-email, theme, CSS tokens) are fine.
- Desktop does **not** swap videos for posters on reduced motion — only Lite mode does.
- The contact video keeps playing while the contact panel is closed — by design.
- No fixed MB cap on background videos (the hero is a longer carousel); see `MEDIA-GUIDE.md`.
- Leave the running dog (APNG) alone.
- Old v1 editor: don't add new features to it; nothing v1 can do may go missing from the new editor,
  and settings v1 built must keep working. (Not being worked on now.)

## Open / parked
- **Safari-only hover jitter** on Work thumbnails (when the zoom ends). Options: round the masonry
  card widths to whole pixels in `feed.js` `masonry()`, or zoom the image inside the card instead of
  the card. Needs testing in Safari.
- **Instagram feed** route on the worker returns 502, so Instagram posts don't show in Work.
- **Editor date save** (from Oct 4): never actually saved once to confirm the date lands in the
  project JSON and `content.json`.
- Reel poster: add one when ready (editor field exists).
- Mobile gaps, not requested: `?project=` links on phones open the desktop page; `?post=` links
  open the phone page but not the post; before/after slider drag and FAQ toggles aren't on mobile
  (only the unpublished sample project uses them).

## How to work on it
- **Local server**: `python3 dev-server.py 8090` in this folder (no caching), or the Claude preview
  config `rgr-site`. Phone on the same Wi-Fi: `http://<Mac IP>:8090/mobile.html`
  (Mac IP via `ipconfig getifaddr en0`; it was 10.0.0.48). Shut it down when done.
- **Swipes and safe areas** can only be judged on a real phone.
- **Syntax-check JS as modules** (`cp file.js /tmp/x.mjs && node --check /tmp/x.mjs`); a plain
  `node --check` once missed an error that broke the page.
- The Claude preview pane pauses animations and timers while it's in the background — measure with
  transitions disabled, or keep it in front.
- **Local-only demos** (not committed): `samples/idle-demo/`, `samples/ticker-demo/`,
  `samples/tape-style-demo/`, `samples/contact-slip/`.
- Media export guidance (posters, thumbnails as WebP, video settings): `MEDIA-GUIDE.md`.
