---
name: youtube-content-creator
description: Use when the user wants help with a YouTube video or Short, such as a script, title options, a description, chapters, or a thumbnail concept. Writes the text through Genfeed and generates a thumbnail image only after the user approves the cost.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# YouTube Content Creator (Genfeed MCP)

Package a video idea so it earns the click and holds attention.

## Tool order

1. `get_brands`. Resolve the brand with the user if there are several and keep `brandId`.
2. Ask for the video's promise (what the viewer gets), the audience, and the length. If the user has an outline or transcript, work from it.
3. `generate_content` with `{type: "script", platform: "youtube", topic, brandId}` for a script or Short. Use `{type: "caption", platform: "youtube", variationsCount: 5}` for title and description options. Tighten the output yourself: a hook inside the first ten seconds, one idea per section, and a payoff that matches the title.
4. Build chapters from the script sections with timestamps the user will confirm after editing; do not invent timestamps for footage that does not exist yet.
5. Thumbnail: use the `image-prompt-engineer` skill to write the prompt, check cost with `get_generation_options` (`{type: "image"}`), get approval, then `generate` with `{type: "image", prompt, aspectRatio: "16:9", brandId}` and poll `get_job_status`.
6. To keep text as a draft, `create_post` with `{content, platforms: ["youtube"]}`.

## Rules

- Titles must not promise something the video does not deliver.
- Never publish or schedule without explicit confirmation. Use `social-poster`.
- Do not state view counts, revenue, or algorithm claims as fact.
