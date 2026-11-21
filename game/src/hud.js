// Solmar Bay v4 — the DOM heads-up display.
//
// Everything the player reads lives here: health/armor bars, cash,
// wanted stars, weapon + ammo, the radio ticker, speed, respect,
// objectives, toasts, dialogue, the weapon wheel, the garage shop,
// the pause screen and the 2D minimap. The game logic calls into
// this module; this module never calls back into game logic except
// through the button handlers it wires up itself.

import { WEAPONS } from './weapons.js';
import { RACE_GATES } from './races.js';

function el(id) {
  return document.getElementById(id);
}

export function makeHud(G) {
  let toastTimer = null;
  let dialogueTimer = null;
  const minimap = el('minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;

  function setText(id, text) {
    const n = el(id);
    if (n && n.textContent !== text) n.textContent = text;
  }

  function toast(msg) {
    const t = el('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  function showDialogue(name, text) {
    setText('dialogue-name', name);
    setText('dialogue-text', text);
    const d = el('dialogue');
    if (d) d.classList.add('show');
    clearTimeout(dialogueTimer);
    dialogueTimer = setTimeout(() => d && d.classList.remove('show'), 4500);
  }

  function setObjective(text) {
    setText('objective', text);
  }

  // --- weapon wheel ---------------------------------------------------
  function buildWheel() {
    const wheel = el('wheel');
    if (!wheel) return;
    wheel.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const card = document.createElement('div');
      card.className = 'wheel-item';
      card.dataset.idx = String(i);
      const angle = (i / WEAPONS.length) * Math.PI * 2 - Math.PI / 2;
      const r = 105;
      card.style.left = `${150 + Math.cos(angle) * r - 52}px`;
      card.style.top = `${150 + Math.sin(angle) * r - 34}px`;
      card.innerHTML = `<div class="wheel-icon">${w.icon}</div><div class="wheel-name">${w.name}</div><div class="wheel-key">${i + 1}</div>`;
      card.addEventListener('click', () => {
        G.weapons.select(i);
        closeWheel();
      });
      wheel.appendChild(card);
    });
    const hub = document.createElement('div');
    hub.className = 'wheel-hub';
    hub.textContent = 'SENJATA';
    wheel.appendChild(hub);
  }

  function refreshWheel() {
    const wheel = el('wheel');
    if (!wheel) return;
    wheel.querySelectorAll('.wheel-item').forEach((card) => {
      const idx = Number(card.dataset.idx);
      card.classList.toggle('selected', idx === G.weapons.current);
      card.classList.toggle('locked', !G.weapons.unlocked[idx]);
    });
  }

  function openWheel() {
    G.weapons.wheelOpen = true;
    const wheel = el('wheel');
    if (wheel) wheel.classList.add('show');
    refreshWheel();
  }

  function closeWheel() {
    G.weapons.wheelOpen = false;
    const wheel = el('wheel');
    if (wheel) wheel.classList.remove('show');
  }

  // --- garage shop ------------------------------------------------------
  function refreshGarage() {
    const list = el('garage-items');
    if (!list) return;
    setText('garage-cash', `$${G.player.cash}`);
    list.innerHTML = '';
    for (const item of G.garage.items()) {
      const row = document.createElement('div');
      row.className = 'garage-row';
      row.innerHTML = `
        <div class="garage-info"><b>${item.name}</b><span>${item.desc}</span></div>
        <div class="garage-price">$${item.price}</div>
        <button class="garage-buy" ${item.owned || !item.affordable ? 'disabled' : ''}>${item.owned ? 'DIPASANG ✓' : 'BELI'}</button>`;
      const btn = row.querySelector('.garage-buy');
      btn.addEventListener('click', () => G.garage.buy(item.id));
      list.appendChild(row);
    }
  }

  function openGarage() {
    const g = el('garage');
    if (g) g.classList.add('show');
    refreshGarage();
  }

  function closeGarage() {
    const g = el('garage');
    if (g) g.classList.remove('show');
  }

  // --- title + pause ------------------------------------------------------
  function showTitle() {
    const t = el('title-screen');
    if (t) t.classList.add('show');
  }

  function hideTitle() {
    const t = el('title-screen');
    if (t) t.classList.remove('show');
  }

  function refreshPause() {
    setText('pause-rank', G.progression.rank);
    const next = G.progression.nextRank;
    setText('pause-respect', next
      ? `${G.player.respect} / ${next.need} respect`
      : `${G.player.respect} respect — rank tertinggi!`);
    const bar = el('respect-fill');
    if (bar) {
      const need = next ? next.need : G.player.respect + 1;
      bar.style.width = `${Math.min(100, (G.player.respect / need) * 100)}%`;
    }
    const turf = el('turf-list');
    if (turf) {
      turf.innerHTML = '';
      for (const [name, value] of Object.entries(G.progression.turf)) {
        const row = document.createElement('div');
        row.className = 'turf-row';
        row.innerHTML = `<span>${name}</span><div class="turf-bar"><div class="turf-fill" style="width:${value}%"></div></div><b>${value}%</b>`;
        turf.appendChild(row);
      }
    }
    const missions = el('mission-list');
    if (missions) {
      missions.innerHTML = '';
      G.missions.list.forEach((m, i) => {
        const done = G.missions.completed.has(i);
        const current = G.missions.current && G.missions.current.idx === i;
        const locked = !G.progression.canStart(i);
        const row = document.createElement('div');
        row.className = `mission-row${current ? ' current' : ''}${done ? ' done' : ''}${locked ? ' locked' : ''}`;
        row.innerHTML = `<span class="mission-num">${i + 1}</span><b>${m.title}</b><span>${done ? '✓ SELESAI' : current ? '▶ BERJALAN' : locked ? `🔒 ${G.progression.requiredRank(i)}` : '○ TERSEDIA'}</span>`;
        if (!done && !locked && !current) {
          row.addEventListener('click', () => {
            G.missions.start(i);
            G.togglePause(false);
          });
        }
        missions.appendChild(row);
      });
    }
  }

  function showPause() {
    refreshPause();
    const p = el('pause-screen');
    if (p) p.classList.add('show');
  }

  function hidePause() {
    const p = el('pause-screen');
    if (p) p.classList.remove('show');
  }

  // --- minimap -------------------------------------------------------------
  function drawMinimap() {
    if (!mctx) return;
    const S = 180;
    const half = 210;
    const toMap = (x, z) => [(x + half) / (half * 2) * S, (z + half) / (half * 2) * S];
    mctx.fillStyle = '#101018';
    mctx.fillRect(0, 0, S, S);
    // Ocean strip on the west.
    mctx.fillStyle = '#14486b';
    const [ox] = toMap(-210, 0);
    const [ox2] = toMap(-168, 0);
    mctx.fillRect(0, 0, ox2 - ox, S);
    // Roads.
    mctx.strokeStyle = '#3a3a44';
    mctx.lineWidth = 2;
    for (let k = -5; k <= 5; k += 1) {
      const [x1, y1] = toMap(k * 32, -210);
      const [, y2] = toMap(k * 32, 210);
      mctx.beginPath();
      mctx.moveTo(x1, y1);
      mctx.lineTo(x1, y2);
      mctx.stroke();
      const [x3, y3] = toMap(-210, k * 32);
      const [x4] = toMap(210, k * 32);
      mctx.beginPath();
      mctx.moveTo(x3, y3);
      mctx.lineTo(x4, y3);
      mctx.stroke();
    }
    // Buildings.
    mctx.fillStyle = '#55555f';
    for (const c of G.city.colliders) {
      const [x1, y1] = toMap(c.minX, c.minZ);
      const [x2, y2] = toMap(c.maxX, c.maxZ);
      mctx.fillRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));
    }
    const blip = (x, z, color, r = 3) => {
      const [mx, my] = toMap(x, z);
      mctx.fillStyle = color;
      mctx.beginPath();
      mctx.arc(mx, my, r, 0, Math.PI * 2);
      mctx.fill();
    };
    // Garage, race start, NPCs.
    blip(G.city.garagePos[0], G.city.garagePos[2], '#3ddc5f', 4);
    blip(G.city.raceStart[0], G.city.raceStart[2], '#ffffff', 4);
    for (const n of G.npcs.npcs) blip(n.pos[0], n.pos[2], '#22d3ee', 2.5);
    // Mission marker / current objective.
    const next = G.missions.nextAvailable;
    if (next >= 0) {
      const m = G.missions.list[next];
      blip(m.startPos[0], m.startPos[2], '#ffd21f', 4);
    }
    const st = G.missions.currentStage;
    if (st && st.pos) blip(st.pos[0], st.pos[2], '#ff5c39', 5);
    // Race gates.
    if (G.races.active) {
      for (const g of RACE_GATES) blip(g[0], g[2], '#ff9f1c', 3);
    }
    // Cops and enemies.
    for (const car of G.cars) {
      if (car.kind === 'cop' && !car.dead) blip(car.pos[0], car.pos[2], '#3b82f6', 3);
    }
    for (const e of G.enemies) if (!e.dead) blip(e.pos[0], e.pos[2], '#ef4444', 3);
    if (G.police.heli) blip(G.police.heli.pos[0], G.police.heli.pos[2], '#60a5fa', 4);
    // Player arrow.
    const [px, py] = toMap(G.player.pos[0], G.player.pos[2]);
    const a = G.player.car ? G.player.car.angle : G.player.angle;
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.PI - a);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -6);
    mctx.lineTo(4.5, 5);
    mctx.lineTo(-4.5, 5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  // --- per-frame refresh -----------------------------------------------------
  function update() {
    const p = G.player;
    const hp = el('health-fill');
    if (hp) hp.style.width = `${Math.max(0, p.health)}%`;
    const ar = el('armor-fill');
    if (ar) ar.style.width = `${Math.max(0, p.armor)}%`;
    setText('cash', `$${p.cash}`);
    setText('wanted', '★'.repeat(G.police.wanted) + '☆'.repeat(5 - G.police.wanted));
    const w = G.weapons.currentWeapon;
    const ammo = G.weapons.currentAmmo;
    setText('weapon-name', w.name);
    setText('ammo', Number.isFinite(ammo) ? String(ammo) : '∞');
    setText('radio-ticker', `${G.radio.name} ${G.radio.freq} — ${G.radio.track}`);
    const speed = p.car ? Math.abs(p.car.speed) * 3.6
      : p.boat ? Math.abs(p.boat.speed) * 3.6 : 0;
    setText('speed', `${Math.round(speed)} km/h`);
    setText('respect', `${G.progression.rank} • ${p.respect} respect`);
    // Mission timer.
    const cur = G.missions.current;
    const st = G.missions.currentStage;
    if (cur && st && (st.type === 'survive' || st.type === 'timedGoto')) {
      setText('objective', `${st.text} — ${Math.ceil(cur.timer)} dtk`);
    }
    // Race overlay.
    const race = G.races.active;
    const raceEl = el('race-info');
    if (raceEl) {
      if (race && !race.finished) {
        raceEl.classList.add('show');
        const cd = race.countdown > 0 ? ` — ${Math.ceil(race.countdown)}` : '';
        setText('race-pos', `POS ${race.position}/4`);
        setText('race-gate', `GERBANG ${Math.min(race.playerGate + 1, RACE_GATES.length)}/${RACE_GATES.length}`);
        setText('race-time', `${race.time.toFixed(1)} dtk${cd}`);
      } else {
        raceEl.classList.remove('show');
      }
    }
    // Crew cooldown buttons.
    G.crew.abilities.forEach((ab, i) => {
      const btn = el(`crew-${i}`);
      if (!btn) return;
      const cd = G.crew.cooldowns[i];
      btn.textContent = cd > 0 ? `${ab.name.split('—')[0].trim()} (${Math.ceil(cd)})` : ab.name;
      btn.classList.toggle('cooling', cd > 0);
    });
    // Context hint.
    const hint = [];
    if (G.npcs.nearest()) hint.push('E — Ngobrol');
    else if (G.boats.nearestBoat(p.pos, 5)) hint.push('E — Naik perahu');
    if (p.onFoot && G.vehicles.nearestCar(p.pos, 4.5)) hint.push('F — Masuk mobil');
    if (G.garage.nearGarage() && !G.garage.open) hint.push('G — Bengkel');
    if (G.missions.nearestStartMarker() !== null) hint.push('E — Mulai misi');
    if (G.races.active === null && p.car) {
      const s = G.city.raceStart;
      if (Math.hypot(p.pos[0] - s[0], p.pos[2] - s[2]) < 10) hint.push('E — Ikut balapan');
    }
    setText('hint', hint.join('  •  '));
    drawMinimap();
  }

  buildWheel();
  // Wire the static buttons.
  const startBtn = el('start-btn');
  if (startBtn) startBtn.addEventListener('click', () => G.startGame());
  const resumeBtn = el('resume-btn');
  if (resumeBtn) resumeBtn.addEventListener('click', () => G.togglePause(false));
  const closeGarageBtn = el('garage-close');
  if (closeGarageBtn) closeGarageBtn.addEventListener('click', () => G.garage.closeShop());
  const radioBtn = el('radio-ticker');
  if (radioBtn) radioBtn.addEventListener('click', () => G.radio.next());
  G.crew.abilities.forEach((ab, i) => {
    const btn = el(`crew-${i}`);
    if (btn) btn.addEventListener('click', () => G.crew.use(i));
  });

  return {
    toast,
    showDialogue,
    setObjective,
    openWheel,
    closeWheel,
    refreshWheel,
    openGarage,
    closeGarage,
    refreshGarage,
    showTitle,
    hideTitle,
    showPause,
    hidePause,
    refreshPause,
    update,
    drawMinimap,
  };
}
