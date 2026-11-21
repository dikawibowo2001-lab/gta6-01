# Solmar Bay — Sun, Sand & Sirens

An original open-world crime game for the web, built for make.fun's
gta6-01 bounty. You are Mara Vega, a getaway driver fresh out of a bad
deal, back in the sunny coastal city of Solmar Bay. The Harbor Crew needs
a wheelwoman: steal cars, outrun Solmar PD, run jobs across downtown, the
beach and the container port, and earn your way back into the crew's good
graces.

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dikawibowo2001-lab/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dikawibowo2001-lab/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

## Play

Open `game/index.html` from any static file server — no build step, no
network request, everything the game loads is a file under `game/`.

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
```

## Controls

- **Move / drive:** WASD or arrow keys
- **Sprint (on foot):** Shift
- **Aim / shoot:** Mouse + left click (punch when the pistol is empty)
- **Enter / exit car:** E — walk up to any car, police cruisers included
- **Handbrake:** Space (while driving)
- **Pause:** P or Esc — **Help:** H — **Mute:** M — **Restart:** R

## The game

- **A city to roam:** downtown, beach, park and container port on a
  3200×2400 map, on foot or behind the wheel, with a camera that follows
  and a day clock that warms the light toward evening.
- **Traffic and people:** AI cars drive the roads and wait at
  intersections; pedestrians stroll the sidewalks and scatter when
  shooting or crashes break out.
- **Stealable cars:** sedans, hatchbacks, taxis, trucks and police
  cruisers, each with its own handling and health. Damage one badly
  enough and it smokes, then burns.
- **Wanted level:** stealing cars, hitting people and shooting raise your
  heat from 1 to 5 stars. Police cruisers chase and ram; foot cops try
  to bust you; at high heat they shoot. Hide to cool off — or get
  busted and pay the fine.
- **Four jobs with a story:** a first car theft, a timed delivery, a
  rescue at the port, and a final getaway against three stars — each
  with a briefing, an objective marker on the minimap, and a cash
  reward. Drive to the Hideout to start the next job.
- **Combat:** a pistol with ammo and reloads, melee punches, enemies
  that shoot back, health and armour, and pickups scattered around the
  city.
- **HUD:** live minimap (player, cars, police, mission marker, north),
  wanted stars, health and armour bars, cash, ammo, speed, clock and
  the current objective.
- **Feel:** exhaust and skid marks, muzzle flashes, floating damage
  numbers, screen shake, and a fully synthesized WebAudio soundscape —
  engine hum, sirens, gunshots and an ambient chord-pad loop (M to
  mute). No audio files, no network requests.
- **Progress:** cash, completed jobs and best stats are kept in
  `localStorage` — Continue picks up where you left off.

## Layout

- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  the output directory and writes `dossier.json`.
- `game/index.html` — the playable page (one canvas, ES modules).
- `game/src/` — the game's own source, one job per file:
  `config.js` (tuning), `random.js` (seeded RNG), `audio.js` (synth
  sound), `input.js` (keyboard and mouse), `city.js` (map generation),
  `entities.js` (player and pedestrians), `vehicles.js` (cars and
  driving), `traffic.js` (AI drivers), `police.js` (wanted level and
  cop AI), `combat.js` (bullets, enemies, pickups), `missions.js`
  (story and objectives), `particles.js` (effects), `hud.js` (HUD and
  minimap), `render.js` (canvas drawing and screens), `world.js`
  (simulation step), `shots.js` (deterministic screenshot scenes),
  `main.js` (boot and loop).
- `screenshots/` — 4 real renders of the game (title, driving, police
  chase, job complete), listed in `shots.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## Screenshot scenes

The game stages deterministic scenes for screenshots:

```text
?shot=title&seed=7    ?shot=drive&seed=7    ?shot=chase&seed=7    ?shot=mission&seed=7
```

Each scene plays the real rules forward from a fixed seed and sets
`window.__shotReady` once painted. Capture at 1280x720 as JPEG.

## License

MIT — see `LICENSE`.

---

Entered on [make.fun](https://make.fun/?ref=n305kcfc&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards
