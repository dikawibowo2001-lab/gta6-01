// Reyes' garage: the upgrade shop. Drive to the green beacon at the
// garage on Harbor Row, press G, and spend mission cash on engine
// levels (top speed), armour (max condition), nitro (hold Shift for a
// boost) and paint jobs. Upgrades belong to Mara, not to the car —
// the world applies them to whatever she steals next — and they
// persist in the save. The HUD renders the shop as a full-screen
// panel; this module owns the catalogue state and the purchases.

import { GARAGE } from './config.js';

export class Garage {
  constructor() {
    this.open = false;
    // The saved upgrade state. engine/armor are levels 0–3, nitro is a
    // boolean, paint is an [r, g, b] colour or null.
    this.upgrades = { engine: 0, armor: 0, nitro: false, paint: null };
    this.message = '';
    this.messageT = 0;
  }

  // The shop rows the HUD renders: id, label, description, price,
  // owned/disabled state and the next level (for leveled items).
  rows() {
    const u = this.upgrades;
    const rows = [];
    const eng = GARAGE.engine[u.engine];
    rows.push({
      id: 'engine',
      label: eng ? `ENGINE — ${eng.name}` : 'ENGINE — MAXED',
      desc: eng ? `Top speed +${Math.round(eng.topBonus * 100)}% (level ${u.engine + 1}/3)` : 'Twin-turbo V8 installed. The SBPD eats your dust.',
      price: eng ? eng.price : 0,
      disabled: !eng,
      level: u.engine,
      maxLevel: 3,
    });
    const arm = GARAGE.armor[u.armor];
    rows.push({
      id: 'armor',
      label: arm ? `ARMOUR — ${arm.name}` : 'ARMOUR — MAXED',
      desc: arm ? `Max condition +${arm.hpBonus} (level ${u.armor + 1}/3)` : 'Full roll cage. Bring the roadblocks on.',
      price: arm ? arm.price : 0,
      disabled: !arm,
      level: u.armor,
      maxLevel: 3,
    });
    rows.push({
      id: 'nitro',
      label: u.nitro ? 'NITRO — INSTALLED' : 'NITRO BOOST',
      desc: u.nitro ? 'Hold Shift while accelerating for a 45% boost.' : 'Hold Shift while accelerating for a 45% boost.',
      price: u.nitro ? 0 : GARAGE.nitro.price,
      disabled: u.nitro,
      level: u.nitro ? 1 : 0,
      maxLevel: 1,
    });
    for (const paint of GARAGE.paints) {
      const owned = u.paint && u.paint[0] === paint.color[0] && u.paint[1] === paint.color[1] && u.paint[2] === paint.color[2];
      rows.push({
        id: `paint:${paint.name}`,
        label: `PAINT — ${paint.name.toUpperCase()}`,
        desc: owned ? 'Currently applied.' : 'Respray the car in this colour.',
        price: owned ? 0 : paint.price,
        disabled: !!owned,
        level: owned ? 1 : 0,
        maxLevel: 1,
        color: paint.color,
      });
    }
    return rows;
  }

  // Buy a row by id. Returns true on success; the world passes cash
  // in and out so the module stays pure.
  buy(id, world) {
    const u = this.upgrades;
    const fail = (msg) => {
      this.message = msg;
      this.messageT = 2.5;
      return false;
    };
    if (id === 'engine') {
      const next = GARAGE.engine[u.engine];
      if (!next) return fail('Engine already maxed.');
      if (world.cash < next.price) return fail(`Not enough cash — need $${next.price}.`);
      world.cash -= next.price;
      u.engine += 1;
      this.applyToCar(world);
      world.audio.chaChing();
      this.message = `${next.name} installed!`;
      this.messageT = 2.5;
      return true;
    }
    if (id === 'armor') {
      const next = GARAGE.armor[u.armor];
      if (!next) return fail('Armour already maxed.');
      if (world.cash < next.price) return fail(`Not enough cash — need $${next.price}.`);
      world.cash -= next.price;
      u.armor += 1;
      this.applyToCar(world);
      world.audio.chaChing();
      this.message = `${next.name} installed!`;
      this.messageT = 2.5;
      return true;
    }
    if (id === 'nitro') {
      if (u.nitro) return fail('Nitro already installed.');
      if (world.cash < GARAGE.nitro.price) return fail(`Not enough cash — need $${GARAGE.nitro.price}.`);
      world.cash -= GARAGE.nitro.price;
      u.nitro = true;
      this.applyToCar(world);
      world.audio.chaChing();
      this.message = 'Nitro installed — hold Shift to boost!';
      this.messageT = 2.5;
      return true;
    }
    if (id.startsWith('paint:')) {
      const paint = GARAGE.paints.find((p) => `paint:${p.name}` === id);
      if (!paint) return fail('Unknown paint.');
      if (world.cash < paint.price) return fail(`Not enough cash — need $${paint.price}.`);
      world.cash -= paint.price;
      u.paint = paint.color.slice();
      this.applyToCar(world);
      world.audio.chaChing();
      this.message = `${paint.name} paint applied!`;
      this.messageT = 2.5;
      return true;
    }
    return fail('Unknown item.');
  }

  // Push the current upgrades onto Mara's car, if she has one.
  applyToCar(world) {
    const car = world.player.car;
    if (car) car.applyUpgrades(this.upgrades);
  }

  update(dt) {
    if (this.messageT > 0) {
      this.messageT -= dt;
      if (this.messageT <= 0) this.message = '';
    }
  }

  // Save/load: the upgrades object is plain JSON.
  serialize() {
    return { ...this.upgrades, paint: this.upgrades.paint ? this.upgrades.paint.slice() : null };
  }

  deserialize(s) {
    if (!s) return;
    if (typeof s.engine === 'number') this.upgrades.engine = s.engine;
    if (typeof s.armor === 'number') this.upgrades.armor = s.armor;
    if (typeof s.nitro === 'boolean') this.upgrades.nitro = s.nitro;
    if (Array.isArray(s.paint)) this.upgrades.paint = s.paint.slice();
  }
}
