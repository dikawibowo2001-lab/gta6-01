// Solmar Bay v4 — arcade car physics + enter/exit.
//
// Cars are heading + speed: throttle accelerates along the heading,
// steering turns the heading proportional to speed, and a grip term
// bleeds off sideways slide. Collisions are circle-vs-AABB against
// the city's colliders and soft circle-vs-circle between cars.
// The player enters the nearest car with F and leaves the same way.

import { CFG } from './config.js';
import { clamp, v3DistXZ } from './math3.js';
import { resolveCollisions } from './city.js';
import { CAR_COLORS } from './entities.js';

export function makeCar(x, z, angle, opts = {}) {
  return {
    pos: [x, 0, z],
    angle,
    speed: 0,
    color: opts.color || [0.8, 0.2, 0.2],
    kind: opts.kind || 'sedan',
    health: CFG.carHealth,
    driver: opts.driver || 'none', // player | traffic | cop | none
    nitro: 0,
    burnt: false,
    burning: false,
    dead: false,
    honkTimer: 0,
  };
}

export function makeVehicles(G) {
  function topSpeed(car) {
    let top = CFG.carTopSpeed;
    if (car.kind === 'sport') top *= 1.15;
    if (car.kind === 'cop') top = CFG.copTopSpeed;
    if (car === G.player.car) top *= 1 + 0.12 * G.garage.engineLevel;
    if (car.nitro > 0) top *= 1.4;
    return top;
  }

  function drive(car, dt, throttle, steer) {
    const top = topSpeed(car);
    if (throttle > 0) car.speed += CFG.carAccel * throttle * dt;
    else if (throttle < 0) {
      car.speed += (car.speed > 0.5 ? -CFG.carBrake : CFG.carAccel * 0.5) * dt;
    } else {
      // Rolling drag.
      car.speed -= car.speed * 0.6 * dt;
    }
    car.speed = clamp(car.speed, -10, top);
    if (Math.abs(car.speed) > 0.2) {
      const grip = CFG.carGrip * clamp(Math.abs(car.speed) / 12, 0.4, 1);
      car.angle += steer * grip * dt * Math.sign(car.speed) * (1 - Math.abs(car.speed) / (top * 2.2));
    }
    if (car.nitro > 0) car.nitro = Math.max(0, car.nitro - dt);
  }

  function integrate(car, dt) {
    const fx = -Math.sin(car.angle);
    const fz = -Math.cos(car.angle);
    car.pos[0] += fx * car.speed * dt;
    car.pos[2] += fz * car.speed * dt;
    // World bounds: bounce softly off the city edge.
    const h = CFG.cityHalf + 30;
    if (car.pos[0] < -h || car.pos[0] > h || car.pos[2] < -h || car.pos[2] > h) {
      car.pos[0] = clamp(car.pos[0], -h, h);
      car.pos[2] = clamp(car.pos[2], -h, h);
      car.speed *= 0.4;
    }
    // Ocean edge: cars can't drive into the water.
    if (car.pos[0] < CFG.oceanX + 6) {
      car.pos[0] = CFG.oceanX + 6;
      car.speed *= 0.3;
    }
    const [nx, nz] = resolveCollisions(G.city.colliders, car.pos[0], car.pos[2], 1.6);
    if (nx !== car.pos[0] || nz !== car.pos[2]) {
      if (Math.abs(car.speed) > 12) {
        damageCar(car, Math.abs(car.speed) * 0.6);
        G.audio.play('crash');
      }
      car.pos[0] = nx;
      car.pos[2] = nz;
      car.speed *= 0.45;
    }
  }

  function damageCar(car, amount) {
    if (car.dead) return;
    const armor = car === G.player.car ? 1 - 0.15 * G.garage.armorLevel : 1;
    car.health -= amount * armor;
    if (car.health <= 30 && !car.burning && !car.burnt) {
      G.wrecks.ignite(car);
    }
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      G.wrecks.ignite(car);
    }
  }

  function nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of G.cars) {
      if (car.dead || car.burnt) continue;
      const d = v3DistXZ(pos, car.pos);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  function enterCar(car) {
    const p = G.player;
    p.car = car;
    car.driver = 'player';
    p.onFoot = false;
    p.pos = [car.pos[0], 0, car.pos[2]];
    p.angle = car.angle;
    G.audio.play('click');
    G.hud.toast('Mobil diambil — W gas, S rem, Spasi handbrake');
  }

  function exitCar() {
    const p = G.player;
    if (!p.car) return;
    const car = p.car;
    car.driver = 'none';
    car.speed = 0;
    p.car = null;
    p.onFoot = true;
    p.pos = [car.pos[0] + 2.5, 0, car.pos[2] + 1.5];
    G.audio.play('click');
  }

  return {
    topSpeed,
    drive,
    damageCar,
    nearestCar,
    enterCar,
    exitCar,
    spawnParked(count) {
      const lines = [-128, -96, -64, -32, 0, 32, 64, 96, 128];
      for (let i = 0; i < count; i += 1) {
        const road = G.rng.pick(lines);
        const along = G.rng.range(-140, 140);
        const horizontal = G.rng.chance(0.5);
        const x = horizontal ? along : road + 3.5;
        const z = horizontal ? road + 3.5 : along;
        const car = makeCar(x, z, horizontal ? Math.PI / 2 : 0, {
          color: G.rng.pick(CAR_COLORS),
          kind: G.rng.chance(0.15) ? 'sport' : 'sedan',
        });
        G.cars.push(car);
      }
    },
    update(dt) {
      const p = G.player;
      // Player driving input.
      if (p.car && !p.car.dead) {
        const input = G.input;
        let throttle = input.throttle;
        if (input.brake) throttle = -1;
        drive(p.car, dt, throttle, input.steer);
        if (input.wasPressed('KeyF')) exitCar();
        if (input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight')) {
          if (G.garage.nitroOwned && p.car.nitro <= 0) {
            p.car.nitro = 3;
            G.audio.play('horn');
          }
        }
      } else if (p.onFoot && G.input.wasPressed('KeyF')) {
        const car = nearestCar(p.pos, 4.5);
        if (car) {
          if (car.driver === 'traffic') G.police.addWanted(1);
          enterCar(car);
        }
      }
      // Integrate every car.
      for (const car of G.cars) {
        if (car.dead || car.burnt) {
          car.speed = 0;
          continue;
        }
        integrate(car, dt);
      }
      // Soft car-vs-car separation.
      for (let i = 0; i < G.cars.length; i += 1) {
        for (let j = i + 1; j < G.cars.length; j += 1) {
          const a = G.cars[i];
          const b = G.cars[j];
          if (a.dead || b.dead) continue;
          const dx = b.pos[0] - a.pos[0];
          const dz = b.pos[2] - a.pos[2];
          const d = Math.hypot(dx, dz);
          if (d > 0.01 && d < 3.2) {
            const push = (3.2 - d) / 2;
            const nx = dx / d;
            const nz = dz / d;
            a.pos[0] -= nx * push;
            a.pos[2] -= nz * push;
            b.pos[0] += nx * push;
            b.pos[2] += nz * push;
            const impact = Math.abs(a.speed - b.speed);
            if (impact > 8) {
              damageCar(a, impact * 0.4);
              damageCar(b, impact * 0.4);
              G.audio.play('crash');
            }
            a.speed *= 0.85;
            b.speed *= 0.85;
          }
        }
      }
      // Engine hum follows the player's car.
      if (p.car) {
        G.audio.engine(Math.abs(p.car.speed) / CFG.carTopSpeed, true);
      } else {
        G.audio.engine(0, false);
      }
    },
  };
}
