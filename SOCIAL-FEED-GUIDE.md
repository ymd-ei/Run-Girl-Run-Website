# Social Feed Guide

How posts from other platforms get onto the site, and the things to remember
when something needs redoing. Posts tagged **#rgr** show up in the Work grid
next to projects and open in the project panel.

## Posting

| You want | Do this on the platform |
|---|---|
| Put a post on the site | Add `#rgr` to it |
| Put it under a filter too | Add `#rgr-<filter value>`, e.g. `#rgr-3d`, `#rgr-2d`, `#rgr-pipeline`, `#rgr-rfb` |
| Several filters | Several tags (`#rgr-3d #rgr-pipeline`) |
| Take it off the site | Remove the tag, or delete the post |
| Change its filters | Edit the tags |

- Tags match the filter's **Value** in Site settings → Filter, not its Label, so renaming "3D" never breaks `#rgr-3d`.
- A filter can also list extra **Feed hashtags** (Site settings → Filter), e.g. `blender3d`. They only count on posts that also have `#rgr`.
- There is no hide button in the editor on purpose: the platform is the only switch.
- **Bluesky can't edit posts.** A wrong tag there means delete and re-post, which resets that post's likes.

How fast posts appear: **Bluesky** right away (the site reads it live). **Instagram** within about 10 minutes (the worker caches it).

## Accounts

| Platform | Account | Where it's set |
|---|---|---|
| Bluesky | `@ymd-ei.bsky.social` | Site settings → Social links (the bsky.app link) |
| Instagram (feed) | `@rungirl.r` (professional account) | The token in the Cloudflare worker; listed in Social links as "Instagram (studio)" |
| Instagram (personal) | `@me_are_jei` | Social links as "Instagram". Not part of the feed. |

The Instagram feed always comes from the account the token belongs to. It turns on whenever any Instagram link is in Social links.

## Instagram token

The worker holds an Instagram access token (secret `IG_TOKEN`). Tokens last 60
days; the worker renews it itself (whenever it's over a week old, and on a
daily run at 09:00 UTC), so normally there's nothing to do.

**Replace the token** (e.g. after regenerating it in Meta, or if Instagram posts stop showing for more than a day):

1. Meta for Developers → your app → Use cases → Instagram → **API setup with Instagram business login** → **Generate token** next to `rungirl.r`. Copy it. Never paste it into chat or the website files.
2. In Terminal, run the command below and paste the token at `Enter a secret value:` (nothing shows as you paste; that's normal):

```bash
npx wrangler secret put IG_TOKEN --config "/Users/ymd/Documents/RGR Web/Run-Girl-Run-Website/backend/wrangler.toml"
```

The worker switches to the new token by itself.

**Meta app details:** Business-type app, use case "Manage messaging & content on Instagram", left in **Development mode** (no App Review needed for your own account). `rungirl.r` is added as an **Instagram Tester**; if Meta ever asks again, accept the invite at instagram.com/accounts/manage_access → Tester Invites.

## Deploying the worker

Needed only when `backend/worker.js` or `backend/wrangler.toml` changes. The first run opens a Cloudflare login in your browser.

```bash
npx wrangler deploy --config "/Users/ymd/Documents/RGR Web/Run-Girl-Run-Website/backend/wrangler.toml"
```

Deploying keeps the saved secrets (GitHub login, `IG_TOKEN`).

## Share links

- **Projects:** Share copies `rungirlrun.studio/p/<project>/`. The editor writes those pages whenever it saves; each shows the project's title, first text and thumbnail in link previews.
- **Posts:** Share copies `share.rungirlrun.workers.dev/<code>` (`b…` = Bluesky, `i…` = Instagram). A separate small worker, `share` (`backend/share/`), builds the preview on request: the post's first line, platform and date, and its first image, or the **default banner** for text-only posts. If the post is deleted or untagged, it shows the site's own preview and opens the homepage. Nothing is stored.
- The domain stays at Google Domains; that's why post links use the workers.dev address instead of rungirlrun.studio.

Deploy the share worker (only when `backend/share/` changes; no secrets needed):

```bash
npx wrangler deploy --config "/Users/ymd/Documents/RGR Web/Run-Girl-Run-Website/backend/share/wrangler.toml"
```

## Not set up yet

- **Scaling past ~50 posts** (none urgent yet):
  1. Only the latest **50 posts per platform** are checked for `#rgr`. Lots of untagged posting pushes older tagged posts out of the grid. Fix: page back through history and keep a stored list of tagged posts on the worker.
  2. **No "Show more":** every card renders at once. Fix: show ~20–30, then a button; lazy-load project thumbnails too.
  3. **Most liked** asks the worker once per card. Fix: one request that returns all counts.
  - Open for later: a way to keep chosen posts from ever dropping out, and maybe a deliberate cap (e.g. the newest ~24 `#rgr` posts). A `#rgr-pin` tag doesn't work well, because Bluesky posts can't be edited, so you'd have to decide when posting. Simplest route: have the worker remember every `#rgr` post it has seen, so nothing drops out unless deleted. *Concern (Oct 2026): keeping a list of every post feels excessive.* It would live in the worker's storage (like likes), not as a file on the site, and stay small, but weigh it against lighter options before building.
- **Substack**: needs a small relay in the worker (Substack doesn't let other websites read its feed from a browser). After that, pasting the Substack link into Social links is enough.
- **X**: possible, but X charges per post read (about $2–3 a month for this feed). Parked.
- **Default banner** for text-only posts: add one in Site settings → Social feed. Until then they get a purple gradient.

## Testing tools

- **Demo posts:** open **rungirlrun.studio/?demo** (or `http://localhost:8099/?demo` on the local server: `python3 dev-server.py 8099` in the website folder). About 14 placeholder posts fill the Work grid (all shapes, short and long text, a carousel, a video, articles) with made-up like counts, plus a **Shuffle** button to try different layouts. Visitors without `?demo` never see any of it, and liking a demo post doesn't touch real likes. Add `&drafts=all` to include unpublished projects.
- `samples/feed/fetch_substack.py` (a first draft of the Substack relay) pulls a Substack's posts for local testing into `samples/feed/live/`, which is git-ignored so other people's articles never deploy.
