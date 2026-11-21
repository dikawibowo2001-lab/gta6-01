// Solmar Bay v4 — particles: smoke, fire, sparks, tracers, wake.
//
// One pooled array, capped so a chain of explosions can't melt the
// frame rate. Each particle is a tinted unit box that shrinks as it
// ages; tracers are stretched boxes spanning origin to impact.

import { matFromTRS } from './math3.js';
import { drawBox } from './gl.js';

const MAX_PARTICLES = 350;

export function makeParticles(G) {
  const list = [];

  function push(p) {
    if (list.length >= MAX_PARTICLES) list.shift();
    list.push(p);
  }

  function spawn(kind, pos, opts = {}) {
    if (kind === 'smoke') {
      push({
        kind, pos: [...pos], vel: [G.rng.range(-0.5, 0.5), G.rng.range(1.5, 3), G.rng.range(-0.5, 0.5)],
        life: G.rng.range(1.2, 2.2), maxLife: 2.2, size: G.rng.range(0.8, 1.4),
        color: [0.25, 0.25, 0.25], grow: 1.2,
      });
    } else if (kind === 'fire') {
      push({
        kind, pos: [...pos], vel: [G.rng.range(-0.8, 0.8), G.rng.range(2, 4.5), G.rng.range(-0.8, 0.8)],
        life: G.rng.range(0.3, 0.7), maxLife: 0.7, size: G.rng.range(0.5, 1.1),
        color: G.rng.pick([[1, 0.5, 0.1], [1, 0.75, 0.2], [0.95, 0.3, 0.05]]), grow: 0.4,
      });
    } else if (kind === 'spark' || kind === 'impact') {
      for (let i = 0; i < 6; i += 1) {
        push({
          kind: 'spark', pos: [...pos],
          vel: [G.rng.range(-6, 6), G.rng.range(1, 6), G.rng.range(-6, 6)],
          life: G.rng.range(0.2, 0.5), maxLife: 0.5, size: 0.12,
          color: [1, 0.85, 0.3], grow: 0, gravity: 12,
        });
      }
    } else if (kind === 'muzzle') {
      push({
        kind, pos: [...pos], vel: [0, 0, 0], life: 0.06, maxLife: 0.06,
        size: 0.5, color: [1, 0.9, 0.4], grow: 0,
      });
    } else if (kind === 'tracer') {
      const to = opts.to || [pos[0], pos[1], pos[2] + 10];
      push({
        kind, pos: [...pos], to: [...to], vel: [0, 0, 0],
        life: 0.09, maxLife: 0.09, size: 0.06,
        color: [1, 0.95, 0.6], grow: 0,
      });
    } else if (kind === 'wake') {
      push({
        kind, pos: [...pos], vel: [G.rng.range(-0.4, 0.4), 0.1, G.rng.range(-0.4, 0.4)],
        life: G.rng.range(0.8, 1.5), maxLife: 1.5, size: G.rng.range(0.5, 0.9),
        color: [0.9, 0.95, 1], grow: 0.8,
      });
    } else if (kind === 'tire') {
      push({
        kind, pos: [...pos], vel: [0, 0.8, 0], life: 0.7, maxLife: 0.7,
        size: 0.6, color: [0.6, 0.6, 0.6], grow: 1,
      });
    }
  }

  return {
    list,
    spawn,
    update(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        p.pos[0] += p.vel[0] * dt;
        p.pos[1] += p.vel[1] * dt;
        p.pos[2] += p.vel[2] * dt;
        if (p.gravity) p.vel[1] -= p.gravity * dt;
        if (p.grow) p.size += p.grow * dt;
      }
    },
    draw(ctx) {
      for (const p of list) {
        if (p.kind === 'tracer') {
          const dx = p.to[0] - p.pos[0];
          const dy = p.to[1] - p.pos[1];
          const dz = p.to[2] - p.pos[2];
          const len = Math.hypot(dx, dy, dz) || 1;
          const mid = [(p.pos[0] + p.to[0]) / 2, (p.pos[1] + p.to[1]) / 2, (p.pos[2] + p.to[2]) / 2];
          const angle = Math.atan2(-dx, -dz);
          drawBox(ctx, matFromTRS(mid, angle, [p.size, p.size, len]), p.color);
        } else {
          const fade = p.life / p.maxLife;
          drawBox(ctx, matFromTRS(p.pos, 0, p.size), [
            p.color[0] * (0.4 + 0.6 * fade),
            p.color[1] * (0.4 + 0.6 * fade),
            p.color[2] * (0.4 + 0.6 * fade),
          ]);
        }
      }
    },
  };
}
