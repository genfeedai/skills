---
name: genfeed-connector
description: Expose the gf CLI for local content-loop state, manifests, stage transitions, feedback, and env-based platform tokens.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Genfeed Connector

You manage shared state for the Genfeed content factory. Every other loop skill (`trend-scout`, `media-forge`, `social-poster`, `analytics-collector`, `content-loop-orchestrator`) reads and advances content items through this one seam, so no worker has to own state, secrets, or a schedule.

---

## Core Principle: Skills Are Stateless Workers; The Seam Holds State

Loop skills are pure workers — read a job, do work, emit a result, exit. They hold no state, no secrets, and no schedule. Everything durable lives behind this seam:

| Concern | Where it lives |
|---------|----------------|
| Manifest state | `.genfeed/items/*.json` in the working directory |
| Generated media | `.genfeed/artifacts/` |
| Scheduling | manual, or the harness `/loop` |
| Platform tokens | environment variables only |
| Approval gate | ask in chat |

The connector has no network backend. It never calls the Genfeed API and does not issue tokens for accounts connected in Genfeed. To draft, schedule, or measure content inside a Genfeed workspace, use the Genfeed plugin (`plugins/genfeed/` in `genfeedai/skills`), which talks to Genfeed through its MCP server under its own confirmation gates. Hand it the approved copy from a content item.

---

## The Contract: Env Vars + stdin/stdout JSON

Loop skills never import this skill's TypeScript. The seam is invoked as a CLI and communicates only through:

- **stdin/stdout JSON** for manifest data
- **environment variables** for tokens (the connector resolves and exports a token; the worker reads it from env, uses it in memory, and never writes it back)

This keeps every skill independently installable — no cross-skill import paths to break.

---

## CLI Reference

Run with `bun run gf.ts <command>` (Bun 1.1+, zero dependencies — uses only Node built-ins).

```bash
bun run gf.ts create [--thesis "..."] [--stage selected] [--tags a,b] [< trend.json]
bun run gf.ts get <id>
bun run gf.ts list [--stage <stage>] [--tag <tag>] [--limit <n>]
bun run gf.ts save                              # full ContentItem JSON on stdin
bun run gf.ts transition <id> <stage> [--note "..."]
bun run gf.ts next <stage>                       # oldest item waiting in <stage>
bun run gf.ts record-metric <id>                 # Metric JSON on stdin
bun run gf.ts feedback <term>                    # prior-performance multiplier (loop closure)
bun run gf.ts token <platform>                   # resolve a token from the environment
```

All commands print JSON to stdout; errors print to stderr and exit non-zero.

---

## The Manifest (ContentItem)

One row tracks an item through the whole loop. Stages:

```
trend_candidate -> selected -> briefed -> remixed -> producing
  -> awaiting_approval -> approved -> scheduled -> posted -> measured -> archived | killed
```

Key fields: `trend` (the originating signal), `thesis` (flagship angle), `brief`, `derivatives[]` (per-platform copy + media refs + postId), `artifacts[]` (generated media), `metrics[]` (performance), `feedbackScore` (0..1, derived from metrics), `tags[]` (pillars + trend terms — how analytics attribute back to trends), and `history[]` (every stage transition).

See `lib/schema.ts` for the full type.

---

## Loop Closure

`feedback <term>` averages `feedbackScore` across all `measured` items tagged with that term and returns a 0..1 multiplier. `trend-scout` multiplies a fresh trend's raw score by `(1 + multiplier)`, so themes that performed before rise to the top of the next cycle. That is the `analytic -> repeat` edge of the loop, implemented in data.

---

## Security

- Tokens are **read** from the environment and **never written** to any file.
- `gf token <platform>` maps a platform to its env var (`x` → `X_BEARER_TOKEN`, `linkedin` → `LINKEDIN_ACCESS_TOKEN`, `replicate` → `REPLICATE_API_TOKEN`, `fal` → `FAL_KEY`, `newsapi` → `NEWSAPI_KEY`) and prints its value for capture by the calling skill.
- This skill never calls a content, social, model, or Genfeed API itself — it only resolves state and tokens. Outbound API calls live in the worker skills, under their own approval gates.

---

## How Other Skills Use It

```bash
# orchestrator picks the next job and hands it to a worker
JOB=$(bun run ../genfeed-connector/gf.ts next selected)

# worker emits a result; orchestrator advances the stage
bun run ../genfeed-connector/gf.ts transition "$ID" remixed --note "atomized to 6 platforms"

# poster resolves a token from the environment at the moment of use
export X_BEARER_TOKEN="$(bun run ../genfeed-connector/gf.ts token x)"
```

If `gf` is not resolvable as a sibling skill, a worker degrades to its own local `.genfeed/` directory using the same on-disk format.
