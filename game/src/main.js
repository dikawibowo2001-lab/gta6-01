// Bootstraps Solmar Bay 3D: the WebGL context, the world, the
// renderer, the HUD, the input, the frame loop, and the screens
// (title / pause / help / busted). Exposes window.__game,
// window.__renderer, window.__hud, window.__input and
// window.__shotReady for the play-test and the screenshot capture.

import { World } from './world.js';
import { Renderer } from './render.js';
import { Engine } from './gl.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed')) || 7;
const shot = params.get('shot') || null;

window.__shotReady = false;
window.__shotError = null;

const canvas = document.getElementById('game');
const gl = canvas.getContext('webgl', {
  antialias: true,
  alpha: false,
  depth: true,
  powerPreference: 'high-performance',
});

if (!gl) {
  document.getElementById('gl-error').style.display = 'flex';
  window.__shotError = 'WebGL unavailable';
  throw new Error('WebGL unavailable');
}

// The city meshes carry more than 65k indices, so the draw calls use
// UNSIGNED_INT — this WebGL1 extension is what allows it (present in
// desktop Chrome). Without it, drawElements silently draws nothing.
const uintExt = gl.getExtension('OES_element_index_uint');
if (!uintExt) {
  document.getElementById('gl-error').style.display = 'flex';
  window.__shotError = 'OES_element_index_uint unavailable';
  throw new Error('OES_element_index_uint unavailable');
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
window.addEventListener('resize', resize);
resize();

const engine = new Engine(gl);
const world = new World(gl, seed);
const renderer = new Renderer(gl, world.city);
renderer.attach(engine);
const hudRoot = document.getElementById('hud');
const hud = new HUD(hudRoot, world.city);
const input = new Input(canvas);

window.__game = world;
window.__renderer = renderer;
window.__engine = engine;
window.__hud = hud;
window.__input = input;

// --- Screens ---------------------------------------------------------------
function showScreen(name) {
  hud.showScreen(name);
  if (name === 'titleScreen') world.screen = 'title';
  else if (name === 'pauseScreen') world.screen = 'pause';
  else if (name === 'helpScreen') world.screen = 'help';
  else if (name === 'bustedScreen') world.screen = 'busted';
  else if (name === null) world.screen = 'play';
}

hud.el.playBtn.addEventListener('click', () => {
  world.startGame();
  showScreen(null);
});
hud.el.helpBtn.addEventListener('click', () => showScreen('helpScreen'));
hud.el.resumeBtn.addEventListener('click', () => showScreen(null));
hud.el.pauseHelpBtn.addEventListener('click', () => showScreen('helpScreen'));
hud.el.helpBackBtn.addEventListener('click', () => {
  if (world.prevScreen === 'title') {
    showScreen('titleScreen');
  } else {
    showScreen(null);
    world.screen = 'play';
  }
});
hud.el.bustedBtn.addEventListener('click', () => {
  world.payFineAndContinue();
  showScreen(null);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && world.screen === 'title') {
    world.startGame();
    showScreen(null);
  }
  if ((e.code === 'KeyP' || e.code === 'Escape') && world.screen === 'play') {
    world.prevScreen = 'play';
    showScreen('pauseScreen');
  } else if ((e.code === 'KeyP' || e.code === 'Escape') && world.screen === 'pause') {
    showScreen(null);
  }
  if (e.code === 'KeyH' && world.screen === 'play') {
    world.prevScreen = 'play';
    showScreen('helpScreen');
  }
});

// --- Screenshot staging ----------------------------------------------------
let framesToReady = -1;
if (shot) {
  try {
    const staged = stageShot(shot, world, renderer);
    framesToReady = staged.frames;
    // The title shot keeps the title screen; the others play past it.
    if (shot === 'title') showScreen('titleScreen');
    else showScreen(null);
  } catch (err) {
    window.__shotError = String(err);
  }
}

// --- Frame loop --------------------------------------------------------------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  // Clamp dt to [0, 0.05]: a rAF timestamp can occasionally arrive a
  // fraction of a millisecond behind the previous one, and a negative
  // dt would run every timer in the game backwards.
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  try {
    world.update(dt, input, renderer);
  } catch (err) {
    // One bad frame must not freeze the game (or the screenshot flow):
    // record it visibly and keep the loop alive.
    window.__shotError = String(err);
    console.error(err);
  }
  try {
    renderer.draw(world, dt);
    hud.update(world);
  } catch (err) {
    window.__shotError = String(err);
    console.error(err);
  }
  // Keep the busted screen in sync with the world state.
  if (world.screen === 'busted') {
    hud.el.bustedSub.textContent = `The SBPD caught up with Mara. Fine: $${world.bustedFine || 0}.`;
    showScreen('bustedScreen');
  }
  if (framesToReady > 0) {
    framesToReady--;
    if (framesToReady === 0) window.__shotReady = true;
  }
  input.endFrame();
}
requestAnimationFrame(loop);

// The title screen is the default view (unless a shot staged past it).
if (!shot) showScreen('titleScreen');
