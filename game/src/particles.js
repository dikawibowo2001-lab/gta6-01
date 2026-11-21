// Juice: short-lived particles (sparks, smoke, muzzle flashes, splashes),
// floating damage numbers, and skid marks left by hard driving. None of
// it affects the simulation; it only makes the city feel alive.

export function createEffects() {
  return { particles: [], texts: [], skids: [] };
}

export function spawnParticles(fx, x, y, opts) {
  const count = opts.count ?? 8;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (opts.speed ?? 120) * (0.4 + Math.random() * 0.8);
    fx.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed + (opts.vx ?? 0),
      vy: Math.sin(angle) * speed + (opts.vy ?? 0),
      life: opts.life ?? 0.5,
      maxLife: opts.life ?? 0.5,
      size: (opts.size ?? 4) * (0.6 + Math.random() * 0.8),
      color: opts.color ?? '#ffd166',
      gravity: opts.gravity ?? 0,
      drag: opts.drag ?? 2,
    });
  }
}

export function spawnText(fx, x, y, text, color = '#ffffff') {
  fx.texts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

export function addSkid(fx, x, y, angle) {
  const last = fx.skids[fx.skids.length - 1];
  if (last && Math.hypot(x - last.x, y - last.y) < 6) return;
  fx.skids.push({ x, y, angle, life: 4 });
  if (fx.skids.length > 220) fx.skids.splice(0, fx.skids.length - 220);
}

export function stepEffects(fx, dt) {
  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    const drag = Math.max(0, 1 - p.drag * dt);
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = fx.texts.length - 1; i >= 0; i -= 1) {
    const t = fx.texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) fx.texts.splice(i, 1);
  }
  for (let i = fx.skids.length - 1; i >= 0; i -= 1) {
    fx.skids[i].life -= dt;
    if (fx.skids[i].life <= 0) fx.skids.splice(i, 1);
  }
}

export function drawEffects(ctx, fx, camera) {
  for (const s of fx.skids) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, s.life / 4) * 0.6;
    ctx.translate(s.x - camera.x, s.y - camera.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = '#1c1a18';
    ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
  }
  for (const p of fx.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, p.size * (0.5 + 0.5 * (p.life / p.maxLife)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const t of fx.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.font = 'bold 15px Verdana, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#111111';
    ctx.strokeText(t.text, t.x - camera.x, t.y - camera.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x - camera.x, t.y - camera.y);
  }
  ctx.globalAlpha = 1;
}
