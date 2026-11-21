// The city's traffic: ordinary cars that follow the road grid, slow for
// the car ahead, pause at intersections, and keep the streets feeling
// busy. They drive themselves; the player only borrows their cars.

import { ROAD_X, ROAD_Y } from './config.js';
import { createCar, stepCar } from './vehicles.js';

export function spawnTraffic(city, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 60) {
    guard += 1;
    const spot = city.randomRoadPoint(rng);
    if (cars.some((c) => Math.hypot(c.x - spot.x, c.y - spot.y) < 120)) continue;
    const vertical = ROAD_X.some((rx) => Math.abs(spot.x - rx) < 30);
    const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const type = rng.pick(['sedan', 'sedan', 'taxi', 'truck', 'sports']);
    const car = createCar(rng, spot.x, spot.y, angle, type, 'traffic');
    car.waypoint = nextWaypoint(car, rng);
    cars.push(car);
  }
  return cars;
}

// The next intersection along the car's road, or a turn onto a new road.
export function nextWaypoint(car, rng) {
  const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
  if (vertical) {
    const dir = Math.sin(car.angle) > 0 ? 1 : -1;
    const candidates = ROAD_Y.filter((y) => (dir > 0 ? y > car.y + 80 : y < car.y - 80));
    const y = candidates.length ? candidates[Math.floor(rng.next() * candidates.length)] : (dir > 0 ? 2000 : 200);
    const turn = rng.chance(0.55);
    return { x: turn ? rng.pick(ROAD_X) : car.x, y, turn };
  }
  const dir = Math.cos(car.angle) > 0 ? 1 : -1;
  const candidates = ROAD_X.filter((x) => (dir > 0 ? x > car.x + 80 : x < car.x - 80));
  const x = candidates.length ? candidates[Math.floor(rng.next() * candidates.length)] : (dir > 0 ? 2720 : 200);
  const turn = rng.chance(0.55);
  return { x, y: turn ? rng.pick(ROAD_Y) : car.y, turn };
}

function carAhead(car, cars) {
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * cos + dy * sin;
    const side = Math.abs(-dx * sin + dy * cos);
    if (ahead > 0 && ahead < 110 && side < 26) return true;
  }
  return false;
}

export function stepTraffic(cars, allCars, dt, city, rng, fx, audio) {
  for (const car of cars) {
    if (car.dead || car.role !== 'traffic') continue;
    if (!car.waypoint) car.waypoint = nextWaypoint(car, rng);
    const dx = car.waypoint.x - car.x;
    const dy = car.waypoint.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 26) {
      car.waypoint = nextWaypoint(car, rng);
      // A short pause at some intersections, like a red light.
      if (rng.chance(0.3)) car.waitAtLight = rng.range(0.8, 2.2);
      continue;
    }
    if (car.waitAtLight > 0) {
      car.waitAtLight -= dt;
      stepCar(car, { throttle: 0, steer: 0, handbrake: false }, dt, city, fx, audio);
      continue;
    }
    const wanted = Math.atan2(dy, dx);
    let diff = wanted - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const blocked = carAhead(car, allCars);
    const cruise = 0.55;
    stepCar(car, {
      throttle: blocked ? -0.4 : cruise,
      steer: Math.max(-1, Math.min(1, diff * 2.2)),
      handbrake: false,
    }, dt, city, fx, audio);
    // Traffic never speeds: cap it well below the player's pace.
    if (car.speed > 300) car.speed = 300;
  }
}
