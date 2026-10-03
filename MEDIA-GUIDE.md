# Media Dimensions Guide

Quick reference for image/video dimensions. Pick the template that matches your slot and export at that size.

## Export Templates

| Template | Ratio | Export Size | Slots |
|---|---|---|---|
| **16:9** | 16:9 | **1920 × 1080** | Card Thumbnails (`.wci`, default — see below), More work cards in the post panel, Image Blocks (`.bl-image`), Video Blocks (`.bl-video`), Before / After (`.bl-before-after-frame`), Lightbox (`#lb-frame`), Hero Showreel (`#reel`), Contact Background (`#ct-bg-video`) |
| **4:3** | 4:3 | **1200 × 900** | Gallery Items (`.bl-gallery-item img`), Process Steps (`.bl-process-step`) |
| **Project Header** | ~2.25:1 | **1800 × 800** | Project Hero (`.pp-hero`), Longform Hero (`#pp.longform .pp-hero`) |
| **Socials** | ~1.91:1 | **1200 × 630** | OG Image (`og:image`), Twitter Image (`twitter:image`) |

### Card thumbnails (stacked Work grid)

- In the stacked Work grid, a card thumbnail can be **any shape from 4:5 (portrait) to 2:1 (wide)**, at least **1200 px wide**. It shows whole, and the columns stack around it.
- Taller than 4:5 or wider than 2:1 is cropped from the centre to that limit.
- **Wide thumbnails (about 16:9 or wider) can show 2 columns wide** in the 3-column grid when the columns line up, so a wide export gets a bigger showing.
- **Near-square thumbnails (4:5 to 5:4) can become a 2×2 feature**, but only the **newest one per source**: one project, one Instagram post, one Bluesky post, one Substack post. For projects, newest means latest year, then highest in the project order. Export a project thumbnail square-ish when you want it featured.
- Either way, a card only goes big when there's room (two neighbouring columns about level); otherwise it shows at normal size. 3:2 and anything else stays 1 column.
- **16:9 is the default**: a card sits at 16:9 until its image loads, and More work cards in the post panel are always 16:9.
- Applies to project thumbnails and social feed posts alike. A text-only feed post shows as a slim quote strip instead of a thumbnail.

### Socials notes

- Export as **JPEG** or **PNG** (WebP has inconsistent support in link previews).
- Keep key content within the center **1000 × 500** safe zone — some platforms crop edges.
- File size should be **under 5 MB** (under 1 MB is ideal for fast unfurling).

## Notes

- **GIFs** work in any `<img>` slot (image block, gallery, process step) — the browser animates them natively.
- All image slots use `object-fit: cover` unless noted, so images will be cropped to fill. Keep the subject centered.
- The **lightbox** uses `object-fit: contain`, so the full image is always visible.
- Export as **WebP** or **JPEG** for photos, **PNG** for graphics with transparency, **MP4 (H.264)** for video.
- For retina sharpness, export at **2×** the display size listed above (the Recommended column already accounts for this).

## Video export (web)

Big video files are what make the loading screen wait. Render web copies with these settings and keep your masters separately.

### Settings for every site video

| Setting | Value |
|---|---|
| Format / codec | **MP4, H.264**, profile **High**, level 4.2 |
| Resolution | **1920 × 1080** (never 4K for the site) |
| Frame rate | Same as the source (24 / 25 / 30) |
| Bitrate | **VBR 2-pass**, target and max per the table below |
| Color | **Rec.709, 8-bit, 4:2:0** (no HDR, no 10-bit: some browsers show it wrong) |
| Keyframes | Every 1–2 seconds (or leave on auto) |
| Web optimised | **On**. Called "Fast start", "Web optimized" or "Network optimization" depending on the app |

### Per video

| Video | Slot | Target / max bitrate | Audio | Aim for |
|---|---|---|---|---|
| Hero background loop | Home screen (`reel`) | **5 / 8 Mbps** | **None** (remove the track) | ~6 MB for 9 s |
| Contact background | Contact panel | **4 / 6 Mbps** | **None** | ~12 MB for 25 s |
| Watch reel | Lightbox (`watchReel`) | **6 / 10 Mbps** | AAC, 48 kHz, 192 kbps | ~50 MB for 66 s |

- Background loops are muted on the site anyway, so an audio track is just extra download.
- For loops, make sure the last frame flows into the first.
- If a loop has lots of fine grain or noise, it needs more bitrate to look clean. Try the target first, and only raise it if you see blocky patches.

### Where the settings live

- **Premiere / Media Encoder:** Format H.264 → Video: Match source size set to 1920×1080, Profile High, Level 4.2, Bitrate Encoding **VBR, 2 pass**, Target / Maximum from the table. Untick **Export Audio** for loops.
- **DaVinci Resolve:** Deliver → Format **MP4**, Codec **H.264**, Resolution 1920×1080, Quality **Restrict to** (target in kb/s, e.g. 5000), Encoding profile **High**, tick **Network optimization**. Untick Export Audio for loops.
- **After Effects:** Queue in Media Encoder and use the Premiere settings above.
- **HandBrake** (re-encoding an existing file): Preset *Fast 1080p30*, then Video → **Avg Bitrate** = target, **2-pass**, tick **Web Optimized**. Audio tab: remove the track for loops.
- **No editor handy?** For the two background loops, the repo has a script that uses macOS's built-in encoder (nothing to install). It makes 1080p H.264 with no audio and web-optimised on:

  ```
  swift tools/encode-web-video.swift "media/My Loop.mp4" media/my-loop_web.mp4 5
  ```

  The last number is the target Mbps (5 for the hero, 4 for contact). It's single-pass, so it's a little softer than a 2-pass editor export. Don't use it for the watch reel because it drops the audio.

> **Export H.264, not HEVC/H.265.** Firefox and many Windows/Android browsers can't play HEVC. Some editors default to it for 4K or on Apple Silicon, so check the codec dropdown.

### Swapping in a new background video

1. Export with the settings above and name it something like `media/<name>_web.mp4`. Keep the master elsewhere.
2. Make a **poster**: a JPEG of the first frame, about 1920 wide, quality ~70 (≈100 KB). Most editors can export a still from the first frame. It shows if a visitor gets in before the video can play.
3. In `content.json`, set `url` and `poster` (the hero is `reel`, contact is `contactPanel.video`):

   ```json
   "reel": { "type": "video", "url": "media/RGR_woke-up_web.mp4", "poster": "media/RGR_woke-up_poster.jpg" }
   ```

   Changing the reel URL in the old form editor (v1) resets the poster, so set it again afterwards.
4. Check the file size: hero ≲ 8 MB, contact ≲ 15 MB. Every MB is loading-screen time on a slow connection.

### How the loading screen decides when to finish

The loader in `src/display/main.js` (`runLoaderAnimation`) stays up until **both** the hero and the contact background videos can play through. It has two limits:

- **Minimum 1.5 s** (`LOADER_MIN_MS`) so the name intro always finishes.
- **Maximum 7 s** (`LOADER_MAX_MS`) so a slow connection never traps anyone. A hard dismiss at 8 s backs this up.

The bar follows the real video buffering. The watch reel isn't part of this wait: it only downloads when someone opens it.

Measured on a first visit (Oct 2026) after the web copies went in:

| Connection | Old files (40.7 + 24.6 MB, HEVC) | Web copies (5.4 + 11.9 MB, H.264) |
|---|---|---|
| Cached / repeat visit | — | loader done at **1.8 s** |
| 20 Mbps | hero playable at 8.6 s, so the 7 s cap kicks in | loader done at **2.2 s** |
| 6 Mbps | (cap) | loader done at **7.5 s**, both videos ready |

**Trying the "page first" option:** add `?fastload=1` to the URL. The loader lifts after the intro and the hero video fades in when it can play. This is a preview only and isn't switched on for visitors.
