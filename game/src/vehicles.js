// Cars: arcade driving with acceleration, steering that bites with
// speed, handbrake slides, damage, smoke, and collisions with buildings,
// other cars and the sea wall. One model serves parked cars, traffic,
// police cruisers and whatever Mara is driving.

import { CARS, ROAD_X } from './config.js';
import { addSkid, spawnParticles } from './particles.js';

const PAINT = ['#c1121f', '#1d3557', '#f4d35e', '#2a9d8f', '#e07a5f', '#6d6875', '#f8f9fa', '#14213d', '#ff6d00', '#3a86ff'];
const POLICE_PAINT = '#f1faee';

export function createCar(rng, x, y, angle, type, role) {
  const spec = CARS[type];
  return {
    x, y, angle,
    speed: 0,
    type,
    role, // parked | traffic | police | player
    color: type === 'police' ? POLICE_PAINT : rng.pick(PAINT),
    health: spec.health,
    maxHealth: spec.health,
    length: spec.length,
    width: spec.width,
    smoked: false,
    dead: false,
    waypoint: null,
    waitAtLight: 0,
    sirenPhase: rng.range(0, Math.PI * 2),
  };
}

export function spawnParkedCars(city, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 60) {
    guard += 1;
    const spot = city.randomRoadPoint(rng);
    // Parked along the road they sit on, so a stolen car drives away
    // down the street instead of straight into the nearest building.
    const vertical = ROAD_X.some((rx) => Math.abs(spot.x - rx) < 30);
    const angle = vertical
      ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
      : (rng.chance(0.5) ? 0 : Math.PI);
    const x = spot.x + (vertical ? rng.range(-26, 26) : 0);
    const y = spot.y + (vertical ? 0 : rng.range(-26, 26));
    if (city.solidAt(x, y, 20)) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 70)) continue;
    const type = rng.pick(['sedan', 'sedan', 'sports', 'taxi', 'truck']);
    cars.push(createCar(rng, x, y, angle, type, 'parked'));
  }
  return cars;
}

function samplePoints(car) {
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  const half = car.length / 2 - 4;
  return [
    { x: car.x + cos * half, y: car.y + sin * half },
    { x: car.x, y: car.y },
    { x: car.x - cos * half, y: car.y - sin * half },
  ];
}

// One arcade physics step. `drive` is { throttle: -1..1, steer: -1..1,
// handbrake: bool }. Returns true when the car hit something hard.
export function stepCar(car, drive, dt, city, fx, audio) {
  if (car.dead) return false;
  const spec = CARS[car.type];
  const forward = drive.throttle;
  const grip = drive.handbrake ? spec.grip * 0.35 : spec.grip;

  if (forward > 0) car.speed += spec.accel * forward * dt;
  else if (forward < 0) {
    if (car.speed > 20) car.speed -= spec.accel * 1.6 * dt; // braking
    else car.speed += spec.accel * 0.55 * forward * dt; // reversing
  }
  // Rolling drag and sand drag.
  const onSand = car.y > 2120;
  car.speed -= car.speed * (onSand ? 1.4 : 0.35) * dt;
  car.speed = Math.max(-spec.reverseMax, Math.min(spec.maxSpeed, car.speed));

  // Steering only bites while moving; handbrake lets the tail step out.
  const speedFactor = Math.min(1, Math.abs(car.speed) / 160);
  const steerRate = spec.turn * speedFactor * (car.speed < 0 ? -1 : 1);
  car.angle += drive.steer * steerRate * dt * (drive.handbrake ? 1.5 : 1);

  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  const lateral = -Math.sin(car.angle);
  const lateralY = Math.cos(car.angle);
  // Velocity is mostly along the nose, with a little sideways slide.
  const slide = Math.max(0, 1 - grip * dt);
  if (car.slideX === undefined) {
    car.slideX = 0;
    car.slideY = 0;
  }
  const vx = cos * car.speed + car.slideX * slide;
  const vy = sin * car.speed + car.slideY * slide;
  car.slideX = vx - cos * car.speed;
  car.slideY = vy - sin * car.speed;

  const nx = car.x + vx * dt;
  const ny = car.y + vy * dt;
  const probe = { ...car, x: nx, y: ny };
  let hit = false;
  for (const p of samplePoints(probe)) {
    if (city.solidAt(p.x, p.y, 6)) {
      hit = true;
      break;
    }
  }
  if (hit) {
    const impact = Math.abs(car.speed);
    if (impact > 140) {
      damageCar(car, impact * 0.06, fx);
      if (audio) audio.crash();
      if (fx) spawnParticles(fx, car.x, car.y, { count: 8, color: '#ffd166', speed: 160, life: 0.4, size: 4 });
    }
    car.speed *= -0.25;
    car.slideX *= -0.3;
    car.slideY *= -0.3;
  } else {
    car.x = nx;
    car.y = ny;
  }

  // Skid marks when sliding hard or handbrake-turning at speed.
  const sliding = Math.hypot(car.slideX, car.slideY);
  if (fx && (sliding > 90 || (drive.handbrake && Math.abs(car.speed) > 160))) {
    addSkid(fx, car.x - cos * (car.length / 2 - 6), car.y - sin * (car.length / 2 - 6), car.angle);
  }
  if (car.health < car.maxHealth * 0.35 && !car.smoked) {
    car.smoked = true;
  }
  return hit;
}

export function damageCar(car, amount, fx) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.speed = 0;
    if (fx) {
      spawnParticles(fx, car.x, car.y, { count: 26, color: '#ff6b35', speed: 220, life: 0.9, size: 7 });
      spawnParticles(fx, car.x, car.y, { count: 14, color: '#555555', speed: 60, life: 1.6, size: 9 });
    }
  }
}

// Push two overlapping cars apart and trade some speed; returns true on hit.
export function collideCars(a, b, fx, audio) {
  if (a.dead || b.dead) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = (a.length + b.length) / 2 - 14;
  if (dist >= minDist || dist === 0) return false;
  const push = (minDist - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const closing = Math.abs(a.speed - b.speed);
  const exchange = (a.speed + b.speed) / 2;
  a.speed = exchange * 0.6;
  b.speed = exchange * 0.6;
  if (closing > 120) {
    damageCar(a, closing * 0.03, fx);
    damageCar(b, closing * 0.03, fx);
    if (audio) audio.crash();
    if (fx) spawnParticles(fx, (a.x + b.x) / 2, (a.y + b.y) / 2, { count: 10, color: '#ffd166', speed: 180, life: 0.4, size: 4 });
    return true;
  }
  return false;
}
