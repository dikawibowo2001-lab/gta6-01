// Solmar Bay v4 — respect ranks and district turf.
//
// Respect is the career ladder: missions, races and good deeds earn
// it, and each rank unlocks more of the story. Turf is per-district
// standing (0–100) — the Harbor Crew's grip on each neighbourhood.
// Both show up in the pause screen.

import { CFG, RANKS } from './config.js';

export function makeProgression(G) {
  const turf = { Harbor: 30, Downtown: 20, Beachfront: 40 };

  function rankIndex() {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i += 1) {
      if (G.player.respect >= RANKS[i].need) idx = i;
    }
    return idx;
  }

  return {
    turf,
    get respect() { return G.player.respect; },
    get rank() { return RANKS[rankIndex()].name; },
    get rankIndex() { return rankIndex(); },
    get nextRank() {
      const next = RANKS[rankIndex() + 1];
      return next || null;
    },
    addRespect(n) {
      const before = rankIndex();
      G.player.respect = Math.max(0, G.player.respect + n);
      const after = rankIndex();
      if (n > 0) G.hud.toast(`+${n} RESPECT`);
      if (after > before) {
        G.hud.toast(`RANK UP — kamu sekarang ${RANKS[after].name}!`);
        G.audio.play('mission');
      }
    },
    addTurf(district, n) {
      if (turf[district] === undefined) return;
      turf[district] = Math.max(0, Math.min(100, turf[district] + n));
    },
    // Missions 1–4 are open; later jobs need rank.
    canStart(missionIdx) {
      if (missionIdx < 4) return true;
      if (missionIdx < 8) return rankIndex() >= 1;
      if (missionIdx < 10) return rankIndex() >= 2;
      return rankIndex() >= 3;
    },
    requiredRank(missionIdx) {
      if (missionIdx < 4) return RANKS[0].name;
      if (missionIdx < 8) return RANKS[1].name;
      if (missionIdx < 10) return RANKS[2].name;
      return RANKS[3].name;
    },
  };
}
