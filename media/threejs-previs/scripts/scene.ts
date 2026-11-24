/**
 * threejs-previs scene model: types, validation, sampling and prompt drafting.
 * Pure logic with no browser, ffmpeg or three.js, so it runs in tests and in the render page.
 */

export type Kind = 'subject' | 'prop' | 'place' | 'frame';
export type Shape = 'stickman' | 'block' | 'cylinder' | 'sphere' | 'zone' | 'wall' | 'panel';
export type Pose = 'stand' | 'sit' | 'fall';
export type Vec3 = [number, number, number];

export interface Entity {
  /** Short name drawn on the review render, for example "Mia". */
  label: string;
  /** One flat colour, unique in the scene. A hex such as #e02020. */
  color: string;
  /** Plain colour word used in the prompt. Derived from the nearest palette colour when left out. */
  colorName?: string;
  height?: number;
  id: string;
  kind: Kind;
  position?: Vec3;
  /** An image the owner has for this entity (a Library label or a path). Numbered in prompt order. */
  reference?: string;
  /** What it is in the finished video. The prompt uses this text. */
  represents: string;
  shape?: Shape;
  /** Width, height, depth in metres. Cylinder and sphere use width as the diameter. */
  size?: Vec3;
  yaw?: number;
}

export interface TrackKey {
  pose?: Pose;
  position: Vec3;
  t: number;
  /** Degrees about the vertical axis, 0 faces +z (toward the default camera). Left out: face the way it moves. */
  yaw?: number;
}

export interface CameraKey {
  /** Jump straight to this key at its time, with no move from the previous key: a hard cut. */
  cut?: boolean;
  /** Easing from this key to the next one. */
  ease?: 'linear' | 'inOut';
  fov?: number;
  lookAt: Vec3;
  position: Vec3;
  t: number;
}

export interface Scene {
  camera: CameraKey[];
  canvas: { durationSeconds: number; fps: number; height: number; width: number };
  entities: Entity[];
  /** Where the finished video takes place, in words. Used by the prompt. */
  setting?: string;
  /** The look of the finished video, in words. */
  style?: string;
  title?: string;
  tracks?: Record<string, TrackKey[]>;
  version: 1;
}

export const KIND_DEFAULT_SHAPE: Record<Kind, Shape> = {
  frame: 'panel',
  place: 'zone',
  prop: 'block',
  subject: 'stickman',
};

export const NAMED_COLORS: Record<string, string> = {
  black: '#151515',
  blue: '#1f6fe0',
  brown: '#8b5a2b',
  green: '#2eb82e',
  grey: '#808080',
  orange: '#f08c00',
  pink: '#ff4fa3',
  purple: '#8a2be2',
  red: '#e02020',
  teal: '#00a6a6',
  white: '#ffffff',
  yellow: '#f2d000',
};

export const GROUND_COLOR = '#cfcfcf';
export const BACKGROUND_COLOR = '#ececec';

export interface Target {
  eachSeconds: [number, number];
  fps: [number, number];
  id: string;
  maxCount: number;
  maxMegabytes: number;
  /** Longest clip the model generates, so a reference longer than this is wasted. */
  outputSeconds: [number, number];
  pixels: [number, number];
  totalSeconds: number;
}

/** Reference video limits from the BytePlus ModelArk docs (read 2026-11-24). */
export const TARGETS: Record<string, Target> = {
  'seedance-2.0': {
    eachSeconds: [2, 15],
    fps: [24, 60],
    id: 'seedance-2.0',
    maxCount: 3,
    maxMegabytes: 200,
    outputSeconds: [4, 15],
    pixels: [407_696, 8_295_044],
    totalSeconds: 15,
  },
  'seedance-2.5': {
    eachSeconds: [2, 30],
    fps: [24, 60],
    id: 'seedance-2.5',
    maxCount: 10,
    maxMegabytes: 200,
    outputSeconds: [4, 30],
    pixels: [407_696, 8_847_360],
    totalSeconds: 30,
  },
};

export const REF_STYLES = ['byteplus', 'replicate', 'fal'] as const;
export type RefStyle = (typeof REF_STYLES)[number];

export function refName(style: RefStyle, type: 'Video' | 'Image', n: number): string {
  if (style === 'replicate') return `[${type}${n}]`;
  if (style === 'fal') return `@${type}${n}`;
  return `${type} ${n}`;
}

// ---------- colour ----------

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

export function nearestColorName(hex: string): string {
  let best = 'grey';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [name, value] of Object.entries(NAMED_COLORS)) {
    const distance = colorDistance(hex, value);
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

export function colorNameOf(entity: Entity): string {
  return entity.colorName ?? nearestColorName(entity.color);
}

export function shapeOf(entity: Entity): Shape {
  return entity.shape ?? KIND_DEFAULT_SHAPE[entity.kind];
}

// ---------- validation ----------

export interface Report {
  errors: string[];
  warnings: string[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const MIN_COLOR_DISTANCE = 60;

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n));
}

export function validateScene(scene: Scene, target?: Target): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (scene.version !== 1) errors.push('version must be 1');

  const { canvas } = scene;
  if (!canvas) {
    errors.push('canvas is missing');
  } else {
    const { durationSeconds, fps, height, width } = canvas;
    for (const [name, value] of Object.entries({ durationSeconds, fps, height, width })) {
      if (!Number.isFinite(value) || value <= 0)
        errors.push(`canvas.${name} must be a positive number`);
    }
    if (width % 2 || height % 2) errors.push('canvas.width and canvas.height must be even (H.264)');
    const aspect = width / height;
    if (aspect < 0.4 || aspect > 2.5)
      errors.push(`aspect ratio ${aspect.toFixed(2)} is outside 0.4 to 2.5`);
    if (width < 300 || height < 300) errors.push('width and height must be at least 300 px');
    if (!Number.isInteger(fps)) errors.push('canvas.fps must be a whole number');
    if (target) {
      const pixels = width * height;
      if (pixels < target.pixels[0] || pixels > target.pixels[1]) {
        errors.push(
          `${width}x${height} is ${pixels} px; ${target.id} accepts ${target.pixels[0]} to ${target.pixels[1]}`
        );
      }
      if (fps < target.fps[0] || fps > target.fps[1]) {
        errors.push(`fps ${fps} is outside ${target.fps[0]} to ${target.fps[1]} for ${target.id}`);
      }
      if (durationSeconds < target.eachSeconds[0] || durationSeconds > target.eachSeconds[1]) {
        errors.push(
          `duration ${durationSeconds}s is outside ${target.eachSeconds[0]} to ${target.eachSeconds[1]}s for ${target.id}`
        );
      } else if (durationSeconds < target.outputSeconds[0]) {
        warnings.push(
          `duration ${durationSeconds}s is shorter than the ${target.outputSeconds[0]}s ${target.id} generates; the rest of the clip is unguided`
        );
      }
      if (width * height > 927_408) {
        warnings.push(
          'above ~720p; one host documents reference videos only up to about 834x1112, so 720x1280 is the safe size'
        );
      }
    }
  }

  const ids = new Set<string>();
  const labels = new Set<string>();
  const names = new Set<string>();
  for (const entity of scene.entities ?? []) {
    const where = `entity "${entity.id}"`;
    if (!/^[a-z][a-z0-9-]*$/.test(entity.id ?? ''))
      errors.push(`${where}: id must be lowercase letters, digits and dashes`);
    if (ids.has(entity.id)) errors.push(`${where}: duplicate id`);
    ids.add(entity.id);
    if (!['subject', 'prop', 'place', 'frame'].includes(entity.kind))
      errors.push(`${where}: kind must be subject, prop, place or frame`);
    if (!HEX.test(entity.color ?? '')) errors.push(`${where}: color must be a #rrggbb hex`);
    if (!entity.label?.trim()) errors.push(`${where}: label is required`);
    if (!entity.represents?.trim())
      errors.push(`${where}: represents is required (what it is in the finished video)`);
    if (labels.has(entity.label)) errors.push(`${where}: duplicate label "${entity.label}"`);
    labels.add(entity.label);
    if (HEX.test(entity.color ?? '')) {
      const name = colorNameOf(entity);
      if (names.has(name))
        errors.push(
          `${where}: another entity is already "${name}"; give every entity its own colour`
        );
      names.add(name);
      if (colorDistance(entity.color, GROUND_COLOR) < MIN_COLOR_DISTANCE) {
        warnings.push(
          `${where}: ${entity.color} is close to the grey floor and will not read as a colour`
        );
      }
    }
    const shape = shapeOf(entity);
    if (entity.kind === 'subject' && shape !== 'stickman')
      warnings.push(`${where}: a subject is normally a stickman`);
    if (
      shape === 'stickman' &&
      entity.height !== undefined &&
      (entity.height < 0.3 || entity.height > 4)
    ) {
      errors.push(`${where}: height ${entity.height} m is outside 0.3 to 4`);
    }
    if (entity.size && !isVec3(entity.size))
      errors.push(`${where}: size must be [width, height, depth]`);
    if (entity.position && !isVec3(entity.position))
      errors.push(`${where}: position must be [x, y, z]`);
  }

  const entities = scene.entities ?? [];
  const moving = Object.keys(scene.tracks ?? {});
  for (const id of moving) {
    if (!ids.has(id)) errors.push(`tracks.${id}: no entity with that id`);
    const keys = scene.tracks?.[id] ?? [];
    keys.forEach((key, index) => {
      if (!isVec3(key.position)) errors.push(`tracks.${id}[${index}]: position must be [x, y, z]`);
      if (index > 0 && key.t <= keys[index - 1].t)
        errors.push(`tracks.${id}[${index}]: t must increase`);
      if (canvas && (key.t < 0 || key.t > canvas.durationSeconds))
        errors.push(`tracks.${id}[${index}]: t ${key.t} is outside the clip`);
    });
  }
  if (!entities.some((entity) => entity.kind === 'subject'))
    warnings.push('no subject: nothing for the model to follow');

  const camera = scene.camera ?? [];
  if (camera.length === 0) errors.push('camera needs at least one key');
  camera.forEach((key, index) => {
    if (!isVec3(key.position) || !isVec3(key.lookAt))
      errors.push(`camera[${index}]: position and lookAt must be [x, y, z]`);
    if (index > 0 && key.t <= camera[index - 1].t) errors.push(`camera[${index}]: t must increase`);
    if (canvas && (key.t < 0 || key.t > canvas.durationSeconds))
      errors.push(`camera[${index}]: t ${key.t} is outside the clip`);
  });
  if (camera.length > 0 && canvas && camera[0].t > 0)
    warnings.push('the first camera key is after 0s; the camera holds it until then');

  return { errors, warnings };
}

// ---------- sampling ----------

function ease(kind: 'linear' | 'inOut' | undefined, u: number): number {
  return kind === 'inOut' ? u * u * (3 - 2 * u) : u;
}

function lerp3(a: Vec3, b: Vec3, u: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

function bracket<T extends { t: number }>(keys: T[], t: number): [T, T, number] {
  if (t <= keys[0].t) return [keys[0], keys[0], 0];
  const last = keys[keys.length - 1];
  if (t >= last.t) return [last, last, 0];
  let i = 0;
  while (keys[i + 1].t <= t) i++;
  return [keys[i], keys[i + 1], (t - keys[i].t) / (keys[i + 1].t - keys[i].t)];
}

export interface CameraState {
  fov: number;
  lookAt: Vec3;
  position: Vec3;
}

export function cameraAt(scene: Scene, t: number): CameraState {
  const [a, b, u0] = bracket(scene.camera, t);
  const u = b.cut ? 0 : ease(a.ease, u0);
  return {
    fov: (a.fov ?? 40) + ((b.fov ?? a.fov ?? 40) - (a.fov ?? 40)) * u,
    lookAt: lerp3(a.lookAt, b.lookAt, u),
    position: lerp3(a.position, b.position, u),
  };
}

export function positionAt(scene: Scene, entity: Entity, t: number): Vec3 {
  const keys = scene.tracks?.[entity.id];
  if (!keys || keys.length === 0) return entity.position ?? [0, 0, 0];
  const [a, b, u] = bracket(keys, t);
  return lerp3(a.position, b.position, u);
}

export interface EntityState {
  /** Metres travelled along the ground so far; drives the walk cycle. */
  distance: number;
  pose: Pose;
  position: Vec3;
  speed: number;
  /** Radians about the vertical axis. */
  yaw: number;
}

const STEP = 1 / 60;
const MOVING = 0.05;

function groundSpeed(scene: Scene, entity: Entity, t: number): number {
  const a = positionAt(scene, entity, Math.max(0, t - STEP));
  const b = positionAt(scene, entity, t + STEP);
  const dt = t + STEP - Math.max(0, t - STEP);
  return Math.hypot(b[0] - a[0], b[2] - a[2]) / dt;
}

function headingAt(scene: Scene, entity: Entity, t: number): number {
  const duration = scene.canvas.durationSeconds;
  const sample = (at: number): number | undefined => {
    const a = positionAt(scene, entity, Math.max(0, at - STEP));
    const b = positionAt(scene, entity, at + STEP);
    return Math.hypot(b[0] - a[0], b[2] - a[2]) > MOVING * 2 * STEP
      ? Math.atan2(b[0] - a[0], b[2] - a[2])
      : undefined;
  };
  for (let at = t; at >= 0; at -= 1 / 30) {
    const heading = sample(at);
    if (heading !== undefined) return heading;
  }
  for (let at = t; at <= duration; at += 1 / 30) {
    const heading = sample(at);
    if (heading !== undefined) return heading;
  }
  return ((entity.yaw ?? 0) * Math.PI) / 180;
}

function explicitYaw(scene: Scene, entity: Entity, t: number): number | undefined {
  const keys = (scene.tracks?.[entity.id] ?? []).filter((key) => key.yaw !== undefined);
  if (keys.length === 0) return entity.yaw === undefined ? undefined : (entity.yaw * Math.PI) / 180;
  const [a, b, u] = bracket(keys as (TrackKey & { yaw: number })[], t);
  let delta = (((b.yaw as number) - (a.yaw as number) + 540) % 360) - 180;
  if (Number.isNaN(delta)) delta = 0;
  return (((a.yaw as number) + delta * u) * Math.PI) / 180;
}

function poseAt(scene: Scene, entity: Entity, t: number): Pose {
  let pose: Pose = 'stand';
  for (const key of scene.tracks?.[entity.id] ?? []) {
    if (key.t <= t && key.pose) pose = key.pose;
  }
  return pose;
}

export function entityStateAt(scene: Scene, entity: Entity, t: number): EntityState {
  let distance = 0;
  for (let at = STEP; at <= t; at += STEP) {
    const a = positionAt(scene, entity, at - STEP);
    const b = positionAt(scene, entity, at);
    distance += Math.hypot(b[0] - a[0], b[2] - a[2]);
  }
  return {
    distance,
    pose: poseAt(scene, entity, t),
    position: positionAt(scene, entity, t),
    speed: groundSpeed(scene, entity, t),
    yaw: explicitYaw(scene, entity, t) ?? headingAt(scene, entity, t),
  };
}

// ---------- prompt drafting ----------

const RUN_SPEED = 2.2;

export interface Segment {
  camera: string;
  end: number;
  moves: { entity: Entity; text: string }[];
  start: number;
}

function norm2(x: number, z: number): [number, number] {
  const length = Math.hypot(x, z) || 1;
  return [x / length, z / length];
}

function describeCamera(scene: Scene, start: number, end: number): string {
  const cut = scene.camera.some((key) => key.cut && Math.abs(key.t - start) < 1e-6);
  const move = describeCameraMove(scene, start, end);
  return cut ? `cut to a new camera angle, then ${move}` : move;
}

function describeCameraMove(scene: Scene, start: number, end: number): string {
  const a = cameraAt(scene, start);
  const b = cameraAt(scene, end - 0.001);
  const [fx, fz] = norm2(a.lookAt[0] - a.position[0], a.lookAt[2] - a.position[2]);
  const rx = -fz;
  const rz = fx;
  const dx = b.position[0] - a.position[0];
  const dy = b.position[1] - a.position[1];
  const dz = b.position[2] - a.position[2];
  const forward = dx * fx + dz * fz;
  const right = dx * rx + dz * rz;
  const seconds = end - start;
  const speed = Math.hypot(dx, dy, dz) / seconds;
  const pace = speed > 3 ? 'quickly' : speed > 1 ? 'at a steady pace' : 'slowly';

  const radius = Math.hypot(a.position[0] - a.lookAt[0], a.position[2] - a.lookAt[2]);
  const angleA = Math.atan2(a.position[0] - a.lookAt[0], a.position[2] - a.lookAt[2]);
  const angleB = Math.atan2(b.position[0] - b.lookAt[0], b.position[2] - b.lookAt[2]);
  let sweep = angleB - angleA;
  sweep = Math.atan2(Math.sin(sweep), Math.cos(sweep));
  const arc = Math.abs(sweep) * radius;
  const lookShift = Math.hypot(b.lookAt[0] - a.lookAt[0], b.lookAt[2] - a.lookAt[2]);
  const moved = Math.hypot(dx, dy, dz);

  if (moved < 0.15 && lookShift < 0.3) return 'the camera holds still';
  if (moved < 0.15)
    return `the camera pans ${(b.lookAt[0] - a.lookAt[0]) * rx + (b.lookAt[2] - a.lookAt[2]) * rz > 0 ? 'right' : 'left'}`;
  if (Math.abs(sweep) > 0.35 && arc > Math.abs(forward) * 0.8) {
    // Seen from above, a positive atan2 sweep around +y is a counter-clockwise orbit.
    return `the camera orbits ${sweep > 0 ? 'counter-clockwise' : 'clockwise'} around the subject ${pace}`;
  }
  if (Math.abs(dy) > Math.abs(forward) && Math.abs(dy) > Math.abs(right)) {
    return `the camera cranes ${dy > 0 ? 'up' : 'down'} ${pace}`;
  }
  if (Math.abs(forward) >= Math.abs(right)) {
    return `the camera ${forward > 0 ? 'pushes in' : 'pulls back'} ${pace}`;
  }
  return `the camera tracks ${right > 0 ? 'right' : 'left'} ${pace}`;
}

function describeMove(
  scene: Scene,
  entity: Entity,
  start: number,
  end: number
): string | undefined {
  const a = positionAt(scene, entity, start);
  const b = positionAt(scene, entity, end);
  const cam = cameraAt(scene, start);
  const [fx, fz] = norm2(cam.lookAt[0] - cam.position[0], cam.lookAt[2] - cam.position[2]);
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const distance = Math.hypot(dx, dz);
  const pose = poseAt(scene, entity, end);
  const before = poseAt(scene, entity, start);
  if (pose !== before)
    return pose === 'sit' ? 'sits down' : pose === 'fall' ? 'falls to the ground' : 'stands up';
  if (distance < 0.3) return undefined;
  const away = dx * fx + dz * fz;
  const side = dx * -fz + dz * fx;
  const speed = distance / (end - start);
  const verb =
    shapeOf(entity) === 'stickman'
      ? speed >= RUN_SPEED
        ? 'runs'
        : 'walks'
      : speed > 5
        ? 'speeds'
        : 'moves';
  const direction =
    Math.abs(away) >= Math.abs(side)
      ? away > 0
        ? 'away from the camera'
        : 'toward the camera'
      : side > 0
        ? 'to the right of frame'
        : 'to the left of frame';
  return `${verb} ${direction}`;
}

export function segmentsOf(scene: Scene): Segment[] {
  const times = new Set<number>([0, scene.canvas.durationSeconds]);
  for (const key of scene.camera) times.add(key.t);
  for (const keys of Object.values(scene.tracks ?? {})) for (const key of keys) times.add(key.t);
  const sorted = [...times]
    .filter((t) => t >= 0 && t <= scene.canvas.durationSeconds)
    .sort((x, y) => x - y);
  const segments: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end - start < 0.4) continue;
    const moves: Segment['moves'] = [];
    for (const entity of scene.entities) {
      const text = describeMove(scene, entity, start, end);
      if (text) moves.push({ entity, text });
    }
    segments.push({ camera: describeCamera(scene, start, end), end, moves, start });
  }
  return segments;
}

export interface DraftOptions {
  /** 1-based index of the previs among the request's reference videos. */
  videoIndex?: number;
  /** Where the first image reference is numbered from (default 1). */
  firstImageIndex?: number;
  style?: RefStyle;
}

export interface Draft {
  images: { entity: Entity; index: number }[];
  prompt: string;
  warnings: string[];
}

function secondsLabel(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

function shapeWord(entity: Entity): string {
  switch (shapeOf(entity)) {
    case 'stickman':
      return 'stick figure';
    case 'cylinder':
      return 'cylinder';
    case 'sphere':
      return 'ball';
    case 'zone':
      return 'floor patch';
    case 'wall':
      return 'wall';
    case 'panel':
      return 'flat panel';
    default:
      return 'block';
  }
}

export function draftPrompt(scene: Scene, options: DraftOptions = {}): Draft {
  const style = options.style ?? 'byteplus';
  const video = refName(style, 'Video', options.videoIndex ?? 1);
  const warnings: string[] = [];
  let nextImage = options.firstImageIndex ?? 1;
  const images: Draft['images'] = [];
  const imageOf = new Map<string, string>();
  for (const entity of scene.entities) {
    if (entity.reference) {
      const name = refName(style, 'Image', nextImage);
      images.push({ entity, index: nextImage });
      imageOf.set(entity.id, name);
      nextImage++;
    }
  }

  const lines: string[] = [];
  lines.push(
    `${video} is a rough 3D layout mockup made of stick figures and coloured blocks on a plain grey floor. Use it only as the reference for camera movement, blocking, timing and spatial layout: refer to the camera movement and action rhythm in ${video}.`
  );

  const defs: string[] = [];
  for (const entity of scene.entities) {
    const color = colorNameOf(entity);
    const image = imageOf.get(entity.id);
    const from = image ? `, with the look taken from ${image}` : '';
    const what = `${entity.represents.replace(/[.\s]+$/, '')}${from}`;
    if (entity.kind === 'subject' || entity.kind === 'prop') {
      defs.push(`Define the ${color} ${shapeWord(entity)} in ${video} as ${what}.`);
    } else if (entity.kind === 'place') {
      defs.push(`The ${color} ${shapeWord(entity)} in ${video} marks ${what}.`);
    } else {
      defs.push(`The ${color} ${shapeWord(entity)} in ${video} is ${what}.`);
    }
  }
  lines.push(defs.join(' '));

  const look = [
    scene.setting && `Setting: ${scene.setting.replace(/[.\s]+$/, '')}.`,
    scene.style && `Visual style: ${scene.style.replace(/[.\s]+$/, '')}.`,
  ]
    .filter(Boolean)
    .join(' ');
  if (look) lines.push(look);

  const timeline: { end: number; start: number; text: string }[] = [];
  for (const segment of segmentsOf(scene)) {
    const moves = segment.moves.map((move) => `${move.entity.label} ${move.text}`).join('; ');
    const text = [moves, segment.camera].filter(Boolean).join('; ');
    const previous = timeline[timeline.length - 1];
    if (previous && previous.text === text) previous.end = segment.end;
    else timeline.push({ end: segment.end, start: segment.start, text });
  }
  if (timeline.length > 0) {
    lines.push(
      timeline
        .map(
          (part) =>
            `${secondsLabel(part.start)}-${secondsLabel(part.end)}s: ${part.text.charAt(0).toUpperCase()}${part.text.slice(1)}.`
        )
        .join(' ')
    );
  }

  lines.push(
    `Do not show the stick figures, coloured blocks, grid lines, labels or the grey mockup floor in the result. Keep the camera path, positions and timing from ${video}.`
  );

  const prompt = lines.join('\n\n');
  if (prompt.length > 4000)
    warnings.push(`prompt is ${prompt.length} characters; the limit is 4000`);
  const words = prompt.split(/\s+/).length;
  if (words > 600) warnings.push(`prompt is ${words} words; the Seedance docs recommend under 600`);
  warnings.push(
    'the timeline is a draft built from the keyframes: read it against previs-sheet.png and edit it'
  );
  return { images, prompt, warnings };
}

export function legendOf(scene: Scene): Array<{
  color: string;
  colorName: string;
  id: string;
  kind: Kind;
  label: string;
  reference?: string;
  represents: string;
  shape: Shape;
}> {
  return scene.entities.map((entity) => ({
    color: entity.color,
    colorName: colorNameOf(entity),
    id: entity.id,
    kind: entity.kind,
    label: entity.label,
    reference: entity.reference,
    represents: entity.represents,
    shape: shapeOf(entity),
  }));
}
