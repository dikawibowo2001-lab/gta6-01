// Cars: arcade physics on the road grid — accelerate, brake, steer
// with speed-sensitive grip, skid a little at speed, take damage and
// smoke when hurt, burn and explode when wrecked. A car is driven by
// the player, by traffic AI, by the police, by a race rival, or by
// nobody (parked, waiting to be stolen).
//
// GARAGE UPGRADES (v3): the player's car carries an engine level (top
// speed), armour (max condition), a nitro tank (hold Shift for a
// 45% top-speed boost while the tank lasts) and a paint job. The world
// copies the saved upgrades onto whatever car Mara steals.

import { clamp, damp, dist2D } from './math3.js';
import { CAR_TYPES, WORLD } from './config.js';
import { pick } from './random.js';

let nextId = 1;

const ENGINE_TOP_MUL = [1, 1.12, 1.24, 1.4];
const ARMOR_MAX_BONUS = [0, 40, 80, 140];

export class Car {
  constructor(type, color, x, z, heading) {
    this.id = nextId++;
    this.type = type;
    this.spec = CAR_TYPES[type];
    this.name = this.spec.name;
    this.color = color;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0; // signed, units/sec, forward positive
    this.steer = 0; // -1..1, smoothed
    this.condition = 100;
    this.driver = null; // null = parked, 'player', 'traffic', 'police', 'rival', 'race', 'crew'
    this.callsign = null;
    this.role = null;
    this.sirenPhase = Math.random() * Math.PI * 2;
    this.brakeLights = false;
    this.handbrake = false;
    this.dead = false;
    this.wrecked = false;
    // Wreck lifecycle (wrecks.js): 'ok' | 'burning' | 'husk'.
    this.wreckState = 'ok';
    this.wreckT = 0;
    this.exploded = false;
    // Garage upgrades (player's car only).
    this.engineLevel = 0;
    this.armorLevel = 0;
    this.hasNitro = false;
    this.nitroFuel = 100;
    this.nitroActive = false;
    // Traffic-AI state.
    this.route = null;
    this.routeIdx = 0;
    this.waitTimer = 0;
  }

  get maxCondition() {
    return 100 + ARMOR_MAX_BONUS[this.armorLevel || 0];
  }

  get top() {
    let t = this.spec.top * ENGINE_TOP_MUL[this.engineLevel || 0];
    if (this.nitroActive) t *= 1.45;
    if (this.condition < 35) t *= 0.6;
    return t;
  }

  damage(amount) {
    this.condition -= amount;
    if (this.condition <= 0) {
      this.condition = 0;
      this.wrecked = true;
      this.speed = 0;
      // The wreck starts burning; wrecks.js runs the fuse.
      if (this.wreckState === 'ok') {
        this.wreckState = 'burning';
        this.wreckT = 0;
      }
    }
    return this.wrecked;
  }

  get smoking() {
    return this.condition < 45 && !this.wrecked;
  }

  get burning() {
    return this.condition < 18 && !this.wrecked;
  }

  // Apply saved garage upgrades to this car (called when Mara steals
  // a car, so her upgrades follow her, not the vehicle).
  applyUpgrades(up) {
    if (!up) return;
    this.engineLevel = up.engine || 0;
    this.armorLevel = up.armor || 0;
    this.hasNitro = !!up.nitro;
    if (up.paint) this.color = up.paint.slice();
    this.condition = this.maxCondition;
  }

  // Drive with throttle (-1 reverse .. 1 full), steering (-1..1), a
  // handbrake flag and an optional nitro flag. Arcade model: heading
  // follows steering faster at speed, grip bleeds off in a handbrake
  // slide, nitro trades tank fuel for acceleration and top speed.
  drive(throttle, steering, handbrake, dt, nitro = false) {
    if (this.wrecked) return;
    const spec = this.spec;
    this.steer = damp(this.steer, steering, 8, dt);
    this.handbrake = handbrake;
    // Nitro: only while the tank has fuel and the car is accelerating.
    const wantNitro = nitro && this.hasNitro && throttle > 0 && this.nitroFuel > 0;
    this.nitroActive = wantNitro;
    if (wantNitro) {
      this.nitroFuel = Math.max(0, this.nitroFuel - 28 * dt);
    } else {
      this.nitroFuel = Math.min(100, this.nitroFuel + 7 * dt);
    }
    const grip = handbrake ? spec.grip * 0.45 : spec.grip;
    const spd = Math.abs(this.speed);
    const turnRate = grip * clamp(spd / 10, 0.25, 1);
    this.heading += this.steer * turnRate * dt * (this.speed < 0 ? -1 : 1);
    if (throttle > 0) {
      this.speed += spec.accel * throttle * (this.nitroActive ? 1.8 : 1) * dt;
      this.brakeLights = false;
    } else if (throttle < 0) {
      if (this.speed > 0.5) {
        this.speed -= spec.brake * dt;
        this.brakeLights = true;
      } else {
        this.speed += spec.accel * 0.45 * throttle * dt; // reverse
        this.brakeLights = false;
      }
    } else {
      this.speed = damp(this.speed, 0, 0.6, dt);
      this.brakeLights = false;
    }
    if (handbrake) {
      this.speed = damp(this.speed, 0, 2.2, dt);
    }
    this.speed = clamp(this.speed, -spec.top * 0.4, this.top);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    // Soft world bounds: the city edge pushes back.
    const B = WORLD.bound;
    if (Math.abs(this.x) > B) {
      this.x = Math.sign(this.x) * B;
      this.speed *= 0.4;
    }
    if (Math.abs(this.z) > B) {
      this.z = Math.sign(this.z) * B;
      this.speed *= 0.4;
    }
  }

  // Simple circle collision with another car: both take a little damage
  // and bounce apart.
  collideWith(other) {
    const d = dist2D(this.x, this.z, other.x, other.z);
    const min = this.type === 'truck' ? 5.2 : 4.2;
    if (d > min || d === 0) return false;
    const nx = (this.x - other.x) / d;
    const nz = (this.z - other.z) / d;
    const push = (min - d) / 2 + 0.05;
    this.x += nx * push;
    this.z += nz * push;
    other.x -= nx * push;
    other.z -= nz * push;
    const impact = Math.abs(this.speed - other.speed);
    if (impact > 4) {
      this.damage(impact * 0.55);
      other.damage(impact * 0.55);
      this.speed *= 0.55;
      other.speed *= 0.55;
    }
    return true;
  }
}

// Parked cars: a few beauties left around the city for Mara to steal,
// including the hero sports car for mission one and the getaway car
// for the heist finale.
export function spawnParked(rng) {
  const out = [];
  const spots = [
    ['sports', 120, 40, Math.PI / 2],
    ['sedan', -40, 120, 0],
    ['suv', 200, -120, Math.PI],
    ['taxi', 40, -200, Math.PI / 2],
    ['sedan', -200, 40, Math.PI / 2],
    ['sports', 280, 200, 0],
    ['truck', -280, -200, Math.PI / 2],
    ['sedan', 120, 280, Math.PI],
  ];
  for (const [type, x, z, h] of spots) {
    const c = new Car(type, pick(rng, CAR_TYPES[type].paint), x, z, h);
    c.driver = null;
    out.push(c);
  }
  return out;
}
