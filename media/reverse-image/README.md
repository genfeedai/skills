# Reverse Image

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Break an image down into framing, lens, lighting, palette and style, write one reproducible prompt, and check the recreation against the reference.

## Installation

```bash
bunx skills add genfeedai/skills --skill reverse-image
```
<!-- generated:end -->

## Usage

```text
Reverse engineer this photo: framing, lens, lighting and a prompt to recreate it with Shayla
```

```text
What lens, camera angle and lighting is this image? Write it as a reproducible prompt.
```

```text
Copy the look of this reference but with my product
```

## What It Does

- Reads the canvas, lays a thirds grid over the reference and pulls its main colours with ffmpeg.
- Breaks the image into frame, placement, camera, lens, focus, light, colour, grade, subject, setting, text and style.
- Writes one prompt in a fixed order so a single clause can be changed at a time.
- Generates with the owner's own subject through the Genfeed MCP, then compares the result with the reference side by side.

Use `reverse-video` for a video, `cinematic-prompting` for the lens and lighting words and `image-prompt-engineer` for each model's prompt format.
