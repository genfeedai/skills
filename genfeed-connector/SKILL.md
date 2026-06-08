---
name: genfeed-connector
description: The seam between content-factory skills and genfeed.ai. Detects whether genfeed is connected (API key / CLI / config), then exposes one uniform CLI (gf) for manifest state, stage transitions, performance feedback, and platform tokens. Runs fully standalone on the local filesystem, or routes state, the OAuth token vault, scheduling, and analytics to genfeed.ai when a key is present. Triggers on "content factory state", "genfeed connector", "is genfeed connected", "content manifest", "content loop state", "gf adapter".
license: MIT
metadata:
  author: genfeedai
  version: "1.0.0"
---

# Genfeed Connector

You manage shared state and capability detection for the Genfeed content factory. Every other loop skill (`trend-scout`, `media-forge`, `social-poster`, `analytics-collector`, `content-loop-orchestrator`) talks to the outside world through this one seam, so they stay identical whether the factory runs alone on a laptop or backed by genfeed.ai.

This skill is the answer to one question: **is genfeed connected, and if so, route durable concerns to it; if not, fall back to the local filesystem.**

---

## Core Principle: Skills Are Stateless Workers; The App Is The Control Plane

Loop skills are pure workers — read a job, do work, emit a result, exit. They hold no state, no secrets, and no schedule. Everything durable lives behind this seam:

| Concern | standalone backend | connected backend (genfeed.ai) |
|---------|--------------------|--------------------------------|
| Manifest state | `.genfeed/items/*.json` | genfeed content-items DB |
| Scheduling | manual / harness `/loop` | genfeed cron (always-on) |
| Platform tokens | env vars only | genfeed vault, short-lived, injected |
| Analytics callbacks | manual fetch | genfeed webhook receiver |
| Approval gate | ask in chat | genfeed approval UI |

The same `gf` commands work in both modes. A skill never knows or cares which backend is live.

---

## Detection Order

`gf detect` resolves the mode (first hit wins) and caches it to `.genfeed/ctx.json`:

1. `GENFEED_API_KEY` env set → **api**
2. `genfeed status` CLI exits 0 on PATH → **api**
3. `.genfeed/config.json` names an `apiKeyEnv` whose env var is set → **api**
4. otherwise → **standalone**

`ctx.json` never stores a secret value — only the **name** of the env var holding the key. The key itself stays in the environment or the genfeed CLI keychain.

This gives the "independent but upgradeable" property: the skills work for anyone with no genfeed account, and light up persistence + always-on scheduling + a managed token vault the moment a key is present.

---

## The Contract: Env Vars + stdin/stdout JSON

Loop skills never import this skill's TypeScript. The seam is invoked as a CLI and communicates only through:

- **stdin/stdout JSON** for manifest data
- **environment variables** for tokens (the connector resolves and exports a token; the worker reads it from env, uses it in memory, and never writes it back)

This keeps every skill independently installable — no cross-skill import paths to break.

---

## CLI Reference

Run with `bun run gf.ts <command>` (Bun 1.1+, zero dependencies — uses only Node built-ins and global `fetch`).

```bash
bun run gf.ts detect [--mode standalone|api]   # resolve + cache runtime context
bun run gf.ts create [--thesis "..."] [--stage selected] [--tags a,b] [< trend.json]
bun run gf.ts get <id>
bun run gf.ts list [--stage <stage>] [--tag <tag>] [--limit <n>]
bun run gf.ts save                              # full ContentItem JSON on stdin
bun run gf.ts transition <id> <stage> [--note "..."]
bun run gf.ts next <stage>                       # oldest item waiting in <stage>
bun run gf.ts record-metric <id>                 # Metric JSON on stdin
bun run gf.ts feedback <term>                    # prior-performance multiplier (loop closure)
bun run gf.ts token <platform>                   # resolve a token (env or vault)
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

- Standalone tokens are **read** from the environment and **never written** to any file.
- Connected tokens are issued short-lived and scoped by genfeed.ai, used in memory, and never persisted by the connector.
- `ctx.json` and `config.json` store only the **name** of the key's env var, never its value.
- This skill never calls a content/social/model API itself — it only resolves state and tokens. Outbound API calls live in the worker skills, under their own approval gates.

---

## How Other Skills Use It

```bash
# orchestrator picks the next job and hands it to a worker
JOB=$(bun run ../genfeed-connector/gf.ts next selected)

# worker emits a result; orchestrator advances the stage
bun run ../genfeed-connector/gf.ts transition "$ID" remixed --note "atomized to 6 platforms"

# poster resolves a token without ever seeing the long-lived credential
export X_BEARER_TOKEN="$(bun run ../genfeed-connector/gf.ts token x)"
```

If `gf` is not resolvable as a sibling skill, a worker degrades to its own local `.genfeed/` directory using the same on-disk format.
