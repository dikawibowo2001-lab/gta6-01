// The people of Solmar Bay: Mara Vega, the player, and the pedestrians
// who stroll the sidewalks, chat, and run for cover when things get loud.

import { PLAYER } from './config.js';

const SHIRTS = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#e9c46a', '#9b5de5', '#f15bb5', '#00bbf9'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    armor: 0,
    ammo: PLAYER.magSize,
    reloading: 0,
    shootCd: 0,
    punchCd: 0,
    car: null,
    moving: false,
    sprinting: false,
    walkPhase: 0,
  };
}

export function createPed(rng, x, y) {
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 52),
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(SKINS),
    target: null,
    wait: rng.range(0, 3),
    state: 'walk', // walk | flee | down
    fleeTimer: 0,
    walkPhase: rng.range(0, Math.PI * 2),
    down: false,
  };
}

export function spawnPeds(city, rng, count) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard < count * 40) {
    guard += 1;
    const x = rng.range(120, 2820);
    const y = rng.range(120, 2080);
    if (city.solidAt(x, y, 4)) continue;
    if (city.onRoad(x, y)) continue;
    peds.push(createPed(rng, x, y));
  }
  return peds;
}

// Walk the player on foot, sliding along walls instead of sticking.
export function stepPlayerOnFoot(player, move, dt, city, sprinting) {
  const speed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const dx = move.x * speed * dt;
  const dy = move.y * speed * dt;
  player.moving = Math.abs(dx) + Math.abs(dy) > 0.01;
  player.sprinting = sprinting && player.moving;
  if (player.moving) player.walkPhase += dt * (sprinting ? 14 : 9);
  if (dx !== 0 && !city.solidAt(player.x + dx, player.y, PLAYER.radius)) player.x += dx;
  if (dy !== 0 && !city.solidAt(player.x, player.y + dy, PLAYER.radius)) player.y += dy;
  player.x = Math.max(12, Math.min(3188, player.x));
  player.y = Math.max(12, Math.min(2388, player.y));
}

function pickStrollTarget(ped, city, rng) {
  for (let tries = 0; tries < 12; tries += 1) {
    const x = ped.x + rng.range(-260, 260);
    const y = ped.y + rng.range(-260, 260);
    if (x < 60 || y < 60 || x > 2840 || y > 2100) continue;
    if (city.solidAt(x, y, 4)) continue;
    if (city.onRoad(x, y)) continue;
    return { x, y };
  }
  return null;
}

export function stepPeds(peds, dt, city, rng, threat) {
  for (const ped of peds) {
    if (ped.down) continue;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        ped.target = null;
      }
    } else if (threat) {
      const d = Math.hypot(ped.x - threat.x, ped.y - threat.y);
      if (d < threat.radius) {
        ped.state = 'flee';
        ped.fleeTimer = 3 + Math.random() * 2;
        const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
        ped.target = {
          x: ped.x + Math.cos(away) * 320,
          y: ped.y + Math.sin(away) * 320,
        };
      }
    }
    if (!ped.target) {
      ped.wait -= dt;
      if (ped.wait <= 0) {
        ped.target = pickStrollTarget(ped, city, rng);
        ped.wait = rng.range(1, 4);
      } else {
        continue;
      }
    }
    if (!ped.target) continue;
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) {
      ped.target = null;
      continue;
    }
    const speed = ped.state === 'flee' ? ped.speed * 2.6 : ped.speed;
    const step = Math.min(dist, speed * dt);
    const nx = ped.x + (dx / dist) * step;
    const ny = ped.y + (dy / dist) * step;
    if (!city.solidAt(nx, ny, 8)) {
      ped.x = nx;
      ped.y = ny;
      ped.angle = Math.atan2(dy, dx);
      ped.walkPhase += dt * (ped.state === 'flee' ? 16 : 8);
    } else {
      ped.target = null;
    }
  }
}

// Everyone near a gunshot or a crash drops what they are doing and runs.
export function scarePeds(peds, x, y, radius) {
  for (const ped of peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeTimer = 3 + Math.random() * 2;
      const away = Math.atan2(ped.y - y, ped.x - x);
      ped.target = { x: ped.x + Math.cos(away) * 320, y: ped.y + Math.sin(away) * 320 };
    }
  }
}
