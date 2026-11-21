// Progression: respect ranks and district standing. Respect XP comes
// from jobs (+400 each), race wins (+300), turf war (+500) and NPC
// tips (+25); five ranks run from NOBODY to STREET BOSS, and the
// later jobs require a rank to start. Each of the three turf districts
// (Harbor, Downtown, Beachfront) has a standing meter from 0 to 100:
// the crew's grip on that turf. Standing rises when Mara wins fights
// there and falls when she loses heat there; the turf-war finale
// (job 12) needs Downtown at 80+. The pause screen shows it all.

import { RESPECT_RANKS, TURF_DISTRICTS, turfAt } from './config.js';
import { clamp } from './math3.js';

export class Progression {
  constructor() {
    this.xp = 0;
    this.turf = { harbor: 50, downtown: 50, beachfront: 50 };
    this.lastGain = null; // {text, t} — a small toast the HUD shows
  }

  rankIndex() {
    let idx = 0;
    for (let i = 0; i < RESPECT_RANKS.length; i++) {
      if (this.xp >= RESPECT_RANKS[i].xp) idx = i;
    }
    return idx;
  }

  rank() {
    return RESPECT_RANKS[this.rankIndex()];
  }

  nextRank() {
    const idx = this.rankIndex();
    return idx + 1 < RESPECT_RANKS.length ? RESPECT_RANKS[idx + 1] : null;
  }

  // Fraction of the way to the next rank (for the progress bar).
  rankFrac() {
    const idx = this.rankIndex();
    const cur = RESPECT_RANKS[idx];
    const next = RESPECT_RANKS[idx + 1];
    if (!next) return 1;
    return clamp((this.xp - cur.xp) / (next.xp - cur.xp), 0, 1);
  }

  addXp(amount, reason) {
    const before = this.rankIndex();
    this.xp += amount;
    const after = this.rankIndex();
    if (after > before) {
      this.lastGain = { text: `RESPECT UP — ${RESPECT_RANKS[after].name}`, t: 4 };
    } else if (reason) {
      this.lastGain = { text: `+${amount} RESPECT — ${reason}`, t: 2.5 };
    }
    return after > before;
  }

  // Standing in the district Mara is standing in right now.
  addTurf(x, z, amount) {
    const id = turfAt(x, z);
    if (!id) return null;
    this.turf[id] = clamp(this.turf[id] + amount, 0, 100);
    return id;
  }

  turfList() {
    return TURF_DISTRICTS.map((d) => ({
      id: d.id,
      name: d.name,
      value: Math.round(this.turf[d.id] || 50),
    }));
  }

  update(dt) {
    if (this.lastGain) {
      this.lastGain.t -= dt;
      if (this.lastGain.t <= 0) this.lastGain = null;
    }
  }

  serialize() {
    return { xp: this.xp, turf: { ...this.turf } };
  }

  deserialize(s) {
    if (!s) return;
    if (typeof s.xp === 'number') this.xp = s.xp;
    if (s.turf) {
      for (const k of Object.keys(this.turf)) {
        if (typeof s.turf[k] === 'number') this.turf[k] = s.turf[k];
      }
    }
  }
}
