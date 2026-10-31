---
name: thumbnail-compositor
description: Composite three branded thumbnail variants locally from a backdrop, up to four words of exact text and the signature at the profile's ratio, with headless Chrome. No image API. Triggers on "render the thumbnail", "make the three thumbnail variants", "composite the thumbnail", "shorts cover image", "put the logo and text on the thumbnail".
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Thumbnail Compositor

You draw the exact layers of a thumbnail: backdrop, text and signature. `youtube-thumbnail` decides what the three variants should be; you turn them into files. Image models misspell text and redraw logos, so text and marks are composited here, never generated.

This is a **worker skill**: one script, JSON in, files out. It uses a local Chrome or Chromium, calls no API and reads no secrets.

---

## Run It

```bash
# check the plan without drawing anything
bun run scripts/compose.ts --spec thumbs.json --out out/thumbs --dry-run

# render variant-a/b/c.png plus a small related-video preview of each
bun run scripts/compose.ts --spec thumbs.json --out out/thumbs

# export at 3x (3840 x 2160 for 16:9)
bun run scripts/compose.ts --spec thumbs.json --out out/thumbs --scale 3
```

Requires [Bun](https://bun.sh) 1.1+ and Chrome or Chromium (`CHROME_PATH` if it is in an unusual place). Zero npm packages.

---

## The Spec

```json
{
  "mode": "recap",
  "profile": {
    "version": "2026-10-1",
    "accent": "#7c5cff",
    "dark": "#0b0b10",
    "light": "#f5f5f7",
    "fontFamily": "'Inter', Arial, sans-serif",
    "fontFile": "./fonts/Brand-Black.woff2",
    "maxWords": 4,
    "uppercase": true,
    "signature": { "file": "./brand/mark.svg", "corner": "top-left", "widthRatio": 0.075, "insetRatio": 0.0375 }
  },
  "variants": [
    { "name": "Decisive outcome", "hypothesis": "The verdict is the picture", "text": ["FREE RENDER", "NO BILL"], "accentWord": "FREE", "backdropFile": "./art/a.png" },
    { "name": "Firsthand proof", "hypothesis": "The number on screen", "text": ["$0 PER CLIP"], "accentWord": "$0", "backdropGradient": ["#101820", "#2a1a4a"] },
    { "name": "Meaningful tradeoff", "hypothesis": "Two options in tension", "text": ["CLOUD OR LOCAL"], "accentWord": "LOCAL" }
  ]
}
```

| Field | Notes |
|-------|-------|
| `mode` | `livestream` and `recap` are 1280 x 720 (16:9). `short` is 1080 x 1920 (9:16 cover). |
| `variants` | Exactly three. The script refuses any other number. |
| `text` | Optional. At most 2 lines and at most `maxWords` words in total (default 4). Exact spelling is yours to check. |
| `accentWord` | One word or token in the accent color. Must appear in the text. |
| `backdropFile` | Local image from your own tool or a real asset. Falls back to `backdropGradient`, then the profile's dark color. |
| `scrim` | 0 to 0.9 darkening layer over the backdrop for text contrast. Default 0.35. |
| `signature` | SVG or PNG, placed by ratio of canvas width: `size = widthRatio x width`, `inset = insetRatio x width`, same inset on both edges. 7.5% and 3.75% give 96 px and 48 px at 1280 wide. |

Profile values should come from the channel's [video brand profile](../video-brand-profile/SKILL.md). Do not restate a rule from memory.

---

## Workflow

1. **Get the three variants from `youtube-thumbnail`**: hypothesis, text, backdrop, exclusions. One truthful promise, three different angles.
2. **Make the artwork layer** (backdrop and subject only) with whatever tool the owner uses, or use a real screenshot or photo they own. No words and no logos inside the artwork.
3. **Fill the spec.** Use the profile's mark color for the mode: live color for livestreams, edited-video color for recaps and Shorts.
4. **Dry run**, then render.
5. **Look at every file.** Open each full-size PNG and each `.small.png`. The small preview is 168 px wide for 16:9, the related-video size. Text must still read there. Check spelling, margins and that the signature appears once.
6. **Fix the spec and re-render** until all three pass. Do not hand over an unviewed file.
7. **Hand off** with the manifest: profile version, fonts, mode, export size, and which checks you made. Say separately whether anyone watched it next to the real title.

## Rules

- Do not invent product screenshots, benchmarks, results or endorsements. Use real proof or a clearly illustrative metaphor.
- Do not use a person's face unless the profile allows it and the owner approved the likeness.
- Never call a variant the winner before a test result exists.
- YouTube's thumbnail file rules and test eligibility change. Recheck them at release; see `youtube-thumbnail`.
- Export is PNG. Convert to JPEG under the platform's size limit yourself if needed.

## Output

`manifest.json` lists mode, `profileVersion`, fonts, and per variant the name, hypothesis, text, export size and file names. Files: `variant-a.png`, `variant-a.small.png` and the same for b and c.

## Limits

- One layout: text bottom-left, signature in a corner. It is a clean default, not a design system.
- Brand fonts need `fontFile`; an uninstalled family falls back silently.
- No JPEG export and no layered source file. Keep the spec and the artwork as the editable source.

## Genfeed Integration

Works standalone. With a Genfeed workspace, upload the chosen file with `upload_media`. Drafts only; never publish or schedule without the owner's explicit confirmation.
