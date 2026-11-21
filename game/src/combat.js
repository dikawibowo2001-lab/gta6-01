// Solmar Bay v4 — combat: shooting, damage, death, pickups.
//
// Shooting is hitscan from the player's facing direction: the
// nearest living target inside the weapon's cone takes damage, a
// tracer streaks to the impact point, and the shot echoes (nearby
// pedestrians flee, nearby cops take notice). Health packs and armor
// vests sit at fixed spots around the city and respawn.

import { CFG } from './config.js';
import { v3DistXZ } from './math3.js';

const PICKUP_SPOTS = [
  { kind: 'health', pos: [-140, 0, -96] },
  { kind: 'health', pos: [8, 0, -8] },
  { kind: 'health', pos: [96, 0, 96] },
  { kind: 'armor', pos: [-64, 0, 64] },
  { kind: 'armor', pos: [64, 0, -96] },
  { kind: 'health', pos: [24, 0, 32] },
];

export function makeCombat(G) {
  const pickups = PICKUP_SPOTS.map((p) => ({ ...p, taken: false, timer: 0 }));
  let fireCooldown = 0;
  let lastShotAt = -100;

  function aimDir() {
    const p = G.player;
    const a = p.car ? p.car.angle : p.angle;
    return [-Math.sin(a), -Math.cos(a)];
  }

  function coneTargets(origin, dir, range, halfAngle) {
    const hits = [];
    const consider = (obj, kind) => {
      const dx = obj.pos[0] - origin[0];
      const dz = obj.pos[2] - origin[2];
      const d = Math.hypot(dx, dz);
      if (d > range || d < 0.5) return;
      const dot = (dx * dir[0] + dz * dir[1]) / d;
      if (dot < Math.cos(halfAngle)) return;
      hits.push({ obj, kind, dist: d });
    };
    for (const ped of G.peds) if (!ped.dead) consider(ped, 'ped');
    for (const cop of G.police.footCops) if (!cop.dead) consider(cop, 'cop');
    for (const enemy of G.enemies) if (!enemy.dead) consider(enemy, 'enemy');
    for (const car of G.cars) {
      if (car.dead || car === G.player.car) continue;
      consider(car, 'car');
    }
    hits.sort((a, b) => a.dist - b.dist);
    return hits;
  }

  function shoot() {
    const w = G.weapons;
    const weapon = w.currentWeapon;
    if (fireCooldown > 0) return;
    fireCooldown = 1 / weapon.rate;
    if (!w.spendAmmo(1)) return;
    const p = G.player;
    const origin = [p.pos[0], 1.4, p.pos[2]];
    const dir = aimDir();
    lastShotAt = G.time;
    if (weapon.id === 'fists') {
      G.audio.play('click');
      const hits = coneTargets(origin, dir, weapon.range, 0.7);
      if (hits.length) {
        const h = hits[0];
        if (h.kind === 'ped') killPed(h.obj);
        if (h.kind === 'cop') damageCop(h.obj, weapon.damage);
        if (h.kind === 'enemy') damageEnemy(h.obj, weapon.damage);
        if (h.kind === 'car') G.vehicles.damageCar(h.obj, weapon.damage);
      }
      return;
    }
    G.audio.play(weapon.id === 'shotgun' ? 'shotgun' : 'shot');
    G.particles.spawn('muzzle', [origin[0] + dir[0] * 1.5, 1.3, origin[2] + dir[1] * 1.5]);
    for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
      const spread = (G.rng.next() - 0.5) * 2 * weapon.spread;
      const dx = dir[0] + Math.cos(Math.atan2(dir[1], dir[0])) * spread;
      const dz = dir[1] - Math.sin(Math.atan2(dir[1], dir[0])) * spread;
      const len = Math.hypot(dx, dz) || 1;
      const pdir = [dx / len, dz / len];
      const hits = coneTargets(origin, pdir, weapon.range, 0.05);
      const end = hits.length
        ? [hits[0].obj.pos[0], 1.0, hits[0].obj.pos[2]]
        : [origin[0] + pdir[0] * weapon.range, 1.0, origin[2] + pdir[1] * weapon.range];
      G.particles.spawn('tracer', origin, { to: end });
      if (hits.length) {
        const h = hits[0];
        G.particles.spawn('impact', [h.obj.pos[0], 1.0, h.obj.pos[2]]);
        if (h.kind === 'ped') killPed(h.obj);
        if (h.kind === 'cop') damageCop(h.obj, weapon.damage);
        if (h.kind === 'enemy') damageEnemy(h.obj, weapon.damage);
        if (h.kind === 'car') G.vehicles.damageCar(h.obj, weapon.damage);
      }
    }
    // Gunfire draws attention.
    if (G.police.wanted === 0 && G.police.nearestCopDist() < 60) {
      G.police.addWanted(1);
    }
  }

  function killPed(ped) {
    if (ped.dead) return;
    ped.dead = true;
    ped.speed = 0;
    G.particles.spawn('impact', [ped.pos[0], 1.0, ped.pos[2]]);
    if (G.police.wanted < 2) G.police.addWanted(1);
    G.progression.addRespect(-10);
  }

  function damageEnemy(enemy, amount) {
    enemy.health -= amount;
    if (enemy.health <= 0 && !enemy.dead) {
      enemy.dead = true;
      G.player.cash += 25;
      G.progression.addRespect(10);
      G.missions.onEnemyKilled();
    }
  }

  function damageCop(cop, amount) {
    cop.health -= amount;
    if (cop.health <= 0 && !cop.dead) {
      cop.dead = true;
      G.police.addWanted(2);
      G.progression.addRespect(15);
      G.player.cash += 50;
      G.hud.toast('Polisi tumbang — +$50, wanted naik');
    }
  }

  function damagePlayer(amount) {
    const p = G.player;
    if (p.dead) return;
    let rest = amount;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, rest);
      p.armor -= absorbed;
      rest -= absorbed;
    }
    p.health -= rest;
    if (p.health <= 0) {
      p.health = 0;
      p.dead = true;
      G.audio.play('explosion');
      G.hud.toast('Mara tumbang! Bangun di rumah sakit — kehilangan $100');
      setTimeout(() => respawnPlayer(), 1500);
    }
  }

  function respawnPlayer() {
    const p = G.player;
    p.dead = false;
    p.health = CFG.playerHealth;
    p.armor = 0;
    p.cash = Math.max(0, p.cash - 100);
    p.pos = [32, 0, -64];
    p.angle = 0;
    if (p.car) {
      p.car.driver = 'none';
      p.car = null;
    }
    p.onFoot = true;
    G.police.setWanted(0);
    G.missions.failCurrent('Mara tumbang');
  }

  return {
    pickups,
    get lastShotAt() { return lastShotAt; },
    shoot,
    killPed,
    damageCop,
    damageEnemy,
    damagePlayer,
    update(dt) {
      fireCooldown = Math.max(0, fireCooldown - dt);
      const input = G.input;
      if (!G.inTitle && !G.paused && !G.garage.open && !G.weapons.wheelOpen) {
        if (input.mousePressed || input.mouse.down || input.wasPressed('KeyJ')) shoot();
      }
      // Pickups: walk over one to collect it.
      for (const pk of pickups) {
        if (pk.taken) {
          pk.timer -= dt;
          if (pk.timer <= 0) pk.taken = false;
          continue;
        }
        if (v3DistXZ(G.player.pos, pk.pos) < 2) {
          pk.taken = true;
          pk.timer = 45;
          if (pk.kind === 'health') {
            G.player.health = Math.min(CFG.playerHealth, G.player.health + 40);
            G.hud.toast('+40 HEALTH');
          } else {
            G.player.armor = Math.min(CFG.playerArmorMax, G.player.armor + 50);
            G.hud.toast('+50 ARMOR');
          }
          G.audio.play('pickup');
        }
      }
    },
  };
}
