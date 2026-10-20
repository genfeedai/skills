# Genfeed Connector

The state seam for the Genfeed content-factory skills. It exposes one CLI (`gf`) for manifest state, stage transitions, performance feedback, and platform tokens, backed by the local filesystem (`.genfeed/`). It has no network backend and never calls the Genfeed API.

This is the foundation the other loop skills build on: `trend-scout`, `media-forge`, `social-poster`, `analytics-collector`, and `content-loop-orchestrator`.

## Installation

```bash
bunx skills add genfeedai/skills/genfeed-connector
```

Requires [Bun](https://bun.sh) 1.1+. Zero runtime dependencies (uses only Node built-ins).

## Usage

```bash
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

- **Uniform state API** — `create`, `get`, `list`, `save`, `transition`, `next`, `record-metric` over a single `ContentItem` manifest stored in `.genfeed/items/*.json`.
- **Loop closure** — `feedback <term>` turns past performance into a multiplier that re-ranks future trends.
- **Token resolution** — `token <platform>` reads the platform's env var (`X_BEARER_TOKEN`, `LINKEDIN_ACCESS_TOKEN`, `REPLICATE_API_TOKEN`, `FAL_KEY`, `NEWSAPI_KEY`). Secrets are never written to disk.
- **Stateless workers** — loop skills talk to this seam only through env vars and stdin/stdout JSON, so each one stays independently installable.

## Working With a Genfeed Workspace

The connector does not sync with genfeed.ai. To draft, schedule, or measure content inside a Genfeed workspace, use the [Genfeed plugin](https://github.com/genfeedai/skills/tree/master/plugins/genfeed), which connects to Genfeed through its MCP server and confirms before scheduling anything. Hand it the approved copy from a content item.

## License

MIT
