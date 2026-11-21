// Street races: checkpoint racing against three AI rivals. Drive to
// the orange beacon at the old arcade, press J (or start the race
// mission) and the countdown runs 3-2-1-GO. Five checkpoints around
// the city; the HUD shows the live position (1st–4th), the race
// timer and the next checkpoint. Win for $500 and 300 respect XP;
// the race mission (job 10) requires a win. Rivals are real cars with
// the same physics, steered toward each checkpoint with slightly
// different top speeds so the race is winnable but not free.

import { Car } from './vehicles.js';
import { RACE, ECONOMY } from './config.js';
import { clamp, dist2D } from './math3.js';

export class Races {
  constructor() {
    this.active = false;
    this.phase = 'idle'; // idle | countdown | racing | finished
    this.countdown = 0;
    this.countShown = 4;
    this.time = 0;
    this.checkpoints = RACE.checkpoints;
    this.playerCp = 0;
    this.rivals = []; // {car, name, cp, progress}
    this.position = 4;
    this.lastResult = null; // 'win' | 'lose' | null (mission 10 reads this)
    this.finishT = 0;
    this.resultText = '';
  }

  get nextCheckpoint() {
    return this.checkpoints[this.playerCp] || null;
  }

  start(world) {
    if (this.active) return false;
    const [sx, sz] = world.city.spawns.raceStart;
    // Line the player up on the start line, facing the first checkpoint.
    const first = this.checkpoints[0];
    const heading = Math.atan2(first[0] - sx, first[1] - sz);
    let car = world.player.car;
    if (!car) {
      // No car? The race lends Mara a sports car.
      const c = new Car('sports', [1.0, 0.46, 0.16], sx, sz, heading);
      c.driver = 'player';
      world.parked.push(c);
      world.player.x = sx;
      world.player.z = sz;
      world.enterCar();
      car = world.player.car;
    }
    car.x = sx;
    car.z = sz;
    car.heading = heading;
    car.speed = 0;
    world.player.x = sx;
    world.player.z = sz;
    world.player.heading = heading;
    // Three rivals alongside, staggered back.
    this.rivals = [];
    for (let i = 0; i < 3; i++) {
      const rc = new Car('sports', RACE.rivalColors[i], sx + (i - 1) * 6, sz - 8, heading);
      rc.driver = 'race';
      rc.speed = 0;
      world.raceCars.push(rc);
      this.rivals.push({ car: rc, name: RACE.rivalNames[i], cp: 0, progress: 0 });
    }
    this.active = true;
    this.phase = 'countdown';
    this.countdown = 3.2;
    this.countShown = 4;
    this.time = 0;
    this.playerCp = 0;
    this.position = 4;
    this.lastResult = null;
    this.resultText = '';
    world.audio.countBeep(false);
    return true;
  }

  // Progress along the race: checkpoints passed, minus distance to the
  // next one — so a driver halfway to checkpoint 3 beats one who just
  // cleared checkpoint 2.
  progressOf(x, z, cp) {
    const next = this.checkpoints[cp];
    if (!next) return cp * 1000;
    return cp * 1000 - dist2D(x, z, next[0], next[1]);
  }

  update(dt, world) {
    if (!this.active) return;
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const shown = Math.ceil(this.countdown);
      if (shown !== this.countShown && shown >= 0) {
        this.countShown = shown;
        world.audio.countBeep(shown === 0);
      }
      // Hold everyone still on the line.
      if (world.player.car) world.player.car.speed = 0;
      for (const r of this.rivals) r.car.speed = 0;
      if (this.countdown <= 0) {
        this.phase = 'racing';
        world.audio.countBeep(true);
        world.setHint('GO! Hit every checkpoint — 1st wins $500.', 3);
      }
      return;
    }
    if (this.phase === 'finished') {
      this.finishT -= dt;
      if (this.finishT <= 0) {
        this.active = false;
        this.phase = 'idle';
        for (const r of this.rivals) {
          const i = world.raceCars.indexOf(r.car);
          if (i >= 0) world.raceCars.splice(i, 1);
        }
        this.rivals = [];
      }
      return;
    }
    // Racing.
    this.time += dt;
    const p = world.player;
    // Player checkpoint.
    const next = this.nextCheckpoint;
    if (next && dist2D(p.x, p.z, next[0], next[1]) < 14) {
      this.playerCp += 1;
      world.audio.pickup();
      if (this.playerCp >= this.checkpoints.length) {
        this.finish(world);
        return;
      }
      world.setHint(`Checkpoint ${this.playerCp}/${this.checkpoints.length}`, 2);
    }
    // Rivals: steer to their next checkpoint; each has a slightly
    // different cruise speed so the pack spreads out.
    for (let i = 0; i < this.rivals.length; i++) {
      const r = this.rivals[i];
      const target = this.checkpoints[r.cp];
      if (!target) continue;
      if (dist2D(r.car.x, r.car.z, target[0], target[1]) < 14) {
        r.cp += 1;
        continue;
      }
      const want = Math.atan2(target[0] - r.car.x, target[1] - r.car.z);
      let diff = want - r.car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const cruise = 24 + i * 2; // 24, 26, 28 — the pack leader is fast
      const throttle = r.car.speed < cruise ? 0.9 : 0;
      r.car.drive(throttle, clamp(diff * 2, -1, 1), false, dt);
      if (world.city.insideBuilding(r.car.x, r.car.z)) {
        r.car.heading += Math.PI / 2;
        r.car.speed *= 0.5;
      }
      r.progress = this.progressOf(r.car.x, r.car.z, r.cp);
    }
    // Live position: rank everyone by progress.
    const mine = this.progressOf(p.x, p.z, this.playerCp);
    let pos = 1;
    for (const r of this.rivals) if (r.progress > mine) pos += 1;
    this.position = pos;
  }

  finish(world) {
    // Where did the rivals end up? Anyone who already cleared all
    // checkpoints finished ahead of Mara.
    let pos = 1;
    for (const r of this.rivals) if (r.cp >= this.checkpoints.length) pos += 1;
    this.position = pos;
    const prize = ECONOMY.racePrize[pos - 1] || 0;
    const won = pos === 1;
    this.lastResult = won ? 'win' : 'lose';
    this.phase = 'finished';
    this.finishT = 5;
    if (won) {
      world.cash += prize;
      world.raceWins = (world.raceWins || 0) + 1;
      world.progression.addXp(300, 'Race win');
      this.resultText = `1ST PLACE — +$${prize}`;
      world.missions.banner = { title: 'RACE WON', sub: `1st place  +$${prize}  ·  ${this.time.toFixed(1)}s`, t: 4 };
      world.audio.missionDone();
    } else {
      if (prize > 0) world.cash += prize;
      this.resultText = `${pos}${['', 'st', 'nd', 'rd'][pos] || 'th'} PLACE${prize > 0 ? ` — +$${prize}` : ''}`;
      world.missions.banner = { title: 'RACE OVER', sub: this.resultText, t: 4 };
    }
    world.save();
  }

  // Abort (player left the area or the game ended the race).
  abort(world) {
    if (!this.active) return;
    this.active = false;
    this.phase = 'idle';
    for (const r of this.rivals) {
      const i = world.raceCars.indexOf(r.car);
      if (i >= 0) world.raceCars.splice(i, 1);
    }
    this.rivals = [];
  }
}
