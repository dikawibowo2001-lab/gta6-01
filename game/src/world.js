// The world: everything the game is, wired together — the player, the
// city, traffic, police, missions, combat, particles, pickups, the
// economy and saving — and the per-frame update that moves them all.
//
// The world is also the test surface: window.__game exposes it, and the
// play-test drives it through the same input the player uses.

import { City } from './city.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { MissionManager, MISSIONS } from './missions.js';
import { Combat } from './combat.js';
import { Particles } from './particles.js';
import { Audio } from './audio.js';
import { Walker, spawnPeds, updatePeds } from './entities.js';
import { Car, spawnParked } from './vehicles.js';
import { ECONOMY, RADIO, RANKS, WANTED, WORLD, districtAt } from './config.js';
import { clamp, dist2D, angleLerp, damp } from './math3.js';
import { makeRng, pick } from './random.js';

const SAVE_KEY = 'solmar-bay-save-v3';

export class World {
  constructor(gl, seed = 7) {
    this.gl = gl;
    this.seed = seed;
    this.rng = makeRng(seed + 31);
    this.city = new City(seed);
    this.city.finish(gl);
    this.traffic = new Traffic(this.city, 20, seed + 4);
    this.parked = spawnParked(this.rng);
    this.police = new Police(this.city, seed + 16);
    this.missions = new MissionManager(this.city.spawns);
    this.combat = new Combat();
    this.particles = new Particles(gl);
    this.audio = new Audio();
    this.peds = spawnPeds(this.city, 40, seed + 9);
    this.rivals = [];
    this.rivalCars = [];
    this.pickups = [];
    this.player = new Walker(this.city.spawns.player[0], this.city.spawns.player[1], 0, 'player');
    this.player.isPlayer = true;
    this.player.hp = 100;
    this.player.armour = 0;
    this.camYaw = 0;
    this.cash = ECONOMY.startCash;
    this.xp = 0;
    this.clockMin = 16 * 60 + 24; // 16:24, golden hour
    this.radioIdx = 0;
    this.radioTimer = 0;
    this.screen = 'title';
    this.prevScreen = 'play';
    this.hint = '';
    this.hintTimer = 0;
    this.stolenTarget = false;
    this.saveTimer = 0;
    this.time = 0;
    this.autoDrive = false;
    this.autoLaneZ = 0;
    this.bustedFine = 0;
    this.scare = null;
    this.scareTimer = 0;
    this.rivalsSpawnedFor = -1;
    this.rivalCarsSpawnedFor = -1;
    this.spawnPickups();
    this.load();
  }

  rank() {
    let r = RANKS[0];
    for (const rank of RANKS) if (this.xp >= rank.xp) r = rank;
    return r;
  }

  rankIndex() {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) if (this.xp >= RANKS[i].xp) idx = i;
    return idx;
  }

  xpNext() {
    const idx = this.rankIndex();
    if (idx >= RANKS.length - 1) return RANKS[idx].xp;
    return RANKS[idx + 1].xp;
  }

  radioStation() {
    return RADIO[this.radioIdx % RADIO.length];
  }

  spawnPickups() {
    const spots = [
      ['health', -40, 40], ['health', 120, 120], ['armour', 40, -120],
      ['armour', -120, -40], ['cash', 200, -200], ['cash', -200, 200],
      ['cash', 320, -120], ['health', 280, 40], ['armour', 200, 200],
      ['cash', -280, 120],
    ];
    for (const [kind, x, z] of spots) {
      this.pickups.push({ kind, x, z, taken: false, respawn: 0 });
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash,
        xp: this.xp,
        missionIndex: this.missions.index,
        completed: this.missions.completed,
        hp: this.player.hp,
        armour: this.player.armour,
      }));
    } catch {
      // Storage can be unavailable — the game plays on.
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.cash === 'number') this.cash = s.cash;
      if (typeof s.xp === 'number') this.xp = s.xp;
      if (typeof s.missionIndex === 'number') this.missions.index = Math.min(s.missionIndex, MISSIONS.length);
      if (typeof s.completed === 'number') this.missions.completed = s.completed;
      if (typeof s.hp === 'number') this.player.hp = s.hp;
      if (typeof s.armour === 'number') this.player.armour = s.armour;
    } catch {
      // A corrupt save is ignored, not fatal.
    }
  }

  startGame() {
    if (this.screen === 'title') this.screen = 'play';
    this.audio.ensure();
  }

  setHint(text, hold = 3) {
    this.hint = text;
    this.hintTimer = hold;
  }

  // --- cars ---------------------------------------------------------------
  nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    const all = [...this.traffic.cars, ...this.parked, ...this.police.cruisers, ...this.rivalCars];
    for (const c of all) {
      if (c.wrecked) continue;
      const d = dist2D(this.player.x, this.player.z, c.x, c.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  enterCar() {
    const car = this.nearestCar(5);
    if (!car) return false;
    const wasParked = car.driver === null;
    const wasTraffic = car.driver === 'traffic';
    car.driver = 'player';
    this.player.car = car;
    this.player.inCar = true;
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.heading = car.heading;
    this.camYaw = car.heading;
    if (wasTraffic || car.type === 'police') {
      this.police.addHeat(WANTED.heatFor.steal);
      this.setHint('Carjacked! The SBPD noticed.', 3);
    }
    // Mission steal stages: the right car type at the right place.
    const stage = this.missions.stageDef;
    if (stage && stage.type === 'steal') {
      const target = this.city.spawns[stage.target];
      const nearTarget = target && dist2D(car.x, car.z, target[0], target[1]) < 40;
      const rightType = (stage.target === 'sportsParked' && car.type === 'sports')
        || (stage.target === 'portTruck' && car.type === 'truck');
      if (nearTarget && rightType) this.stolenTarget = true;
    }
    if (wasParked) this.setHint(`${car.name} — yours now.`, 2.5);
    this.audio.click();
    return true;
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.driver = null;
    car.speed *= 0.3;
    const side = 2.6;
    this.player.x = car.x + Math.cos(car.heading) * side;
    this.player.z = car.z - Math.sin(car.heading) * side;
    this.player.inCar = false;
    this.player.car = null;
    this.player.heading = car.heading;
    this.audio.click();
  }

  // --- police outcomes ------------------------------------------------------
  busted() {
    if (this.screen !== 'play') return;
    this.screen = 'busted';
    this.bustedFine = this.police.stars * ECONOMY.finePerStar;
    this.audio.busted();
    this.audio.setSiren(false);
    this.audio.setEngine(0, false);
  }

  payFineAndContinue() {
    this.cash = Math.max(0, this.cash - this.bustedFine);
    this.police.clearHeat();
    if (this.player.car) {
      this.player.car.driver = null;
      this.player.car = null;
      this.player.inCar = false;
    }
    this.player.x = this.city.spawns.player[0];
    this.player.z = this.city.spawns.player[1];
    this.player.hp = Math.max(this.player.hp, 50);
    this.screen = 'play';
    this.save();
  }

  onPlayerHit() {
    // Hook for a hit flash / shake — the HUD reads hp directly.
  }

  wasted() {
    this.cash = Math.max(0, this.cash - 100);
    this.player.hp = 100;
    this.player.armour = 0;
    this.player.dead = false;
    if (this.player.car) {
      this.player.car.driver = null;
      this.player.car = null;
      this.player.inCar = false;
    }
    this.player.x = this.city.spawns.player[0];
    this.player.z = this.city.spawns.player[1];
    this.police.clearHeat();
    this.missions.banner = { title: 'WASTED', sub: 'Mara woke up at the clinic. -$100', t: 4 };
    this.save();
  }

  // --- mission actors -------------------------------------------------------
  spawnRivals() {
    const base = this.city.spawns.junoPickup;
    for (let i = 0; i < 3; i++) {
      const r = new Walker(base[0] + (i - 1) * 6, base[1] + (i % 2) * 5, 0, 'rival');
      r.shirt = [0.75, 0.12, 0.18];
      r.pants = [0.15, 0.15, 0.18];
      r.shootTimer = 1 + i * 0.5;
      this.rivals.push(r);
    }
    this.rivalsSpawnedFor = this.missions.index;
  }

  spawnRivalCars() {
    const base = this.city.spawns.rivalCamp;
    for (let i = 0; i < 3; i++) {
      const c = new Car('sedan', [0.75, 0.12, 0.18], base[0] + i * 8, base[1] + (i % 2) * 6, Math.PI / 2);
      c.driver = 'rival';
      c.speed = 10;
      this.rivalCars.push(c);
    }
    this.rivalCarsSpawnedFor = this.missions.index;
  }

  // --- per-frame update -----------------------------------------------------
  update(dt, input, renderer) {
    this.time += dt;
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hint = '';
    }
    if (this.scareTimer > 0) {
      this.scareTimer -= dt;
      if (this.scareTimer <= 0) this.scare = null;
    }

    // The city stays alive behind the title screen.
    if (this.screen === 'title') {
      this.traffic.update(dt, this.player, false);
      updatePeds(this.peds, this.city, null, dt, this.rng);
      this.particles.update(dt);
      return;
    }
    if (this.screen !== 'play') {
      this.particles.update(dt);
      return;
    }

    this.clockMin += dt * 0.6;
    this.radioTimer -= dt;
    if (this.radioTimer <= 0) {
      this.radioTimer = 45;
      this.radioIdx = (this.radioIdx + 1) % RADIO.length;
    }
    this.saveTimer += dt;
    if (this.saveTimer > 20) {
      this.saveTimer = 0;
      this.save();
    }

    // Mission actors spawn when their job starts.
    if (this.missions.index === 2 && this.missions.active && this.rivalsSpawnedFor !== 2) {
      this.spawnRivals();
    }
    if (this.missions.index === 4 && this.missions.active && this.rivalCarsSpawnedFor !== 4) {
      this.spawnRivalCars();
    }

    // --- keys --------------------------------------------------------------
    if (input.justPressed('KeyJ') && !this.missions.active && this.missions.mission) {
      this.missions.start();
      this.audio.click();
    }
    if (input.justPressed('KeyE')) {
      if (this.player.inCar) this.exitCar();
      else if (!this.enterCar()) this.setHint('No car close enough.', 2);
    }
    if (input.justPressed('KeyR')) this.combat.startReload();
    if (input.justPressed('Digit1')) this.combat.select('fists');
    if (input.justPressed('Digit2')) this.combat.select('pistol');
    if (input.justPressed('Digit3')) this.combat.select('smg');
    if (input.justPressed('KeyQ')) this.combat.cycle();

    // --- player --------------------------------------------------------------
    if (this.player.inCar && this.player.car) {
      this.updateDriving(dt, input);
    } else {
      this.updateOnFoot(dt, input);
    }

    // --- combat ---------------------------------------------------------------
    this.combat.update(dt);
    const firing = this.combat.weapon.auto ? input.mouseDown : input.mousePressed;
    if (firing && !this.player.inCar && this.screen === 'play') {
      this.playerShoot();
    }

    // --- world systems --------------------------------------------------------
    this.traffic.update(dt, this.player, this.police.wanted);
    this.police.update(dt, this.player, this.player.car, this);
    this.missions.update(dt, this);
    updatePeds(this.peds, this.city, this.scare, dt, this.rng);
    this.updateRivals(dt);
    this.updateRivalCars(dt);
    this.updatePickups(dt);
    this.particles.update(dt);

    // Car collisions with the player's car.
    const pc = this.player.car;
    if (pc) {
      for (const t of this.traffic.cars) {
        if (!t.wrecked && pc.collideWith(t)) this.onCrash(pc, t);
      }
      for (const c of this.police.cruisers) {
        if (!c.wrecked && c !== pc) pc.collideWith(c);
      }
      for (const r of this.rivalCars) {
        if (!r.wrecked && pc.collideWith(r)) {
          if (r.wrecked && this.missions.stageDef && this.missions.stageDef.type === 'wreck') {
            this.missions.wrecks++;
          }
          this.onCrash(pc, r);
        }
      }
      // Buildings stop cars too.
      if (this.city.insideBuilding(pc.x, pc.z)) {
        pc.x -= Math.sin(pc.heading) * Math.abs(pc.speed) * dt * 2;
        pc.z -= Math.cos(pc.heading) * Math.abs(pc.speed) * dt * 2;
        if (Math.abs(pc.speed) > 6) {
          pc.damage(Math.abs(pc.speed) * 0.9);
          this.audio.crash();
          this.particles.sparks(pc.x, pc.z);
        }
        pc.speed *= 0.3;
      }
      // Smoke + fire for a hurt car.
      if (pc.smoking && Math.random() < 0.5) {
        this.particles.smoke(pc.x, 1.6, pc.z);
      }
      if (pc.burning && Math.random() < 0.6) {
        this.particles.fire(pc.x, 1.4, pc.z);
      }
      // Speeding past a cop adds a little heat.
      if (Math.abs(pc.speed) > 30 && this.police.cruisers.some((c) => dist2D(c.x, c.z, pc.x, pc.z) < 40)) {
        this.police.addHeat(WANTED.heatFor.speed * dt);
      }
    }

    // Player death.
    if (this.player.hp <= 0 && !this.player.dead) {
      this.player.dead = true;
      this.wasted();
    }

    // Audio state.
    this.audio.setSiren(this.police.sirenOn);
    this.audio.setEngine(pc ? Math.abs(pc.speed) / pc.top : 0, !!pc);
  }

  updateDriving(dt, input) {
    const car = this.player.car;
    let throttle = input.throttle;
    let steer = input.steer;
    if (this.autoDrive) {
      // Screenshot autopilot: hold the lane eastward at cruising speed.
      const wantHeading = Math.PI / 2 + clamp((this.autoLaneZ - car.z) * 0.03, -0.35, 0.35);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      steer = clamp(diff * 2, -1, 1);
      throttle = car.speed < 28 ? 0.8 : 0.2;
    }
    car.drive(throttle, steer, input.handbrake, dt);
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.heading = car.heading;
    this.player.speed = Math.abs(car.speed);
    this.camYaw = car.heading;
    if (input.handbrake && Math.abs(car.speed) > 8 && Math.random() < 0.4) {
      this.particles.skidDust(car.x, car.z);
    }
  }

  updateOnFoot(dt, input) {
    const p = this.player;
    // Aim: Mara faces the mouse cursor, measured from the screen centre
    // and rotated by the camera yaw.
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = input.mouseX - cx;
    const dy = input.mouseY - cy;
    if (Math.hypot(dx, dy) > 30) {
      const aim = this.camYaw + Math.atan2(dx, -dy);
      p.heading = angleLerp(p.heading, aim, Math.min(1, dt * 14));
    }
    // Move relative to the camera.
    let mx = 0;
    let mz = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) mz += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) mz -= 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      const wx = mx * cos + mz * sin;
      const wz = -mx * sin + mz * cos;
      const speed = input.run ? 8 : 5;
      p.x += wx * speed * dt;
      p.z += wz * speed * dt;
      p.moving = true;
      p.speed = speed;
      p.walkPhase += dt * speed * 1.7;
      // Face the movement when not aiming with the mouse.
      if (Math.hypot(dx, dy) <= 30) {
        p.heading = angleLerp(p.heading, Math.atan2(wx, wz), Math.min(1, dt * 10));
      }
      this.camYaw = angleLerp(this.camYaw, p.heading, Math.min(1, dt * 1.2));
    } else {
      p.moving = false;
      p.speed = 0;
    }
    const c = this.city.collide(p.x, p.z, 0.7);
    p.x = c[0];
    p.z = c[1];
    const B = WORLD.bound;
    p.x = clamp(p.x, -B, B);
    p.z = clamp(p.z, -B, B);
    // A car nearby? Hint the steal key.
    if (!this.hint && this.nearestCar(5)) {
      this.setHint('Press E to steal the car', 1.2);
    }
  }

  playerShoot() {
    const p = this.player;
    const targets = [];
    for (const ped of this.peds) {
      if (ped.alive) targets.push({ x: ped.x, z: ped.z, radius: 1.1, kind: 'ped', ref: ped });
    }
    for (const cop of this.police.cops) {
      if (cop.alive) targets.push({ x: cop.x, z: cop.z, radius: 1.1, kind: 'cop', ref: cop });
    }
    for (const r of this.rivals) {
      if (r.alive) targets.push({ x: r.x, z: r.z, radius: 1.1, kind: 'rival', ref: r });
    }
    for (const c of [...this.traffic.cars, ...this.police.cruisers, ...this.rivalCars, ...this.parked]) {
      if (!c.wrecked) targets.push({ x: c.x, z: c.z, radius: 2.6, kind: 'car', ref: c });
    }
    const report = this.combat.current === 'fists'
      ? this.combat.punch(p.x, p.z, p.heading, targets)
      : this.combat.fire(p.x, p.z, p.heading, targets);
    if (!report) return;
    if (report.dry) return;
    if (this.combat.current !== 'fists') {
      this.audio.shot(true);
      this.particles.muzzle(p.x, p.z, p.heading);
      this.police.addHeat(WANTED.heatFor.shoot);
      this.scare = [p.x, p.z];
      this.scareTimer = 2.5;
    }
    if (report.hit) {
      const t = report.hit;
      if (t.kind === 'car') {
        const wrecked = t.ref.damage(report.damage * 0.5);
        this.particles.sparks(t.hitX, t.hitZ);
        if (wrecked && t.ref.driver === 'rival' && this.missions.stageDef && this.missions.stageDef.type === 'wreck') {
          this.missions.wrecks++;
        }
      } else {
        const died = t.ref.damage(report.damage);
        this.particles.blood(t.hitX, t.hitZ);
        if (died) {
          if (t.kind === 'rival') {
            this.missions.kills++;
            this.xp += 50;
          } else if (t.kind === 'cop') {
            this.police.addHeat(WANTED.heatFor.hitCop);
            this.xp += 25;
          } else {
            this.police.addHeat(WANTED.heatFor.hitPed);
          }
        }
      }
    }
  }

  updateRivals(dt) {
    for (const r of this.rivals) {
      if (!r.alive) continue;
      const d = dist2D(r.x, r.z, this.player.x, this.player.z);
      if (d < 40) {
        if (d > 12) {
          r.stepToward(this.player.x, this.player.z, 6, dt, 10);
        } else {
          r.moving = false;
          r.heading = Math.atan2(this.player.x - r.x, this.player.z - r.z);
          r.shootTimer -= dt;
          if (r.shootTimer <= 0) {
            r.shootTimer = 1.3;
            this.combat.npcShot(r, this.player, this);
          }
        }
      }
      const c = this.city.collide(r.x, r.z, 0.7);
      r.x = c[0];
      r.z = c[1];
    }
  }

  updateRivalCars(dt) {
    for (const c of this.rivalCars) {
      if (c.wrecked) continue;
      // Rival escorts flee from Mara.
      const away = Math.atan2(c.x - this.player.x, c.z - this.player.z);
      let diff = away - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.drive(0.8, clamp(diff * 2, -1, 1), false, dt);
      if (this.city.insideBuilding(c.x, c.z)) {
        c.heading += Math.PI / 2;
        c.speed *= 0.5;
      }
    }
  }

  updatePickups(dt) {
    for (const pk of this.pickups) {
      if (pk.taken) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) pk.taken = false;
        continue;
      }
      if (dist2D(this.player.x, this.player.z, pk.x, pk.z) < 3.2) {
        pk.taken = true;
        pk.respawn = 45;
        this.particles.sparkle(pk.x, 1.6, pk.z);
        this.audio.pickup();
        if (pk.kind === 'health') {
          this.player.hp = Math.min(100, this.player.hp + 40);
          this.setHint('+40 HEALTH', 2);
        } else if (pk.kind === 'armour') {
          this.player.armour = Math.min(100, this.player.armour + 50);
          this.setHint('+50 ARMOUR', 2);
        } else {
          this.cash += ECONOMY.pickupCash;
          this.setHint(`+$${ECONOMY.pickupCash} CASH`, 2);
        }
      }
    }
  }

  onCrash(a, b) {
    this.audio.crash();
    this.particles.sparks((a.x + b.x) / 2, (a.z + b.z) / 2);
  }
}
