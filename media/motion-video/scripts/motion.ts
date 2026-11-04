#!/usr/bin/env bun
/**
 * motion-video: author and render Remotion videos on your own machine.
 *
 *   bun run scripts/motion.ts init     <dir>
 *   bun run scripts/motion.ts validate <dir>
 *   bun run scripts/motion.ts approve  <dir> --by "Owner name"
 *   bun run scripts/motion.ts render   <dir> [--id Main] [--out out/motion] [--props '{...}'] [--still 45] [--draft]
 *   bun run scripts/motion.ts check  <file.mp4|png>
 *   bun run scripts/motion.ts frames <file.mp4> [--count 6] [--out frames]
 *
 * No model API is called. Rendering uses Remotion with a local Chrome headless
 * shell; checking and frames use ffprobe and ffmpeg.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
    ['script.json', 'script.json'],
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
  const draft = args.includes('--draft');
  if (!draft) {
    const result = validateScript(root, true);
    if (!result.ok) {
      fail(
        `script.json is not validated and approved, so the final render is blocked:\n  - ${result.errors.join('\n  - ')}\nFix the script and run approve, or pass --draft for a review render.`
      );
    }
  }
  const id = flag('id') ?? 'Main';
  const out = resolve(flag('out') ?? join(root, 'out'));
  mkdirSync(out, { recursive: true });
  const still = flag('still');
  const props = flag('props');
  const browser = flag('browser') ?? process.env.REMOTION_BROWSER;
  const suffix = draft ? '-draft' : '';
  const file = join(out, still ? `${id}-frame-${still}${suffix}.png` : `${id}${suffix}.mp4`);

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

/**
 * Script gate. A motion video is written as script.json first: every shot, the
 * words on screen, what the viewer sees (real screenshot, footage, logo or drawn
 * art) and the source of every number or claim. `validate` checks it, `approve`
 * records the owner's sign-off against a hash of the script, and the final
 * `render` refuses to run until both pass. Change the script and it needs a new
 * approval.
 */
type Kind = 'product' | 'editorial' | 'teaser';
const KINDS: Kind[] = ['product', 'editorial', 'teaser'];
const ASSET_VISUALS = ['screenshot', 'footage', 'logo', 'ui'] as const;
// ui: the product's own interface rebuilt as a component in src/, named as
// "ui: src/file.tsx#Component". It counts as product only with an assets entry
// whose source names the real screens it reproduces.
const PRODUCT_VISUALS = ['screenshot', 'footage', 'ui'];
const PRODUCT_MIN_SCREENSHOTS = 3;
const PRODUCT_MIN_SHARE = 0.4;
const PLACEHOLDER = /\b(todo|tbd|lorem|ipsum|placeholder|your brand|example\.com)\b/i;
const RELATIVE_DATE =
  /\b(today|tonight|tomorrow|yesterday|this (week|weekend|month)|(mon|tues|wednes|thurs|fri|satur|sun)day)\b/i;

interface Shot {
  id: string;
  seconds: number;
  onScreen?: string;
  voiceover?: string;
  visual: string;
  claims?: string[];
}

interface Claim {
  id: string;
  text: string;
  source: string;
  checked: string;
}

interface Asset {
  path: string;
  source: string;
  license: string;
}

const LICENSES = ['owned', 'licensed', 'public-domain', 'permission', 'cc-by', 'cc0'];

interface Approval {
  by: string;
  at: string;
  hash: string;
}

interface Script {
  version: number;
  kind: Kind;
  title: string;
  brand?: { name?: string; url?: string; logo?: string };
  audience: string;
  goal: string;
  cta: string;
  validUntil?: string | null;
  minScreenshots?: number;
  shots: Shot[];
  claims?: Claim[];
  assets?: Asset[];
  music?: string | null;
  approval?: Approval | null;
}

interface ScriptResult {
  approved: boolean;
  errors: string[];
  ok: boolean;
  productSeconds: number;
  totalSeconds: number;
  warnings: string[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function scriptHash(script: Script): string {
  const { approval: _approval, ...body } = script;
  return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
}

function readScript(root: string): Script {
  const path = join(root, 'script.json');
  if (!existsSync(path)) fail(`${path} not found; write the script before the composition`);
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Script;
  } catch (error) {
    fail(`script.json is not valid JSON: ${(error as Error).message}`);
  }
}

function sourceText(root: string): string {
  const parts: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(tsx?|jsx?|css)$/.test(entry.name)) parts.push(readFileSync(path, 'utf8'));
    }
  };
  walk(join(root, 'src'));
  return parts.join('\n');
}

/** "screenshot: public/screens/a.png" -> { type: 'screenshot', path: 'public/screens/a.png' } */
function parseVisual(visual: string): { type: string; path?: string } {
  const match = /^\s*([a-z]+)\s*:\s*(.*)$/i.exec(visual ?? '');
  if (!match) return { type: '' };
  const type = (match[1] ?? '').toLowerCase();
  const rest = (match[2] ?? '').trim();
  return (ASSET_VISUALS as readonly string[]).includes(type) ? { path: rest, type } : { type };
}

function checkAsset(
  root: string,
  src: string,
  path: string | undefined,
  label: string,
  errors: string[]
): void {
  if (!path) {
    errors.push(`${label}: no file path`);
    return;
  }
  const [file, component] = path.split('#');
  if (component !== undefined) {
    if (!file || !existsSync(join(root, file)))
      errors.push(`${label}: ${file} does not exist in the project`);
    else if (!component || !new RegExp(`\\b${component}\\b`).test(src))
      errors.push(`${label}: component ${component || '(none)'} is never used in src/`);
    return;
  }
  if (!existsSync(join(root, path))) {
    errors.push(`${label}: ${path} does not exist in the project`);
    return;
  }
  // staticFile() paths are relative to public/
  const ref = path.replace(/^\.?\/?public\//, '');
  if (!src.includes(ref)) errors.push(`${label}: ${path} is never used in src/`);
}

function validateScript(root: string, requireApproval: boolean): ScriptResult {
  const script = readScript(root);
  const errors: string[] = [];
  const warnings: string[] = [];
  const src = sourceText(root);
  const files = new Set<string>();

  if (!KINDS.includes(script.kind)) errors.push(`kind must be one of ${KINDS.join(', ')}`);
  for (const field of ['title', 'audience', 'goal', 'cta'] as const) {
    const value = script[field];
    if (!value || !String(value).trim()) errors.push(`${field} is empty`);
    else if (PLACEHOLDER.test(String(value))) errors.push(`${field} still has placeholder text`);
  }

  if (!script.brand?.name) errors.push('brand.name is empty');
  else if (PLACEHOLDER.test(script.brand.name))
    errors.push('brand.name still has placeholder text');
  if (script.brand?.logo) {
    checkAsset(root, src, script.brand.logo, 'brand.logo', errors);
    files.add(script.brand.logo);
  } else errors.push('brand.logo is empty: use the real logo file, never a drawn letter or glyph');

  const shots = Array.isArray(script.shots) ? script.shots : [];
  if (!shots.length) errors.push('no shots');
  const claims = new Map((script.claims ?? []).map((claim) => [claim.id, claim]));
  const usedClaims = new Set<string>();
  const ids = new Set<string>();
  let totalSeconds = 0;
  let productSeconds = 0;
  let productShots = 0;

  for (const shot of shots) {
    const label = `shot ${shot.id ?? '?'}`;
    if (!shot.id) errors.push('a shot has no id');
    else if (ids.has(shot.id)) errors.push(`${label}: duplicate id`);
    ids.add(shot.id);
    if (!(shot.seconds > 0)) errors.push(`${label}: seconds must be above 0`);
    totalSeconds += shot.seconds > 0 ? shot.seconds : 0;

    const words = `${shot.onScreen ?? ''}`.trim();
    const all = `${words} ${shot.voiceover ?? ''} ${shot.visual ?? ''}`;
    if (PLACEHOLDER.test(all)) errors.push(`${label}: placeholder text`);
    if (RELATIVE_DATE.test(words) && !script.validUntil)
      errors.push(`${label}: "${words}" is date-relative; set validUntil`);

    const wordCount = words ? words.split(/\s+/).length : 0;
    const readSeconds = wordCount * 0.3 + 1;
    if (wordCount && shot.seconds > 0 && readSeconds > shot.seconds + 0.5)
      warnings.push(
        `${label}: ${wordCount} words need about ${readSeconds.toFixed(1)}s, shot is ${shot.seconds}s`
      );

    const refs = shot.claims ?? [];
    if (/\d/.test(words) && !refs.length)
      errors.push(`${label}: "${words}" shows a number with no claim and source`);
    for (const ref of refs) {
      usedClaims.add(ref);
      if (!claims.has(ref)) errors.push(`${label}: claim "${ref}" is not in claims`);
    }

    const visual = parseVisual(shot.visual);
    if (!visual.type)
      errors.push(`${label}: visual must start with screenshot:, footage:, ui:, logo: or drawn:`);
    if (visual.path !== undefined) {
      checkAsset(root, src, visual.path, label, errors);
      if (visual.path) files.add(visual.path.split('#')[0] ?? visual.path);
      if (visual.type === 'ui' && visual.path && !visual.path.includes('#'))
        errors.push(`${label}: ui visual must name the component, as ui: src/file.tsx#Component`);
    }
    if (PRODUCT_VISUALS.includes(visual.type)) {
      productShots += 1;
      productSeconds += shot.seconds > 0 ? shot.seconds : 0;
    }
  }

  if (totalSeconds > LIMITS.maxDurationSeconds)
    errors.push(`shots add up to ${totalSeconds}s, limit is ${LIMITS.maxDurationSeconds}s`);

  if (script.kind === 'product') {
    const min = script.minScreenshots ?? PRODUCT_MIN_SCREENSHOTS;
    if (productShots < min)
      errors.push(
        `product video shows the real product in ${productShots} shots; needs at least ${min}`
      );
    if (totalSeconds && productSeconds / totalSeconds < PRODUCT_MIN_SHARE)
      errors.push(
        `real product is on screen ${Math.round((productSeconds / totalSeconds) * 100)}% of the time; needs ${PRODUCT_MIN_SHARE * 100}%`
      );
  }

  if (/<Audio\b/.test(src) && !script.music)
    errors.push('the composition plays audio but music is empty; name the track file');
  if (script.music) {
    checkAsset(root, src, script.music, 'music', errors);
    files.add(script.music);
  }

  // Every file on screen or on the soundtrack needs a source and a licence.
  const assets = new Map((script.assets ?? []).map((asset) => [asset.path, asset]));
  for (const file of files) {
    const asset = assets.get(file);
    if (!asset) {
      errors.push(`${file}: not listed in assets with its source and licence`);
      continue;
    }
    if (!asset.source || PLACEHOLDER.test(asset.source))
      errors.push(`${file}: assets entry has no real source`);
    if (!LICENSES.includes(asset.license))
      errors.push(`${file}: licence must be one of ${LICENSES.join(', ')}`);
  }

  for (const claim of claims.values()) {
    const label = `claim ${claim.id}`;
    if (!claim.text) errors.push(`${label}: no text`);
    if (!claim.source || PLACEHOLDER.test(claim.source)) errors.push(`${label}: no real source`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(claim.checked ?? ''))
      errors.push(`${label}: checked must be a YYYY-MM-DD date`);
    else if (claim.checked > today()) errors.push(`${label}: checked date is in the future`);
    if (!usedClaims.has(claim.id)) warnings.push(`${label}: not used by any shot`);
  }

  if (script.validUntil) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(script.validUntil))
      errors.push('validUntil must be a YYYY-MM-DD date');
    else if (today() > script.validUntil)
      errors.push(`script expired on ${script.validUntil}; its dates or numbers are stale`);
  }

  const approval = script.approval;
  const approved = Boolean(approval?.by && approval.hash === scriptHash(script));
  if (requireApproval && !approved)
    errors.push(
      approval ? 'script changed since it was approved; approve it again' : 'script is not approved'
    );

  return {
    approved,
    errors,
    ok: errors.length === 0,
    productSeconds,
    totalSeconds,
    warnings,
  };
}

function validate(dir: string): void {
  const result = validateScript(resolve(dir), false);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(2);
}

function approve(dir: string): void {
  const root = resolve(dir);
  const by = flag('by');
  if (!by)
    fail('usage: approve <dir> --by "Owner name" (the person who read and accepted the script)');
  const result = validateScript(root, false);
  if (!result.ok) fail(`script does not validate:\n  - ${result.errors.join('\n  - ')}`);
  const script = readScript(root);
  script.approval = { at: new Date().toISOString(), by, hash: scriptHash(script) };
  writeFileSync(join(root, 'script.json'), `${JSON.stringify(script, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ approved: script.approval }, null, 2)}\n`);
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
  case 'validate':
    if (!target) fail('usage: validate <dir>');
    validate(target);
    break;
  case 'approve':
    if (!target) fail('usage: approve <dir> --by "Owner name"');
    approve(target);
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
    fail('commands: init | validate | approve | render | check | frames');
}
