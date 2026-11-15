import { describe, expect, test } from 'bun:test';
import {
  analysisSize,
  defaultSafeMargins,
  inspectFrame,
  inspectFrames,
  type RawFrame,
} from './frame-qa';

const W = 270;
const H = 480;
const SAFE = defaultSafeMargins(W, H);

function solid(r: number, g: number, b: number): RawFrame {
  const data = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i += 1) {
    data[i * 3] = r;
    data[i * 3 + 1] = g;
    data[i * 3 + 2] = b;
  }
  return { data, height: H, width: W };
}

/** Smooth vertical gradient: a vignette-like background that must not count as ink. */
function gradient(): RawFrame {
  const frame = solid(0, 0, 0);
  for (let y = 0; y < H; y += 1) {
    const value = Math.round(20 + (y / H) * 60);
    for (let x = 0; x < W; x += 1) {
      const at = (y * W + x) * 3;
      frame.data[at] = value;
      frame.data[at + 1] = value;
      frame.data[at + 2] = value;
    }
  }
  return frame;
}

/** Text stand-in: 3 px checker squares, so strokes step in both directions. */
function drawTextLike(frame: RawFrame, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < Math.min(H, y0 + h); y += 1) {
    for (let x = x0; x < Math.min(W, x0 + w); x += 1) {
      const on = (Math.floor((x - x0) / 3) + Math.floor((y - y0) / 3)) % 2 === 0;
      const at = (y * W + x) * 3;
      frame.data[at] = on ? 245 : 10;
      frame.data[at + 1] = on ? 245 : 10;
      frame.data[at + 2] = on ? 245 : 10;
    }
  }
}

function fillRect(frame: RawFrame, x0: number, y0: number, w: number, h: number, value: number) {
  for (let y = y0; y < Math.min(H, y0 + h); y += 1) {
    for (let x = x0; x < Math.min(W, x0 + w); x += 1) {
      const at = (y * W + x) * 3;
      frame.data[at] = value;
      frame.data[at + 1] = value;
      frame.data[at + 2] = value;
    }
  }
}

const kinds = (frame: RawFrame) => inspectFrame(frame, 1, { safe: SAFE }).map((f) => f.kind);

describe('frame QA', () => {
  test('a flat frame has nothing drawn', () => {
    expect(kinds(solid(0, 0, 0))).toEqual(['blank']);
  });

  test('a smooth gradient with no content is blank', () => {
    expect(kinds(gradient())).toEqual(['blank']);
  });

  test('a frame with one tiny mark is nearly empty', () => {
    const frame = solid(11, 11, 16);
    fillRect(frame, 130, 200, 3, 3, 250);
    expect(kinds(frame)).toEqual(['near-empty']);
  });

  test('centered text inside the margins has no findings', () => {
    const frame = solid(11, 11, 16);
    drawTextLike(frame, 60, 150, 150, 120);
    expect(kinds(frame)).toEqual([]);
  });

  test('a smooth gradient with centered text has no findings', () => {
    const frame = gradient();
    drawTextLike(frame, 60, 150, 150, 120);
    expect(kinds(frame)).toEqual([]);
  });

  test('text running off the right edge is edge-clipped on the right only', () => {
    const frame = solid(11, 11, 16);
    drawTextLike(frame, 150, 150, 200, 120);
    const [finding] = inspectFrame(frame, 3, { safe: SAFE });
    expect(finding?.kind).toBe('edge-clipped');
    expect(finding?.sides).toEqual(['right']);
    expect(finding?.frame).toBe(3);
  });

  test('a solid bar that bleeds off the frame is not edge-clipped', () => {
    const frame = solid(11, 11, 16);
    drawTextLike(frame, 60, 150, 150, 120);
    fillRect(frame, 0, 200, W, 12, 250);
    expect(kinds(frame)).toEqual([]);
  });

  test('text inside the side margin but off the edge is a safe-zone finding', () => {
    const frame = solid(11, 11, 16);
    drawTextLike(frame, 230, 150, 30, 120);
    const [finding] = inspectFrame(frame, 1, { safe: SAFE });
    expect(finding?.kind).toBe('safe-zone');
    expect(finding?.sides).toEqual(['right']);
  });

  test('on vertical video the bottom 20% counts as a platform zone', () => {
    const frame = solid(11, 11, 16);
    drawTextLike(frame, 60, 150, 150, 120);
    drawTextLike(frame, 60, 410, 150, 40);
    const [finding] = inspectFrame(frame, 1, { safe: SAFE });
    expect(finding?.kind).toBe('safe-zone');
    expect(finding?.sides).toEqual(['bottom']);
  });

  test('one flat sample is a warning, two are an error', () => {
    const good = solid(11, 11, 16);
    drawTextLike(good, 60, 150, 150, 120);
    const one = inspectFrames([good, solid(0, 0, 0), good], { safe: SAFE });
    expect(one.map((f) => [f.kind, f.severity])).toEqual([['blank', 'warning']]);
    const two = inspectFrames([solid(0, 0, 0), good, solid(255, 255, 255)], { safe: SAFE });
    expect(two.map((f) => [f.kind, f.severity, f.frame])).toEqual([
      ['blank', 'error', 1],
      ['blank', 'error', 3],
    ]);
  });
});

describe('sizes and margins', () => {
  test('analysis size keeps the aspect ratio with even sides', () => {
    expect(analysisSize(1080, 1920)).toEqual({ height: 480, width: 270 });
    expect(analysisSize(1920, 1080)).toEqual({ height: 270, width: 480 });
  });

  test('vertical video keeps the bottom 20% clear, landscape does not', () => {
    expect(defaultSafeMargins(1080, 1920).bottom).toBe(0.2);
    expect(defaultSafeMargins(1920, 1080).bottom).toBe(0.08);
  });
});
