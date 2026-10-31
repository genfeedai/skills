#!/usr/bin/env bun
// trend-scout — sense stage of the content loop.
//
// Pulls what's trending from public, mostly key-free sources, normalizes every
// hit to a TrendSignal (score 0..1 within its source), dedupes across sources,
// and prints a ranked list as JSON. Pure worker: no state, no secrets, stdin/stdout
// only — so it stays independently installable. The orchestrator applies prior
// performance feedback (gf feedback <term>) and creates manifest items.
//
//   bun run scout.ts [--sources hn,reddit,gtrends,rss,newsapi]
//                    [--subreddits startups,technology] [--rss url,url]
//                    [--geo US] [--limit 20] [--query "ai"]
//
// NEWSAPI_KEY enables the optional newsapi source. Everything else needs no key.

interface TrendSignal {
  source: string;
  term: string;
  score: number;
  volume?: number;
  url?: string;
  capturedAt: string;
}

const NOW = new Date().toISOString();
const UA = 'genfeed-trend-scout/1.0 (+https://genfeed.ai)';

function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[a.slice(2)] = next;
        i++;
      } else {
        flags[a.slice(2)] = 'true';
      }
    }
  }
  return flags;
}

function warn(source: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`trend-scout: ${source} skipped: ${msg}\n`);
}

/** Assign 0..1 scores by descending rank within a single source's results. */
function rankScore<T>(rows: T[], metric: (row: T) => number): number[] {
  const sorted = [...rows].sort((a, b) => metric(b) - metric(a));
  const n = sorted.length || 1;
  const scoreOf = new Map<T, number>();
  sorted.forEach((row, i) => {
    scoreOf.set(row, Number(((n - i) / n).toFixed(4)));
  });
  return rows.map((r) => scoreOf.get(r) ?? 0);
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers: { 'user-agent': UA, ...headers } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// --- sources -----------------------------------------------------------------

interface HnHit {
  title: string;
  objectID: string;
  points?: number;
  num_comments?: number;
  url?: string;
}

async function hackernews(): Promise<TrendSignal[]> {
  const data = await fetchJson<{ hits: HnHit[] }>(
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30'
  );
  const hits = data.hits ?? [];
  const scores = rankScore(hits, (h) => (h.points ?? 0) + (h.num_comments ?? 0));
  return hits.map((h, i) => ({
    source: 'hackernews',
    term: h.title,
    score: scores[i],
    volume: (h.points ?? 0) + (h.num_comments ?? 0),
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    capturedAt: NOW,
  }));
}

interface RedditChild {
  data: { title: string; ups?: number; num_comments?: number; permalink?: string };
}

async function reddit(subreddits: string[]): Promise<TrendSignal[]> {
  const out: TrendSignal[] = [];
  for (const sub of subreddits) {
    try {
      const data = await fetchJson<{ data: { children: RedditChild[] } }>(
        `https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json?limit=20`
      );
      const rows = data.data?.children ?? [];
      const scores = rankScore(rows, (r) => (r.data.ups ?? 0) + (r.data.num_comments ?? 0));
      rows.forEach((r, i) => {
        out.push({
          source: `reddit/${sub}`,
          term: r.data.title,
          score: scores[i],
          volume: (r.data.ups ?? 0) + (r.data.num_comments ?? 0),
          url: r.data.permalink ? `https://www.reddit.com${r.data.permalink}` : undefined,
          capturedAt: NOW,
        });
      });
    } catch (err) {
      warn(`reddit/${sub}`, err);
    }
  }
  return out;
}

/** Extract <item><title>/<link> pairs from an RSS/Atom feed without an XML dep. */
function parseRssItems(xml: string): { title: string; link?: string }[] {
  const items: { title: string; link?: string }[] = [];
  const blocks =
    xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  for (const block of blocks) {
    const titleMatch =
      block.match(/<title>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/title>/i) ??
      block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!titleMatch) continue;
    const linkMatch =
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) ?? block.match(/<link[^>]*href="([^"]+)"/i);
    items.push({
      title: titleMatch[1].trim(),
      link: linkMatch ? linkMatch[1].trim() : undefined,
    });
  }
  return items;
}

async function googleTrends(geo: string): Promise<TrendSignal[]> {
  const xml = await fetchText(
    `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`
  );
  const items = parseRssItems(xml);
  const n = items.length || 1;
  return items.map((it, i) => ({
    source: 'google-trends',
    term: it.title,
    score: Number(((n - i) / n).toFixed(4)), // feed order is the trend rank
    url: it.link,
    capturedAt: NOW,
  }));
}

async function rssFeeds(urls: string[]): Promise<TrendSignal[]> {
  const out: TrendSignal[] = [];
  for (const url of urls) {
    try {
      const xml = await fetchText(url);
      const items = parseRssItems(xml).slice(0, 20);
      const n = items.length || 1;
      items.forEach((it, i) => {
        out.push({
          source: `rss:${new URL(url).hostname}`,
          term: it.title,
          score: Number(((n - i) / n).toFixed(4)),
          url: it.link,
          capturedAt: NOW,
        });
      });
    } catch (err) {
      warn(`rss:${url}`, err);
    }
  }
  return out;
}

interface NewsApiArticle {
  title: string;
  url?: string;
}

async function newsapi(query: string): Promise<TrendSignal[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) throw new Error('NEWSAPI_KEY not set');
  const q = query ? `&q=${encodeURIComponent(query)}` : '';
  const data = await fetchJson<{ articles: NewsApiArticle[] }>(
    `https://newsapi.org/v2/top-headlines?language=en&pageSize=20${q}`,
    { 'x-api-key': key }
  );
  const arts = data.articles ?? [];
  const n = arts.length || 1;
  return arts.map((a, i) => ({
    source: 'newsapi',
    term: a.title,
    score: Number(((n - i) / n).toFixed(4)),
    url: a.url,
    capturedAt: NOW,
  }));
}

// --- merge --------------------------------------------------------------------

/** Dedupe by normalized term; when two sources agree, boost and keep the max. */
function merge(signals: TrendSignal[]): TrendSignal[] {
  const byKey = new Map<string, TrendSignal>();
  for (const s of signals) {
    const key = s.term
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
      .slice(0, 80);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...s });
    } else {
      // Cross-source agreement is itself a signal: take the higher base score and nudge up.
      const boosted = Math.min(1, Math.max(existing.score, s.score) + 0.1);
      existing.score = Number(boosted.toFixed(4));
      existing.volume = (existing.volume ?? 0) + (s.volume ?? 0);
    }
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score);
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const sources = (flags.sources ?? 'hn,gtrends,reddit').split(',').map((s) => s.trim());
  const subreddits = (flags.subreddits ?? 'technology,startups').split(',').map((s) => s.trim());
  const rss = flags.rss ? flags.rss.split(',').map((s) => s.trim()) : [];
  const geo = flags.geo ?? 'US';
  const query = flags.query ?? '';
  const limit = flags.limit ? Number(flags.limit) : 20;

  const guard =
    (source: string) =>
    (e: unknown): TrendSignal[] => {
      warn(source, e);
      return [];
    };

  const jobs: Promise<TrendSignal[]>[] = [];
  if (sources.includes('hn')) jobs.push(hackernews().catch(guard('hackernews')));
  if (sources.includes('reddit')) jobs.push(reddit(subreddits));
  if (sources.includes('gtrends')) jobs.push(googleTrends(geo).catch(guard('google-trends')));
  if (sources.includes('rss') && rss.length) jobs.push(rssFeeds(rss));
  if (sources.includes('newsapi')) jobs.push(newsapi(query).catch(guard('newsapi')));

  const all = (await Promise.all(jobs)).flat();
  let merged = merge(all);
  if (query) {
    const q = query.toLowerCase();
    merged = merged.filter((s) => s.term.toLowerCase().includes(q));
  }
  merged = merged.slice(0, limit);

  process.stdout.write(
    `${JSON.stringify({ capturedAt: NOW, sources, count: merged.length, signals: merged }, null, 2)}\n`
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`trend-scout: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
