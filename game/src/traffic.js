// Traffic: a dense stream of AI cars cruising the road grid, turning
// at intersections, slowing for the car ahead, and pulling over when a
// siren is close. Twenty cars on the road at once, so the streets feel
// lived-in from the chase camera.

import { Car } from './vehicles.js';
import { CAR_TYPES, WORLD } from './config.js';
import { makeRng, pick, range } from './random.js';
import { clamp, dist2D } from './math3.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'suv', 'taxi', 'sedan', 'truck', 'sports'];

export class Traffic {
  constructor(city, count, seed) {
    this.city = city;
    this.rng = makeRng(seed);
    this.cars = [];
    for (let i = 0; i < count; i++) {
      this.cars.push(this.spawnCar(true));
    }
  }

  spawnCar(anywhere) {
    const rng = this.rng;
    const type = pick(rng, TRAFFIC_TYPES);
    const road = pick(rng, WORLD.grid);
    const along = range(rng, -380, 380);
    const horizontal = rng() < 0.5;
    const x = horizontal ? along : road;
    const z = horizontal ? road : along;
    const heading = horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = new Car(type, pick(rng, CAR_TYPES[type].paint), x, z, heading);
    car.driver = 'traffic';
    car.speed = range(rng, 8, 14);
    car.route = this.newRoute(car);
    car.routeIdx = 0;
    return car;
  }

  // A route is a list of intersections to drive through.
  newRoute(car) {
    const rng = this.rng;
    const route = [];
    let x = car.x;
    let z = car.z;
    for (let i = 0; i < 5; i++) {
      if (rng() < 0.5) {
        x = pick(rng, WORLD.grid);
      } else {
        z = pick(rng, WORLD.grid);
      }
      route.push([x, z]);
    }
    return route;
  }

  update(dt, player, policeActive) {
    for (const car of this.cars) {
      if (car.wrecked) continue;
      // Sirens nearby: pull to the kerb and wait.
      if (policeActive && dist2D(car.x, car.z, player.x, player.z) < 45) {
        car.waitTimer = Math.max(car.waitTimer, 1.2);
      }
      if (car.waitTimer > 0) {
        car.waitTimer -= dt;
        car.drive(0, 0, false, dt);
        continue;
      }
      const target = car.route[car.routeIdx];
      if (!target) {
        car.route = this.newRoute(car);
        car.routeIdx = 0;
        continue;
      }
      const d = dist2D(car.x, car.z, target[0], target[1]);
      if (d < 8) {
        car.routeIdx++;
        if (car.routeIdx >= car.route.length) {
          car.route = this.newRoute(car);
          car.routeIdx = 0;
        }
        continue;
      }
      // Steer toward the waypoint.
      const want = Math.atan2(target[0] - car.x, target[1] - car.z);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = clamp(diff * 1.6, -1, 1);
      // Slow down for the car ahead.
      let throttle = 0.55;
      const aheadX = car.x + Math.sin(car.heading) * 10;
      const aheadZ = car.z + Math.cos(car.heading) * 10;
      for (const other of this.cars) {
        if (other === car || other.wrecked) continue;
        if (dist2D(aheadX, aheadZ, other.x, other.z) < 6) {
          throttle = -0.8;
          break;
        }
      }
      const cruise = 11 + (car.type === 'sports' ? 5 : 0);
      if (car.speed > cruise) throttle = 0;
      car.drive(throttle, steer, false, dt);
    }
    // Car-car collisions.
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        this.cars[i].collideWith(this.cars[j]);
      }
    }
  }
}
