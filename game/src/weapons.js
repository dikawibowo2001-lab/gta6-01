// Solmar Bay v4 — the arsenal.
//
// Five weapons on a radial wheel (hold Q or Tab, keys 1–5). Each
// entry holds its own damage, fire rate, range, spread and pellet
// count; combat.js reads this table and never hard-codes a weapon.

export const WEAPONS = [
  {
    id: 'fists', name: 'Fists', damage: 12, rate: 2.5,
    range: 2.6, spread: 0, pellets: 1, auto: false, maxAmmo: Infinity,
    icon: '✊', blurb: 'Knuckles. Quiet, free, personal.',
  },
  {
    id: 'pistol', name: 'P-9 Pistol', damage: 26, rate: 4,
    range: 60, spread: 0.012, pellets: 1, auto: false, maxAmmo: 120,
    icon: '🔫', blurb: 'Reliable sidearm. One tap, one problem solved.',
  },
  {
    id: 'smg', name: 'K-9 SMG', damage: 14, rate: 9,
    range: 45, spread: 0.05, pellets: 1, auto: true, maxAmmo: 240,
    icon: '🔫', blurb: 'Sprays lead. Burns ammo like it hates money.',
  },
  {
    id: 'shotgun', name: 'M870 Breacher', damage: 10, rate: 1.2,
    range: 26, spread: 0.09, pellets: 6, auto: false, maxAmmo: 40,
    icon: '💥', blurb: 'Six pellets of bad news at close range.',
  },
  {
    id: 'rifle', name: 'AR-77 Rifle', damage: 48, rate: 2.5,
    range: 130, spread: 0.006, pellets: 1, auto: false, maxAmmo: 90,
    icon: '🎯', blurb: 'Long reach, heavy punch. One shot, one drop.',
  },
];

export function makeWeapons(G) {
  const ammo = WEAPONS.map((w) => w.maxAmmo);
  // Start with a half-full pistol; the rest unlock through missions.
  ammo[1] = 60;
  ammo[2] = 0;
  ammo[3] = 0;
  ammo[4] = 0;
  const unlocked = [true, true, false, false, false];

  return {
    current: 0,
    wheelOpen: false,
    ammo,
    unlocked,
    get currentWeapon() { return WEAPONS[this.current]; },
    get currentAmmo() { return ammo[this.current]; },
    unlock(idx) {
      if (!unlocked[idx]) {
        unlocked[idx] = true;
        ammo[idx] = WEAPONS[idx].maxAmmo;
        return true;
      }
      return false;
    },
    select(idx) {
      if (idx < 0 || idx >= WEAPONS.length) return false;
      if (!unlocked[idx]) {
        G.hud.toast(`${WEAPONS[idx].name} belum dibuka — selesaikan misi untuk membukanya`);
        G.audio.play('denied');
        return false;
      }
      this.current = idx;
      G.audio.play('click');
      return true;
    },
    spendAmmo(n = 1) {
      const w = WEAPONS[this.current];
      if (!Number.isFinite(ammo[this.current])) return true;
      if (ammo[this.current] <= 0) {
        G.audio.play('denied');
        return false;
      }
      ammo[this.current] = Math.max(0, ammo[this.current] - n);
      return true;
    },
    addAmmo(idx, n) {
      if (!Number.isFinite(ammo[idx])) return;
      ammo[idx] = Math.min(WEAPONS[idx].maxAmmo, ammo[idx] + n);
    },
  };
}
