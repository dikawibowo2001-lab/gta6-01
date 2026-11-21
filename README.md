# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dikawibowo2001-lab/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dikawibowo2001-lab/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay — Sun, Sand & Sirens** is an original open-world crime game in full 3D, built for make.fun's "Make GTA 6" bounty. Mara Vega, getaway driver for The Harbor Crew, runs twelve story jobs across a sun-soaked coastal city at golden hour — stealing cars, outrunning the SBPD, and facing down the Coral Kings — while the whole city watches from the sidewalks.

Everything is original: the city, the characters, the story, the art, and the engine. The game is raw WebGL written from scratch (own matrix math, shaders and meshes — no third-party libraries), and it plays entirely offline from static files.

## What's in the city

- **A living 3D world**: ~100 buildings with lit windows, glass downtown towers with rooftop props, palm-lined beach and ocean, a working port with cranes and container stacks, a marina with moored boats, streetlights, neon signs, fog and a golden-hour sky with a low sun.
- **Three cameras**: a slow downtown orbit on the title screen, a chase cam behind the car, and an over-shoulder cam on foot.
- **Twelve story missions** with stages, timers and dialogue from Reyes and Juno — car theft, timed deliveries, a harbor rescue, a convoy hit, a port heist, two survive-the-heat finales up to 5 stars, a multi-stage heist finale, a street-race mission, a rescue from a police cordon, and a turf war for Downtown.
- **Six stealable car types** (sports, sedan, SUV, taxi, truck, police) with arcade handling, damage, smoke and fire — plus **burning wrecks**: destroyed cars burn on a fuse, then explode (damage radius, screen shake) and stay as charred husks.
- **A full wanted system**: 1–5 stars, chasing and ramming cruisers, foot cops from 2 stars, a **police helicopter with a visible spotlight** from 3 stars, roadblocks from 4 stars, heat decay, and a busted screen with a fine.
- **Combat**: fists, pistol, SMG, shotgun (6-pellet spread) and rifle, each with its own damage, fire rate, spread and tracer colour — plus a radial **weapon wheel** (hold Q / Tab, or keys 1–4).
- **Procedural radio**: three WebAudio stations (surf rock, synthwave, talk radio) with named tracks, switchable with R or the HUD button — no audio files.
- **Reyes' garage**: spend mission cash on engine, armour, nitro boost and paint jobs; upgrades follow Mara between cars and persist in the save.
- **Street races**: checkpoint races against 3 AI rivals, 3-2-1-GO countdown, live position, cash prizes, and a race mission.
- **Respect & turf**: five respect ranks (Nobody → Street Boss) that unlock the big jobs, and district standing for Harbor, Downtown and Beachfront, shown on the pause screen.
- **Crew abilities**: call a backup driver, send a distraction decoy, or drop a wanted star — keys 5/6/7 or HUD buttons, each with a cooldown.
- **Talkable NPCs**: six named locals with scripted lines, tips and mission hints (press E).
- **Boats**: three drivable speedboats at the marina, with wakes and a boat chase cam.
- **Dense GTA-style HUD**: mission panel with stage and next-step hint, live SBPD dispatch list, weapon slots, cash, clock, wanted stars, rank and XP bar, respect line, radio ticker, round live minimap (garage, race, NPC, boat and checkpoint markers), district label, health/armour bars, and a speedometer with vehicle condition and nitro gauge.
- **Extras**: 20 AI traffic cars, 40 fleeing pedestrians, health/armour/cash pickups, localStorage save, and synthesized WebAudio SFX with an ambient loop — zero network requests.

## Controls

WASD drive & walk · E enter / talk / board · Mouse aim · Click shoot · R radio · F reload · 1–4 weapons · 0 fists · Q / Tab weapon wheel · 5/6/7 crew · G garage · J job / race · Space handbrake · Shift sprint / nitro · P pause · H help

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no install, no network.

---

<sub>Entered on [make.fun](https://make.fun/?ref=n305kcfc&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
