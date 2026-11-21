// Boats: three speedboats moored at the marina. Walk to the dock,
// press E to board, and steer on the open water with the same WASD
// controls — boats turn slower and drift wider than cars, and leave a
// foam wake behind them. Press E again to step back onto the dock.
// Boats can't drive on land: the water is everything east of the
// surf line, and the dock is the only way in and out.

import { WORLD } from './config.js';
import { clamp, dist2D } from './math3.js';

export class Boat {
  constructor(x, z, heading, color) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.color = color;
    this.occupied = false;
    this.wakeT = 0;
  }

  get top() {
    return 30;
  }

  // Boat handling: slow to turn, long to stop, drifts on the swell.
  drive(throttle, steering, dt) {
    this.speed += throttle * 9 * dt;
    this.speed = clamp(this.speed, -6, this.top);
    this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 1.2 * dt);
    const turnRate = 1.1 * clamp(Math.abs(this.speed) / 10, 0.2, 1);
    this.heading += steering * turnRate * dt * (this.speed < 0 ? -1 : 1);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    // Stay in the water: the surf line is the western edge, the world
    // bound the rest.
    const minX = WORLD.seaX - 6;
    if (this.x < minX) {
      this.x = minX;
      this.speed *= 0.4;
    }
    const B = WORLD.bound + 60;
    this.x = clamp(this.x, minX, B);
    this.z = clamp(this.z, -B, B);
  }
}

export class Boats {
  constructor() {
    this.list = [
      new Boat(404, 280, Math.PI, [0.9, 0.9, 0.92]),
      new Boat(404, 300, Math.PI, [0.2, 0.5, 0.8]),
      new Boat(404, 320, Math.PI, [0.8, 0.3, 0.2]),
    ];
  }

  nearest(x, z, maxDist = 6) {
    let best = null;
    let bestD = maxDist;
    for (const b of this.list) {
      const d = dist2D(x, z, b.x, b.z);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  update(dt, world) {
    for (const b of this.list) {
      if (b.occupied) {
        b.wakeT -= dt;
        if (Math.abs(b.speed) > 4 && b.wakeT <= 0) {
          b.wakeT = 0.12;
          world.particles.wake(b.x - Math.sin(b.heading) * 3, b.z - Math.cos(b.heading) * 3);
        }
      } else {
        // Moored boats bob gently on the swell.
        b.speed = 0;
      }
    }
  }
}
