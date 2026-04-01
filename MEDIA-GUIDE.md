# Media Dimensions Guide

Quick reference for image/video dimensions. Pick the template that matches your slot and export at that size.

## Export Templates

| Template | Ratio | Export Size | Slots |
|---|---|---|---|
| **16:9** | 16:9 | **1920 × 1080** | Card Thumbnails (`.wci`), Image Blocks (`.bl-image`), Video Blocks (`.bl-video`), Before / After (`.bl-before-after-frame`), Lightbox (`#lb-frame`), Hero Showreel (`#reel`), Contact Background (`#ct-bg-video`) |
| **4:3** | 4:3 | **1200 × 900** | Gallery Items (`.bl-gallery-item img`), Process Steps (`.bl-process-step`) |
| **Project Header** | ~2.25:1 | **1800 × 800** | Project Hero (`.pp-hero`), Longform Hero (`#pp.longform .pp-hero`) |
| **Socials** | ~1.91:1 | **1200 × 630** | OG Image (`og:image`), Twitter Image (`twitter:image`) |

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
