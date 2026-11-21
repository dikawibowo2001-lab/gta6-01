// Solmar Bay v4 — the renderer: camera + draw everything.
//
// The chase camera trails the player (farther and faster-feeling in
// a car), the title screen orbits the city, and a pinned shot camera
// takes over for screenshots. Drawing is one static pass for the
// world and city, then one tinted-box pass per dynamic object, then
// particles. A decaying shake term sells explosions and hard hits.

import { CFG } from './config.js';
import { clamp, lerp, lerpAngle, matFromTRS, matLookAt, matMultiply, matPerspective, v3 } from './math3.js';
import { beginFrame, drawBox, drawMesh, setCamera, setLighting } from './gl.js';
import { drawBoat, drawCar, drawHeli, drawPed } from './entities.js';

export function makeRender(G) {
  const cam = {
    pos: [0, 40, 120],
    angle: 0,
    dist: 10,
    height: 4,
    fov: 1.05,
  };

  function followTarget() {
    const p = G.player;
    if (p.car) return [p.car.pos[0], 2, p.car.pos[2]];
    if (p.boat) return [p.boat.pos[0], 2, p.boat.pos[2]];
    return [p.pos[0], 1.8, p.pos[2]];
  }

  function heading() {
    const p = G.player;
    if (p.car) return p.car.angle;
    if (p.boat) return p.boat.angle;
    return p.angle;
  }

  function updateCamera(dt) {
    // A pinned shot camera overrides everything.
    if (G.shotCam) {
      cam.pos = [...G.shotCam.eye];
      return { eye: G.shotCam.eye, target: G.shotCam.target, fov: G.shotCam.fov || 1.05 };
    }
    if (G.inTitle) {
      const t = G.time * 0.05;
      const eye = [Math.cos(t) * 130, 45, Math.sin(t) * 130];
      cam.pos = eye;
      return { eye, target: [0, 6, 0], fov: 1.0 };
    }
    const target = followTarget();
    const speed = G.player.car ? Math.abs(G.player.car.speed) : 0;
    const wantDist = G.player.car ? 10 + speed * 0.08 : 6.5;
    const wantHeight = G.player.car ? 3.8 : 2.8;
    cam.dist = lerp(cam.dist, wantDist, Math.min(1, dt * 2));
    cam.height = lerp(cam.height, wantHeight, Math.min(1, dt * 2));
    cam.angle = lerpAngle(cam.angle, heading(), Math.min(1, dt * (G.player.car ? 3.5 : 5)));
    const back = 1;
    const eye = [
      target[0] + Math.sin(cam.angle) * cam.dist * back,
      target[1] + cam.height,
      target[2] + Math.cos(cam.angle) * cam.dist * back,
    ];
    // Never let the camera sink under the ground.
    eye[1] = Math.max(eye[1], 1.6);
    cam.pos[0] = lerp(cam.pos[0], eye[0], Math.min(1, dt * 6));
    cam.pos[1] = lerp(cam.pos[1], eye[1], Math.min(1, dt * 6));
    cam.pos[2] = lerp(cam.pos[2], eye[2], Math.min(1, dt * 6));
    // Speed stretches the field of view a touch.
    const fov = 1.05 + clamp(speed / 60, 0, 0.18);
    return { eye: cam.pos, target, fov };
  }

  function drawBeacon(ctx, pos, color, height = 30) {
    drawBox(ctx, matFromTRS([pos[0], height / 2, pos[2]], 0, [1.2, height, 1.2]), color);
    drawBox(ctx, matFromTRS([pos[0], 0.15, pos[2]], 0, [7, 0.3, 7]), color);
  }

  function draw(ctx) {
    const { gl } = ctx;
    const width = gl.canvas.clientWidth || 1280;
    const height = gl.canvas.clientHeight || 720;
    beginFrame(ctx, width, height, CFG.fogColor);
    setLighting(ctx, CFG.sunDir, CFG.fogColor, 90, 320);
    const camState = updateCamera(G.dt);
    let { eye } = camState;
    // Screen shake.
    if (G.shake > 0.01) {
      eye = [
        eye[0] + (Math.random() - 0.5) * G.shake,
        eye[1] + (Math.random() - 0.5) * G.shake * 0.6,
        eye[2] + (Math.random() - 0.5) * G.shake,
      ];
      G.shake = Math.max(0, G.shake - G.dt * 1.4);
    }
    const aspect = width / height;
    const proj = matPerspective(camState.fov, aspect, 0.1, 900);
    const view = matLookAt(eye, camState.target, [0, 1, 0]);
    setCamera(ctx, matMultiply(proj, view), eye);

    // Static world.
    const identity = matFromTRS([0, 0, 0], 0, 1);
    drawMesh(ctx, G.world.mesh, identity);
    drawMesh(ctx, G.city.mesh, identity);

    // Cars.
    for (const car of G.cars) {
      if (car.remove) continue;
      drawCar(ctx, car);
    }
    // Pedestrians (dead ones lie flat).
    for (const ped of G.peds) {
      if (ped.dead) {
        drawBox(ctx, matFromTRS([ped.pos[0], 0.25, ped.pos[2]], ped.angle, [0.6, 0.5, 1.8]), ped.shirt);
      } else {
        drawPed(ctx, ped);
      }
    }
    // Foot cops and gang enemies.
    for (const cop of G.police.footCops) {
      if (!cop.dead) drawPed(ctx, cop);
    }
    for (const e of G.enemies) {
      if (!e.dead) drawPed(ctx, e);
    }
    // NPCs + their floating markers.
    for (const n of G.npcs.npcs) {
      drawPed(ctx, { ...n, pos: n.pos, angle: n.angle, walkPhase: 0 });
      const bob = Math.sin(n.bobPhase) * 0.25;
      drawBox(ctx, matFromTRS([n.pos[0], 2.9 + bob, n.pos[2]], Math.PI / 4, [0.4, 0.4, 0.4]), [1, 0.85, 0.2]);
    }
    // Player on foot.
    const p = G.player;
    if (p.onFoot && !p.dead) {
      drawPed(ctx, {
        pos: p.pos, angle: p.angle, walkPhase: p.walkPhase || 0,
        shirt: [0.15, 0.7, 0.8], pants: [0.2, 0.2, 0.25],
      });
    }
    // Helicopter + spotlight pool on the ground.
    const heli = G.police.heli;
    if (heli) {
      drawHeli(ctx, heli);
      drawBox(ctx, matFromTRS([p.pos[0], 0.12, p.pos[2]], 0, [16, 0.2, 16]), [1, 0.95, 0.55]);
    }
    // Boats.
    for (const b of G.boats.boats) drawBoat(ctx, b);
    // Pickups: health cross / armor box, bobbing.
    for (const pk of G.combat.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(G.time * 2 + pk.pos[0]) * 0.25 + 1.1;
      if (pk.kind === 'health') {
        drawBox(ctx, matFromTRS([pk.pos[0], bob, pk.pos[2]], 0, [1.1, 1.1, 0.3]), [0.95, 0.95, 0.95]);
        drawBox(ctx, matFromTRS([pk.pos[0], bob, pk.pos[2]], 0, [0.35, 1.1, 0.4]), [0.2, 0.8, 0.3]);
        drawBox(ctx, matFromTRS([pk.pos[0], bob, pk.pos[2]], 0, [1.1, 0.35, 0.4]), [0.2, 0.8, 0.3]);
      } else {
        drawBox(ctx, matFromTRS([pk.pos[0], bob, pk.pos[2]], 0, [1.0, 1.2, 0.35]), [0.2, 0.4, 0.95]);
      }
    }
    // Mission objective beacon + next-mission marker.
    const st = G.missions.currentStage;
    if (st && st.pos) drawBeacon(ctx, st.pos, [1, 0.35, 0.2]);
    const next = G.missions.nextAvailable;
    if (next >= 0 && !G.missions.current) {
      drawBeacon(ctx, G.missions.list[next].startPos, [1, 0.85, 0.2], 22);
    }
    // Race gates.
    if (G.races.active) {
      const race = G.races.active;
      race.gates.forEach((g, i) => {
        const done = i < race.playerGate;
        drawBeacon(ctx, g, done ? [0.3, 0.9, 0.4] : [1, 0.6, 0.1], 14);
      });
    } else {
      // Idle race marker at the start line.
      drawBeacon(ctx, G.city.raceStart, [0.95, 0.95, 0.95], 12);
    }
    // Garage marker.
    drawBeacon(ctx, G.city.garagePos, [0.25, 0.85, 0.4], 12);
    // Particles on top of everything.
    G.particles.draw(ctx);
  }

  return { draw, cam };
}
