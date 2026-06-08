# Social Poster

The **post** stage of the Genfeed content loop. Publishes a single derivative to [X](https://x.com) or [LinkedIn](https://linkedin.com) over their REST APIs with global `fetch` — no SDK — and returns the post id and URL.

Built around a **hard approval gate**: without `--confirm` it is a dry run that prints the exact request it would send (token masked) and makes **no network call**. Publishing happens only on an explicit second run with `--confirm`.

Pure stateless worker: reads its token from the environment, persists nothing.

## Installation

```bash
npx skills add genfeedai/skills/social-poster
```

Requires [Bun](https://bun.sh) 1.1+. Zero runtime dependencies.

## Usage

```bash
# dry run (default) — inspect the payload, post nothing
bun run scripts/post.ts --platform x --text "shipping the content loop, all skills"

# publish for real, after approval
bun run scripts/post.ts --platform x --text "..." --confirm
bun run scripts/post.ts --platform linkedin --author urn:li:person:XXXX --text "..." --confirm

# from a Derivative on stdin
echo '{"copy":"gm","mediaRefs":["1799..."]}' | bun run scripts/post.ts --platform x --confirm
```

## Flags

| Flag | Platform | Notes |
|------|----------|-------|
| `--platform` | both | `x` or `linkedin` (required) |
| `--text` | both | post body (or `.copy` from a stdin Derivative) |
| `--media-ids` | x | comma-separated uploaded media ids (or `.mediaRefs`) |
| `--reply-to` | x | tweet id for thread chaining |
| `--author` | linkedin | `urn:li:person:<id>` / `urn:li:organization:<id>` (or `LINKEDIN_AUTHOR_URN`) |
| `--visibility` | linkedin | `PUBLIC` (default) or `CONNECTIONS` |
| `--linkedin-version` | linkedin | `YYYYMM` (default `202505`, or `LINKEDIN_VERSION`) |
| `--confirm` | both | **actually publish** — without it, dry run only |

## Tokens

| Platform | Env var | Scope |
|----------|---------|-------|
| X | `X_BEARER_TOKEN` | OAuth 2.0 user context, `tweet.write` |
| LinkedIn | `LINKEDIN_ACCESS_TOKEN` | `w_member_social` |

Read from the environment only, masked in output, never written to disk. Resolve through the connector (`gf token x` / `gf token linkedin`).

## Endpoints

- **X** — `POST https://api.x.com/2/tweets`, body `{ text, media:{media_ids}, reply }`; id from `data.id`.
- **LinkedIn** — `POST https://api.linkedin.com/rest/posts` with `LinkedIn-Version` + `X-Restli-Protocol-Version: 2.0.0`; id from the `x-restli-id` response header.

X media upload is a separate multi-step flow (v2 `/2/media/upload`, `media.write`); this worker accepts already-uploaded `media_ids` so the upload/credential flow stays in the vault layer.

## License

MIT
