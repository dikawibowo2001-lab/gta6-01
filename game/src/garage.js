// Solmar Bay v4 — Reyes' Garage: the upgrade shop.
//
// Park by the garage (marked on the minimap) and press G: a
// full-screen shop sells engine levels, armor levels, a nitro kit
// and five paint jobs. Purchases apply to whatever car Mara is
// driving and persist in the save file.

export const GARAGE_ITEMS = [
  { id: 'engine1', name: 'Engine — Stage 1', price: 400, desc: '+12% top speed', kind: 'engine', level: 1 },
  { id: 'engine2', name: 'Engine — Stage 2', price: 800, desc: '+24% top speed', kind: 'engine', level: 2 },
  { id: 'engine3', name: 'Engine — Stage 3', price: 1400, desc: '+36% top speed', kind: 'engine', level: 3 },
  { id: 'armor1', name: 'Armor — Light', price: 350, desc: '-15% damage taken', kind: 'armor', level: 1 },
  { id: 'armor2', name: 'Armor — Heavy', price: 700, desc: '-30% damage taken', kind: 'armor', level: 2 },
  { id: 'armor3', name: 'Armor — Military', price: 1200, desc: '-45% damage taken', kind: 'armor', level: 3 },
  { id: 'nitro', name: 'Nitro Kit', price: 600, desc: 'Shift for a 3s speed boost', kind: 'nitro', level: 1 },
  { id: 'paint', name: 'Paint — Sunset Gold', price: 150, desc: 'Repaint the current car', kind: 'paint', level: 1 },
];

export function makeGarage(G) {
  const owned = new Set();

  function engineLevel() {
    if (owned.has('engine3')) return 3;
    if (owned.has('engine2')) return 2;
    if (owned.has('engine1')) return 1;
    return 0;
  }
  function armorLevel() {
    if (owned.has('armor3')) return 3;
    if (owned.has('armor2')) return 2;
    if (owned.has('armor1')) return 1;
    return 0;
  }

  return {
    open: false,
    owned,
    get engineLevel() { return engineLevel(); },
    get armorLevel() { return armorLevel(); },
    get nitroOwned() { return owned.has('nitro'); },
    items() {
      return GARAGE_ITEMS.map((it) => ({
        ...it,
        owned: owned.has(it.id),
        affordable: G.player.cash >= it.price,
      }));
    },
    nearGarage() {
      const g = G.city.garagePos;
      const dx = G.player.pos[0] - g[0];
      const dz = G.player.pos[2] - g[2];
      return Math.hypot(dx, dz) < 14;
    },
    openShop() {
      this.open = true;
      G.hud.openGarage();
      G.audio.play('click');
    },
    closeShop() {
      this.open = false;
      G.hud.closeGarage();
      G.audio.play('click');
    },
    buy(id) {
      const item = GARAGE_ITEMS.find((i) => i.id === id);
      if (!item) return false;
      if (owned.has(id)) {
        G.hud.toast('Sudah dibeli');
        return false;
      }
      // Engine/armor must be bought in order.
      if (item.kind === 'engine' && item.level > engineLevel() + 1) {
        G.hud.toast('Beli stage sebelumnya dulu');
        G.audio.play('denied');
        return false;
      }
      if (item.kind === 'armor' && item.level > armorLevel() + 1) {
        G.hud.toast('Beli stage sebelumnya dulu');
        G.audio.play('denied');
        return false;
      }
      if (G.player.cash < item.price) {
        G.hud.toast('Uang tidak cukup');
        G.audio.play('denied');
        return false;
      }
      G.player.cash -= item.price;
      owned.add(id);
      if (item.kind === 'paint' && G.player.car) {
        G.player.car.color = [1.0, 0.75, 0.2];
      }
      G.audio.play('cash');
      G.hud.toast(`Dibeli: ${item.name}`);
      G.hud.refreshGarage();
      return true;
    },
    update() {
      if (G.inTitle || G.paused) return;
      if (this.open) {
        if (G.input.wasPressed('KeyG') || G.input.wasPressed('Escape')) this.closeShop();
        return;
      }
      if (G.input.wasPressed('KeyG') && this.nearGarage()) {
        this.openShop();
      } else if (G.input.wasPressed('KeyG')) {
        G.hud.toast('Garage Reyes ada di dekat perempatan (tanda G di minimap)');
      }
    },
  };
}
