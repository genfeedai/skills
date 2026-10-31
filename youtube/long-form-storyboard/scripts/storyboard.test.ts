import { describe, expect, it } from 'bun:test';
import {
  captionChunks,
  compileManifest,
  estimateSeconds,
  narrationText,
  resolveTimings,
  type Segment,
  type Storyboard,
  shotListMarkdown,
  slug,
  spokenWeight,
  srt,
  validateStoryboard,
} from './storyboard';

const seg = (id: string, narration: string, extra: Partial<Segment> = {}): Segment => ({
  id,
  narration,
  cutaways: [{ id: `c-${id}`, brief: 'a picture', file: `cutaways/${id}.png` }],
  ...extra,
});

const board = (segments: Segment[], extra: Partial<Storyboard> = {}): Storyboard => ({
  title: 'My Long Video!',
  segments,
  ...extra,
});

const rebase = (path: string) => path;

describe('spoken length', () => {
  it.each([
    ['one two three', 3],
    ['', 1],
    ['日本語のテキスト', 4],
    ['hello 世界', 2],
  ])('weighs %j as %d', (text, expected) => {
    expect(spokenWeight(text)).toBe(expected);
  });

  it('turns words into seconds at the given pace', () => {
    expect(estimateSeconds('word '.repeat(150), 150)).toBeCloseTo(60, 5);
  });
});

describe('validation', () => {
  const messages = (b: Storyboard) =>
    validateStoryboard(b)
      .filter((i) => i.level === 'error')
      .map((i) => i.message);

  it('accepts a small valid storyboard', () => {
    expect(messages(board([seg('s1', 'Hello there.'), seg('s2', 'Second.')]))).toEqual([]);
  });

  it.each([
    ['an empty storyboard', board([]), 'segments must not be empty'],
    ['empty narration', board([seg('s1', '  ')]), 'narration is empty'],
    ['a long narration', board([seg('s1', 'a'.repeat(2001))]), 'the limit is 2000'],
    [
      'a long section label',
      board([seg('s1', 'x', { sectionLabel: 'L'.repeat(41) })]),
      'sectionLabel is over 40',
    ],
    ['a bad id', board([seg('bad id!', 'x')]), 'id is missing or has characters'],
    ['half a time range', board([seg('s1', 'x', { start: 1 })]), 'both start and end'],
    ['a backwards range', board([seg('s1', 'x', { start: 5, end: 2 })]), '0 <= start < end'],
    ['wpm out of range', board([seg('s1', 'x')], { wpm: 20 }), 'wpm must be between'],
  ])('rejects %s', (_label, b, message) => {
    expect(messages(b).join('\n')).toContain(message);
  });

  it('rejects duplicate ids and mixed explicit timing', () => {
    expect(messages(board([seg('s1', 'a'), seg('s1', 'b')]))).toContain('duplicate segment id');
    expect(messages(board([seg('s1', 'a', { start: 0, end: 2 }), seg('s2', 'b')]))).toContain(
      'either every segment has start and end, or none does'
    );
  });

  it('warns about a segment with no cutaway and about a very long segment', () => {
    const warnings = validateStoryboard(
      board([seg('s1', 'word '.repeat(100), { cutaways: [] })])
    ).filter((i) => i.level === 'warning');
    expect(warnings.map((w) => w.message).join(' ')).toContain('no cutaway');
    expect(warnings.map((w) => w.message).join(' ')).toContain('over about 30 seconds');
  });
});

describe('timing', () => {
  it('divides the recording in proportion to spoken length', () => {
    const timed = resolveTimings(
      board([seg('a', 'one two'), seg('b', 'one two three four five six')]),
      80
    );
    expect(timed.map((t) => [t.start, t.end])).toEqual([
      [0, 20],
      [20, 80],
    ]);
  });

  it('uses explicit times and closes the gaps between segments', () => {
    const timed = resolveTimings(
      board([seg('a', 'x', { start: 1, end: 4 }), seg('b', 'y', { start: 6, end: 9 })]),
      12
    );
    expect(timed.map((t) => [t.start, t.end])).toEqual([
      [0, 6],
      [6, 12],
    ]);
  });
});

describe('exports', () => {
  const b = board([
    seg('a', 'First point. Second point.', { sectionLabel: 'Intro' }),
    seg('b', 'Next.', { sectionLabel: 'Intro' }),
  ]);

  it('writes the narration once per section label', () => {
    expect(narrationText(b)).toBe('[Intro]\n\nFirst point. Second point.\nNext.\n');
  });

  it('lists every cutaway brief with its time range', () => {
    const md = shotListMarkdown(b, resolveTimings(b, 10));
    expect(md).toContain(
      '| a Intro | 0.0-8.0 s | First point. Second point. | c-a: a picture | cutaways/a.png |'
    );
  });

  it('writes numbered SRT cues that tile each segment', () => {
    const cues = srt(resolveTimings(board([seg('a', 'One. Two.')]), 10));
    expect(cues).toBe(
      '1\n00:00:00,000 --> 00:00:05,000\nOne.\n\n2\n00:00:05,000 --> 00:00:10,000\nTwo.\n'
    );
  });

  it('splits long sentences into caption-sized chunks', () => {
    const chunks = captionChunks('word '.repeat(40), 30);
    expect(chunks.every((c) => c.length <= 30)).toBe(true);
    expect(chunks.join(' ')).toBe('word '.repeat(40).trim());
  });

  it('makes a safe slug', () => {
    expect(slug('My Long Video!')).toBe('my-long-video');
    expect(slug('!!!')).toBe('storyboard');
  });
});

describe('compile to an assembly manifest', () => {
  const options = { audioFile: 'voice.m4a', rebase };

  it('puts cutaways over one continuous narration with audioFrom offsets', () => {
    const b = board([
      seg('a', 'one two three four', {
        cutaways: [
          { id: 'c1', brief: 'x', file: 'c1.png' },
          { id: 'c2', brief: 'y', file: 'c2.mp4', clipStart: 2 },
        ],
      }),
      seg('b', 'one two three four'),
    ]);
    const manifest = compileManifest(b, resolveTimings(b, 20), options);
    expect(
      manifest.shots.map((s) => [s.id, s.file, s.audioFrom.start, s.duration ?? s.trim?.duration])
    ).toEqual([
      ['a-1', 'c1.png', 0, 5],
      ['a-2', 'c2.mp4', 5, 5],
      ['b-1', 'cutaways/b.png', 10, 10],
    ]);
    expect(manifest.shots[1].trim).toEqual({ start: 2, duration: 5 });
    expect(manifest.name).toBe('my-long-video');
  });

  it('honours an explicit cutaway time and adds on-screen text to the first shot', () => {
    const b = board([
      seg('a', 'x y z', {
        onScreenText: 'Hello',
        cutaways: [
          { id: 'c1', brief: 'x', file: 'c1.png' },
          { id: 'c2', brief: 'y', file: 'c2.png', at: 2 },
        ],
      }),
    ]);
    const manifest = compileManifest(b, resolveTimings(b, 10), options);
    expect(manifest.shots[0].duration).toBe(2);
    expect(manifest.shots[0].text).toEqual([
      { text: 'Hello', start: 0.3, end: 2, position: 'bottom' },
    ]);
    expect(manifest.shots[1].duration).toBe(8);
  });

  it('shows a chapter card first without moving the narration', () => {
    const b = board([seg('a', 'x y z', { card: 'card.mp4' })]);
    const manifest = compileManifest(b, resolveTimings(b, 10), options);
    expect(
      manifest.shots.map((s) => [s.file, s.audioFrom.start, s.trim?.duration ?? s.duration])
    ).toEqual([
      ['card.mp4', 0, 2],
      ['cutaways/a.png', 2, 8],
    ]);
  });

  it('uses the presenter recording where a segment has no cutaway', () => {
    const b = board([seg('a', 'one two', { cutaways: [] }), seg('b', 'one two')]);
    const manifest = compileManifest(b, resolveTimings(b, 10), {
      audioFile: 'presenter.mp4',
      presenterFile: 'presenter.mp4',
      rebase,
    });
    expect(manifest.shots[0]).toMatchObject({
      file: 'presenter.mp4',
      trim: { start: 0, duration: 5 },
      audioFrom: { file: 'presenter.mp4', start: 0 },
      fit: 'cover',
    });
  });

  it('refuses to compile while files are missing', () => {
    const b = board([
      seg('a', 'x', { cutaways: [{ id: 'c1', brief: 'x' }] }),
      seg('b', 'y', { cutaways: [] }),
    ]);
    expect(() => compileManifest(b, resolveTimings(b, 10), options)).toThrow(
      'c1 (segment a) has no file yet'
    );
    expect(() => compileManifest(b, resolveTimings(b, 10), options)).toThrow(
      'segment b has no cutaway file'
    );
  });

  it('keeps every shot at least as long as the segment it covers, in total', () => {
    const b = board([seg('a', 'one two three'), seg('b', 'four five six seven eight')]);
    const manifest = compileManifest(b, resolveTimings(b, 37.5), options);
    const total = manifest.shots.reduce((sum, s) => sum + (s.duration ?? s.trim?.duration ?? 0), 0);
    expect(total).toBeCloseTo(37.5, 2);
  });
});
