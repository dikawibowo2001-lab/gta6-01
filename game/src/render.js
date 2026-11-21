// The painter: the sun-soaked city, its cars and people, and every
// screen — title, pause, help, busted and flatlined. The camera follows
// Mara with a little lookahead; a shake value from the world jolts it
// when she takes a hit or a car slams into something.

import { BEACH_TOP, PALETTE, PORT_LEFT, ROAD_WIDTH, ROAD_X, ROAD_Y, SEA_TOP, WORLD } from './config.js';
import { drawEffects } from './particles.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_HELP = 'help';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 720;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawGround(world, camera) {
    const { city } = world;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, viewW, viewH);
    // City blocks: sidewalk slabs under the buildings.
    ctx.fillStyle = PALETTE.sidewalk;
    for (let ix = 0; ix < ROAD_X.length - 1; ix += 1) {
      for (let iy = 0; iy < ROAD_Y.length - 1; iy += 1) {
        const x = ROAD_X[ix] + ROAD_WIDTH / 2 - camera.x;
        const y = ROAD_Y[iy] + ROAD_WIDTH / 2 - camera.y;
        const w = ROAD_X[ix + 1] - ROAD_X[ix] - ROAD_WIDTH;
        const h = ROAD_Y[iy + 1] - ROAD_Y[iy] - ROAD_WIDTH;
        if (x + w < 0 || y + h < 0 || x > viewW || y > viewH) continue;
        ctx.fillRect(x, y, w, h);
      }
    }
    // Park lawn.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(city.parkBlock.x - camera.x, city.parkBlock.y - camera.y, city.parkBlock.w, city.parkBlock.h);
    // Port ground.
    ctx.fillStyle = PALETTE.portGround;
    ctx.fillRect(PORT_LEFT - camera.x, -camera.y, WORLD.width - PORT_LEFT, WORLD.height);
    // Beach and sea.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(-camera.x, BEACH_TOP - camera.y, WORLD.width, SEA_TOP - BEACH_TOP);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(-camera.x, SEA_TOP - camera.y, WORLD.width, WORLD.height - SEA_TOP);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let x = 0; x < WORLD.width; x += 90) {
      const wave = Math.sin(world.time * 1.4 + x * 0.02) * 4;
      ctx.fillRect(x - camera.x, SEA_TOP + 26 + wave - camera.y, 54, 3);
      ctx.fillRect(x + 40 - camera.x, SEA_TOP + 70 - wave - camera.y, 40, 3);
    }
    // Roads.
    for (const rx of ROAD_X) {
      const x = rx - ROAD_WIDTH / 2 - camera.x;
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(x, -camera.y, ROAD_WIDTH, WORLD.height);
      ctx.fillStyle = PALETTE.roadEdge;
      ctx.fillRect(x, -camera.y, 3, WORLD.height);
      ctx.fillRect(x + ROAD_WIDTH - 3, -camera.y, 3, WORLD.height);
    }
    for (const ry of ROAD_Y) {
      const y = ry - ROAD_WIDTH / 2 - camera.y;
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(-camera.x, y, WORLD.width, ROAD_WIDTH);
      ctx.fillStyle = PALETTE.roadEdge;
      ctx.fillRect(-camera.x, y, WORLD.width, 3);
      ctx.fillRect(-camera.x, y + ROAD_WIDTH - 3, WORLD.width, 3);
    }
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const rx of ROAD_X) {
      for (let y = 0; y < WORLD.height; y += 64) {
        ctx.fillRect(rx - 2 - camera.x, y + 14 - camera.y, 4, 28);
      }
    }
    for (const ry of ROAD_Y) {
      for (let x = 0; x < WORLD.width; x += 64) {
        ctx.fillRect(x + 14 - camera.x, ry - 2 - camera.y, 28, 4);
      }
    }
  }

  function drawBuildings(world, camera) {
    for (const b of world.city.buildings) {
      const x = b.x - camera.x;
      const y = b.y - camera.y;
      if (x + b.w < 0 || y + b.h < 0 || x > viewW || y > viewH) continue;
      const shadow = b.tall ? 14 : 7;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + shadow, y + shadow, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(x + 6, y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(x + 12 + cx * 26, y + 12 + cy * 26, 10, 8);
        }
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x + b.w * 0.3, y + b.h * 0.3, b.w * 0.4, b.h * 0.4);
      }
    }
    for (const c of world.city.containers) {
      const x = c.x - camera.x;
      const y = c.y - camera.y;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 4, y + 4, c.w, c.h);
      ctx.fillStyle = c.color;
      ctx.fillRect(x, y, c.w, c.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x + 4, y + 4, c.w - 8, 4);
    }
    for (const t of world.city.trees) {
      const x = t.x - camera.x;
      const y = t.y - camera.y;
      if (x < -30 || y < -30 || x > viewW + 30 || y > viewH + 30) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      if (t.palm) {
        ctx.strokeStyle = '#7f5539';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x + 3, y - 6);
        ctx.stroke();
        ctx.strokeStyle = '#2d6a4f';
        ctx.lineWidth = 2;
        for (let f = 0; f < 6; f += 1) {
          const a = (f / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x + 3, y - 6);
          ctx.quadraticCurveTo(x + 3 + Math.cos(a) * 9, y - 6 + Math.sin(a) * 9 - 3, x + 3 + Math.cos(a) * 14, y - 6 + Math.sin(a) * 14 + 4);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#2d6a4f';
        ctx.beginPath();
        ctx.arc(x, y, t.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#40916c';
        ctx.beginPath();
        ctx.arc(x - 3, y - 3, t.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCar(car, camera, time) {
    const x = car.x - camera.x;
    const y = car.y - camera.y;
    if (x < -80 || y < -80 || x > viewW + 80 || y > viewH + 80) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundedRect(ctx, -car.length / 2 + 3, -car.width / 2 + 4, car.length, car.width, 8);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#111111';
    const wheelY = car.width / 2 - 2;
    ctx.fillRect(-car.length / 2 + 6, -wheelY - 3, 12, 6);
    ctx.fillRect(-car.length / 2 + 6, wheelY - 3, 12, 6);
    ctx.fillRect(car.length / 2 - 18, -wheelY - 3, 12, 6);
    ctx.fillRect(car.length / 2 - 18, wheelY - 3, 12, 6);
    // Body.
    ctx.fillStyle = car.dead ? '#2b2b2b' : car.color;
    roundedRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 8);
    ctx.fill();
    if (car.type === 'police') {
      ctx.fillStyle = '#14213d';
      ctx.fillRect(-car.length / 2 + 8, -car.width / 2, car.length * 0.34, car.width);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 2, 3);
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#111111';
      ctx.fillRect(-6, -car.width / 2 - 3, 12, 6);
    }
    if (car.type === 'truck') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(-car.length / 2 + 4, -car.width / 2 + 4, car.length * 0.55, car.width - 8);
    }
    // Windshield and roof.
    ctx.fillStyle = car.dead ? '#333333' : '#bde0fe';
    roundedRect(ctx, car.length / 2 - 20, -car.width / 2 + 4, 12, car.width - 8, 3);
    ctx.fill();
    ctx.fillStyle = car.dead ? '#222222' : 'rgba(0,0,0,0.14)';
    roundedRect(ctx, -8, -car.width / 2 + 4, 16, car.width - 8, 3);
    ctx.fill();
    // Police light bar, flashing red and blue.
    if (car.type === 'police' && !car.dead) {
      const phase = Math.floor(time * 6 + car.sirenPhase) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-4, -car.width / 2 + 2, 8, 7);
      ctx.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
      ctx.fillRect(-4, car.width / 2 - 9, 8, 7);
    }
    // Damage: cracks and smoke tint.
    if (!car.dead && car.health < car.maxHealth * 0.5) {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(car.length / 2 - 6, -car.width / 2 + 4);
      ctx.lineTo(car.length / 2 - 14, 0);
      ctx.lineTo(car.length / 2 - 8, car.width / 2 - 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, skin, walkPhase, camera, gun) {
    const sx = x - camera.x;
    const sy = y - camera.y;
    if (sx < -30 || sy < -30 || sx > viewW + 30 || sy > viewH + 30) return;
    const step = Math.sin(walkPhase) * 4;
    const px = -Math.sin(angle);
    const py = Math.cos(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 6, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs.
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.arc(sx + px * 4 + Math.cos(angle) * step, sy + py * 4 + Math.sin(angle) * step, 3.4, 0, Math.PI * 2);
    ctx.arc(sx - px * 4 - Math.cos(angle) * step, sy - py * 4 - Math.sin(angle) * step, 3.4, 0, Math.PI * 2);
    ctx.fill();
    // Body and head.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    if (gun) {
      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(angle) * 8, sy + Math.sin(angle) * 8);
      ctx.lineTo(sx + Math.cos(angle) * 18, sy + Math.sin(angle) * 18);
      ctx.stroke();
    }
  }

  function drawPickups(world, camera) {
    for (const p of world.pickups) {
      if (p.taken) continue;
      const x = p.x - camera.x;
      const y = p.y - camera.y + Math.sin(p.bob) * 3;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (p.kind === 'health') {
        ctx.fillStyle = '#e63946';
        ctx.fillRect(x - 7, y - 2.5, 14, 5);
        ctx.fillRect(x - 2.5, y - 7, 5, 14);
      } else if (p.kind === 'armor') {
        ctx.fillStyle = '#4361ee';
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x + 7, y - 4);
        ctx.lineTo(x + 6, y + 4);
        ctx.lineTo(x, y + 9);
        ctx.lineTo(x - 6, y + 4);
        ctx.lineTo(x - 7, y - 4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#2a9d8f';
        ctx.fillRect(x - 8, y - 5, 16, 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', x, y + 4);
      }
    }
  }

  function drawMarker(world, camera, marker) {
    if (!marker) return;
    const x = marker.x - camera.x;
    const y = marker.y - camera.y;
    const pulse = 1 + Math.sin(world.time * 4) * 0.12;
    // A column of light, so the goal reads from anywhere on screen.
    const gradient = ctx.createLinearGradient(0, y - 160, 0, y);
    gradient.addColorStop(0, 'rgba(255, 214, 10, 0)');
    gradient.addColorStop(1, 'rgba(255, 214, 10, 0.35)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 10 * pulse, y - 160, 20 * pulse, 160);
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, 26 * pulse, 12 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y - 34);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd60a';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(marker.label, x, y - 52);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(marker.label, x, y - 52);
  }

  function drawWorld(world, marker) {
    const camera = world.camera;
    drawGround(world, camera);
    drawBuildings(world, camera);
    drawPickups(world, camera);
    for (const car of world.cars) drawCar(car, camera, world.time);
    for (const ped of world.peds) {
      if (ped.down) {
        const sx = ped.x - camera.x;
        const sy = ped.y - camera.y;
        ctx.fillStyle = ped.shirt;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 11, 6, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.walkPhase, camera, false);
    }
    for (const cop of world.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#14213d', '#e0ac69', world.time * 10, camera, world.wanted.stars >= 3);
    }
    for (const enemy of world.enemies) {
      if (enemy.dead) continue;
      drawPerson(enemy.x, enemy.y, enemy.angle, '#7f1d1d', '#c68642', enemy.walkPhase, camera, true);
    }
    if (world.juno && !world.juno.boarded) {
      drawPerson(world.juno.x, world.juno.y, -Math.PI / 2, '#2a9d8f', '#ffdbac', 0, camera, false);
      ctx.strokeStyle = '#7bf1a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(world.juno.x - camera.x, world.juno.y - camera.y, 16 + Math.sin(world.time * 4) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    const player = world.player;
    if (!player.car) {
      drawPerson(player.x, player.y, player.angle, '#e63946', '#f1c27d', player.walkPhase, camera, true);
    }
    // Bullets as bright tracers.
    ctx.strokeStyle = '#ffe66d';
    ctx.lineWidth = 2;
    for (const b of world.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - camera.x, b.y - camera.y);
      ctx.lineTo(b.x - b.vx * 0.02 - camera.x, b.y - b.vy * 0.02 - camera.y);
      ctx.stroke();
    }
    drawEffects(ctx, world.fx, camera);
    drawMarker(world, camera, marker);
  }

  function dayTint(world) {
    const hour = world.clockMinutes / 60;
    if (hour < 11 || hour > 19) return 'rgba(255, 170, 60, 0.10)';
    if (hour > 16.5) return 'rgba(255, 140, 60, 0.14)';
    return 'rgba(255, 220, 120, 0.04)';
  }

  function overlay(alpha) {
    ctx.fillStyle = `rgba(8, 10, 18, ${alpha})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  function bigTitle(text, y, size, color) {
    ctx.font = `bold ${size}px Verdana, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(text, viewW / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(text, viewW / 2, y);
  }

  function menuList(items, selected, y, gap = 44) {
    items.forEach((item, i) => {
      const yy = y + i * gap;
      ctx.font = i === selected ? 'bold 21px Verdana, sans-serif' : '19px Verdana, sans-serif';
      ctx.textAlign = 'center';
      if (i === selected) {
        ctx.fillStyle = 'rgba(255, 214, 10, 0.18)';
        const w = ctx.measureText(item).width + 56;
        ctx.beginPath();
        ctx.roundRect(viewW / 2 - w / 2, yy - 28, w, 38, 8);
        ctx.fill();
        ctx.fillStyle = '#ffd60a';
      } else {
        ctx.fillStyle = '#ffffff';
      }
      ctx.fillText(item, viewW / 2, yy);
    });
  }

  function drawTitle(world, ui) {
    drawWorld(world, null);
    const gradient = ctx.createLinearGradient(0, 0, 0, viewH);
    gradient.addColorStop(0, 'rgba(8, 10, 18, 0.55)');
    gradient.addColorStop(0.55, 'rgba(8, 10, 18, 0.25)');
    gradient.addColorStop(1, 'rgba(8, 10, 18, 0.75)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, viewW, viewH);
    // The sun.
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.arc(viewW / 2, 118, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 214, 10, 0.25)';
    ctx.beginPath();
    ctx.arc(viewW / 2, 118, 52, 0, Math.PI * 2);
    ctx.fill();
    bigTitle('SOLMAR BAY', 220, 64, '#ffffff');
    ctx.font = 'bold 19px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd60a';
    ctx.fillText('S U N ,  S A N D  &  S I R E N S', viewW / 2, 252);
    const items = ui.hasSave ? ['New Game', 'Continue', 'How to Play'] : ['New Game', 'How to Play'];
    menuList(items, ui.menuIndex, 330);
    ctx.font = '14px Verdana, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Steal cars. Outrun the law. Run the jobs. Own the bay.', viewW / 2, viewH - 108);
    ctx.font = '13px Verdana, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('WASD move  •  Mouse aim  •  Click shoot  •  E enter car  •  Space handbrake  •  P pause  •  M mute', viewW / 2, viewH - 78);
    ctx.fillText('An original story. No connection to any commercial game.', viewW / 2, viewH - 52);
  }

  function drawPaused(world, ui) {
    drawWorld(world, ui.marker);
    overlay(0.55);
    bigTitle('PAUSED', 200, 44, '#ffffff');
    menuList(['Resume', 'Restart Run', 'How to Play', 'Quit to Title'], ui.menuIndex, 280);
  }

  function drawHelp(world) {
    drawWorld(world, null);
    overlay(0.72);
    bigTitle('HOW TO PLAY', 110, 36, '#ffd60a');
    const lines = [
      ['Move / drive', 'WASD or arrow keys'],
      ['Sprint (on foot)', 'Shift'],
      ['Aim / shoot', 'Mouse + left click'],
      ['Enter / exit car', 'E — walk up to any car'],
      ['Handbrake', 'Space (while driving)'],
      ['Punch', 'Left click with no ammo, or walk into trouble'],
      ['Pause', 'P or Esc'],
      ['Help', 'H'],
      ['Mute', 'M'],
      ['Restart', 'R'],
      ['', ''],
      ['Stealing cars, hitting people and shooting raise your wanted level.'],
      ['Lose the cops by hiding; get busted standing still next to one.'],
      ['Jobs pay cash. Cash is yours to keep — spend it on nothing, yet.'],
    ];
    ctx.textAlign = 'left';
    let y = 170;
    for (const [key, value] of lines) {
      ctx.font = 'bold 15px Verdana, sans-serif';
      ctx.fillStyle = '#ffd60a';
      ctx.fillText(key, viewW / 2 - 320, y);
      ctx.font = '15px Verdana, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(value, viewW / 2 - 120, y);
      y += 30;
    }
    ctx.font = '14px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Press H or Esc to go back', viewW / 2, viewH - 60);
  }

  function drawEnd(world, title, subtitle, color) {
    drawWorld(world, null);
    overlay(0.6);
    bigTitle(title, viewH / 2 - 40, 58, color);
    ctx.font = '18px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(subtitle, viewW / 2, viewH / 2 + 4);
    ctx.font = '15px Verdana, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Press Enter to continue', viewW / 2, viewH / 2 + 44);
  }

  return {
    resize,
    get view() {
      return { w: viewW, h: viewH };
    },
    draw(world, screen, ui) {
      ctx.clearRect(0, 0, viewW, viewH);
      if (screen === SCREEN_TITLE) {
        drawTitle(world, ui);
        return;
      }
      if (screen === SCREEN_PAUSED) {
        drawPaused(world, ui);
        return;
      }
      if (screen === SCREEN_HELP) {
        drawHelp(world);
        return;
      }
      if (screen === SCREEN_BUSTED) {
        drawEnd(world, 'BUSTED', `Solmar PD took $${world.lastFine} off you. The crew will hear about this.`, '#4cc9f0');
        return;
      }
      if (screen === SCREEN_WASTED) {
        drawEnd(world, 'FLATLINED', `Bay General patched you up for $${world.lastFine}. Take better care out there.`, '#ff4d4d');
        return;
      }
      drawWorld(world, ui.marker);
      // Warm daylight over everything.
      ctx.fillStyle = dayTint(world);
      ctx.fillRect(0, 0, viewW, viewH);
      // Low-health heartbeat.
      if (world.player.hp > 0 && world.player.hp <= 30 && !world.player.car) {
        const pulse = 0.1 + 0.08 * Math.sin(world.time * 6);
        const gradient = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.3, viewW / 2, viewH / 2, viewH * 0.75);
        gradient.addColorStop(0, 'rgba(255,0,0,0)');
        gradient.addColorStop(1, `rgba(255,0,0,${pulse})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, viewW, viewH);
      }
    },
  };
}
