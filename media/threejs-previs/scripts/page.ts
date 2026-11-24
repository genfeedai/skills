/**
 * Browser side of the previs renderer. Bundled by previs.ts with three.js and loaded in headless
 * Chrome. It draws one deterministic frame per call, so the render never depends on wall-clock time.
 */
import * as THREE from 'three';
import {
  BACKGROUND_COLOR,
  cameraAt,
  colorNameOf,
  type Entity,
  entityStateAt,
  GROUND_COLOR,
  type Pose,
  type Scene,
  shapeOf,
} from './scene';

interface Figure {
  entity: Entity;
  legs?: [THREE.Group, THREE.Group];
  arms?: [THREE.Group, THREE.Group];
  root: THREE.Group;
  body?: THREE.Group;
  top: number;
}

declare global {
  interface Window {
    previs: {
      frame: (index: number) => string;
      init: (scene: Scene, review: boolean) => void;
    };
  }
}

let scene3: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let figures: Figure[] = [];
let data: Scene;
let overlay: HTMLCanvasElement | undefined;

function material(color: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

function limb(length: number, radius: number, color: string): THREE.Group {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 10),
    material(color)
  );
  mesh.position.y = -length / 2;
  pivot.add(mesh);
  return pivot;
}

function stickman(entity: Entity): Figure {
  const h = entity.height ?? 1.7;
  const r = h * 0.03;
  const legLength = h * 0.47;
  const torso = h * 0.3;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const hip = new THREE.Group();
  hip.position.y = legLength;
  body.add(hip);

  const legs: [THREE.Group, THREE.Group] = [
    limb(legLength, r, entity.color),
    limb(legLength, r, entity.color),
  ];
  legs[0].position.set(-h * 0.05, 0, 0);
  legs[1].position.set(h * 0.05, 0, 0);
  hip.add(legs[0], legs[1]);

  const spine = new THREE.Mesh(new THREE.CylinderGeometry(r, r, torso, 10), material(entity.color));
  spine.position.y = torso / 2;
  hip.add(spine);

  const shoulder = new THREE.Group();
  shoulder.position.y = torso;
  hip.add(shoulder);
  const armLength = h * 0.3;
  const arms: [THREE.Group, THREE.Group] = [
    limb(armLength, r, entity.color),
    limb(armLength, r, entity.color),
  ];
  arms[0].position.set(-h * 0.1, 0, 0);
  arms[1].position.set(h * 0.1, 0, 0);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.2, 10), material(entity.color));
  bar.rotation.z = Math.PI / 2;
  shoulder.add(bar, arms[0], arms[1]);

  const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.075, 20, 14), material(entity.color));
  head.position.y = torso + h * 0.1;
  hip.add(head);
  // A small nose, same colour, so the facing direction reads from any camera angle.
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(h * 0.025, h * 0.06, 10),
    material(entity.color)
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, torso + h * 0.1, h * 0.095);
  hip.add(nose);

  return { arms, body, entity, legs, root, top: legLength + torso + h * 0.18 };
}

function outline(mesh: THREE.Mesh, color: string): void {
  const edge = new THREE.Color(color).multiplyScalar(0.45);
  mesh.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: edge })
    )
  );
}

function solid(entity: Entity): Figure {
  const shape = shapeOf(entity);
  const size =
    entity.size ??
    (shape === 'zone'
      ? [6, 0.02, 6]
      : shape === 'wall'
        ? [6, 3, 0.15]
        : shape === 'panel'
          ? [1.6, 0.9, 0.04]
          : [1, 1, 1]);
  const [w, h, d] = size;
  let geometry: THREE.BufferGeometry;
  if (shape === 'cylinder') geometry = new THREE.CylinderGeometry(w / 2, w / 2, h, 24);
  else if (shape === 'sphere') geometry = new THREE.SphereGeometry(w / 2, 24, 16);
  else geometry = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geometry, material(entity.color));
  const lift = shape === 'zone' ? 0.012 : 0;
  mesh.position.y = (shape === 'sphere' ? w / 2 : h / 2) + lift;
  if (shape !== 'sphere' && shape !== 'cylinder' && shape !== 'zone') outline(mesh, entity.color);
  const root = new THREE.Group();
  root.add(mesh);
  return { entity, root, top: (shape === 'sphere' ? w : h) + lift };
}

function pose(figure: Figure, state: ReturnType<typeof entityStateAt>, t: number): void {
  if (!figure.legs || !figure.arms || !figure.body) return;
  const h = figure.entity.height ?? 1.7;
  const [l, r] = figure.legs;
  const [al, ar] = figure.arms;
  const body = figure.body;
  body.rotation.set(0, 0, 0);
  body.position.set(0, 0, 0);
  l.rotation.set(0, 0, 0);
  r.rotation.set(0, 0, 0);
  al.rotation.set(0, 0, 0);
  ar.rotation.set(0, 0, 0);
  const current: Pose = state.pose;
  if (current === 'sit') {
    body.position.y = -h * 0.2;
    l.rotation.x = -Math.PI / 2;
    r.rotation.x = -Math.PI / 2;
    al.rotation.x = -0.5;
    ar.rotation.x = -0.5;
    return;
  }
  if (current === 'fall') {
    body.rotation.x = -Math.PI / 2;
    body.position.set(0, h * 0.04, h * 0.47);
    return;
  }
  if (state.speed > 0.1) {
    const running = state.speed >= 2.2;
    const stride = running ? 2.2 : 1.4;
    const phase = (state.distance / stride) * Math.PI * 2;
    const swing = running ? 0.95 : 0.55;
    l.rotation.x = Math.sin(phase) * swing;
    r.rotation.x = -Math.sin(phase) * swing;
    al.rotation.x = -Math.sin(phase) * swing * 0.9;
    ar.rotation.x = Math.sin(phase) * swing * 0.9;
    if (running) body.rotation.x = 0.18;
  }
  void t;
}

function init(scene: Scene, review: boolean): void {
  data = scene;
  const { width, height } = scene.canvas;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  document.body.append(renderer.domElement);

  scene3 = new THREE.Scene();
  scene3.background = new THREE.Color(BACKGROUND_COLOR);
  scene3.add(new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(6, 12, 8);
  scene3.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), material(GROUND_COLOR));
  ground.rotation.x = -Math.PI / 2;
  scene3.add(ground);
  const grid = new THREE.GridHelper(400, 400, 0xa8a8a8, 0xb8b8b8);
  grid.position.y = 0.002;
  scene3.add(grid);

  camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 1000);
  figures = scene.entities.map((entity) =>
    shapeOf(entity) === 'stickman' ? stickman(entity) : solid(entity)
  );
  for (const figure of figures) scene3.add(figure.root);

  if (review) {
    overlay = document.createElement('canvas');
    overlay.width = width;
    overlay.height = height;
  }
}

function frame(index: number): string {
  const t = Math.min(index / data.canvas.fps, data.canvas.durationSeconds);
  const cam = cameraAt(data, t);
  camera.fov = cam.fov;
  camera.position.set(...cam.position);
  camera.lookAt(...cam.lookAt);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  for (const figure of figures) {
    const state = entityStateAt(data, figure.entity, t);
    figure.root.position.set(...state.position);
    figure.root.rotation.y = state.yaw;
    pose(figure, state, t);
  }
  renderer.render(scene3, camera);

  if (!overlay) return renderer.domElement.toDataURL('image/png');

  const ctx = overlay.getContext('2d') as CanvasRenderingContext2D;
  ctx.drawImage(renderer.domElement, 0, 0);
  const size = Math.round(data.canvas.height / 55);
  ctx.font = `600 ${size}px sans-serif`;
  ctx.textAlign = 'center';
  for (const figure of figures) {
    const point = new THREE.Vector3();
    figure.root.getWorldPosition(point);
    point.y += figure.top + 0.15;
    point.project(camera);
    if (point.z > 1) continue;
    const x = ((point.x + 1) / 2) * overlay.width;
    const y = ((1 - point.y) / 2) * overlay.height;
    const text = `${colorNameOf(figure.entity)}: ${figure.entity.label} (${figure.entity.kind})`;
    const pad = size * 0.4;
    const w = ctx.measureText(text).width + pad * 2;
    ctx.fillStyle = 'rgba(20,20,20,0.82)';
    ctx.fillRect(x - w / 2, y - size - pad, w, size + pad * 1.6);
    ctx.fillStyle = figure.entity.color;
    ctx.fillRect(x - w / 2, y - size - pad, size * 0.35, size + pad * 1.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x + size * 0.15, y - pad * 0.4);
  }
  ctx.fillStyle = 'rgba(20,20,20,0.82)';
  ctx.font = `600 ${size}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillRect(8, 8, size * 11, size * 1.8);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${t.toFixed(2)}s  review render`, 8 + size * 0.5, 8 + size * 1.25);
  return overlay.toDataURL('image/png');
}

window.previs = { frame, init };
