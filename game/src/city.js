// Solmar Bay itself: a seeded grid city with roads, blocks of buildings,
// a park, a beach and sea along the south edge, and a container port in
// the east. Also answers the collision questions the simulation asks:
// what is solid, what is road, and where the roads run.

import { BEACH_TOP, PALETTE, PORT_LEFT, ROAD_WIDTH, ROAD_X, ROAD_Y, SEA_TOP, WORLD } from './config.js';

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function generateCity(rng) {
  const buildings = [];
  const trees = [];
  const containers = [];
  const lanes = [];

  // Road centre lines, for traffic waypoints and spawning.
  for (const x of ROAD_X) lanes.push({ axis: 'v', at: x });
  for (const y of ROAD_Y) lanes.push({ axis: 'h', at: y });

  // The block between each pair of neighbouring roads holds buildings,
  // except the park block and the port strip.
  const parkBlock = { x: 1310, y: 950, w: 300, h: 300 };
  // The Hideout clearing: Mara's home turf stays free of buildings so
  // she always spawns on open ground and the job marker stays reachable.
  const homeClearing = { x: 630, y: 630, w: 200, h: 200 };
  for (let ix = 0; ix < ROAD_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROAD_Y.length - 1; iy += 1) {
      const block = {
        x: ROAD_X[ix] + ROAD_WIDTH / 2 + 14,
        y: ROAD_Y[iy] + ROAD_WIDTH / 2 + 14,
        w: ROAD_X[ix + 1] - ROAD_X[ix] - ROAD_WIDTH - 28,
        h: ROAD_Y[iy] - ROAD_Y[iy] - ROAD_WIDTH - 28,
      };
      if (rectsOverlap(block, parkBlock)) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({
            x: rng.range(block.x + 16, block.x + block.w - 16),
            y: rng.range(block.y + 16, block.y + block.h - 16),
            r: rng.range(10, 16),
          });
        }
        continue;
      }
      const downtown = ix >= 2 && ix <= 4 && iy >= 1 && iy <= 3;
      const count = rng.int(1, downtown ? 2 : 4);
      for (let n = 0; n < count; n += 1) {
        const w = rng.range(60, downtown ? 130 : 100);
        const h = rng.range(60, downtown ? 130 : 100);
        const x = rng.range(block.x, Math.max(block.x + 1, block.x + block.w - w));
        const y = rng.range(block.y, Math.max(block.y + 1, block.y + block.h - h));
        const candidate = { x, y, w, h };
        if (rectsOverlap(candidate, homeClearing)) continue;
        if (buildings.some((b) => rectsOverlap(candidate, { x: b.x - 8, y: b.y - 8, w: b.w + 16, h: b.h + 16 }))) continue;
        buildings.push({
          ...candidate,
          color: rng.pick(PALETTE.building),
          roof: rng.pick(PALETTE.roof),
          tall: downtown && rng.chance(0.6),
          windows: rng.int(2, 5),
        });
      }
    }
  }

  // Scattered palms along the beach and the park edge.
  for (let t = 0; t < 26; t += 1) {
    trees.push({ x: rng.range(60, WORLD.width - 60), y: rng.range(BEACH_TOP + 8, SEA_TOP - 30), r: rng.range(9, 14), palm: true });
  }

  // The port: rows of containers east of the last road.
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      if (rng.chance(0.25)) continue;
      containers.push({
        x: PORT_LEFT + 30 + col * 62,
        y: 240 + row * 300 + rng.range(-8, 8),
        w: 52,
        h: 26,
        color: rng.pick(PALETTE.container),
      });
    }
  }

  // Landmarks the story and the missions point at.
  const landmarks = {
    home: { x: 700, y: 700, label: 'Hideout' },
    garage: { x: 380, y: 1780, label: 'Sunset Garage' },
    hospital: { x: 2360, y: 380, label: 'Bay General' },
    policeStation: { x: 1640, y: 1640, label: 'Solmar PD' },
    portGate: { x: 2820, y: 920, label: 'Port Gate' },
    downtown: { x: 1280, y: 920, label: 'Downtown' },
    marina: { x: 920, y: 2060, label: 'Marina' },
  };

  function onRoad(x, y) {
    for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_WIDTH / 2) return true;
    for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_WIDTH / 2) return true;
    return false;
  }

  function inWater(x, y) {
    return y >= SEA_TOP;
  }

  function inBuilding(x, y, pad = 0) {
    for (const b of buildings) {
      if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return b;
    }
    return null;
  }

  // Solid for walking and driving: buildings, containers, the sea, the edge.
  function solidAt(x, y, pad = 0) {
    if (x < 8 || y < 8 || x > WORLD.width - 8 || y > WORLD.height - 8) return true;
    if (inWater(x, y)) return true;
    if (inBuilding(x, y, pad)) return true;
    for (const c of containers) {
      if (x >= c.x - pad && x <= c.x + c.w + pad && y >= c.y - pad && y <= c.y + c.h + pad) return true;
    }
    return false;
  }

  // A random point on a road, for spawning traffic and parked cars.
  function randomRoadPoint(r) {
    if (r.chance(0.5)) {
      return { x: r.pick(ROAD_X) + r.range(-20, 20), y: r.range(120, 2060) };
    }
    return { x: r.range(120, 2820), y: r.pick(ROAD_Y) + r.range(-20, 20) };
  }

  // The nearest road point to (x, y): traffic steers toward these.
  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of ROAD_X) {
      const d = Math.abs(x - rx);
      if (d < bestD) {
        bestD = d;
        best = { x: rx, y };
      }
    }
    for (const ry of ROAD_Y) {
      const d = Math.abs(y - ry);
      if (d < bestD) {
        bestD = d;
        best = { x, y: ry };
      }
    }
    return best;
  }

  return {
    buildings,
    trees,
    containers,
    lanes,
    landmarks,
    parkBlock,
    onRoad,
    inWater,
    inBuilding,
    solidAt,
    randomRoadPoint,
    nearestRoadPoint,
  };
}
