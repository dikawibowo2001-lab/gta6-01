// The SBPD: heat, stars, and everything that hunts Mara. Cruisers
// chase and ram, foot cops swarm from two stars, roadblocks close the
// road from four — and from three stars a police helicopter joins the
// hunt.
//
// HELICOPTER VISIBILITY (the v2.0 lesson): the old heli flew a high,
// wide orbit and never entered the chase camera's frustum, so the money
// shot had no helicopter in it. This heli flies LOW and CLOSE — about
// 20 units up, slotted 36 ahead of the player along their heading,
// tracking its slot fast (a slow heli lags behind a speeding car and
// ends up overhead, above the frustum) — so it sits in the upper frame
// of the chase cam together with its spotlight cone and the bright pool
// it throws on the road. The chase camera also pitches up a few degrees
// while the heli is up.
//
// CREW ABILITIES (v3): the distraction decoy gives the cruisers a fake
// target for 10 seconds, and the getaway ability drops one star of
// heat instantly. Both live here because the police own the heat.

import { Car } from './vehicles.js';
import { Walker } from './entities.js';
import { WANTED, CALLSIGNS, WORLD } from './config.js';
import { makeRng, shuffled } from './random.js';
import { clamp, dist2D, damp } from './math3.js';

export class Helicopter {
  constructor() {
    this.x = 0;
    this.y = 22;
    this.z = 0;
    this.heading = 0;
    this.active = false;
    this.orbitT = 0;
    this.rotor = 0;
    this.spotTarget = [0, 0]; // where the spotlight pool lands
  }

  // The heli holds a slot ahead of the player: forward along their
  // heading, high enough to clear the towers' mid-floors, close enough
  // to stay in the chase camera's view.
  update(dt, player, playerHeading) {
    this.orbitT += dt;
    this.rotor += dt * 30;
    const fx = Math.sin(playerHeading);
    const fz = Math.cos(playerHeading);
    const side = Math.sin(this.orbitT * 0.45) * 8;
    const sx = -fz * side;
    const sz = fx * side;
    const wantX = player.x + fx * 36 + sx;
    const wantZ = player.z + fz * 36 + sz;
    const wantY = 20 + Math.sin(this.orbitT * 0.7) * 2;
    this.x = damp(this.x, wantX, 4.0, dt);
    this.z = damp(this.z, wantZ, 4.0, dt);
    this.y = damp(this.y, wantY, 4.0, dt);
    this.heading = Math.atan2(player.x - this.x, player.z - this.z);
    // The spotlight tracks the player with a slight lag.
    this.spotTarget[0] = damp(this.spotTarget[0], player.x, 2.5, dt);
    this.spotTarget[1] = damp(this.spotTarget[1], player.z, 2.5, dt);
  }
}

export class Police {
  constructor(city, seed) {
    this.city = city;
    this.rng = makeRng(seed);
    this.heat = 0; // 0–100
    this.cruisers = [];
    this.cops = []; // foot cops
    this.roadblocks = []; // {x, z, heading, cars}
    this.heli = new Helicopter();
    this.spawnTimer = 0;
    this.copTimer = 0;
    this.blockTimer = 0;
    this.bustedTimer = 0;
    this.callsigns = shuffled(this.rng, CALLSIGNS);
    this.callsignIdx = 0;
    this.sirenOn = false;
    // Crew distraction: a fake target the cruisers chase instead of
    // Mara while it lasts. {x, z, t} or null.
    this.decoy = null;
  }

  get stars() {
    if (this.heat <= 0) return 0;
    return Math.min(5, Math.floor(this.heat / 20) + 1);
  }

  get wanted() {
    return this.stars > 0;
  }

  nextCallsign() {
    const c = this.callsigns[this.callsignIdx % this.callsigns.length];
    this.callsignIdx++;
    return c;
  }

  addHeat(amount) {
    this.heat = clamp(this.heat + amount, 0, 100);
  }

  // Drop exactly one star of heat (crew getaway ability).
  loseStar() {
    if (this.stars <= 0) return false;
    this.heat = Math.max(0, this.heat - 20);
    return true;
  }

  // The dispatch list the HUD shows: every unit, its callsign, its
  // distance from Mara and its current role.
  dispatchList(player) {
    const out = [];
    for (const c of this.cruisers) {
      out.push({
        callsign: c.callsign || 'UNIT',
        role: c.role || 'PURSUE',
        dist: Math.round(dist2D(c.x, c.z, player.x, player.z)),
      });
    }
    for (const c of this.cops) {
      if (!c.alive) continue;
      out.push({
        callsign: c.callsign || 'OFFICER',
        role: 'ON FOOT',
        dist: Math.round(dist2D(c.x, c.z, player.x, player.z)),
      });
    }
    if (this.heli.active) {
      out.push({
        callsign: 'CONDOR-1',
        role: 'AIR SUPPORT',
        dist: Math.round(dist2D(this.heli.x, this.heli.z, player.x, player.z)),
      });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out.slice(0, 6);
  }

  update(dt, player, playerCar, world) {
    const stars = this.stars;
    this.sirenOn = stars > 0;

    // The decoy burns down; while it lives, cruisers chase it.
    if (this.decoy) {
      this.decoy.t -= dt;
      if (this.decoy.t <= 0) this.decoy = null;
    }
    const chaseX = this.decoy ? this.decoy.x : player.x;
    const chaseZ = this.decoy ? this.decoy.z : player.z;

    // Heat decays while no unit can see Mara.
    const seen = this.cruisers.some((c) => dist2D(c.x, c.z, player.x, player.z) < 60)
      || this.cops.some((c) => c.alive && dist2D(c.x, c.z, player.x, player.z) < 40)
      || this.heli.active;
    if (!seen && this.heat > 0) {
      this.heat = Math.max(0, this.heat - WANTED.heatLoss * dt);
    }

    // Helicopter.
    if (stars >= WANTED.heliAt) {
      if (!this.heli.active) {
        this.heli.active = true;
        this.heli.x = player.x + 20;
        this.heli.z = player.z - 20;
        this.heli.y = 20;
        this.heli.spotTarget = [player.x, player.z];
      }
      const heading = playerCar ? playerCar.heading : player.heading;
      this.heli.update(dt, player, heading);
    } else {
      this.heli.active = false;
    }

    // Spawn cruisers up to the star count.
    this.spawnTimer -= dt;
    const want = WANTED.cruisersByStar[stars] || 0;
    if (this.cruisers.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      this.spawnCruiser(player);
    }

    // Foot cops from two stars.
    this.copTimer -= dt;
    if (stars >= WANTED.footCopsAt && this.cops.filter((c) => c.alive).length < stars && this.copTimer <= 0) {
      this.copTimer = 3;
      this.spawnCop(player);
    }

    // Roadblocks from four stars: two cruisers parked across the road
    // ahead of Mara's heading.
    this.blockTimer -= dt;
    if (stars >= WANTED.roadblockAt && this.roadblocks.length < 2 && this.blockTimer <= 0) {
      this.blockTimer = 18;
      this.placeRoadblock(player, playerCar);
    }

    // Cruiser AI: chase, ram, and PIT when alongside. Roadblock cars
    // hold their ground — they are parked across the road on purpose.
    // While a decoy is live, the cruisers chase the decoy instead.
    for (const c of this.cruisers) {
      if (c.wrecked || c.role === 'ROADBLOCK') continue;
      const d = dist2D(c.x, c.z, chaseX, chaseZ);
      const wantHeading = Math.atan2(chaseX - c.x, chaseZ - c.z);
      let diff = wantHeading - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Aim slightly ahead of a moving player to intercept.
      const steer = clamp(diff * 2.2, -1, 1);
      let throttle = 1;
      if (this.decoy) {
        c.role = 'DECOY';
      } else if (d < 6 && playerCar) {
        // Ram: full throttle into the player's flank.
        throttle = 1;
        c.role = 'RAMMING';
      } else if (d < 14) {
        c.role = 'PURSUE';
      } else {
        c.role = 'INTERCEPT';
      }
      // Don't overshoot a stopped player: brake in close.
      if (d < 4 && !playerCar && !this.decoy) throttle = -1;
      c.drive(throttle, steer, false, dt);
      c.sirenPhase += dt * 9;
      // Collision with the player's car.
      if (playerCar) c.collideWith(playerCar);
      // Cops also bump traffic out of the way.
      for (const t of world.traffic.cars) {
        if (!t.wrecked) c.collideWith(t);
      }
    }
    this.cruisers = this.cruisers.filter((c) => !c.wrecked || dist2D(c.x, c.z, player.x, player.z) < 80);

    // Foot cops: run at Mara, shoot when close.
    for (const cop of this.cops) {
      if (!cop.alive) continue;
      const d = dist2D(cop.x, cop.z, player.x, player.z);
      if (d > 10) {
        cop.stepToward(player.x, player.z, 7, dt, 8);
      } else {
        cop.moving = false;
        cop.speed = 0;
        cop.heading = Math.atan2(player.x - cop.x, player.z - cop.z);
        cop.shootTimer -= dt;
        if (cop.shootTimer <= 0 && world) {
          cop.shootTimer = 1.1;
          world.combat.npcShot(cop, player, world);
        }
      }
      const cc = this.city.collide(cop.x, cop.z, 0.7);
      cop.x = cc[0];
      cop.z = cc[1];
    }

    // Busted: pinned at low speed with a cruiser on top of Mara.
    if (stars > 0 && playerCar && Math.abs(playerCar.speed) < 1.5 && !this.decoy) {
      const close = this.cruisers.some((c) => !c.wrecked && dist2D(c.x, c.z, player.x, player.z) < 7);
      if (close) {
        this.bustedTimer += dt;
        if (this.bustedTimer > WANTED.bustedWait) {
          world.busted();
          this.bustedTimer = 0;
        }
      } else {
        this.bustedTimer = 0;
      }
    } else {
      this.bustedTimer = 0;
    }

    // Roadblock cars sit still; clean up blocks far behind.
    this.roadblocks = this.roadblocks.filter((rb) => dist2D(rb.x, rb.z, player.x, player.z) < 260);
  }

  spawnCruiser(player) {
    const a = this.rng() * Math.PI * 2;
    const r = 55 + this.rng() * 25;
    const x = player.x + Math.cos(a) * r;
    const z = player.z + Math.sin(a) * r;
    const c = new Car('police', [0.09, 0.09, 0.11], x, z, Math.atan2(player.x - x, player.z - z));
    c.driver = 'police';
    c.callsign = this.nextCallsign();
    c.role = 'PURSUE';
    c.speed = 18;
    this.cruisers.push(c);
  }

  spawnCop(player) {
    const a = this.rng() * Math.PI * 2;
    const r = 18 + this.rng() * 10;
    const cop = new Walker(player.x + Math.cos(a) * r, player.z + Math.sin(a) * r, 0, 'cop');
    cop.shirt = [0.1, 0.2, 0.55];
    cop.pants = [0.12, 0.14, 0.2];
    cop.callsign = this.nextCallsign();
    cop.shootTimer = 0.8;
    this.cops.push(cop);
  }

  placeRoadblock(player, playerCar) {
    const heading = playerCar ? playerCar.heading : player.heading;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const ahead = 90 + this.rng() * 30;
    const bx = player.x + fx * ahead;
    const bz = player.z + fz * ahead;
    const perp = heading + Math.PI / 2;
    const cars = [];
    for (const off of [-5, 5]) {
      const c = new Car('police', [0.09, 0.09, 0.11], bx + Math.sin(perp) * off, bz + Math.cos(perp) * off, perp);
      c.driver = 'police';
      c.callsign = this.nextCallsign();
      c.role = 'ROADBLOCK';
      cars.push(c);
    }
    this.roadblocks.push({ x: bx, z: bz, heading, cars });
    for (const c of cars) this.cruisers.push(c);
  }

  clearHeat() {
    this.heat = 0;
    this.cruisers = [];
    this.cops = [];
    this.roadblocks = [];
    this.heli.active = false;
    this.sirenOn = false;
    this.decoy = null;
  }
}
