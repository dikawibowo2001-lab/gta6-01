// Crew abilities: three favors Mara can call in from the Harbor Crew,
// each with a cooldown the HUD shows as a radial sweep. Keys 5/6/7
// (or the HUD buttons):
//
//   5 — BACKUP DRIVER: Juno joins the chase in her own sports car for
//       30 seconds, ramming the nearest cruiser.
//   6 — DISTRACTION: a decoy car screams down a side street; every
//       cruiser chases it instead of Mara for 10 seconds.
//   7 — GETAWAY: Reyes clears a route out — one wanted star, gone,
//       instantly.
//
// Cooldowns: 60s / 45s / 90s. The backup car is a real car in the
// world (world.crewCars) with simple ram-the-cop AI.

import { Car } from './vehicles.js';
import { CREW_ABILITIES } from './config.js';
import { clamp, dist2D } from './math3.js';

export class Crew {
  constructor() {
    this.cooldowns = { backup: 0, decoy: 0, getaway: 0 };
    this.backupCar = null; // the ally car, while it lasts
    this.backupT = 0;
    this.decoyCar = null; // the decoy car, while it lasts
  }

  get defs() {
    return CREW_ABILITIES;
  }

  ready(id) {
    return this.cooldowns[id] <= 0;
  }

  // Fraction of the cooldown remaining (0 = ready).
  frac(id) {
    const def = CREW_ABILITIES.find((d) => d.id === id);
    if (!def) return 0;
    return clamp(this.cooldowns[id] / def.cooldown, 0, 1);
  }

  use(id, world) {
    if (!this.ready(id)) return false;
    const def = CREW_ABILITIES.find((d) => d.id === id);
    if (!def) return false;
    if (id === 'backup') {
      if (this.backupCar) return false;
      const p = world.player;
      const car = new Car('sports', [0.2, 0.5, 0.9], p.x - 10, p.z - 6, p.heading);
      car.driver = 'crew';
      car.speed = 20;
      car.callsign = 'JUNO';
      car.role = 'BACKUP';
      world.crewCars.push(car);
      this.backupCar = car;
      this.backupT = 30;
      this.cooldowns.backup = def.cooldown;
      world.setHint('Juno is on her way — 30 seconds of backup!', 3);
      world.missions.say('Juno', 'I got your six, Mara. Ram them for me.');
      world.audio.click();
      return true;
    }
    if (id === 'decoy') {
      if (world.police.stars <= 0) {
        world.setHint('No heat to shake — save the distraction.', 2.5);
        return false;
      }
      const p = world.player;
      // The decoy car pulls away to the side and the cops follow it.
      const dx = p.x + 60;
      const dz = p.z + 40;
      const car = new Car('sedan', [0.95, 0.85, 0.2], p.x + 8, p.z + 8, Math.PI / 4);
      car.driver = 'crew';
      car.speed = 26;
      car.callsign = 'DECOY';
      car.role = 'DECOY';
      world.crewCars.push(car);
      this.decoyCar = car;
      world.police.decoy = { x: dx, z: dz, t: 10 };
      this.cooldowns.decoy = def.cooldown;
      world.setHint('Decoy away! The cruisers are chasing a ghost.', 3);
      world.audio.click();
      return true;
    }
    if (id === 'getaway') {
      if (world.police.stars <= 0) {
        world.setHint('No heat to lose — save the getaway.', 2.5);
        return false;
      }
      world.police.loseStar();
      this.cooldowns.getaway = def.cooldown;
      world.setHint('Reyes cleared a route — one star gone!', 3);
      world.audio.click();
      return true;
    }
    return false;
  }

  update(dt, world) {
    for (const k of Object.keys(this.cooldowns)) {
      this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    }
    // Backup driver: ram the nearest cruiser, then fall back to Mara.
    if (this.backupCar) {
      this.backupT -= dt;
      const car = this.backupCar;
      if (this.backupT <= 0 || car.wrecked) {
        const i = world.crewCars.indexOf(car);
        if (i >= 0) world.crewCars.splice(i, 1);
        this.backupCar = null;
      } else {
        let target = null;
        let bestD = Infinity;
        for (const c of world.police.cruisers) {
          if (c.wrecked) continue;
          const d = dist2D(car.x, car.z, c.x, c.z);
          if (d < bestD) {
            bestD = d;
            target = c;
          }
        }
        const tx = target ? target.x : world.player.x;
        const tz = target ? target.z : world.player.z;
        const want = Math.atan2(tx - car.x, tz - car.z);
        let diff = want - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.drive(target ? 1 : 0.6, clamp(diff * 2, -1, 1), false, dt);
        if (target) car.collideWith(target);
        if (world.city.insideBuilding(car.x, car.z)) {
          car.heading += Math.PI / 2;
          car.speed *= 0.5;
        }
      }
    }
    // Decoy car: drives away in a straight line; the police chase its
    // position, which the world keeps in sync.
    if (this.decoyCar) {
      const car = this.decoyCar;
      car.drive(0.9, 0, false, dt);
      if (world.police.decoy) {
        world.police.decoy.x = car.x;
        world.police.decoy.z = car.z;
      } else {
        const i = world.crewCars.indexOf(car);
        if (i >= 0) world.crewCars.splice(i, 1);
        this.decoyCar = null;
      }
    }
  }
}
