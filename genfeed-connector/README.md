# Genfeed Connector

The seam between content-factory skills and genfeed.ai. Detects whether genfeed is connected, then exposes one uniform CLI (`gf`) for manifest state, stage transitions, performance feedback, and platform tokens. Runs fully standalone on the local filesystem, or routes durable concerns — state, the OAuth token vault, scheduling, and analytics — to genfeed.ai when an API key is present.

This is the foundation the other loop skills build on: `trend-scout`, `media-forge`, `social-poster`, `analytics-collector`, and `content-loop-orchestrator`.

## Installation

```bash
npx skills add genfeedai/skills/genfeed-connector
```

Requires [Bun](https://bun.sh) 1.1+. Zero runtime dependencies (uses only Node built-ins and global `fetch`).

## Usage

```bash
# Is genfeed connected? (caches result to .genfeed/ctx.json)
bun run gf.ts detect

# Create a content item from a trend signal
echo '{"source":"hackernews","term":"ai agents","score":0.9,"capturedAt":"2026-06-08T00:00:00Z"}' \
  | bun run gf.ts create --thesis "Agents eat SaaS" --stage selected

# Advance it through the loop
bun run gf.ts transition <id> remixed --note "atomized to 6 platforms"

# Record performance and close the loop
echo '{"platform":"x","postId":"177","impressions":10000,"likes":600,"capturedAt":"2026-06-08T12:00:00Z"}' \
  | bun run gf.ts record-metric <id>
bun run gf.ts feedback "ai agents"   # -> { "term": "ai agents", "multiplier": 0.74 }
```

## What It Does

- **Detects mode** — `GENFEED_API_KEY` env, a healthy `genfeed` CLI, or a config file flips the factory from `standalone` to `api`; otherwise it stays local.
- **Uniform state API** — `create`, `get`, `list`, `save`, `transition`, `next`, `record-metric` over a single `ContentItem` manifest, identical in both modes.
- **Loop closure** — `feedback <term>` turns past performance into a multiplier that re-ranks future trends.
- **Token resolution** — env vars in standalone; short-lived, scoped tokens from the genfeed vault when connected. Secrets are never written to disk.
- **Stateless workers** — loop skills talk to this seam only through env vars and stdin/stdout JSON, so each one stays independently installable.

## Modes

| Concern | standalone | connected (genfeed.ai) |
|---------|------------|------------------------|
| Manifest state | `.genfeed/items/*.json` | content-items DB |
| Scheduling | manual / `/loop` | genfeed cron (always-on) |
| Tokens | env vars | vault, short-lived, injected |
| Analytics | manual fetch | webhook receiver |
| Approval | chat prompt | genfeed UI |

## License

MIT
