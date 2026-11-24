# Reverse Video

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Reverse-engineer a reference video into a frame-exact shot list and one prompt per shot, recreate it with your own subject and check it against the original.

## Installation

```bash
bunx skills add genfeedai/skills --skill reverse-video
```
<!-- generated:end -->

## Usage

```text
Reverse engineer this reformer pilates reel into a shot list and recreate it with Shayla
```

```text
Break this video down shot by shot: cuts, camera moves, lighting and on-screen text
```

```text
Write one prompt per shot for this reference clip and check my recreation against it
```

## What It Does

- Measures the reference locally: canvas, frame rate and every cut to the exact frame, including jump cuts and punch-ins inside one take.
- Reads the consecutive frames around each change, then breaks each shot into framing, camera move, light, look, action, text and sound.
- Sorts the layers into generated footage, rebuilt graphics and supplied assets.
- Writes a shot list in the fields Genfeed's storyboard accepts and one video prompt per shot.
- Recreates the clip with the owner's own subject through the Genfeed MCP, then measures the result against the original.

## Structure

- `SKILL.md`: the method.
- `scripts/measure.ts`: `probe`, `cuts`, `frames`, `sheet` and `compare`. Bun, ffmpeg and ffprobe only, no API.

Use `reverse-image` for a still image, `cinematic-prompting` for the camera and lighting words and `video-realism` for the structure of each shot prompt.
