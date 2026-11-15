# Video Model Benchmark

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Run one prompt through two or three AI video models and merge the clips into one side-by-side video for X

## Installation

```bash
bunx skills add genfeedai/skills --skill video-model-benchmark
```
<!-- generated:end -->

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
