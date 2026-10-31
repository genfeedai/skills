#!/usr/bin/env bun
/**
 * motion-video: author and render Remotion videos on your own machine.
 *
 *   bun run scripts/motion.ts init   <dir>
 *   bun run scripts/motion.ts render <dir> [--id Main] [--out out/motion] [--props '{...}'] [--still 45]
 *   bun run scripts/motion.ts check  <file.mp4|png>
 *   bun run scripts/motion.ts frames <file.mp4> [--count 6] [--out frames]
 *
 * No model API is called. Rendering uses Remotion with a local Chrome headless
 * shell; checking and frames use ffprobe and ffmpeg.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REMOTION_VERSION = '4.0.530';

/** Same limits as Genfeed Motion, so a local render can be uploaded as Motion output. */
const LIMITS = {
  fps: [24, 30],
  maxDurationSeconds: 30,
  maxFrames: 900,
  maxPixels: 1920 * 1080,
  maxSide: 1920,
  minSide: 256,
} as const;

interface ProbeStream {
  codec_name?: string;
  codec_type?: string;
  duration?: string;
  height?: number;
  nb_frames?: string;
  r_frame_rate?: string;
  width?: number;
}

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const command = args[0];
const target = args[1];

function flag(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

function fail(message: string): never {
  process.stderr.write(`motion-video: ${message}\n`);
  process.exit(1);
}

function run(file: string, fileArgs: string[], cwd?: string): void {
  const result = spawnSync(file, fileArgs, { cwd, stdio: 'inherit' });
  if (result.status !== 0) fail(`${file} ${fileArgs[0] ?? ''} failed`);
}

function capture(file: string, fileArgs: string[]): string {
  const result = spawnSync(file, fileArgs, { encoding: 'utf8' });
  if (result.status !== 0) fail(`${file} failed: ${result.stderr.slice(0, 300)}`);
  return result.stdout;
}

function need(tool: string): void {
  const result = spawnSync(tool, ['-version'], { stdio: 'ignore' });
  if (result.status !== 0) fail(`${tool} not found on PATH`);
}

function init(dir: string): void {
  const root = resolve(dir);
  if (existsSync(join(root, 'package.json'))) {
    fail(`${root} already has a package.json; pick an empty folder`);
  }
  mkdirSync(join(root, 'src'), { recursive: true });
  const templates = join(here, '..', 'templates');
  const files: Array<[string, string]> = [
    ['package.json', 'package.json'],
    ['tsconfig.json', 'tsconfig.json'],
    ['src/index.ts', 'src/index.ts'],
    ['src/Root.tsx', 'src/Root.tsx'],
    ['src/VisualComposition.tsx', 'src/VisualComposition.tsx'],
  ];
  for (const [from, to] of files) {
    writeFileSync(join(root, to), readFileSync(join(templates, from), 'utf8'));
  }
  const install = spawnSync('bun', ['install'], { cwd: root, stdio: 'inherit' });
  if (install.status !== 0) run('npm', ['install'], root);
  process.stdout.write(`${JSON.stringify({ created: root, remotion: REMOTION_VERSION })}\n`);
}

function render(dir: string): void {
  const root = resolve(dir);
  if (!existsSync(join(root, 'src/index.ts')))
    fail(`${root} is not a motion project; run init first`);
  const id = flag('id') ?? 'Main';
  const out = resolve(flag('out') ?? join(root, 'out'));
  mkdirSync(out, { recursive: true });
  const still = flag('still');
  const props = flag('props');
  const browser = flag('browser') ?? process.env.REMOTION_BROWSER;
  const file = join(out, still ? `${id}-frame-${still}.png` : `${id}.mp4`);

  const base = [
    'remotion',
    still ? 'still' : 'render',
    'src/index.ts',
    id,
    file,
    ...(still ? ['--frame', still] : ['--codec', 'h264']),
    ...(props ? ['--props', props] : []),
    ...(browser ? ['--browser-executable', browser] : []),
    '--log',
    'warn',
  ];
  run('bunx', base, root);
  if (!still) check(file);
}

function parseRate(rate: string | undefined): number {
  if (!rate) return 0;
  const [num, den] = rate.split('/').map(Number);
  return den ? (num ?? 0) / den : (num ?? 0);
}

function check(file: string): void {
  const path = resolve(file);
  if (!existsSync(path)) fail(`${path} not found`);
  need('ffprobe');
  const probe = JSON.parse(
    capture('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-of', 'json', path])
  ) as { streams: Array<ProbeStream & { nb_read_frames?: string }> };
  const video = probe.streams.find((s) => s.codec_type === 'video');
  if (!video?.width || !video.height) fail('no video stream found');
  const isStill = path.endsWith('.png') || path.endsWith('.jpg');
  const fps = parseRate(video.r_frame_rate);
  const frames = Number(video.nb_read_frames ?? video.nb_frames ?? 1);
  const seconds = Number(video.duration ?? 0);
  const problems: string[] = [];
  const { width, height } = video;
  if (width % 2 || height % 2) problems.push('width and height must be even');
  if (width < LIMITS.minSide || height < LIMITS.minSide)
    problems.push(`sides must be at least ${LIMITS.minSide}`);
  if (width > LIMITS.maxSide || height > LIMITS.maxSide)
    problems.push(`sides must be at most ${LIMITS.maxSide}`);
  if (width * height > LIMITS.maxPixels) problems.push('more than 1920x1080 pixels');
  if (!isStill) {
    if (!(LIMITS.fps as readonly number[]).includes(Math.round(fps)))
      problems.push('fps must be 24 or 30');
    if (frames > LIMITS.maxFrames) problems.push(`more than ${LIMITS.maxFrames} frames`);
    if (seconds > LIMITS.maxDurationSeconds)
      problems.push(`longer than ${LIMITS.maxDurationSeconds}s`);
    if (video.codec_name !== 'h264') problems.push(`codec is ${video.codec_name}, expected h264`);
  }
  const report = {
    bytes: statSync(path).size,
    codec: video.codec_name,
    file: path,
    fps: Math.round(fps * 100) / 100,
    frames,
    height,
    ok: problems.length === 0,
    problems,
    seconds: Math.round(seconds * 100) / 100,
    width,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (problems.length) process.exit(2);
}

function frames(file: string): void {
  const path = resolve(file);
  if (!existsSync(path)) fail(`${path} not found`);
  need('ffmpeg');
  need('ffprobe');
  const count = Math.max(2, Math.min(12, Number(flag('count') ?? 6)));
  const out = resolve(flag('out') ?? join(dirname(path), 'frames'));
  mkdirSync(out, { recursive: true });
  const seconds = Number(
    capture('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      path,
    ]).trim()
  );
  if (!(seconds > 0)) fail('could not read duration');
  const written: string[] = [];
  for (let i = 0; i < count; i += 1) {
    // sample the middle of each equal slice; the very last frame is often a fade
    const at = (seconds * (i + 0.5)) / count;
    const name = join(out, `frame-${String(i + 1).padStart(2, '0')}.png`);
    run('ffmpeg', ['-v', 'error', '-y', '-ss', at.toFixed(3), '-i', path, '-frames:v', '1', name]);
    written.push(name);
  }
  process.stdout.write(`${JSON.stringify({ frames: written }, null, 2)}\n`);
}

switch (command) {
  case 'init':
    if (!target) fail('usage: init <dir>');
    init(target);
    break;
  case 'render':
    if (!target) fail('usage: render <dir>');
    render(target);
    break;
  case 'check':
    if (!target) fail('usage: check <file>');
    check(target);
    break;
  case 'frames':
    if (!target) fail('usage: frames <file>');
    frames(target);
    break;
  default:
    fail('commands: init | render | check | frames');
}
