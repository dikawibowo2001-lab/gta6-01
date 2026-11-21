// Particles: a single dynamic point cloud for muzzle flashes, blood
// puffs, car smoke, sparks, skid dust and pickup sparkles. One buffer,
// one draw call, additive-ish plain rendering — cheap enough to leave
// running through a whole chase.

import { Builder } from './gl.js';

const MAX = 420;

export class Particles {
  constructor(gl) {
    this.gl = gl;
    this.items = [];
    this.mesh = null;
    this.dirty = true;
    this.builder = new Builder(false);
  }

  spawn(x, y, z, vx, vy, vz, life, size, r, g, b) {
    if (this.items.length >= MAX) this.items.shift();
    this.items.push({ x, y, z, vx, vy, vz, life, maxLife: life, size, r, g, b });
    this.dirty = true;
  }

  burst(x, y, z, n, speed, life, size, r, g, b) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn(x, y, z, Math.cos(a) * s, (Math.random() - 0.2) * speed * 0.7, Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.7), size * (0.7 + Math.random() * 0.6), r, g, b);
    }
  }

  muzzle(x, z, heading) {
    const mx = x + Math.sin(heading) * 1.2;
    const mz = z + Math.cos(heading) * 1.2;
    this.burst(mx, 1.3, mz, 4, 3, 0.12, 0.5, 1.0, 0.8, 0.25);
  }

  blood(x, z) {
    this.burst(x, 1.1, z, 8, 2.5, 0.5, 0.45, 0.75, 0.1, 0.1);
  }

  smoke(x, y, z) {
    this.spawn(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5),
      (Math.random() - 0.5) * 0.6, 1.6 + Math.random(), (Math.random() - 0.5) * 0.6,
      1.4, 1.1, 0.32, 0.32, 0.34);
  }

  fire(x, y, z) {
    this.spawn(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.5, 2.2 + Math.random() * 1.4, (Math.random() - 0.5) * 0.5,
      0.5, 0.9, 1.0, 0.55, 0.12);
  }

  sparks(x, z) {
    this.burst(x, 0.6, z, 10, 5, 0.4, 0.35, 1.0, 0.85, 0.3);
  }

  skidDust(x, z) {
    this.spawn(x, 0.3, z, (Math.random() - 0.5) * 1.5, 0.8, (Math.random() - 0.5) * 1.5,
      0.7, 0.8, 0.75, 0.7, 0.6);
  }

  sparkle(x, y, z) {
    this.burst(x, y, z, 12, 2, 0.8, 0.5, 1.0, 0.9, 0.35);
  }

  update(dt) {
    let moved = false;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        moved = true;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 1.5 * dt;
      if (p.y < 0.15) p.y = 0.15;
      moved = true;
    }
    if (moved) this.dirty = true;
  }

  // Rebuild the mesh only when something changed. Each particle is a
  // camera-facing quad — approximated here as a small horizontal disc,
  // which reads fine from the chase cam and costs no per-frame math.
  rebuild() {
    if (!this.dirty) return;
    this.dirty = false;
    const b = new Builder(false);
    for (const p of this.items) {
      const fade = p.life / p.maxLife;
      const s = p.size * (0.5 + (1 - fade) * 0.8);
      b.disc(p.x, Math.max(0.2, p.y), p.z, s, [p.r * fade + 0.05, p.g * fade + 0.05, p.b * fade + 0.05], 6);
    }
    this.mesh = b.finish(this.gl);
  }
}
