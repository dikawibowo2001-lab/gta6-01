// Screenshot staging: ?shot=<name>&seed=7 drops the game into a fixed,
// photogenic state so the four dossier screenshots show the game at its
// best. The capture script waits for window.__shotReady.
//
//   title   — the title screen over a slow orbit of downtown.
//   drive   — Mara in the Pelo GT with the WEAPON WHEEL OPEN and the
//             radio ticker live: two of the v3 systems, front and
//             centre, mid-mission with the HUD + minimap live.
//   chase   — THE MONEY SHOT: 4 stars, helicopter VISIBLE with its
//             spotlight, three cruisers, a roadblock ahead, dispatch
//             list, dialogue, mission panel — every system at once.
//   mission — THE GARAGE: Reyes' upgrade shop open over the city,
//             engine/armour/nitro/paint rows and Mara's cash on hand —
//             the v3 headline system, impossible to miss.

import { Car } from './vehicles.js';

export function stageShot(shot, world, renderer) {
  const w = world;
  if (shot === 'title') {
    return { frames: 30 };
  }
  // Every other shot starts the game.
  w.startGame();
  w.audio.setMuted(true); // screenshots run silent
  w.hint = '';
  w.hintTimer = 0;
  if (shot === 'drive') {
    // Mission 1, stage 2: driving the stolen Pelo GT to the garage,
    // with the weapon wheel open and the synthwave station playing.
    w.missions.index = 0;
    w.missions.start();
    w.missions.stage = 1;
    w.missions.say('Reyes', 'Garage is on Harbor Row. Easy does it — the paint is the paycheck.');
    const sports = w.traffic.cars.find((c) => c.type === 'sports' && c.driver === null)
      || w.parked.find((c) => c.type === 'sports');
    if (sports) {
      w.player.x = sports.x;
      w.player.z = sports.z;
      w.enterCar();
    }
    w.player.car.heading = Math.PI / 2; // east, down Strand Row
    w.player.car.speed = 26;
    w.autoDrive = true;
    w.autoLaneZ = w.player.car.z;
    w.cash = 300;
    w.xp = 420;
    // Weapon wheel pinned open (the capture can't hold Q) with the
    // shotgun hovered, and the radio on NEON 101.7.
    w.weapons.forceOpen = true;
    w.weapons.hover = 'shotgun';
    w.combat.select('shotgun');
    w.radio.idx = 1;
    w.radio.trackIdx = 0;
    return { frames: 50 };
  }
  if (shot === 'chase') {
    // Mission 4 (The Last Getaway) at 4 stars with the full circus.
    w.missions.index = 3;
    w.missions.start();
    w.missions.say('Reyes', 'Four stars, Mara — lose them on the beach road or lose everything!');
    const sports = w.parked.find((c) => c.type === 'sports')
      || w.traffic.cars.find((c) => c.type === 'sports' && c.driver === null);
    if (sports) {
      w.player.x = sports.x;
      w.player.z = sports.z;
      w.enterCar();
    }
    const car = w.player.car;
    car.x = 40;
    car.z = 120;
    car.heading = Math.PI / 2; // east along the beach road
    car.speed = 30;
    w.player.x = car.x;
    w.player.z = car.z;
    w.autoDrive = true;
    w.autoLaneZ = 120;
    w.cash = 1250;
    w.xp = 1450;
    w.player.armour = 55;
    // Pin the chase camera for this shot: 10 units back, low (3.8),
    // look target near level (4.4) — the car sits large in the
    // lower-center frame, above the dialogue box, while the heli
    // (26 ahead, ~22 up) still lands in the upper frame. The live
    // chase cam pitches up much further for the heli and pushes the
    // car out of the bottom of the frame.
    renderer.shotCam = { back: 10, camY: 3.8, lookAhead: 16, lookY: 4.4 };
    // Four stars + helicopter + three cruisers in frame.
    w.police.heat = 65;
    w.police.spawnTimer = 5; // don't auto-spawn more right away
    w.police.blockTimer = 30; // don't auto-place a second roadblock on the car's path
    // The two pursuit cruisers stage well back and offset to the
    // sides: their AI steers them onto the car's tail, and with the
    // pinned camera close behind, a cruiser on the tail would loom
    // huge across the bottom of the frame. Staged this far back they
    // are still behind the camera at shot time — out of frame, but
    // still on the dispatch list as PURSUE. The interceptor stages
    // just ahead; it falls behind too, and stays out of the
    // six-unit dispatch list so the heli's AIR SUPPORT line shows.
    const spots = [
      [-26, -12, 'RAMMING'],
      [-30, 12, 'FLANKING'],
      [28, 10, 'INTERCEPT'],
    ];
    for (const [dx, dz, role] of spots) {
      const c = new Car('police', [0.09, 0.09, 0.11], car.x + dx, car.z + dz, car.heading);
      c.driver = 'police';
      c.callsign = w.police.nextCallsign();
      c.role = role;
      c.speed = 28;
      w.police.cruisers.push(c);
    }
    // Park the helicopter in its slot NOW — ahead of the car, low
    // enough to sit inside the chase camera's frame — instead of
    // waiting for it to drift in from its spawn point.
    const heli = w.police.heli;
    heli.active = true;
    heli.x = car.x + 36;
    heli.z = car.z - 6;
    heli.y = 20;
    heli.heading = Math.atan2(car.x - heli.x, car.z - heli.z);
    heli.spotTarget = [car.x + 6, car.z + 2];
    heli.orbitT = 0;
    w.police.placeRoadblock(w.player);
    // The car covers ~90 units in the 60 staging frames (dt clamps at
    // 0.05s in headless capture), so push the roadblock ~200 ahead —
    // at shot time it sits at the vanishing point, visible across the
    // road, instead of already behind us.
    for (const rb of w.police.roadblocks) {
      rb.x = car.x + 200;
      for (const rc of rb.cars) rc.x = car.x + 200;
    }
    return { frames: 60 };
  }
  if (shot === 'mission') {
    // The garage shop open: Mara has cash, the car is parked at the
    // garage door, and every upgrade row is on screen.
    w.missions.index = 1;
    w.missions.completed = 1;
    w.cash = 1250;
    w.xp = 420;
    w.progression.xp = 550; // HUSTLER — the pause panel would show it
    const sports = w.parked.find((c) => c.type === 'sports')
      || w.traffic.cars.find((c) => c.type === 'sports' && c.driver === null);
    if (sports) {
      w.player.x = sports.x;
      w.player.z = sports.z;
      w.enterCar();
    }
    const car = w.player.car;
    const g = w.city.spawns.reyesGarage;
    car.x = g[0];
    car.z = g[1] - 8;
    car.heading = Math.PI;
    car.speed = 0;
    w.player.x = car.x;
    w.player.z = car.z;
    w.player.heading = car.heading;
    w.hint = '';
    w.hintTimer = 0;
    w.garage.open = true;
    return { frames: 40 };
  }
  return { frames: 30 };
}
