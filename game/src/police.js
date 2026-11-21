// Solmar Bay v4 — the Solmar Bay Police Department.
//
// Wanted stars drive the whole response: 1★ a single cruiser, 2★
// foot cops join in, 3★ the CONDOR helicopter circles overhead, 4★
// roadblocks go up ahead of you, 5★ the full weight of the SBPD.
// Lay low (no cop in sight) and the heat slowly bleeds off.

import { CFG } from './config.js';
import { lerpAngle, v3DistXZ } from './math3.js';
import { roadLines } from './world.js';
import { makeCar } from './vehicles.js';

const COP_CARS_BY_STARS = [0, 1, 2, 2, 3, 4];
const FOOT_COPS_BY_STARS = [0, 0, 2, 3, 4, 5];

export function makePolice(G) {
  let wanted = 0;
  let hiddenTimer = 0;
  let roadblockTimer = 0;
  let bustedTimer = 0;
  const footCops = [];
  let heli = null;
  let heliAngle = 0;

  function addWanted(n) {
    const before = wanted;
    wanted = Math.max(0, Math.min(5, wanted + n));
    if (wanted > before) {
      G.audio.play('wantedUp');
      G.hud.toast(`WANTED ${'★'.repeat(wanted)}${'☆'.repeat(5 - wanted)}`);
    }
  }

  function setWanted(n) {
    wanted = Math.max(0, Math.min(5, n));
  }

  function copCars() {
    return G.cars.filter((c) => c.kind === 'cop' && !c.dead);
  }

  function nearestCopDist() {
    let best = Infinity;
    for (const c of copCars()) best = Math.min(best, v3DistXZ(c.pos, G.player.pos));
    for (const f of footCops) if (!f.dead) best = Math.min(best, v3DistXZ(f.pos, G.player.pos));
    return best;
  }

  function spawnCopCar() {
    const lines = roadLines();
    const p = G.player.pos;
    for (let tries = 0; tries < 12; tries += 1) {
      const road = G.rng.pick(lines);
      const along = G.rng.range(-140, 140);
      const horizontal = G.rng.chance(0.5);
      const x = horizontal ? along : road;
      const z = horizontal ? road : along;
      const d = Math.hypot(x - p[0], z - p[2]);
      if (d > 55 && d < 110) {
        const car = makeCar(x, z, 0, { color: [0.1, 0.15, 0.55], kind: 'cop', driver: 'cop' });
        car.route = null;
        G.cars.push(car);
        return car;
      }
    }
    return null;
  }

  function spawnFootCop() {
    const p = G.player.pos;
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(18, 30);
    const cop = {
      pos: [p[0] + Math.cos(a) * d, 0, p[2] + Math.sin(a) * d],
      angle: 0,
      speed: 0,
      walkPhase: 0,
      shirt: [0.1, 0.15, 0.5],
      pants: [0.1, 0.1, 0.15],
      cop: true,
      health: 60,
      dead: false,
      attackTimer: 0,
    };
    footCops.push(cop);
    return cop;
  }

  function spawnRoadblock() {
    const p = G.player;
    // Heading: the car's when driving, the player's own when on foot.
    const heading = p.car ? p.car.angle : p.angle;
    const fx = -Math.sin(heading);
    const fz = -Math.cos(heading);
    const ahead = 45;
    const bx = p.pos[0] + fx * ahead;
    const bz = p.pos[2] + fz * ahead;
    const angle = heading + Math.PI / 2;
    for (const side of [-3, 3]) {
      // Park across the road: offset perpendicular to the player's heading.
      const car = makeCar(bx + -Math.cos(heading) * side, bz + Math.sin(heading) * side, angle, {
        color: [0.1, 0.15, 0.55], kind: 'cop', driver: 'none',
      });
      car.roadblock = true;
      G.cars.push(car);
    }
    G.hud.toast('ROADBLOCK DI DEPAN!');
    G.audio.play('wantedUp');
  }

  function spawnHeli() {
    if (heli) return heli;
    heli = {
      pos: [G.player.pos[0] + 40, CFG.heliHeight, G.player.pos[2]],
      angle: 0, rotor: 0,
    };
    G.hud.toast('CONDOR-1 di udara — helikopter polisi!');
    return heli;
  }

  function updateCopCar(car, dt) {
    // Lena's decoy flare pulls the pursuit off the player.
    const decoy = G.crew.decoyPos;
    const target = decoy || G.player.pos;
    const dx = target[0] - car.pos[0];
    const dz = target[2] - car.pos[2];
    const d = Math.hypot(dx, dz);
    const targetAngle = Math.atan2(-dx, -dz);
    car.angle = lerpAngle(car.angle, targetAngle, Math.min(1, dt * 2.2));
    const want = d > 6 ? CFG.copTopSpeed : CFG.copTopSpeed * 0.6;
    car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
    // Ram: contact damage to the player's car (real distance, not decoy).
    const pd = v3DistXZ(car.pos, G.player.pos);
    if (pd < 3.4 && G.player.car) {
      G.vehicles.damageCar(G.player.car, CFG.copRamDamage * dt);
      car.speed *= 0.9;
    }
    // Despawn far-away cruisers so the chase stays tight.
    if (pd > 220) {
      car.dead = true;
      car.remove = true;
    }
  }

  function updateFootCop(cop, dt) {
    if (cop.dead) return;
    const p = G.player;
    const dx = p.pos[0] - cop.pos[0];
    const dz = p.pos[2] - cop.pos[2];
    const d = Math.hypot(dx, dz);
    cop.angle = Math.atan2(-dx / (d || 1), -dz / (d || 1));
    cop.attackTimer -= dt;
    if (d > 2.2) {
      cop.speed = 7.5;
      cop.pos[0] += (dx / (d || 1)) * cop.speed * dt;
      cop.pos[2] += (dz / (d || 1)) * cop.speed * dt;
      cop.walkPhase += dt * 10;
    } else if (cop.attackTimer <= 0) {
      cop.attackTimer = 1.1;
      G.combat.damagePlayer(6);
      G.audio.play('crash');
    }
    if (d > 120) cop.remove = true;
  }

  function updateHeli(dt) {
    if (wanted < 3) {
      if (heli) {
        heli = null;
        G.hud.toast('Helikopter pergi — udara bersih');
      }
      return;
    }
    if (!heli) {
      spawnHeli();
    }
    heliAngle += dt * 0.35;
    const p = G.player.pos;
    const tx = p[0] + Math.cos(heliAngle) * CFG.heliOrbitRadius;
    const tz = p[2] + Math.sin(heliAngle) * CFG.heliOrbitRadius;
    heli.pos[0] += (tx - heli.pos[0]) * Math.min(1, dt * 1.2);
    heli.pos[2] += (tz - heli.pos[2]) * Math.min(1, dt * 1.2);
    heli.pos[1] = CFG.heliHeight + Math.sin(G.time * 0.8) * 1.5;
    heli.angle = Math.atan2(-(p[0] - heli.pos[0]), -(p[2] - heli.pos[2]));
    heli.rotor += dt * 30;
  }

  return {
    footCops,
    get wanted() { return wanted; },
    get heli() { return heli; },
    addWanted,
    setWanted,
    nearestCopDist,
    spawnRoadblock,
    spawnHeli,
    update(dt) {
      // Maintain the response for the current wanted level.
      const wantCars = COP_CARS_BY_STARS[wanted];
      if (copCars().length < wantCars && G.rng.chance(dt * 1.2)) spawnCopCar();
      const liveFoot = footCops.filter((c) => !c.dead && !c.remove).length;
      if (liveFoot < FOOT_COPS_BY_STARS[wanted] && G.rng.chance(dt * 0.9)) spawnFootCop();
      for (const car of copCars()) {
        if (!car.roadblock) updateCopCar(car, dt);
      }
      for (const cop of footCops) updateFootCop(cop, dt);
      // Prune removed cops.
      for (let i = footCops.length - 1; i >= 0; i -= 1) {
        if (footCops[i].remove) footCops.splice(i, 1);
      }
      for (let i = G.cars.length - 1; i >= 0; i -= 1) {
        if (G.cars[i].remove) G.cars.splice(i, 1);
      }
      updateHeli(dt);
      // Roadblocks at 4 stars and up.
      roadblockTimer -= dt;
      if (wanted >= 4 && G.player.car && Math.abs(G.player.car.speed) > 15 && roadblockTimer <= 0) {
        roadblockTimer = 25;
        spawnRoadblock();
      }
      // Heat decay: unseen for a while, one star drops.
      if (wanted > 0) {
        if (nearestCopDist() > 45 && !heli) {
          hiddenTimer += dt;
          if (hiddenTimer > CFG.wantedDecaySeconds) {
            hiddenTimer = 0;
            addWanted(-1);
            G.hud.toast('Panas mereda — satu bintang hilang');
          }
        } else {
          hiddenTimer = 0;
        }
      }
      // Busted: on foot, still, surrounded by foot cops.
      if (wanted > 0 && G.player.onFoot && !G.player.dead) {
        const near = footCops.filter((c) => !c.dead && v3DistXZ(c.pos, G.player.pos) < 3.5).length;
        if (near >= 2) {
          bustedTimer += dt;
          if (bustedTimer > 3) {
            bustedTimer = 0;
            G.player.cash = Math.max(0, G.player.cash - 150);
            setWanted(0);
            G.hud.toast('TERTANGKAP! Denda $150, wanted bersih');
            G.missions.failCurrent('Mara tertangkap');
          }
        } else {
          bustedTimer = 0;
        }
      }
      G.audio.siren(wanted > 0);
    },
  };
}
