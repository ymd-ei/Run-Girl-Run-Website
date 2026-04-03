# Markdown Import Guide

When you import a `.md` file into a project, the parser converts markdown syntax into the site's internal block format.

## Text Blocks

| Markdown | Block Type | Result |
|---|---|---|
| `# Heading` | `text-lg` | Large accent heading |
| `## Heading` | `text-md` | Bold medium text |
| `### Heading` (or more `#`) | `text-sm` | Uppercase small label |
| Plain paragraph | `text-md` | Body text |
| `> Quote text` | `quote` | Blockquote |

## Media

```
![alt text](image-url)
```
→ `image` block

```
!video(video-url)
```
→ `video` block

```
:::alpha
src: media/projects/fox-alpha.png
alt: Fox mark
color: #ff5a1f
bg: transparent
scale: 1
fit: contain
ratio: 16/9
:::
```
→ `alpha-art` block (recolorable alpha image)

## Divider

```
---
```
→ `divider` block (`***` also works)

## Stats

Consecutive lines in this format become one `stats` block:

```
148,000 | Combined Views
12 | Projects Completed
```

## Callout

```
!!! note Title Here
Body text on subsequent non-blank lines
```

Tones: `note`, `highlight`, `warning` (defaults to `note` if omitted).

## Process (Timeline)

```
:::process
1. @Jan 2026 :: Design Phase | Description text
2. Build Phase | Another description | ![alt](image-url)
:::
```

Use `@date :: title` for dated entries. Image at the end is optional.

## Gallery

```
:::gallery cols=2
- ![alt](src) | Optional caption
- ![alt](src2)
:::
```

`cols` can be `2` or `3` (defaults to 2).

## CTA (Call to Action)

```
:::cta
Headline | Body text | Button Label | https://link.com
:::
```

## Before / After

```
:::beforeafter
before: ![alt](before-image-url)
after: ![alt](after-image-url)
caption: Optional caption text
:::
```

## FAQ

```
:::faq
- Question one? | Answer one
- Question two? | Answer two | open
:::
```

Append `| open` to expand an item by default. If none are marked, the first auto-opens.

## Inline Formatting

Works inside any text content:

| Markdown | Rendered As |
|---|---|
| `**bold**` | `<b>bold</b>` |
| `*italic*` | `<i>italic</i>` |
| `` `code` `` | `<b>code</b>` |
| `- item` / `* item` | Bullet list (in paragraphs) |

## Not Supported in Import

- **skills** — export-only (`- Skill Name | 80%`); add via editor UI.
- **twocol** — no markdown shorthand; editor-only.
