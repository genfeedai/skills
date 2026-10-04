---
name: linkedin-content-creator
description: Use when the user wants a LinkedIn post, a longer LinkedIn article or newsletter-style piece, or a few alternative LinkedIn drafts from a story, lesson, launch, or opinion. Generates LinkedIn-native drafts through Genfeed in the brand voice.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# LinkedIn Content Creator (Genfeed MCP)

Turn a real experience or point of view into LinkedIn drafts with a clear opening line and one takeaway.

## Tool order

1. `get_brands`. Resolve the brand with the user if there are several and keep `brandId`.
2. Get the raw material from the user: the story or claim, what changed, and what the reader should do or think differently. Ask for it if missing; do not invent it.
3. `generate_content` with `{type: "post", platform: "linkedin", topic, brandId, variationsCount: 3}` for a post. For a long-form piece use `{type: "article", topic, brandId, tone, length, targetAudience}`; note that `article` creates a saved article draft with an id, so tell the user it was saved. Use `{type: "newsletter"}` only for a newsletter edition, which also saves a draft.
4. Edit for the feed: the first two lines must stand alone, short paragraphs, no hashtag stuffing, no engagement bait.
5. To keep a post draft, `create_post` with `{content, platforms: ["linkedin"]}`. It saves a draft and never publishes.
6. For channel limits, call `get_scheduler_capabilities` with `{platform: "linkedin"}`.

## Rules

- Never publish or schedule without explicit confirmation of the exact text, account, and time. Use the `social-poster` skill for that.
- Do not fabricate results, client names, or numbers. Use placeholders such as [metric] when the user has not supplied one.
- Generating an article spends more credits than a post; say so and confirm before generating several.
