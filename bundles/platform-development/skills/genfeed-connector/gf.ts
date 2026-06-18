#!/usr/bin/env bun
// gf — the content-factory seam, exposed as a CLI so any skill (or the agent
// itself) can read/advance manifest state without importing TypeScript.
//
//   bun run gf.ts detect [--mode standalone|api]
//   bun run gf.ts create [--thesis "..."] [--stage selected] [--tags a,b] [< trend.json]
//   bun run gf.ts get <id>
//   bun run gf.ts list [--stage <stage>] [--tag <tag>] [--limit <n>]
//   bun run gf.ts save            (reads a full ContentItem JSON on stdin)
//   bun run gf.ts transition <id> <stage> [--note "..."]
//   bun run gf.ts next <stage>    (oldest item in <stage>, or empty)
//   bun run gf.ts record-metric <id>   (reads a Metric JSON on stdin)
//   bun run gf.ts feedback <term>      (0..1 prior-performance multiplier input)
//   bun run gf.ts token <platform>     (resolves a token; standalone=env, api=vault)
//
// All commands print JSON to stdout. Errors print to stderr and exit non-zero.

import { getAdapter } from './lib/adapter.ts';
import { resolveContext } from './lib/detect.ts';
import type { ContentItem, Metric, Mode, Stage, TrendSignal } from './lib/schema.ts';

interface Parsed {
  positionals: string[];
  flags: Record<string, string>;
}

function parseArgs(argv: string[]): Parsed {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
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
  process.stderr.write(`gf: ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const cmd = positionals[0];
  if (!cmd) fail('missing command (try: detect, create, list, transition, next, token, feedback)');

  const force =
    flags.mode === 'standalone' || flags.mode === 'api' ? (flags.mode as Mode) : undefined;

  // `detect` only resolves + caches context; it must not instantiate a backend
  // (forcing api here would otherwise try to connect before a key is configured).
  if (cmd === 'detect') {
    out(resolveContext(process.cwd(), force));
    return;
  }

  const gf = await getAdapter(process.cwd());

  switch (cmd) {
    case 'create': {
      const stdin = await readStdin();
      const trend = stdin ? (JSON.parse(stdin) as TrendSignal) : undefined;
      const tags = flags.tags
        ? flags.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      const item = await gf.createItem({
        stage: (flags.stage as Stage) ?? 'trend_candidate',
        thesis: flags.thesis,
        trend,
        tags: trend ? [...new Set([...tags, trend.term])] : tags,
      });
      out(item);
      return;
    }
    case 'get': {
      const id = positionals[1] ?? fail('get requires <id>');
      const item = await gf.getItem(id);
      if (!item) fail(`item ${id} not found`);
      out(item);
      return;
    }
    case 'list': {
      const items = await gf.listItems({
        stage: flags.stage as Stage | undefined,
        tag: flags.tag,
        limit: flags.limit ? Number(flags.limit) : undefined,
      });
      out(items);
      return;
    }
    case 'save': {
      const stdin = await readStdin();
      if (!stdin) fail('save requires a ContentItem JSON on stdin');
      const item = JSON.parse(stdin) as ContentItem;
      out(await gf.saveItem(item));
      return;
    }
    case 'transition': {
      const id = positionals[1] ?? fail('transition requires <id> <stage>');
      const stage = positionals[2] ?? fail('transition requires <id> <stage>');
      out(await gf.transition(id, stage as Stage, flags.note));
      return;
    }
    case 'next': {
      const stage = positionals[1] ?? fail('next requires <stage>');
      const item = await gf.nextJob(stage as Stage);
      out(item ?? null);
      return;
    }
    case 'record-metric': {
      const id = positionals[1] ?? fail('record-metric requires <id>');
      const stdin = await readStdin();
      if (!stdin) fail('record-metric requires a Metric JSON on stdin');
      const metric = JSON.parse(stdin) as Metric;
      out(await gf.recordMetric(id, metric));
      return;
    }
    case 'feedback': {
      const term = positionals[1] ?? fail('feedback requires <term>');
      out({ term, multiplier: await gf.feedbackForTerm(term) });
      return;
    }
    case 'token': {
      const platform = positionals[1] ?? fail('token requires <platform>');
      const token = await gf.getToken(platform);
      if (!token) fail(`no token for ${platform} (standalone: export the platform env var)`);
      // Printed for capture into an env var by the calling skill; never persisted by gf.
      process.stdout.write(`${token}\n`);
      return;
    }
    default:
      fail(`unknown command: ${cmd}`);
  }
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
