#!/usr/bin/env bun
/**
 * reverse-video measuring tool: probe a video, list its cuts to the exact frame,
 * pull consecutive frames, and compare a recreation with the original.
 * Local ffmpeg and ffprobe only. No API calls, no npm packages.
 *
 *   bun run scripts/measure.ts probe <video>
 *   bun run scripts/measure.ts cuts <video> [--min-score 3]
 *   bun run scripts/measure.ts frames <video> --range 80,90 [--roi x,y,w,h] [--out out/frames]
 *   bun run scripts/measure.ts sheet <video> [--every 1] [--out out/sheet.png]
 *   bun run scripts/measure.ts compare <original> <recreation>
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface Probe {
  audio: boolean;
  durationSeconds: number;
  fps: string;
  fpsValue: number;
  frames: number;
  height: number;
  width: number;
}

interface Cut {
  frame: number;
  /** Frame divided by fps, rounded down to 6 places: the time a shot starts. */
  seconds: number;
  /** How far the cut's frame difference stands above its neighbours. */
  score: number;
}

const SAMPLE_W = 64;
const SAMPLE_H = 36;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function run(cmd: string, args: string[]): Buffer {
  const result = spawnSync(cmd, args, { maxBuffer: 1 << 30 });
  if (result.error) fail(`${cmd} is not available: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`${cmd} failed: ${result.stderr.toString().split('\n').slice(-6).join('\n')}`);
  }
  return result.stdout;
}

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
}

function parseFps(rate: string): number {
  const [num, den] = rate.split('/').map(Number);
  return den ? num / den : num;
}

/** Frame divided by fps, rounded down: frame 83 at 30 fps is 2.766666, not 2.767. */
export function frameToSeconds(frame: number, fps: string): number {
  const [num, den = 1] = fps.split('/').map(Number);
  return Math.floor(((frame * den) / num) * 1e6) / 1e6;
}

function probe(video: string): Probe {
  const raw = run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'stream=codec_type,width,height,r_frame_rate,nb_frames,duration',
    '-of',
    'json',
    video,
  ]).toString();
  const streams = JSON.parse(raw).streams as Array<Record<string, string | number>>;
  const v = streams.find((s) => s.codec_type === 'video');
  if (!v) fail('No video stream found.');
  const fps = String(v.r_frame_rate);
  const duration = Number(v.duration) || 0;
  const frames = Number(v.nb_frames) || Math.round(duration * parseFps(fps));
  return {
    audio: streams.some((s) => s.codec_type === 'audio'),
    durationSeconds: duration,
    fps,
    fpsValue: parseFps(fps),
    frames,
    height: Number(v.height),
    width: Number(v.width),
  };
}

/** Every frame as a 64x36 grey sample. */
function samples(video: string): Buffer[] {
  const out = run('ffmpeg', [
    '-v',
    'error',
    '-i',
    video,
    '-vf',
    `scale=${SAMPLE_W}:${SAMPLE_H}:flags=area,format=gray`,
    '-f',
    'rawvideo',
    '-',
  ]);
  const size = SAMPLE_W * SAMPLE_H;
  const frames: Buffer[] = [];
  for (let at = 0; at + size <= out.length; at += size) frames.push(out.subarray(at, at + size));
  return frames;
}

function meanAbsDiff(a: Buffer, b: Buffer): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

/**
 * A cut is a frame whose difference from the one before stands well above the
 * frames around it. That finds jump cuts and punch-ins inside one take, which a
 * scene score on the whole picture misses. Confirm each one by looking at the frames.
 */
export function findCuts(diffs: number[], fps: string, minScore: number): Cut[] {
  const cuts: Cut[] = [];
  for (let i = 1; i < diffs.length; i += 1) {
    const near: number[] = [];
    for (let k = Math.max(1, i - 6); k <= Math.min(diffs.length - 1, i + 6); k += 1) {
      if (k !== i) near.push(diffs[k]);
    }
    const typical = near.length ? [...near].sort((a, b) => a - b)[Math.floor(near.length / 2)] : 0;
    const score = diffs[i] / Math.max(typical, 0.5);
    const isPeak = diffs[i] >= (diffs[i - 1] ?? 0) && diffs[i] >= (diffs[i + 1] ?? 0);
    if (isPeak && diffs[i] >= 2 && score >= minScore) {
      cuts.push({ frame: i, score: Math.round(score * 10) / 10, seconds: frameToSeconds(i, fps) });
    }
  }
  return cuts;
}

function cutsOf(video: string, minScore: number): { cuts: Cut[]; frames: number; info: Probe } {
  const info = probe(video);
  const grey = samples(video);
  const diffs = grey.map((frame, i) => (i === 0 ? 0 : meanAbsDiff(grey[i - 1], frame)));
  return { cuts: findCuts(diffs, info.fps, minScore), frames: grey.length, info };
}

function frames(video: string, args: string[]): void {
  const range = option(args, 'range');
  if (!range) fail('Pass --range first,last (frame numbers).');
  const [first, last] = range.split(',').map(Number);
  if (!(last >= first)) fail('--range needs first,last with last >= first.');
  const roi = option(args, 'roi');
  const out = resolve(option(args, 'out') ?? 'out/frames');
  rmSync(out, { force: true, recursive: true });
  mkdirSync(out, { recursive: true });
  const filters = [`select='between(n\\,${first}\\,${last})'`];
  if (roi) {
    const [x, y, w, h] = roi.split(',').map(Number);
    filters.push(`crop=${w}:${h}:${x}:${y}`);
  }
  run('ffmpeg', [
    '-v',
    'error',
    '-i',
    video,
    '-vf',
    filters.join(','),
    '-vsync',
    '0',
    '-start_number',
    String(first),
    join(out, 'frame-%05d.png'),
  ]);
  process.stdout.write(`${JSON.stringify({ first, last, out, roi: roi ?? null }, null, 2)}\n`);
}

function sheet(video: string, args: string[]): void {
  const every = Number(option(args, 'every') ?? 1);
  const out = resolve(option(args, 'out') ?? 'out/sheet.png');
  mkdirSync(resolve(out, '..'), { recursive: true });
  const info = probe(video);
  const cols = Math.min(6, Math.max(1, Math.ceil(info.durationSeconds / every)));
  run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    video,
    '-vf',
    `fps=1/${every},scale=320:-2,tile=${cols}x${Math.ceil(Math.ceil(info.durationSeconds / every) / cols)}`,
    '-frames:v',
    '1',
    out,
  ]);
  process.stdout.write(`${JSON.stringify({ every, out }, null, 2)}\n`);
}

function worstFrames(original: string, recreation: string): Array<{ frame: number; ssim: number }> {
  const stats = join(resolve('out'), 'ssim-stats.txt');
  mkdirSync(resolve('out'), { recursive: true });
  const info = probe(original);
  const norm = (label: string) => `scale=320:180:flags=area,fps=${info.fps},setsar=1[${label}]`;
  run('ffmpeg', [
    '-v',
    'error',
    '-i',
    original,
    '-i',
    recreation,
    '-lavfi',
    `[0:v]${norm('a')};[1:v]${norm('b')};[a][b]ssim=stats_file=${stats}`,
    '-f',
    'null',
    '-',
  ]);
  const rows = readFileSync(stats, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      frame: Number(/n:(\d+)/.exec(line)?.[1]) - 1,
      ssim: Number(/All:([\d.]+)/.exec(line)?.[1]),
    }));
  return rows.sort((a, b) => a.ssim - b.ssim).slice(0, 8);
}

function compare(original: string, recreation: string, args: string[]): void {
  const minScore = Number(option(args, 'min-score') ?? 3);
  const a = cutsOf(original, minScore);
  const b = cutsOf(recreation, minScore);
  const tolerance = 1;
  const missing = a.cuts.filter(
    (c) => !b.cuts.some((d) => Math.abs(d.frame - c.frame) <= tolerance)
  );
  const extra = b.cuts.filter((d) => !a.cuts.some((c) => Math.abs(d.frame - c.frame) <= tolerance));
  const report = {
    canvas: {
      matches: a.info.width === b.info.width && a.info.height === b.info.height,
      original: `${a.info.width}x${a.info.height}`,
      recreation: `${b.info.width}x${b.info.height}`,
    },
    cutsMissingFromRecreation: missing,
    cutsOnlyInRecreation: extra,
    durationSeconds: { original: a.info.durationSeconds, recreation: b.info.durationSeconds },
    fps: { original: a.info.fps, recreation: b.info.fps },
    frames: { original: a.frames, recreation: b.frames },
    sound: { original: a.info.audio, recreation: b.info.audio },
    worstFramesBySsim: worstFrames(original, recreation),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function main(): void {
  const [command, first, second, ...rest] = process.argv.slice(2);
  const needs = (path?: string): string => {
    if (!path || !existsSync(path)) fail(`File not found: ${path ?? '(missing)'}`);
    return path;
  };
  switch (command) {
    case 'probe':
      process.stdout.write(`${JSON.stringify(probe(needs(first)), null, 2)}\n`);
      return;
    case 'cuts': {
      const minScore = Number(option([second, ...rest].filter(Boolean), 'min-score') ?? 3);
      const { cuts, frames: count, info } = cutsOf(needs(first), minScore);
      process.stdout.write(`${JSON.stringify({ ...info, cuts, decodedFrames: count }, null, 2)}\n`);
      return;
    }
    case 'frames':
      frames(needs(first), [second, ...rest].filter(Boolean));
      return;
    case 'sheet':
      sheet(needs(first), [second, ...rest].filter(Boolean));
      return;
    case 'compare':
      compare(needs(first), needs(second), rest);
      return;
    default:
      fail('Usage: measure.ts <probe|cuts|frames|sheet|compare> <video> [options]');
  }
}

if (import.meta.main) main();
