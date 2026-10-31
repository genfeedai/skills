#!/usr/bin/env bun
/**
 * clip-cutter: cut, reframe to 9:16, burn captions, normalise loudness and
 * encode short vertical clips from a long recording with local ffmpeg.
 * No API calls, no npm packages.
 *
 *   bun run scripts/cut.ts --source talk.mp4 --clips clips.json [--out out/clips] [--dry-run]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface Word {
  e: number;
  s: number;
  w: string;
}

interface ClipSpec {
  id: string;
  /** End in the source, as seconds or HH:MM:SS(.ms). */
  end: number | string;
  /** Optional horizontal crop position for layout "fill", 0 left to 1 right. */
  focusX?: number;
  /** Path to an SRT file with times relative to the source. */
  srt?: string;
  start: number | string;
  /** Word timings relative to the source, in seconds. */
  words?: Word[];
}

interface CaptionStyle {
  fontName: string;
  fontSize: number;
  marginV: number;
  maxWordsPerGroup: number;
  outlineColor: string;
  primaryColor: string;
  uppercase: boolean;
}

interface EndCard {
  background: string;
  foreground: string;
  seconds: number;
  text: string;
}

interface Profile {
  captions: CaptionStyle;
  endCard?: EndCard;
  fadeMs: number;
  fontsDir?: string;
  fps: number;
  layout: 'fill' | 'fit';
  loudnessLufs: number;
  truePeakDb: number;
  version: string;
}

interface Spec {
  clips: ClipSpec[];
  profile?: Partial<Profile> & { captions?: Partial<CaptionStyle> };
}

const WIDTH = 1080;
const HEIGHT = 1920;
const MIN_SECONDS = 1;
const MAX_SECONDS = 180;

const DEFAULT_PROFILE: Profile = {
  captions: {
    fontName: 'Arial',
    fontSize: 78,
    marginV: 520,
    maxWordsPerGroup: 3,
    outlineColor: '#000000',
    primaryColor: '#FFFFFF',
    uppercase: true,
  },
  fadeMs: 15,
  fps: 30,
  layout: 'fit',
  loudnessLufs: -16,
  truePeakDb: -1.5,
  version: 'unversioned',
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message: string): never {
  process.stderr.write(`clip-cutter: ${message}\n`);
  process.exit(1);
}

function need(tool: string): void {
  if (spawnSync(tool, ['-version'], { stdio: 'ignore' }).status !== 0) {
    fail(`${tool} not found on PATH`);
  }
}

function toSeconds(value: number | string): number {
  if (typeof value === 'number') return value;
  const parts = value.split(':').map(Number);
  if (parts.some((part) => Number.isNaN(part))) fail(`bad time "${value}"`);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function ffmpeg(args: string[]): { stderr: string; status: number | null } {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], {
    encoding: 'utf8',
  });
  return { status: result.status, stderr: result.stderr };
}

function probe(args: string[]): string {
  const result = spawnSync('ffprobe', ['-v', 'error', ...args], { encoding: 'utf8' });
  if (result.status !== 0) fail(`ffprobe failed: ${result.stderr.slice(0, 200)}`);
  return result.stdout.trim();
}

/** ASS colours are &HAABBGGRR. */
function assColor(hex: string): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) fail(`bad colour "${hex}"`);
  const [r, g, b] = [full.slice(0, 2), full.slice(2, 4), full.slice(4, 6)];
  return `&H00${b}${g}${r}`.toUpperCase();
}

function assTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

function assText(text: string): string {
  return text.replace(/[{}\\]/g, '').replace(/\n/g, '\\N');
}

interface Cue {
  e: number;
  s: number;
  t: string;
}

function parseSrt(path: string): Cue[] {
  const raw = readFileSync(resolve(path), 'utf8').replace(/\r/g, '');
  const cues: Cue[] = [];
  for (const block of raw.split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean);
    const timing = lines.find((line) => line.includes('-->'));
    if (!timing) continue;
    const [from, to] = timing.split('-->').map((part) => toSeconds(part.trim().replace(',', '.')));
    const text = lines.slice(lines.indexOf(timing) + 1).join(' ');
    if (from !== undefined && to !== undefined && text) cues.push({ e: to, s: from, t: text });
  }
  return cues;
}

function groupWords(words: Word[], size: number): Cue[] {
  const cues: Cue[] = [];
  for (let i = 0; i < words.length; i += size) {
    const group = words.slice(i, i + size);
    const first = group[0];
    const last = group[group.length - 1];
    if (first && last) cues.push({ e: last.e, s: first.s, t: group.map((w) => w.w).join(' ') });
  }
  return cues;
}

function buildAss(cues: Cue[], clipStart: number, clipEnd: number, style: CaptionStyle): string {
  const events = cues
    .filter((cue) => cue.e > clipStart && cue.s < clipEnd)
    .map((cue) => {
      const text = style.uppercase ? cue.t.toUpperCase() : cue.t;
      const from = Math.max(cue.s, clipStart) - clipStart;
      const to = Math.min(cue.e, clipEnd) - clipStart;
      return `Dialogue: 0,${assTime(from)},${assTime(to)},Cap,,0,0,0,,${assText(text)}`;
    })
    .join('\n');
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${WIDTH}
PlayResY: ${HEIGHT}
WrapStyle: 2

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Cap,${style.fontName},${style.fontSize},${assColor(style.primaryColor)},&H000000FF,${assColor(style.outlineColor)},&H00000000,1,0,0,0,100,100,0,0,1,6,0,2,80,80,${style.marginV},1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
${events}
`;
}

function filterPath(path: string): string {
  // ffmpeg filter arguments need ':' and "'" escaped.
  return path.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function videoFilter(profile: Profile, focusX: number, assPath: string): string {
  const ass = `ass='${filterPath(assPath)}'${profile.fontsDir ? `:fontsdir='${filterPath(resolve(profile.fontsDir))}'` : ''}`;
  const fade = profile.fadeMs / 1000;
  const base =
    profile.layout === 'fill'
      ? `[0:v]scale=-2:${HEIGHT},crop=${WIDTH}:${HEIGHT}:(iw-${WIDTH})*${focusX}:0,setsar=1[v0]`
      : `[0:v]split[a][b];[a]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},boxblur=40:10,eq=brightness=-0.12[bg];[b]scale=${WIDTH}:-2:force_original_aspect_ratio=decrease,setsar=1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v0]`;
  return `${base};[v0]fps=${profile.fps},setsar=1,${ass},fade=t=in:st=0:d=${fade}[v]`;
}

function cutClip(
  source: string,
  clip: ClipSpec,
  profile: Profile,
  out: string,
  duration: number
): Record<string, unknown> {
  const start = toSeconds(clip.start);
  const end = toSeconds(clip.end);
  const length = end - start;
  if (!(length >= MIN_SECONDS && length <= MAX_SECONDS)) {
    fail(`${clip.id}: length ${length.toFixed(1)}s is outside ${MIN_SECONDS}-${MAX_SECONDS}s`);
  }
  if (start < 0 || end > duration + 0.05)
    fail(`${clip.id}: ${start}-${end}s is outside the source (${duration.toFixed(1)}s)`);
  const cues = clip.words
    ? groupWords(clip.words, profile.captions.maxWordsPerGroup)
    : clip.srt
      ? parseSrt(clip.srt)
      : [];
  if (cues.length === 0) fail(`${clip.id}: needs "words" or "srt"; captions are required`);

  const assPath = join(out, `.${clip.id}.ass`);
  writeFileSync(assPath, buildAss(cues, start, end, profile.captions));
  const fade = profile.fadeMs / 1000;
  const body = join(out, `.${clip.id}.body.mp4`);
  const filter = videoFilter(profile, clip.focusX ?? 0.5, assPath);
  const audio = `[0:a]loudnorm=I=${profile.loudnessLufs}:TP=${profile.truePeakDb}:LRA=11,afade=t=in:st=0:d=${fade},afade=t=out:st=${Math.max(0, length - fade).toFixed(3)}:d=${fade}[a]`;
  const encode = [
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ar',
    '48000',
    '-movflags',
    '+faststart',
  ];
  const result = ffmpeg([
    '-ss',
    String(start),
    '-t',
    String(length),
    '-i',
    source,
    '-filter_complex',
    `${filter};${audio}`,
    '-map',
    '[v]',
    '-map',
    '[a]',
    ...encode,
    body,
  ]);
  rmSync(assPath, { force: true });
  if (result.status !== 0) fail(`${clip.id}: ffmpeg failed: ${result.stderr.slice(0, 400)}`);

  const file = join(out, `${clip.id}.mp4`);
  if (profile.endCard) {
    const card = profile.endCard;
    const cardAss = join(out, `.${clip.id}.card.ass`);
    const cardCue: Cue[] = [{ e: card.seconds, s: 0, t: card.text }];
    writeFileSync(
      cardAss,
      buildAss(cardCue, 0, card.seconds, {
        ...profile.captions,
        fontSize: 96,
        marginV: 880,
        primaryColor: card.foreground,
        uppercase: false,
      })
    );
    const cardFile = join(out, `.${clip.id}.card.mp4`);
    const bg = card.background.replace('#', '0x');
    const made = ffmpeg([
      '-f',
      'lavfi',
      '-i',
      `color=c=${bg}:s=${WIDTH}x${HEIGHT}:r=${profile.fps}:d=${card.seconds}`,
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=48000:cl=stereo`,
      '-t',
      String(card.seconds),
      '-vf',
      `ass='${filterPath(cardAss)}'`,
      ...encode,
      cardFile,
    ]);
    rmSync(cardAss, { force: true });
    if (made.status !== 0) fail(`${clip.id}: end card failed: ${made.stderr.slice(0, 300)}`);
    const joined = ffmpeg([
      '-i',
      body,
      '-i',
      cardFile,
      '-filter_complex',
      '[0:v]setsar=1[va];[1:v]setsar=1[vb];[va][0:a][vb][1:a]concat=n=2:v=1:a=1[v][a]',
      '-map',
      '[v]',
      '-map',
      '[a]',
      ...encode,
      file,
    ]);
    rmSync(cardFile, { force: true });
    rmSync(body, { force: true });
    if (joined.status !== 0) {
      rmSync(file, { force: true });
      fail(`${clip.id}: join failed: ${joined.stderr.slice(0, 300)}`);
    }
  } else {
    ffmpeg(['-i', body, '-c', 'copy', file]);
    rmSync(body, { force: true });
  }
  return measure(clip.id, file, start, end);
}

function measure(id: string, file: string, start: number, end: number): Record<string, unknown> {
  const streams = JSON.parse(probe(['-show_streams', '-show_format', '-of', 'json', file])) as {
    format: { duration: string };
    streams: Array<{
      codec_name: string;
      codec_type: string;
      height?: number;
      r_frame_rate?: string;
      width?: number;
    }>;
  };
  const video = streams.streams.find((s) => s.codec_type === 'video');
  const audio = streams.streams.find((s) => s.codec_type === 'audio');
  const loud = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
    { encoding: 'utf8' }
  );
  const summary = loud.stderr.slice(loud.stderr.lastIndexOf('Summary:'));
  const integrated = /I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1];
  const peak = /Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1];
  return {
    audioCodec: audio?.codec_name,
    file,
    height: video?.height,
    id,
    integratedLufs: integrated ? Number(integrated) : null,
    seconds: Math.round(Number(streams.format.duration) * 100) / 100,
    sourceRange: [start, end],
    truePeakDbfs: peak ? Number(peak) : null,
    videoCodec: video?.codec_name,
    width: video?.width,
  };
}

function main(): void {
  const source = arg('source');
  const clipsPath = arg('clips');
  if (!source || !clipsPath) fail('--source <video> and --clips <clips.json> are required');
  if (!existsSync(resolve(source))) fail(`source not found: ${source}`);
  need('ffmpeg');
  need('ffprobe');
  const spec = JSON.parse(readFileSync(resolve(clipsPath), 'utf8')) as Spec;
  if (!Array.isArray(spec.clips) || spec.clips.length === 0)
    fail('clips.json needs at least one clip');
  const profile: Profile = {
    ...DEFAULT_PROFILE,
    ...spec.profile,
    captions: { ...DEFAULT_PROFILE.captions, ...spec.profile?.captions },
  };
  const out = resolve(arg('out') ?? 'clips-out');
  const duration = Number(
    probe(['-show_entries', 'format=duration', '-of', 'csv=p=0', resolve(source)])
  );
  if (process.argv.includes('--dry-run')) {
    const plan = spec.clips.map((clip) => ({
      id: clip.id,
      seconds: toSeconds(clip.end) - toSeconds(clip.start),
      start: toSeconds(clip.start),
    }));
    process.stdout.write(
      `${JSON.stringify({ dryRun: true, layout: profile.layout, plan, sourceSeconds: duration }, null, 2)}\n`
    );
    return;
  }
  mkdirSync(out, { recursive: true });
  const clips = spec.clips.map((clip) => cutClip(resolve(source), clip, profile, out, duration));
  const manifest = {
    clips,
    profileVersion: profile.version,
    renderedAt: new Date().toISOString(),
    source: resolve(source),
  };
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

main();
