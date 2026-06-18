#!/usr/bin/env bun
// media-forge — produce stage of the content loop (the media half).
//
// Generates image / video / audio through Replicate or fal.ai using nothing but
// global fetch — no vendor SDK. Submits a job, waits for it, downloads every
// output file to --out, and prints a MediaArtifact JSON (one per file) to stdout.
// Pure worker: holds no state, persists no token. The orchestrator resolves a
// token (gf token replicate|fal), exports it, runs this, then attaches the
// emitted artifacts to a ContentItem via the seam.
//
//   bun run forge.ts --provider replicate --modality image \
//     --model black-forest-labs/flux-1.1-pro --prompt "a t-rex on a skateboard"
//
//   bun run forge.ts --provider fal --modality video \
//     --model fal-ai/ltx-video --prompt "neon city flyover" --out .genfeed/artifacts
//
// Extra model inputs: --input '{"aspect_ratio":"16:9","num_outputs":2}' (merged
// over {prompt}). Tokens: REPLICATE_API_TOKEN | FAL_KEY (env only, never written).

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type Modality = 'image' | 'video' | 'audio';
type Provider = 'replicate' | 'fal';

interface MediaArtifact {
  id: string;
  modality: Modality;
  provider: Provider;
  model: string;
  prompt: string;
  path: string;
  meta?: Record<string, unknown>;
}

const NOW = new Date().toISOString();
const POLL_MS = 2500;
const MAX_POLLS = 240; // ~10 min ceiling for slow video models

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

function fail(message: string): never {
  process.stderr.write(`media-forge: ${message}\n`);
  process.exit(1);
}

function info(message: string): void {
  process.stderr.write(`media-forge: ${message}\n`);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const EXT: Record<Modality, string> = { image: 'png', video: 'mp4', audio: 'mp3' };

/** Walk an arbitrary JSON result and collect every http(s) URL it contains. */
function collectUrls(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') {
    if (/^https?:\/\//.test(value)) acc.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectUrls(v, acc);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectUrls(v, acc);
  }
  return acc;
}

function extFromUrl(url: string, modality: Modality): string {
  const clean = url.split('?')[0];
  const m = clean.match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : EXT[modality];
}

async function download(
  url: string,
  dir: string,
  base: string,
  modality: Modality
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const path = join(dir, `${base}.${extFromUrl(url, modality)}`);
  await writeFile(path, buf);
  return path;
}

// --- Replicate ----------------------------------------------------------------

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: unknown;
  error?: string | null;
  urls?: { get?: string };
}

async function runReplicate(
  model: string,
  input: Record<string, unknown>
): Promise<{ urls: string[]; raw: unknown }> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token)
    fail(
      'REPLICATE_API_TOKEN not set (orchestrator: `export REPLICATE_API_TOKEN=$(gf token replicate)`)'
    );
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  // Unified endpoint: body.version accepts owner/name, owner/name:version, or a bare version id.
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { ...auth, prefer: 'wait' }, // sync up to ~60s; we poll if still running
    body: JSON.stringify({ version: model, input }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`replicate create ${res.status}: ${text.slice(0, 400)}`);
  let pred = JSON.parse(text) as ReplicatePrediction;

  let polls = 0;
  while (pred.status !== 'succeeded' && pred.status !== 'failed' && pred.status !== 'canceled') {
    if (polls++ >= MAX_POLLS) throw new Error('replicate timed out');
    await sleep(POLL_MS);
    const getUrl = pred.urls?.get;
    if (!getUrl) throw new Error('replicate prediction has no poll url');
    const poll = await fetch(getUrl, { headers: auth });
    if (!poll.ok) throw new Error(`replicate poll ${poll.status}`);
    pred = (await poll.json()) as ReplicatePrediction;
    info(`replicate ${pred.status}`);
  }
  if (pred.status !== 'succeeded')
    throw new Error(`replicate ${pred.status}: ${pred.error ?? 'unknown'}`);
  return { urls: collectUrls(pred.output), raw: pred.output };
}

// --- fal.ai -------------------------------------------------------------------

interface FalSubmit {
  request_id: string;
  status_url?: string;
  response_url?: string;
}

interface FalStatus {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | string;
}

async function runFal(
  model: string,
  input: Record<string, unknown>
): Promise<{ urls: string[]; raw: unknown }> {
  const token = process.env.FAL_KEY;
  if (!token) fail('FAL_KEY not set (orchestrator: `export FAL_KEY=$(gf token fal)`)');
  const auth = { authorization: `Key ${token}`, 'content-type': 'application/json' };

  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(input),
  });
  const submitText = await submit.text();
  if (!submit.ok) throw new Error(`fal submit ${submit.status}: ${submitText.slice(0, 400)}`);
  const job = JSON.parse(submitText) as FalSubmit;
  const statusUrl =
    job.status_url ?? `https://queue.fal.run/${model}/requests/${job.request_id}/status`;
  const responseUrl =
    job.response_url ?? `https://queue.fal.run/${model}/requests/${job.request_id}`;

  let polls = 0;
  for (;;) {
    if (polls++ >= MAX_POLLS) throw new Error('fal timed out');
    await sleep(POLL_MS);
    const st = await fetch(statusUrl, { headers: auth });
    if (!st.ok) throw new Error(`fal status ${st.status}`);
    const { status } = (await st.json()) as FalStatus;
    info(`fal ${status}`);
    if (status === 'COMPLETED') break;
    if (status !== 'IN_QUEUE' && status !== 'IN_PROGRESS') throw new Error(`fal status ${status}`);
  }

  const out = await fetch(responseUrl, { headers: auth });
  if (!out.ok) throw new Error(`fal result ${out.status}`);
  const raw = await out.json();
  return { urls: collectUrls(raw), raw };
}

// --- main ---------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const provider = flags.provider as Provider;
  const modality = (flags.modality as Modality) ?? 'image';
  const model = flags.model;
  const prompt = flags.prompt ?? '';
  const outDir = flags.out ?? '.genfeed/artifacts';

  if (provider !== 'replicate' && provider !== 'fal') fail('--provider must be replicate or fal');
  if (!model) fail('--model is required (e.g. black-forest-labs/flux-1.1-pro or fal-ai/ltx-video)');
  if (modality !== 'image' && modality !== 'video' && modality !== 'audio')
    fail('--modality must be image, video, or audio');

  let extra: Record<string, unknown> = {};
  if (flags.input) {
    try {
      extra = JSON.parse(flags.input) as Record<string, unknown>;
    } catch {
      fail('--input must be valid JSON');
    }
  }
  const input = { ...(prompt ? { prompt } : {}), ...extra };

  await mkdir(outDir, { recursive: true });

  const { urls, raw } =
    provider === 'replicate' ? await runReplicate(model, input) : await runFal(model, input);
  if (!urls.length)
    fail(`no output urls in ${provider} response: ${JSON.stringify(raw).slice(0, 400)}`);

  const artifacts: MediaArtifact[] = [];
  for (let i = 0; i < urls.length; i++) {
    const id = `art_${crypto.randomUUID()}`;
    const path = await download(urls[i], outDir, id, modality);
    artifacts.push({
      id,
      modality,
      provider,
      model,
      prompt,
      path,
      meta: { sourceUrl: urls[i], index: i, createdAt: NOW },
    });
  }

  process.stdout.write(`${JSON.stringify({ count: artifacts.length, artifacts }, null, 2)}\n`);
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
