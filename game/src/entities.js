// Solmar Bay v4 — dynamic object drawing.
//
// Cars, pedestrians, the police helicopter and boats are all built
// from the shared unit box, tinted per part. Keeping every moving
// thing as a handful of tinted boxes keeps the renderer simple and
// the frame rate high on weak GPUs.

import { matFromTRS } from './math3.js';
import { drawBox } from './gl.js';

export const CAR_COLORS = [
  [0.85, 0.15, 0.15], [0.15, 0.35, 0.85], [0.95, 0.85, 0.2],
  [0.25, 0.75, 0.3], [0.9, 0.9, 0.9], [0.15, 0.15, 0.18],
  [0.95, 0.5, 0.1], [0.55, 0.2, 0.7], [0.2, 0.8, 0.8],
];
export const SHIRT_COLORS = [
  [0.9, 0.3, 0.3], [0.3, 0.6, 0.9], [0.95, 0.8, 0.3],
  [0.4, 0.8, 0.4], [0.9, 0.6, 0.9], [0.95, 0.95, 0.95],
];

const DARK = [0.08, 0.08, 0.1];
const GLASS = [0.55, 0.75, 0.85];
const SKIN = [0.85, 0.62, 0.45];

// A car is a body slab, a cabin, four wheels and two headlights.
// Forward is -z in local space (angle 0 faces north).
export function drawCar(ctx, car) {
  const { pos, angle } = car;
  const m = (dx, dy, dz, sx, sy, sz) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const wx = pos[0] + dx * c + dz * s;
    const wz = pos[2] - dx * s + dz * c;
    return matFromTRS([wx, pos[1] + dy, wz], angle, [sx, sy, sz]);
  };
  const body = car.burnt ? [0.12, 0.11, 0.11] : car.color;
  drawBox(ctx, m(0, 0.55, 0, 2.0, 0.7, 4.4), body);
  drawBox(ctx, m(0, 1.15, 0.3, 1.8, 0.6, 2.2), GLASS);
  drawBox(ctx, m(0, 1.5, 0.3, 1.7, 0.15, 2.0), body);
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    drawBox(ctx, m(wx, 0.35, wz, 0.3, 0.7, 0.7), DARK);
  }
  // Headlights.
  drawBox(ctx, m(-0.7, 0.6, -2.2, 0.4, 0.25, 0.1), [1.0, 0.95, 0.6]);
  drawBox(ctx, m(0.7, 0.6, -2.2, 0.4, 0.25, 0.1), [1.0, 0.95, 0.6]);
  // Police light bar.
  if (car.kind === 'cop') {
    const blink = Math.floor(performance.now() / 250) % 2 === 0;
    drawBox(ctx, m(-0.5, 1.65, 0.3, 0.7, 0.2, 0.5), blink ? [1, 0.1, 0.1] : [0.3, 0.1, 0.1]);
    drawBox(ctx, m(0.5, 1.65, 0.3, 0.7, 0.2, 0.5), blink ? [0.1, 0.1, 0.3] : [0.1, 0.1, 1]);
  }
}

// A pedestrian: legs, torso, head, arms. `walk` swings the legs.
export function drawPed(ctx, ped) {
  const { pos, angle } = ped;
  const swing = Math.sin(ped.walkPhase || 0) * 0.35;
  const m = (dx, dy, dz, sx, sy, sz) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const wx = pos[0] + dx * c + dz * s;
    const wz = pos[2] - dx * s + dz * c;
    return matFromTRS([wx, pos[1] + dy, wz], angle, [sx, sy, sz]);
  };
  drawBox(ctx, m(-0.18, 0.45 + swing * 0.2, swing * 0.3, 0.22, 0.9, 0.25), ped.pants);
  drawBox(ctx, m(0.18, 0.45 - swing * 0.2, -swing * 0.3, 0.22, 0.9, 0.25), ped.pants);
  drawBox(ctx, m(0, 1.25, 0, 0.6, 0.7, 0.35), ped.shirt);
  drawBox(ctx, m(-0.42, 1.25, 0, 0.18, 0.65, 0.2), ped.shirt);
  drawBox(ctx, m(0.42, 1.25, 0, 0.18, 0.65, 0.2), ped.shirt);
  drawBox(ctx, m(0, 1.85, 0, 0.42, 0.4, 0.4), ped.skin || SKIN);
  if (ped.cop) {
    drawBox(ctx, m(0, 2.1, 0, 0.46, 0.12, 0.44), [0.1, 0.15, 0.5]);
  }
}

// Police helicopter: body, tail boom, main + tail rotors, skids.
export function drawHeli(ctx, heli) {
  const { pos, angle, rotor } = heli;
  const m = (dx, dy, dz, sx, sy, sz, extraAngle = 0) => {
    const a = angle + extraAngle;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const wx = pos[0] + dx * c + dz * s;
    const wz = pos[2] - dx * s + dz * c;
    return matFromTRS([wx, pos[1] + dy, wz], a, [sx, sy, sz]);
  };
  drawBox(ctx, m(0, 0, 0, 2.2, 1.6, 4.5), [0.1, 0.15, 0.6]);
  drawBox(ctx, m(0, 0.3, -2.2, 1.8, 1.0, 1.2), GLASS);
  drawBox(ctx, m(0, 0.2, 4.0, 0.5, 0.5, 4.5), [0.1, 0.15, 0.6]);
  drawBox(ctx, m(0, 0.9, 6.0, 0.15, 1.4, 0.8), [0.1, 0.15, 0.6]);
  // Main rotor: two long blades spinning around Y.
  drawBox(ctx, m(0, 1.0, 0, 11, 0.08, 0.5, rotor), DARK);
  drawBox(ctx, m(0, 1.0, 0, 0.5, 0.08, 11, rotor), DARK);
  drawBox(ctx, m(0, 0.9, 0, 0.3, 0.4, 0.3), DARK);
  // Skids.
  drawBox(ctx, m(-0.9, -1.0, 0, 0.15, 0.15, 4.0), DARK);
  drawBox(ctx, m(0.9, -1.0, 0, 0.15, 0.15, 4.0), DARK);
  // Spotlight cone under the belly (pale, additive-looking).
  drawBox(ctx, m(0, -4, -1, 3.5, 7, 3.5), [1.0, 0.95, 0.6]);
}

// Speedboat: hull, windshield, outboard motor.
export function drawBoat(ctx, boat) {
  const { pos, angle } = boat;
  const m = (dx, dy, dz, sx, sy, sz) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const wx = pos[0] + dx * c + dz * s;
    const wz = pos[2] - dx * s + dz * c;
    return matFromTRS([wx, pos[1] + dy, wz], angle, [sx, sy, sz]);
  };
  drawBox(ctx, m(0, 0.5, 0, 2.2, 0.8, 6.5), boat.color);
  drawBox(ctx, m(0, 1.0, -0.5, 1.8, 0.5, 2.0), GLASS);
  drawBox(ctx, m(0, 0.7, 3.2, 0.5, 0.7, 0.4), DARK);
}
