---
name: media-forge
description: Generate image, video, and audio artifacts through Replicate or fal.ai and emit downloaded MediaArtifact JSON.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Media Forge

You turn a prompt into a file. Image, video, or audio — through Replicate or fal.ai, the two aggregators that front nearly every open and commercial generative model. You are the media half of `produce` in `trend -> remix -> produce -> post -> analytic`.

Pure **worker**: no state, no SDK, no persisted secret. You read one token from the environment, submit a job, wait for it, download the outputs, and print `MediaArtifact` JSON. The orchestrator resolves the token (`gf token replicate|fal`), runs you, and attaches your artifacts to a `ContentItem` through the seam.

---

## Run It

```bash
bun run scripts/forge.ts \
  --provider replicate|fal \
  --modality image|video|audio \
  --model <model-id> \
  --prompt "..." \
  [--input '{"aspect_ratio":"16:9","num_outputs":2}'] \
  [--out .genfeed/artifacts]
```

Requires [Bun](https://bun.sh) 1.1+. Zero dependencies — only Node built-ins and global `fetch`.

`--input` is merged over `{prompt}` and passed verbatim as the model's input object, so any model-specific parameter is reachable without code changes.

---

## Providers

### Replicate

- Token: `REPLICATE_API_TOKEN`.
- Uses the unified `POST /v1/predictions` endpoint, which accepts `owner/name`, `owner/name:version`, or a bare version id as `--model`.
- Sends `Prefer: wait` for synchronous completion, then polls `urls.get` for anything still running.

```bash
bun run scripts/forge.ts --provider replicate --modality image \
  --model black-forest-labs/flux-1.1-pro --prompt "a t-rex on a skateboard, cinematic"
```

### fal.ai

- Token: `FAL_KEY`.
- Uses the async queue: `POST https://queue.fal.run/<model>`, polls the returned `status_url` until `COMPLETED`, then fetches `response_url`.

```bash
bun run scripts/forge.ts --provider fal --modality video \
  --model fal-ai/ltx-video --prompt "neon city flyover at night"
```

Both providers cap waiting at ~10 minutes (240 polls × 2.5s), enough for slow video jobs.

---

## Output

Outputs are downloaded into `--out` (default `.genfeed/artifacts`), one file per result, named `art_<uuid>.<ext>` (extension inferred from the URL, else `png`/`mp4`/`mp3` by modality). stdout is:

```json
{
  "count": 1,
  "artifacts": [
    {
      "id": "art_2f1c...",
      "modality": "image",
      "provider": "replicate",
      "model": "black-forest-labs/flux-1.1-pro",
      "prompt": "a t-rex on a skateboard, cinematic",
      "path": ".genfeed/artifacts/art_2f1c....png",
      "meta": { "sourceUrl": "https://...", "index": 0, "createdAt": "..." }
    }
  ]
}
```

Each `artifact` matches the `MediaArtifact` shape in `genfeed-connector/lib/schema.ts`, so the orchestrator can push it straight onto `ContentItem.artifacts[]`.

Output URLs are extracted by walking the provider's response JSON and collecting every `http(s)` URL, so it works across model output shapes (string, array, `{images:[{url}]}`, `{video:{url}}`, `{audio:{url}}`, …) without per-model branching.

---

## How It Fits The Loop

```bash
# orchestrator resolves a scoped token through the seam, never seeing the raw vault credential
export REPLICATE_API_TOKEN="$(bun run ../genfeed-connector/gf.ts token replicate)"

# forge a hero image for an item, capture artifacts
ART=$(bun run scripts/forge.ts --provider replicate --modality image \
  --model black-forest-labs/flux-1.1-pro --prompt "$THESIS")

# orchestrator merges $ART.artifacts into the ContentItem and advances the stage
```

---

## Security

- Tokens (`REPLICATE_API_TOKEN`, `FAL_KEY`) are read from the environment, used in memory, and **never written** to any file. Resolve them through the connector so the long-lived credential stays in the env or the genfeed vault.
- The only outbound calls are to the chosen provider's API and the output-file URLs it returns.
- Generated files are written only under `--out`; nothing else touches the filesystem.
