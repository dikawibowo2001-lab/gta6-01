// The heat: a wanted level from 0 to 5 stars, police cruisers that hunt
// the player down and try to ram them off the road, foot cops at higher
// levels, and the bust — stand still next to a cop for too long and the
// run ends at the station. Hide long enough and the heat cools off.

import { WANTED } from './config.js';
import { createCar, stepCar } from './vehicles.js';

export function createWanted() {
  return { stars: 0, heat: 0, hiddenTimer: 0, bustTimer: 0, lastCrime: '' };
}

export function starsOf(wanted) {
  return Math.min(5, Math.floor(wanted.heat / WANTED.heatPerStar));
}

export function addHeat(world, amount, crime) {
  const wanted = world.wanted;
  const before = starsOf(wanted);
  wanted.heat = Math.min(5 * WANTED.heatPerStar, wanted.heat + amount);
  wanted.hiddenTimer = 0;
  wanted.lastCrime = crime;
  const after = starsOf(wanted);
  wanted.stars = after;
  if (after > before) {
    world.banner = { text: `WANTED LEVEL ${after} — ${crime.toUpperCase()}`, color: '#ff4d4d', until: world.time + 2.5 };
    if (world.audio) world.audio.siren(true);
  }
}

function spawnCopCar(world, rng) {
  const player = world.player;
  const angle = rng.range(0, Math.PI * 2);
  const dist = rng.range(700, 950);
  let x = player.x + Math.cos(angle) * dist;
  let y = player.y + Math.sin(angle) * dist;
  x = Math.max(80, Math.min(3120, x));
  y = Math.max(80, Math.min(2320, y));
  const near = world.city.nearestRoadPoint(x, y);
  const car = createCar(rng, near.x, near.y, Math.atan2(player.y - near.y, player.x - near.x), 'police', 'police');
  world.cars.push(car);
  return car;
}

function spawnFootCop(world, rng) {
  const player = world.player;
  const angle = rng.range(0, Math.PI * 2);
  const dist = rng.range(220, 380);
  const x = Math.max(60, Math.min(3140, player.x + Math.cos(angle) * dist));
  const y = Math.max(60, Math.min(2340, player.y + Math.sin(angle) * dist));
  if (world.city.solidAt(x, y, 10)) return;
  world.cops.push({ x, y, angle: 0, speed: 0, state: 'chase', shootCd: rng.range(0.5, 1.5) });
}

function copTargetCount(stars) {
  return stars <= 0 ? 0 : stars === 1 ? 1 : stars === 2 ? 2 : stars === 3 ? 3 : stars === 4 ? 4 : 5;
}

export function stepPolice(world, dt, rng) {
  const wanted = world.wanted;
  const stars = starsOf(wanted);
  wanted.stars = stars;
  const player = world.player;
  const playerPos = player.car ? { x: player.car.x, y: player.car.y } : player;

  // Keep the right number of cruisers on the street.
  const cruisers = world.cars.filter((c) => c.role === 'police' && !c.dead);
  const want = copTargetCount(stars);
  if (cruisers.length < want && stars > 0) {
    if (Math.random() < dt * 1.2) spawnCopCar(world, rng);
  }
  // Foot cops join from two stars up.
  if (stars >= 2 && world.cops.length < stars - 1 && Math.random() < dt * 0.5) {
    spawnFootCop(world, rng);
  }
  if (stars === 0 && world.audio) world.audio.siren(false);
  if (stars > 0 && world.audio) world.audio.siren(true);

  // Is any cop close enough to see the player?
  let seen = false;
  for (const car of cruisers) {
    if (Math.hypot(car.x - playerPos.x, car.y - playerPos.y) < 620) seen = true;
  }
  for (const cop of world.cops) {
    if (Math.hypot(cop.x - playerPos.x, cop.y - playerPos.y) < 480) seen = true;
  }
  if (stars > 0) {
    if (seen) {
      wanted.hiddenTimer = 0;
    } else {
      wanted.hiddenTimer += dt;
      if (wanted.hiddenTimer > WANTED.decayDelay) {
        wanted.heat = Math.max(0, wanted.heat - WANTED.decayRate * dt);
        if (starsOf(wanted) < stars) {
          world.banner = { text: 'HEAT COOLING OFF — STAY HIDDEN', color: '#ffd166', until: world.time + 2 };
        }
      }
    }
  }

  // Cruiser chase: steer at the player, ram when close, back off wrecks.
  for (const car of cruisers) {
    const dx = playerPos.x - car.x;
    const dy = playerPos.y - car.y;
    const dist = Math.hypot(dx, dy);
    const wantedAngle = Math.atan2(dy, dx);
    let diff = wantedAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const throttle = dist > 60 ? 1 : 0.4;
    stepCar(car, {
      throttle,
      steer: Math.max(-1, Math.min(1, diff * 2.6)),
      handbrake: false,
    }, dt, world.city, world.fx, world.audio);
  }

  // Foot cops run at the player and, at three stars, shoot.
  for (let i = world.cops.length - 1; i >= 0; i -= 1) {
    const cop = world.cops[i];
    const dx = playerPos.x - cop.x;
    const dy = playerPos.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (stars === 0 && dist > 500) {
      world.cops.splice(i, 1);
      continue;
    }
    const speed = 185;
    cop.angle = Math.atan2(dy, dx);
    if (dist > 30) {
      const nx = cop.x + Math.cos(cop.angle) * speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * speed * dt;
      if (!world.city.solidAt(nx, ny, 10)) {
        cop.x = nx;
        cop.y = ny;
      }
    }
    cop.shootCd -= dt;
    if (stars >= 3 && dist < 420 && dist > 60 && cop.shootCd <= 0 && !player.car) {
      cop.shootCd = 1.1 + Math.random() * 0.7;
      world.pendingShots.push({ x: cop.x, y: cop.y, angle: cop.angle + (Math.random() - 0.5) * 0.25, from: 'cop', damage: 8 });
      if (world.audio) world.audio.gunshot();
    }
  }

  // The bust: a cop beside a slow player, on foot or stalled in a car.
  const playerSpeed = player.car ? Math.abs(player.car.speed) : (player.moving ? 200 : 0);
  let busting = false;
  if (stars > 0 && playerSpeed < 40) {
    for (const cop of world.cops) {
      if (Math.hypot(cop.x - playerPos.x, cop.y - playerPos.y) < WANTED.bustRange) busting = true;
    }
    for (const car of cruisers) {
      if (Math.abs(car.speed) < 30 && Math.hypot(car.x - playerPos.x, car.y - playerPos.y) < WANTED.bustRange + 14) busting = true;
    }
  }
  if (busting) {
    wanted.bustTimer += dt;
    if (wanted.bustTimer >= WANTED.bustTime) return 'busted';
  } else {
    wanted.bustTimer = 0;
  }
  return null;
}

export function clearWanted(world) {
  world.wanted.heat = 0;
  world.wanted.stars = 0;
  world.wanted.bustTimer = 0;
  world.wanted.hiddenTimer = 0;
  for (const car of world.cars) {
    if (car.role === 'police') car.dead = true;
  }
  world.cars = world.cars.filter((c) => c.role !== 'police');
  world.cops = [];
  if (world.audio) world.audio.siren(false);
}
