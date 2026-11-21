// The boot: screens, menus, the fixed-step loop, saving to
// localStorage, and the ?shot= mode that stages the four screenshots.
// Everything the player touches passes through here.

import { createAudio } from './audio.js';
import { ACTION_ENTER, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_HELP, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createMinimapBase, drawHUD } from './hud.js';
import { createWorld, respawnAfterBust, respawnAfterWasted, stepAttract, stepWorld } from './world.js';
import { missionMarker, objectiveText } from './missions.js';
import { runShot } from './shots.js';

const SAVE_KEY = 'solmar-bay-save-v1';
const STEP = 1 / 60;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || !Array.isArray(save.completed) || typeof save.cash !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function saveGame(world) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.cash,
      completed: world.mission.completed,
      stats: world.stats,
      savedAt: Date.now(),
    }));
  } catch {
    // Storage full or blocked: the game still runs, it just forgets.
  }
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  const seed = Number(params.get('seed')) || 7;

  const audio = createAudio();
  const renderer = createRenderer(canvas);
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());

  if (shotName) {
    await runShot(shotName, seed, renderer, audio);
    return;
  }

  const input = createInput(canvas);
  let save = loadSave();
  let world = createWorld((Math.random() * 1e9) | 0, audio, null);
  let minimapBase = createMinimapBase(world.city);
  let screen = SCREEN_TITLE;
  let previousScreen = SCREEN_TITLE;
  let menuIndex = 0;
  let savedMissionCount = 0;

  function syncView() {
    world.viewW = renderer.view.w;
    world.viewH = renderer.view.h;
  }
  syncView();
  window.addEventListener('resize', syncView);

  function titleItems() {
    return save ? ['New Game', 'Continue', 'How to Play'] : ['New Game', 'How to Play'];
  }

  function pauseItems() {
    return ['Resume', 'Restart Run', 'How to Play', 'Quit to Title'];
  }

  function startFresh() {
    world = createWorld((Math.random() * 1e9) | 0, audio, null);
    minimapBase = createMinimapBase(world.city);
    syncView();
    savedMissionCount = 0;
    screen = SCREEN_PLAY;
    announce('New game started. Drive to the Hideout to meet Reyes.');
  }

  function startContinue() {
    save = loadSave();
    world = createWorld((Math.random() * 1e9) | 0, audio, save);
    minimapBase = createMinimapBase(world.city);
    syncView();
    savedMissionCount = world.mission.completed.filter(Boolean).length;
    screen = SCREEN_PLAY;
    announce('Welcome back to Solmar Bay.');
  }

  function confirmTitle() {
    const item = titleItems()[menuIndex];
    if (item === 'New Game') startFresh();
    else if (item === 'Continue') startContinue();
    else if (item === 'How to Play') {
      previousScreen = SCREEN_TITLE;
      screen = SCREEN_HELP;
    }
  }

  function confirmPause() {
    const item = pauseItems()[menuIndex];
    if (item === 'Resume') screen = SCREEN_PLAY;
    else if (item === 'Restart Run') {
      const keep = loadSave();
      world = createWorld((Math.random() * 1e9) | 0, audio, keep);
      minimapBase = createMinimapBase(world.city);
      syncView();
      screen = SCREEN_PLAY;
    } else if (item === 'How to Play') {
      previousScreen = SCREEN_PAUSED;
      screen = SCREEN_HELP;
    } else if (item === 'Quit to Title') {
      saveGame(world);
      save = loadSave();
      menuIndex = 0;
      screen = SCREEN_TITLE;
    }
  }

  // Menu item under the mouse, by the row layout the renderer paints.
  function menuIndexAt(y, startY, count) {
    const row = Math.floor((y - (startY - 28)) / 44);
    if (row < 0 || row >= count) return -1;
    return row;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'm' || event.key === 'M') {
      audio.setMuted(!audio.isMuted());
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (event.key === 'ArrowUp' || event.key === 'w') {
        menuIndex = (menuIndex + titleItems().length - 1) % titleItems().length;
      } else if (event.key === 'ArrowDown' || event.key === 's') {
        menuIndex = (menuIndex + 1) % titleItems().length;
      } else if (event.key === 'Enter' || event.key === ' ') {
        confirmTitle();
      } else if (event.key === 'h' || event.key === 'H') {
        previousScreen = SCREEN_TITLE;
        screen = SCREEN_HELP;
      }
    } else if (screen === SCREEN_PAUSED) {
      if (event.key === 'ArrowUp' || event.key === 'w') {
        menuIndex = (menuIndex + pauseItems().length - 1) % pauseItems().length;
      } else if (event.key === 'ArrowDown' || event.key === 's') {
        menuIndex = (menuIndex + 1) % pauseItems().length;
      } else if (event.key === 'Enter' || event.key === ' ') {
        confirmPause();
      } else if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_HELP) {
      if (event.key === 'h' || event.key === 'H' || event.key === 'Escape' || event.key === 'Enter') {
        screen = previousScreen;
        menuIndex = 0;
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (event.key === 'Enter' || event.key === ' ') {
        saveGame(world);
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_PLAY) {
      if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
        menuIndex = 0;
        screen = SCREEN_PAUSED;
      } else if (event.key === 'h' || event.key === 'H') {
        previousScreen = SCREEN_PLAY;
        screen = SCREEN_HELP;
      } else if (event.key === 'r' || event.key === 'R') {
        const keep = loadSave();
        world = createWorld((Math.random() * 1e9) | 0, audio, keep);
        minimapBase = createMinimapBase(world.city);
        syncView();
      }
    }
  });

  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    if (screen === SCREEN_TITLE) {
      const row = menuIndexAt(y, 330, titleItems().length);
      if (row >= 0) {
        menuIndex = row;
        confirmTitle();
      }
    } else if (screen === SCREEN_PAUSED) {
      const row = menuIndexAt(y, 280, pauseItems().length);
      if (row >= 0) {
        menuIndex = row;
        confirmPause();
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      menuIndex = 0;
      screen = SCREEN_PAUSED;
    }
  });
  window.addEventListener('beforeunload', () => {
    if (screen === SCREEN_PLAY) saveGame(world);
  });

  // The debug hook the play-test uses to inspect the live game.
  window.__solmar = {
    getWorld: () => world,
    getScreen: () => screen,
    loadSave,
  };

  let last = performance.now();
  let accumulator = 0;
  let queuedEnter = false;

  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    const { actions } = input.takeActions();
    if (actions & ACTION_ENTER) queuedEnter = true;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      accumulator -= STEP;
      steps += 1;
      if (screen === SCREEN_TITLE) {
        stepAttract(world, STEP);
      } else if (screen === SCREEN_PLAY) {
        const player = world.player;
        const mouse = input.mouse;
        const aimAngle = player.car
          ? player.car.angle
          : Math.atan2(mouse.y - (player.y - world.camera.y), mouse.x - (player.x - world.camera.x));
        const move = input.moveVector();
        // E does the most useful thing where Mara stands: at the Hideout
        // it starts the next job, next to a car it opens the door.
        let startJob = false;
        let enter = false;
        if (queuedEnter) {
          queuedEnter = false;
          const marker = missionMarker(world);
          const distToMarker = marker
            ? Math.hypot(player.x - marker.x, player.y - marker.y)
            : Infinity;
          const carNear = !player.car && world.cars.some((c) => !c.dead
            && Math.hypot(c.x - player.x, c.y - player.y) < 64);
          if (player.car) enter = true;
          else if (world.mission.state === 'idle' && distToMarker < 45) startJob = true;
          else if (carNear) enter = true;
          else if (world.mission.state === 'idle' && distToMarker < 90) startJob = true;
          else enter = true;
        }
        const controls = {
          move,
          sprint: input.sprinting(),
          aimAngle,
          shooting: mouse.down,
          throttle: -move.y,
          steer: move.x,
          handbrake: input.handbrake(),
        };
        const result = stepWorld(world, controls, { enter, start: startJob }, STEP);
        if (result === 'busted') {
          respawnAfterBust(world);
          screen = SCREEN_BUSTED;
          announce('Busted by Solmar PD.');
        } else if (result === 'wasted') {
          respawnAfterWasted(world);
          screen = SCREEN_WASTED;
          announce('Mara went down. Bay General patched her up.');
        }
        const doneCount = world.mission.completed.filter(Boolean).length;
        if (doneCount > savedMissionCount) {
          savedMissionCount = doneCount;
          saveGame(world);
        }
      }
    }
    const marker = screen === SCREEN_PLAY ? missionMarker(world) : null;
    renderer.draw(world, screen, {
      menuIndex,
      hasSave: Boolean(save),
      marker,
    });
    if (screen === SCREEN_PLAY) {
      drawHUD(canvas.getContext('2d'), world, renderer.view.w, renderer.view.h, minimapBase, marker, objectiveText(world));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
