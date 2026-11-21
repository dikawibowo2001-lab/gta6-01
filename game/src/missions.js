// The story of Mara Vega, a getaway driver new to Solmar Bay, and the
// four jobs The Harbor Crew gives her. Each mission is a small state
// machine: stages with a marker, an objective line, and a reward. The
// first job starts with a new game; later jobs start at the Hideout
// marker, and a failed job can be retried from there.

import { MISSION_REWARDS } from './config.js';
import { createEnemy } from './combat.js';

export const STORY_INTRO = 'Mara Vega rolled into Solmar Bay with an empty wallet and a reputation for out-driving anyone. The Harbor Crew — Reyes and his people — need a driver they can trust. Four jobs. Do them clean, and the bay is yours.';

export const MISSIONS = [
  {
    title: 'First Wheels',
    giver: 'Reyes',
    briefing: 'Every driver needs a ride, Mara. Borrow any car on the street — press E beside one — and bring it to Sunset Garage. The crew will make it yours.',
    objective: ['Borrow any car (walk up and press E)', 'Drive it to Sunset Garage'],
  },
  {
    title: 'Hot Delivery',
    giver: 'Reyes',
    briefing: 'A package is waiting at the Port Gate and a buyer downtown pays double if it arrives in 100 seconds. Drive like the bay is on fire — because the clock is.',
    objective: ['Pick up the package at the Port Gate', 'Deliver it downtown before the timer runs out'],
  },
  {
    title: 'Harbor Rescue',
    giver: 'Juno',
    briefing: 'Juno is pinned down at the port by the Coral Kings. Clear them out, get her in your car, and bring her home to the Hideout. Nobody in this crew gets left behind.',
    objective: ['Reach the port', 'Clear out the Coral Kings', 'Pick up Juno', 'Drive Juno to the Hideout'],
  },
  {
    title: 'The Last Getaway',
    giver: 'Reyes',
    briefing: 'Solmar PD is all over us — three stars and climbing. Stay free for sixty seconds, then vanish into the Hideout. Pull this off and you are family.',
    objective: ['Survive the heat for 60 seconds', 'Reach the Hideout'],
  },
];

export function createMissionState() {
  return {
    index: 0, // 0..3: the next job; 4: all done
    stage: 0,
    state: 'idle', // idle | active | complete | failed
    timer: 0,
    completed: [false, false, false, false],
    failed: false,
  };
}

export function startMission(world, index) {
  const mission = world.mission;
  const idx = index ?? mission.index;
  mission.index = idx;
  mission.stage = 0;
  mission.state = 'active';
  mission.timer = 0;
  mission.failed = false;
  world.enemies = [];
  world.juno = null;
  const def = MISSIONS[idx];
  world.banner = { text: `${def.title.toUpperCase()} — ${def.giver.toUpperCase()}`, color: '#ffd166', until: world.time + 3.5 };
  world.briefing = { title: def.title, giver: def.giver, text: def.briefing, until: world.time + 6 };
  if (idx === 3) {
    world.wanted.heat = 300;
    world.wanted.stars = 3;
    if (world.audio) world.audio.siren(true);
  }
}

export function missionMarker(world) {
  const mission = world.mission;
  const L = world.city.landmarks;
  if (mission.state === 'idle') {
    if (mission.index === -1) return null;
    if (mission.index < 4 && !mission.completed[mission.index]) return { ...L.home, label: 'Next job — press E' };
    return null;
  }
  if (mission.state !== 'active') return null;
  const stage = mission.stage;
  if (mission.index === 0) return stage === 0 ? null : { ...L.garage, label: 'Sunset Garage' };
  if (mission.index === 1) return stage === 0 ? { ...L.portGate, label: 'Pick up the package' } : { ...L.downtown, label: 'Deliver downtown' };
  if (mission.index === 2) {
    if (stage === 0) return { ...L.portGate, label: 'The port' };
    if (stage === 1) return { ...L.portGate, label: 'Clear the Kings' };
    if (stage === 2 && world.juno) return { x: world.juno.x, y: world.juno.y, label: 'Juno' };
    return { ...L.home, label: 'Hideout' };
  }
  if (mission.index === 3) return stage === 0 ? null : { ...L.home, label: 'Hideout' };
  return null;
}

export function objectiveText(world) {
  const mission = world.mission;
  if (mission.state === 'idle') {
    if (mission.index >= 4) return 'All jobs done — the bay is yours. Free roam!';
    if (mission.index === -1) return '';
    return `Next job: ${MISSIONS[mission.index].title} — drive to the Hideout and press E`;
  }
  if (mission.state !== 'active') return '';
  const def = MISSIONS[mission.index];
  let text = def.objective[mission.stage] || '';
  if (mission.index === 1 && mission.stage === 1) text += ` — ${Math.max(0, Math.ceil(mission.timer))}s left`;
  if (mission.index === 3 && mission.stage === 0) text += ` — ${Math.max(0, Math.ceil(mission.timer))}s left`;
  return text;
}

export function completeMission(world) {
  const mission = world.mission;
  const reward = MISSION_REWARDS[mission.index];
  mission.completed[mission.index] = true;
  mission.state = 'complete';
  world.cash += reward;
  world.stats.cashEarned += reward;
  world.stats.missionsDone += 1;
  world.missionComplete = { title: MISSIONS[mission.index].title, reward, until: world.time + 4 };
  if (world.audio) {
    world.audio.missionComplete();
    world.audio.cash();
  }
  mission.index += 1;
  mission.stage = 0;
  if (mission.index < 4) {
    mission.state = 'idle';
  }
}

export function failMission(world, reason) {
  const mission = world.mission;
  if (mission.state !== 'active') return;
  mission.state = 'failed';
  mission.failed = true;
  world.banner = { text: `JOB FAILED — ${reason.toUpperCase()}`, color: '#ff4d4d', until: world.time + 3.5 };
  if (world.audio) world.audio.missionFailed();
  // The same job stays available at the Hideout marker.
  mission.state = 'idle';
}

function near(world, point, radius) {
  const player = world.player;
  const x = player.car ? player.car.x : player.x;
  const y = player.car ? player.car.y : player.y;
  return Math.hypot(x - point.x, y - point.y) < radius;
}

export function updateMission(world, dt, actions) {
  const mission = world.mission;
  const L = world.city.landmarks;

  // Starting the next job at the Hideout marker.
  if (mission.state === 'idle' && mission.index >= 0 && mission.index < 4 && !mission.completed[mission.index]) {
    if ((actions.start || actions.enter) && near(world, L.home, 90)) {
      startMission(world, mission.index);
      return;
    }
  }
  if (mission.state !== 'active') return;

  const player = world.player;
  if (mission.index === 0) {
    if (mission.stage === 0 && player.car) mission.stage = 1;
    else if (mission.stage === 1 && near(world, L.garage, 80)) completeMission(world);
  } else if (mission.index === 1) {
    if (mission.stage === 0) {
      if (near(world, L.portGate, 80)) {
        mission.stage = 1;
        mission.timer = 100;
        world.banner = { text: 'PACKAGE COLLECTED — 100 SECONDS!', color: '#ffd166', until: world.time + 2.5 };
      }
    } else {
      mission.timer -= dt;
      if (mission.timer <= 0) failMission(world, 'Out of time');
      else if (near(world, L.downtown, 80)) completeMission(world);
    }
  } else if (mission.index === 2) {
    if (mission.stage === 0) {
      if (near(world, L.portGate, 140)) {
        mission.stage = 1;
        const rng = world.rng;
        world.enemies = [
          createEnemy(rng, L.portGate.x + 60, L.portGate.y - 40),
          createEnemy(rng, L.portGate.x - 30, L.portGate.y + 90),
          createEnemy(rng, L.portGate.x + 120, L.portGate.y + 60),
        ];
        world.juno = { x: L.portGate.x + 40, y: L.portGate.y + 140, boarded: false };
        world.banner = { text: 'THE CORAL KINGS ARE HERE — FIGHT!', color: '#ff4d4d', until: world.time + 2.5 };
      }
    } else if (mission.stage === 1) {
      if (world.enemies.length > 0 && world.enemies.every((e) => e.dead)) {
        mission.stage = 2;
        world.banner = { text: 'AREA CLEAR — GET JUNO', color: '#7bf1a8', until: world.time + 2.5 };
      }
    } else if (mission.stage === 2) {
      if (world.juno && near(world, world.juno, 46)) {
        world.juno.boarded = true;
        mission.stage = 3;
        world.banner = { text: 'JUNO IS WITH YOU — DRIVE HOME', color: '#7bf1a8', until: world.time + 2.5 };
      }
    } else if (mission.stage === 3) {
      if (near(world, L.home, 90)) completeMission(world);
    }
    // Juno rides along once she boards.
    if (world.juno && world.juno.boarded) {
      world.juno.x = player.car ? player.car.x : player.x;
      world.juno.y = player.car ? player.car.y : player.y + 24;
    }
  } else if (mission.index === 3) {
    if (mission.stage === 0) {
      if (mission.timer <= 0) mission.timer = 60;
      mission.timer -= dt;
      if (mission.timer <= 0) {
        mission.stage = 1;
        world.banner = { text: 'YOU OUTLASTED THEM — GET TO THE HIDEOUT', color: '#7bf1a8', until: world.time + 2.5 };
      }
    } else if (near(world, L.home, 90)) {
      completeMission(world);
    }
  }
}
