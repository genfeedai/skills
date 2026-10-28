---
name: video-model-benchmark
description: Run one prompt through two or three AI video models and merge the 9:16 clips into one side-by-side video for X, labelled with model names and the shared prompt. Triggers on "compare video models", "side by side video", "video model benchmark", "veo vs seedance", "which video model is better", "model shootout video".
license: MIT
metadata:
  author: genfeedai
  version: 1.1.0
---

# Video Model Benchmark

You turn one prompt into a side-by-side comparison video. Each model generates the same prompt as a 9:16 clip; the clips are composited into one square or landscape video that plays in sync, each panel labelled with its model name, the shared prompt shown. The output is made to post on X.

It sells the output, not the tooling: the viewer sees two results from one prompt and judges for themselves.

## Run It

```bash
# default pair, square 1080x1080, 4 seconds, no audio
bun run scripts/compare.ts --prompt "A courier carries four flat boxes past a lamp post, handheld, daylight"

# feed-ready stack: two 16:9 clips one above the other (1080x1216), brand badge top-right of each,
# plus post.md with the copy and the prompt to paste under the video
bun run scripts/compare.ts --preset fit-woman --canvas stacked

# landscape 1920x1080 with the prompt in a left column, branded footer
bun run scripts/compare.ts --prompt "..." --canvas landscape --footer "genfeed.ai"

# check the plan and the cost ceiling without spending anything
bun run scripts/compare.ts --prompt "..." --dry-run
```

Requires [Bun](https://bun.sh) 1.1+, `ffmpeg` and `ffprobe` on PATH, and `REPLICATE_API_TOKEN` in the environment (read from env only, never written to disk). Zero npm dependencies.

## Flags

| Flag | Default | Notes |
|------|---------|-------|
| `--preset` | none | A ready-made prompt: `motion-coherence`, `fit-woman`, `camera-orbit`, `camera-crane`, `camera-pushin`, `dbz-fight`. `--list-presets` prints them. `--prompt` overrides the text. |
| `--prompt` | required unless `--preset` | Shared by every model, shown on the video. Keep it under ~140 characters for the square canvas (three lines max, then truncated with an ellipsis). |
| `--models` | `veo-3.1-fast,seedance-2.0-fast` | Two or three aliases from the table below, or any `owner/name` Replicate id. |
| `--canvas` | `square` | `square` is 1080x1080, 9:16 panels, prompt on top. `landscape` is 1920x1080, 9:16 panels, prompt in a left column (two models) or on top (three). `stacked` is 1080x1216, two 16:9 panels one above the other, a brand badge and model name in each panel's top-right corner, no prompt on the video (it goes in `post.md`); exactly two models. |
| `--look-for` | preset's line | One sentence on what to compare, for the post copy. |
| `--brand` | `GENFEED` | Text of the top tag in each stacked-canvas badge. |
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

1. **Pick one prompt that exposes a difference.** The presets cover the catchy cases: `fit-woman` (people and skin), `camera-orbit`, `camera-crane` and `camera-pushin` (camera moves), `dbz-fight` (anime effects and speed), `motion-coherence` (objects and physics). All subjects are fictional or generic. Do not tune the prompt for one model. Do not use real people's names or likenesses: most models refuse them, and a post of real people fighting or posing is a reputation risk.
2. **Dry-run** to confirm the pair and the cost ceiling.
3. **Run it.** Models generate in parallel; expect 30 seconds to 3 minutes. If any model fails (content filter, timeout) the run stops and says which, with the other clips kept in `clips/`; fix the prompt and run again with `--reuse`.
4. **Look at the output before posting.** Extract a frame (`ffmpeg -ss 2 -i out.mp4 -frames:v 1 f.png`) or open the file. Check the label order, the prompt text and that both clips play the full length.
5. **Post it.** X takes H.264 mp4 up to 140 seconds, so the output works as is. `stacked` is the feed-friendly shape (1080x1216); square also fills the feed; landscape suits a quote-post or a thread header. Paste `post.md` as the tweet text.

Length: Veo takes 4, 6 or 8 seconds and the video is trimmed to the shortest clip, so a comparison that includes Veo tops out at 8 seconds. Clips are silent unless you pass `--audio`.

## Honesty rules

- One generation per model per prompt. Say "one take each" in the post. Do not re-roll one model until it wins; if you re-roll, re-roll both and say so.
- Never relabel a clip as another model. The label comes from the model that produced the file, and `manifest.json` records the Replicate prediction id for each clip.
- This is a visual comparison, not a ranking. For scored, blind, repeatable results use genfeedai/benchmark.

## Output

- `<out>/<prompt-slug>-<canvas>.mp4`: the composite, 30 fps, H.264, yuv420p.
- `<out>/clips/<alias>.mp4` plus `<alias>.mp4.json`: the raw clip and its generation record (model id, input, prediction id, predict seconds).
- `<out>/post.md`: the copy to paste with the video (headline, the prompt, "one take each", brand).
- `<out>/manifest.json`: prompt, canvas, duration, blind key, audio source and every clip.

stdout is a JSON object with `output`, `seconds`, `size` and `manifest`.

## Security

- `REPLICATE_API_TOKEN` is read from the environment and used in memory only.
- The only outbound calls are to the Replicate API and the output URLs it returns. ffmpeg runs locally.
- Files are written only under `--out`.
