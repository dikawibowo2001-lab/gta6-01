# Solmar Bay — Sun, Sand & Sirens

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) [![rank](https://make.fun/badge/gta6-01/dikawibowo2001-lab/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) [![reward](https://make.fun/badge/gta6-01/dikawibowo2001-lab/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 3D open-world crime game in the spirit of GTA 6, built from scratch
in raw WebGL for the make.fun **gta6-01** bounty. No game engine, no
libraries, no network: plain static files that run offline in a
desktop browser.

Mara Vega comes home to Solmar Bay, a sun-soaked coastal city where
the Harbor Crew is losing ground to the Coral Kings. Twelve story
jobs, a living city, and the full weight of the Solmar Bay Police
Department stand between her and the top of the food chain.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

| Key | Action |
| --- | ------ |
| WASD / arrows | Walk / drive |
| Shift | Sprint / nitro (with the Nitro Kit) |
| F | Enter / exit car |
| E | Talk, board a boat, start a mission or race |
| Mouse click / J | Shoot |
| Q (hold) / Tab | Weapon wheel |
| 1–5 | Select weapon |
| R | Next radio station |
| G | Garage shop (near Reyes' Garage) |
| 6 / 7 / 8 | Crew abilities: Rico backup, Lena decoy, Ghost getaway |
| Space | Brake / handbrake |
| P / Esc | Pause — ranks, turf, mission list |
| M | Mute |

## What is in the game

- **A real 3D city**: 118 seeded buildings with neon signs, a park,
  a working port with cranes and containers, a marina, a beach and
  an ocean you can boat on — golden-hour light and distance fog.
- **Driving**: arcade handling with drift, traffic that follows the
  road grid, parked cars to steal, collisions and car damage.
- **Police**: a 1–5 star wanted system — ramming cruisers, foot cops
  from 2 stars, the CONDOR-1 helicopter with a spotlight from 3,
  roadblocks from 4. Lay low and the heat bleeds off.
- **Combat**: five weapons on a radial wheel (fists, pistol, SMG,
  shotgun, rifle), hitscan shooting with tracers, health and armor
  pickups, burning cars that explode.
- **Twelve story missions**: car theft, gang hits, timed driving, a
  5-star heist finale, a street race, a rescue and a turf war —
  gated by respect rank, paying cash and respect.
- **Systems**: three procedural radio stations, a garage upgrade
  shop (engine, armor, nitro, paint), checkpoint street races
  against three AI rivals, five respect ranks, district turf
  meters, three crew abilities with cooldowns, six talkable NPCs
  and drivable speedboats.
- **Presentation**: dense GTA-style HUD with a live minimap, mission
  beacons, dialogue bubbles, toasts, and automatic saving to
  localStorage.

## Structure

```
main.ts            entry point: stages game/ + screenshots/ and writes dossier.json
serve.ts           tiny static server for local play (kit file, untouched)
vendor/            make.fun helper (kit file, untouched)
game/
  index.html       canvas + HUD DOM + CSS
  src/
    main.js        boot, game loop, save/load, on-foot movement
    config.js      tuning + palette + districts + ranks
    random.js      seeded PRNG (splitmix32)
    math3.js       vec3 + column-major mat4
    gl.js          WebGL program, geometry builders, mesh drawing
    audio.js       procedural WebAudio SFX
    radio.js       three generative radio stations
    input.js       keyboard + mouse
    world.js       terrain, roads, beach, ocean
    city.js        buildings, palms, port, marina, colliders
    entities.js    car / pedestrian / helicopter / boat drawing
    vehicles.js    arcade car physics, enter/exit
    traffic.js     road traffic AI + pedestrians
    police.js      wanted system, cruisers, foot cops, helicopter, roadblocks
    combat.js      shooting, damage, death, pickups
    weapons.js     the five-weapon arsenal + wheel state
    particles.js   smoke, fire, sparks, tracers, wake
    wrecks.js      burning cars, explosions, husks
    boats.js       speedboats
    missions.js    twelve data-driven story missions
    races.js       checkpoint street races
    garage.js      upgrade shop logic
    progression.js respect ranks + district turf
    crew.js        backup / decoy / getaway abilities
    npcs.js        six talkable locals
    hud.js         HUD, minimap, wheel, garage UI, pause screen
    render.js      chase camera + draw pass
    shots.js       ?shot= staging for the four screenshots
```

## Screenshots

Four staged captures live in `screenshots/`: the title screen, a
drive with the weapon wheel open, a 4-star helicopter chase, and
the open garage shop. Regenerate them with the `?shot=` parameter,
e.g. `http://localhost:8080/?shot=chase`.

Everything in Solmar Bay — the city, the characters, the story, the
art — is original work made for this entry.
