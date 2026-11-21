// Solmar Bay v4 — crew abilities.
//
// Mara's Harbor Crew has her back, three ways: RICO (backup driver)
// rams the nearest cop car for 20 seconds, LENA (decoy) sends the
// pursuit chasing a flare across town for 10 seconds, and GHOST
// (getaway) wipes one wanted star. Each has its own cooldown; keys
// 6/7/8 or the HUD buttons trigger them.

import { v3DistXZ } from './math3.js';
import { makeCar } from './vehicles.js';

const ABILITIES = [
  { id: 'backup', name: 'RICO — Backup', key: '6', cooldown: 60, blurb: 'Rico joins the chase and rams cops for 20s.' },
  { id: 'decoy', name: 'LENA — Decoy', key: '7', cooldown: 45, blurb: 'A flare pulls the pursuit away for 10s.' },
  { id: 'getaway', name: 'GHOST — Getaway', key: '8', cooldown: 90, blurb: 'Wipes one wanted star. Vanish.' },
];

export function makeCrew(G) {
  const cooldowns = [0, 0, 0];
  let ally = null;
  let allyTimer = 0;
  let decoy = null; // { pos, until }

  function use(idx) {
    if (cooldowns[idx] > 0) {
      G.hud.toast(`${ABILITIES[idx].name} — cooldown ${Math.ceil(cooldowns[idx])} dtk lagi`);
      G.audio.play('denied');
      return false;
    }
    const ab = ABILITIES[idx];
    if (ab.id === 'backup') {
      const p = G.player.pos;
      ally = makeCar(p[0] + 8, p[2] + 8, 0, {
        color: [0.2, 0.8, 0.3], kind: 'sport', driver: 'ally',
      });
      G.cars.push(ally);
      allyTimer = 20;
      G.hud.toast('RICO DATANG! Backup 20 detik');
    } else if (ab.id === 'decoy') {
      const p = G.player.pos;
      const a = G.rng.range(0, Math.PI * 2);
      decoy = { pos: [p[0] + Math.cos(a) * 70, 0, p[2] + Math.sin(a) * 70], until: G.time + 10 };
      G.hud.toast('LENA MELEMPAR FLARE — polisi dialihkan!');
    } else if (ab.id === 'getaway') {
      if (G.police.wanted === 0) {
        G.hud.toast('Nggak ada wanted star untuk dihapus');
        return false;
      }
      G.police.addWanted(-1);
      G.hud.toast('GHOST MENGHILANGKAN JEJAK — 1 bintang hilang');
    }
    cooldowns[idx] = ab.cooldown;
    G.audio.play('mission');
    return true;
  }

  return {
    abilities: ABILITIES,
    cooldowns,
    get decoyPos() {
      return decoy && G.time < decoy.until ? decoy.pos : null;
    },
    use,
    update(dt) {
      for (let i = 0; i < cooldowns.length; i += 1) {
        cooldowns[i] = Math.max(0, cooldowns[i] - dt);
      }
      const input = G.input;
      if (!G.inTitle && !G.paused) {
        if (input.wasPressed('Digit6')) use(0);
        if (input.wasPressed('Digit7')) use(1);
        if (input.wasPressed('Digit8')) use(2);
      }
      // Ally AI: hunt the nearest cop car and ram it.
      if (ally) {
        allyTimer -= dt;
        const cops = G.cars.filter((c) => c.kind === 'cop' && !c.dead);
        if (allyTimer <= 0 || ally.dead || cops.length === 0) {
          if (!ally.dead) {
            ally.driver = 'none';
            ally.speed = 0;
          }
          ally = null;
        } else {
          let target = null;
          let best = Infinity;
          for (const c of cops) {
            const d = v3DistXZ(ally.pos, c.pos);
            if (d < best) { best = d; target = c; }
          }
          if (target) {
            const dx = target.pos[0] - ally.pos[0];
            const dz = target.pos[2] - ally.pos[2];
            const want = Math.atan2(-dx, -dz);
            let diff = want - ally.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            ally.angle += Math.max(-2.5 * dt, Math.min(2.5 * dt, diff));
            ally.speed += (44 - ally.speed) * Math.min(1, dt * 1.5);
            if (best < 3.5) {
              G.vehicles.damageCar(target, 12 * dt);
              ally.speed *= 0.92;
            }
          }
        }
      }
      if (decoy && G.time >= decoy.until) decoy = null;
    },
  };
}
