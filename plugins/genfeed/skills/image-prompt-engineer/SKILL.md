---
name: image-prompt-engineer
description: Use when the user has a rough idea for an image or short video and wants a precise generation prompt, wants a prompt improved, or wants variations on a visual direction before spending credits. Writes the prompt, previews Genfeed's enhancement, and generates only when the user asks.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Image Prompt Engineer (Genfeed MCP)

Turn an idea into a prompt that names the subject, setting, composition, lighting, style, and format.

## Tool order

1. `get_brands` for the brand's tone and visual direction; keep `brandId`. Check `list_assets` with `{type: "image", brandId, limit: 10}` if the user wants the result to match existing visuals.
2. Ask only for what is missing: subject, where it will be used (this sets the aspect ratio), and any must-have or must-avoid details.
3. Write the prompt in this order: subject, action or pose, setting, composition and camera, lighting, style, colour palette, format. Use plain concrete words, not stacked adjectives.
4. `enhance_prompt` with `{prompt, contentType: "image" | "video", brandId}` to preview Genfeed's enhanced version. It does not generate media. Show both prompts and let the user choose.
5. If the user wants it generated, use the `media-forge` flow: `get_generation_options` (with `modelKey` only if the user named a model) for the cost, then confirmation, then `generate` with `{type, prompt, brandId, aspectRatio, model, harness: false}`, passing the same model you quoted. If the estimate comes back with `credits: null`, tell the user the cost is unknown and ask before generating. Pass `harness: false` when the reviewed prompt should be used unchanged.
6. Offer two or three variations by changing one variable at a time (composition, lighting, or style) rather than rewriting everything.

## Rules

- No generation without the user's go-ahead, on a quoted estimate or an acknowledged unknown cost.
- Do not describe real, identifiable people or imitate a living artist's name as a style.
- Keep text-in-image short; models render long text poorly. Say so when relevant.
- Never publish or schedule from this skill; hand finished visuals to `social-poster`.
