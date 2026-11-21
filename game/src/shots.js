// Solmar Bay v4 — screenshot staging (?shot=title|drive|chase|mission).
//
// Each preset puts the world into a photogenic state and pins the
// camera, so the four screenshots are reproducible: the title orbit,
// a drive with the weapon wheel open, a 4-star chase with the
// helicopter in frame, and the open garage shop. Staging runs once,
// right after the world boots, before the first rendered frame.

import { makeCar } from './vehicles.js';

export function applyShot(G, name) {
  G.shot = name;
  const p = G.player;

  if (name === 'title') {
    // Title screen over the orbiting city; nothing else to stage.
    G.inTitle = true;
    return;
  }

  // Every other shot plays the game (no title screen).
  G.inTitle = false;
  G.hud.hideTitle();
  G.radio.start();

  if (name === 'drive') {
    // Coastal road, fast sport car, weapon wheel open, radio on.
    const car = makeCar(-128, 20, 0, { color: [0.9, 0.15, 0.2], kind: 'sport', driver: 'player' });
    car.speed = 40;
    G.cars.push(car);
    G.vehicles.enterCar(car);
    p.pos = [car.pos[0], 0, car.pos[2]];
    G.weapons.unlock(3);
    G.weapons.select(3); // shotgun highlighted in the wheel
    G.radio.setStation(1); // MIDNIGHT DRIVE
    G.hud.openWheel();
    G.hud.setObjective('Berkendara keliling kota — tahan Q untuk weapon wheel');
    G.wheelLocked = true; // the game loop must not auto-close it
    G.shotFreeze = true; // freeze the world so the car stays in frame
    G.shotCam = {
      eye: [-123.5, 2.8, 28.5],
      target: [-128.5, 1.6, 8],
      fov: 1.05,
    };
  } else if (name === 'chase') {
    // 4-star chase: helicopter overhead, cruisers behind, roadblock ahead.
    const car = makeCar(0, 40, 0, { color: [0.15, 0.35, 0.85], kind: 'sport', driver: 'player' });
    car.speed = 34;
    G.cars.push(car);
    G.vehicles.enterCar(car);
    p.pos = [car.pos[0], 0, car.pos[2]];
    p.cash = 1250;
    G.police.setWanted(4);
    // Two cruisers flanking just behind the player car, inside the frame.
    for (const [cx, cz] of [[3.5, 44], [-3.5, 47]]) {
      const cop = makeCar(cx, cz, 0, {
        color: [0.1, 0.15, 0.55], kind: 'cop', driver: 'cop',
      });
      cop.speed = 34;
      G.cars.push(cop);
    }
    // Roadblock 45 m ahead (uses the player's heading).
    G.police.spawnRoadblock();
    // Helicopter placed by hand so it lands in the upper frame:
    // ahead of the camera, above the road, spotlight pooling below.
    const heli = G.police.spawnHeli();
    heli.pos = [6, 18, 10];
    heli.rotor = 0.8;
    G.hud.setObjective('LOLOS! Polisi mengejar — 4 bintang, helikopter di udara');
    G.shotFreeze = true; // freeze the world so the chase stays composed
    // Pin the camera: car large lower-centre, heli in the upper frame.
    G.shotCam = {
      eye: [0, 3.8, 40 + 10],
      target: [0, 4.4, 40 - 16],
      fov: 1.05,
    };
  } else if (name === 'mission') {
    // Reyes' garage, shop open, cash on hand.
    p.pos = [16, 0, 20];
    p.angle = Math.PI;
    p.cash = 1250;
    p.onFoot = true;
    G.hud.setObjective('Bengkel Reyes — upgrade mobilmu dengan uang misi');
    G.garage.openShop();
    G.shotCam = {
      eye: [16, 3.2, 20 + 9],
      target: [16, 2.5, 32],
      fov: 1.0,
    };
  }
}
