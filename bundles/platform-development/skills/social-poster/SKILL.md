---
name: social-poster
description: Publish approved X or LinkedIn derivatives with a dry-run-by-default approval gate.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Social Poster

You publish one finished derivative to a social platform — X or LinkedIn — and return its post id and URL. You are the `post` in `trend -> remix -> produce -> post -> analytic`.

Posting is **irreversible and public**, so this worker is built around a hard approval gate:

> **No `--confirm`, no network.** The default run is a dry run: it prints the exact request it *would* send (with the token masked) and exits without calling any API. Publishing happens only when the run is repeated with `--confirm`.

This lets the agent show the user precisely what will go out, get an explicit yes, and only then post. Pure worker: reads one token from the environment, persists nothing.

---

## Run It

```bash
# 1. dry run — inspect the payload, post nothing (default)
bun run scripts/post.ts --platform x --text "shipping the content loop, all skills"

# 2. publish for real, after approval
bun run scripts/post.ts --platform x --text "..." --confirm
bun run scripts/post.ts --platform linkedin --author urn:li:person:XXXX --text "..." --confirm
```

A `Derivative` JSON on stdin is an alternative to `--text` / `--media-ids`:

```bash
echo '{"platform":"x","copy":"gm","mediaRefs":["1799..."]}' \
  | bun run scripts/post.ts --platform x --confirm
```

Requires [Bun](https://bun.sh) 1.1+. Zero dependencies — only Node built-ins and global `fetch`.

---

## Flags

| Flag | Platform | Notes |
|------|----------|-------|
| `--platform` | both | `x` or `linkedin` (required) |
| `--text` | both | post body; or `.copy` from a stdin Derivative |
| `--media-ids` | x | comma-separated, already-uploaded media ids; or `.mediaRefs` |
| `--reply-to` | x | tweet id to reply to (thread chaining) |
| `--author` | linkedin | `urn:li:person:<id>` or `urn:li:organization:<id>` (or `LINKEDIN_AUTHOR_URN`) |
| `--visibility` | linkedin | `PUBLIC` (default) or `CONNECTIONS` |
| `--linkedin-version` | linkedin | `YYYYMM` API version (default `202505`, or `LINKEDIN_VERSION`) |
| `--confirm` | both | **actually publish** — without it, dry run only |

---

## Platforms

### X

- Endpoint: `POST https://api.x.com/2/tweets`.
- Auth: `Authorization: Bearer <token>` — an **OAuth 2.0 user-context** token with `tweet.write` (env `X_BEARER_TOKEN`).
- Body: `{ text, media: { media_ids }, reply: { in_reply_to_tweet_id } }`.
- Returns `data.id`; URL is `https://x.com/i/web/status/<id>`.
- Media upload is a separate, multi-step concern (v2 `/2/media/upload`, scope `media.write`); this worker takes already-uploaded `media_ids` so the upload/credential flow stays in the vault layer.

### LinkedIn

- Endpoint: `POST https://api.linkedin.com/rest/posts`.
- Auth: `Authorization: Bearer <token>` with `w_member_social` (env `LINKEDIN_ACCESS_TOKEN`); headers `LinkedIn-Version: YYYYMM` and `X-Restli-Protocol-Version: 2.0.0`.
- Body: `{ author, commentary, visibility, distribution, lifecycleState: "PUBLISHED" }`.
- Post id comes back in the `x-restli-id` response header; URL is `https://www.linkedin.com/feed/update/<urn>`.

---

## Output

Dry run:

```json
{ "dryRun": true, "platform": "x", "willPost": { "url": "...", "method": "POST", "headers": { "authorization": "Bearer ****1234" }, "body": { "text": "..." } }, "note": "No request sent. Re-run with --confirm to publish." }
```

Confirmed:

```json
{ "posted": true, "platform": "x", "postId": "1799...", "url": "https://x.com/i/web/status/1799..." }
```

The orchestrator records `postId` onto the matching `Derivative` and advances the item to `posted`, which is what `analytics-collector` later queries.

---

## How It Fits The Loop

```bash
# orchestrator resolves a scoped token through the seam (never sees the raw vault credential)
export X_BEARER_TOKEN="$(bun run ../genfeed-connector/gf.ts token x)"

# show the user exactly what will post...
bun run scripts/post.ts --platform x --text "$COPY"          # dry run
# ...then, on an explicit yes, publish and capture the id
bun run scripts/post.ts --platform x --text "$COPY" --confirm
```

When genfeed is connected, the approval gate is additionally backed by the genfeed approval UI; standalone, the agent asks in chat. Either way `--confirm` is the single switch between "show" and "send".

---

## Security

- Tokens (`X_BEARER_TOKEN`, `LINKEDIN_ACCESS_TOKEN`) are read from the environment, used in memory, and **never written** anywhere. The token is masked in dry-run output.
- The dry run performs **no network call** and **no token lookup** — it cannot accidentally publish.
- The only outbound calls are the publish requests, and only under `--confirm`.
- This worker never deletes or edits existing posts; it only creates new ones.
