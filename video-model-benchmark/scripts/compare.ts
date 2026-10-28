#!/usr/bin/env bun
// video-model-benchmark — one prompt, several video models, one side-by-side clip for X.
//
//   bun run compare.ts --prompt "a barista pours latte art, macro, slow push-in"
//   bun run compare.ts --prompt "..." --models veo-3.1-fast,seedance-2.0-fast --canvas landscape
//   bun run compare.ts --prompt "..." --dry-run
//   bun run compare.ts --prompt "..." --clip "Model A=a.mp4" --clip "Model B=b.mp4"   # no generation
//
// Generates a 9:16 clip per model (16:9 for the stacked canvas) through Replicate (REPLICATE_API_TOKEN, env only, never written),
// then composites the clips with ffmpeg: all start at t=0, same length, each labelled with its
// model name, the shared prompt shown. Zero dependencies: Node built-ins, global fetch, ffmpeg.

import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  buildLayout,
  type CanvasLayout,
  type CanvasName,
  clipAspectRatio,
  wrapText,
} from './layout.ts';
import {
  DEFAULT_MODELS,
  findModel,
  type ModelRunOptions,
  rawModel,
  VIDEO_MODELS,
  type VideoModelSpec,
} from './models.ts';
import { findPreset, PROMPT_PRESETS } from './presets.ts';

interface Clip {
  /** Registry alias, or the user-supplied label for --clip inputs. */
  alias: string;
  label: string;
  path: string;
  durationSeconds: number;
  hasAudio: boolean;
  generation?: {
    replicateId: string;
    predictionId: string;
    input: Record<string, unknown>;
    sourceUrl: string;
    predictSeconds: number | null;
  };
}

interface Args {
  prompt: string;
  models: string[];
  clips: { label: string; path: string }[];
  canvas: CanvasName;
  durationSeconds: number;
  resolution: string | null;
  audio: string | null;
  isBlind: boolean;
  isDryRun: boolean;
  isReuse: boolean;
  footer: string;
  brand: string;
  lookFor: string;
  out: string;
  font: string | null;
  modelInputs: Record<string, Record<string, unknown>>;
}

const POLL_MS = 2500;
const MAX_POLLS = 240; // ~10 minutes
const MAX_CREATE_ATTEMPTS = 6;

const FONT_CANDIDATES = [
  '/usr/share/fonts/opentype/inter/Inter-Bold.otf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  'C:/Windows/Fonts/arialbd.ttf',
];

function fail(message: string): never {
  process.stderr.write(`video-model-benchmark: ${message}\n`);
  process.exit(1);
}

function info(message: string): void {
  process.stderr.write(`video-model-benchmark: ${message}\n`);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// --- args ---------------------------------------------------------------------

function parseArgs(argv: string[]): Args {
  const single: Record<string, string> = {};
  const clips: { label: string; path: string }[] = [];
  const modelInputs: Record<string, Record<string, unknown>> = {};
  const booleans = new Set(['blind', 'dry-run', 'reuse', 'list-presets']);

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) fail(`unexpected argument ${a}`);
    const key = a.slice(2);
    if (booleans.has(key)) {
      single[key] = 'true';
      continue;
    }
    const value = argv[++i];
    if (value === undefined) fail(`--${key} needs a value`);
    if (key === 'clip') {
      const eq = value.lastIndexOf('=');
      if (eq < 1) fail('--clip must look like "Label=path/to/clip.mp4"');
      clips.push({ label: value.slice(0, eq), path: resolve(value.slice(eq + 1)) });
    } else if (key === 'model-input') {
      const eq = value.indexOf('=');
      if (eq < 1) fail(`--model-input must look like alias='{"seed":1}'`);
      try {
        modelInputs[value.slice(0, eq)] = JSON.parse(value.slice(eq + 1)) as Record<
          string,
          unknown
        >;
      } catch {
        fail('--model-input value must be a JSON object');
      }
    } else {
      single[key] = value;
    }
  }

  if (single['list-presets'] === 'true') {
    process.stdout.write(`${JSON.stringify(PROMPT_PRESETS, null, 2)}\n`);
    process.exit(0);
  }
  const preset = single.preset ? findPreset(single.preset) : undefined;
  if (single.preset && !preset)
    fail(
      `unknown --preset ${single.preset}. Known: ${PROMPT_PRESETS.map((p) => p.name).join(', ')}`
    );
  const prompt = single.prompt?.trim() || preset?.prompt;
  if (!prompt) fail('--prompt or --preset is required');
  const canvas = (single.canvas ?? 'square') as CanvasName;
  if (canvas !== 'square' && canvas !== 'landscape' && canvas !== 'stacked')
    fail('--canvas must be square, landscape or stacked');
  const durationSeconds = Number(single.duration ?? 4);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1)
    fail('--duration must be a whole number');

  return {
    prompt,
    models: (single.models ?? DEFAULT_MODELS.join(','))
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    clips,
    canvas,
    durationSeconds,
    resolution: single.resolution ?? null,
    audio: single.audio && single.audio !== 'none' ? single.audio : null,
    isBlind: single.blind === 'true',
    isDryRun: single['dry-run'] === 'true',
    isReuse: single.reuse === 'true',
    footer: single.footer ?? '',
    brand: single.brand?.trim() || 'GENFEED',
    lookFor: single['look-for']?.trim() ?? (single.prompt ? '' : (preset?.lookFor ?? '')),
    out: resolve(single.out ?? 'video-benchmark'),
    font: single.font ?? null,
    modelInputs,
  };
}

// --- replicate ----------------------------------------------------------------

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: unknown;
  error?: string | null;
  urls?: { get?: string };
  metrics?: { predict_time?: number };
}

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

async function predict(
  replicateId: string,
  input: Record<string, unknown>
): Promise<{ prediction: ReplicatePrediction; url: string }> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) fail('REPLICATE_API_TOKEN is not set');
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  // `owner/name` goes through the model endpoint; a pinned `owner/name:version` through /predictions.
  const isPinned = replicateId.includes(':');
  const createUrl = isPinned
    ? 'https://api.replicate.com/v1/predictions'
    : `https://api.replicate.com/v1/models/${replicateId}/predictions`;
  const body = JSON.stringify(isPinned ? { version: replicateId.split(':')[1], input } : { input });

  // Replicate throttles bursts of creates per model (429 with retry_after): wait and retry.
  let text = '';
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(createUrl, {
      method: 'POST',
      headers: { ...auth, prefer: 'wait' },
      body,
    });
    text = await res.text();
    if (res.ok) break;
    if (res.status !== 429 || attempt >= MAX_CREATE_ATTEMPTS)
      throw new Error(`replicate create ${res.status}: ${text.slice(0, 400)}`);
    const retryAfter = Number((JSON.parse(text) as { retry_after?: number }).retry_after ?? 2);
    info(`${replicateId}: rate limited, retrying in ${retryAfter + 1}s (attempt ${attempt})`);
    await sleep((retryAfter + 1) * 1000);
  }
  let pred = JSON.parse(text) as ReplicatePrediction;

  let polls = 0;
  while (pred.status !== 'succeeded' && pred.status !== 'failed' && pred.status !== 'canceled') {
    if (polls++ >= MAX_POLLS) throw new Error(`${replicateId} timed out`);
    await sleep(POLL_MS);
    if (!pred.urls?.get) throw new Error('prediction has no poll url');
    const poll = await fetch(pred.urls.get, { headers: auth });
    if (!poll.ok) throw new Error(`replicate poll ${poll.status}`);
    pred = (await poll.json()) as ReplicatePrediction;
  }
  if (pred.status !== 'succeeded') {
    throw new Error(`${replicateId} ${pred.status}: ${pred.error ?? 'unknown error'}`);
  }
  const url =
    collectUrls(pred.output).find((u) => /\.(mp4|mov|webm)(\?|$)/i.test(u)) ??
    collectUrls(pred.output)[0];
  if (!url) throw new Error(`${replicateId} returned no output url`);
  return { prediction: pred, url };
}

async function download(url: string, path: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

// --- ffmpeg -------------------------------------------------------------------

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (e) => reject(new Error(`${cmd}: ${e.message} (is it installed?)`)));
    child.on('close', (code) =>
      code === 0
        ? resolvePromise({ stdout, stderr })
        : reject(new Error(`${cmd} exited ${code}\n${stderr.slice(-1500)}`))
    );
  });
}

async function probe(path: string): Promise<{ durationSeconds: number; hasAudio: boolean }> {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_type',
    '-of',
    'json',
    path,
  ]);
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: { codec_type: string }[];
  };
  return {
    durationSeconds: Number(data.format?.duration ?? 0),
    hasAudio: (data.streams ?? []).some((s) => s.codec_type === 'audio'),
  };
}

function resolveFont(explicit: string | null): string | null {
  if (explicit) {
    if (!existsSync(explicit)) fail(`--font not found: ${explicit}`);
    return explicit;
  }
  return FONT_CANDIDATES.find((f) => existsSync(f)) ?? null;
}

function quoted(path: string): string {
  if (path.includes("'"))
    fail(`path contains a single quote, which ffmpeg filters cannot take: ${path}`);
  return `'${path}'`;
}

interface ComposeInput {
  clips: Clip[];
  labels: string[];
  layout: CanvasLayout;
  prompt: string;
  footer: string;
  brand: string;
  audioClipIndex: number | null;
  font: string | null;
  workDir: string;
  outPath: string;
}

async function compose(c: ComposeInput): Promise<number> {
  const { layout } = c;
  const seconds = Math.min(...c.clips.map((clip) => clip.durationSeconds));
  const fontOpt = c.font ? `fontfile=${quoted(c.font)}:` : '';

  const textFile = async (name: string, text: string): Promise<string> => {
    const p = join(c.workDir, name);
    await writeFile(p, text);
    return quoted(p);
  };

  const parts: string[] = [];
  // Background, then each panel scaled to cover its slot and overlaid.
  parts.push(
    `color=c=0x0b0b0c:s=${layout.width}x${layout.height}:r=30:d=${seconds.toFixed(3)},format=yuv420p[bg]`
  );
  c.clips.forEach((_, i) => {
    const p = layout.panels[i];
    parts.push(
      `[${i}:v]fps=30,scale=${p.w}:${p.h}:force_original_aspect_ratio=increase,crop=${p.w}:${p.h},setsar=1,setpts=PTS-STARTPTS[p${i}]`
    );
  });
  let last = 'bg';
  c.clips.forEach((_, i) => {
    const p = layout.panels[i];
    parts.push(`[${last}][p${i}]overlay=${p.x}:${p.y}:shortest=0[o${i}]`);
    last = `o${i}`;
  });

  const draw: string[] = [];
  if (layout.isPromptShown) {
    const promptText = `“${wrapText(c.prompt, layout.prompt.w, layout.prompt.fontSize, layout.prompt.maxLines)}”`;
    draw.push(
      `drawtext=${fontOpt}textfile=${await textFile('tag.txt', 'SAME PROMPT')}:fontsize=20:fontcolor=0x8a8a8f:x=${layout.prompt.x}:y=${layout.prompt.y - 32}`
    );
    draw.push(
      `drawtext=${fontOpt}textfile=${await textFile('prompt.txt', promptText)}:fontsize=${layout.prompt.fontSize}:fontcolor=white:line_spacing=12:x=${layout.prompt.x}:y=${layout.prompt.y}`
    );
  }
  for (let i = 0; i < c.clips.length; i++) {
    const p = layout.panels[i];
    if (layout.labelStyle === 'badge') {
      // Two stacked tags in the panel's top-right: the brand on an accent fill, the model name on black.
      const size = layout.labelFontSize;
      const pad = 14;
      const tagH = size + pad * 2;
      const tagW = Math.ceil(Math.max(c.labels[i].length, c.brand.length) * size * 0.62 + pad * 2);
      const x = p.x + p.w - 24 - tagW;
      const y = p.y + 20;
      draw.push(`drawbox=x=${x}:y=${y}:w=${tagW}:h=${tagH}:color=0xc6ff00:t=fill`);
      draw.push(`drawbox=x=${x}:y=${y + tagH}:w=${tagW}:h=${tagH}:color=black:t=fill`);
      draw.push(
        `drawtext=${fontOpt}textfile=${await textFile(`brand${i}.txt`, c.brand.toUpperCase())}:fontsize=${size}:fontcolor=black:x=${x}+(${tagW}-text_w)/2:y=${y}+(${tagH}-text_h)/2`
      );
      draw.push(
        `drawtext=${fontOpt}textfile=${await textFile(`label${i}.txt`, c.labels[i].toUpperCase())}:fontsize=${size}:fontcolor=white:x=${x}+(${tagW}-text_w)/2:y=${y + tagH}+(${tagH}-text_h)/2`
      );
      continue;
    }
    const bandY = p.y + p.h - layout.labelBandHeight;
    draw.push(
      `drawbox=x=${p.x}:y=${bandY}:w=${p.w}:h=${layout.labelBandHeight}:color=black@0.62:t=fill`
    );
    draw.push(
      `drawtext=${fontOpt}textfile=${await textFile(`label${i}.txt`, c.labels[i])}:fontsize=${layout.labelFontSize}:fontcolor=white:x=${p.x}+(${p.w}-text_w)/2:y=${bandY}+(${layout.labelBandHeight}-text_h)/2`
    );
  }
  if (c.footer) {
    draw.push(
      `drawtext=${fontOpt}textfile=${await textFile('footer.txt', c.footer)}:fontsize=${layout.footer.fontSize}:fontcolor=${layout.labelStyle === 'badge' ? 'white:shadowcolor=black@0.7:shadowx=2:shadowy=2' : '0x8a8a8f'}:x=${layout.footer.x}:y=${layout.footer.y}`
    );
  }
  parts.push(`[${last}]${draw.join(',')}[v]`);

  const args = ['-y', '-v', 'error'];
  for (const clip of c.clips) args.push('-i', clip.path);
  const hasAudio = c.audioClipIndex !== null && c.clips[c.audioClipIndex].hasAudio;
  if (hasAudio) {
    parts.push(`[${c.audioClipIndex}:a]atrim=0:${seconds.toFixed(3)},asetpts=PTS-STARTPTS[a]`);
  }
  args.push('-filter_complex', parts.join(';'), '-map', '[v]');
  if (hasAudio) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '160k');
  else args.push('-an');
  args.push(
    '-t',
    seconds.toFixed(3),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-movflags',
    '+faststart',
    c.outPath
  );
  await run('ffmpeg', args);
  return seconds;
}

// --- post copy ----------------------------------------------------------------

/** Text to paste with the video. The prompt lives here on the stacked canvas, not on the video. */
function postCopy(opts: {
  labels: string[];
  prompt: string;
  lookFor: string;
  isBlind: boolean;
  brand: string;
}): string {
  const headline = opts.isBlind
    ? `${opts.labels.join(' vs ')}. Same prompt, one take each. Which is better?`
    : `${opts.labels.join(' vs ')}. ${opts.lookFor || 'Same prompt, one take each.'}`;
  const tail = opts.isBlind || !opts.lookFor ? '' : '\nSame prompt, one take each.';
  return `${headline}${tail}\n\nPrompt: “${opts.prompt}”\n\nMade with ${opts.brand[0]}${opts.brand.slice(1).toLowerCase()}.\n`;
}

// --- main ---------------------------------------------------------------------

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'clip'
  );
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function resolveModel(m: string): VideoModelSpec {
  const known = findModel(m);
  if (known) return known;
  if (/^[\w.-]+\/[\w.:-]+$/.test(m)) return rawModel(m);
  return fail(
    `unknown model "${m}". Known: ${VIDEO_MODELS.map((v) => v.alias).join(', ')} (or any owner/name Replicate id)`
  );
}

function resolveModels(args: Args): VideoModelSpec[] {
  const specs = args.models.map(resolveModel);
  if (specs.length < 2 || specs.length > 3) fail('pick 2 or 3 models');
  return specs;
}

async function generate(
  spec: VideoModelSpec,
  args: Args,
  clipsDir: string,
  isAudioEnabled: boolean
): Promise<Clip> {
  const path = join(clipsDir, `${spec.alias}.mp4`);
  const resolution =
    args.resolution ??
    (spec.resolutions?.includes('720p') ? '720p' : (spec.resolutions?.[0] ?? null));
  const options: ModelRunOptions = {
    prompt: args.prompt,
    aspectRatio: clipAspectRatio(args.canvas),
    durationSeconds: args.durationSeconds,
    resolution,
    isAudioEnabled: isAudioEnabled && spec.supportsAudio,
  };
  const input = { ...spec.buildInput(options), ...(args.modelInputs[spec.alias] ?? {}) };

  if (args.isReuse && existsSync(path)) {
    info(`${spec.alias}: reusing ${path}`);
    const meta = await probe(path);
    const sidecar = `${path}.json`;
    const generation = existsSync(sidecar)
      ? (JSON.parse(await readFile(sidecar, 'utf8')) as Clip['generation'])
      : undefined;
    const reusedRatio = generation?.input.aspect_ratio;
    if (reusedRatio && reusedRatio !== input.aspect_ratio)
      fail(
        `${spec.alias}: the clip in ${clipsDir} is ${reusedRatio} but canvas ${args.canvas} needs ${String(input.aspect_ratio)}. Use another --out, or delete the clip to regenerate it.`
      );
    return { alias: spec.alias, label: spec.label, path, ...meta, generation };
  }

  info(`${spec.alias}: submitting ${JSON.stringify({ ...input, prompt: '…' })}`);
  const { prediction, url } = await predict(spec.replicateId, input);
  await download(url, path);
  const meta = await probe(path);
  info(
    `${spec.alias}: done in ${prediction.metrics?.predict_time?.toFixed(0) ?? '?'}s, ${meta.durationSeconds.toFixed(1)}s clip`
  );
  const generation = {
    replicateId: spec.replicateId,
    predictionId: prediction.id,
    input,
    sourceUrl: url,
    predictSeconds: prediction.metrics?.predict_time ?? null,
  };
  await writeFile(`${path}.json`, `${JSON.stringify(generation, null, 2)}\n`);
  return { alias: spec.alias, label: spec.label, path, ...meta, generation };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.out, { recursive: true });
  const clipsDir = join(args.out, 'clips');
  await mkdir(clipsDir, { recursive: true });

  let clips: Clip[];
  let specs: VideoModelSpec[] = [];

  if (args.clips.length > 0) {
    if (args.clips.length < 2 || args.clips.length > 3) fail('pass 2 or 3 --clip inputs');
    if (args.canvas === 'stacked' && args.clips.length !== 2)
      fail('the stacked canvas takes exactly two clips');
    clips = [];
    for (const c of args.clips) {
      if (!existsSync(c.path)) fail(`clip not found: ${c.path}`);
      clips.push({ alias: slug(c.label), label: c.label, path: c.path, ...(await probe(c.path)) });
    }
  } else {
    specs = resolveModels(args);
    if (args.canvas === 'stacked' && specs.length !== 2)
      fail('the stacked canvas takes exactly two models');
    const audioSpec = args.audio ? specs.find((s) => s.alias === args.audio) : undefined;
    if (args.audio && !audioSpec) fail(`--audio ${args.audio} is not one of the compared models`);
    if (audioSpec && !audioSpec.supportsAudio) fail(`${audioSpec.alias} has no audio`);

    const ceiling = specs.map((s) =>
      s.maxUsdPerSecond === null ? null : s.maxUsdPerSecond * args.durationSeconds
    );
    const knownTotal = ceiling.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    const hasUnknown = ceiling.some((v) => v === null);
    info(
      `plan: ${specs.map((s) => s.alias).join(' vs ')}, ${args.durationSeconds}s each, ${clipAspectRatio(args.canvas)}, canvas ${args.canvas}. ` +
        `Cost ceiling ≈ $${knownTotal.toFixed(2)}${hasUnknown ? ' + models without a verified rate' : ''} (check Replicate pricing)`
    );
    if (args.isDryRun) {
      process.stdout.write(
        `${JSON.stringify({ dryRun: true, models: specs.map((s) => ({ alias: s.alias, replicateId: s.replicateId })), costCeilingUsd: knownTotal, hasUnknownRate: hasUnknown }, null, 2)}\n`
      );
      return;
    }
    clips = await Promise.all(
      specs.map((s) => generate(s, args, clipsDir, audioSpec?.alias === s.alias))
    );
  }

  if (args.isDryRun) fail('--dry-run only applies to generation');

  // Blind mode shuffles the panel order and hides the names behind A / B / C.
  const order = args.isBlind ? shuffle(clips.map((_, i) => i)) : clips.map((_, i) => i);
  const ordered = order.map((i) => clips[i]);
  const letters = ['A', 'B', 'C'];
  const labels = ordered.map((c, i) => (args.isBlind ? letters[i] : c.label));
  const audioClipIndex = args.audio ? ordered.findIndex((c) => c.alias === args.audio) : null;
  if (audioClipIndex === -1)
    fail(`--audio ${args.audio} matches none of: ${ordered.map((c) => c.alias).join(', ')}`);

  const layout = buildLayout(args.canvas, ordered.length);
  const workDir = join(args.out, '.text');
  await mkdir(workDir, { recursive: true });
  const outPath = join(args.out, `${slug(args.prompt)}-${args.canvas}.mp4`);
  const seconds = await compose({
    clips: ordered,
    labels,
    layout,
    prompt: args.prompt,
    footer: args.footer,
    brand: args.brand,
    audioClipIndex,
    font: resolveFont(args.font),
    workDir,
    outPath,
  });

  const copyPath = join(args.out, 'post.md');
  await writeFile(
    copyPath,
    postCopy({
      labels,
      prompt: args.prompt,
      lookFor: args.lookFor,
      isBlind: args.isBlind,
      brand: args.brand,
    })
  );

  const manifest = {
    createdAt: new Date().toISOString(),
    prompt: args.prompt,
    canvas: args.canvas,
    size: `${layout.width}x${layout.height}`,
    seconds,
    isBlind: args.isBlind,
    blindKey: args.isBlind
      ? Object.fromEntries(ordered.map((c, i) => [letters[i], c.label]))
      : null,
    audioFrom: args.audio,
    output: outPath,
    postCopy: copyPath,
    clips: ordered.map((c) => ({
      label: c.label,
      alias: c.alias,
      file: c.path,
      durationSeconds: c.durationSeconds,
      generation: c.generation ?? null,
    })),
  };
  await writeFile(join(args.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  // Sanity read-back so a silent encoder failure cannot pass as success.
  const check = await probe(outPath);
  if (check.durationSeconds < seconds - 0.2)
    fail(`output is ${check.durationSeconds}s, expected ${seconds}s`);
  await readFile(outPath).then((b) => b.length > 1000 || fail('output file is empty'));

  process.stdout.write(
    `${JSON.stringify({ output: outPath, seconds, size: manifest.size, postCopy: copyPath, manifest: join(args.out, 'manifest.json') }, null, 2)}\n`
  );
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
