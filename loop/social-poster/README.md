# Social Poster

The **post** stage of the Genfeed content loop. Publishes one approved post to [X](https://x.com), [LinkedIn](https://linkedin.com), Threads, Instagram, Facebook Pages, TikTok, YouTube, Pinterest or Mastodon with the platform's own OAuth access token and API. No model call, no credits, no SDK: Bun and the built-in fetch only.

Built around a **hard approval gate**: without `--confirm` it is a dry run that prints every request it would send, in order, with secrets masked, and makes **no network call**. Publishing happens only on an explicit second run with `--confirm`.

Pure stateless worker: reads its token from the environment, persists nothing.

## Installation

```bash
bunx skills add genfeedai/skills --skill social-poster
```

Requires [Bun](https://bun.sh) 1.1+. Zero runtime dependencies.

## Usage

```bash
# dry run (default): inspect every request, post nothing
bun run scripts/post.ts --platform instagram --account "$INSTAGRAM_USER_ID" \
  --media https://cdn.example.com/reel.mp4 --text "New drop"

# publish for real, after approval
bun run scripts/post.ts --platform instagram --account "$INSTAGRAM_USER_ID" \
  --media https://cdn.example.com/reel.mp4 --text "New drop" --confirm

# upload a local video to YouTube (private unless you say --privacy public)
bun run scripts/post.ts --platform youtube --media ./clip.mp4 --title "Launch day" --text "..." --confirm

# from a Derivative on stdin
echo '{"copy":"gm","mediaRefs":["1799..."]}' | bun run scripts/post.ts --platform x --confirm
```

## Platforms and tokens

| Platform | Token env var | Scope / token type | Media |
|----------|---------------|--------------------|-------|
| X | `X_BEARER_TOKEN` | OAuth 2.0 user context, `tweet.write` | uploaded media ids |
| LinkedIn | `LINKEDIN_ACCESS_TOKEN` | `w_member_social` | text only |
| Threads | `THREADS_ACCESS_TOKEN` | `threads_basic`, `threads_content_publish` | public URLs |
| Instagram | `INSTAGRAM_ACCESS_TOKEN` | `instagram_business_content_publish` (Instagram Login) | public URLs |
| Facebook Page | `FACEBOOK_PAGE_ACCESS_TOKEN` | Page token, `pages_manage_posts` | one photo URL |
| TikTok | `TIKTOK_ACCESS_TOKEN` | `video.publish` | local file or URL |
| YouTube | `YOUTUBE_ACCESS_TOKEN` | `youtube.upload` | local file |
| Pinterest | `PINTEREST_ACCESS_TOKEN` | pins write access | public image URLs |
| Mastodon | `MASTODON_ACCESS_TOKEN` + `MASTODON_BASE_URL` | `write:media`, `write:statuses` | local files |

Tokens are read from the environment, masked in output, never written to disk. Resolve through the connector (`gf token <platform>`). The full flag table, per-platform behaviour and limits are in [SKILL.md](./SKILL.md).

## Sources

Endpoints and field names were read from the official documentation:

- Threads: developers.facebook.com/docs/threads/posts
- Instagram: developers.facebook.com/docs/instagram-platform/content-publishing
- Facebook Pages: developers.facebook.com/docs/pages-api/posts
- TikTok: developers.tiktok.com/doc/content-posting-api-reference-direct-post and the media transfer guide
- YouTube: developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- Pinterest: the published v5 OpenAPI description
- Mastodon: docs.joinmastodon.org/methods/statuses and /methods/media

## Tests

```bash
bun test ./social-poster
```

The tests replay scripted API responses and check the exact request sequence and the result. They do not touch real accounts.

## License

MIT
