#!/usr/bin/env bun
// social-poster — the post stage of the content loop.
//
// Publishes a single derivative to X or LinkedIn over their REST APIs with global
// fetch (no SDK). Pure worker: reads its token from the environment, persists
// nothing, and ENFORCES AN APPROVAL GATE — without --confirm it is a dry run that
// prints the exact request it *would* send and makes no network call. The
// orchestrator (or the agent, after the user approves) re-runs with --confirm.
//
//   # dry run (default): show the payload, post nothing
//   bun run post.ts --platform x --text "shipping the content loop, all skills"
//
//   # publish for real (explicit, irreversible)
//   bun run post.ts --platform x --text "..." --confirm
//   bun run post.ts --platform linkedin --author urn:li:person:XXXX --text "..." --confirm
//
// A Derivative JSON on stdin is an alternative to --text/--media-ids:
//   echo '{"platform":"x","copy":"gm","mediaRefs":["123"]}' | bun run post.ts --platform x --confirm
//
// Tokens (env only, never written): X_BEARER_TOKEN (OAuth2 user context, tweet.write)
// | LINKEDIN_ACCESS_TOKEN (w_member_social). Resolve via `gf token x|linkedin`.

type Platform = 'x' | 'linkedin';

interface Derivative {
  platform?: string;
  format?: string;
  copy?: string;
  mediaRefs?: string[];
}

interface PostResult {
  posted: boolean;
  platform: Platform;
  postId?: string;
  url?: string;
}

const DEFAULT_LINKEDIN_VERSION = '202505';

function parseFlags(argv: string[]): { flags: Record<string, string>; bools: Set<string> } {
  const flags: Record<string, string> = {};
  const bools = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      bools.add(key);
      flags[key] = 'true';
    }
  }
  return { flags, bools };
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').trim();
}

function out(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string): never {
  process.stderr.write(`social-poster: ${message}\n`);
  process.exit(1);
}

/** "Bearer ****1234" — enough to tell which token without leaking it. */
function maskAuth(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = { ...headers };
  if (masked.authorization) {
    const [scheme, ...rest] = masked.authorization.split(' ');
    const cred = rest.join(' ');
    masked.authorization = cred ? `${scheme} ****${cred.slice(-4)}` : `${scheme} (unset)`;
  }
  return masked;
}

interface BuiltRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: Record<string, unknown>;
  tokenEnv: string;
}

function buildX(text: string, mediaIds: string[], replyTo: string | undefined): BuiltRequest {
  const token = process.env.X_BEARER_TOKEN ?? '';
  const body: Record<string, unknown> = { text };
  if (mediaIds.length) body.media = { media_ids: mediaIds };
  if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo };
  return {
    url: 'https://api.x.com/2/tweets',
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body,
    tokenEnv: 'X_BEARER_TOKEN',
  };
}

function buildLinkedIn(
  text: string,
  author: string,
  visibility: string,
  version: string
): BuiltRequest {
  const token = process.env.LINKEDIN_ACCESS_TOKEN ?? '';
  return {
    url: 'https://api.linkedin.com/rest/posts',
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'linkedin-version': version,
      'x-restli-protocol-version': '2.0.0',
    },
    body: {
      author,
      commentary: text,
      visibility,
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    },
    tokenEnv: 'LINKEDIN_ACCESS_TOKEN',
  };
}

async function sendX(req: BuiltRequest): Promise<PostResult> {
  const res = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`x post ${res.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text) as { data?: { id?: string } };
  const id = data.data?.id;
  return {
    posted: true,
    platform: 'x',
    postId: id,
    url: id ? `https://x.com/i/web/status/${id}` : undefined,
  };
}

async function sendLinkedIn(req: BuiltRequest): Promise<PostResult> {
  const res = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`linkedin post ${res.status}: ${text.slice(0, 400)}`);
  const id = res.headers.get('x-restli-id') ?? undefined;
  return {
    posted: true,
    platform: 'linkedin',
    postId: id,
    url: id ? `https://www.linkedin.com/feed/update/${id}` : undefined,
  };
}

async function main(): Promise<void> {
  const { flags, bools } = parseFlags(process.argv.slice(2));
  const platform = flags.platform as Platform;
  if (platform !== 'x' && platform !== 'linkedin') fail('--platform must be x or linkedin');

  const stdin = await readStdin();
  const derivative = stdin ? (JSON.parse(stdin) as Derivative) : undefined;

  const text = flags.text ?? derivative?.copy ?? '';
  if (!text.trim()) fail('no text to post (pass --text or a Derivative with .copy on stdin)');

  const mediaIds = flags['media-ids']
    ? flags['media-ids']
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : (derivative?.mediaRefs ?? []);

  let req: BuiltRequest;
  if (platform === 'x') {
    req = buildX(text, mediaIds, flags['reply-to']);
  } else {
    const author = flags.author ?? process.env.LINKEDIN_AUTHOR_URN ?? '';
    if (!author) fail('linkedin requires --author urn:li:person:<id> (or LINKEDIN_AUTHOR_URN)');
    const version =
      flags['linkedin-version'] ?? process.env.LINKEDIN_VERSION ?? DEFAULT_LINKEDIN_VERSION;
    req = buildLinkedIn(text, author, flags.visibility ?? 'PUBLIC', version);
  }

  const confirm = bools.has('confirm');

  // Approval gate: no token check, no network on a dry run. Publishing is
  // irreversible, so it requires an explicit, separate --confirm.
  if (!confirm) {
    out({
      dryRun: true,
      platform,
      willPost: {
        url: req.url,
        method: req.method,
        headers: maskAuth(req.headers),
        body: req.body,
      },
      note: 'No request sent. Re-run with --confirm to publish.',
    });
    return;
  }

  if (!process.env[req.tokenEnv]) {
    fail(
      `${req.tokenEnv} not set (orchestrator: \`export ${req.tokenEnv}=$(gf token ${platform})\`)`
    );
  }

  const result = platform === 'x' ? await sendX(req) : await sendLinkedIn(req);
  out(result);
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
