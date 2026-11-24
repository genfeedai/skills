# Three.js Previs

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Mock up a shot with stick figures and coloured blocks in Three.js, render it to a reference video and write the Seedance prompt that maps each colour to what it represents.

## Installation

```bash
bunx skills add genfeedai/skills --skill threejs-previs
```
<!-- generated:end -->

## Usage

```text
Mock up this shot with stick figures and blocks, then write the Seedance prompt: a courier runs toward the camera down a wet street while the camera pushes in
```

```text
Replace my Blender previs with a Three.js mockup: red is Mia, blue is the van, yellow is the neon sign
```

```text
Render the previs, check it against Seedance 2.0's reference video limits and map each colour in the prompt
```

## What It Does

- Describes a shot as a small JSON scene: stick-figure subjects, coloured blocks for props, flat patches for places and thin panels for frames, with keyframed motion and camera.
- Renders it locally with Three.js in headless Chrome and ffmpeg: a clean `previs.mp4` for the model, and a labelled review video and contact sheet for you.
- Checks the canvas, frame rate and length against the reference video limits of Seedance 2.0 and 2.5.
- Drafts the prompt: what the video is, one "define the red stick figure in Video 1 as ..." sentence per entity, setting and style, a timeline worked out from the keyframes, and a guard against the mockup showing in the result.
- Names the reference tags for BytePlus (`Video 1`), Replicate (`[Video1]`) and fal (`@Video1`), and lists the Genfeed MCP steps to upload the previs and pass it as a video reference.

## Structure

- `SKILL.md`: the method, the model support table and what is unverified.
- `scripts/previs.ts`: `setup`, `init`, `validate`, `render`, `prompt` and `check`.
- `scripts/scene.ts`: the scene model, validation, sampling and prompt drafting (no browser needed, covered by `scripts/scene.test.ts`).
- `scripts/page.ts`: the Three.js page the renderer loads.
- `templates/chase.scene.json`: a starter scene with one of each kind, at 720x1280.
- `templates/street-taxi.scene.json`: the low-cost trial scene (480x854, 4 s) that was run through Seedance 2.5.
- `runtime/package.json`: the pinned Three.js install (`bun run scripts/previs.ts setup`).

Requires Bun 1.1+, Chrome or Chromium, `ffmpeg` and `ffprobe`. No model is called and no key is needed to render.

Use `reverse-video` to build a shot list from an existing clip, `cinematic-prompting` for the camera and light words and `video-realism` for multi-shot prompts.
