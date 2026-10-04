---
name: media-forge
description: Use when the user wants an image, video, voice-over, or music track generated, wants to edit, reframe, upscale, or join existing media, or wants to browse their generated library. Estimates cost first, generates through Genfeed after the user agrees, and tracks the job to completion.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Media Forge (Genfeed MCP)

Generate and transform media with a cost check before anything is spent.

## Tool order for new media

1. `get_brands`. `generate` requires `brandId` when the organization has more than one brand, so resolve it with the user.
2. Get a clear prompt. For images and video, use the `image-prompt-engineer` skill if the idea is vague; `enhance_prompt` (`{prompt, contentType: "image" | "video", brandId}`) previews the improved prompt without generating.
3. Check the cost with `get_generation_options` using `{type: "image" | "image-edit" | "video" | "voice" | "music", brandId, modelKey, aspectRatio, resolution, duration, outputs}`. The response has `cost.estimate` (`credits` and `status`) and `cost.balance`. An estimate exists only for a specific `modelKey`: with no `modelKey` (Auto) the estimate has `credits: null` and `status: "auto"`, and voice and music return `status: "unavailable"`. No tool lists model keys, so use a `modelKey` only when the user names one or one came back from an earlier Genfeed result, and never invent one.
   - If `credits` is a number: tell the user that figure for that model, the balance, and ask to proceed. Video and multiple outputs cost more.
   - If `credits` is null: say plainly that the cost is unknown (Genfeed picks the model and prices it when it runs), show the balance if it is not null, and ask whether to generate anyway. Do not present a guess as an estimate.
4. After the user agrees, `generate` with `{type, prompt, brandId, aspectRatio, ...}`. Pass the same `model` as the `modelKey` you quoted; omit `model` only when the cost was unknown and the user agreed to that. Show the `generationHarness` prompt it returns instead of reconstructing the prompt yourself.
5. `get_job_status` with `{jobId}` using the id `generate` returned, until it reports a result or failure. Do not claim success before then.
6. Show the result URL and offer next steps: edit, reframe, or hand to `social-poster`.

## Editing existing media

- `list_assets` with `{type: "image" | "video" | "music" | "avatar" | "character", brandId, limit}` to find the source asset and its id.
- `transform_media` with `{operation: "edit" | "reframe" | "upscale" | "merge", ...}`. Edit needs `imageId` and an exact `prompt`; reframe needs `imageId` and `aspectRatio`; upscale needs `imageUrl`; merge needs at least two video `ids`. Edit, reframe, and upscale spend credits; merge is free.

## Rules

- Never generate without the user agreeing first: to the quoted estimate when there is one, or to an unknown cost when there is none.
- Do not generate real people's likenesses, or branded characters the user does not own. Use `list_assets` with `{type: "character"}` for characters the brand is allowed to use.
- Never publish or schedule from this skill.
