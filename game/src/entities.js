// Walkers: Mara, the pedestrians on the sidewalks, the foot cops, the
// Coral Kings rivals and the talkable NPCs. A walker is a position, a
// heading, a walk cycle and a health pool; the renderer draws them as
// low-poly figures (torso, head, legs that swing with the stride).
// NPCs are walkers too — they stand at their spot with a floating
// marker and wait for Mara to press E.

import { clamp, dist2D } from './math3.js';
import { WORLD } from './config.js';
import { makeRng, range, pick } from './random.js';

const SKINS = [
  [0.85, 0.65, 0.5], [0.6, 0.42, 0.3], [0.45, 0.3, 0.22], [0.95, 0.8, 0.68],
];
const SHIRTS = [
  [0.9, 0.2, 0.25], [0.2, 0.5, 0.9], [0.95, 0.85, 0.2], [0.3, 0.8, 0.4],
  [0.9, 0.5, 0.1], [0.6, 0.2, 0.7], [0.9, 0.9, 0.92], [0.15, 0.15, 0.18],
];
const PANTS = [
  [0.2, 0.25, 0.45], [0.35, 0.3, 0.25], [0.5, 0.5, 0.55], [0.15, 0.35, 0.2],
];

export class Walker {
  constructor(x, z, heading, role) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.role = role; // 'player' | 'ped' | 'cop' | 'rival' | 'npc'
    this.hp = 100;
    this.armour = 0;
    this.speed = 0; // current ground speed
    this.walkPhase = Math.random() * Math.PI * 2;
    this.moving = false;
    this.dead = false;
    this.inCar = false;
    this.car = null;
    this.skin = pick(Math.random, SKINS);
    this.shirt = pick(Math.random, SHIRTS);
    this.pants = pick(Math.random, PANTS);
    // Per-walker wander state (peds).
    this.wanderTarget = null;
    this.wanderTimer = 0;
    this.fleeTimer = 0;
    this.shootTimer = 0;
    this.isPlayer = false;
    // NPCs: a display name and scripted lines (see npcs.js).
    this.npcName = null;
    this.npcLines = null;
    this.npcLineIdx = 0;
  }

  get alive() {
    return !this.dead && this.hp > 0;
  }

  damage(amount) {
    let rest = amount;
    if (this.armour > 0) {
      const soaked = Math.min(this.armour, rest * 0.6);
      this.armour -= soaked;
      rest -= soaked;
    }
    this.hp -= rest;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
    return this.dead;
  }

  // Move toward a target at `speed`, turning smoothly. Returns true on
  // arrival (within `arrive` units).
  stepToward(tx, tz, speed, dt, arrive = 1.5) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < arrive) {
      this.moving = false;
      this.speed = 0;
      return true;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += clamp(diff, -6 * dt, 6 * dt);
    this.x += Math.sin(this.heading) * speed * dt;
    this.z += Math.cos(this.heading) * speed * dt;
    this.speed = speed;
    this.moving = true;
    this.walkPhase += dt * speed * 1.6;
    return false;
  }
}

// Pedestrian crowd: walkers on the sidewalks, wandering between random
// block corners, fleeing when shots ring out nearby.
export function spawnPeds(city, count, seed) {
  const rng = makeRng(seed);
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard++ < count * 40) {
    const bx = pick(rng, WORLD.blocks);
    const bz = pick(rng, WORLD.blocks);
    if (bx > 240) continue;
    const x = bx + range(rng, -30, 30);
    const z = bz + range(rng, -30, 30);
    if (city.insideBuilding(x, z)) continue;
    const p = new Walker(x, z, range(rng, 0, Math.PI * 2), 'ped');
    p.skin = pick(rng, SKINS);
    p.shirt = pick(rng, SHIRTS);
    p.pants = pick(rng, PANTS);
    peds.push(p);
  }
  return peds;
}

// One frame of pedestrian behaviour: wander, or run from a scare point.
export function updatePeds(peds, city, scare, dt, rng) {
  for (const p of peds) {
    if (!p.alive) continue;
    if (scare && dist2D(p.x, p.z, scare[0], scare[1]) < 26) {
      p.fleeTimer = 3;
    }
    if (p.fleeTimer > 0) {
      p.fleeTimer -= dt;
      const away = Math.atan2(p.x - scare[0], p.z - scare[1]);
      p.heading = away;
      p.x += Math.sin(away) * 7.5 * dt;
      p.z += Math.cos(away) * 7.5 * dt;
      p.moving = true;
      p.speed = 7.5;
      p.walkPhase += dt * 12;
      const c = city.collide(p.x, p.z, 0.7);
      p.x = c[0];
      p.z = c[1];
      continue;
    }
    p.wanderTimer -= dt;
    if (!p.wanderTarget || p.wanderTimer <= 0) {
      const bx = pick(rng, WORLD.blocks);
      const bz = pick(rng, WORLD.blocks);
      if (bx > 240) continue;
      p.wanderTarget = [bx + range(rng, -28, 28), bz + range(rng, -28, 28)];
      p.wanderTimer = range(rng, 6, 14);
    }
    if (p.wanderTarget) {
      const arrived = p.stepToward(p.wanderTarget[0], p.wanderTarget[1], 2.2, dt, 2);
      if (arrived) p.wanderTarget = null;
      const c = city.collide(p.x, p.z, 0.7);
      p.x = c[0];
      p.z = c[1];
    }
  }
}
