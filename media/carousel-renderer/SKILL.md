---
name: carousel-renderer
description: Render a finished carousel spec into branded PNG slides and a PDF on your own machine with headless Chrome. No image API, no credits. Triggers on "render the carousel", "make the carousel slides", "carousel PDF for LinkedIn", "instagram carousel images", "turn this outline into slides".
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Carousel Renderer

You turn an approved carousel outline into finished slides. The copy comes from `linkedin-carousel` or `instagram-carousel`; you draw it. Everything runs locally with a Chrome or Chromium binary already on the machine, so there is no per-image API cost.

This is a **worker skill**: one script, JSON in, files out. It stores nothing and reads no secrets.

---

## Run It

```bash
# check the plan without drawing anything
bun run scripts/render.ts --spec carousel.json --out out/carousel --dry-run

# render slide-01.png ... slide-NN.png, carousel.pdf and manifest.json
bun run scripts/render.ts --spec carousel.json --out out/carousel
```

Requires [Bun](https://bun.sh) 1.1+ and Chrome or Chromium. The script looks for `CHROME_PATH`, then the usual macOS and Linux install paths, then Playwright's browser cache. Zero npm packages.

---

## The Spec

```json
{
  "format": "instagram",
  "brand": {
    "name": "Genfeed",
    "handle": "@genfeedai",
    "background": "#0b0b10",
    "foreground": "#f5f5f7",
    "accent": "#7c5cff",
    "muted": "#9a9aa8",
    "fontFamily": "'Helvetica Neue', Arial, sans-serif",
    "fontFile": "./fonts/Brand-Regular.woff2"
  },
  "slides": [
    { "type": "cover", "eyebrow": "Local content ops", "title": "Ship a carousel without an image API" },
    { "type": "content", "eyebrow": "Step 1", "title": "Write the spec", "bullets": ["Hook first", "One idea per slide"] },
    { "type": "stat", "stat": "$0", "title": "Rendered on your machine", "caption": "Chrome does the drawing" },
    { "type": "cta", "title": "Follow for the next one", "body": "Save this for later." }
  ]
}
```

### Formats

| `format` | Size | Output | Slide limit |
|----------|------|--------|-------------|
| `instagram` | 1080 x 1350 (4:5) | PNGs, PDF | 20 |
| `linkedin` | 1080 x 1350 (4:5) | PDF is the upload, PNGs for preview | 300 pages in the script; keep it to 8 to 12 |
| `square` | 1080 x 1080 | PNGs, PDF | 20 |

Check the platform's current limits before you publish. They change, and the script enforces only the numbers above.

### Slide types

| `type` | Use | Fields |
|--------|-----|--------|
| `cover` | Slide 1. Large title at the bottom, one promise | `eyebrow`, `title` |
| `content` | One idea | `eyebrow`, `title`, `body` or `bullets`, `caption` |
| `stat` | One number that proves the point | `stat`, `title`, `caption` |
| `quote` | A short line in italics | `title`, `caption` |
| `cta` | Last slide. One action | `title`, `body`, `caption` |

All text is HTML-escaped. Colors must be hex, `rgb()` or `hsl()`; anything else falls back to the default. `fontFile` is a local file path to a font you are allowed to use.

---

## Workflow

1. **Get the copy approved first.** Use the platform skill, then `content-reviewer`. Do not render unreviewed copy.
2. **Fill the spec.** One idea per slide. Cover states the promise, last slide asks for one action. Keep a title under about 60 characters and a bullet under about 70.
3. **Dry run**, then render.
4. **Look at every PNG.** Open each one and check that nothing is cut off, the text is readable at phone size and the order tells the story. Fix the spec and re-render. Do not hand over slides you have not looked at.
5. **Record what you checked** in your hand-off: format, slide count, what you looked at.
6. **Publish only with the owner's go.** LinkedIn takes the PDF as a document post. Instagram takes the PNGs in order.

## Brand rules

- Pull colors and fonts from `visual-brand-kit` or `video-brand-profile` when the brand has them. Do not invent a palette for a brand that has one.
- Contrast: foreground against background must stay readable. If you change colors, re-check every slide.
- A logo or avatar is not part of this script. Keep the handle in the footer, or composite a logo afterwards and say so.

## Output

```json
{
  "files": ["slide-01.png", "slide-02.png"],
  "format": "instagram",
  "width": 1080,
  "height": 1350,
  "out": "/abs/path/out/carousel",
  "pdf": "carousel.pdf",
  "slides": 4,
  "renderedAt": "2026-10-31T17:52:15.322Z"
}
```

## Limits

- No photos or generated images inside slides. For a picture on a slide, generate it with `image-prompt-engineer` and your own tool, then composite it. This skill draws type and shapes.
- One layout per slide type. It is a clean default, not a design system.
- Fonts that are not installed fall back silently. Use `fontFile` for brand fonts.

## Genfeed Integration

Works standalone. With a Genfeed workspace, upload the rendered PNGs with `upload_media` and save the post as a draft with `create_post`. Drafts only; never schedule or publish without the owner's explicit confirmation.
