---
name: instagram-content-creator
description: Use when the user wants an Instagram caption, carousel outline, Reel script, Story sequence, or a matching image or short video for an Instagram post. Writes the copy through Genfeed and offers to generate the visual as a separate, confirmed step.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Instagram Content Creator (Genfeed MCP)

Produce the caption and the visual brief together so the post works as one piece.

## Tool order

1. `get_brands`. Resolve the brand with the user if there are several and keep `brandId`.
2. `generate_content` with `{type: "caption", platform: "instagram", topic, brandId, variationsCount: 3}` for captions. For a Reel or video concept use `{type: "script", platform: "instagram"}`. For a carousel use `{type: "article_outline"}` and shape the slides from the outline: one idea per slide, a strong first slide, a call to action on the last.
3. Show the options and let the user choose.
4. If the user wants a visual, move to the `media-forge` skill. Check the cost first with `get_generation_options` (an estimate exists only when you pass a `modelKey` the user named; otherwise `credits` is null, so say the cost is unknown), ask for confirmation, then call `generate` with `{type: "image" | "video", prompt, brandId, aspectRatio, model}` using the same model you quoted using `4:5` or `1:1` for feed images and `9:16` for Reels and Stories. Poll `get_job_status` with the returned id.
5. To keep the caption as a draft, `create_post` with `{content, platforms: ["instagram"], mediaUrls}`. Drafts only.

## Rules

- Image and video generation spends credits. Never start it without the user agreeing to the estimate, or to an unknown cost when no estimate is available.
- Never publish or schedule without explicit confirmation. Use the `social-poster` skill and check `get_scheduler_capabilities` with `{platform: "instagram"}` for media rules first.
- Keep hashtags relevant and few; do not pad with unrelated tags.
- When saving with `create_post`, pass only the text (and `platforms`, `mediaUrls`). Never pass `scheduledAt`, `targets`, `contentId`, `ingredientId` or `confirmed`, and only save when the user asks you to keep the draft.
