// Solmar Bay v4 — burning wrecks.
//
// A car whose health drops below 30 starts burning: fire and smoke
// pour out of the hood for four seconds, then the tank goes up — a
// blast that hurts anything nearby and shakes the camera. What is
// left is a charred husk that stays in the world as a reminder.

import { v3DistXZ } from './math3.js';

export function makeWrecks(G) {
  const burning = new Map(); // car -> seconds left on the fuse

  function ignite(car) {
    if (car.burnt || burning.has(car)) return;
    car.burning = true;
    burning.set(car, 4);
    G.audio.play('crash');
  }

  function explode(car) {
    burning.delete(car);
    car.burning = false;
    car.burnt = true;
    car.dead = true;
    car.speed = 0;
    G.audio.play('explosion');
    G.shake = 0.7;
    const at = [car.pos[0], 1, car.pos[2]];
    for (let i = 0; i < 14; i += 1) G.particles.spawn('fire', at);
    for (let i = 0; i < 10; i += 1) G.particles.spawn('smoke', at);
    G.particles.spawn('impact', at);
    // Blast radius: 14 metres, 55 damage at the centre.
    const hurt = (pos, amount) => {
      const d = v3DistXZ(car.pos, pos);
      if (d < 14) return amount * (1 - d / 14);
      return 0;
    };
    const playerDmg = hurt(G.player.pos, 55);
    if (playerDmg > 1) G.combat.damagePlayer(playerDmg);
    for (const other of G.cars) {
      if (other === car || other.dead) continue;
      const dmg = hurt(other.pos, 55);
      if (dmg > 1) G.vehicles.damageCar(other, dmg);
    }
    for (const ped of G.peds) {
      if (!ped.dead && hurt(ped.pos, 55) > 25) G.combat.killPed(ped);
    }
    for (const cop of G.police.footCops) {
      if (!cop.dead) {
        const dmg = hurt(cop.pos, 55);
        if (dmg > 1) G.combat.damageCop(cop, dmg);
      }
    }
    // If the player was driving it, they are out on foot now.
    if (G.player.car === car) {
      G.player.car = null;
      G.player.onFoot = true;
      G.player.pos = [car.pos[0] + 3, 0, car.pos[2] + 3];
    }
  }

  return {
    ignite,
    update(dt) {
      for (const [car, fuse] of [...burning.entries()]) {
        const left = fuse - dt;
        // Fire and smoke while the fuse burns down.
        const at = [car.pos[0], 1.2, car.pos[2]];
        if (G.rng.chance(dt * 22)) G.particles.spawn('fire', at);
        if (G.rng.chance(dt * 10)) G.particles.spawn('smoke', at);
        if (left <= 0) {
          explode(car);
        } else {
          burning.set(car, left);
        }
      }
    },
  };
}
