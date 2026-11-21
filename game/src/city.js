// The city of Solmar Bay: a seeded grid of roads and blocks, a beach
// and ocean to the east, a working port to the north-west, and a
// downtown of glass towers at the centre. Everything static is baked
// into two meshes (lit + plain) at build time, so the frame loop only
// draws the moving parts.
//
// The city also owns the named spawn points every system shares: where
// Mara starts, where Reyes' garage is, where the missions point.

import { Builder } from './gl.js';
import { WORLD, PALETTE } from './config.js';
import { makeRng, range, rangeInt, pick, chance } from './random.js';

export class City {
  constructor(seed) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.buildings = []; // {x, z, w, d, h} — for collision + minimap
    this.palms = [];
    this.lamps = [];
    this.spawns = {
      player: [-40, 40],
      reyesGarage: [40, 200],
      portGate: [-200, -280],
      marina: [280, 280],
      junoPickup: [-240, -240],
      safehouse: [-120, 280],
      rivalCamp: [-200, 200],
      beachDrop: [340, 120],
      portTruck: [-280, -200],
      sportsParked: [120, 40],
    };
    this.build();
  }

  build() {
    const rng = this.rng;
    const lit = new Builder(true);
    const plain = new Builder(false);
    const P = PALETTE;
    const B = WORLD.bound;

    // Ground slab (grass) and the sand strip + sea.
    lit.box(0, -0.6, 0, B * 2 + 200, 1, B * 2 + 200, P.grass);
    lit.box((WORLD.sandX + WORLD.seaX) / 2 + 20, -0.4, 0, (WORLD.seaX - WORLD.sandX) + 40, 1, B * 2 + 200, P.sand);
    // Sea: a big flat sheet, slightly glossy-looking via the plain pass.
    plain.box(WORLD.seaX + 120, -0.2, 0, 260, 1, B * 2 + 200, P.sea);
    // A lighter surf line where the waves break.
    plain.box(WORLD.seaX - 2, 0.05, 0, 4, 0.2, B * 2 + 200, [0.75, 0.9, 0.95]);

    // Roads: dark strips on both axes, with centre dashes and edge lines.
    for (const c of WORLD.grid) {
      lit.box(c, 0.02, 0, WORLD.roadHalf * 2, 0.12, B * 2, P.asphalt);
      lit.box(0, 0.02, c, B * 2, 0.12, WORLD.roadHalf * 2, P.asphalt);
      for (let d = -B + 10; d < B - 10; d += 16) {
        lit.box(c, 0.1, d, 0.7, 0.06, 6, P.linePaint);
        lit.box(d, 0.1, c, 6, 0.06, 0.7, P.linePaint);
      }
    }

    // Sidewalk skirts around every block.
    for (const bx of WORLD.blocks) {
      for (const bz of WORLD.blocks) {
        if (bx > 240) continue; // beach blocks have no sidewalks
        lit.box(bx, 0.06, bz, WORLD.blockSize + 12, 0.14, WORLD.blockSize + 12, P.walkway);
      }
    }

    // Buildings: downtown gets one tall tower per block; every other
    // block gets two or three smaller buildings, so the city passes
    // a hundred rooftops. Downtown towers get glass tops; every tower
    // gets rooftop props.
    for (const bx of WORLD.blocks) {
      for (const bz of WORLD.blocks) {
        if (bx > 240) continue;
        const downtown = Math.abs(bx) <= 80 && Math.abs(bz) <= 80;
        const nearDowntown = Math.abs(bx) <= 160 && Math.abs(bz) <= 160;
        const slots = downtown
          ? [[0, 0]]
          : chance(rng, 0.5)
            ? [[-16, -16], [16, -16], [0, 16]]
            : [[-14, -14], [14, 14]];
        for (const [ox, oz] of slots) {
          const w = downtown ? range(rng, 26, 34) : range(rng, 13, 22);
          const d = downtown ? range(rng, 26, 34) : range(rng, 13, 22);
          let h;
          if (downtown) h = range(rng, 55, 110);
          else if (nearDowntown) h = range(rng, 22, 48);
          else h = range(rng, 10, 30);
          const x = bx + ox;
          const z = bz + oz;
          const facade = pick(rng, P.facades);
          lit.box(x, h / 2, z, w, h, d, facade);
          // Roof slab + props (AC units, water tank, antenna).
          lit.boxTop(x, h + 0.4, z, w + 1, 0.8, d + 1, facade, [0.32, 0.3, 0.3]);
          if (chance(rng, 0.8)) lit.box(x + range(rng, -w / 4, w / 4), h + 1.6, z + range(rng, -d / 4, d / 4), 4, 2.4, 3, [0.45, 0.45, 0.46]);
          if (chance(rng, 0.5)) lit.cylinder(x + range(rng, -w / 4, w / 4), h + 2.4, z + range(rng, -d / 4, d / 4), 1.8, 3.4, [0.6, 0.55, 0.5], 8);
          if (chance(rng, 0.4)) lit.cylinder(x, h + 4, z, 0.25, 8, [0.3, 0.3, 0.32], 6);
          if (downtown && chance(rng, 0.5)) {
            // Glass crown on the tallest towers.
            lit.box(x, h + 3, z, w * 0.5, 5, d * 0.5, [0.35, 0.55, 0.7]);
          }
          // Windows: lit and dark, stamped on all four faces.
          const rows = Math.max(2, Math.floor(h / 7));
          const colsX = Math.max(2, Math.floor(w / 5));
          const colsZ = Math.max(2, Math.floor(d / 5));
          for (let r = 0; r < rows; r++) {
            const wy = 4 + r * 7;
            for (let cxi = 0; cxi < colsX; cxi++) {
              const wx = x - w / 2 + 3 + cxi * ((w - 6) / Math.max(1, colsX - 1));
              const litWin = chance(rng, 0.45);
              const col = litWin ? P.litWindow : P.darkWindow;
              plain.face(wx, wy, z + d / 2 + 0.06, 0, 0, 1, 1, 0, 0, 0, 1, 0, 2.6, 3.6, col);
              plain.face(wx, wy, z - d / 2 - 0.06, 0, 0, -1, -1, 0, 0, 0, 1, 0, 2.6, 3.6, col);
            }
            for (let czi = 0; czi < colsZ; czi++) {
              const wz = z - d / 2 + 3 + czi * ((d - 6) / Math.max(1, colsZ - 1));
              const litWin = chance(rng, 0.45);
              const col = litWin ? P.litWindow : P.darkWindow;
              plain.face(x + w / 2 + 0.06, wy, wz, 1, 0, 0, 0, 0, -1, 0, 1, 0, 2.6, 3.6, col);
              plain.face(x - w / 2 - 0.06, wy, wz, -1, 0, 0, 0, 0, 1, 0, 1, 0, 2.6, 3.6, col);
            }
          }
          this.buildings.push({ x, z, w, d, h });
        }
      }
    }

    // Palms: along the beach, the marina, and scattered on blocks.
    for (let z = -B + 20; z < B - 20; z += 26) {
      this.addPalm(lit, WORLD.sandX + 8 + range(rng, -4, 10), z + range(rng, -6, 6), rng);
    }
    for (let i = 0; i < 42; i++) {
      const bx = pick(rng, WORLD.blocks);
      const bz = pick(rng, WORLD.blocks);
      if (bx > 240) continue;
      this.addPalm(lit, bx + range(rng, -26, 26), bz + range(rng, -26, 26), rng);
    }
    for (let i = 0; i < 10; i++) {
      this.addPalm(lit, range(rng, 200, 300), range(rng, 220, 320), rng);
    }

    // Streetlights along the main roads.
    for (const c of WORLD.grid) {
      for (let d = -B + 20; d < B - 20; d += 80) {
        const lx = c + WORLD.roadHalf + 2;
        lit.cylinder(lx, 4, d, 0.25, 8, [0.25, 0.25, 0.28], 6);
        lit.box(lx - 1.2, 8, d, 2.6, 0.3, 0.3, [0.25, 0.25, 0.28]);
        plain.box(lx - 2.2, 7.8, d, 1.2, 0.5, 0.6, [1.0, 0.9, 0.6]);
        this.lamps.push([lx, d]);
        lit.cylinder(d, 4, c + WORLD.roadHalf + 2, 0.25, 8, [0.25, 0.25, 0.28], 6);
        lit.box(d, 8, c + WORLD.roadHalf + 0.8, 0.3, 0.3, 2.6, [0.25, 0.25, 0.28]);
        plain.box(d, 7.8, c + WORLD.roadHalf - 0.2, 0.6, 0.5, 1.2, [1.0, 0.9, 0.6]);
      }
    }

    // The port: cranes, container stacks, a warehouse row.
    const portX = -280;
    const portZ = -280;
    for (let i = 0; i < 3; i++) {
      const cx = portX + i * 55;
      const cz = portZ + 20;
      lit.box(cx, 18, cz, 5, 36, 5, P.cranePaint);
      lit.box(cx + 12, 36, cz, 30, 3, 3, P.cranePaint);
      lit.box(cx - 8, 36, cz, 14, 3, 3, P.cranePaint);
      lit.cylinder(cx + 24, 30, cz, 0.3, 12, [0.2, 0.2, 0.22], 6);
      lit.box(cx + 24, 24, cz, 4, 3, 4, [0.25, 0.25, 0.26]);
    }
    for (let i = 0; i < 26; i++) {
      const x = portX - 40 + range(rng, 0, 150);
      const z = portZ - 60 + range(rng, 0, 90);
      const col = pick(rng, P.boxColors);
      const stack = rangeInt(rng, 1, 3);
      for (let s = 0; s < stack; s++) {
        lit.boxTop(x, 1.6 + s * 3.2, z, 12, 3, 5, col, [col[0] * 0.85, col[1] * 0.85, col[2] * 0.85]);
      }
    }
    lit.box(portX - 20, 6, portZ + 80, 60, 12, 24, [0.7, 0.68, 0.62]);
    lit.box(portX + 60, 6, portZ + 80, 60, 12, 24, [0.66, 0.64, 0.6]);

    // Marina: a pier + moored boats.
    for (let i = 0; i < 5; i++) {
      const px = 300 + i * 18;
      lit.box(px, 0.8, 300, 10, 1.4, 60, [0.55, 0.45, 0.32]);
      lit.box(px, 1.6, 322, 6, 2.4, 14, pick(rng, [[0.9, 0.9, 0.92], [0.2, 0.5, 0.8], [0.8, 0.3, 0.2]]));
    }

    // A park in the middle of town: trees + a fountain disc.
    for (let i = 0; i < 12; i++) {
      const x = range(rng, -60, 60);
      const z = range(rng, -60, 60);
      lit.cylinder(x, 2.5, z, 0.5, 5, P.trunk, 7);
      lit.cone(x, 8, z, 4.5, 7, [0.2, 0.5, 0.25], 8);
    }
    lit.cylinder(0, 0.6, 0, 8, 1.2, [0.6, 0.62, 0.66], 16);
    plain.disc(0, 1.25, 0, 7, [0.4, 0.75, 0.9], 20);

    // Neon signs on a few downtown towers (plain pass = unlit glow).
    const signCols = [[1.0, 0.3, 0.6], [0.3, 0.9, 1.0], [1.0, 0.7, 0.2], [0.6, 1.0, 0.4]];
    for (let i = 0; i < 8; i++) {
      const b = this.buildings[Math.floor(rng() * this.buildings.length)];
      if (!b || b.h < 30) continue;
      plain.face(b.x, b.h * 0.7, b.z + b.d / 2 + 0.12, 0, 0, 1, 1, 0, 0, 0, 1, 0, 10, 2.4, pick(rng, signCols));
    }

    this.litBuilder = lit;
    this.plainBuilder = plain;
  }

  addPalm(lit, x, z, rng) {
    const h = range(rng, 7, 11);
    const lean = range(rng, -0.12, 0.12);
    lit.cylinder(x, h / 2, z, 0.35, h, PALETTE.trunk, 7);
    const topX = x + lean * h;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng() * 0.5;
      const fx = topX + Math.cos(a) * 2.2;
      const fz = z + Math.sin(a) * 2.2;
      lit.cone(fx, h + 0.6, fz, 1.1, 3.4, PALETTE.frond, 5);
    }
    lit.cone(topX, h + 1.4, z, 1.6, 2.6, PALETTE.frond, 6);
    this.palms.push([x, z]);
  }

  finish(gl) {
    this.litMesh = this.litBuilder.finish(gl);
    this.plainMesh = this.plainBuilder.finish(gl);
    this.litBuilder = null;
    this.plainBuilder = null;
  }

  // Push a walker out of building footprints (cheap AABB resolve).
  collide(x, z, radius) {
    for (const b of this.buildings) {
      const dx = x - b.x;
      const dz = z - b.z;
      const px = b.w / 2 + radius - Math.abs(dx);
      const pz = b.d / 2 + radius - Math.abs(dz);
      if (px > 0 && pz > 0) {
        if (px < pz) x = b.x + (dx > 0 ? b.w / 2 + radius : -b.w / 2 - radius);
        else z = b.z + (dz > 0 ? b.d / 2 + radius : -b.d / 2 - radius);
      }
    }
    return [x, z];
  }

  insideBuilding(x, z) {
    for (const b of this.buildings) {
      if (Math.abs(x - b.x) < b.w / 2 + 1 && Math.abs(z - b.z) < b.d / 2 + 1) return true;
    }
    return false;
  }
}
