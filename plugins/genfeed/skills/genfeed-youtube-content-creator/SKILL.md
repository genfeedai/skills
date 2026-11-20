---
name: genfeed-youtube-content-creator
description: Use when the user wants help with a YouTube video or Short, such as a script, title options, a description, chapters, or a thumbnail concept. Writes the text through Genfeed and generates a thumbnail image only after the user approves the cost.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# YouTube Content Creator (Genfeed MCP)

Package a video idea so it earns the click and holds attention.

## Tool order

1. `get_context` (`action: brands`). Resolve the brand with the user if there are several and keep `brandId`.
2. Ask for the video's promise (what the viewer gets), the audience, and the length. If the user has an outline or transcript, work from it.
3. `generate_text` with `{action: "content", input: {type: "script", platform: "youtube", topic, brandId}}` for a script or Short. Use `{type: "caption", platform: "youtube", variationsCount: 5}` for title and description options. Tighten the output yourself: a hook inside the first ten seconds, one idea per section, and a payoff that matches the title.
4. Build chapters from the script sections with timestamps the user will confirm after editing; do not invent timestamps for footage that does not exist yet.
5. Thumbnail: use the `genfeed-image-prompt-engineer` skill to write the prompt, check cost with `get_generation_catalog` (`action: options`) (`input: {type: "image", brandId, modelKey}`; `modelKey` only if the user named a model, otherwise `credits` is null and the cost is unknown, which you must tell the user), get approval, then `generate_media` with `{action: "media", input: {type: "image", prompt, aspectRatio: "16:9", brandId, model}}` using the same model you quoted, and poll `check_job` (`action: job`).
6. To keep text as a draft, `save_post` (`action: post`) with `input` `{content, platforms: ["youtube"]}`.

## Rules

- Titles must not promise something the video does not deliver.
- Never publish or schedule without explicit confirmation. Use `genfeed-social-poster`.
- Do not state view counts, revenue, or algorithm claims as fact.
- When saving with `save_post` (`action: post`), pass only the text (and `platforms`, `mediaUrls`). Never pass `scheduledAt`, `targets`, `contentId`, `ingredientId` or `confirmed`, and only save when the user asks you to keep the draft.
