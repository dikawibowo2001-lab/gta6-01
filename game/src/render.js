// The renderer: cameras, meshes for everything that moves, and the
// draw pass. Three cameras — a slow downtown orbit for the title, a
// chase cam behind the car, and an over-shoulder cam on foot — and one
// mesh per car, walker and helicopter, built once and drawn with a
// model matrix each frame.
//
// CAMERA + HELICOPTER: the chase cam looks at a point a little above
// the car's roof, and while the helicopter is up it pitches up further
// (the look target rises), so the heli — which holds a low slot ahead
// of the player — stays inside the frame with its spotlight cone and
// the bright pool it throws on the road.
//
// SHOT FRAMING: the staged chase screenshot pins the chase cam instead
// (renderer.shotCam, set by shots.js): exact position, no damping lag,
// so the player's car sits large in the lower-center frame AND the
// helicopter stays in the upper frame at once. Gameplay never sets it.

import { Builder } from './gl.js';
import {
  mat4Identity, mat4Multiply, mat4Perspective, mat4LookAt, mat4TRS,
  mat4Translate, mat4RotateY, mat4RotateX, mat4Scale, damp, angleLerp, clamp,
} from './math3.js';
import { PALETTE, WORLD } from './config.js';

const FOV = (62 * Math.PI) / 180;

export class Renderer {
  constructor(gl, city) {
    this.gl = gl;
    this.city = city;
    this.engine = null; // set by main.js (the Engine instance)
    this.carMeshes = new Map(); // "type|r,g,b" -> Mesh
    this.walkerMeshes = new Map(); // "shirt|pants|skin|role" -> Mesh
    this.heliBody = null;
    this.heliRotor = null;
    this.spotCone = null;
    this.poolDisc = null;
    this.markerMesh = null;
    this.pickupMeshes = {};
    this.camPos = [0, 30, 60];
    this.camLook = [0, 0, 0];
    this.camYaw = 0;
    this.orbitT = 0;
    this.shotCam = null; // pinned chase-cam framing for a staged shot
    this.built = false;
  }

  attach(engine) {
    this.engine = engine;
    this.buildShared();
  }

  buildShared() {
    const gl = this.gl;
    // Helicopter body: dark fuselage, glass nose, tail boom, skids.
    const hb = new Builder(true);
    hb.box(0, 0, 0, 2.2, 1.8, 4.6, [0.08, 0.12, 0.2]);
    hb.box(0, 0.2, 2.2, 1.8, 1.2, 1.2, [0.3, 0.5, 0.65]);
    hb.box(0, 0.3, -3.4, 0.7, 0.7, 3.4, [0.08, 0.12, 0.2]);
    hb.box(0, 0.9, -4.8, 0.25, 1.4, 0.9, [0.08, 0.12, 0.2]);
    hb.box(0, -1.1, 0.8, 2.6, 0.25, 0.25, [0.25, 0.25, 0.28]);
    hb.box(0, -1.1, -1.2, 2.6, 0.25, 0.25, [0.25, 0.25, 0.28]);
    hb.box(0, 1.1, 0, 0.5, 0.5, 0.5, [0.2, 0.2, 0.22]);
    // Searchlight housing under the nose + red beacon.
    hb.box(0.7, -0.8, 1.8, 0.6, 0.6, 0.6, [0.9, 0.9, 0.85], 1);
    hb.box(0, 1.5, -1, 0.4, 0.3, 0.4, [1, 0.15, 0.1], 1);
    this.heliBody = hb.finish(gl);
    // Main rotor: two long blades.
    const hr = new Builder(true);
    hr.box(0, 0, 0, 11, 0.12, 0.5, [0.15, 0.15, 0.16]);
    hr.box(0, 0, 0, 0.5, 0.12, 11, [0.15, 0.15, 0.16]);
    this.heliRotor = hr.finish(gl);
    // Spotlight cone (unit height/radius, scaled at draw time).
    const sc = new Builder(false);
    sc.coneDown(0, 0, 0, 1, 1, [1.0, 0.95, 0.7], 14);
    this.spotCone = sc.finish(gl);
    const pd = new Builder(false);
    pd.disc(0, 0, 0, 1, [1.0, 0.92, 0.6], 20);
    this.poolDisc = pd.finish(gl);
    // Mission marker: a tall beacon column.
    const mk = new Builder(false);
    mk.cylinder(0, 8, 0, 1.1, 16, [1.0, 0.82, 0.25], 10);
    mk.disc(0, 0.25, 0, 4.5, [1.0, 0.82, 0.25], 20);
    this.markerMesh = mk.finish(gl);
    // Pickups: health (white box + red cross bars), armour (blue),
    // cash (green) — small floating cubes.
    const hp = new Builder(false);
    hp.box(0, 0, 0, 1.6, 1.6, 1.6, [0.95, 0.95, 0.95]);
    hp.box(0, 0, 0, 1.7, 0.6, 0.6, [0.9, 0.15, 0.15]);
    hp.box(0, 0, 0, 0.6, 1.7, 0.6, [0.9, 0.15, 0.15]);
    this.pickupMeshes.health = hp.finish(gl);
    const ar = new Builder(false);
    ar.box(0, 0, 0, 1.6, 1.6, 1.6, [0.25, 0.5, 0.95]);
    ar.box(0, 0, 0, 1.7, 0.5, 0.5, [0.7, 0.85, 1.0]);
    this.pickupMeshes.armour = ar.finish(gl);
    const ca = new Builder(false);
    ca.box(0, 0, 0, 1.8, 1.1, 1.1, [0.25, 0.8, 0.3]);
    ca.box(0, 0, 0, 1.2, 1.2, 1.2, [0.85, 0.95, 0.4]);
    this.pickupMeshes.cash = ca.finish(gl);
    this.built = true;
  }

  carMesh(car) {
    const key = `${car.type}|${car.color.join(',')}`;
    let m = this.carMeshes.get(key);
    if (m) return m;
    const b = new Builder(true);
    const c = car.color;
    const dark = [0.1, 0.12, 0.16];
    const glass = [0.2, 0.35, 0.45];
    if (car.type === 'truck') {
      b.box(0, 1.1, 0.8, 2.4, 1.8, 2.2, c);
      b.box(0, 2.0, -1.6, 2.6, 2.6, 5.4, [0.85, 0.85, 0.86]);
      b.box(0, 1.5, 2.0, 2.2, 0.9, 0.3, glass);
    } else {
      const low = car.type === 'sports';
      const bodyH = car.type === 'suv' ? 1.5 : low ? 0.9 : 1.1;
      const bodyY = car.type === 'suv' ? 1.0 : 0.85;
      const len = car.type === 'suv' ? 4.8 : 4.4;
      b.box(0, bodyY, 0, 2.1, bodyH, len, c);
      b.box(0, bodyY + bodyH / 2 + 0.45, -0.2, 1.8, 0.9, len * 0.5, glass);
      b.box(0, bodyY + bodyH / 2 + 0.9, -0.2, 1.7, 0.18, len * 0.48, c);
      if (car.type === 'sports') {
        b.box(0, bodyY + 0.75, -len / 2 - 0.1, 2.0, 0.14, 0.5, [0.1, 0.1, 0.11]); // spoiler
      }
      if (car.type === 'taxi') {
        b.box(0, bodyY + bodyH / 2 + 1.1, -0.2, 1.0, 0.35, 0.5, [1.0, 0.85, 0.2]);
      }
      if (car.type === 'police') {
        // Light bar: the two halves flash red/blue via the hot flag.
        b.box(-0.55, bodyY + bodyH / 2 + 1.05, -0.2, 0.8, 0.3, 0.5, [1, 0.1, 0.1], 1);
        b.box(0.55, bodyY + bodyH / 2 + 1.05, -0.2, 0.8, 0.3, 0.5, [0.2, 0.4, 1], 1);
        b.box(0, bodyY + 0.1, 0, 2.14, 0.5, len * 0.9, [0.9, 0.9, 0.92]); // white doors band
      }
      // Headlights + taillights.
      b.box(-0.7, bodyY, len / 2 + 0.02, 0.5, 0.3, 0.08, [1.0, 0.95, 0.7], 1);
      b.box(0.7, bodyY, len / 2 + 0.02, 0.5, 0.3, 0.08, [1.0, 0.95, 0.7], 1);
      b.box(-0.7, bodyY, -len / 2 - 0.02, 0.5, 0.3, 0.08, [0.9, 0.1, 0.1]);
      b.box(0.7, bodyY, -len / 2 - 0.02, 0.5, 0.3, 0.08, [0.9, 0.1, 0.1]);
    }
    // Wheels.
    const wy = 0.45;
    const wz = car.type === 'truck' ? 2.6 : 1.5;
    for (const [wx, wz2] of [[-1.0, wz], [1.0, wz], [-1.0, -wz], [1.0, -wz]]) {
      b.cylinder(wx, wy, wz2, 0.45, 0.35, dark, 8);
    }
    m = b.finish(this.gl);
    this.carMeshes.set(key, m);
    return m;
  }

  walkerMesh(w) {
    const key = `${w.role}|${w.shirt.join(',')}|${w.pants.join(',')}|${w.skin.join(',')}`;
    let m = this.walkerMeshes.get(key);
    if (m) return m;
    const b = new Builder(true);
    const skin = w.skin;
    const shirt = w.shirt;
    const pants = w.pants;
    // Legs.
    b.box(-0.22, 0.5, 0, 0.34, 1.0, 0.4, pants);
    b.box(0.22, 0.5, 0, 0.34, 1.0, 0.4, pants);
    // Torso.
    b.box(0, 1.45, 0, 0.85, 0.95, 0.5, shirt);
    // Arms.
    b.box(-0.58, 1.45, 0, 0.28, 0.9, 0.34, shirt);
    b.box(0.58, 1.45, 0, 0.28, 0.9, 0.34, shirt);
    // Head + hair/hat.
    b.box(0, 2.2, 0, 0.55, 0.55, 0.5, skin);
    if (w.role === 'cop') {
      b.box(0, 2.5, 0, 0.6, 0.18, 0.55, [0.08, 0.1, 0.25]);
      b.box(0, 2.42, 0.3, 0.5, 0.08, 0.25, [0.08, 0.1, 0.25]);
    } else if (w.role === 'rival') {
      b.box(0, 2.52, 0, 0.58, 0.22, 0.52, [0.7, 0.1, 0.15]);
    } else {
      b.box(0, 2.52, 0, 0.58, 0.2, 0.52, [0.25, 0.18, 0.12]);
    }
    // Mara gets her red jacket stripe; rivals get a red bandana strip.
    if (w.role === 'player') {
      b.box(0, 1.7, 0.26, 0.86, 0.25, 0.06, [0.9, 0.15, 0.2]);
    }
    m = b.finish(this.gl);
    this.walkerMeshes.set(key, m);
    return m;
  }

  // Where the camera sits this frame, per screen and state.
  updateCamera(world, dt) {
    const p = world.player;
    if (world.screen === 'title') {
      this.orbitT += dt * 0.06;
      const r = 150;
      const cx = Math.sin(this.orbitT) * r;
      const cz = Math.cos(this.orbitT) * r;
      this.camPos = [cx, 42, cz];
      this.camLook = [0, 18, 0];
      return;
    }
    const car = p.car;
    const heliUp = world.police.heli.active;
    if (car) {
      if (this.shotCam) {
        // Pinned shot framing: exact position every frame, no damping
        // lag, so the car and the helicopter share one 1280x720 frame.
        const f = this.shotCam;
        const behind = car.heading + Math.PI;
        this.camPos = [
          car.x + Math.sin(behind) * f.back,
          f.camY,
          car.z + Math.cos(behind) * f.back,
        ];
        this.camLook = [
          car.x + Math.sin(car.heading) * f.lookAhead,
          f.lookY,
          car.z + Math.cos(car.heading) * f.lookAhead,
        ];
        return;
      }
      // Chase cam: behind the car, a little high, looking ahead and —
      // while the heli is up — pitched up so the helicopter is in frame.
      const back = 10;
      const behind = car.heading + Math.PI;
      const tx = car.x + Math.sin(behind) * back;
      const tz = car.z + Math.cos(behind) * back;
      const wantY = 4.6 + Math.abs(car.speed) * 0.012;
      this.camPos[0] = damp(this.camPos[0], tx, 7, dt);
      this.camPos[1] = damp(this.camPos[1], wantY, 7, dt);
      this.camPos[2] = damp(this.camPos[2], tz, 7, dt);
      const lookY = heliUp ? 7.5 : 4.6;
      const lookAhead = 16;
      this.camLook = [
        car.x + Math.sin(car.heading) * lookAhead,
        damp(this.camLook[1], lookY, 4, dt),
        car.z + Math.cos(car.heading) * lookAhead,
      ];
    } else {
      // Over-shoulder on foot: behind Mara, mouse-steered yaw.
      const yaw = world.camYaw;
      const dist = 6.5;
      const tx = p.x - Math.sin(yaw) * dist;
      const tz = p.z - Math.cos(yaw) * dist;
      this.camPos[0] = damp(this.camPos[0], tx, 10, dt);
      this.camPos[1] = damp(this.camPos[1], 3.4, 10, dt);
      this.camPos[2] = damp(this.camPos[2], tz, 10, dt);
      this.camLook = [p.x + Math.sin(yaw) * 8, 1.6, p.z + Math.cos(yaw) * 8];
    }
  }

  draw(world, dt) {
    const gl = this.gl;
    const engine = this.engine;
    const canvas = gl.canvas;
    const aspect = canvas.width / Math.max(1, canvas.height);
    this.updateCamera(world, dt);
    engine.setScene(PALETTE, this.camPos);
    engine.viewport(canvas.width, canvas.height);
    engine.clear();

    const proj = mat4Perspective(FOV, aspect, 0.1, 1200);
    const view = mat4LookAt(this.camPos, this.camLook, [0, 1, 0]);
    const vp = mat4Multiply(proj, view);
    const identity = mat4Identity();

    // Sun disc position on screen: project the sun direction.
    const sunScreen = this.sunScreenPos(proj, view);
    engine.drawSky(sunScreen);

    // Static city.
    this.city.litMesh.draw(engine, identity, vp);
    this.city.plainMesh.draw(engine, identity, vp);

    // Mission marker beacon.
    const marker = world.missions.markerPos();
    if (marker && world.screen === 'play') {
      const pulse = 0.75 + Math.sin(world.time * 3) * 0.25;
      engine.plainAlpha = pulse;
      const mm = mat4Translate(marker[0], 0, marker[1]);
      this.markerMesh.draw(engine, mm, vp);
      engine.plainAlpha = 1;
    }

    // Pickups: spin + bob.
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      const mesh = this.pickupMeshes[pk.kind];
      if (!mesh) continue;
      const bob = 1.6 + Math.sin(world.time * 2 + pk.x) * 0.3;
      const m = mat4Multiply(mat4Translate(pk.x, bob, pk.z), mat4RotateY(world.time * 1.5));
      mesh.draw(engine, m, vp);
    }

    // Cars: traffic, parked, cruisers, roadblocks, rivals.
    const allCars = [
      ...world.traffic.cars,
      ...world.parked,
      ...world.police.cruisers,
      ...world.rivalCars,
    ];
    const seen = new Set();
    for (const car of allCars) {
      if (seen.has(car.id)) continue;
      seen.add(car.id);
      if (car === world.player.car && world.player.inCar) {
        // The player's car still draws (chase cam sees it).
      }
      const mesh = this.carMesh(car);
      const tilt = car.steer * 0.06 * Math.min(1, Math.abs(car.speed) / 12);
      let model = mat4TRS(car.x, 0, car.z, car.heading, 1, 1, 1);
      model = mat4Multiply(model, mat4RotateX(tilt));
      // Police light bar flash: alternate the hot colour by siren phase.
      if (car.type === 'police') {
        engine.flashColor = Math.sin(car.sirenPhase) > 0 ? [1, 0.12, 0.1] : [0.2, 0.4, 1];
      }
      mesh.draw(engine, model, vp);
    }
    engine.flashColor = [1, 0.2, 0.1];

    // Walkers: player (when on foot), peds, cops, rivals.
    const walkers = [];
    if (!world.player.inCar) walkers.push(world.player);
    for (const p of world.peds) if (p.alive) walkers.push(p);
    for (const c of world.police.cops) if (c.alive) walkers.push(c);
    for (const r of world.rivals) if (r.alive) walkers.push(r);
    for (const w of walkers) {
      const mesh = this.walkerMesh(w);
      const bob = w.moving ? Math.abs(Math.sin(w.walkPhase)) * 0.12 : 0;
      const model = mat4TRS(w.x, bob, w.z, w.heading, 1, 1, 1);
      mesh.draw(engine, model, vp);
    }

    // Helicopter + spotlight.
    const heli = world.police.heli;
    if (heli.active) {
      const bodyModel = mat4TRS(heli.x, heli.y, heli.z, heli.heading, 1, 1, 1);
      this.heliBody.draw(engine, bodyModel, vp);
      const rotorModel = mat4Multiply(bodyModel, mat4Multiply(mat4Translate(0, 1.35, 0), mat4RotateY(heli.rotor)));
      this.heliRotor.draw(engine, rotorModel, vp);
      // Spotlight cone: apex at the heli, base on the ground at the
      // tracked pool position.
      const sx = heli.spotTarget[0];
      const sz = heli.spotTarget[1];
      const height = heli.y;
      const coneModel = mat4Multiply(
        mat4Translate((heli.x + sx) / 2, height / 2, (heli.z + sz) / 2),
        mat4Scale(7, height, 7),
      );
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);
      engine.plainAlpha = 0.28;
      this.spotCone.draw(engine, coneModel, vp);
      engine.plainAlpha = 0.55;
      const poolModel = mat4Multiply(mat4Translate(sx, 0.35, sz), mat4Scale(7, 1, 7));
      this.poolDisc.draw(engine, poolModel, vp);
      engine.plainAlpha = 1;
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
    }

    // Particles.
    world.particles.rebuild();
    if (world.particles.mesh) {
      world.particles.mesh.draw(engine, identity, vp);
    }
  }

  // Project the sun direction to a 0..1 screen position for the sky dome.
  sunScreenPos(proj, view) {
    const dir = PALETTE.sunDir;
    const eye = this.camPos;
    const far = [eye[0] + dir[0] * 100, eye[1] + dir[1] * 100, eye[2] + dir[2] * 100];
    const m = mat4Multiply(proj, view);
    const x = m[0] * far[0] + m[4] * far[1] + m[8] * far[2] + m[12];
    const y = m[1] * far[0] + m[5] * far[1] + m[9] * far[2] + m[13];
    const w = m[3] * far[0] + m[7] * far[1] + m[11] * far[2] + m[15];
    if (w <= 0.01) return [0.5, 0.5];
    return [clamp(x / w * 0.5 + 0.5, 0, 1), clamp(y / w * 0.5 + 0.5, 0, 1)];
  }
}
