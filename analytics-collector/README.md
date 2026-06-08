# Analytics Collector

The **analytic** stage of the Genfeed content loop. Given the ids of posts that went out, pulls their engagement from [X](https://x.com) and [LinkedIn](https://linkedin.com) over their REST APIs (global `fetch`, no SDK) and normalizes each to one `Metric`.

This is **where the loop closes**: piping each `Metric` into `gf record-metric` recomputes the item's `feedbackScore`, and `gf feedback <term>` turns that into a multiplier that re-ranks the next round of trends.

Pure stateless worker: reads its token from the environment, persists nothing.

## Installation

```bash
npx skills add genfeedai/skills/analytics-collector
```

Requires [Bun](https://bun.sh) 1.1+. Zero runtime dependencies.

## Usage

```bash
# by explicit ids
bun run scripts/collect.ts --platform x --ids 1799111,1799222
bun run scripts/collect.ts --platform linkedin --ids "urn:li:share:6844785523593134080"

# from a ContentItem on stdin (collects every derivative with a postId)
bun run ../genfeed-connector/gf.ts get <id> | bun run scripts/collect.ts --platform x
```

## Tokens

| Platform | Env var | Notes |
|----------|---------|-------|
| X | `X_BEARER_TOKEN` | user context for `organic_metrics`/impressions; falls back to `public_metrics` |
| LinkedIn | `LINKEDIN_ACCESS_TOKEN` | `socialActions` for likes + comments |

Read from the environment only, used in memory, never written to disk. Resolve through the connector (`gf token x` / `gf token linkedin`).

## Metric Mapping

| Field | X | LinkedIn |
|-------|---|----------|
| `impressions` | `impression_count` (organic) | — |
| `likes` | `like_count` | `likesSummary.totalLikes` |
| `comments` | `reply_count` | `commentsSummary.aggregatedTotalComments` |
| `shares` | `retweet_count + quote_count` | — |
| `clicks` | `url_link_clicks` (organic) | — |

## Output

```json
{ "count": 1, "metrics": [ { "platform": "x", "postId": "1799111", "impressions": 10400, "likes": 612, "comments": 41, "shares": 88, "clicks": 230, "capturedAt": "..." } ] }
```

Each `metric` matches `genfeed-connector/lib/schema.ts`, ready to pipe into `gf record-metric <id>`.

## License

MIT
