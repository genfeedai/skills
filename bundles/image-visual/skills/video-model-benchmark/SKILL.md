---
name: video-model-benchmark
description: Run one prompt through two or three AI video models and merge the 9:16 clips into one side-by-side video for X, labelled with model names and the shared prompt. Triggers on "compare video models", "side by side video", "video model benchmark", "veo vs seedance", "which video model is better", "model shootout video".
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Video Model Benchmark

You turn one prompt into a side-by-side comparison video. Each model generates the same prompt as a 9:16 clip; the clips are composited into one square or landscape video that plays in sync, each panel labelled with its model name, the shared prompt shown. The output is made to post on X.

It sells the output, not the tooling: the viewer sees two results from one prompt and judges for themselves.

## Run It

```bash
# default pair, square 1080x1080, 4 seconds, no audio
bun run scripts/compare.ts --prompt "A courier carries four flat boxes past a lamp post, handheld, daylight"

# landscape 1920x1080 with the prompt in a left column, branded footer
bun run scripts/compare.ts --prompt "..." --canvas landscape --footer "genfeed.ai"

# check the plan and the cost ceiling without spending anything
bun run scripts/compare.ts --prompt "..." --dry-run
```

Requires [Bun](https://bun.sh) 1.1+, `ffmpeg` and `ffprobe` on PATH, and `REPLICATE_API_TOKEN` in the environment (read from env only, never written to disk). Zero npm dependencies.

## Flags

| Flag | Default | Notes |
|------|---------|-------|
| `--prompt` | required | Shared by every model, shown on the video. Keep it under ~140 characters for the square canvas (three lines max, then truncated with an ellipsis). |
| `--models` | `veo-3.1-fast,seedance-2.0-fast` | Two or three aliases from the table below, or any `owner/name` Replicate id. |
| `--canvas` | `square` | `square` is 1080x1080, prompt on top. `landscape` is 1920x1080, prompt in a left column (two models) or on top (three). |
| `--duration` | `4` | Seconds per clip. Snapped to what each model accepts (Veo 4/6/8, Kling 5/10). The final video is trimmed to the shortest clip. |
| `--resolution` | `720p` | Passed to models that take one. |
| `--audio` | `none` | `--audio <alias>` keeps that one model's audio track. Default is silent, so no model gets a sound advantage and it is cheaper. |
| `--blind` | off | Shuffles the panel order and labels them A / B (C). The key is written to `manifest.json`. Good for "which one is better?" posts, then reveal in a reply. |
| `--footer` | none | Small text in the corner, for example the handle. |
| `--out` | `./video-benchmark` | Holds `clips/`, the final mp4 and `manifest.json`. |
| `--reuse` | off | Reuse clips already in `clips/` instead of paying to regenerate. Use it to re-composite as another canvas. |
| `--clip "Label=path.mp4"` | none | Repeat 2 or 3 times to composite clips you already have. No generation, no spend. |
| `--model-input alias='{"seed":1}'` | none | Merge extra JSON into one model's input. |
| `--font` | auto | Path to a font file when none of the built-in candidates exist. |

## Models

Aliases and Replicate ids match Genfeed's own video model registry. Rates are upper bounds in USD per second of output, read from each model's Replicate pricing page; check it before a big run.

| Alias | Replicate id | Ceiling |
|-------|--------------|---------|
| `veo-3.1-fast` (default) | `google/veo-3.1-fast` | $0.15/s |
| `seedance-2.0-fast` (default) | `bytedance/seedance-2.0-fast` | $0.17/s |
| `veo-3.1` | `google/veo-3.1` | $0.40/s |
| `seedance-2.0` | `bytedance/seedance-2.0` | not verified |
| `seedance-2.5` | `bytedance/seedance-2.5` | $0.97/s |
| `kling-v2.5-turbo-pro` | `kwaivgi/kling-v2.5-turbo-pro` | $0.07/s |

The default pair is both "fast" tiers from the two labs with the most-used video models, both in Genfeed's registry, so a default 4-second run costs roughly $1 at most. A raw Replicate id works too but is sent only `prompt`, `aspect_ratio` and `duration`; use `--model-input` if it needs more.

## Workflow

1. **Write one prompt that exposes a difference.** Motion, hands, text, physics, camera moves. The `motion-coherence` and `camera-instruction` tasks in genfeedai/benchmark `tasks/video/` are good starting prompts. Do not tune the prompt for one model.
2. **Dry-run** to confirm the pair and the cost ceiling.
3. **Run it.** Models generate in parallel; expect 30 seconds to 3 minutes. If any model fails (content filter, timeout) the run stops and says which, with the other clips kept in `clips/`; fix the prompt and run again with `--reuse`.
4. **Look at the output before posting.** Extract a frame (`ffmpeg -ss 2 -i out.mp4 -frames:v 1 f.png`) or open the file. Check the label order, the prompt text and that both clips play the full length.
5. **Post it.** X takes H.264 mp4 up to 140 seconds, so the output works as is. Square fills more of the feed; landscape suits a quote-post or a thread header.

## Honesty rules

- One generation per model per prompt. Say "one take each" in the post. Do not re-roll one model until it wins; if you re-roll, re-roll both and say so.
- Never relabel a clip as another model. The label comes from the model that produced the file, and `manifest.json` records the Replicate prediction id for each clip.
- This is a visual comparison, not a ranking. For scored, blind, repeatable results use genfeedai/benchmark.

## Output

- `<out>/<prompt-slug>-<canvas>.mp4`: the composite, 30 fps, H.264, yuv420p.
- `<out>/clips/<alias>.mp4` plus `<alias>.mp4.json`: the raw clip and its generation record (model id, input, prediction id, predict seconds).
- `<out>/manifest.json`: prompt, canvas, duration, blind key, audio source and every clip.

stdout is a JSON object with `output`, `seconds`, `size` and `manifest`.

## Security

- `REPLICATE_API_TOKEN` is read from the environment and used in memory only.
- The only outbound calls are to the Replicate API and the output URLs it returns. ffmpeg runs locally.
- Files are written only under `--out`.
