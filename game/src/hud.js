// The heads-up display: minimap, wanted stars, health and armour bars,
// cash, ammo, speed, the clock, the mission objective, and the banners
// and panels that tell Mara what is happening. The minimap's city base
// is painted once to an offscreen canvas; only the blips move.

import { ROAD_WIDTH, ROAD_X, ROAD_Y, WORLD } from './config.js';

const MAP_W = 208;
const MAP_H = 156;

function panel(ctx, x, y, w, h, alpha = 0.62) {
  ctx.fillStyle = `rgba(10, 10, 14, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, fraction, color, bg = 'rgba(255,255,255,0.18)') {
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  if (fraction > 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w * Math.max(0, Math.min(1, fraction)), h, 4);
    ctx.fill();
  }
}

function star(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd60a' : 'rgba(255, 255, 255, 0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function createMinimapBase(city) {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d');
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;
  ctx.fillStyle = '#5d9c59';
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  // Sea and sand.
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(0, 2120 * sy, MAP_W, (2280 - 2120) * sy);
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(0, 2280 * sy, MAP_W, MAP_H - 2280 * sy);
  // Port ground.
  ctx.fillStyle = '#9a8c98';
  ctx.fillRect(2880 * sx, 0, MAP_W - 2880 * sx, MAP_H);
  // Park.
  ctx.fillStyle = '#4a8c46';
  ctx.fillRect(city.parkBlock.x * sx, city.parkBlock.y * sy, city.parkBlock.w * sx, city.parkBlock.h * sy);
  // Roads.
  ctx.fillStyle = '#3d3a38';
  for (const rx of ROAD_X) ctx.fillRect((rx - ROAD_WIDTH / 2) * sx, 0, ROAD_WIDTH * sx, MAP_H);
  for (const ry of ROAD_Y) ctx.fillRect(0, (ry - ROAD_WIDTH / 2) * sy, MAP_W, ROAD_WIDTH * sy);
  // Buildings, as pale blocks.
  ctx.fillStyle = 'rgba(255, 240, 220, 0.75)';
  for (const b of city.buildings) {
    ctx.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  }
  return canvas;
}

function blip(ctx, x, y, color, size = 3) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawMinimap(ctx, world, base, marker, viewW, viewH) {
  const x0 = 16;
  const y0 = viewH - MAP_H - 16;
  panel(ctx, x0 - 4, y0 - 4, MAP_W + 8, MAP_H + 8, 0.7);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, MAP_W, MAP_H);
  ctx.clip();
  ctx.drawImage(base, x0, y0);
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;
  // Mission marker: a pulsing diamond.
  if (marker) {
    const pulse = 4 + Math.sin(world.time * 5) * 1.5;
    ctx.save();
    ctx.translate(x0 + marker.x * sx, y0 + marker.y * sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd60a';
    ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
    ctx.restore();
  }
  for (const car of world.cars) {
    if (car.dead) continue;
    if (car.role === 'police') blip(ctx, x0 + car.x * sx, y0 + car.y * sy, '#4cc9f0', 3.5);
    else if (car.role === 'player') continue;
    else blip(ctx, x0 + car.x * sx, y0 + car.y * sy, '#ffe66d', 2.5);
  }
  for (const enemy of world.enemies) {
    if (!enemy.dead) blip(ctx, x0 + enemy.x * sx, y0 + enemy.y * sy, '#ff4d4d', 3);
  }
  if (world.juno && !world.juno.boarded) {
    blip(ctx, x0 + world.juno.x * sx, y0 + world.juno.y * sy, '#7bf1a8', 3.5);
  }
  // The player: a white arrow that turns with them.
  const player = world.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const heading = player.car ? player.car.angle : player.angle;
  ctx.save();
  ctx.translate(x0 + px * sx, y0 + py * sy);
  ctx.rotate(heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  // North marker.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x0 + MAP_W / 2, y0 + 11);
}

export function formatClock(minutes) {
  const total = Math.floor(minutes) % (24 * 60);
  let hour = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function drawHUD(ctx, world, viewW, viewH, minimapBase, marker, objective) {
  const player = world.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Mission objective, top left.
  if (objective) {
    ctx.font = 'bold 15px Verdana, sans-serif';
    const w = Math.min(viewW - 40, ctx.measureText(objective).width + 44);
    panel(ctx, 16, 14, w, 44);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('JOB', 28, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px Verdana, sans-serif';
    ctx.fillText(objective, 28, 50);
  }

  // Wanted stars and cash, top right.
  const stars = world.wanted.stars;
  panel(ctx, viewW - 216, 14, 200, 62);
  for (let i = 0; i < 5; i += 1) star(ctx, viewW - 192 + i * 26, 34, 10, i < stars);
  ctx.font = 'bold 18px Verdana, sans-serif';
  ctx.fillStyle = '#7bf1a8';
  ctx.textAlign = 'right';
  ctx.fillText(`$${world.cash.toLocaleString('en-US')}`, viewW - 28, 66);
  ctx.textAlign = 'left';

  // Clock, top centre.
  ctx.font = 'bold 14px Verdana, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(formatClock(world.clockMinutes), viewW / 2, 30);
  ctx.textAlign = 'left';

  // Health and armour, above the minimap.
  const barX = 16;
  const barY = viewH - MAP_H - 62;
  ctx.font = 'bold 12px Verdana, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HP', barX, barY + 11);
  bar(ctx, barX + 58, barY, 142, 12, player.hp / player.maxHp, player.hp > 30 ? '#7bf1a8' : '#ff4d4d');
  ctx.fillText('ARMOR', barX, barY + 29);
  bar(ctx, barX + 58, barY + 18, 142, 12, player.armor / 100, '#7cc7ff');

  drawMinimap(ctx, world, minimapBase, marker, viewW, viewH);

  // Ammo and speed, bottom right.
  panel(ctx, viewW - 176, viewH - 76, 160, 60);
  ctx.font = 'bold 16px Verdana, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  if (player.car) {
    const mph = Math.round(Math.abs(player.car.speed) * 0.09);
    ctx.fillText(`${mph} mph`, viewW - 28, viewH - 52);
    ctx.font = '12px Verdana, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(player.car.type.toUpperCase(), viewW - 28, viewH - 32);
  } else {
    ctx.fillText(player.reloading > 0 ? 'RELOADING…' : `${player.ammo} / ∞`, viewW - 28, viewH - 52);
    ctx.font = '12px Verdana, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('PISTOL', viewW - 28, viewH - 32);
  }
  ctx.textAlign = 'left';

  // Car health, when driving a damaged car.
  if (player.car && player.car.health < player.car.maxHealth) {
    const car = player.car;
    ctx.font = 'bold 12px Verdana, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CAR', viewW - 176, viewH - 88);
    bar(ctx, viewW - 136, viewH - 98, 120, 10, car.health / car.maxHealth, '#ff9f1c');
  }

  // Bust progress: the ring of pressure closing in.
  if (world.wanted.bustTimer > 0) {
    const f = world.wanted.bustTimer / 2.2;
    ctx.font = 'bold 20px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4d4d';
    ctx.fillText('BUSTED IN…', viewW / 2, 96);
    bar(ctx, viewW / 2 - 110, 106, 220, 12, f, '#ff4d4d');
    ctx.textAlign = 'left';
  }

  // Centre banner.
  if (world.banner && world.time < world.banner.until) {
    const alpha = Math.min(1, (world.banner.until - world.time) / 0.5);
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 26px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(world.banner.text, viewW / 2, 130);
    ctx.fillStyle = world.banner.color;
    ctx.fillText(world.banner.text, viewW / 2, 130);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // Mission briefing card, bottom centre.
  if (world.briefing && world.time < world.briefing.until) {
    const w = Math.min(560, viewW - 60);
    const x = (viewW - w) / 2;
    const y = viewH - 210;
    panel(ctx, x, y, w, 96, 0.78);
    ctx.font = 'bold 14px Verdana, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`${world.briefing.title} — ${world.briefing.giver}`, x + 16, y + 22);
    ctx.font = '13px Verdana, sans-serif';
    ctx.fillStyle = '#ffffff';
    wrapText(ctx, world.briefing.text, x + 16, y + 42, w - 32, 17);
  }

  // Mission-complete card.
  if (world.missionComplete && world.time < world.missionComplete.until) {
    const w = 420;
    const x = (viewW - w) / 2;
    const y = viewH / 2 - 90;
    panel(ctx, x, y, w, 130, 0.85);
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Verdana, sans-serif';
    ctx.fillStyle = '#7bf1a8';
    ctx.fillText('JOB COMPLETE', viewW / 2, y + 38);
    ctx.font = 'bold 16px Verdana, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(world.missionComplete.title, viewW / 2, y + 66);
    ctx.font = 'bold 22px Verdana, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`+$${world.missionComplete.reward}`, viewW / 2, y + 100);
    ctx.textAlign = 'left';
  }
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
