---
name: trend-scout
description: Collect and rank trend signals from public sources for the Genfeed content loop.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Trend Scout

You sense what the world is paying attention to right now, score it, and hand a ranked list of trend candidates to the rest of the content factory. You are the `trend` in `trend -> remix -> post -> analytic -> repeat`.

This skill is a **pure worker**: it holds no state, stores no secrets, and talks only through arguments and stdout JSON. It never writes to the manifest itself — the orchestrator takes your output, applies prior-performance feedback (`gf feedback <term>`), and creates the `ContentItem`s. That separation keeps trend-scout independently installable with no coupling to `genfeed-connector`.

---

## Run It

```bash
bun run scripts/scout.ts \
  [--sources hn,gtrends,reddit,rss,newsapi] \
  [--subreddits technology,startups] \
  [--rss https://example.com/feed.xml,https://...] \
  [--geo US] \
  [--query "ai agents"] \
  [--limit 20]
```

Requires [Bun](https://bun.sh) 1.1+. Zero dependencies — only Node built-ins and global `fetch`.

Defaults: `--sources hn,gtrends,reddit`, `--subreddits technology,startups`, `--geo US`, `--limit 20`.

---

## Sources

| Source | Flag value | Key required | Notes |
|--------|-----------|--------------|-------|
| Hacker News | `hn` | none | HN Algolia front-page API |
| Google Trends | `gtrends` | none | daily trending RSS, per `--geo` |
| Reddit | `reddit` | none | `r/<sub>/hot.json`, per `--subreddits` |
| Generic RSS/Atom | `rss` | none | any feeds passed via `--rss` |
| NewsAPI | `newsapi` | `NEWSAPI_KEY` | optional; top headlines, filtered by `--query` |

Every source is fetched concurrently. A source that fails (rate limit, network, bad feed) logs a warning to stderr and is skipped — the run still returns whatever the other sources produced.

---

## Scoring

Each hit gets a `score` in `0..1`, assigned by **descending rank within its own source** (top item = ~1.0, last = ~1/n). This normalizes wildly different volume scales (HN points vs Reddit upvotes vs feed order) onto one comparable axis.

When the same term surfaces from **two or more sources**, that cross-source agreement is itself a signal: the merged entry takes the higher base score and is nudged up by `+0.1` (capped at 1.0), with volumes summed. Dedup is by normalized term (lowercased, alphanumerics only, first 80 chars).

---

## Output

A single JSON object on stdout:

```json
{
  "capturedAt": "2026-06-08T00:00:00.000Z",
  "sources": ["hn", "gtrends", "reddit"],
  "count": 20,
  "signals": [
    {
      "source": "hackernews",
      "term": "Dopamine Fracking",
      "score": 1,
      "volume": 1097,
      "url": "https://news.ycombinator.com/item?id=...",
      "capturedAt": "2026-06-08T00:00:00.000Z"
    }
  ]
}
```

Each `signal` matches the `TrendSignal` shape consumed by `genfeed-connector` (`gf create` reads one on stdin), so the handoff is copy-free.

---

## How It Fits The Loop

```bash
# 1. scout trends
bun run scripts/scout.ts --sources hn,gtrends --limit 10 > trends.json

# 2. orchestrator re-ranks each by prior performance, then creates items
#    (feedbackForTerm closes the analytic -> repeat edge)
jq -c '.signals[]' trends.json | while read -r sig; do
  echo "$sig" | bun run ../genfeed-connector/gf.ts create --stage selected
done
```

trend-scout finds and scores; the connector remembers and re-ranks; the orchestrator decides. Keeping those three concerns in separate skills is what lets the factory run standalone or backed by genfeed.ai without changing this worker.

---

## Security

- Only `NEWSAPI_KEY` is ever read, and only when `newsapi` is in `--sources`. It is read from the environment, used in memory, and never written anywhere.
- All other sources are public and unauthenticated.
- A descriptive `user-agent` (`genfeed-trend-scout/1.0`) is sent so the public endpoints can identify and rate-limit politely.
- No outbound calls other than the named source endpoints; no manifest or filesystem writes.
