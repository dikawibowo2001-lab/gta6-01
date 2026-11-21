// Solmar Bay v4 — boot, game loop, save/load.
//
// main.js builds the shared game object G, wires every system into
// it, and runs the frame loop: read input, step the world, refresh
// the HUD, draw. The loop skips world updates while paused, on the
// title screen, or inside the garage shop (the render keeps going
// so the city stays alive behind the menus).

import { CFG } from './config.js';
import { makeRng } from './random.js';
import { clamp, lerpAngle } from './math3.js';
import { initGL } from './gl.js';
import { makeAudio } from './audio.js';
import { makeRadio } from './radio.js';
import { makeInput } from './input.js';
import { buildWorld } from './world.js';
import { buildCity, resolveCollisions } from './city.js';
import { makeVehicles } from './vehicles.js';
import { makeTraffic } from './traffic.js';
import { makePolice } from './police.js';
import { makeCombat } from './combat.js';
import { makeWeapons } from './weapons.js';
import { makeParticles } from './particles.js';
import { makeWrecks } from './wrecks.js';
import { makeBoats } from './boats.js';
import { makeMissions } from './missions.js';
import { makeRaces } from './races.js';
import { makeGarage } from './garage.js';
import { makeProgression } from './progression.js';
import { makeCrew } from './crew.js';
import { makeNpcs } from './npcs.js';
import { makeHud } from './hud.js';
import { makeRender } from './render.js';
import { applyShot } from './shots.js';

const SAVE_KEY = 'solmar-bay-save-v4';

const canvas = document.getElementById('game');
const glCtx = initGL(canvas);

const G = {
  time: 0,
  dt: 0,
  rng: makeRng('solmar-bay-v4'),
  shake: 0,
  inTitle: true,
  paused: false,
  shot: null,
  shotCam: null,
  cars: [],
  peds: [],
  enemies: [],
  player: {
    pos: [0, 0, 16],
    angle: 0,
    health: CFG.playerHealth,
    armor: 0,
    cash: 500,
    respect: 0,
    onFoot: true,
    car: null,
    boat: null,
    dead: false,
    walkPhase: 0,
  },
};

// --- systems (constructed in dependency order) ------------------------
G.audio = makeAudio();
G.radio = makeRadio(G.audio);
G.input = makeInput();
G.world = buildWorld(glCtx);
G.city = buildCity(glCtx, G.rng);
G.particles = makeParticles(G);
G.weapons = makeWeapons(G);
G.combat = makeCombat(G);
G.vehicles = makeVehicles(G);
G.traffic = makeTraffic(G);
G.police = makePolice(G);
G.wrecks = makeWrecks(G);
G.boats = makeBoats(G);
G.progression = makeProgression(G);
G.crew = makeCrew(G);
G.npcs = makeNpcs(G);
G.missions = makeMissions(G);
G.races = makeRaces(G);
G.garage = makeGarage(G);
G.hud = makeHud(G);
G.render = makeRender(G);

// --- save / load -------------------------------------------------------
function saveGame() {
  try {
    const data = {
      cash: G.player.cash,
      respect: G.player.respect,
      health: G.player.health,
      armor: G.player.armor,
      completed: [...G.missions.completed],
      garage: [...G.garage.owned],
      weapons: G.weapons.unlocked,
      ammo: G.weapons.ammo.filter((a) => Number.isFinite(a)),
      pos: G.player.pos,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // Private mode / no storage: the game still runs, it just won't persist.
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    G.player.cash = data.cash ?? 500;
    G.player.respect = data.respect ?? 0;
    G.player.health = data.health ?? CFG.playerHealth;
    G.player.armor = data.armor ?? 0;
    if (Array.isArray(data.pos)) G.player.pos = data.pos;
    if (Array.isArray(data.completed)) {
      for (const i of data.completed) G.missions.completed.add(i);
    }
    if (Array.isArray(data.garage)) {
      for (const id of data.garage) G.garage.owned.add(id);
    }
    if (Array.isArray(data.weapons)) {
      data.weapons.forEach((u, i) => { if (u) G.weapons.unlocked[i] = true; });
    }
  } catch (e) {
    // Corrupt save: start fresh.
  }
}
G.saveGame = saveGame;

// --- player on-foot movement -------------------------------------------
function updateOnFoot(dt) {
  const p = G.player;
  if (!p.onFoot || p.dead) return;
  const input = G.input;
  const camAngle = G.render.cam.angle;
  // Movement is relative to the camera: W walks away from it.
  let mx = 0;
  let mz = 0;
  if (input.throttle > 0) { mx += -Math.sin(camAngle); mz += -Math.cos(camAngle); }
  if (input.throttle < 0) { mx -= -Math.sin(camAngle); mz -= -Math.cos(camAngle); }
  if (input.steer > 0) { mx += -Math.cos(camAngle); mz += Math.sin(camAngle); }
  if (input.steer < 0) { mx -= -Math.cos(camAngle); mz -= Math.sin(camAngle); }
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    const speed = input.sprint ? CFG.runSpeed : CFG.walkSpeed;
    p.pos[0] += (mx / len) * speed * dt;
    p.pos[2] += (mz / len) * speed * dt;
    p.angle = lerpAngle(p.angle, Math.atan2(-mx / len, -mz / len), Math.min(1, dt * 10));
    p.walkPhase += dt * (input.sprint ? 13 : 8);
  }
  // Collisions + bounds.
  const [nx, nz] = resolveCollisions(G.city.colliders, p.pos[0], p.pos[2], 0.6);
  p.pos[0] = clamp(nx, CFG.oceanX + 2, CFG.cityHalf + 20);
  p.pos[2] = clamp(nz, -CFG.cityHalf - 20, CFG.cityHalf + 20);
  // Run over by a fast car.
  for (const car of G.cars) {
    if (car.dead || Math.abs(car.speed) < 6) continue;
    const d = Math.hypot(car.pos[0] - p.pos[0], car.pos[2] - p.pos[2]);
    if (d < 1.8) {
      G.combat.damagePlayer(12);
      p.pos[0] += (p.pos[0] - car.pos[0]) * 0.5;
      p.pos[2] += (p.pos[2] - car.pos[2]) * 0.5;
      G.shake = Math.max(G.shake, 0.3);
    }
  }
}

// --- flow control ---------------------------------------------------------
function startGame() {
  if (!G.inTitle) return;
  G.inTitle = false;
  G.hud.hideTitle();
  G.audio.resume();
  G.radio.start();
  G.hud.setObjective('Cari tanda ! di minimap untuk misi pertama — atau bebas jelajahi kota');
  G.hud.toast('Selamat datang di Solmar Bay, Mara!');
}
G.startGame = startGame;

function togglePause(force) {
  if (G.inTitle) return;
  const next = force !== undefined ? force : !G.paused;
  if (next === G.paused) return;
  G.paused = next;
  if (next) G.hud.showPause();
  else G.hud.hidePause();
}
G.togglePause = togglePause;

function updateGlobalKeys() {
  const input = G.input;
  if (G.inTitle) {
    if (input.wasPressed('Enter') || input.wasPressed('Space')) startGame();
    return;
  }
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (G.garage.open) G.garage.closeShop();
    else if (G.weapons.wheelOpen) G.hud.closeWheel();
    else togglePause();
  }
  if (input.wasPressed('KeyM')) {
    G.audio.setMuted(!G.audio.isMuted);
    G.hud.toast(G.audio.isMuted ? 'Suara mati' : 'Suara hidup');
  }
  if (G.paused || G.garage.open) return;
  if (input.wasPressed('KeyR')) G.radio.next();
  // Weapon wheel: hold Q/Tab, pick with 1-5 or click.
  const wheelKey = input.isDown('KeyQ') || input.isDown('Tab');
  if (wheelKey && !G.weapons.wheelOpen) G.hud.openWheel();
  if (!wheelKey && G.weapons.wheelOpen && !G.wheelLocked) G.hud.closeWheel();
  for (let i = 0; i < 5; i += 1) {
    if (input.wasPressed(`Digit${i + 1}`)) G.weapons.select(i);
  }
  // Mission start at the marker.
  if (input.wasPressed('KeyE')) {
    const idx = G.missions.nearestStartMarker();
    if (idx !== null && !G.npcs.nearest() && !G.boats.nearestBoat(G.player.pos, 5)) {
      G.missions.start(idx);
    }
  }
}

// --- boot -------------------------------------------------------------------
loadGame();
G.vehicles.spawnParked(10);
G.traffic.spawnInitial();
G.boats.spawnBoats();
G.hud.showTitle();
G.hud.setObjective('Tekan ENTER untuk bermain');

const shotParam = new URLSearchParams(window.location.search).get('shot');
if (shotParam) {
  applyShot(G, shotParam);
}

// Debug hook for the play-test harness (read-only state + actions).
window.__solmar = {
  G,
  version: 'v4',
  get ready() { return true; },
  get missionCount() { return G.missions.list.length; },
  startMission(i) { return G.missions.start(i); },
  setWanted(n) { G.police.setWanted(n); },
  giveCash(n) { G.player.cash += n; },
};

// --- main loop --------------------------------------------------------------
let last = performance.now();
let saveTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05) * (G.timeScale || 1);
  last = now;
  G.dt = dt;
  G.time += dt;

  updateGlobalKeys();
  G.radio.tick(dt);

  if (!G.paused && !G.inTitle && !G.garage.open && !G.shotFreeze) {
    updateOnFoot(dt);
    G.vehicles.update(dt);
    G.traffic.update(dt);
    G.police.update(dt);
    G.combat.update(dt);
    G.missions.update(dt);
    G.races.update(dt);
    G.crew.update(dt);
    G.npcs.update(dt);
    G.boats.update(dt);
    G.wrecks.update(dt);
    G.garage.update();
  } else if (G.garage.open) {
    G.garage.update();
  }
  G.particles.update(dt);
  G.hud.update();
  G.render.draw(glCtx);
  G.input.endFrame();

  saveTimer += dt;
  if (saveTimer > 30) {
    saveTimer = 0;
    saveGame();
  }
}

window.addEventListener('beforeunload', saveGame);
requestAnimationFrame(frame);
