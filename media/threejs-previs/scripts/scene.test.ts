import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cameraAt,
  draftPrompt,
  entityStateAt,
  nearestColorName,
  refName,
  type Scene,
  segmentsOf,
  TARGETS,
  validateScene,
} from './scene';

const template = (): Scene =>
  JSON.parse(readFileSync(join(import.meta.dir, '../templates/chase.scene.json'), 'utf8')) as Scene;

describe('validateScene', () => {
  test('every template is valid for both Seedance targets', () => {
    for (const name of readdirSync(join(import.meta.dir, '../templates'))) {
      const scene = JSON.parse(
        readFileSync(join(import.meta.dir, '../templates', name), 'utf8')
      ) as Scene;
      expect(validateScene(scene, TARGETS['seedance-2.0']).errors).toEqual([]);
      expect(validateScene(scene, TARGETS['seedance-2.5']).errors).toEqual([]);
    }
  });

  test('two entities that share a colour name are refused', () => {
    const scene = template();
    scene.entities[1].color = '#e62020';
    expect(validateScene(scene).errors.join()).toContain('already "red"');
  });

  test('a clip longer than 15 s is refused for Seedance 2.0 and accepted for 2.5', () => {
    const scene = template();
    scene.canvas.durationSeconds = 20;
    expect(validateScene(scene, TARGETS['seedance-2.0']).errors.join()).toContain(
      '20s is outside 2 to 15s'
    );
    expect(validateScene(scene, TARGETS['seedance-2.5']).errors).toEqual([]);
  });

  test('a canvas under the pixel floor is refused', () => {
    const scene = template();
    scene.canvas.width = 360;
    scene.canvas.height = 640;
    expect(validateScene(scene, TARGETS['seedance-2.0']).errors.join()).toContain('230400 px');
  });

  test('a track for an unknown entity and out-of-order keys are refused', () => {
    const scene = template();
    scene.tracks = {
      ghost: [{ position: [0, 0, 0], t: 0 }],
      courier: [
        { position: [0, 0, 0], t: 2 },
        { position: [1, 0, 0], t: 1 },
      ],
    };
    const errors = validateScene(scene).errors.join();
    expect(errors).toContain('tracks.ghost');
    expect(errors).toContain('t must increase');
  });

  test('odd canvas sizes are refused because H.264 needs even sizes', () => {
    const scene = template();
    scene.canvas.width = 721;
    expect(validateScene(scene).errors.join()).toContain('even');
  });
});

describe('sampling', () => {
  test('the camera eases between keys and holds the last key', () => {
    const scene = template();
    expect(cameraAt(scene, 0).position).toEqual([0, 1.5, 9]);
    expect(cameraAt(scene, 8).position).toEqual([-0.5, 1.5, 6]);
    const middle = cameraAt(scene, 3).position;
    expect(middle[2]).toBeLessThan(9);
    expect(middle[2]).toBeGreaterThan(7);
  });

  test('a subject faces the way it walks and keeps that heading when it stops', () => {
    const scene = {
      ...template(),
      tracks: {
        courier: [
          { position: [0, 0, 0] as [number, number, number], t: 0 },
          { position: [4, 0, 0] as [number, number, number], t: 2 },
        ],
      },
    };
    const courier = scene.entities[0];
    const moving = entityStateAt(scene, courier, 1);
    expect(moving.yaw).toBeCloseTo(Math.PI / 2, 2);
    expect(moving.speed).toBeCloseTo(2, 1);
    const stopped = entityStateAt(scene, courier, 4);
    expect(stopped.yaw).toBeCloseTo(Math.PI / 2, 2);
    expect(stopped.speed).toBeLessThan(0.05);
    expect(stopped.distance).toBeCloseTo(4, 1);
  });
});

describe('draftPrompt', () => {
  test('maps every entity colour to what it represents', () => {
    const { prompt } = draftPrompt(template());
    expect(prompt).toContain('Define the red stick figure in Video 1 as Mia');
    expect(prompt).toContain('Define the blue block in Video 1 as a white delivery van');
    expect(prompt).toContain('The green floor patch in Video 1 marks the wet one-lane street');
    expect(prompt).toContain('The yellow flat panel in Video 1 is a glowing neon shop sign');
  });

  test('numbers images in entity order and offsets with firstImageIndex', () => {
    const draft = draftPrompt(template(), { firstImageIndex: 3, style: 'replicate' });
    expect(draft.images.map((image) => image.index)).toEqual([3]);
    expect(draft.prompt).toContain('[Image3]');
    expect(draft.prompt).toContain('[Video1]');
  });

  test('reference names follow each host', () => {
    expect(refName('byteplus', 'Video', 2)).toBe('Video 2');
    expect(refName('replicate', 'Video', 2)).toBe('[Video2]');
    expect(refName('fal', 'Image', 1)).toBe('@Image1');
  });

  test('tells the model not to reproduce the mockup', () => {
    expect(draftPrompt(template()).prompt).toContain(
      'Do not show the stick figures, coloured blocks, grid lines, labels'
    );
  });

  test('the starter timeline names the walk and the push in', () => {
    const { prompt } = draftPrompt(template());
    expect(prompt).toContain('Mia walks toward the camera');
    expect(prompt).toContain('the camera pushes in slowly');
  });

  test('an orbit and a crane are described as such', () => {
    const scene = template();
    scene.camera = [
      { lookAt: [0, 1, 0], position: [0, 1.5, 6], t: 0 },
      { lookAt: [0, 1, 0], position: [6, 1.5, 0], t: 4 },
    ];
    expect(segmentsOf(scene)[0].camera).toContain('orbits');
    scene.camera = [
      { lookAt: [0, 1, 0], position: [0, 1.5, 6], t: 0 },
      { lookAt: [0, 1, 0], position: [0, 6.5, 6], t: 4 },
    ];
    expect(segmentsOf(scene)[0].camera).toContain('cranes up');
  });

  test('a camera cut jumps at its key and the timeline says so', () => {
    const scene = template();
    scene.camera = [
      { lookAt: [0, 1, 0], position: [0, 1.5, 8], t: 0 },
      { cut: true, lookAt: [0, 1, 0], position: [5, 1.5, 3], t: 4 },
      { lookAt: [0, 1, 0], position: [5, 1.5, 3], t: 8 },
    ];
    expect(cameraAt(scene, 3.99).position).toEqual([0, 1.5, 8]);
    expect(cameraAt(scene, 4).position).toEqual([5, 1.5, 3]);
    scene.tracks = {};
    const segments = segmentsOf(scene);
    expect(segments.map((segment) => segment.camera)).toEqual([
      'the camera holds still',
      'cut to a new camera angle, then the camera holds still',
    ]);
  });

  test('a sit pose is described as sitting down', () => {
    const scene = template();
    scene.tracks = {
      courier: [
        { position: [0, 0, 0], t: 0 },
        { pose: 'sit', position: [0, 0, 0], t: 4 },
      ],
    };
    scene.camera = [{ lookAt: [0, 1, 0], position: [0, 1.5, 6], t: 0 }];
    expect(draftPrompt(scene).prompt).toContain('Mia sits down');
  });
});

describe('colour names', () => {
  test('nearest palette colour', () => {
    expect(nearestColorName('#d02828')).toBe('red');
    expect(nearestColorName('#1c6ae0')).toBe('blue');
  });
});
