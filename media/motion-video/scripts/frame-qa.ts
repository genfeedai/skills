/**
 * Frame QA for rendered motion videos: pure functions over raw RGB frames, so they
 * are tested without ffmpeg. `motion.ts inspect` feeds them frames sampled from an MP4.
 *
 * These are heuristics on pixels, not a layout engine. "Ink" is any pixel with a sharp
 * local luma step (text strokes, shapes, logo edges). Smooth gradients and vignettes
 * are not ink. A busy photo or video background is mostly ink, so edge and safe-zone
 * findings are warnings to confirm by looking at the frame, never proof of a defect.
 */

export interface RawFrame {
  /** Packed rgb24, width * height * 3 bytes. */
  data: Uint8Array;
  height: number;
  width: number;
}

export interface SafeMargins {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export type FindingKind = 'blank' | 'edge-clipped' | 'near-empty' | 'safe-zone';

export interface Finding {
  detail: string;
  frame: number;
  kind: FindingKind;
  /** Sides involved, for edge-clipped and safe-zone findings. */
  sides?: Side[];
  severity: 'error' | 'warning';
}

export type Side = 'bottom' | 'left' | 'right' | 'top';

export interface InspectOptions {
  safe: SafeMargins;
}

/** Luma step between neighbouring pixels, at analysis size, that counts as ink. */
export const INK_STEP = 30;
/** Share of ink pixels below which a frame is nearly empty. */
export const NEAR_EMPTY_INK_SHARE = 0.0015;
/** Luma steps along a frame border needed to report clipped content. Safe bands need ink pixels. */
export const EDGE_MIN_STEPS = 4;
export const SAFE_MIN_INK_PIXELS = 8;
export const SAFE_MIN_DENSITY = 0.003;

/** Analysis size: long side in pixels. Keeps one frame near 400 KB of RGB. */
export const ANALYSIS_LONG_SIDE = 480;

export function analysisSize(width: number, height: number): { height: number; width: number } {
  const scale = ANALYSIS_LONG_SIDE / Math.max(width, height);
  const even = (value: number): number => Math.max(2, 2 * Math.round(value / 2));
  return { height: even(height * scale), width: even(width * scale) };
}

/** Safe margins as fractions of each side. Vertical video keeps the bottom 20% clear. */
export function defaultSafeMargins(width: number, height: number): SafeMargins {
  const isVertical = height > width;
  return { bottom: isVertical ? 0.2 : 0.08, left: 0.08, right: 0.08, top: 0.08 };
}

function luma(data: Uint8Array, index: number): number {
  const at = index * 3;
  return ((data[at] ?? 0) * 299 + (data[at + 1] ?? 0) * 587 + (data[at + 2] ?? 0) * 114) / 1000;
}

function lumaPlane(frame: RawFrame): Float32Array {
  const plane = new Float32Array(frame.width * frame.height);
  for (let i = 0; i < plane.length; i += 1) plane[i] = luma(frame.data, i);
  return plane;
}

/**
 * Ink map: 1 where luma steps by more than INK_STEP against the pixel to the right or
 * below. Marks both sides of a stroke, which is enough to find content.
 */
function inkMap(plane: Float32Array, width: number, height: number): Uint8Array {
  const ink = new Uint8Array(plane.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const here = plane[i] ?? 0;
      const right = x + 1 < width ? (plane[i + 1] ?? here) : here;
      const below = y + 1 < height ? (plane[i + width] ?? here) : here;
      if (Math.abs(here - right) > INK_STEP || Math.abs(here - below) > INK_STEP) ink[i] = 1;
    }
  }
  return ink;
}

function countInk(
  ink: Uint8Array,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { area: number; count: number } {
  let count = 0;
  let area = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      area += 1;
      if (ink[y * width + x]) count += 1;
    }
  }
  return { area, count };
}

/**
 * Ink inside a safe band, skipping lines that run the whole band: a bar or rule that
 * bleeds off the frame is a design choice, text is not a full-length line.
 */
function countBandInk(
  ink: Uint8Array,
  width: number,
  box: { x0: number; x1: number; y0: number; y1: number },
  side: Side
): { area: number; count: number } {
  const { x0, x1, y0, y1 } = box;
  let area = 0;
  let count = 0;
  const isSideBand = side === 'left' || side === 'right';
  const lines = isSideBand ? y1 - y0 : x1 - x0;
  const length = isSideBand ? x1 - x0 : y1 - y0;
  for (let line = 0; line < lines; line += 1) {
    let inked = 0;
    for (let k = 0; k < length; k += 1) {
      const x = isSideBand ? x0 + k : x0 + line;
      const y = isSideBand ? y0 + line : y0 + k;
      if (ink[y * width + x]) inked += 1;
    }
    area += length;
    if (length > 0 && inked < 0.9 * length) count += inked;
  }
  return { area, count };
}

/** Findings for one frame. `index` is the 1-based sample number used in reports. */
export function inspectFrame(frame: RawFrame, index: number, options: InspectOptions): Finding[] {
  const { width, height } = frame;
  const findings: Finding[] = [];
  const plane = lumaPlane(frame);

  const ink = inkMap(plane, width, height);
  const total = countInk(ink, width, 0, 0, width, height);
  if (total.count === 0) {
    findings.push({
      detail: 'nothing is drawn: no text or shape edges, only a flat or smooth background',
      frame: index,
      kind: 'blank',
      severity: 'warning',
    });
    return findings;
  }
  if (total.count / total.area < NEAR_EMPTY_INK_SHARE) {
    findings.push({
      detail: 'almost nothing is drawn on this frame (no text or shape edges)',
      frame: index,
      kind: 'near-empty',
      severity: 'warning',
    });
    return findings;
  }

  // Edge ring: ink measured only along the border (vertical steps down the side columns,
  // horizontal steps along the top and bottom rows). Text cut by an edge shows many steps;
  // a solid shape that runs off the frame shows two, so intentional bleeds are not flagged.
  const stepsAlong = (
    plane2: Float32Array,
    start: number,
    stride: number,
    length: number
  ): number => {
    let steps = 0;
    for (let k = 0; k + 1 < length; k += 1) {
      const a = plane2[start + k * stride] ?? 0;
      const b = plane2[start + (k + 1) * stride] ?? 0;
      if (Math.abs(a - b) > INK_STEP) steps += 1;
    }
    return steps;
  };
  const edgeSteps: Record<Side, number> = {
    bottom: stepsAlong(plane, (height - 1) * width, 1, width),
    left: stepsAlong(plane, 0, width, height),
    right: stepsAlong(plane, width - 1, width, height),
    top: stepsAlong(plane, 0, 1, width),
  };
  const clipped = (Object.keys(edgeSteps) as Side[]).filter(
    (side) => edgeSteps[side] >= EDGE_MIN_STEPS
  );
  if (clipped.length) {
    findings.push({
      detail: `content touches the ${clipped.join(' and ')} edge`,
      frame: index,
      kind: 'edge-clipped',
      severity: 'warning',
      sides: clipped,
    });
  }

  const { safe } = options;
  const px = {
    bottom: Math.round(safe.bottom * height),
    left: Math.round(safe.left * width),
    right: Math.round(safe.right * width),
    top: Math.round(safe.top * height),
  };
  // Bands are drawn between the edge ring and the safe line; corners belong to the side
  // bands so one stray mark is not counted twice.
  const zones: Record<Side, { area: number; count: number }> = {
    bottom: countBandInk(
      ink,
      width,
      { x0: px.left, x1: width - px.right, y0: Math.max(1, height - px.bottom), y1: height - 1 },
      'bottom'
    ),
    left: countBandInk(
      ink,
      width,
      { x0: 1, x1: Math.max(2, px.left), y0: px.top, y1: height - px.bottom },
      'left'
    ),
    right: countBandInk(
      ink,
      width,
      {
        x0: Math.min(width - 1, width - px.right),
        x1: width - 1,
        y0: px.top,
        y1: height - px.bottom,
      },
      'right'
    ),
    top: countBandInk(
      ink,
      width,
      { x0: px.left, x1: width - px.right, y0: 1, y1: Math.max(2, px.top) },
      'top'
    ),
  };
  const intruding = (Object.keys(zones) as Side[]).filter((side) => {
    const zone = zones[side];
    if (clipped.includes(side)) return false; // already reported as touching the edge
    return (
      zone.count >= SAFE_MIN_INK_PIXELS &&
      zone.area > 0 &&
      zone.count / zone.area >= SAFE_MIN_DENSITY
    );
  });
  if (intruding.length) {
    findings.push({
      detail: `content sits inside the ${intruding.join(' and ')} safe margin`,
      frame: index,
      kind: 'safe-zone',
      severity: 'warning',
      sides: intruding,
    });
  }
  return findings;
}

/**
 * A single flat sample can be a deliberate fade or wipe. Two or more flat samples in one
 * video are an error: the composition shows nothing for a stretch.
 */
export function inspectFrames(frames: RawFrame[], options: InspectOptions): Finding[] {
  const findings = frames.flatMap((frame, i) => inspectFrame(frame, i + 1, options));
  const blank = findings.filter((finding) => finding.kind === 'blank');
  if (blank.length >= 2) for (const finding of blank) finding.severity = 'error';
  return findings;
}
