// The world: everything the city holds, and the one step that moves it
// all — Mara on foot or behind the wheel, traffic, pedestrians, the
// police, the mission, the bullets and the noise. main.js feeds it
// controls; it answers with what happened.

import { DAY_START_MINUTES, MINUTES_PER_SECOND, PARKED_COUNT, PED_COUNT, PLAYER, TRAFFIC_COUNT, WANTED } from './config.js';
import { createRandom } from './random.js';
import { generateCity } from './city.js';
import { createPlayer, scarePeds, spawnPeds, stepPeds, stepPlayerOnFoot } from './entities.js';
import { collideCars, createCar, damageCar, spawnParkedCars, stepCar } from './vehicles.js';
import { spawnTraffic, stepTraffic } from './traffic.js';
import { addHeat, clearWanted, createWanted, stepPolice } from './police.js';
import { hurtPlayer, punch, shoot, spawnPickups, stepBullets, stepEnemies, stepPickups } from './combat.js';
import { createMissionState, failMission, startMission, updateMission } from './missions.js';
import { createEffects, spawnParticles, spawnText, stepEffects } from './particles.js';

export function createWorld(seed, audio, save) {
  const rng = createRandom(seed);
  const city = generateCity(rng);
  const home = city.landmarks.home;
  const world = {
    seed,
    rng,
    city,
    audio,
    time: 0,
    clockMinutes: DAY_START_MINUTES,
    player: createPlayer(home.x, home.y + 40),
    peds: spawnPeds(city, rng, PED_COUNT),
    cars: [],
    cops: [],
    bullets: [],
    enemies: [],
    pickups: spawnPickups(city, rng),
    juno: null,
    wanted: createWanted(),
    mission: createMissionState(),
    fx: createEffects(),
    camera: { x: home.x - 640, y: home.y - 360 },
    viewW: 1280,
    viewH: 720,
    cash: save ? save.cash : 100,
    stats: save ? { ...save.stats } : { carsStolen: 0, busts: 0, kills: 0, missionsDone: 0, cashEarned: 0 },
    banner: null,
    briefing: null,
    missionComplete: null,
    shake: 0,
    wasted: false,
    lastFine: 0,
    pendingShots: [],
    threat: null,
    attractAngle: 0,
  };
  world.cars = [
    ...spawnParkedCars(city, rng, PARKED_COUNT),
    ...spawnTraffic(city, rng, TRAFFIC_COUNT),
  ];
  if (save) {
    world.mission.completed = [...save.completed];
    world.mission.index = save.completed.findIndex((done) => !done);
    if (world.mission.index === -1) world.mission.index = 4;
  }
  return world;
}

function nearestCar(world, x, y, radius) {
  let best = null;
  let bestD = radius;
  for (const car of world.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(world) {
  const player = world.player;
  const car = nearestCar(world, player.x, player.y, 64);
  if (!car) return;
  if (car.role === 'player') return;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  if (car.role !== 'police') {
    car.role = 'player';
    world.stats.carsStolen += 1;
    addHeat(world, 100, 'Car theft');
    spawnText(world.fx, car.x, car.y - 30, 'CAR JACKED!', '#ffd166');
  } else {
    car.role = 'player';
    world.stats.carsStolen += 1;
    addHeat(world, 150, 'Stole a police cruiser');
    spawnText(world.fx, car.x, car.y - 30, 'CRUISER JACKED!', '#ff4d4d');
  }
  if (world.audio) world.audio.click();
}

function exitCar(world) {
  const player = world.player;
  const car = player.car;
  if (!car) return;
  car.role = 'parked';
  const side = Math.PI / 2;
  const px = car.x + Math.cos(car.angle + side) * (car.width / 2 + 16);
  const py = car.y + Math.sin(car.angle + side) * (car.width / 2 + 16);
  if (!world.city.solidAt(px, py, PLAYER.radius)) {
    player.x = px;
    player.y = py;
  } else {
    player.x = car.x - Math.cos(car.angle + side) * (car.width / 2 + 16);
    player.y = car.y - Math.sin(car.angle + side) * (car.width / 2 + 16);
  }
  player.car = null;
  player.angle = car.angle;
  if (world.audio) world.audio.click();
}

function runOverPeds(world) {
  const car = world.player.car;
  if (!car || Math.abs(car.speed) < 80) return;
  for (const ped of world.peds) {
    if (ped.down) continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
    const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along < car.length / 2 + 4 && across < car.width / 2 + 6) {
      ped.down = true;
      ped.state = 'down';
      scarePeds(world.peds, ped.x, ped.y, 320);
      addHeat(world, 60, 'Hit and run');
      spawnParticles(world.fx, ped.x, ped.y, { count: 8, color: '#ff6b6b', speed: 140, life: 0.4, size: 4 });
      if (world.audio) world.audio.hit();
    }
  }
}

export function stepWorld(world, controls, actions, dt) {
  const player = world.player;
  world.time += dt;
  world.clockMinutes += dt * MINUTES_PER_SECOND;
  world.shake = Math.max(0, world.shake - dt * 26);

  player.shootCd = Math.max(0, player.shootCd - dt);
  player.punchCd = Math.max(0, player.punchCd - dt);
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) player.ammo = PLAYER.magSize;
  }

  // Entering and leaving cars.
  if (actions.enter) {
    if (player.car) exitCar(world);
    else enterCar(world);
  }

  if (player.car) {
    const car = player.car;
    if (car.dead) {
      exitCar(world);
    } else {
      stepCar(car, {
        throttle: controls.throttle,
        steer: controls.steer,
        handbrake: controls.handbrake,
      }, dt, world.city, world.fx, world.audio);
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      if (world.audio) world.audio.engine(Math.min(1, Math.abs(car.speed) / 600));
      runOverPeds(world);
    }
  } else {
    if (world.audio) world.audio.engine(0);
    stepPlayerOnFoot(player, controls.move, dt, world.city, controls.sprint);
    player.angle = controls.aimAngle;
    if (controls.shooting) {
      if (player.ammo > 0 && player.shootCd <= 0 && player.reloading <= 0) {
        player.shootCd = PLAYER.shootCooldown;
        player.ammo -= 1;
        shoot(world, player, player.angle, 'player', 34);
        if (world.audio) world.audio.gunshot();
        scarePeds(world.peds, player.x, player.y, 380);
        const copNear = world.cars.some((c) => c.role === 'police' && !c.dead && Math.hypot(c.x - player.x, c.y - player.y) < 520);
        if (copNear || world.wanted.stars > 0) addHeat(world, 4, 'Shots fired');
        if (player.ammo === 0) player.reloading = PLAYER.reloadTime;
      } else if (player.ammo === 0 && player.punchCd <= 0) {
        punch(world);
      }
    }
  }

  // Cop bullets queued by the police step.
  for (const shot of world.pendingShots) {
    shoot(world, { x: shot.x, y: shot.y }, shot.angle, shot.from, shot.damage);
  }
  world.pendingShots = [];

  stepTraffic(world.cars, world.cars, dt, world.city, world.rng, world.fx, world.audio);
  stepPeds(world.peds, dt, world.city, world.rng, world.threat);
  world.threat = null;
  const policeResult = stepPolice(world, dt, world.rng);
  stepEnemies(world, dt);
  stepBullets(world, dt);
  stepPickups(world);
  updateMission(world, dt, actions);
  stepEffects(world.fx, dt);
  if (world.audio) world.audio.updateSiren(dt);

  // Car-on-car collisions, all pairs.
  for (let i = 0; i < world.cars.length; i += 1) {
    for (let j = i + 1; j < world.cars.length; j += 1) {
      collideCars(world.cars[i], world.cars[j], world.fx, world.audio);
    }
  }

  // Smoking wrecks puff; dead cars burn out and vanish.
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    const car = world.cars[i];
    if (car.smoked && !car.dead && Math.random() < dt * 8) {
      spawnParticles(world.fx, car.x, car.y - 6, { count: 1, color: '#666666', speed: 20, life: 1.1, size: 7, vy: -30 });
    }
    if (car.dead && car.role !== 'player') {
      car.burnTimer = (car.burnTimer ?? 0) + dt;
      if (Math.random() < dt * 6) {
        spawnParticles(world.fx, car.x, car.y, { count: 1, color: '#ff6b35', speed: 40, life: 0.5, size: 6 });
      }
      if (car.burnTimer > 25) world.cars.splice(i, 1);
    }
  }

  // Camera: follow with lookahead, clamped to the city.
  const lookX = player.car ? Math.cos(player.car.angle) * Math.abs(player.car.speed) * 0.25 : 0;
  const lookY = player.car ? Math.sin(player.car.angle) * Math.abs(player.car.speed) * 0.25 : 0;
  const targetX = player.x + lookX - world.viewW / 2;
  const targetY = player.y + lookY - world.viewH / 2;
  const k = Math.min(1, dt * 4);
  world.camera.x += (targetX - world.camera.x) * k;
  world.camera.y += (targetY - world.camera.y) * k;
  world.camera.x = Math.max(0, Math.min(3200 - world.viewW, world.camera.x));
  world.camera.y = Math.max(0, Math.min(2400 - world.viewH, world.camera.y));
  if (world.shake > 0.2) {
    world.camera.x += (Math.random() - 0.5) * world.shake;
    world.camera.y += (Math.random() - 0.5) * world.shake;
  }

  if (policeResult === 'busted') return 'busted';
  if (world.wasted) return 'wasted';
  return null;
}

// The title screen's backdrop: traffic flows, peds stroll, and the camera
// drifts slowly across downtown while nobody is playing.
export function stepAttract(world, dt) {
  world.time += dt;
  world.clockMinutes += dt * MINUTES_PER_SECOND * 0.2;
  stepTraffic(world.cars, world.cars, dt, world.city, world.rng, world.fx, null);
  stepPeds(world.peds, dt, world.city, world.rng, null);
  stepEffects(world.fx, dt);
  world.attractAngle += dt * 0.05;
  const cx = 1280 + Math.cos(world.attractAngle) * 500;
  const cy = 1100 + Math.sin(world.attractAngle * 0.7) * 350;
  world.camera.x += (cx - world.viewW / 2 - world.camera.x) * Math.min(1, dt * 0.8);
  world.camera.y += (cy - world.viewH / 2 - world.camera.y) * Math.min(1, dt * 0.8);
  world.camera.x = Math.max(0, Math.min(3200 - world.viewW, world.camera.x));
  world.camera.y = Math.max(0, Math.min(2400 - world.viewH, world.camera.y));
}

export function respawnAfterBust(world) {
  const station = world.city.landmarks.policeStation;
  if (world.player.car) {
    world.player.car.role = 'parked';
    world.player.car = null;
  }
  world.player.x = station.x;
  world.player.y = station.y + 60;
  world.player.hp = world.player.maxHp;
  world.lastFine = Math.min(world.cash, WANTED.bustFine);
  world.cash -= world.lastFine;
  world.stats.busts += 1;
  clearWanted(world);
  if (world.mission.state === 'active') failMission(world, 'Busted by Solmar PD');
  world.wasted = false;
}

export function respawnAfterWasted(world) {
  const hospital = world.city.landmarks.hospital;
  if (world.player.car) {
    world.player.car.role = 'parked';
    world.player.car = null;
  }
  world.player.x = hospital.x;
  world.player.y = hospital.y + 60;
  world.player.hp = world.player.maxHp;
  world.player.armor = 0;
  world.lastFine = Math.min(world.cash, WANTED.wastedFine);
  world.cash -= world.lastFine;
  clearWanted(world);
  if (world.mission.state === 'active') failMission(world, 'Mara went down');
  world.wasted = false;
}

export { hurtPlayer, damageCar, startMission };
