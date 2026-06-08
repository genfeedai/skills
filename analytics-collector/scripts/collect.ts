#!/usr/bin/env bun
// analytics-collector — the analytic stage of the content loop.
//
// Pulls performance for already-posted items from X and LinkedIn over their REST
// APIs (global fetch, no SDK), normalizes each to a Metric, and prints them as
// JSON. Pure worker: reads its token from the environment, persists nothing. The
// orchestrator pipes each Metric into `gf record-metric <id>`, which recomputes
// feedbackScore — and that score, surfaced by `gf feedback <term>`, re-ranks the
// next round of trends. That is the analytic -> repeat edge: the loop closes here.
//
//   bun run collect.ts --platform x --ids 1799111,1799222
//   bun run collect.ts --platform linkedin --ids urn:li:share:6844...
//
// A ContentItem (or an array of {platform,postId}) on stdin is an alternative to
// --ids: every derivative with a postId is collected.
//
// Tokens (env only, never written): X_BEARER_TOKEN | LINKEDIN_ACCESS_TOKEN.

type Platform = 'x' | 'linkedin';

interface Metric {
  platform: Platform;
  postId: string;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  capturedAt: string;
}

interface Derivative {
  platform?: string;
  postId?: string;
}

interface ContentItemLike {
  derivatives?: Derivative[];
}

const NOW = new Date().toISOString();

function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = 'true';
    }
  }
  return flags;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').trim();
}

function fail(message: string): never {
  process.stderr.write(`analytics-collector: ${message}\n`);
  process.exit(1);
}

function warn(message: string): void {
  process.stderr.write(`analytics-collector: ${message}\n`);
}

// --- X ------------------------------------------------------------------------

interface XMetricsBlock {
  impression_count?: number;
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  quote_count?: number;
  url_link_clicks?: number;
}

interface XTweet {
  id: string;
  public_metrics?: XMetricsBlock;
  organic_metrics?: XMetricsBlock;
  non_public_metrics?: XMetricsBlock;
}

async function fetchXTweets(ids: string[], token: string, fields: string): Promise<XTweet[]> {
  const url = `https://api.x.com/2/tweets?ids=${ids.join(',')}&tweet.fields=${fields}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  return (JSON.parse(text) as { data?: XTweet[] }).data ?? [];
}

async function collectX(ids: string[]): Promise<Metric[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) fail('X_BEARER_TOKEN not set (orchestrator: `export X_BEARER_TOKEN=$(gf token x)`)');

  // organic/non_public metrics (impressions, clicks) need a user-context token;
  // fall back to public_metrics only if the richer fields are denied.
  let tweets: XTweet[];
  try {
    tweets = await fetchXTweets(ids, token, 'public_metrics,organic_metrics,non_public_metrics');
  } catch (err) {
    warn(
      `x organic metrics unavailable, falling back to public_metrics (${err instanceof Error ? err.message : err})`
    );
    tweets = await fetchXTweets(ids, token, 'public_metrics');
  }

  return tweets.map((t) => {
    const pub = t.public_metrics ?? {};
    const org = t.organic_metrics ?? {};
    const np = t.non_public_metrics ?? {};
    return {
      platform: 'x',
      postId: t.id,
      impressions: org.impression_count ?? np.impression_count ?? pub.impression_count,
      likes: org.like_count ?? pub.like_count,
      comments: org.reply_count ?? pub.reply_count,
      shares: (org.retweet_count ?? pub.retweet_count ?? 0) + (pub.quote_count ?? 0),
      clicks: org.url_link_clicks ?? np.url_link_clicks,
      capturedAt: NOW,
    };
  });
}

// --- LinkedIn -----------------------------------------------------------------

interface LinkedInSocialActions {
  likesSummary?: { totalLikes?: number };
  commentsSummary?: { aggregatedTotalComments?: number };
}

async function collectLinkedIn(ids: string[], version: string): Promise<Metric[]> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token)
    fail(
      'LINKEDIN_ACCESS_TOKEN not set (orchestrator: `export LINKEDIN_ACCESS_TOKEN=$(gf token linkedin)`)'
    );

  const out: Metric[] = [];
  for (const id of ids) {
    try {
      const res = await fetch(
        `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(id)}`,
        {
          headers: {
            authorization: `Bearer ${token}`,
            'linkedin-version': version,
            'x-restli-protocol-version': '2.0.0',
          },
        }
      );
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      const data = JSON.parse(text) as LinkedInSocialActions;
      out.push({
        platform: 'linkedin',
        postId: id,
        likes: data.likesSummary?.totalLikes,
        comments: data.commentsSummary?.aggregatedTotalComments,
        // Impressions/clicks for member posts require organization analytics scopes; left undefined here.
        capturedAt: NOW,
      });
    } catch (err) {
      warn(`linkedin ${id} skipped: ${err instanceof Error ? err.message : err}`);
    }
  }
  return out;
}

// --- main ---------------------------------------------------------------------

function idsFromStdin(raw: string, platform: Platform): string[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as ContentItemLike | Derivative[];
  const derivs = Array.isArray(parsed) ? parsed : (parsed.derivatives ?? []);
  return derivs
    .filter((d) => (d.platform ?? platform) === platform && d.postId)
    .map((d) => d.postId as string);
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const platform = flags.platform as Platform;
  if (platform !== 'x' && platform !== 'linkedin') fail('--platform must be x or linkedin');

  const fromFlag = flags.ids
    ? flags.ids
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const fromStdin = idsFromStdin(await readStdin(), platform);
  const ids = [...new Set([...fromFlag, ...fromStdin])];
  if (!ids.length) fail('no post ids (pass --ids a,b or a ContentItem/Derivative[] on stdin)');

  const version = flags['linkedin-version'] ?? process.env.LINKEDIN_VERSION ?? '202505';
  const metrics = platform === 'x' ? await collectX(ids) : await collectLinkedIn(ids, version);

  process.stdout.write(`${JSON.stringify({ count: metrics.length, metrics }, null, 2)}\n`);
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
