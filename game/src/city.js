// Solmar Bay v4 — the city itself: buildings, palms, port, marina.
//
// Buildings fill the blocks between roads, each a seeded box with a
// pastel facade, a darker roof slab and sometimes a neon sign. The
// port occupies the south-east corner (cranes + containers), the
// marina sits on the south-west shore, and a park breaks up the
// middle. All of it merges into one static mesh; the builder also
// returns collision boxes and the named places missions need.

import { CFG } from './config.js';
import { boxGeo, cylGeo, makeMesh, mergeGeos, quadGeo } from './gl.js';
import { roadLines } from './world.js';

const FACADES = [
  [0.92, 0.82, 0.72], [0.85, 0.78, 0.70], [0.78, 0.84, 0.88],
  [0.94, 0.88, 0.78], [0.82, 0.74, 0.66], [0.88, 0.80, 0.82],
  [0.75, 0.80, 0.78], [0.90, 0.76, 0.66],
];
const NEON = [
  [1.0, 0.25, 0.55], [0.25, 0.9, 1.0], [1.0, 0.8, 0.2],
  [0.6, 0.3, 1.0], [0.3, 1.0, 0.5],
];
const LEAF = [0.25, 0.55, 0.25];
const TRUNK = [0.45, 0.32, 0.2];

export function buildCity(ctx, rng) {
  const parts = [];
  const colliders = [];
  const lines = roadLines();

  // --- buildings: one or two towers per block -----------------------
  let placed = 0;
  for (let ix = 0; ix < lines.length - 1 && placed < CFG.buildingCount; ix += 1) {
    for (let iz = 0; iz < lines.length - 1 && placed < CFG.buildingCount; iz += 1) {
      const x0 = lines[ix] + CFG.roadWidth / 2 + 2;
      const x1 = lines[ix + 1] - CFG.roadWidth / 2 - 2;
      const z0 = lines[iz] + CFG.roadWidth / 2 + 2;
      const z1 = lines[iz + 1] - CFG.roadWidth / 2 - 2;
      // Skip the park block and the marina strip.
      if (ix === 4 && iz === 4) continue;
      if (ix === 0 && iz >= 7) continue;
      const cx = (x0 + x1) / 2 + rng.range(-2, 2);
      const cz = (z0 + z1) / 2 + rng.range(-2, 2);
      const w = rng.range(10, x1 - x0 - 2);
      const d = rng.range(10, z1 - z0 - 2);
      const h = rng.range(7, 38);
      const facade = rng.pick(FACADES);
      parts.push(boxGeo(w, h, d, facade, [cx, h / 2, cz]));
      // Roof slab + the occasional rooftop unit.
      parts.push(boxGeo(w * 0.9, 0.8, d * 0.9, [0.45, 0.45, 0.48], [cx, h + 0.4, cz]));
      if (rng.chance(0.4)) {
        parts.push(boxGeo(3, 2.5, 3, [0.6, 0.6, 0.62], [cx + w * 0.2, h + 1.6, cz - d * 0.15]));
      }
      // Neon sign on one face for a third of the buildings.
      if (rng.chance(0.33)) {
        const neon = rng.pick(NEON);
        parts.push(boxGeo(0.4, rng.range(2, 5), rng.range(4, 8), neon, [cx + w / 2 + 0.3, h * 0.6, cz]));
      }
      // Window strips: darker bands wrapping the tower.
      const floors = Math.floor(h / 4);
      for (let f = 1; f < floors; f += 1) {
        parts.push(boxGeo(w + 0.2, 0.7, d + 0.2, [0.25, 0.32, 0.42], [cx, f * 4, cz]));
      }
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      placed += 1;
    }
  }

  // --- palms along the beach and the park ---------------------------
  function palm(x, z, s) {
    parts.push(cylGeo(0.25 * s, 0.35 * s, 7 * s, 6, TRUNK, [x, 3.5 * s, z]));
    const top = 7 * s;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      parts.push(boxGeo(4.5 * s, 0.15, 1.1 * s, LEAF, [
        x + Math.cos(a) * 1.8 * s, top + 0.2, z + Math.sin(a) * 1.8 * s,
      ]));
    }
  }
  for (let i = 0; i < CFG.palmCount; i += 1) {
    const beachSide = rng.chance(0.6);
    const x = beachSide ? rng.range(-148, -138) : rng.range(-24, 24);
    const z = beachSide ? rng.range(-150, 150) : rng.range(-24, 24);
    palm(x, z, rng.range(0.8, 1.3));
  }

  // --- park: lawn, trees, benches -----------------------------------
  parts.push(quadGeo(28, 28, [0.35, 0.65, 0.3], 0.03, [0, 0, 0]));
  for (let i = 0; i < CFG.treeCount; i += 1) {
    const x = rng.range(-140, 140);
    const z = rng.range(-140, 140);
    if (Math.abs(x % CFG.blockSize) < 7 || Math.abs(z % CFG.blockSize) < 7) continue;
    parts.push(cylGeo(0.3, 0.4, 3, 6, TRUNK, [x, 1.5, z]));
    parts.push(boxGeo(3.5, 3.5, 3.5, LEAF, [x, 4.5, z]));
  }

  // --- port cranes + containers (south-east) ------------------------
  function crane(x, z) {
    parts.push(boxGeo(2, 22, 2, [0.9, 0.55, 0.2], [x - 5, 11, z]));
    parts.push(boxGeo(2, 22, 2, [0.9, 0.55, 0.2], [x + 5, 11, z]));
    parts.push(boxGeo(16, 2, 2, [0.9, 0.55, 0.2], [x, 22, z]));
    parts.push(boxGeo(1, 6, 1, [0.3, 0.3, 0.3], [x + 4, 18, z]));
    parts.push(boxGeo(4, 2.5, 2.5, [0.2, 0.5, 0.8], [x + 4, 13.5, z]));
  }
  crane(128, 128);
  crane(128, 96);
  const containerColors = [[0.8, 0.3, 0.2], [0.2, 0.5, 0.8], [0.3, 0.7, 0.4], [0.9, 0.7, 0.2]];
  for (let i = 0; i < 14; i += 1) {
    parts.push(boxGeo(6, 2.6, 2.6, rng.pick(containerColors), [
      104 + (i % 4) * 8, 1.3 + Math.floor(i / 8) * 2.7, 108 + Math.floor(i / 4) * 6,
    ]));
  }

  // --- marina docks (south-west shore) ------------------------------
  for (let i = 0; i < 3; i += 1) {
    parts.push(boxGeo(16, 0.5, 2.5, [0.6, 0.45, 0.3], [-158, 0.4, 64 + i * 16]));
  }

  // --- streetlights along the main roads ----------------------------
  for (const x of lines) {
    for (let z = -128; z <= 128; z += 64) {
      parts.push(cylGeo(0.15, 0.2, 7, 5, [0.3, 0.3, 0.32], [x + 6, 3.5, z]));
      parts.push(boxGeo(1.6, 0.3, 0.5, [1.0, 0.95, 0.7], [x + 5.2, 7, z]));
    }
  }

  // --- garage building (player's shop, on the 0-line road) ----------
  const garagePos = [16, 0, 32];
  parts.push(boxGeo(18, 8, 14, [0.85, 0.3, 0.3], [garagePos[0], 4, garagePos[2]]));
  parts.push(boxGeo(18.4, 1.5, 14.4, [1.0, 0.8, 0.2], [garagePos[0], 7.5, garagePos[2]]));
  parts.push(boxGeo(10, 5, 0.5, [0.2, 0.2, 0.25], [garagePos[0], 2.5, garagePos[2] - 7.2]));
  colliders.push({
    minX: garagePos[0] - 9, maxX: garagePos[0] + 9,
    minZ: garagePos[2] - 7, maxZ: garagePos[2] + 7,
  });

  return {
    mesh: makeMesh(ctx, mergeGeos(parts)),
    colliders,
    garagePos,
    raceStart: [0, 0, -64],
    dockPos: [-158, 0, 80],
    heliPad: [96, 0, -96],
    // Talkable NPC spots: pier, park, garage, marina, downtown, beach.
    npcSpots: [
      [-140, 0, -96], [8, 0, 8], [24, 0, 24],
      [-150, 0, 64], [32, 0, -32], [-144, 0, 120],
    ],
  };
}

// Push a circle (x, z, radius) out of every collider it overlaps.
// Returns the corrected [x, z]. Cheap AABB resolution, good enough
// for arcade driving and walking.
export function resolveCollisions(colliders, x, z, radius) {
  let nx = x;
  let nz = z;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(nx, c.maxX));
    const cz = Math.max(c.minZ, Math.min(nz, c.maxZ));
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * radius;
        nz = cz + (dz / d) * radius;
      } else {
        // Centre inside the box: shove out along the smallest overlap.
        const pushL = nx - (c.minX - radius);
        const pushR = (c.maxX + radius) - nx;
        const pushU = nz - (c.minZ - radius);
        const pushD = (c.maxZ + radius) - nz;
        const m = Math.min(pushL, pushR, pushU, pushD);
        if (m === pushL) nx = c.minX - radius;
        else if (m === pushR) nx = c.maxX + radius;
        else if (m === pushU) nz = c.minZ - radius;
        else nz = c.maxZ + radius;
      }
    }
  }
  return [nx, nz];
}
