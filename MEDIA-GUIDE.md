# Media Dimensions Guide

Quick reference for image/video dimensions used across the site. Export at the **Recommended** size for sharp results on retina displays.

## Image Slots

| Slot | Aspect Ratio | Desktop Display | Mobile Display | Fit | Recommended Export |
|---|---|---|---|---|---|
| **Project Hero** (`.pp-hero`) | Free | 680px wide × min 320px tall | 100vw × min 260px tall | `cover` | **1400 × 800** |
| **Longform Hero** (`#pp.longform .pp-hero`) | Free | ~900px wide × min 320px tall | 100vw × min 260px tall | `cover` | **1800 × 800** |
| **Project Card Thumbnail** (`.wci`) | 16:9 | ~300–340px wide | 100vw | `cover` | **800 × 450** |
| **Image Block** (`.bl-image`) | 16:9 | up to ~640px wide | ~100vw | `cover` | **1280 × 720** |
| **Gallery Item** (`.bl-gallery-item img`) | 4:3 | ~300px wide (2-col grid) | ~50vw | `cover` | **800 × 600** |
| **Before / After** (`.bl-before-after-frame`) | 16:9 | up to 780px wide | 100vw | `cover` | **1560 × 878** |
| **Process Step w/ Image** (`.bl-process-step.has-image`) | Free | min 340px tall | min 280px tall | `cover` | **800 × 500** |
| **Lightbox** (`#lb-frame`) | 16:9 | up to 900px wide | 92vw | `contain` | **1800 × 1012** |

## Video Slots

| Slot | Aspect Ratio | Desktop Display | Mobile Display | Recommended |
|---|---|---|---|---|
| **Hero Showreel** (`#reel video`) | 16:9 | 100vw × 100vh | 100vw × 100vh | **1920 × 1080** |
| **Video Block** (`.bl-video`) | 16:9 | up to ~640px wide | 100vw | **1280 × 720** or embed URL |
| **Contact Background** (`#ct-bg-video`) | 16:9 | panel width × 100vh | 100vw × 100vh | **1920 × 1080** |

## Notes

- **GIFs** work in any `<img>` slot (image block, gallery, process step) — the browser animates them natively.
- All image slots use `object-fit: cover` unless noted, so images will be cropped to fill. Keep the subject centered.
- The **lightbox** uses `object-fit: contain`, so the full image is always visible.
- Export as **WebP** or **JPEG** for photos, **PNG** for graphics with transparency, **MP4 (H.264)** for video.
- For retina sharpness, export at **2×** the display size listed above (the Recommended column already accounts for this).
