---
name: social-poster
description: Publish one approved post to X, LinkedIn, Threads, Instagram, Facebook, TikTok, YouTube, Pinterest or Mastodon with the platform's own OAuth token and API. Dry run by default; no model call, no credits. Triggers on "post this", "publish to instagram", "upload to youtube", "post to tiktok", "post to threads".
license: MIT
metadata:
  author: genfeedai
  version: 2.0.0
---

# Social Poster

You publish one finished derivative to one social platform and return its post id and URL. You are the `post` in `trend -> remix -> produce -> post -> analytic`.

Nine platforms are covered: X, LinkedIn, Threads, Instagram, Facebook Pages, TikTok, YouTube, Pinterest and Mastodon. Each one is called directly with the owner's own OAuth access token. No model runs and no Genfeed credits are spent.

Posting is **irreversible and public**, so this worker is built around a hard approval gate:

> **No `--confirm`, no network.** The default run is a dry run: it prints every request it *would* send, in order, with secrets masked, and exits without calling any API. Publishing happens only when the run is repeated with `--confirm`.

The agent shows the owner the dry run, gets an explicit yes, and only then re-runs with `--confirm`. Pure worker: reads tokens from the environment, persists nothing.

---

## Run It

```bash
# 1. dry run: inspect every request, post nothing (default)
bun run scripts/post.ts --platform threads --account "$THREADS_USER_ID" --text "shipping the content loop"

# 2. publish for real, after the owner approves
bun run scripts/post.ts --platform threads --account "$THREADS_USER_ID" --text "..." --confirm
```

A `Derivative` JSON on stdin is an alternative to `--text` and `--media`:

```bash
echo '{"platform":"instagram","copy":"New drop","mediaRefs":["https://cdn.example.com/reel.mp4"]}' \
  | bun run scripts/post.ts --platform instagram --account "$INSTAGRAM_USER_ID" --confirm
```

Requires [Bun](https://bun.sh) 1.1+. Zero dependencies: Bun, its global `fetch` and Node built-ins. Tests: `bun test ./social-poster`.

---

## Choose the platform

| Platform | `--platform` | Media | Token env var | Account id |
|----------|--------------|-------|---------------|------------|
| X | `x` | already-uploaded ids (`--media-ids`) | `X_BEARER_TOKEN` | none |
| LinkedIn | `linkedin` | none (text only) | `LINKEDIN_ACCESS_TOKEN` | `--author` / `LINKEDIN_AUTHOR_URN` |
| Threads | `threads` | public https URLs: image, video, carousel (2 to 20) | `THREADS_ACCESS_TOKEN` | `--account` / `THREADS_USER_ID` |
| Instagram | `instagram` | public https URLs: JPEG image, Reel, Story, carousel | `INSTAGRAM_ACCESS_TOKEN` | `--account` / `INSTAGRAM_USER_ID` |
| Facebook Page | `facebook` | one public https photo URL, or none | `FACEBOOK_PAGE_ACCESS_TOKEN` | `--account` / `FACEBOOK_PAGE_ID` |
| TikTok | `tiktok` | one local video file, or one https URL | `TIKTOK_ACCESS_TOKEN` | none |
| YouTube | `youtube` | one local video file | `YOUTUBE_ACCESS_TOKEN` | none (the token's channel) |
| Pinterest | `pinterest` | 1 to 5 public https image URLs | `PINTEREST_ACCESS_TOKEN` | `--account` / `PINTEREST_BOARD_ID` |
| Mastodon | `mastodon` | local files | `MASTODON_ACCESS_TOKEN` | instance: `MASTODON_BASE_URL` |

Media goes in `--media` as a comma-separated list (or `.mediaRefs` on a stdin Derivative).

- **Public URL platforms** (Threads, Instagram, Facebook, Pinterest, TikTok pull) fetch the file themselves, so a local path is rejected with a clear message. Host the file first: a CDN, or a Genfeed asset URL after `upload_media`.
- **Upload platforms** (TikTok file, YouTube, Mastodon) take a local path and stream it.

---

## Flags

| Flag | Platforms | Notes |
|------|-----------|-------|
| `--platform` | all | required |
| `--text` | all | post body, caption or description; or `.copy` from a stdin Derivative |
| `--media` | all but X, LinkedIn | comma-separated URLs or paths, see the table above |
| `--media-ids` | X | comma-separated uploaded media ids |
| `--reply-to` | X, Threads, Mastodon | id of the post to reply to |
| `--account` | Threads, Instagram, Facebook, Pinterest | user, page or board id (env var in the table works too) |
| `--author` | LinkedIn | `urn:li:person:<id>` or `urn:li:organization:<id>` |
| `--visibility` | LinkedIn, Mastodon | LinkedIn `PUBLIC` or `CONNECTIONS`; Mastodon `public`, `unlisted`, `private`, `direct` |
| `--ai-generated` | Threads, Instagram, TikTok, YouTube, Pinterest | set the platform's AI-content label (see below) |
| `--type` | Instagram | `image`, `reel`, `story`, `carousel`; inferred from the media when omitted |
| `--alt` | Instagram image, Pinterest, Mastodon | alt text |
| `--title` | YouTube, Pinterest | YouTube defaults to the first line of `--text` |
| `--link` | Facebook, Pinterest | link attached to the post |
| `--privacy` | YouTube, TikTok | YouTube `private` (default), `unlisted`, `public`; TikTok `self_only` (default), `friends`, `followers`, `public` |
| `--tags`, `--category-id`, `--made-for-kids` | YouTube | comma-separated tags; category id (default `22`); made-for-kids declaration (default false) |
| `--share-to-feed`, `--cover-url` | Instagram Reel | `true` or `false`; cover image URL |
| `--reply-control` | Threads | `everyone`, `accounts_you_follow`, `mentioned_only`, `parent_post_author_only`, `followers_only` |
| `--disable-comment`, `--disable-duet`, `--disable-stitch`, `--cover-ms`, `--paid-partnership`, `--promotes-own-business` | TikTok | per-post settings |
| `--spoiler-text`, `--sensitive`, `--language` | Mastodon | content warning, sensitive flag, ISO 639-1 code |
| `--poll-seconds`, `--poll-attempts` | Threads, Instagram, TikTok, Mastodon | status polling: seconds between checks (default 30), checks before giving up (default 10) |
| `--linkedin-version` | LinkedIn | `YYYYMM` API version (default `202505`, or `LINKEDIN_VERSION`) |
| `--confirm` | all | **actually publish**. Without it, dry run only |

---

## What each platform does

Endpoints below were read from each platform's official documentation on 2026-10-31. Sources are listed in the README.

### X

`POST https://api.x.com/2/tweets` with an OAuth 2.0 user-context token (`tweet.write`). Takes already-uploaded `media_ids`; media upload is a separate flow this worker does not do. URL: `https://x.com/i/web/status/<id>`.

### LinkedIn

`POST https://api.linkedin.com/rest/posts` with `w_member_social`, headers `LinkedIn-Version` and `X-Restli-Protocol-Version: 2.0.0`. The post id comes back in the `x-restli-id` header.

### Threads

Create a media container on `graph.threads.com/v1.0/{user}/threads`, wait for `FINISHED`, then `threads_publish`. Text posts are limited to 500 characters. Carousels are created from child containers (2 to 20). Scopes: `threads_basic`, `threads_content_publish`. Until the app passes review, it can only post for the app's Threads testers.

### Instagram

Create a container on `{host}/v26.0/{ig-user}/media`, wait for `status_code = FINISHED` on video, then `media_publish`. JPEG only for images. `--type reel` sets `media_type=REELS`, `--type story` sets `STORIES`. The host defaults to `graph.instagram.com` (Instagram API with Instagram Login); set `INSTAGRAM_GRAPH_HOST=https://graph.facebook.com` for a Facebook Page token. Needs a professional account; The documented limit is 100 API-published posts per 24 hours.

### Facebook

`POST /{page}/feed` for text and links, `POST /{page}/photos` for one photo (`caption`). Needs a Page access token with `pages_manage_posts`. **Video is not covered**: the Video API needs a resumable-upload handle from an app id and a user token, which this worker does not manage.

### TikTok

Content Posting API Direct Post: query creator info, initialise, upload the file in chunks (or let TikTok pull from a URL on a domain you verified in the developer portal), then poll the publish status. The privacy level must be one the creator account offers; the worker checks this before initialising. **Unaudited API clients can only post privately**, which is why `--privacy` defaults to `self_only`. Video only. A TikTok post id appears only after moderation; if it is not there yet, the result carries the publish id instead.

### YouTube

`videos.insert` through the resumable upload protocol: start a session, then `PUT` the file to the session URI. Needs an OAuth token with the `youtube.upload` scope. The API docs list a quota impact of 100 calls per day for `videos.insert`. `--privacy` defaults to `private`; say `--privacy public` explicitly. Thumbnails are not set here.

### Pinterest

`POST https://api.pinterest.com/v5/pins` with an image URL media source (or 2 to 5 images as a carousel pin). Title up to 100 characters, description up to 800, alt text up to 500. Pinterest video pins need a separate media upload and are not covered.

### Mastodon

Upload each file with `POST /api/v2/media` (multipart), wait while large media process (HTTP 202), then `POST /api/v1/statuses` with `media_ids[]`. The instance is `MASTODON_BASE_URL` and must be https. Token scopes: `write:media`, `write:statuses`.

---

## AI-generated content labels

Genfeed output is often AI-generated. Several platforms have an API field for disclosing it, and `--ai-generated` sets it:

| Platform | Field set |
|----------|-----------|
| Threads | `is_made_with_ai=true` |
| Instagram | `is_ai_generated=true` |
| TikTok | `is_aigc=true` |
| YouTube | `status.containsSyntheticMedia=true` |
| Pinterest | `ai_disclosures.values=["AI_MODIFIED"]` |

X, LinkedIn, Facebook and Mastodon have no such field in the APIs used here. Ask the owner whether a post needs the label and pass the flag when it does. Do not guess for them.

---

## Output

Dry run, one entry per request in the order a real run sends them:

```json
{
  "dryRun": true,
  "platform": "instagram",
  "willSend": [
    { "step": "create reel container", "method": "POST", "url": "https://graph.instagram.com/v26.0/123/media", "headers": { "authorization": "Bearer ****1234" }, "body": { "media_type": "REELS", "video_url": "https://cdn.example.com/reel.mp4" } },
    { "step": "check reel container status", "method": "GET", "url": "https://graph.instagram.com/v26.0/<container id>?fields=status_code" },
    { "step": "publish container", "method": "POST", "url": "https://graph.instagram.com/v26.0/123/media_publish", "body": { "creation_id": "<container id>" } }
  ],
  "note": "No request sent. Re-run with --confirm to publish."
}
```

Values in angle brackets are filled from earlier responses in a real run.

Confirmed:

```json
{ "posted": true, "platform": "instagram", "postId": "1799...", "url": "https://www.instagram.com/reel/abc/", "details": { "kind": "reel" } }
```

`url` is looked up after the post is live for Threads and Instagram. If that lookup fails the result still reports `posted: true` with no `url`. The orchestrator records `postId` onto the matching `Derivative` and advances the item to `posted`, which is what `analytics-collector` later queries.

---

## How It Fits The Loop

```bash
# orchestrator resolves the token from the environment through the seam
export THREADS_ACCESS_TOKEN="$(bun run ../genfeed-connector/gf.ts token threads)"

# show the owner exactly what will post...
bun run scripts/post.ts --platform threads --account "$THREADS_USER_ID" --text "$COPY"
# ...then, on an explicit yes, publish and capture the id
bun run scripts/post.ts --platform threads --account "$THREADS_USER_ID" --text "$COPY" --confirm
```

The agent asks for approval in chat. `--confirm` is the single switch between "show" and "send". One run posts to one platform; to cross-post, run once per platform and approve each.

---

## Security

- Tokens are read from the environment, used in memory and **never written** anywhere. Every token-like header, form field and query parameter is masked in dry-run output and in error messages.
- The dry run performs **no network call** and **no token lookup**. It cannot publish.
- A live run checks that every required token variable is set before the first request.
- The only outbound calls are the publish flow of the chosen platform, and only under `--confirm`.
- This worker never deletes or edits existing posts; it only creates new ones.
- Local files are read only from the paths the owner passes in `--media`.

## Known limits

- These publishers were tested against scripted API responses that follow the official docs, not against live accounts. The first live post on each platform should be one the owner is happy to delete.
- No retry or resume. If a YouTube or TikTok upload is interrupted, run again from the start.
- Threads and Instagram permalink lookups use the `permalink` field, which is best effort.
- Newsletter publishing (beehiiv and others) is not included.
