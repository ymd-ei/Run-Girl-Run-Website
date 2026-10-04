# Mouse cursor — current setting and how to restore the old one

**Default (since 2026-10-03, accessibility):** the visitor sees the normal system mouse cursor.

**The previous look:** the system cursor was hidden everywhere (`cursor:none !important`) and replaced by a custom
cursor (`#cur`) that follows the mouse, plus the "work" badge (`#cur-work-badge`) that appears over Work items.
That custom cursor is still in the code — it is only switched off.

## Switch it back
In [site-config.js](site-config.js) set:

```js
customCursor: true
```

and the branded cursor returns (the system cursor still reappears automatically in fullscreen and the reel popup, as before).
Set it to `false` for the normal cursor.

## Where it lives
- `site-config.js` — `customCursor` flag
- `src/display/main.js` — `setNativeCursorEnabled()` / `syncCursorForFullscreen()` apply the flag; cursor tracking is under "Cursor tracking"
- `index.html` — `<body class="native-cursor">` (prevents a flash of the hidden cursor on load) and the `cursor:none` / `.native-cursor` CSS
- `styles-main.css` — `cursor:none` rule and `#cur-work-badge` styles
