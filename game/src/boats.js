// Solmar Bay v4 — speedboats.
//
// Three boats bob at the marina docks. Walk up to one and press E
// to climb aboard; the boat handles like a car with more slide, and
// throws a white wake behind it. Boats stay on the water — steer
// back to a dock and press E again to step ashore.

import { CFG } from './config.js';
import { clamp, v3DistXZ } from './math3.js';

const BOAT_COLORS = [
  [0.9, 0.9, 0.95], [0.2, 0.6, 0.9], [0.9, 0.3, 0.2],
];

export function makeBoats(G) {
  const boats = [];

  function spawnBoats() {
    const dock = G.city.dockPos;
    for (let i = 0; i < 3; i += 1) {
      boats.push({
        pos: [dock[0] - 6 - i * 3, 0, dock[2] + i * 12],
        angle: Math.PI / 2,
        speed: 0,
        color: BOAT_COLORS[i],
        driver: 'none',
        bobPhase: G.rng.range(0, 6),
      });
    }
  }

  function nearestBoat(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const b of boats) {
      const d = v3DistXZ(pos, b.pos);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  function board(boat) {
    const p = G.player;
    p.boat = boat;
    boat.driver = 'player';
    p.onFoot = false;
    p.pos = [boat.pos[0], 0, boat.pos[2]];
    p.angle = boat.angle;
    G.audio.play('click');
    G.hud.toast('Naik perahu — W gas, A/D belok, E turun');
  }

  function disembark() {
    const p = G.player;
    if (!p.boat) return;
    const boat = p.boat;
    boat.driver = 'none';
    boat.speed = 0;
    p.boat = null;
    p.onFoot = true;
    // Step onto the nearest shore: east if close to land, else the dock.
    p.pos = [Math.max(boat.pos[0] + 4, CFG.oceanX + 8), 0, boat.pos[2]];
    G.audio.play('click');
  }

  return {
    boats,
    spawnBoats,
    nearestBoat,
    board,
    disembark,
    update(dt) {
      const p = G.player;
      if (p.boat) {
        const boat = p.boat;
        const input = G.input;
        boat.speed += input.throttle * 10 * dt;
        boat.speed -= boat.speed * 0.5 * dt;
        boat.speed = clamp(boat.speed, -6, 30);
        if (Math.abs(boat.speed) > 0.5) {
          boat.angle += input.steer * 1.4 * dt * Math.sign(boat.speed);
        }
        boat.pos[0] += -Math.sin(boat.angle) * boat.speed * dt;
        boat.pos[2] += -Math.cos(boat.angle) * boat.speed * dt;
        // Stay on the water.
        boat.pos[0] = clamp(boat.pos[0], -280, CFG.oceanX + 4);
        boat.pos[2] = clamp(boat.pos[2], -190, 190);
        if (Math.abs(boat.speed) > 5 && G.rng.chance(dt * 20)) {
          G.particles.spawn('wake', [boat.pos[0], 0.2, boat.pos[2]]);
        }
        if (input.wasPressed('KeyE')) disembark();
      } else if (p.onFoot && G.input.wasPressed('KeyE')) {
        const boat = nearestBoat(p.pos, 5);
        if (boat) board(boat);
      }
      // Idle bobbing.
      for (const b of boats) {
        b.bobPhase += dt;
        b.pos[1] = Math.sin(b.bobPhase * 1.4) * 0.15;
      }
    },
  };
}
