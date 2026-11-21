// Solmar Bay v4 — street races.
//
// A checkpoint race around the northern loop: 6 gates, 3 AI rivals,
// a 3-2-1-GO countdown and live position tracking. Win for $400 and
// respect. Start from the race marker (flag on the minimap) or
// through mission 10, which reuses the same machinery.

import { CFG } from './config.js';
import { lerpAngle, v3DistXZ } from './math3.js';
import { makeCar } from './vehicles.js';

export const RACE_GATES = [
  [0, 0, -128],
  [64, 0, -128],
  [96, 0, -64],
  [64, 0, 0],
  [0, 0, 0],
  [0, 0, -64],
];

const RIVAL_COLORS = [
  [0.9, 0.2, 0.5], [0.2, 0.9, 0.5], [0.5, 0.2, 0.9],
];

export function makeRaces(G) {
  let race = null;

  function startRace(isMission = false) {
    if (race) return false;
    if (!G.player.car) {
      G.hud.toast('Butuh mobil untuk balapan!');
      return false;
    }
    const start = G.city.raceStart;
    const rivals = [];
    for (let i = 0; i < 3; i += 1) {
      const car = makeCar(start[0] + (i - 1) * 4, start[2] + 8 + i * 0, 0, {
        color: RIVAL_COLORS[i], kind: 'sport', driver: 'racer',
      });
      car.raceGate = 0;
      car.raceSpeed = 30 + i * 2;
      G.cars.push(car);
      rivals.push(car);
    }
    // Line the player up at the start.
    G.player.car.pos = [start[0], 0, start[2]];
    G.player.car.angle = 0;
    G.player.car.speed = 0;
    G.player.pos = [start[0], 0, start[2]];
    race = {
      gates: RACE_GATES,
      rivals,
      playerGate: 0,
      countdown: 3.5,
      time: 0,
      position: 4,
      finished: false,
      isMission,
      startedAt: G.time,
    };
    G.hud.toast('BALAPAN DIMULAI — lewati semua gerbang!');
    G.audio.play('mission');
    return true;
  }

  function rivalProgress(car) {
    const gate = RACE_GATES[car.raceGate] || RACE_GATES[RACE_GATES.length - 1];
    const d = v3DistXZ(car.pos, gate);
    return car.raceGate * 1000 - d;
  }

  function playerProgress() {
    const gate = RACE_GATES[race.playerGate] || RACE_GATES[RACE_GATES.length - 1];
    const d = v3DistXZ(G.player.pos, gate);
    return race.playerGate * 1000 - d;
  }

  function updateRival(car, dt) {
    if (car.raceGate >= RACE_GATES.length) {
      car.speed += (0 - car.speed) * Math.min(1, dt * 2);
      return;
    }
    const gate = RACE_GATES[car.raceGate];
    const dx = gate[0] - car.pos[0];
    const dz = gate[2] - car.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < 10) {
      car.raceGate += 1;
      return;
    }
    const want = Math.atan2(-dx, -dz);
    car.angle = lerpAngle(car.angle, want, Math.min(1, dt * 2.5));
    car.speed += (car.raceSpeed - car.speed) * Math.min(1, dt * 1.2);
  }

  function finishRace(won) {
    race.finished = true;
    if (won) {
      G.player.cash += CFG.racePrize;
      G.progression.addRespect(80);
      G.audio.play('cash');
      G.hud.toast(`MENANG! +$${CFG.racePrize} dan +80 respect`);
      if (race.isMission) G.missions.onRaceWon();
    } else {
      G.hud.toast(`Kalah — finis posisi ${race.position}. Coba lagi!`);
      if (race.isMission) G.missions.failCurrent('Kalah balapan');
    }
    // Rivals cruise off and despawn.
    for (const r of race.rivals) {
      r.driver = 'none';
      r.remove = true;
    }
    setTimeout(() => { race = null; }, 2500);
  }

  return {
    get active() { return race; },
    startRace,
    update(dt) {
      if (!race) {
        // Race marker: press E near the start line to join a race.
        if (G.player.car && !G.inTitle && !G.paused && G.input.wasPressed('KeyE')) {
          const s = G.city.raceStart;
          if (v3DistXZ(G.player.pos, s) < 10) startRace(false);
        }
        return;
      }
      if (race.countdown > 0) {
        race.countdown -= dt;
        if (G.player.car) G.player.car.speed = 0;
        return;
      }
      race.time += dt;
      // Player gate progress.
      if (race.playerGate < RACE_GATES.length) {
        const gate = RACE_GATES[race.playerGate];
        if (v3DistXZ(G.player.pos, gate) < 10) {
          race.playerGate += 1;
          G.audio.play('pickup');
          G.hud.toast(`Gerbang ${race.playerGate}/${RACE_GATES.length}`);
        }
      }
      for (const r of race.rivals) updateRival(r, dt);
      // Live position: count rivals ahead of the player.
      const myProg = playerProgress();
      let pos = 1;
      for (const r of race.rivals) {
        if (rivalProgress(r) > myProg) pos += 1;
      }
      race.position = pos;
      // Finish: player through all gates, or a rival finishes first.
      const rivalDone = race.rivals.some((r) => r.raceGate >= RACE_GATES.length);
      if (race.playerGate >= RACE_GATES.length) {
        finishRace(pos === 1);
      } else if (rivalDone) {
        finishRace(false);
      }
    },
  };
}
