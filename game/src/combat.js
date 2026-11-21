// Combat: Mara's fists and four guns — pistol, SMG, shotgun, rifle —
// each with its own damage, fire rate, spread and tracer colour. The
// shotgun fires six pellets per trigger pull. Shooting is a hitscan
// ray from Mara toward the mouse aim point: the renderer turns the
// screen-space crosshair into a world direction, and this module finds
// the first walker or car each ray crosses. The weapon wheel
// (weapons.js) owns selection; this module owns the shooting.

import { dist2D, clamp } from './math3.js';

export const WEAPONS = {
  fists: { name: 'FISTS', damage: 12, range: 3.2, rate: 0.45, mag: Infinity, auto: false, spread: 0, pellets: 1, tracer: [1, 0.9, 0.5], flash: 0.3 },
  pistol: { name: 'PISTOL', damage: 34, range: 60, rate: 0.28, mag: 12, auto: false, spread: 0.012, pellets: 1, tracer: [1, 0.9, 0.5], flash: 0.5 },
  smg: { name: 'SMG', damage: 20, range: 48, rate: 0.09, mag: 30, auto: true, spread: 0.035, pellets: 1, tracer: [1, 0.75, 0.3], flash: 0.45 },
  shotgun: { name: 'SHOTGUN', damage: 14, range: 26, rate: 0.8, mag: 6, auto: false, spread: 0.09, pellets: 6, tracer: [1, 0.6, 0.25], flash: 0.9 },
  rifle: { name: 'RIFLE', damage: 55, range: 90, rate: 0.5, mag: 20, auto: false, spread: 0.006, pellets: 1, tracer: [0.6, 0.9, 1], flash: 0.6 },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];
export const GUN_ORDER = ['pistol', 'smg', 'shotgun', 'rifle'];

export class Combat {
  constructor() {
    this.current = 'pistol';
    this.ammo = { pistol: 12, smg: 30, shotgun: 6, rifle: 20 };
    this.reserve = { pistol: 96, smg: 150, shotgun: 36, rifle: 80 };
    this.cooldown = 0;
    this.reloading = 0;
    this.reloadTotal = 0;
    this.muzzleFlash = 0;
    this.lastShotFrom = null;
    this.lastShotTo = null;
  }

  get weapon() {
    return WEAPONS[this.current];
  }

  get ammoText() {
    if (this.current === 'fists') return '—';
    if (this.reloading > 0) return 'RELOAD';
    return `${this.ammo[this.current]} / ${this.reserve[this.current]}`;
  }

  select(name) {
    if (WEAPONS[name]) {
      this.current = name;
      this.reloading = 0;
    }
  }

  cycle() {
    const i = WEAPON_ORDER.indexOf(this.current);
    this.select(WEAPON_ORDER[(i + 1) % WEAPON_ORDER.length]);
  }

  startReload() {
    const w = this.weapon;
    if (this.current === 'fists' || this.reloading > 0) return;
    if (this.ammo[this.current] >= w.mag || this.reserve[this.current] <= 0) return;
    this.reloading = 1.1;
    this.reloadTotal = 1.1;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const w = this.weapon;
        const need = w.mag - this.ammo[this.current];
        const take = Math.min(need, this.reserve[this.current]);
        this.ammo[this.current] += take;
        this.reserve[this.current] -= take;
      }
    }
  }

  get canFire() {
    return this.cooldown <= 0 && this.reloading <= 0;
  }

  // Fire from (ox, oz) along a heading. Returns a report with one
  // entry per pellet: {hits: [{hit, hitX, hitZ, damage}], ...}. The
  // world turns each entry into damage, particles and sound.
  fire(ox, oz, heading, targets) {
    const w = this.weapon;
    if (!this.canFire) return null;
    if (this.current !== 'fists') {
      if (this.ammo[this.current] <= 0) {
        this.startReload();
        return { dry: true };
      }
      this.ammo[this.current]--;
    }
    this.cooldown = w.rate;
    this.muzzleFlash = 0.07;
    const hits = [];
    for (let p = 0; p < w.pellets; p++) {
      const spread = (Math.random() - 0.5) * 2 * w.spread;
      const a = heading + spread;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      const endX = ox + dx * w.range;
      const endZ = oz + dz * w.range;
      let best = null;
      let bestT = Infinity;
      for (const t of targets) {
        // Ray-circle intersection in the XZ plane.
        const rx = t.x - ox;
        const rz = t.z - oz;
        const proj = rx * dx + rz * dz;
        if (proj < 0 || proj > w.range) continue;
        const px = ox + dx * proj;
        const pz = oz + dz * proj;
        const off = dist2D(px, pz, t.x, t.z);
        if (off < (t.radius || 1.2) && proj < bestT) {
          bestT = proj;
          best = { ...t, hitX: px, hitZ: pz };
        }
      }
      const hitX = best ? best.hitX : endX;
      const hitZ = best ? best.hitZ : endZ;
      hits.push({ hit: best, hitX, hitZ, damage: w.damage });
    }
    this.lastShotFrom = [ox, oz];
    this.lastShotTo = [hits[0].hitX, hits[0].hitZ];
    return { hits, weapon: this.current };
  }

  // An NPC (cop or rival) shoots at Mara: simpler — a timed shot with a
  // miss chance, no ray needed.
  npcShot(shooter, target, world) {
    const d = dist2D(shooter.x, shooter.z, target.x, target.z);
    if (d > 45) return;
    const hitChance = clamp(0.62 - d * 0.008, 0.18, 0.62);
    world.particles.muzzle(shooter.x, shooter.z, shooter.heading);
    world.audio.shot(false);
    if (Math.random() < hitChance) {
      target.damage(8);
      world.particles.blood(target.x, target.z);
      if (target.isPlayer) world.onPlayerHit();
    }
  }

  // A punch: short range, no ammo, small knockback on peds.
  punch(ox, oz, heading, targets) {
    const w = WEAPONS.fists;
    if (!this.canFire) return null;
    this.cooldown = w.rate;
    this.muzzleFlash = 0;
    const endX = ox + Math.sin(heading) * w.range;
    const endZ = oz + Math.cos(heading) * w.range;
    for (const t of targets) {
      if (dist2D(endX, endZ, t.x, t.z) < (t.radius || 1.2) + 0.8) {
        return { hits: [{ hit: t, hitX: t.x, hitZ: t.z, damage: w.damage }], weapon: 'fists' };
      }
    }
    return { hits: [{ hit: null, hitX: endX, hitZ: endZ, damage: 0 }], weapon: 'fists' };
  }
}
