# Media Forge

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Generate image, video, and audio artifacts through Replicate or fal.ai and emit downloaded MediaArtifact JSON

## Installation

```bash
bunx skills add genfeedai/skills --skill media-forge
```
<!-- generated:end -->

The media half of the **produce** stage. Generates image, video, and audio through [Replicate](https://replicate.com) or [fal.ai](https://fal.ai) using only global `fetch` — no vendor SDK — downloads every output file, and emits one `MediaArtifact` JSON per file.

Pure stateless worker: reads its token from the environment, persists nothing, and feeds artifacts to `genfeed-connector` and `content-loop-orchestrator`.

## Usage

```bash
# image via Replicate (REPLICATE_API_TOKEN)
bun run scripts/forge.ts --provider replicate --modality image \
  --model black-forest-labs/flux-1.1-pro --prompt "a t-rex on a skateboard, cinematic"

# video via fal.ai (FAL_KEY)
bun run scripts/forge.ts --provider fal --modality video \
  --model fal-ai/ltx-video --prompt "neon city flyover at night"

# audio with extra model inputs
bun run scripts/forge.ts --provider replicate --modality audio \
  --model minimax/speech-02-hd --prompt "Welcome to the show" \
  --input '{"voice_id":"Friendly_Person"}'
```

## Flags

| Flag | Required | Default | Notes |
|------|----------|---------|-------|
| `--provider` | yes | — | `replicate` or `fal` |
| `--modality` | — | `image` | `image`, `video`, `audio` (sets default extension) |
| `--model` | yes | — | provider model id |
| `--prompt` | — | — | merged into the model input as `prompt` |
| `--input` | — | — | JSON object merged over `{prompt}` for model-specific params |
| `--out` | — | `.genfeed/artifacts` | download directory |

## Tokens

| Provider | Env var |
|----------|---------|
| Replicate | `REPLICATE_API_TOKEN` |
| fal.ai | `FAL_KEY` |

Read from the environment only, used in memory, never written to disk. Resolve them through the connector (`gf token replicate` / `gf token fal`), which reads the same env vars.

## Output

JSON to stdout — `{ count, artifacts: MediaArtifact[] }` — with each file downloaded under `--out` as `art_<uuid>.<ext>`. The shape matches `genfeed-connector/lib/schema.ts` so artifacts attach directly to a `ContentItem`.

## License

MIT
