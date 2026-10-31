#!/usr/bin/env bun
// long-form-storyboard — plan a long video from a voice note or idea dump, then compile the
// storyboard into a manifest for ad-pack-assembly.
//
// The writing (script, sections, cutaway briefs) is done by the model running your session.
// This script does the deterministic parts: validate the storyboard against the Genfeed limits,
// estimate timing, export the narration script, shot list and captions, and compile a manifest
// that puts cutaways (and optionally a presenter recording) over one continuous narration.
// No model call, no network, no API key.
//
//   bun run storyboard.ts validate storyboard.json
//   bun run storyboard.ts script   storyboard.json --out ./out [--audio voice.m4a]
//   bun run storyboard.ts manifest storyboard.json --audio voice.m4a --out ./out/pack.json \
//        --fallback cards/blank.png
//
// ffprobe is needed only to read the length of --audio / --presenter.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Types

export interface Cutaway {
  id: string;
  /** What the picture shows. Written for an image or video tool, never contains words to render. */
  brief: string;
  /** Finished still or clip, relative to the storyboard file. */
  file?: string;
  /** Seconds into the segment where this cutaway appears. Default: evenly spaced. */
  at?: number;
  /** For a clip: where in the clip to start. */
  clipStart?: number;
}

export interface Segment {
  id: string;
  sectionLabel?: string;
  narration: string;
  /** Seconds into the narration. Give both or neither; without them timing is proportional. */
  start?: number;
  end?: number;
  /** Short line burned in at the start of the segment, added in post. */
  onScreenText?: string;
  /** A pre-rendered title or chapter card (for example from motion-video). */
  card?: string;
  cutaways?: Cutaway[];
}

export interface Storyboard {
  title: string;
  language?: string;
  /** Words per minute for the spoken-length estimate. Default 150. */
  wpm?: number;
  /** One line added to every cutaway prompt so the pictures match. */
  visualStyle?: string;
  size?: string;
  fps?: number;
  segments: Segment[];
}

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

export interface TimedSegment {
  segment: Segment;
  start: number;
  end: number;
}

export class StoryboardError extends Error {}

function fail(message: string): never {
  throw new StoryboardError(message);
}

// Limits are taken from the edit schema of the Genfeed `storyboard_long_form` tool.
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/;
export const LIMITS = {
  segments: 150,
  cutaways: 600,
  narration: 2000,
  sectionLabel: 40,
  brief: 1000,
};
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// ---------------------------------------------------------------------------
// Validation and timing (pure)

const CJK = /[぀-ヿ㐀-鿿가-힯]/g;

/** Words for spaced languages; two characters count as one word for Chinese, Japanese, Korean. */
export function spokenWeight(text: string): number {
  const cjk = (text.match(CJK) ?? []).length;
  const words = text.replace(CJK, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, words + Math.ceil(cjk / 2));
}

export function estimateSeconds(text: string, wpm: number): number {
  return (spokenWeight(text) / wpm) * 60;
}

export function validateStoryboard(board: Storyboard): Issue[] {
  const issues: Issue[] = [];
  const add = (level: Issue['level'], where: string, message: string) =>
    issues.push({ level, where, message });

  if (!board.title?.trim()) add('error', 'title', 'title is required');
  if (!Array.isArray(board.segments) || board.segments.length === 0) {
    add('error', 'segments', 'segments must not be empty');
    return issues;
  }
  if (board.segments.length > LIMITS.segments) {
    add(
      'error',
      'segments',
      `at most ${LIMITS.segments} segments (found ${board.segments.length})`
    );
  }
  const wpm = board.wpm ?? 150;
  if (!(wpm >= 80 && wpm <= 260)) add('error', 'wpm', 'wpm must be between 80 and 260');

  const segmentIds = new Set<string>();
  const cutawayIds = new Set<string>();
  let cutawayCount = 0;
  let previousEnd = -1;
  let explicit = 0;

  for (const segment of board.segments) {
    const where = `segment ${segment.id}`;
    if (!ID.test(segment.id ?? ''))
      add('error', where, 'id is missing or has characters outside A-Z a-z 0-9 . _ : -');
    if (segmentIds.has(segment.id)) add('error', where, 'duplicate segment id');
    segmentIds.add(segment.id);
    if (!segment.narration?.trim()) add('error', where, 'narration is empty');
    else if (segment.narration.length > LIMITS.narration) {
      add(
        'error',
        where,
        `narration is ${segment.narration.length} characters, the limit is ${LIMITS.narration}`
      );
    }
    if ((segment.sectionLabel ?? '').length > LIMITS.sectionLabel) {
      add('error', where, `sectionLabel is over ${LIMITS.sectionLabel} characters`);
    }
    if (segment.narration && estimateSeconds(segment.narration, wpm) > 30) {
      add(
        'warning',
        where,
        'narration runs over about 30 seconds; split it so the picture changes more often'
      );
    }
    const hasStart = segment.start !== undefined;
    const hasEnd = segment.end !== undefined;
    if (hasStart !== hasEnd) add('error', where, 'give both start and end, or neither');
    if (hasStart && hasEnd) {
      explicit++;
      if (!(Number(segment.start) >= 0 && Number(segment.end) > Number(segment.start))) {
        add('error', where, 'needs 0 <= start < end');
      } else if (Number(segment.start) < previousEnd - 0.001) {
        add('error', where, 'start is before the previous segment ends');
      }
      previousEnd = Number(segment.end);
    }
    const cutaways = segment.cutaways ?? [];
    if (cutaways.length === 0 && !segment.card) {
      add(
        'warning',
        where,
        'has no cutaway; the compile step needs a fallback or presenter footage for it'
      );
    }
    for (const cutaway of cutaways) {
      cutawayCount++;
      const cwhere = `cutaway ${cutaway.id}`;
      if (!ID.test(cutaway.id ?? '')) add('error', cwhere, 'id is missing or unusable');
      if (cutawayIds.has(cutaway.id)) add('error', cwhere, 'duplicate cutaway id');
      cutawayIds.add(cutaway.id);
      if (!cutaway.brief?.trim()) add('error', cwhere, 'brief is empty');
      else if (cutaway.brief.length > LIMITS.brief)
        add('error', cwhere, `brief is over ${LIMITS.brief} characters`);
      if (cutaway.at !== undefined && !(cutaway.at >= 0)) add('error', cwhere, 'at must be >= 0');
    }
  }
  if (cutawayCount > LIMITS.cutaways) {
    add('error', 'cutaways', `at most ${LIMITS.cutaways} cutaways (found ${cutawayCount})`);
  }
  if (explicit !== 0 && explicit !== board.segments.length) {
    add('error', 'segments', 'either every segment has start and end, or none does');
  }
  return issues;
}

/**
 * Contiguous time ranges for every segment over `totalSeconds` of narration. Explicit start and
 * end win (gaps are closed by extending the earlier segment); otherwise the narration is divided
 * in proportion to spoken length. Proportional timing is an estimate, not forced alignment.
 */
export function resolveTimings(board: Storyboard, totalSeconds: number): TimedSegment[] {
  const segments = board.segments;
  const explicit = segments.every((s) => s.start !== undefined && s.end !== undefined);
  if (explicit) {
    return segments.map((segment, index) => {
      const next = segments[index + 1];
      const start = index === 0 ? 0 : Number(segment.start);
      const end = next ? Number(next.start) : Math.max(Number(segment.end), totalSeconds);
      return { segment, start, end };
    });
  }
  const weights = segments.map((segment) => spokenWeight(segment.narration));
  const sum = weights.reduce((a, b) => a + b, 0);
  let cursor = 0;
  return segments.map((segment, index) => {
    const start = cursor;
    cursor += (weights[index] / sum) * totalSeconds;
    const end = index === segments.length - 1 ? totalSeconds : cursor;
    return { segment, start, end };
  });
}

// ---------------------------------------------------------------------------
// Exports

export function narrationText(board: Storyboard): string {
  const out: string[] = [];
  let label = '';
  for (const segment of board.segments) {
    if (segment.sectionLabel && segment.sectionLabel !== label) {
      label = segment.sectionLabel;
      out.push(`\n[${label}]\n`);
    }
    out.push(segment.narration.trim());
  }
  return `${out.join('\n').trim()}\n`;
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function shotListMarkdown(board: Storyboard, timed: TimedSegment[]): string {
  const style = board.visualStyle ? `Visual style for every cutaway: ${board.visualStyle}\n\n` : '';
  const rows = timed.flatMap(({ segment, start, end }) => {
    const items = segment.cutaways?.length ? segment.cutaways : [undefined];
    return items.map((cutaway, index) => {
      const time = index === 0 ? `${start.toFixed(1)}-${end.toFixed(1)} s` : '';
      const label = index === 0 ? `${segment.id} ${segment.sectionLabel ?? ''}`.trim() : '';
      const words = index === 0 ? segment.narration : '';
      const file = cutaway?.file ?? '';
      return `| ${cell(label)} | ${time} | ${cell(words)} | ${cell(cutaway ? `${cutaway.id}: ${cutaway.brief}` : '(none)')} | ${cell(file)} |`;
    });
  });
  return `# ${board.title}\n\n${style}| Segment | Time | Narration | Cutaway brief | File |\n|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

function srtTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

/** Caption chunks of at most `maxChars`, split on sentences then words. */
export function captionChunks(text: string, maxChars = 84): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?。！？])\s+/)
    .filter(Boolean);
  const chunks: string[] = [];
  for (const sentence of sentences) {
    let line = '';
    for (const word of sentence.split(' ')) {
      if (line && `${line} ${word}`.length > maxChars) {
        chunks.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) chunks.push(line);
  }
  return chunks;
}

export function srt(timed: TimedSegment[]): string {
  const cues: string[] = [];
  for (const { segment, start, end } of timed) {
    const chunks = captionChunks(segment.narration);
    const total = chunks.reduce((sum, c) => sum + c.length, 0) || 1;
    let cursor = start;
    for (const chunk of chunks) {
      const length = ((end - start) * chunk.length) / total;
      cues.push(
        `${cues.length + 1}\n${srtTime(cursor)} --> ${srtTime(cursor + length)}\n${chunk}\n`
      );
      cursor += length;
    }
  }
  return cues.join('\n');
}

// ---------------------------------------------------------------------------
// Compile to an ad-pack-assembly manifest

export interface CompileOptions {
  /** Narration audio, relative to the manifest. In presenter mode the presenter file is used. */
  audioFile: string;
  /** Presenter recording, relative to the manifest. Shown where a segment has no cutaway. */
  presenterFile?: string;
  /** Still or clip shown where a segment has no cutaway (animatic mode). */
  fallbackFile?: string;
  size?: string;
  fps?: number;
  cardSeconds?: number;
  /** Maps a storyboard-relative path to a manifest-relative path. */
  rebase: (path: string) => string;
}

interface ManifestShot {
  id: string;
  file: string;
  duration?: number;
  trim?: { start?: number; duration?: number };
  fit?: 'cover' | 'contain';
  audioFrom: { file: string; start: number };
  text?: Array<{ text: string; start: number; end: number; position?: 'bottom' }>;
}

export interface CompiledManifest {
  name: string;
  size: string;
  fps: number;
  shots: ManifestShot[];
}

export function slug(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'storyboard';
}

function isImage(path: string): boolean {
  return IMAGE_EXT.has(extname(path).toLowerCase());
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function compileManifest(
  board: Storyboard,
  timed: TimedSegment[],
  options: CompileOptions
): CompiledManifest {
  const missing: string[] = [];
  const shots: ManifestShot[] = [];
  const cardSeconds = options.cardSeconds ?? 2;

  for (const { segment, start, end } of timed) {
    const length = end - start;
    interface Item {
      id: string;
      file: string;
      at: number;
      clipStart?: number;
      isCard?: boolean;
    }
    const items: Item[] = [];
    if (segment.card)
      items.push({ id: `${segment.id}-card`, file: segment.card, at: 0, isCard: true });
    const cutaways = segment.cutaways ?? [];
    const sourced = cutaways.filter((c) => c.file);
    for (const cutaway of cutaways) {
      if (!cutaway.file) missing.push(`${cutaway.id} (segment ${segment.id}) has no file yet`);
    }
    const cardLength = segment.card ? Math.min(cardSeconds, length / 2) : 0;
    const remaining = length - cardLength;
    sourced.forEach((cutaway, index) => {
      const at = cutaway.at ?? cardLength + (remaining * index) / Math.max(1, sourced.length);
      items.push({
        id: cutaway.id,
        file: cutaway.file as string,
        at: Math.max(at, cardLength),
        clipStart: cutaway.clipStart,
      });
    });
    if (items.length === 0 || (items.length === 1 && items[0].isCard)) {
      const filler = options.presenterFile ?? options.fallbackFile;
      if (!filler) {
        missing.push(
          `segment ${segment.id} has no cutaway file and there is no presenter or fallback file`
        );
      } else {
        items.push({
          id: `${segment.id}-base`,
          file: filler,
          at: cardLength,
          clipStart: options.presenterFile ? start + cardLength : undefined,
        });
      }
    }
    items.sort((a, b) => a.at - b.at);

    items.forEach((item, index) => {
      const itemStart = Math.min(item.at, length);
      const itemEnd = index + 1 < items.length ? Math.min(items[index + 1].at, length) : length;
      const duration = itemEnd - itemStart;
      if (duration <= 0.04) return;
      const file =
        item.file === options.presenterFile || item.file === options.fallbackFile
          ? item.file
          : options.rebase(item.file);
      const isPresenter =
        options.presenterFile !== undefined && item.file === options.presenterFile;
      const base: ManifestShot = {
        id: `${segment.id}-${index + 1}`.replace(/[^A-Za-z0-9._-]/g, '-'),
        file,
        audioFrom: { file: options.audioFile, start: round3(start + itemStart) },
      };
      if (isImage(item.file)) base.duration = round3(duration);
      else base.trim = { start: round3(item.clipStart ?? 0), duration: round3(duration) };
      if (isPresenter) base.fit = 'cover';
      if (index === 0 && segment.onScreenText?.trim()) {
        base.text = [
          {
            text: segment.onScreenText.trim(),
            start: 0.3,
            end: round3(Math.min(duration, 4)),
            position: 'bottom',
          },
        ];
      }
      shots.push(base);
    });
  }
  if (missing.length) fail(`cannot compile yet:\n  - ${missing.join('\n  - ')}`);
  return {
    name: slug(board.title),
    size: options.size ?? board.size ?? '1920x1080',
    fps: options.fps ?? board.fps ?? 30,
    shots,
  };
}

// ---------------------------------------------------------------------------
// CLI

function audioSeconds(path: string): number {
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
    { encoding: 'utf8' }
  );
  if (result.error) fail(`ffprobe is not available: ${result.error.message}`);
  const seconds = Number(result.stdout.trim());
  if (result.status !== 0 || !Number.isFinite(seconds) || seconds <= 0)
    fail(`cannot read the length of ${path}`);
  return seconds;
}

function loadBoard(path: string | undefined): { board: Storyboard; dir: string } {
  if (!path) fail('usage: storyboard.ts <validate|script|manifest> <storyboard.json> ...');
  let board: Storyboard;
  try {
    board = JSON.parse(readFileSync(path, 'utf8')) as Storyboard;
  } catch (err) {
    return fail(`cannot read ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { board, dir: dirname(resolve(path)) };
}

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function requireValid(board: Storyboard): void {
  const errors = validateStoryboard(board).filter((i) => i.level === 'error');
  if (errors.length)
    fail(
      `storyboard has errors:\n  - ${errors.map((e) => `${e.where}: ${e.message}`).join('\n  - ')}`
    );
}

function validateCommand(argv: string[]): unknown {
  const { board } = loadBoard(argv[0]);
  const issues = validateStoryboard(board);
  const wpm = board.wpm ?? 150;
  const segments = board.segments ?? [];
  const estimates = segments.map((s) => ({
    id: s.id,
    seconds: Math.round(estimateSeconds(s.narration ?? '', wpm) * 10) / 10,
  }));
  const total = estimates.reduce((sum, e) => sum + e.seconds, 0);
  return {
    title: board.title,
    ok: !issues.some((i) => i.level === 'error'),
    segments: segments.length,
    cutaways: segments.reduce((n, s) => n + (s.cutaways?.length ?? 0), 0),
    cutawaysWithFiles: segments.reduce(
      (n, s) => n + (s.cutaways ?? []).filter((c) => c.file).length,
      0
    ),
    estimatedSeconds: Math.round(total),
    estimateNote: `Spoken length at ${wpm} wpm. A real recording will differ; the compile step uses the recording's actual length.`,
    issues,
  };
}

function scriptCommand(argv: string[]): unknown {
  const { board, dir } = loadBoard(argv[0]);
  requireValid(board);
  const outDir = resolve(flagValue(argv, 'out') ?? './out');
  const audio = flagValue(argv, 'audio');
  const total = audio
    ? audioSeconds(resolve(dir, audio))
    : board.segments.reduce((s, seg) => s + estimateSeconds(seg.narration, board.wpm ?? 150), 0);
  const timed = resolveTimings(board, total);
  mkdirSync(outDir, { recursive: true });
  const files = {
    narration: join(outDir, 'narration.txt'),
    shotList: join(outDir, 'shot-list.md'),
    captions: join(outDir, 'captions.srt'),
  };
  writeFileSync(files.narration, narrationText(board));
  writeFileSync(files.shotList, shotListMarkdown(board, timed));
  writeFileSync(files.captions, srt(timed));
  return {
    files,
    timing: audio
      ? 'proportional to spoken length over the recording (or explicit start/end)'
      : `estimated at ${board.wpm ?? 150} wpm; rerun with --audio once the recording exists`,
    totalSeconds: Math.round(total * 10) / 10,
  };
}

function manifestCommand(argv: string[]): unknown {
  const { board, dir } = loadBoard(argv[0]);
  requireValid(board);
  const outPath = resolve(flagValue(argv, 'out') ?? './pack.json');
  const manifestDir = dirname(outPath);
  const presenter = flagValue(argv, 'presenter');
  const audio = flagValue(argv, 'audio') ?? presenter;
  if (!audio) fail('manifest needs --audio <narration file> or --presenter <recording>');
  const fallback = flagValue(argv, 'fallback');
  for (const [label, path] of [
    ['audio', audio],
    ['presenter', presenter],
    ['fallback', fallback],
  ] as const) {
    if (path && !existsSync(resolve(dir, path)))
      fail(`--${label} file not found: ${resolve(dir, path)}`);
  }
  const absent: string[] = [];
  for (const segment of board.segments) {
    for (const file of [segment.card, ...(segment.cutaways ?? []).map((c) => c.file)]) {
      if (file && !existsSync(resolve(dir, file))) absent.push(`${file} (segment ${segment.id})`);
    }
  }
  if (absent.length) fail(`files not found next to the storyboard:\n  - ${absent.join('\n  - ')}`);
  const rebase = (path: string) => relative(manifestDir, resolve(dir, path)) || path;
  const total = audioSeconds(resolve(dir, audio));
  const timed = resolveTimings(board, total);
  const compiled = compileManifest(board, timed, {
    audioFile: rebase(audio),
    presenterFile: presenter ? rebase(presenter) : undefined,
    fallbackFile: fallback ? rebase(fallback) : undefined,
    size: flagValue(argv, 'size'),
    cardSeconds: flagValue(argv, 'card-seconds')
      ? Number(flagValue(argv, 'card-seconds'))
      : undefined,
    rebase,
  });
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(compiled, null, 2)}\n`);
  return {
    manifest: outPath,
    shots: compiled.shots.length,
    narrationSeconds: Math.round(total * 10) / 10,
    next: `bun run ad-pack-assembly/scripts/assemble.ts plan ${outPath}`,
  };
}

export function main(argv: string[]): unknown {
  const [command, ...rest] = argv;
  if (command === 'validate') return validateCommand(rest);
  if (command === 'script') return scriptCommand(rest);
  if (command === 'manifest') return manifestCommand(rest);
  return fail('usage: storyboard.ts <validate|script|manifest> <storyboard.json> ...');
}

if (import.meta.main) {
  try {
    process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`);
  } catch (err) {
    process.stderr.write(
      `long-form-storyboard: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }
}
