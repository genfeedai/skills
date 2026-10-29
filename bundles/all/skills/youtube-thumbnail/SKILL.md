---
name: youtube-thumbnail
description: Create branded YouTube thumbnails for livestreams, recaps and Shorts covers with exactly three test concepts, generation prompts, text and logo layers, signature placement and export sizes. Use when designing, briefing or revising a YouTube thumbnail or Shorts cover.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# YouTube Thumbnail

One skill, three modes. The look comes from the channel's [video brand profile](../video-brand-profile/SKILL.md). This skill supplies the process, the placement math and the checks.

## Modes

| Mode | Canvas | Mark | Testing |
|---|---|---|---|
| Livestream (scheduled or live) | 16:9 | Live color from the profile | Not on a scheduled live. Allowed on a completed live archive |
| Recap or edited video | 16:9 | Edited-video color (white on dark, black on light) | Test & Compare on eligible long-form uploads |
| Short cover | 9:16 | Edited-video color | No native testing for Shorts |

Recheck YouTube's current eligibility and file rules before a release: <https://support.google.com/youtube/answer/16391400> and <https://support.google.com/youtube/answer/72431>.

## Workflow

1. **Anchor on the real asset.** The final edit for a recap or Short, the topic board for an upcoming live, the full transcript for a finished stream. The thumbnail and the title must promise the same true thing.
2. **Read the profile.** Subject rule (faces or no faces), background, text rule, mark color and position, fonts, export sizes. Do not restate a rule from memory.
3. **Decide new set or surgical edit.** For an edit, change only what was asked and keep every other element.
4. **Write exactly three variants** (below). If testing only the thumbnail, hold the title fixed. If testing both, label each title and thumbnail pair.
5. **Generate the artwork layer** with an image model: the backdrop and the subject only.
6. **Composite the exact layers yourself:** official logos, text and the signature, as separate editable layers on top.
7. **Export, then inspect at feed size.**
8. **Record** what was used, then upload or hand off. Nothing is uploaded without the owner's go.

## The three variants

Make them different hypotheses about the viewer, with the same truthful promise. Typical triples:

- **Decisive outcome.** The result or the verdict is the picture.
- **Firsthand proof.** The workflow, the tool or the number on screen.
- **Meaningful tradeoff.** The tension between two options.

For each variant write:

```markdown
**A: <name>**
- Hypothesis and the inference a viewer draws:
- Composition and crop (subject, where the eye lands, safe margins):
- Topic or logo references (official files, original colors):
- Palette (from the profile):
- Text, exact spelling, or none:
- Prompt for the artwork layer:
- Exclusions:
- Small-size check:
```

End with the variant to use by default if a test is inconclusive. Never call any variant a winner before a result exists.

## Artwork prompts

- Describe the backdrop and subject only. Image models misspell text and redraw logos, so do not ask for words or marks in the image.
- Keep the background predominantly monochrome or charcoal if the profile says so, with the subject carrying the one strong element.
- When the profile forbids faces, do not prompt for people and do not use host photographs as references. Use the topic, an object, a metaphor, or the official logo.
- If the profile allows hosts, refresh a face from the original reference photo, never from a previous generation, and keep likeness approval a human judgment.
- Do not invent product screenshots, benchmarks, results or endorsements. Use real proof or a clearly illustrative metaphor.

## Text

- Text is optional unless the profile requires it. When used: at most 4 words over 2 lines, large, high contrast, exact spelling.
- Use the profile's font and case. Check the text survives a 168 x 94 px preview.
- One accent color for one word or line at most.

## Signature placement

Place the mark on the profile's anchor, by ratio:

1. `markSize = widthRatio x canvasWidth`, `inset = insetRatio x canvasWidth`.
2. Anchor to the corner the profile names, same inset on both edges.
3. Example, 16:9 with a 7.5% mark and a 3.75% inset: 96 px and 48 px at 1280 x 720, 288 px and 144 px at 3840 x 2160, top-left at (1136, 576) and (3408, 1728).
4. Color by mode: live color for livestreams, edited-video color for recaps and Shorts, dark mark on a light backdrop.
5. No box behind it, no extra dots or waves, no font glyph. If the artwork already carries the mark, add none.

## Export

- Work at 1280 x 720; export 16:9 at the profile's recommended size (YouTube recommends 3840 x 2160 as of Oct 2026, minimum width 640) as JPEG or PNG.
- Short covers: 9:16, recommended 2160 x 3840, minimum height 640.
- File size: the `thumbnails.set` reference currently states 50 MB, older copies say 2 MB, and limits vary by upload device. Keep JPEGs under 2 MB.
- Keep the layered source (backdrop, logo, text, mark) with the export.

## Check before delivering

- Readable at feed size and at the small related-video size.
- Spelling of every word and the official logo are exact.
- Text and the mark are inside the canvas with the profile's margins.
- No duplicate signature, no invented claim, no face if faces are excluded.
- The title and the thumbnail say the same true thing.
- The file records the profile version, the fonts and the mark color used.
- Technical checks are reported separately from "someone looked at it".

## Shorts covers via the API

Custom Shorts thumbnails exist in Studio for eligible channels (July 2026 rollout, per trade press). The Data API's `thumbnails.set` documentation does not mention Shorts, so a call can fail. Treat the API as best effort, keep the cover file, and fall back to Studio.
