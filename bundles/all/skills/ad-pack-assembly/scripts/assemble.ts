#!/usr/bin/env bun
// ad-pack-assembly — put finished shots, text, voiceover and music together on this machine.
//
// Reads a pack manifest (JSON), normalises every shot to one size and frame rate, burns in the
// on-screen text, joins the shots (hard cuts or crossfades), mixes voiceover and music, and
// checks the result. Cutdowns (for example 9:16 from a 16:9 pack) are rebuilt from the same
// source shots. Local ffmpeg only: no model call, no network, no API key.
//
//   bun run assemble.ts plan  pack.json                 # validate, probe, print the timeline
//   bun run assemble.ts build pack.json --out ./out     # render master and cutdowns
//   bun run assemble.ts frames ./out/pack.mp4 --count 8 # pull frames to look at
//
// Paths in the manifest are relative to the manifest file. ffmpeg is called with argument
// arrays, never through a shell.

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Manifest types

export interface Overlay {
  text: string;
  start: number;
  end: number;
  position?: 'top' | 'center' | 'bottom';
}

export interface Transition {
  type?: string;
  duration: number;
}

export interface Shot {
  id: string;
  file: string;
  trim?: { start?: number; duration?: number };
  /** Required for still images. */
  duration?: number;
  fit?: 'cover' | 'contain';
  /** Horizontal crop focus for cover, 0 (left) to 1 (right). Default 0.5. */
  focus?: number;
  audio?: 'mute' | 'keep';
  /**
   * Take this shot's sound from a time range of another file (a narration, or a presenter
   * recording) instead of the shot's own clip. Lets b-roll play over a continuous voice.
   */
  audioFrom?: { file: string; start: number };
  text?: Overlay[];
  /** Transition into the NEXT shot. Omit for a hard cut. */
  transition?: Transition;
}

export interface AudioTrack {
  file: string;
  gainDb?: number;
}

export interface VoiceTrack extends AudioTrack {
  /** Seconds into the video where the voiceover starts. */
  start?: number;
}

export interface MusicTrack extends AudioTrack {
  /** Lower the music under the voiceover. Default true when a voiceover exists. */
  duck?: boolean;
  fadeOut?: number;
}

export interface Style {
  /** Font size as a fraction of the shorter side. Default 0.06. */
  fontSize?: number;
  color?: string;
  boxColor?: string;
}

export interface Cutdown {
  name: string;
  size: string;
  fit?: 'cover' | 'contain';
  focus?: number;
}

export interface Manifest {
  name: string;
  size: string;
  fps?: number;
  shots: Shot[];
  voiceover?: VoiceTrack;
  music?: MusicTrack;
  font?: string;
  style?: Style;
  cutdowns?: Cutdown[];
  /** Integrated loudness target in LUFS. Default -14. */
  loudness?: number;
}

export interface Probe {
  duration: number;
  hasAudio: boolean;
  isImage: boolean;
  width: number;
  height: number;
}

export interface PlannedShot {
  shot: Shot;
  duration: number;
  start: number;
  end: number;
  /** Seconds this shot overlaps the next one. */
  overlap: number;
  probe: Probe;
}

export interface Plan {
  width: number;
  height: number;
  fps: number;
  shots: PlannedShot[];
  total: number;
  warnings: string[];
}

export class AssembleError extends Error {}

function fail(message: string): never {
  throw new AssembleError(message);
}

const TRANSITIONS = [
  'fade',
  'fadeblack',
  'fadewhite',
  'dissolve',
  'wipeleft',
  'wiperight',
  'slideleft',
  'slideright',
  'smoothleft',
  'smoothright',
  'circleopen',
];
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// ---------------------------------------------------------------------------
// Validation and planning (pure)

export function parseSize(value: string): { width: number; height: number } {
  const match = /^(\d{3,5})x(\d{3,5})$/.exec(value);
  if (!match) return fail(`size must look like 1920x1080, got "${value}"`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width % 2 || height % 2) fail(`size ${value} must have even width and height (H.264)`);
  return { width, height };
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateManifest(manifest: Manifest): void {
  if (!manifest.name || !/^[A-Za-z0-9._-]+$/.test(manifest.name)) {
    fail('name is required and may only use letters, digits, dot, dash and underscore');
  }
  parseSize(manifest.size);
  const fps = manifest.fps ?? 30;
  if (![24, 25, 30, 50, 60].includes(fps)) fail('fps must be 24, 25, 30, 50 or 60');
  if (!Array.isArray(manifest.shots) || manifest.shots.length === 0)
    fail('shots must not be empty');
  const ids = new Set<string>();
  for (const shot of manifest.shots) {
    if (!shot.id || !/^[A-Za-z0-9._-]+$/.test(shot.id)) fail(`shot id "${shot.id}" is not usable`);
    if (ids.has(shot.id)) fail(`duplicate shot id "${shot.id}"`);
    ids.add(shot.id);
    if (!shot.file) fail(`shot ${shot.id} has no file`);
    if (
      shot.audioFrom &&
      !(shot.audioFrom.file && finite(shot.audioFrom.start) && shot.audioFrom.start >= 0)
    ) {
      fail(`shot ${shot.id}: audioFrom needs a file and start >= 0`);
    }
    if (shot.focus !== undefined && !(shot.focus >= 0 && shot.focus <= 1)) {
      fail(`shot ${shot.id}: focus must be between 0 and 1`);
    }
    if (shot.duration !== undefined && !(finite(shot.duration) && shot.duration > 0)) {
      fail(`shot ${shot.id}: duration must be a positive number`);
    }
    for (const overlay of shot.text ?? []) {
      if (!overlay.text?.trim()) fail(`shot ${shot.id}: an overlay has no text`);
      if (
        !(
          finite(overlay.start) &&
          finite(overlay.end) &&
          overlay.start >= 0 &&
          overlay.end > overlay.start
        )
      ) {
        fail(`shot ${shot.id}: overlay "${overlay.text.slice(0, 20)}" needs 0 <= start < end`);
      }
    }
    if (shot.transition) {
      const type = shot.transition.type ?? 'fade';
      if (!TRANSITIONS.includes(type))
        fail(`shot ${shot.id}: transition must be one of ${TRANSITIONS.join(', ')}`);
      if (!(finite(shot.transition.duration) && shot.transition.duration > 0)) {
        fail(
          `shot ${shot.id}: transition.duration must be positive (omit transition for a hard cut)`
        );
      }
    }
  }
  for (const cut of manifest.cutdowns ?? []) {
    if (!/^[A-Za-z0-9._-]+$/.test(cut.name)) fail(`cutdown name "${cut.name}" is not usable`);
    parseSize(cut.size);
  }
}

export function planTimeline(manifest: Manifest, probes: Probe[], size: string): Plan {
  const { width, height } = parseSize(size);
  const fps = manifest.fps ?? 30;
  const warnings: string[] = [];
  const planned: PlannedShot[] = [];
  let cursor = 0;

  manifest.shots.forEach((shot, index) => {
    const probe = probes[index];
    const trimStart = shot.trim?.start ?? 0;
    let duration: number;
    if (probe.isImage) {
      if (!shot.duration) fail(`shot ${shot.id}: a still image needs "duration"`);
      duration = shot.duration;
    } else {
      const available = probe.duration - trimStart;
      if (available <= 0)
        fail(
          `shot ${shot.id}: trim.start ${trimStart}s is past the end of the clip (${probe.duration.toFixed(2)}s)`
        );
      duration = shot.trim?.duration ?? shot.duration ?? available;
      if (duration > available + 0.05) {
        fail(
          `shot ${shot.id}: asks for ${duration}s but only ${available.toFixed(2)}s is available after trim.start`
        );
      }
    }
    for (const overlay of shot.text ?? []) {
      if (overlay.end > duration + 0.01) {
        warnings.push(
          `shot ${shot.id}: text "${overlay.text.slice(0, 24)}" ends at ${overlay.end}s, after the shot (${duration.toFixed(2)}s)`
        );
      }
    }
    if (shot.audio === 'keep' && !probe.hasAudio) {
      warnings.push(
        `shot ${shot.id}: audio "keep" but the clip has no audio track; silence is used`
      );
    }
    planned.push({ shot, duration, start: cursor, end: cursor + duration, overlap: 0, probe });
    cursor += duration;
  });

  // Transitions overlap neighbours, so the timeline is shifted left by the running overlap.
  let shift = 0;
  planned.forEach((entry, index) => {
    entry.start -= shift;
    entry.end -= shift;
    const next = planned[index + 1];
    if (next && entry.shot.transition) {
      const t = entry.shot.transition.duration;
      if (t > Math.min(entry.duration, next.duration) / 2) {
        fail(`shot ${entry.shot.id}: transition ${t}s is longer than half of an adjacent shot`);
      }
      entry.overlap = t;
      shift += t;
    }
  });
  if (planned.at(-1)?.shot.transition) {
    warnings.push(`shot ${planned.at(-1)?.shot.id}: transition on the last shot is ignored`);
  }
  const total = planned.at(-1)?.end ?? 0;

  for (const entry of planned) {
    if (entry.probe.width && !entry.probe.isImage && entry.shot.fit !== 'contain') {
      const srcAspect = entry.probe.width / entry.probe.height;
      const dstAspect = width / height;
      if (Math.abs(srcAspect - dstAspect) > 0.02) {
        warnings.push(
          `shot ${entry.shot.id}: ${entry.probe.width}x${entry.probe.height} is cropped to ${width}x${height} (fit: cover)`
        );
      }
    }
  }
  return { width, height, fps, shots: planned, total, warnings };
}

// ---------------------------------------------------------------------------
// ffmpeg argument builders (pure)

export function wrapText(text: string, maxChars: number): string {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && `${line} ${word}`.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function yFor(position: Overlay['position'], width: number, height: number): string {
  const vertical = height > width;
  if (position === 'top') return 'h*0.10';
  if (position === 'center') return '(h-text_h)/2';
  // Keep the bottom 20% of vertical video clear for platform UI.
  return vertical ? 'h*0.64-text_h' : 'h*0.88-text_h';
}

function safeColor(value: string | undefined, fallback: string): string {
  return value && /^[A-Za-z0-9#@.]+$/.test(value) ? value : fallback;
}

export interface TextFile {
  name: string;
  content: string;
}

/** drawtext filters for one shot. The text itself goes in files, so nothing needs escaping. */
export function overlayFilters(
  shot: Shot,
  shotIndex: number,
  width: number,
  height: number,
  style: Style | undefined
): { filters: string[]; files: TextFile[] } {
  const minSide = Math.min(width, height);
  const fontSize = Math.round(minSide * (style?.fontSize ?? 0.06));
  const maxChars = Math.max(8, Math.floor((width * 0.84) / (fontSize * 0.55)));
  const color = safeColor(style?.color, 'white');
  const box = safeColor(style?.boxColor, 'black@0.55');
  const files: TextFile[] = [];
  const filters = (shot.text ?? []).map((overlay, index) => {
    const name = `t${shotIndex}_${index}.txt`;
    files.push({ name, content: wrapText(overlay.text, maxChars) });
    return (
      `drawtext=fontfile=font.ttf:textfile=${name}:fontsize=${fontSize}:fontcolor=${color}` +
      `:box=1:boxcolor=${box}:boxborderw=${Math.round(fontSize * 0.35)}:line_spacing=${Math.round(fontSize * 0.2)}` +
      `:x=(w-text_w)/2:y=${yFor(overlay.position, width, height)}` +
      `:enable='between(t,${overlay.start},${overlay.end})'`
    );
  });
  return { filters, files };
}

export function videoFilter(
  shot: Shot,
  width: number,
  height: number,
  fps: number,
  fitOverride: Cutdown['fit'],
  focusOverride: number | undefined,
  extra: string[]
): string {
  const fit = fitOverride ?? shot.fit ?? 'cover';
  const focus = focusOverride ?? shot.focus ?? 0.5;
  const fitChain =
    fit === 'cover'
      ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}:(in_w-${width})*${focus}:(in_h-${height})/2`
      : `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`;
  return [fitChain, 'setsar=1', `fps=${fps}`, 'format=yuv420p', ...extra].join(',');
}

export function shotArgs(
  entry: PlannedShot,
  shotIndex: number,
  plan: Plan,
  cut: { fit?: Cutdown['fit']; focus?: number },
  style: Style | undefined,
  inputPath: string,
  outName: string,
  audioInputPath?: string
): { args: string[]; files: TextFile[] } {
  const { filters, files } = overlayFilters(entry.shot, shotIndex, plan.width, plan.height, style);
  const vf = videoFilter(
    entry.shot,
    plan.width,
    plan.height,
    plan.fps,
    cut.fit,
    cut.focus,
    filters
  );
  const d = entry.duration.toFixed(3);
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  if (entry.probe.isImage) {
    args.push('-loop', '1', '-framerate', String(plan.fps), '-t', d, '-i', inputPath);
  } else {
    args.push('-ss', String(entry.shot.trim?.start ?? 0), '-t', d, '-i', inputPath);
  }
  const keepAudio =
    !audioInputPath && entry.shot.audio === 'keep' && entry.probe.hasAudio && !entry.probe.isImage;
  if (audioInputPath) {
    args.push('-ss', String(entry.shot.audioFrom?.start ?? 0), '-t', d, '-i', audioInputPath);
  } else if (!keepAudio) {
    args.push('-f', 'lavfi', '-t', d, '-i', 'anullsrc=r=48000:cl=stereo');
  }
  args.push('-map', '0:v:0', '-map', keepAudio ? '0:a:0' : '1:a:0', '-vf', vf);
  args.push(
    '-af',
    `aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur=${d},atrim=0:${d}`
  );
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-t',
    d,
    '-movflags',
    '+faststart',
    outName
  );
  return { args, files };
}

/** Join the normalised shot files. Hard cuts only: concat demuxer, video copied. */
export function concatListArgs(listName: string, outName: string): string[] {
  return [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listName,
    '-c:v',
    'copy',
    '-c:a',
    'pcm_s16le',
    outName,
  ];
}

/** Final remux when there is no voiceover or music to mix: one AAC encode, video copied. */
export function finalizeArgs(inName: string, outName: string): string[] {
  return [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inName,
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    outName,
  ];
}

/** Join with at least one transition: one filter graph, cuts via concat, fades via xfade. */
export function joinGraphArgs(plan: Plan, fileNames: string[], outName: string): string[] {
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  for (const name of fileNames) args.push('-i', name);
  const parts: string[] = [];
  let curV = '0:v';
  let curA = '0:a';
  let runLength = plan.shots[0].duration;
  for (let i = 1; i < plan.shots.length; i++) {
    const prev = plan.shots[i - 1];
    const label = `j${i}`;
    if (prev.overlap > 0) {
      const type = prev.shot.transition?.type ?? 'fade';
      const offset = (runLength - prev.overlap).toFixed(3);
      parts.push(
        `[${curV}][${i}:v]xfade=transition=${type}:duration=${prev.overlap}:offset=${offset}[${label}v]`
      );
      parts.push(`[${curA}][${i}:a]acrossfade=d=${prev.overlap}[${label}a]`);
      runLength = runLength - prev.overlap + plan.shots[i].duration;
    } else {
      parts.push(`[${curV}][${curA}][${i}:v][${i}:a]concat=n=2:v=1:a=1[${label}v][${label}a]`);
      runLength += plan.shots[i].duration;
    }
    curV = `${label}v`;
    curA = `${label}a`;
  }
  args.push('-filter_complex', parts.join(';'), '-map', `[${curV}]`, '-map', `[${curA}]`);
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'pcm_s16le',
    outName
  );
  return args;
}

export function mixArgs(
  manifest: Manifest,
  plan: Plan,
  paths: { assembled: string; voice?: string; music?: string },
  outName: string
): string[] | undefined {
  const voice = manifest.voiceover;
  const music = manifest.music;
  if (!voice && !music) return undefined;
  const total = plan.total.toFixed(3);
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', paths.assembled];
  const graph: string[] = ['[0:a]anull[base]'];
  const mixInputs = ['[base]'];
  let next = 1;
  if (voice && paths.voice) {
    args.push('-i', paths.voice);
    const delay = Math.round((voice.start ?? 0) * 1000);
    graph.push(
      `[${next}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${delay}|${delay},volume=${voice.gainDb ?? 0}dB[vo]`
    );
    next++;
  }
  if (music && paths.music) {
    args.push('-stream_loop', '-1', '-i', paths.music);
    const fade = music.fadeOut ?? 1.5;
    const fadeStart = Math.max(0, plan.total - fade).toFixed(3);
    graph.push(
      `[${next}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${total},asetpts=PTS-STARTPTS,afade=t=out:st=${fadeStart}:d=${fade},volume=${music.gainDb ?? -18}dB[mus]`
    );
  }
  const duck = music && voice && (music.duck ?? true);
  if (voice && paths.voice) {
    if (duck) {
      graph.push('[vo]asplit=2[vo1][vo2]');
      graph.push('[mus][vo2]sidechaincompress=threshold=0.04:ratio=10:attack=20:release=500[musd]');
      mixInputs.push('[vo1]', '[musd]');
    } else {
      mixInputs.push('[vo]');
      if (music && paths.music) mixInputs.push('[mus]');
    }
  } else if (music && paths.music) {
    mixInputs.push('[mus]');
  }
  const loudness = manifest.loudness ?? -14;
  graph.push(
    `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:normalize=0,loudnorm=I=${loudness}:TP=-1.5:LRA=11[aout]`
  );
  args.push(
    '-filter_complex',
    graph.join(';'),
    '-map',
    '0:v:0',
    '-map',
    '[aout]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-t',
    total,
    '-movflags',
    '+faststart',
    outName
  );
  return args;
}

// ---------------------------------------------------------------------------
// Running ffmpeg / ffprobe

export function runTool(tool: 'ffmpeg' | 'ffprobe', args: string[], cwd?: string): string {
  const result = spawnSync(tool, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    return fail(
      `${tool} is not available: ${result.error.message}. Install ffmpeg and put it on PATH.`
    );
  }
  if (result.status !== 0) {
    return fail(
      `${tool} failed (exit ${result.status}): ${(result.stderr || result.stdout).trim().slice(-800)}`
    );
  }
  return result.stdout;
}

interface ProbeJson {
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
    avg_frame_rate?: string;
    pix_fmt?: string;
    codec_name?: string;
    duration?: string;
  }>;
  format?: { duration?: string };
}

export function probeFile(path: string): Probe {
  if (!existsSync(path)) fail(`file not found: ${path}`);
  const json = JSON.parse(
    runTool('ffprobe', [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      path,
    ])
  ) as ProbeJson;
  const video = json.streams?.find((s) => s.codec_type === 'video');
  if (!video) return fail(`${path} has no video stream`);
  const isImage = IMAGE_EXT.has(extname(path).toLowerCase());
  const duration = Number(json.format?.duration ?? video.duration ?? 0);
  return {
    duration: Number.isFinite(duration) ? duration : 0,
    hasAudio: Boolean(json.streams?.some((s) => s.codec_type === 'audio')),
    isImage,
    width: video.width ?? 0,
    height: video.height ?? 0,
  };
}

export function probeAudio(path: string): number {
  if (!existsSync(path)) fail(`file not found: ${path}`);
  const json = JSON.parse(
    runTool('ffprobe', [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      path,
    ])
  ) as ProbeJson;
  if (!json.streams?.some((s) => s.codec_type === 'audio')) fail(`${path} has no audio stream`);
  return Number(json.format?.duration ?? 0);
}

export interface Check {
  ok: boolean;
  width: number;
  height: number;
  fps: number;
  duration: number;
  videoCodec: string;
  pixFmt: string;
  hasAudio: boolean;
  problems: string[];
}

export function checkOutput(
  path: string,
  expect: { width: number; height: number; fps: number; duration: number }
): Check {
  const json = JSON.parse(
    runTool('ffprobe', [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      path,
    ])
  ) as ProbeJson;
  const video = json.streams?.find((s) => s.codec_type === 'video');
  const [num, den] = (video?.avg_frame_rate ?? '0/1').split('/').map(Number);
  const fps = den ? num / den : 0;
  const duration = Number(json.format?.duration ?? 0);
  const check: Check = {
    ok: true,
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    fps: Math.round(fps * 100) / 100,
    duration: Math.round(duration * 1000) / 1000,
    videoCodec: video?.codec_name ?? '',
    pixFmt: video?.pix_fmt ?? '',
    hasAudio: Boolean(json.streams?.some((s) => s.codec_type === 'audio')),
    problems: [],
  };
  if (check.width !== expect.width || check.height !== expect.height)
    check.problems.push(
      `size ${check.width}x${check.height}, expected ${expect.width}x${expect.height}`
    );
  if (Math.abs(check.fps - expect.fps) > 0.1)
    check.problems.push(`frame rate ${check.fps}, expected ${expect.fps}`);
  if (Math.abs(check.duration - expect.duration) > 0.25)
    check.problems.push(`duration ${check.duration}s, expected ${expect.duration.toFixed(2)}s`);
  if (check.videoCodec !== 'h264') check.problems.push(`codec ${check.videoCodec}, expected h264`);
  if (check.pixFmt !== 'yuv420p')
    check.problems.push(`pixel format ${check.pixFmt}, expected yuv420p`);
  if (!check.hasAudio) check.problems.push('no audio track');
  check.ok = check.problems.length === 0;
  return check;
}

// ---------------------------------------------------------------------------
// Fonts

const FONT_CANDIDATES = [
  '/usr/share/fonts/opentype/inter/Inter-Bold.otf',
  '/usr/share/fonts/truetype/inter/Inter-Bold.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/Library/Fonts/Arial Bold.ttf',
  'C:\\Windows\\Fonts\\arialbd.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
];

export function findFont(manifest: Manifest, baseDir: string): string | undefined {
  if (manifest.font) {
    const path = resolve(baseDir, manifest.font);
    if (!existsSync(path)) fail(`font not found: ${path}`);
    return path;
  }
  const fromEnv = process.env.ADPACK_FONT;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return FONT_CANDIDATES.find((candidate) => existsSync(candidate));
}

// ---------------------------------------------------------------------------
// Commands

function loadManifest(path: string): { manifest: Manifest; baseDir: string } {
  let manifest: Manifest;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8')) as Manifest;
  } catch (err) {
    return fail(
      `cannot read manifest ${path}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  validateManifest(manifest);
  return { manifest, baseDir: dirname(resolve(path)) };
}

function probeAll(manifest: Manifest, baseDir: string): Probe[] {
  return manifest.shots.map((shot) => probeFile(resolve(baseDir, shot.file)));
}

/** Warn when a shot asks for sound past the end of the file it borrows it from. */
export function audioFromWarnings(plan: Plan, baseDir: string): string[] {
  const durations = new Map<string, number>();
  const warnings: string[] = [];
  for (const entry of plan.shots) {
    const source = entry.shot.audioFrom;
    if (!source) continue;
    const path = resolve(baseDir, source.file);
    if (!durations.has(path)) durations.set(path, probeAudio(path));
    const available = durations.get(path) ?? 0;
    if (source.start + entry.duration > available + 0.1) {
      warnings.push(
        `shot ${entry.shot.id}: sound from ${source.file} runs ${source.start}s to ${(source.start + entry.duration).toFixed(2)}s but the file is ${available.toFixed(2)}s long; the rest is silent`
      );
    }
  }
  return warnings;
}

function hasText(manifest: Manifest): boolean {
  return manifest.shots.some((shot) => (shot.text ?? []).length > 0);
}

function describePlan(plan: Plan): Record<string, unknown> {
  return {
    size: `${plan.width}x${plan.height}`,
    fps: plan.fps,
    totalSeconds: Math.round(plan.total * 1000) / 1000,
    timeline: plan.shots.map((entry) => ({
      id: entry.shot.id,
      start: Math.round(entry.start * 1000) / 1000,
      end: Math.round(entry.end * 1000) / 1000,
      transitionOut: entry.overlap || undefined,
      text: (entry.shot.text ?? []).map((o) => o.text),
    })),
    warnings: plan.warnings,
  };
}

export interface BuildResult {
  name: string;
  file: string;
  check: Check;
}

export function buildOne(
  manifest: Manifest,
  baseDir: string,
  probes: Probe[],
  size: string,
  cut: { fit?: Cutdown['fit']; focus?: number },
  outFile: string,
  workDir: string,
  fontPath: string | undefined
): { plan: Plan; check: Check } {
  const plan = planTimeline(manifest, probes, size);
  mkdirSync(workDir, { recursive: true });
  if (hasText(manifest)) {
    if (!fontPath) fail('on-screen text needs a font: set "font" in the manifest or ADPACK_FONT');
    copyFileSync(fontPath, join(workDir, 'font.ttf'));
  }

  const shotFiles: string[] = [];
  plan.shots.forEach((entry, index) => {
    const out = `shot${index}.mov`;
    const { args, files } = shotArgs(
      entry,
      index,
      plan,
      cut,
      manifest.style,
      resolve(baseDir, entry.shot.file),
      out,
      entry.shot.audioFrom ? resolve(baseDir, entry.shot.audioFrom.file) : undefined
    );
    for (const file of files) writeFileSync(join(workDir, file.name), file.content);
    runTool('ffmpeg', args, workDir);
    shotFiles.push(out);
  });

  const joined = 'joined.mov';
  if (plan.shots.some((entry) => entry.overlap > 0)) {
    runTool('ffmpeg', joinGraphArgs(plan, shotFiles, joined), workDir);
  } else if (shotFiles.length === 1) {
    copyFileSync(join(workDir, shotFiles[0]), join(workDir, joined));
  } else {
    writeFileSync(join(workDir, 'list.txt'), shotFiles.map((name) => `file '${name}'`).join('\n'));
    runTool('ffmpeg', concatListArgs('list.txt', joined), workDir);
  }

  const final = 'final.mp4';
  const mix = mixArgs(
    manifest,
    plan,
    {
      assembled: joined,
      voice: manifest.voiceover ? resolve(baseDir, manifest.voiceover.file) : undefined,
      music: manifest.music ? resolve(baseDir, manifest.music.file) : undefined,
    },
    final
  );
  runTool('ffmpeg', mix ?? finalizeArgs(joined, final), workDir);
  copyFileSync(join(workDir, final), outFile);

  const check = checkOutput(outFile, {
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    duration: plan.total,
  });
  return { plan, check };
}

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function plan(argv: string[]): unknown {
  const manifestPath = argv[0];
  if (!manifestPath) fail('usage: assemble.ts plan <pack.json>');
  const { manifest, baseDir } = loadManifest(manifestPath);
  const probes = probeAll(manifest, baseDir);
  const master = planTimeline(manifest, probes, manifest.size);
  const warnings = [...master.warnings, ...audioFromWarnings(master, baseDir)];
  if (manifest.voiceover) {
    const voiceDuration = probeAudio(resolve(baseDir, manifest.voiceover.file));
    const voiceEnd = (manifest.voiceover.start ?? 0) + voiceDuration;
    if (voiceEnd > master.total + 0.1) {
      warnings.push(
        `voiceover runs to ${voiceEnd.toFixed(2)}s but the video ends at ${master.total.toFixed(2)}s; it will be cut`
      );
    }
  }
  if (manifest.music) probeAudio(resolve(baseDir, manifest.music.file));
  if (hasText(manifest) && !findFont(manifest, baseDir))
    warnings.push('no font found for on-screen text; set "font" or ADPACK_FONT');
  return {
    name: manifest.name,
    master: { ...describePlan(master), warnings },
    cutdowns: (manifest.cutdowns ?? []).map((cut) => ({
      name: cut.name,
      size: cut.size,
      fit: cut.fit ?? 'cover',
    })),
    note: 'Nothing rendered. Run `build` to render.',
  };
}

function build(argv: string[]): unknown {
  const manifestPath = argv[0];
  if (!manifestPath) fail('usage: assemble.ts build <pack.json> --out <dir>');
  const outDir = resolve(flagValue(argv, 'out') ?? './out');
  const { manifest, baseDir } = loadManifest(manifestPath);
  const probes = probeAll(manifest, baseDir);
  const font = hasText(manifest) ? findFont(manifest, baseDir) : undefined;
  mkdirSync(outDir, { recursive: true });
  const keepWork = argv.includes('--keep-work');
  const only = flagValue(argv, 'only');

  const jobs: Array<{
    label: string;
    size: string;
    cut: { fit?: Cutdown['fit']; focus?: number };
    file: string;
  }> = [];
  if (!only || only === 'master')
    jobs.push({
      label: 'master',
      size: manifest.size,
      cut: {},
      file: join(outDir, `${manifest.name}.mp4`),
    });
  for (const cut of manifest.cutdowns ?? []) {
    if (only && only !== cut.name) continue;
    jobs.push({
      label: cut.name,
      size: cut.size,
      cut: { fit: cut.fit, focus: cut.focus },
      file: join(outDir, `${manifest.name}-${cut.name}.mp4`),
    });
  }
  if (jobs.length === 0) fail(`nothing to build: --only ${only} matches no master or cutdown`);

  const results = jobs.map((job) => {
    const workDir = join(outDir, '.work', job.label);
    rmSync(workDir, { recursive: true, force: true });
    const { plan: built, check } = buildOne(
      manifest,
      baseDir,
      probes,
      job.size,
      job.cut,
      job.file,
      workDir,
      font
    );
    if (!keepWork) rmSync(workDir, { recursive: true, force: true });
    return {
      label: job.label,
      file: job.file,
      bytes: statSync(job.file).size,
      ...describePlan(built),
      check,
    };
  });
  if (!keepWork) rmSync(join(outDir, '.work'), { recursive: true, force: true });

  const record = {
    name: manifest.name,
    builtWith: 'ad-pack-assembly (local ffmpeg, no model call)',
    outputs: results,
    notChecked: [
      'playback on a real phone',
      'platform upload limits',
      'whether the shots match the brief',
    ],
  };
  writeFileSync(
    join(outDir, `${manifest.name}.build.json`),
    `${JSON.stringify(record, null, 2)}\n`
  );
  if (results.some((r) => !r.check.ok)) {
    process.exitCode = 1;
  }
  return record;
}

function frames(argv: string[]): unknown {
  const file = argv[0];
  if (!file || !existsSync(file))
    fail('usage: assemble.ts frames <video.mp4> [--count 8] [--out dir]');
  const count = Math.max(1, Number(flagValue(argv, 'count') ?? 8));
  const outDir = resolve(flagValue(argv, 'out') ?? join(dirname(resolve(file)), 'frames'));
  mkdirSync(outDir, { recursive: true });
  const duration = probeFile(file).duration;
  const written: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) / count) * duration;
    const out = join(
      outDir,
      `${basename(file, extname(file))}-${String(i + 1).padStart(2, '0')}.png`
    );
    runTool('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      t.toFixed(3),
      '-i',
      file,
      '-frames:v',
      '1',
      out,
    ]);
    written.push(out);
  }
  return { frames: written, note: 'Open every frame before calling the pack done.' };
}

export function main(argv: string[]): unknown {
  const [command, ...rest] = argv;
  if (command === 'plan') return plan(rest);
  if (command === 'build') return build(rest);
  if (command === 'frames') return frames(rest);
  return fail('usage: assemble.ts <plan|build|frames> ...');
}

if (import.meta.main) {
  try {
    process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`ad-pack-assembly: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
