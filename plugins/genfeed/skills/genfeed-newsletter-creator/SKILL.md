---
name: genfeed-newsletter-creator
description: Use when the user wants to write a newsletter edition, subject line options, a recurring newsletter format, or to turn recent posts and notes into an email-style issue. Generates a newsletter draft through Genfeed and keeps it as a saved draft for review.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Newsletter Creator (Genfeed MCP)

Write one clear edition for one reader task, then hand it back for review.

## Tool order

1. `get_context` (`action: brands`). Resolve the brand with the user if there are several and keep `brandId`.
2. Gather the inputs: the issue's single main point, any source links or notes, and the audience. To reuse recent material, read it with `get_content` (`action: posts`) (`input: {limit: 10}` or `{postId}`) or `get_content` (`action: articles`) (`input: {query}` or `{articleId}`) and summarise only what is there.
3. `generate_text` with `{action: "content", input: {type: "newsletter", topic, brandId}}`. This creates a saved newsletter draft, so tell the user it was saved and that nothing was sent.
4. For subject lines and preview text, call `generate_text` with `{action: "content", input: {type: "caption", platform: "newsletter", variationsCount: 5}}` and pick short, specific options over clever ones.
5. Review the draft against the brief: one main point, scannable sections, one call to action. Present edits rather than silently rewriting.

## Rules

- This skill has no send tool. Never claim an issue was sent or scheduled. If the user wants distribution, say that sending happens in their email platform or Genfeed, and use `genfeed-social-poster` only for channels that appear in `check_channel` (`action: readiness`).
- Do not invent subscriber numbers, open rates, or quotes.
- Cite where facts came from; leave placeholders for anything unverified.
