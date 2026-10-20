---
name: content-atomizer
description: Use when the user has one post, article, or idea and wants versions of it for other platforms, such as turning an X post into a LinkedIn post, an Instagram caption, or a TikTok or YouTube description. Repurposes existing Genfeed posts into platform-native drafts without publishing them.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Content Atomizer (Genfeed MCP)

Take one source piece and produce platform-native derivatives, each adapted rather than copied.

## Tool order

1. `get_brands`. Resolve the brand with the user if there are several and keep `brandId`.
2. Find the source. If the user names a post, read it with `get_posts` and `{postId}`. If they describe it, list recent posts with `get_posts` and `{limit: 10}` and ask which one. If the source is text they pasted, skip to step 4.
3. For a stored post, call `repurpose_post` once per target with `{postId, platform, mode}`. `platform` is one of `instagram`, `twitter`, `linkedin`, `tiktok`, `youtube`. Use `mode: "deterministic"` for an instant rule-based fit to the channel's length, hashtag, link, and media rules. Use `mode: "agent"` when the angle itself should change; its draft lands in the review queue. Add `credentialId` only if the user names a connected account. The tool never publishes or schedules.
4. For pasted text, call `generate_content` with `{type: "post", platform, topic, brandId}` per platform, passing the source text in `topic` and asking for a native rewrite of the same idea.
5. Present the derivatives side by side with a one-line note on what changed for each channel (hook, length, format, call to action).

## Rules

- Keep the core claim identical across versions. Change structure and tone, not facts.
- Use `get_scheduler_capabilities` with `{platform}` to check limits instead of assuming them.
- Never publish or schedule. Hand the approved derivatives to `social-poster` and wait for explicit confirmation there.
- `repurpose_post` and `generate_content` can spend credits. For more than three targets, say so and confirm first.
