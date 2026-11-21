// Solmar Bay v4 — ambient traffic: road cars and pedestrians.
//
// Traffic cars follow the road grid: each one drives along a road
// line, and at intersections it may turn onto the crossing road.
// Cars ahead slow the flow, and a wrecked or far-away car respawns
// on another road. Pedestrians stroll the sidewalks and bolt when
// they hear gunfire or see a car bearing down on them.

import { CFG } from './config.js';
import { lerpAngle, v3DistXZ } from './math3.js';
import { roadLines } from './world.js';
import { makeCar } from './vehicles.js';
import { CAR_COLORS, SHIRT_COLORS } from './entities.js';

function headingFor(axis, dir) {
  // Forward is (-sin a, -cos a); solve for each compass direction.
  if (axis === 'x') return dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  return dir > 0 ? Math.PI : 0;
}

export function makeTraffic(G) {
  const lines = roadLines();

  function randomRoute() {
    const axis = G.rng.chance(0.5) ? 'x' : 'z';
    return { axis, dir: G.rng.chance(0.5) ? 1 : -1, road: G.rng.pick(lines) };
  }

  function spawnTrafficCar() {
    const route = randomRoute();
    const along = G.rng.range(-140, 140);
    const lane = route.dir > 0 ? 2.6 : -2.6;
    const x = route.axis === 'x' ? along : route.road + lane;
    const z = route.axis === 'x' ? route.road + lane : along;
    // Keep fresh spawns away from the player.
    if (v3DistXZ([x, 0, z], G.player.pos) < 40) return null;
    const car = makeCar(x, z, headingFor(route.axis, route.dir), {
      color: G.rng.pick(CAR_COLORS),
      kind: G.rng.chance(0.1) ? 'sport' : 'sedan',
      driver: 'traffic',
    });
    car.route = route;
    car.cruise = CFG.trafficSpeed * G.rng.range(0.8, 1.15);
    G.cars.push(car);
    return car;
  }

  function spawnPed() {
    const road = G.rng.pick(lines);
    const along = G.rng.range(-140, 140);
    const side = G.rng.chance(0.5) ? 7 : -7;
    const horizontal = G.rng.chance(0.5);
    const ped = {
      pos: [horizontal ? along : road + side, 0, horizontal ? road + side : along],
      angle: G.rng.range(0, Math.PI * 2),
      speed: 0,
      walkPhase: G.rng.range(0, 6),
      shirt: G.rng.pick(SHIRT_COLORS),
      pants: [0.2, 0.2, 0.3],
      state: 'stroll',
      dir: G.rng.chance(0.5) ? 1 : -1,
      axis: horizontal ? 'x' : 'z',
      road,
      fleeTimer: 0,
      dead: false,
    };
    G.peds.push(ped);
    return ped;
  }

  function carAhead(car, dist) {
    const fx = -Math.sin(car.angle);
    const fz = -Math.cos(car.angle);
    for (const other of G.cars) {
      if (other === car || other.dead) continue;
      const dx = other.pos[0] - car.pos[0];
      const dz = other.pos[2] - car.pos[2];
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < dist && side < 2.5) return true;
    }
    return false;
  }

  function updateTrafficCar(car, dt) {
    const route = car.route;
    if (!route) return;
    const targetAngle = headingFor(route.axis, route.dir);
    car.angle = lerpAngle(car.angle, targetAngle, Math.min(1, dt * 2.5));
    // Ease back onto the lane centre.
    const lane = route.dir > 0 ? 2.6 : -2.6;
    if (route.axis === 'x') {
      car.pos[2] += ((route.road + lane) - car.pos[2]) * Math.min(1, dt * 1.5);
    } else {
      car.pos[0] += ((route.road + lane) - car.pos[0]) * Math.min(1, dt * 1.5);
    }
    let want = car.cruise;
    if (carAhead(car, 10)) want = 0;
    car.speed += (want - car.speed) * Math.min(1, dt * 2);
    // At an intersection, maybe turn onto the crossing road.
    const along = route.axis === 'x' ? car.pos[0] : car.pos[2];
    const crossing = lines.find((l) => Math.abs(along - l) < 2.5);
    if (crossing !== undefined && G.rng.chance(dt * 0.55)) {
      const newAxis = route.axis === 'x' ? 'z' : 'x';
      car.route = { axis: newAxis, dir: G.rng.chance(0.5) ? 1 : -1, road: crossing };
    }
    // Wrap around the city edge instead of driving into the void.
    if (car.pos[0] > 155 || car.pos[0] < -155 || car.pos[2] > 155 || car.pos[2] < -155) {
      car.route.dir *= -1;
    }
  }

  function updatePed(ped, dt) {
    if (ped.dead) return;
    const danger = G.combat.lastShotAt && (G.time - G.combat.lastShotAt < 2.5);
    const playerClose = v3DistXZ(ped.pos, G.player.pos) < 6
      && G.player.car && Math.abs(G.player.car.speed) > 10;
    if ((danger || playerClose) && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeTimer = 4;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const dx = ped.pos[0] - G.player.pos[0];
      const dz = ped.pos[2] - G.player.pos[2];
      const d = Math.hypot(dx, dz) || 1;
      ped.angle = Math.atan2(-dx / d, -dz / d);
      ped.speed = 6.5;
      ped.pos[0] += (dx / d) * ped.speed * dt;
      ped.pos[2] += (dz / d) * ped.speed * dt;
      ped.walkPhase += dt * 11;
      if (ped.fleeTimer <= 0) ped.state = 'stroll';
      return;
    }
    // Stroll along the sidewalk; turn at random intersections.
    ped.speed = 1.4;
    const along = ped.axis === 'x' ? ped.pos[0] : ped.pos[2];
    const crossing = lines.find((l) => Math.abs(along - l) < 2);
    if (crossing !== undefined && G.rng.chance(dt * 0.25)) {
      ped.axis = ped.axis === 'x' ? 'z' : 'x';
      ped.dir = G.rng.chance(0.5) ? 1 : -1;
      ped.road = crossing;
    }
    if (ped.axis === 'x') {
      ped.pos[0] += ped.dir * ped.speed * dt;
      ped.pos[2] += (ped.road + 7 * Math.sign(ped.pos[2] - ped.road || 1) - ped.pos[2]) * dt;
      ped.angle = ped.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      ped.pos[2] += ped.dir * ped.speed * dt;
      ped.pos[0] += (ped.road + 7 * Math.sign(ped.pos[0] - ped.road || 1) - ped.pos[0]) * dt;
      ped.angle = ped.dir > 0 ? Math.PI : 0;
    }
    ped.walkPhase += dt * 7;
    if (Math.abs(ped.pos[0]) > 150 || Math.abs(ped.pos[2]) > 150) ped.dir *= -1;
  }

  return {
    spawnInitial() {
      for (let i = 0; i < CFG.trafficCount; i += 1) spawnTrafficCar();
      for (let i = 0; i < 18; i += 1) spawnPed();
    },
    spawnTrafficCar,
    spawnPed,
    update(dt) {
      let alive = 0;
      for (const car of G.cars) {
        if (car.driver !== 'traffic') continue;
        if (car.dead || car.burnt) continue;
        alive += 1;
        updateTrafficCar(car, dt);
      }
      // Top the traffic back up when cars wreck or wander off.
      if (alive < CFG.trafficCount && G.rng.chance(dt * 0.8)) spawnTrafficCar();
      for (const ped of G.peds) updatePed(ped, dt);
      // Replace dead pedestrians after a while.
      const dead = G.peds.filter((p) => p.dead).length;
      if (G.peds.length - dead < 14 && G.rng.chance(dt * 0.3)) spawnPed();
    },
  };
}
