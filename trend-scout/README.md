# Trend Scout

The **sense** stage of the Genfeed content loop. Pulls what's trending from public, mostly key-free sources, scores every hit on one comparable `0..1` axis, dedupes across sources, and prints a ranked list of trend candidates as JSON.

Pure stateless worker: no state, no secrets, stdin/stdout only — so it stays independently installable and feeds cleanly into `genfeed-connector`, `content-loop-orchestrator`, and the rest of the factory.

## Installation

```bash
bunx skills add genfeedai/skills/trend-scout
```

Requires [Bun](https://bun.sh) 1.1+. Zero runtime dependencies (only Node built-ins and global `fetch`).

## Usage

```bash
# default sources: Hacker News + Google Trends + Reddit
bun run scripts/scout.ts --limit 10

# AI-focused scan across more sources
bun run scripts/scout.ts \
  --sources hn,gtrends,reddit,rss \
  --subreddits MachineLearning,LocalLLaMA \
  --rss https://hnrss.org/frontpage \
  --query "ai" --limit 15

# optional NewsAPI source (needs NEWSAPI_KEY in the environment)
NEWSAPI_KEY=... bun run scripts/scout.ts --sources newsapi --query "startups"
```

## Sources

| Source | Flag | Key | Endpoint |
|--------|------|-----|----------|
| Hacker News | `hn` | — | HN Algolia front page |
| Google Trends | `gtrends` | — | trending RSS (`--geo`) |
| Reddit | `reddit` | — | `r/<sub>/hot.json` (`--subreddits`) |
| RSS/Atom | `rss` | — | any feed (`--rss`) |
| NewsAPI | `newsapi` | `NEWSAPI_KEY` | top headlines (`--query`) |

A failing source warns to stderr and is skipped; the run still returns the rest.

## Scoring

- Each hit scores `0..1` by descending rank **within its own source**, normalizing different volume scales onto one axis.
- A term seen from 2+ sources is boosted `+0.1` (capped at 1.0) and its volumes summed — cross-source agreement is signal.
- Dedup is by normalized term (lowercased, alphanumeric, first 80 chars).

## Output

```json
{
  "capturedAt": "2026-06-08T00:00:00.000Z",
  "sources": ["hn", "gtrends", "reddit"],
  "count": 20,
  "signals": [
    { "source": "hackernews", "term": "...", "score": 1, "volume": 1097, "url": "...", "capturedAt": "..." }
  ]
}
```

Each `signal` is a `TrendSignal`, ready to pipe straight into `gf create`.

## License

MIT
