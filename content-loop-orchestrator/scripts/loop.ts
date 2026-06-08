#!/usr/bin/env bun
// content-loop-orchestrator — drives the deterministic edges of the content loop.
//
// The creative middle (remix -> copy -> media -> approve -> post) is agent-driven:
// it routes to the instruction skills (content-atomizer, *-content-creator,
// image-prompt-engineer, content-reviewer) and the worker skills (media-forge,
// social-poster) under an approval gate — see SKILL.md. THIS script automates the
// two mechanical ends that close the loop:
//
//   sense    scout trends -> re-rank by prior performance (gf feedback) -> create items
//   measure  collect metrics for a posted item -> record them -> report new feedback
//   status   summarize the manifest by stage
//
//   bun run loop.ts sense   [--sources hn,gtrends,reddit] [--limit 10] [--create 5] [--tag pillar]
//   bun run loop.ts measure --item <id> [--linkedin-version 202505]
//   bun run loop.ts status
//
// Sibling skills are resolved relative to this file (../../<skill>/...), overridable
// with GENFEED_SKILLS_DIR. No token is read or stored here; the worker skills do that.

import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const SELF_DIR = import.meta.dir;
const SKILLS_DIR = process.env.GENFEED_SKILLS_DIR
  ? resolve(process.env.GENFEED_SKILLS_DIR)
  : resolve(SELF_DIR, '..', '..');

const GF = join(SKILLS_DIR, 'genfeed-connector', 'gf.ts');
const SCOUT = join(SKILLS_DIR, 'trend-scout', 'scripts', 'scout.ts');
const COLLECT = join(SKILLS_DIR, 'analytics-collector', 'scripts', 'collect.ts');

interface TrendSignal {
  source: string;
  term: string;
  score: number;
  volume?: number;
  url?: string;
  capturedAt: string;
}

interface Derivative {
  platform?: string;
  postId?: string;
}

interface ContentItem {
  id: string;
  stage: string;
  tags?: string[];
  derivatives?: Derivative[];
  feedbackScore?: number;
}

interface Metric {
  platform: string;
  postId: string;
  capturedAt: string;
}

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

function out(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string): never {
  process.stderr.write(`orchestrator: ${message}\n`);
  process.exit(1);
}

/** Run `bun run <script> ...args` with optional stdin, return trimmed stdout. */
function runBun(script: string, args: string[], input?: string): string {
  const res = spawnSync('bun', ['run', script, ...args], {
    input: input ?? '',
    encoding: 'utf8',
    cwd: process.cwd(),
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) {
    const stderr = (res.stderr ?? '').toString().trim();
    throw new Error(
      `${dirname(script).split('/').pop()}/${script.split('/').pop()} failed: ${stderr || `exit ${res.status}`}`
    );
  }
  return (res.stdout ?? '').toString().trim();
}

function gf(args: string[], input?: string): string {
  return runBun(GF, args, input);
}

// --- sense --------------------------------------------------------------------

async function sense(flags: Record<string, string>): Promise<void> {
  const mode = JSON.parse(gf(['detect'])) as { mode: string };

  const scoutArgs: string[] = [];
  for (const k of ['sources', 'subreddits', 'rss', 'geo', 'query', 'limit']) {
    if (flags[k]) scoutArgs.push(`--${k}`, flags[k]);
  }
  const scoutOut = JSON.parse(runBun(SCOUT, scoutArgs)) as { signals: TrendSignal[] };

  // Re-rank by prior performance: adjusted = score * (1 + feedbackForTerm(term)).
  // This is the analytic -> repeat edge applied at ingestion time.
  const ranked = scoutOut.signals.map((sig) => {
    const fb = JSON.parse(gf(['feedback', sig.term])) as { multiplier: number };
    const adjusted = Number((sig.score * (1 + (fb.multiplier ?? 0))).toFixed(4));
    return { sig, score: sig.score, multiplier: fb.multiplier ?? 0, adjusted };
  });
  ranked.sort((a, b) => b.adjusted - a.adjusted);

  const limit = flags.limit ? Number(flags.limit) : 10;
  const createN = flags.create ? Number(flags.create) : limit;
  const extraTag = flags.tag;

  const created: { id: string; term: string; score: number; adjusted: number }[] = [];
  for (const r of ranked.slice(0, createN)) {
    const args = ['create', '--stage', 'selected'];
    if (extraTag) args.push('--tags', extraTag);
    const item = JSON.parse(gf(args, JSON.stringify(r.sig))) as ContentItem;
    created.push({ id: item.id, term: r.sig.term, score: r.score, adjusted: r.adjusted });
  }

  out({
    mode: mode.mode,
    scouted: scoutOut.signals.length,
    created: created.length,
    items: created,
    note: 'Items are at stage "selected". Route each through remix -> produce -> approve -> post (see SKILL.md).',
  });
}

// --- measure ------------------------------------------------------------------

async function measure(flags: Record<string, string>): Promise<void> {
  const itemId = flags.item ?? fail('measure requires --item <id>');
  const item = JSON.parse(gf(['get', itemId])) as ContentItem;
  const derivs = (item.derivatives ?? []).filter((d) => d.postId && d.platform);
  if (!derivs.length) fail(`item ${itemId} has no posted derivatives to measure`);

  const byPlatform = new Map<string, string[]>();
  for (const d of derivs) {
    const list = byPlatform.get(d.platform as string) ?? [];
    list.push(d.postId as string);
    byPlatform.set(d.platform as string, list);
  }

  const recorded: Metric[] = [];
  for (const [platform, ids] of byPlatform) {
    const collectArgs = ['--platform', platform, '--ids', ids.join(',')];
    if (flags['linkedin-version'])
      collectArgs.push('--linkedin-version', flags['linkedin-version']);
    const result = JSON.parse(runBun(COLLECT, collectArgs)) as { metrics: Metric[] };
    for (const m of result.metrics) {
      gf(['record-metric', itemId], JSON.stringify(m)); // recomputes feedbackScore
      recorded.push(m);
    }
  }

  // Close the loop: an item only counts toward feedbackForTerm once it reaches stage
  // `measured` (gf feedback averages measured items only). Without this transition the
  // term multipliers below — and the analytic -> repeat re-rank in `sense` — stay flat.
  const measured = item.stage !== 'measured';
  if (measured) gf(['transition', itemId, 'measured', '--note', 'metrics recorded']);

  const updated = JSON.parse(gf(['get', itemId])) as ContentItem;
  const feedback = (updated.tags ?? []).map((term) => ({
    term,
    ...(JSON.parse(gf(['feedback', term])) as { multiplier: number }),
  }));

  out({
    item: itemId,
    recorded: recorded.length,
    metrics: recorded,
    stage: updated.stage,
    transitionedToMeasured: measured,
    feedbackScore: updated.feedbackScore,
    feedbackByTag: feedback,
    note: 'Item is now at stage "measured"; feedbackByTag multipliers re-rank these terms in the next `loop.ts sense`.',
  });
}

// --- status -------------------------------------------------------------------

async function status(): Promise<void> {
  const mode = JSON.parse(gf(['detect'])) as { mode: string };
  const items = JSON.parse(gf(['list'])) as ContentItem[];
  const byStage: Record<string, number> = {};
  for (const it of items) byStage[it.stage] = (byStage[it.stage] ?? 0) + 1;
  out({ mode: mode.mode, total: items.length, byStage });
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  switch (cmd) {
    case 'sense':
      return sense(flags);
    case 'measure':
      return measure(flags);
    case 'status':
      return status();
    default:
      fail('usage: loop.ts <sense|measure|status> [flags]');
  }
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
