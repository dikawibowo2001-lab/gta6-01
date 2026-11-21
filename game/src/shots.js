// The four screenshot scenes. Each one stages the real game from a
// fixed seed, drives it for a fixed number of steps, paints once, and
// raises window.__shotReady so the capture script knows the frame is
// the finished one. Nothing here is faked: the chase is a real chase,
// the job-complete card is the real card.

import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createMinimapBase, drawHUD } from './hud.js';
import { createWorld, stepAttract, stepWorld } from './world.js';
import { completeMission, missionMarker, objectiveText, startMission } from './missions.js';
import { createCar } from './vehicles.js';
import { createEnemy } from './combat.js';

const STEP = 1 / 60;

function angleDiff(a, b) {
  return ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

// A straight-line driver for the driving scenes: hold the road east at
// full throttle, no turns, so the car is mid-city and moving at speed.
function makeStraightAutopilot(world, roadY) {
  return () => {
    const car = world.player.car;
    const idle = { move: { x: 0, y: 0 }, sprint: false, aimAngle: 0, shooting: false, throttle: 0, steer: 0, handbrake: false };
    if (!car) return idle;
    const targetAngle = Math.atan2(roadY - car.y, 400);
    const steer = Math.max(-1, Math.min(1, angleDiff(targetAngle, car.angle) * 2.5));
    return { ...idle, aimAngle: car.angle, throttle: 0.95, steer };
  };
}

function putPlayerInCar(world, car) {
  const player = world.player;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  car.role = 'player';
}

// Keep the shot's road empty ahead of the car so the drive reads as
// a drive, not a traffic jam. Cars elsewhere in the city stay put.
function clearRoadCorridor(world, y, x0, x1) {
  world.cars = world.cars.filter((c) => {
    if (c.role === 'player') return true;
    if (Math.abs(c.y - y) < 55 && c.x > x0 && c.x < x1) return false;
    return true;
  });
}
function spawnShotCar(world, x, y, type) {
  let sx = x;
  for (let tries = 0; tries < 12; tries += 1) {
    const blocked = world.cars.some((c) => Math.hypot(c.x - sx, c.y - y) < 90);
    if (!blocked) break;
    sx += 110;
  }
  const car = createCar(world.rng, sx, y, 0, type, 'player');
  world.cars.push(car);
  return car;
}

function paint(renderer, world, screen, minimapBase, canvas) {
  const marker = screen === SCREEN_PLAY ? missionMarker(world) : null;
  renderer.draw(world, screen, { menuIndex: 0, hasSave: false, marker });
  if (screen === SCREEN_PLAY) {
    drawHUD(canvas.getContext('2d'), world, renderer.view.w, renderer.view.h, minimapBase, marker, objectiveText(world));
  }
}

async function settle() {
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

export async function runShot(name, seed, renderer, audio) {
  const canvas = document.getElementById('game');
  audio.setMuted(true);
  const world = createWorld(seed, audio, null);
  world.viewW = renderer.view.w;
  world.viewH = renderer.view.h;
  const minimapBase = createMinimapBase(world.city);
  const noop = { move: { x: 0, y: 0 }, sprint: false, aimAngle: 0, shooting: false, throttle: 0, steer: 0, handbrake: false };

  if (name === 'title') {
    for (let i = 0; i < 360; i += 1) stepAttract(world, STEP);
    paint(renderer, world, SCREEN_TITLE, minimapBase, canvas);
  } else if (name === 'drive') {
    // Mara mid-delivery: a hot car on a downtown road, job 2 running.
    world.mission.index = 1;
    startMission(world, 1);
    world.briefing = null;
    const car = spawnShotCar(world, 1100, 920, 'sports');
    putPlayerInCar(world, car);
    clearRoadCorridor(world, 920, 600, 2700);
    const drive = makeStraightAutopilot(world, 920);
    for (let i = 0; i < 150; i += 1) stepWorld(world, drive(), {}, STEP);
    paint(renderer, world, SCREEN_PLAY, minimapBase, canvas);
  } else if (name === 'chase') {
    // The last getaway: three stars, three cruisers on her tail, job 4 live.
    // The getaway is already rolling at speed, so the shot catches the
    // pursuit mid-chase instead of mid-collision.
    world.mission.index = 3;
    startMission(world, 3);
    world.briefing = null;
    const car = spawnShotCar(world, 1100, 920, 'sports');
    car.speed = 550;
    putPlayerInCar(world, car);
    clearRoadCorridor(world, 920, 600, 2700);
    for (let i = 0; i < 3; i += 1) {
      const cruiser = createCar(world.rng, car.x - 350 - i * 100, car.y + (i === 1 ? -34 : i === 2 ? 34 : 0), 0, 'police', 'police');
      cruiser.angle = 0;
      cruiser.speed = 550;
      world.cars.push(cruiser);
    }
    const drive = makeStraightAutopilot(world, 920);
    for (let i = 0; i < 60; i += 1) stepWorld(world, drive(), {}, STEP);
    paint(renderer, world, SCREEN_PLAY, minimapBase, canvas);
  } else if (name === 'mission') {
    // Job one, done: the completion card over the garage, Juno nearby.
    const garage = world.city.landmarks.garage;
    world.player.x = garage.x;
    world.player.y = garage.y + 60;
    world.mission.index = 0;
    startMission(world, 0);
    completeMission(world);
    world.missionComplete.until = world.time + 999;
    world.briefing = null;
    world.banner = null;
    const rival = createEnemy(world.rng, garage.x - 140, garage.y - 80);
    world.enemies.push(rival);
    for (let i = 0; i < 90; i += 1) stepWorld(world, noop, {}, STEP);
    // Keep the card up after the steps.
    world.missionComplete.until = world.time + 999;
    paint(renderer, world, SCREEN_PLAY, minimapBase, canvas);
  } else {
    throw new Error(`Unknown shot: ${name}`);
  }

  await settle();
  window.__shotWorld = world;
  window.__shotReady = true;
}
