// Solmar Bay v4 — twelve story missions for Mara Vega.
//
// Missions are data: each one is a list of stages, and a stage is
// one verb — go somewhere, steal a car, drop a number of Kings,
// survive the heat, win a race. The runner tracks the current stage,
// spawns what it needs (enemies, timers, markers) and pays out cash
// + respect on completion. Later jobs need respect rank to start.

import { CFG } from './config.js';
import { v3DistXZ } from './math3.js';

export const MISSIONS = [
  {
    title: 'First Job',
    giver: 'Reyes',
    brief: 'Reyes needs a runner. Drive to the garage and check in.',
    startPos: [16, 0, 32],
    stages: [{ type: 'goto', pos: [16, 0, 32], text: 'Pergi ke bengkel Reyes' }],
  },
  {
    title: 'Wheels Up',
    giver: 'Reyes',
    brief: 'The crew needs wheels. Borrow a car and bring it to the pier.',
    startPos: [0, 0, 0],
    stages: [
      { type: 'enterCar', text: 'Curi sebuah mobil (F di dekat mobil)' },
      { type: 'goto', pos: [-140, 0, -96], text: 'Bawa mobil ke dermaga utara' },
    ],
  },
  {
    title: 'Message Sent',
    giver: 'Lena',
    brief: 'Coral Kings are leaning on our warehouse. Send a message.',
    startPos: [96, 0, 96],
    stages: [
      { type: 'goto', pos: [96, 0, 96], text: 'Pergi ke gudang pelabuhan' },
      { type: 'kill', count: 3, at: [96, 0, 96], text: 'Habisi 3 anggota Kings' },
    ],
    unlock: 2, // SMG
  },
  {
    title: 'Hot Wheels',
    giver: 'Mira',
    brief: 'Mira wants to see if you can actually drive. Three gates, 90 seconds.',
    startPos: [0, 0, -64],
    stages: [
      { type: 'timedGoto', pos: [64, 0, -64], time: 90, text: 'Lewati gerbang 1 (90 dtk)' },
      { type: 'goto', pos: [64, 0, 64], text: 'Lewati gerbang 2' },
      { type: 'goto', pos: [-64, 0, 64], text: 'Lewati gerbang 3' },
    ],
  },
  {
    title: 'Pier Pressure',
    giver: 'Dee',
    brief: 'Three packages washed up at the marina. Collect them before the Kings do.',
    startPos: [-150, 0, 64],
    stages: [
      { type: 'goto', pos: [-150, 0, 48], text: 'Ambil paket 1 di marina' },
      { type: 'goto', pos: [-150, 0, 80], text: 'Ambil paket 2 di marina' },
      { type: 'goto', pos: [-150, 0, 112], text: 'Ambil paket 3 di marina' },
    ],
  },
  {
    title: 'Heat Wave',
    giver: 'Vic',
    brief: 'Vic says the SBPD is cracking down. Survive 60 seconds at 2 stars.',
    startPos: [32, 0, -32],
    stages: [
      { type: 'survive', time: 60, stars: 2, text: 'Bertahan 60 dtk dengan wanted 2★' },
    ],
    unlock: 3, // Shotgun
  },
  {
    title: 'The Informant',
    giver: 'Lena',
    brief: 'Our informant is pinned downtown. Get him out and bring him to the garage.',
    startPos: [32, 0, -32],
    stages: [
      { type: 'goto', pos: [32, 0, -32], text: 'Temui informan di downtown' },
      { type: 'goto', pos: [16, 0, 32], text: 'Bawa informan ke bengkel (ikuti kamu)' },
    ],
  },
  {
    title: 'Turf Talk',
    giver: 'Rico',
    brief: 'Downtown is ours. Remind the Kings — four of them, permanently.',
    startPos: [64, 0, -64],
    stages: [
      { type: 'kill', count: 4, at: [64, 0, -64], text: 'Habisi 4 anggota Kings di downtown' },
    ],
    turf: { district: 'Downtown', amount: 20 },
  },
  {
    title: 'Harbor Heist',
    giver: 'Lena',
    brief: 'The big one: steal the getaway car, crack the vault in 90 seconds, survive 5 stars.',
    startPos: [96, 0, 128],
    stages: [
      { type: 'enterCar', text: 'Curi mobil kabur (sport car di pelabuhan)' },
      { type: 'timedGoto', pos: [96, 0, 128], time: 90, text: 'Ke brankas pelabuhan (90 dtk)' },
      { type: 'survive', time: 60, stars: 5, text: 'Kabur! Bertahan 60 dtk dengan wanted 5★' },
    ],
    unlock: 4, // Rifle
  },
  {
    title: 'Strand Grand Prix',
    giver: 'Mira',
    brief: 'The street race that decides who owns the Strand. Win it.',
    startPos: [0, 0, -64],
    stages: [
      { type: 'race', text: 'Menangkan balapan jalanan' },
    ],
  },
  {
    title: 'Cordon Break',
    giver: 'Rico',
    brief: 'Rico is trapped inside a police cordon. Break through and get him to the safehouse.',
    startPos: [-64, 0, 96],
    stages: [
      { type: 'goto', pos: [-64, 0, 96], text: 'Tembus kordon polisi' },
      { type: 'goto', pos: [16, 0, 32], text: 'Bawa Rico ke safehouse (bengkel)' },
    ],
  },
  {
    title: 'Turf War',
    giver: 'Lena',
    brief: 'The finale: take Downtown back, then hold it against everything the Kings send.',
    startPos: [0, 0, 0],
    stages: [
      { type: 'kill', count: 6, at: [0, 0, 0], text: 'Habisi 6 anggota Kings di downtown' },
      { type: 'survive', time: 45, stars: 3, text: 'Pertahankan downtown 45 dtk' },
    ],
    turf: { district: 'Downtown', amount: 40 },
  },
];

export function makeMissions(G) {
  let current = null; // { idx, stageIdx, timer, killsNeeded, kills, enemies }
  const completed = new Set();

  function stage() {
    if (!current) return null;
    return MISSIONS[current.idx].stages[current.stageIdx];
  }

  function spawnEnemies(at, count) {
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const a = G.rng.range(0, Math.PI * 2);
      const d = G.rng.range(6, 16);
      const e = {
        pos: [at[0] + Math.cos(a) * d, 0, at[2] + Math.sin(a) * d],
        angle: 0,
        walkPhase: 0,
        shirt: [0.9, 0.15, 0.2],
        pants: [0.15, 0.15, 0.2],
        health: 50,
        dead: false,
        enemy: true,
        shootTimer: G.rng.range(0.5, 2),
        speed: 0,
      };
      G.enemies.push(e);
      list.push(e);
    }
    return list;
  }

  function beginStage() {
    const st = stage();
    if (!st) return;
    if (st.type === 'kill') {
      current.enemies = spawnEnemies(st.at, st.count);
      current.killsNeeded = st.count;
      current.kills = 0;
    } else if (st.type === 'survive') {
      current.timer = st.time;
      if (G.police.wanted < st.stars) G.police.setWanted(st.stars);
    } else if (st.type === 'timedGoto') {
      current.timer = st.time;
    } else if (st.type === 'race') {
      if (!G.player.car) {
        G.hud.toast('Misi balapan butuh mobil — cari mobil dulu!');
        failCurrent('Tidak ada mobil untuk balapan');
        return;
      }
      G.races.startRace(true);
    }
    G.hud.toast(st.text);
    G.hud.setObjective(st.text);
  }

  function advanceStage() {
    current.stageIdx += 1;
    const mission = MISSIONS[current.idx];
    if (current.stageIdx >= mission.stages.length) {
      completeMission();
    } else {
      beginStage();
    }
  }

  function completeMission() {
    const mission = MISSIONS[current.idx];
    const cash = CFG.missionCash[current.idx];
    const respect = CFG.respectPerMission;
    completed.add(current.idx);
    G.player.cash += cash;
    G.progression.addRespect(respect);
    if (mission.turf) G.progression.addTurf(mission.turf.district, mission.turf.amount);
    if (mission.unlock !== undefined) {
      if (G.weapons.unlock(mission.unlock)) {
        G.hud.toast(`Senjata baru dibuka: ${G.weapons.currentWeapon.name}`);
      }
    }
    G.audio.play('cash');
    G.hud.toast(`MISI SELESAI: ${mission.title} — +$${cash}, +${respect} respect`);
    G.hud.setObjective('Misi selesai! Cari misi berikutnya (tanda ! di minimap)');
    current = null;
    G.saveGame();
  }

  function failCurrent(reason) {
    if (!current) return;
    G.hud.toast(`MISI GAGAL: ${reason}`);
    G.hud.setObjective('Misi gagal — coba lagi dari marker misi');
    // Clean up spawned enemies.
    for (const e of G.enemies) e.remove = true;
    current = null;
  }

  return {
    list: MISSIONS,
    completed,
    get current() { return current; },
    get currentStage() { return stage(); },
    get nextAvailable() {
      for (let i = 0; i < MISSIONS.length; i += 1) {
        if (!completed.has(i) && G.progression.canStart(i)) return i;
      }
      return -1;
    },
    start(idx) {
      if (current) {
        G.hud.toast('Selesaikan misi yang sedang berjalan dulu');
        return false;
      }
      if (completed.has(idx)) {
        G.hud.toast('Misi ini sudah selesai');
        return false;
      }
      if (!G.progression.canStart(idx)) {
        G.hud.toast(`Butuh rank ${G.progression.requiredRank(idx)} untuk misi ini`);
        G.audio.play('denied');
        return false;
      }
      const m = MISSIONS[idx];
      current = { idx, stageIdx: 0, timer: 0, killsNeeded: 0, kills: 0, enemies: [] };
      G.audio.play('mission');
      G.hud.toast(`MISI: ${m.title} — ${m.brief}`);
      G.hud.setObjective(m.brief);
      beginStage();
      return true;
    },
    onEnemyKilled() {
      if (!current) return;
      const st = stage();
      if (st && st.type === 'kill') {
        current.kills += 1;
        G.hud.toast(`Kings tumbang ${current.kills}/${current.killsNeeded}`);
        if (current.kills >= current.killsNeeded) advanceStage();
      }
    },
    onRaceWon() {
      if (!current) return;
      const st = stage();
      if (st && st.type === 'race') advanceStage();
    },
    failCurrent,
    update(dt) {
      // Enemy AI: hunt the player, shoot from range.
      for (const e of G.enemies) {
        if (e.dead || e.remove) continue;
        const dx = G.player.pos[0] - e.pos[0];
        const dz = G.player.pos[2] - e.pos[2];
        const d = Math.hypot(dx, dz);
        e.angle = Math.atan2(-dx / (d || 1), -dz / (d || 1));
        e.shootTimer -= dt;
        if (d > 18) {
          e.pos[0] += (dx / (d || 1)) * 6 * dt;
          e.pos[2] += (dz / (d || 1)) * 6 * dt;
          e.walkPhase += dt * 9;
        } else if (e.shootTimer <= 0) {
          e.shootTimer = 1.6;
          G.combat.damagePlayer(5);
          G.particles.spawn('tracer', [e.pos[0], 1.3, e.pos[2]], { to: [G.player.pos[0], 1.2, G.player.pos[2]] });
          G.audio.play('shot');
        }
      }
      for (let i = G.enemies.length - 1; i >= 0; i -= 1) {
        if (G.enemies[i].remove) G.enemies.splice(i, 1);
      }
      if (!current) return;
      const st = stage();
      if (!st) return;
      const p = G.player.pos;
      if (st.type === 'goto' || st.type === 'collect') {
        if (v3DistXZ(p, st.pos) < 8) advanceStage();
      } else if (st.type === 'enterCar') {
        if (G.player.car) advanceStage();
      } else if (st.type === 'timedGoto') {
        current.timer -= dt;
        if (v3DistXZ(p, st.pos) < 8) {
          advanceStage();
        } else if (current.timer <= 0) {
          failCurrent('Waktu habis');
        }
      } else if (st.type === 'survive') {
        current.timer -= dt;
        if (current.timer <= 0) {
          G.police.setWanted(0);
          advanceStage();
        }
      }
      // Mission start: E near the next mission's marker.
      // (Handled in main.js via nearestMissionMarker.)
    },
    nearestStartMarker() {
      const idx = this.nextAvailable;
      if (idx < 0) return null;
      const m = MISSIONS[idx];
      if (v3DistXZ(G.player.pos, m.startPos) < 8) return idx;
      return null;
    },
  };
}
