# Video Model Benchmark

One prompt, two or three AI video models, one side-by-side video for X. Each model makes a clip from the same prompt, and the clips are merged into a square, landscape or feed-stacked video that plays in sync, with each model's name on screen and the prompt on the video or in `post.md`.

## Installation

```bash
bunx skills add genfeedai/skills --skill video-model-benchmark
```

Requires [Bun](https://bun.sh) 1.1+, `ffmpeg` on PATH and `REPLICATE_API_TOKEN` in the environment.

## Usage

```text
"Compare Veo and Seedance on this prompt as a side-by-side video"
"Make a square benchmark video for X: <prompt>"
"Blind A/B video comparison of two video models"
```

```bash
bun run scripts/compare.ts --prompt "A courier carries four flat boxes past a lamp post" --footer "genfeed.ai"
bun run scripts/compare.ts --prompt "..." --canvas landscape --models veo-3.1-fast,seedance-2.0-fast,kling-v2.5-turbo-pro
bun run scripts/compare.ts --prompt "..." --dry-run
bun run scripts/compare.ts --preset dbz-fight --canvas stacked   # 1080x1216, 16:9 panels, post.md
bun run scripts/compare.ts --list-presets
```

The default pair is `veo-3.1-fast` and `seedance-2.0-fast`, 4 seconds each, silent, about $1 at most.

## Boundary

- Use for a visual, postable comparison of video models on one prompt.
- Use `media-forge` to generate a single clip.
- Use genfeedai/benchmark for scored, blind, repeatable rankings.

## Structure

- `SKILL.md` - main instructions, flags, model table, honesty rules
- `metadata.json` - triggers, tags, outputs
- `scripts/compare.ts` - CLI: generate, composite, manifest
- `scripts/models.ts` - model registry (matches Genfeed's registry) and input shapes
- `scripts/layout.ts` - canvas geometry and prompt wrapping
- `scripts/presets.ts` - ready-made prompts (fit woman, camera moves, DBZ fight, motion coherence)

## License

MIT
