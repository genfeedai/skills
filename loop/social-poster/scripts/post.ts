#!/usr/bin/env bun
// social-poster — the post stage of the content loop.
//
// Publishes one finished derivative to X, LinkedIn, Threads, Instagram, Facebook, TikTok,
// YouTube, Pinterest or Mastodon over their official APIs with global fetch (no SDK).
// Pure worker: reads its token from the environment, persists nothing, makes no model call,
// and ENFORCES AN APPROVAL GATE — without --confirm it is a dry run that prints every
// request it *would* send (secrets masked) and makes no network call.
//
//   # dry run (default): show the requests, post nothing
//   bun run post.ts --platform x --text "shipping the content loop, all skills"
//
//   # publish for real (explicit, irreversible)
//   bun run post.ts --platform x --text "..." --confirm
//   bun run post.ts --platform instagram --media https://cdn.example.com/reel.mp4 --text "..." --confirm
//
// A Derivative JSON on stdin is an alternative to --text/--media:
//   echo '{"platform":"x","copy":"gm","mediaRefs":["123"]}' | bun run post.ts --platform x --confirm

import { DryRunTransport, fail, LiveTransport, PosterError, type PostInput } from './lib/core';
import { isPlatform, PUBLISHERS } from './lib/registry';

interface Derivative {
  platform?: string;
  format?: string;
  copy?: string;
  mediaRefs?: string[];
}

function parseFlags(argv: string[]): { flags: Record<string, string>; bools: Set<string> } {
  const flags: Record<string, string> = {};
  const bools = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
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

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function out(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export async function run(argv: string[], stdin: string): Promise<unknown> {
  const { flags, bools } = parseFlags(argv);
  const platform = flags.platform;
  if (!isPlatform(platform)) {
    return fail(`--platform must be one of: ${Object.keys(PUBLISHERS).join(', ')}`);
  }

  const derivative = stdin ? (JSON.parse(stdin) as Derivative) : undefined;
  const text = flags.text ?? derivative?.copy ?? '';
  const refs = derivative?.mediaRefs ?? [];
  const input: PostInput = {
    text,
    // X takes already-uploaded media ids; every other platform takes URLs or file paths.
    media: platform === 'x' ? [] : splitList(flags.media).concat(flags.media ? [] : refs),
    mediaIds: platform === 'x' ? (flags['media-ids'] ? splitList(flags['media-ids']) : refs) : [],
    flags,
  };
  if (platform === 'x' || platform === 'linkedin') {
    if (!text.trim()) fail('no text to post (pass --text or a Derivative with .copy on stdin)');
  }

  const publisher = PUBLISHERS[platform];

  // Approval gate: no token check, no network on a dry run. Publishing is irreversible, so it
  // requires an explicit, separate --confirm.
  if (!bools.has('confirm')) {
    const transport = new DryRunTransport();
    await publisher.publish(input, transport);
    return {
      dryRun: true,
      platform,
      willSend: transport.planned,
      note: 'No request sent. Re-run with --confirm to publish.',
    };
  }

  for (const name of publisher.tokenEnv) {
    if (!process.env[name]) {
      fail(`${name} not set (orchestrator: \`export ${name}=$(gf token ${platform})\`)`);
    }
  }
  return publisher.publish(input, new LiveTransport());
}

if (import.meta.main) {
  readStdin()
    .then((stdin) => run(process.argv.slice(2), stdin))
    .then(out)
    .catch((err: unknown) => {
      const message =
        err instanceof PosterError || err instanceof Error ? err.message : String(err);
      process.stderr.write(`social-poster: ${message}\n`);
      process.exit(1);
    });
}
