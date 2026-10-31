import { beforeAll, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  joinGraphArgs,
  type Manifest,
  main,
  mixArgs,
  overlayFilters,
  type Probe,
  parseSize,
  planTimeline,
  shotArgs,
  validateManifest,
  wrapText,
} from './assemble';

const video = (duration: number, extra: Partial<Probe> = {}): Probe => ({
  duration,
  hasAudio: true,
  isImage: false,
  width: 1920,
  height: 1080,
  ...extra,
});

const base = (shots: Manifest['shots'], extra: Partial<Manifest> = {}): Manifest => ({
  name: 'pack',
  size: '1920x1080',
  fps: 30,
  shots,
  ...extra,
});

describe('manifest validation', () => {
  it.each([
    ['an odd size', { size: '1921x1080' }, 'even'],
    ['a malformed size', { size: '1080p' }, 'size must look like'],
    ['an unsupported frame rate', { fps: 29 }, 'fps must be'],
    ['no shots', { shots: [] }, 'shots must not be empty'],
    ['an unusable name', { name: '../escape' }, 'name is required'],
  ])('rejects %s', (_label, patch, message) => {
    expect(() =>
      validateManifest({ ...base([{ id: 'a', file: 'a.mp4' }]), ...patch } as Manifest)
    ).toThrow(message);
  });

  it('rejects duplicate shot ids and unknown transitions', () => {
    expect(() =>
      validateManifest(
        base([
          { id: 'a', file: 'a.mp4' },
          { id: 'a', file: 'b.mp4' },
        ])
      )
    ).toThrow('duplicate shot id');
    expect(() =>
      validateManifest(
        base([
          { id: 'a', file: 'a.mp4', transition: { type: 'explode', duration: 1 } },
          { id: 'b', file: 'b.mp4' },
        ])
      )
    ).toThrow('transition must be one of');
  });

  it('parses a valid size', () => {
    expect(parseSize('1080x1920')).toEqual({ width: 1080, height: 1920 });
  });
});

describe('timeline', () => {
  it('lays hard cuts end to end', () => {
    const manifest = base([
      { id: 'a', file: 'a.mp4' },
      { id: 'b', file: 'b.mp4', trim: { duration: 3 } },
    ]);
    const plan = planTimeline(manifest, [video(4), video(10)], manifest.size);
    expect(plan.shots.map((s) => [s.start, s.end])).toEqual([
      [0, 4],
      [4, 7],
    ]);
    expect(plan.total).toBe(7);
  });

  it('shortens the timeline by each crossfade', () => {
    const manifest = base([
      { id: 'a', file: 'a.mp4', transition: { duration: 0.5 } },
      { id: 'b', file: 'b.mp4', transition: { duration: 1 } },
      { id: 'c', file: 'c.mp4' },
    ]);
    const plan = planTimeline(manifest, [video(4), video(4), video(4)], manifest.size);
    expect(plan.shots.map((s) => [s.start, s.end])).toEqual([
      [0, 4],
      [3.5, 7.5],
      [6.5, 10.5],
    ]);
    expect(plan.total).toBe(10.5);
  });

  it('builds the crossfade offsets from the running length', () => {
    const manifest = base([
      { id: 'a', file: 'a.mp4', transition: { duration: 0.5 } },
      { id: 'b', file: 'b.mp4' },
      { id: 'c', file: 'c.mp4' },
    ]);
    const plan = planTimeline(manifest, [video(4), video(4), video(4)], manifest.size);
    const graph = joinGraphArgs(plan, ['s0.mp4', 's1.mp4', 's2.mp4'], 'out.mp4').join(' ');
    expect(graph).toContain('xfade=transition=fade:duration=0.5:offset=3.500');
    expect(graph).toContain('acrossfade=d=0.5');
    expect(graph).toContain('concat=n=2:v=1:a=1');
  });

  it('needs a duration for a still image', () => {
    const manifest = base([{ id: 'card', file: 'card.png' }]);
    expect(() => planTimeline(manifest, [video(0, { isImage: true })], manifest.size)).toThrow(
      'needs "duration"'
    );
  });

  it.each([
    ['a trim past the end of the clip', { trim: { start: 5 } }, 'past the end'],
    ['more footage than the clip has', { trim: { duration: 9 } }, 'only'],
  ])('rejects %s', (_label, patch, message) => {
    const manifest = base([{ id: 'a', file: 'a.mp4', ...patch }]);
    expect(() => planTimeline(manifest, [video(4)], manifest.size)).toThrow(message);
  });

  it('rejects a transition longer than half a shot', () => {
    const manifest = base([
      { id: 'a', file: 'a.mp4', transition: { duration: 3 } },
      { id: 'b', file: 'b.mp4' },
    ]);
    expect(() => planTimeline(manifest, [video(4), video(4)], manifest.size)).toThrow(
      'longer than half'
    );
  });

  it('warns about text that outlives its shot and about cropping', () => {
    const manifest = base(
      [{ id: 'a', file: 'a.mp4', text: [{ text: 'Late', start: 1, end: 9 }] }],
      { size: '1080x1920' }
    );
    const plan = planTimeline(manifest, [video(4)], manifest.size);
    expect(plan.warnings.some((w) => w.includes('ends at 9s'))).toBe(true);
    expect(plan.warnings.some((w) => w.includes('is cropped to 1080x1920'))).toBe(true);
  });
});

describe('shot audio', () => {
  const manifest = base([{ id: 'a', file: 'a.mp4', audioFrom: { file: 'narr.wav', start: 12.5 } }]);
  const plan = planTimeline(manifest, [video(4)], manifest.size);

  it('borrows sound from a time range of another file', () => {
    const { args } = shotArgs(
      plan.shots[0],
      0,
      plan,
      {},
      undefined,
      '/in/a.mp4',
      'shot0.mov',
      '/in/narr.wav'
    );
    const text = args.join(' ');
    expect(text).toContain('-ss 12.5 -t 4.000 -i /in/narr.wav');
    expect(text).toContain('-map 0:v:0 -map 1:a:0');
  });

  it('uses silence for a muted shot', () => {
    const muted = base([{ id: 'a', file: 'a.mp4' }]);
    const mutedPlan = planTimeline(muted, [video(4)], muted.size);
    const { args } = shotArgs(
      mutedPlan.shots[0],
      0,
      mutedPlan,
      {},
      undefined,
      '/in/a.mp4',
      'shot0.mov'
    );
    expect(args.join(' ')).toContain('anullsrc');
  });

  it('rejects audioFrom without a file', () => {
    expect(() =>
      validateManifest(base([{ id: 'a', file: 'a.mp4', audioFrom: { file: '', start: 0 } }]))
    ).toThrow('audioFrom needs');
  });
});

describe('text overlays', () => {
  it('wraps words to a width', () => {
    expect(wrapText('one two three four', 9)).toBe('one two\nthree\nfour');
  });

  it('writes text to files so nothing needs escaping', () => {
    const { filters, files } = overlayFilters(
      { id: 'a', file: 'a.mp4', text: [{ text: "50% off: it's 'free'", start: 0, end: 2 }] },
      0,
      1920,
      1080,
      undefined
    );
    expect(files).toEqual([{ name: 't0_0.txt', content: "50% off: it's 'free'" }]);
    expect(filters[0]).toContain('textfile=t0_0.txt');
    expect(filters[0]).not.toContain('50%');
    expect(filters[0]).toContain("enable='between(t,0,2)'");
  });

  it('keeps bottom text above the bottom fifth of vertical video', () => {
    const { filters } = overlayFilters(
      { id: 'a', file: 'a.mp4', text: [{ text: 'hi', start: 0, end: 1 }] },
      0,
      1080,
      1920,
      undefined
    );
    expect(filters[0]).toContain('y=h*0.64-text_h');
  });

  it('drops colour values that could break the filter graph', () => {
    const { filters } = overlayFilters(
      { id: 'a', file: 'a.mp4', text: [{ text: 'hi', start: 0, end: 1 }] },
      0,
      1920,
      1080,
      { color: "red:x=0,drawbox='", boxColor: 'black@0.4' }
    );
    expect(filters[0]).toContain('fontcolor=white');
    expect(filters[0]).toContain('boxcolor=black@0.4');
  });
});

describe('audio mix', () => {
  const manifest = base([{ id: 'a', file: 'a.mp4' }], {
    voiceover: { file: 'vo.wav', start: 0.5 },
    music: { file: 'bed.mp3', gainDb: -20 },
    loudness: -16,
  });
  const plan = planTimeline(manifest, [video(8)], manifest.size);

  it('returns nothing when there is no voiceover or music', () => {
    expect(
      mixArgs(base([{ id: 'a', file: 'a.mp4' }]), plan, { assembled: 'j.mp4' }, 'o.mp4')
    ).toBeUndefined();
  });

  it('ducks music under the voiceover and normalises loudness', () => {
    const args =
      mixArgs(manifest, plan, { assembled: 'j.mp4', voice: 'vo.wav', music: 'bed.mp3' }, 'o.mp4') ??
      [];
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('adelay=500|500');
    expect(graph).toContain('volume=-20dB');
    expect(graph).toContain('sidechaincompress');
    expect(graph).toContain('loudnorm=I=-16');
    expect(args).toContain('-stream_loop');
  });

  it('skips ducking when told to', () => {
    const noDuck = { ...manifest, music: { file: 'bed.mp3', duck: false } };
    const args =
      mixArgs(noDuck, plan, { assembled: 'j.mp4', voice: 'vo.wav', music: 'bed.mp3' }, 'o.mp4') ??
      [];
    expect(args[args.indexOf('-filter_complex') + 1]).not.toContain('sidechaincompress');
  });
});

const hasFfmpeg =
  spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
const font = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/usr/share/fonts/opentype/inter/Inter-Bold.otf',
].find((path) => existsSync(path));

describe.skipIf(!hasFfmpeg || !font)('build with real ffmpeg', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'ad-pack-'));
    const make = (args: string[]) => {
      const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
        cwd: dir,
      });
      if (result.status !== 0) throw new Error(String(result.stderr));
    };
    make([
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=1280x720:rate=24:duration=3',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=3',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      'a.mp4',
    ]);
    make([
      '-f',
      'lavfi',
      '-i',
      'smptebars=size=1280x720:rate=30:duration=3',
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      'b.mp4',
    ]);
    make(['-f', 'lavfi', '-i', 'color=c=0x224466:s=640x360', '-frames:v', '1', 'card.png']);
    make(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=4', 'vo.wav']);
    writeFileSync(
      join(dir, 'pack.json'),
      JSON.stringify({
        name: 'demo',
        size: '640x360',
        fps: 30,
        font,
        shots: [
          {
            id: 'a',
            file: 'a.mp4',
            audio: 'keep',
            text: [{ text: 'First shot', start: 0.2, end: 2 }],
            transition: { duration: 0.5 },
          },
          { id: 'b', file: 'b.mp4', trim: { duration: 2 } },
          {
            id: 'card',
            file: 'card.png',
            duration: 1.5,
            text: [{ text: 'genfeed.ai', start: 0, end: 1.5, position: 'center' }],
          },
        ],
        voiceover: { file: 'vo.wav', start: 0.2 },
        cutdowns: [{ name: '9x16', size: '360x640' }],
      })
    );
  }, 60_000);

  it('renders the master and a vertical cutdown that pass their checks', () => {
    const record = main(['build', join(dir, 'pack.json'), '--out', join(dir, 'out')]) as {
      outputs: Array<{
        label: string;
        check: { ok: boolean; width: number; height: number; duration: number; hasAudio: boolean };
      }>;
    };
    expect(
      record.outputs.map((o) => [
        o.label,
        o.check.width,
        o.check.height,
        o.check.ok,
        o.check.hasAudio,
      ])
    ).toEqual([
      ['master', 640, 360, true, true],
      ['9x16', 360, 640, true, true],
    ]);
    // 3 + 2 + 1.5 seconds minus the 0.5 second crossfade.
    expect(record.outputs[0].check.duration).toBeCloseTo(6, 1);
    expect(JSON.parse(readFileSync(join(dir, 'out', 'demo.build.json'), 'utf8')).name).toBe('demo');
  }, 120_000);

  it('keeps narration and picture in step across many cuts', () => {
    const starts = [0, 0.9, 2.1, 3.8, 6.1, 7.0, 8.2, 9.9];
    const shots = starts.slice(0, -1).map((start, index) => ({
      id: `s${index}`,
      file: 'b.mp4',
      trim: { duration: starts[index + 1] - start },
      audioFrom: { file: 'vo.wav', start },
    }));
    writeFileSync(
      join(dir, 'narr.json'),
      JSON.stringify({ name: 'narr', size: '640x360', fps: 30, shots })
    );
    const record = main(['build', join(dir, 'narr.json'), '--out', join(dir, 'out2')]) as {
      outputs: Array<{ file: string; check: { ok: boolean; duration: number } }>;
    };
    const probe = spawnSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type,duration',
        '-of',
        'csv=p=0',
        record.outputs[0].file,
      ],
      { encoding: 'utf8' }
    );
    const durations = Object.fromEntries(
      probe.stdout
        .trim()
        .split('\n')
        .map((line) => line.split(','))
    );
    expect(record.outputs[0].check.ok).toBe(true);
    expect(Math.abs(Number(durations.video) - Number(durations.audio))).toBeLessThan(0.05);
  }, 120_000);

  it('plans without rendering anything', () => {
    const result = main(['plan', join(dir, 'pack.json')]) as {
      note: string;
      master: { totalSeconds: number };
    };
    expect(result.master.totalSeconds).toBeCloseTo(6, 1);
    expect(result.note).toContain('Nothing rendered');
  }, 60_000);
});
