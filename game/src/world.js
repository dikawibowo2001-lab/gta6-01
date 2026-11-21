// Solmar Bay v4 — terrain: ground, roads, beach and ocean.
//
// The city is a regular grid: roads run north-south and east-west
// every 32 metres, leaving square blocks for buildings. The ground
// is one big slab, the beach is a sand strip on the west edge, and
// the ocean is a flat water plane beyond it. Everything merges into
// a single static mesh (one draw call).

import { CFG } from './config.js';
import { boxGeo, makeMesh, mergeGeos, quadGeo } from './gl.js';

export function roadLines() {
  const lines = [];
  for (let k = -5; k <= 5; k += 1) lines.push(k * CFG.blockSize);
  return lines;
}

export function buildWorld(ctx) {
  const parts = [];
  const half = CFG.cityHalf + 40;

  // Ground slab under the whole city.
  parts.push(quadGeo(half * 2, half * 2, CFG.groundColor, 0, [0, 0, 0]));
  // Sand strip along the west edge.
  parts.push(quadGeo(24, half * 2, CFG.sandColor, 0.01, [-156, 0, 0]));
  // Ocean plane, slightly lower than the sand.
  parts.push(quadGeo(120, half * 2 + 200, CFG.waterColor, -0.4, [-240, 0, 0]));
  // Boardwalk strip where sand meets the first road.
  parts.push(quadGeo(6, half * 2, [0.72, 0.55, 0.38], 0.02, [-142, 0, 0]));

  // Road surfaces along every grid line.
  const lines = roadLines();
  for (const x of lines) {
    parts.push(quadGeo(CFG.roadWidth, half * 2, CFG.roadColor, 0.02, [x, 0, 0]));
  }
  for (const z of lines) {
    parts.push(quadGeo(half * 2, CFG.roadWidth, CFG.roadColor, 0.02, [0, 0, z]));
  }
  // Centre dashes: short pale boxes down the middle of each road.
  const dashColor = [0.85, 0.75, 0.3];
  for (const x of lines) {
    for (let z = -150; z <= 150; z += 12) {
      parts.push(boxGeo(0.5, 0.06, 3, dashColor, [x, 0.05, z]));
    }
  }
  for (const z of lines) {
    for (let x = -150; x <= 150; x += 12) {
      parts.push(boxGeo(3, 0.06, 0.5, dashColor, [x, 0.05, z]));
    }
  }

  // A low seawall where the boardwalk meets the sand.
  parts.push(boxGeo(1, 1.2, half * 2, [0.75, 0.72, 0.68], [-145, 0.6, 0]));

  return {
    mesh: makeMesh(ctx, mergeGeos(parts)),
    lines,
  };
}

// True when (x, z) is on a road (within half the road width of a
// grid line) — used by traffic, spawning and the minimap.
export function onRoad(x, z) {
  const half = CFG.roadWidth / 2 + 0.5;
  const lines = roadLines();
  return lines.some((l) => Math.abs(x - l) < half)
    || lines.some((l) => Math.abs(z - l) < half);
}

// Nearest road-centre coordinate to a value on one axis.
export function nearestRoadCoord(v) {
  return Math.round(v / CFG.blockSize) * CFG.blockSize;
}

// District lookup for a world position (null outside all districts).
export function districtAt(x, z) {
  for (const d of CFG.districts) {
    if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d.name;
  }
  return null;
}
