---
name: analytics-collector
description: The analytic stage of the content loop. Pulls performance for already-posted items from X and LinkedIn over their REST APIs (global fetch, no SDK), normalizes each to a Metric, and prints them as JSON. Pure stateless worker that reads its token from the environment and persists nothing. Piping each Metric into `gf record-metric` recomputes feedbackScore, which re-ranks the next round of trends — this is where the loop closes. Triggers on "collect analytics", "post metrics", "engagement stats", "how did the post do", "analytics collector", "measure performance".
license: MIT
metadata:
  author: genfeedai
  version: "1.0.0"
---

# Analytics Collector

You measure what happened after publishing. Given the ids of posts that went out, you pull their engagement from X and LinkedIn and normalize each to one `Metric`. You are the `analytic` in `trend -> remix -> produce -> post -> analytic -> repeat`.

This is **where the loop closes**. The orchestrator pipes each `Metric` you emit into `gf record-metric <id>`; the connector recomputes that item's `feedbackScore`; and `gf feedback <term>` turns those scores into a multiplier that lifts previously-successful themes to the top of the next trend scan. You produce the raw measurement that makes the factory learn.

Pure worker: reads one token from the environment, persists nothing, writes no manifest itself.

---

## Run It

```bash
bun run scripts/collect.ts --platform x --ids 1799111,1799222
bun run scripts/collect.ts --platform linkedin --ids "urn:li:share:6844785523593134080"
```

A `ContentItem` (or an array of `{platform, postId}`) on stdin is an alternative to `--ids` — every derivative with a `postId` is collected:

```bash
bun run ../genfeed-connector/gf.ts get <id> \
  | bun run scripts/collect.ts --platform x
```

Requires [Bun](https://bun.sh) 1.1+. Zero dependencies — only Node built-ins and global `fetch`.

---

## Platforms

### X

- Endpoint: `GET https://api.x.com/2/tweets?ids=...&tweet.fields=public_metrics,organic_metrics,non_public_metrics`.
- `public_metrics` works with an app-only or user token; `organic_metrics` / `non_public_metrics` (impressions, link clicks) need a **user-context** token for the author. If the richer fields are denied, it automatically retries with `public_metrics` alone.
- Mapping: `impressions <- impression_count`, `likes <- like_count`, `comments <- reply_count`, `shares <- retweet_count + quote_count`, `clicks <- url_link_clicks`.

### LinkedIn

- Endpoint: `GET https://api.linkedin.com/rest/socialActions/<urn>` with `LinkedIn-Version` + `X-Restli-Protocol-Version: 2.0.0`.
- Mapping: `likes <- likesSummary.totalLikes`, `comments <- commentsSummary.aggregatedTotalComments`.
- Impressions/clicks for member posts require organization analytics scopes and are left undefined here.

Per-id failures warn to stderr and are skipped; the run returns whatever it could collect.

---

## Output

```json
{
  "count": 1,
  "metrics": [
    {
      "platform": "x",
      "postId": "1799111",
      "impressions": 10400,
      "likes": 612,
      "comments": 41,
      "shares": 88,
      "clicks": 230,
      "capturedAt": "2026-06-08T12:00:00.000Z"
    }
  ]
}
```

Each `metric` matches the `Metric` shape in `genfeed-connector/lib/schema.ts`.

---

## How It Closes The Loop

```bash
export X_BEARER_TOKEN="$(bun run ../genfeed-connector/gf.ts token x)"

# 1. measure
bun run scripts/collect.ts --platform x --ids "$POST_ID" > metrics.json

# 2. record each metric — this recomputes feedbackScore on the item
jq -c '.metrics[]' metrics.json | while read -r m; do
  bun run ../genfeed-connector/gf.ts record-metric "$ITEM_ID" <<<"$m"
done

# 3. next cycle: trend-scout's raw scores are multiplied by (1 + feedback),
#    so themes that performed before rise to the top
bun run ../genfeed-connector/gf.ts feedback "ai agents"   # -> { "term": "ai agents", "multiplier": 0.74 }
```

`collect` measures, the connector remembers, `trend-scout` re-ranks. That three-skill cycle is the locked loop.

---

## Security

- Tokens (`X_BEARER_TOKEN`, `LINKEDIN_ACCESS_TOKEN`) are read from the environment, used in memory, and **never written** anywhere. Resolve them through the connector.
- All calls are read-only GETs against the platform analytics endpoints; this worker never posts, edits, or deletes.
