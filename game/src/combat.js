// Combat: the pistol, the punch, the rival crew that shoots back, and
// the pickups scattered around the city — health kits, armour vests and
// loose cash. Bullets fly straight, hit walls, cars, people and the
// player, and leave a spark where they land.

import { PLAYER } from './config.js';
import { damageCar } from './vehicles.js';
import { scarePeds } from './entities.js';
import { spawnParticles, spawnText } from './particles.js';

export function createEnemy(rng, x, y) {
  return {
    x, y,
    angle: 0,
    hp: 60,
    speed: rng.range(120, 150),
    shootCd: rng.range(0.6, 1.6),
    state: 'guard',
    target: null,
    walkPhase: 0,
    dead: false,
  };
}

export function spawnPickups(city, rng) {
  const pickups = [];
  const kinds = ['health', 'armor', 'cash', 'health', 'cash', 'armor', 'health', 'cash'];
  let guard = 0;
  for (const kind of kinds) {
    guard = 0;
    while (guard < 60) {
      guard += 1;
      const x = rng.range(140, 2800);
      const y = rng.range(140, 2060);
      if (city.solidAt(x, y, 6) || city.onRoad(x, y)) continue;
      pickups.push({ x, y, kind, bob: rng.range(0, Math.PI * 2), taken: false });
      break;
    }
  }
  return pickups;
}

export function shoot(world, from, angle, owner, damage) {
  world.bullets.push({
    x: from.x + Math.cos(angle) * 22,
    y: from.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * 900,
    vy: Math.sin(angle) * 900,
    owner,
    damage,
    life: 1.1,
  });
  spawnParticles(world.fx, from.x + Math.cos(angle) * 24, from.y + Math.sin(angle) * 24, {
    count: 4, color: '#ffe66d', speed: 140, life: 0.12, size: 3,
  });
}

function bulletHitsCircle(b, x, y, r) {
  return Math.hypot(b.x - x, b.y - y) < r;
}

export function stepBullets(world, dt) {
  const player = world.player;
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const b = world.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && world.city.solidAt(b.x, b.y, 0)) {
      spawnParticles(world.fx, b.x, b.y, { count: 4, color: '#cccccc', speed: 120, life: 0.25, size: 3 });
      dead = true;
    }
    if (!dead && b.owner !== 'player') {
      // Enemy and cop bullets can only hurt the player on foot.
      if (!player.car && bulletHitsCircle(b, player.x, player.y, 14)) {
        hurtPlayer(world, b.damage);
        dead = true;
      }
    }
    if (!dead && b.owner === 'player') {
      for (const enemy of world.enemies) {
        if (!enemy.dead && bulletHitsCircle(b, enemy.x, enemy.y, 15)) {
          enemy.hp -= b.damage;
          spawnText(world.fx, enemy.x, enemy.y - 18, `-${b.damage}`, '#ffdd57');
          spawnParticles(world.fx, b.x, b.y, { count: 5, color: '#ff6b6b', speed: 130, life: 0.3, size: 4 });
          if (enemy.hp <= 0) {
            enemy.dead = true;
            world.stats.kills += 1;
            world.cash += 25;
            spawnText(world.fx, enemy.x, enemy.y - 30, '+$25', '#7bf1a8');
          } else {
            enemy.state = 'hunt';
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.owner === 'player') {
      for (const ped of world.peds) {
        if (!ped.down && bulletHitsCircle(b, ped.x, ped.y, 13)) {
          ped.down = true;
          ped.state = 'down';
          scarePeds(world.peds, ped.x, ped.y, 320);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of world.cars) {
        if (car.dead) continue;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
        const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along < car.length / 2 && across < car.width / 2 + 2) {
          damageCar(car, b.damage, world.fx);
          spawnParticles(world.fx, b.x, b.y, { count: 5, color: '#ffd166', speed: 150, life: 0.3, size: 3 });
          dead = true;
          break;
        }
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }
}

export function hurtPlayer(world, amount) {
  const player = world.player;
  let remaining = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, remaining);
    player.armor -= absorbed;
    remaining -= absorbed;
  }
  player.hp -= remaining;
  world.shake = Math.min(14, world.shake + 6);
  spawnParticles(world.fx, player.x, player.y, { count: 6, color: '#ff6b6b', speed: 140, life: 0.35, size: 4 });
  if (world.audio) world.audio.hit();
  if (player.hp <= 0) {
    player.hp = 0;
    world.wasted = true;
  }
}

export function punch(world) {
  const player = world.player;
  if (player.punchCd > 0 || player.car) return;
  player.punchCd = PLAYER.punchCooldown;
  if (world.audio) world.audio.punch();
  const px = player.x + Math.cos(player.angle) * PLAYER.punchRange;
  const py = player.y + Math.sin(player.angle) * PLAYER.punchRange;
  spawnParticles(world.fx, px, py, { count: 4, color: '#ffffff', speed: 90, life: 0.2, size: 3 });
  for (const enemy of world.enemies) {
    if (!enemy.dead && Math.hypot(enemy.x - player.x, enemy.y - player.y) < PLAYER.punchRange + 14) {
      enemy.hp -= PLAYER.punchDamage;
      spawnText(world.fx, enemy.x, enemy.y - 18, `-${PLAYER.punchDamage}`, '#ffdd57');
      if (enemy.hp <= 0) {
        enemy.dead = true;
        world.stats.kills += 1;
      } else {
        enemy.state = 'hunt';
      }
      return;
    }
  }
  for (const ped of world.peds) {
    if (!ped.down && Math.hypot(ped.x - player.x, ped.y - player.y) < PLAYER.punchRange + 12) {
      ped.down = true;
      ped.state = 'down';
      scarePeds(world.peds, ped.x, ped.y, 300);
      return;
    }
  }
}

export function stepEnemies(world, dt) {
  const player = world.player;
  const playerPos = player.car ? { x: player.car.x, y: player.car.y } : player;
  for (const enemy of world.enemies) {
    if (enemy.dead) continue;
    const dx = playerPos.x - enemy.x;
    const dy = playerPos.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (enemy.state === 'hunt' || dist < 320) enemy.state = 'hunt';
    if (enemy.state !== 'hunt') continue;
    enemy.angle = Math.atan2(dy, dx);
    if (dist > 240) {
      const nx = enemy.x + Math.cos(enemy.angle) * enemy.speed * dt;
      const ny = enemy.y + Math.sin(enemy.angle) * enemy.speed * dt;
      if (!world.city.solidAt(nx, ny, 10)) {
        enemy.x = nx;
        enemy.y = ny;
        enemy.walkPhase += dt * 10;
      }
    }
    enemy.shootCd -= dt;
    if (dist < 460 && enemy.shootCd <= 0) {
      enemy.shootCd = 1.2 + Math.random() * 0.8;
      shoot(world, enemy, enemy.angle + (Math.random() - 0.5) * 0.3, 'enemy', 9);
      if (world.audio) world.audio.gunshot();
    }
  }
}

export function stepPickups(world) {
  const player = world.player;
  if (player.car) return;
  for (const pickup of world.pickups) {
    if (pickup.taken) continue;
    pickup.bob += 0.05;
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 26) {
      pickup.taken = true;
      if (pickup.kind === 'health') {
        player.hp = Math.min(player.maxHp, player.hp + 40);
        spawnText(world.fx, player.x, player.y - 24, '+40 HP', '#7bf1a8');
      } else if (pickup.kind === 'armor') {
        player.armor = Math.min(PLAYER.maxArmor, player.armor + 50);
        spawnText(world.fx, player.x, player.y - 24, '+50 ARMOR', '#7cc7ff');
      } else {
        world.cash += 50;
        spawnText(world.fx, player.x, player.y - 24, '+$50', '#ffd166');
      }
      if (world.audio) world.audio.pickup();
    }
  }
}
