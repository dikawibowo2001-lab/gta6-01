// Burning wrecks: when a car's condition hits zero it doesn't just
// stop — it catches fire. Flames and smoke pour out for four seconds
// (the fuse), then the tank goes up: a fireball, flying sparks, a
// damage radius that hurts Mara and nearby cars, and a screen shake.
// What remains is a charred husk that stays in the world. The fuse
// gives Mara time to run — or to use the blast on the cops chasing
// her.

import { dist2D } from './math3.js';

const FUSE = 4; // seconds of burning before the explosion
const BLAST_RADIUS = 14;
const BLAST_DAMAGE = 55;

export class Wrecks {
  constructor() {
    this.explosions = 0;
  }

  // All cars in the world, from every list, de-duplicated by id.
  allCars(world) {
    const seen = new Set();
    const out = [];
    const lists = [
      world.traffic.cars,
      world.parked,
      world.police.cruisers,
      world.rivalCars,
      world.raceCars,
      world.crewCars,
    ];
    if (world.player.car) lists.push([world.player.car]);
    for (const list of lists) {
      for (const c of list) {
        if (c && !seen.has(c.id)) {
          seen.add(c.id);
          out.push(c);
        }
      }
    }
    return out;
  }

  update(dt, world, renderer) {
    for (const car of this.allCars(world)) {
      if (car.wreckState === 'burning') {
        car.wreckT += dt;
        // Flames + smoke while the fuse burns.
        if (Math.random() < 0.8) world.particles.fire(car.x, 1.2, car.z);
        if (Math.random() < 0.6) world.particles.smoke(car.x, 1.8, car.z);
        if (car.wreckT >= FUSE) {
          this.explode(car, world, renderer);
        }
      }
    }
  }

  explode(car, world, renderer) {
    car.wreckState = 'husk';
    car.exploded = true;
    this.explosions += 1;
    world.particles.explosion(car.x, 1, car.z);
    world.audio.explosion();
    if (renderer) renderer.shake = Math.min(1, renderer.shake + 0.8);
    // Damage radius: Mara, nearby cars, nearby walkers.
    const p = world.player;
    const dp = dist2D(car.x, car.z, p.x, p.z);
    if (dp < BLAST_RADIUS) {
      const frac = 1 - dp / BLAST_RADIUS;
      if (p.inCar && p.car && p.car !== car) {
        p.car.damage(BLAST_DAMAGE * frac);
      } else if (!p.inCar) {
        p.damage(BLAST_DAMAGE * frac);
      }
    }
    for (const other of this.allCars(world)) {
      if (other === car || other.wreckState !== 'ok') continue;
      const d = dist2D(car.x, car.z, other.x, other.z);
      if (d < BLAST_RADIUS) {
        other.damage(BLAST_DAMAGE * (1 - d / BLAST_RADIUS));
      }
    }
    for (const ped of world.peds) {
      if (!ped.alive) continue;
      if (dist2D(car.x, car.z, ped.x, ped.z) < BLAST_RADIUS * 0.7) {
        ped.damage(100);
      }
    }
    for (const cop of world.police.cops) {
      if (!cop.alive) continue;
      if (dist2D(car.x, car.z, cop.x, cop.z) < BLAST_RADIUS * 0.7) {
        cop.damage(100);
      }
    }
    for (const r of world.rivals) {
      if (!r.alive) continue;
      if (dist2D(car.x, car.z, r.x, r.z) < BLAST_RADIUS * 0.7) {
        const died = r.damage(100);
        if (died) world.missions.kills += 1;
      }
    }
  }
}
