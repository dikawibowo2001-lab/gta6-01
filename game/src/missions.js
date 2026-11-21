// The story: twelve jobs for The Harbor Crew. Mara Vega, getaway
// driver, runs work for Reyes and Juno while the Coral Kings try to
// take her streets. Each job is a chain of stages — steal a car, drive
// to a marker, clear the rivals, survive the heat, win a race, take
// back a district — with dialogue at every turn. The manager tracks
// the active job, its stage, its timers and its payouts, and hands
// the HUD the objective text and the marker.
//
// Jobs 9–12 are the endgame: a multi-stage heist finale, a street
// race, a rescue from a police cordon, and a turf war for Downtown.
// The later jobs require respect ranks (see progression.js) — the
// crew doesn't hand the big jobs to a nobody.

export const MISSIONS = [
  {
    id: 'first-wheels',
    name: 'First Wheels',
    giver: 'Reyes',
    reward: 200,
    intro: ['Reyes', 'Mara. The crew needs wheels. Jack that Pelo GT on Strand Row and bring it to my garage. No scratches — well, fewer scratches.'],
    stages: [
      { type: 'steal', text: 'Steal the Rukan Pelo GT', target: 'sportsParked' },
      { type: 'goto', text: 'Drive it to Reyes\u2019 garage', target: 'reyesGarage', marker: 'reyesGarage' },
    ],
    outro: ['Reyes', 'Clean work. The Harbor Crew just got faster.'],
  },
  {
    id: 'hot-delivery',
    name: 'Hot Delivery',
    giver: 'Juno',
    reward: 350,
    intro: ['Juno', 'Package for the marina, and the Coral Kings are watching the bridges. One hundred seconds. Drive like the tide is behind you.'],
    stages: [
      { type: 'goto', text: 'Pick up the package at the port gate', target: 'portGate', marker: 'portGate' },
      { type: 'timed', text: 'Deliver to the marina before the timer runs out', target: 'marina', marker: 'marina', time: 100 },
    ],
    outro: ['Juno', 'Ninety seconds to spare. You drive like a rumor.'],
  },
  {
    id: 'harbor-rescue',
    name: 'Harbor Rescue',
    giver: 'Reyes',
    reward: 500,
    intro: ['Reyes', 'Juno is pinned at the port — three Coral Kings on her. Clear them out and bring her home.'],
    stages: [
      { type: 'kill', text: 'Clear the 3 Coral Kings at the port', target: 'junoPickup', count: 3, marker: 'junoPickup' },
      { type: 'goto', text: 'Pick up Juno and drive to the safehouse', target: 'safehouse', marker: 'safehouse' },
    ],
    outro: ['Juno', 'You came for me. The crew remembers that, Mara.'],
  },
  {
    id: 'last-getaway',
    name: 'The Last Getaway',
    giver: 'Reyes',
    reward: 800,
    intro: ['Reyes', 'The SBPD knows your car now. Survive sixty seconds at three stars — then vanish.'],
    stages: [
      { type: 'survive', text: 'Survive 60 seconds under full pursuit', time: 60, stars: 3 },
    ],
    outro: ['Reyes', 'They lost you in the neon. Legend status.'],
  },
  {
    id: 'coral-hit',
    name: 'Coral Kings Hit',
    giver: 'Juno',
    reward: 650,
    intro: ['Juno', 'A Kings convoy is rolling through Old Town. Hit the escort cars — all three — and the shipment is ours.'],
    stages: [
      { type: 'wreck', text: 'Wreck the 3 Kings escort cars', count: 3, marker: 'rivalCamp' },
      { type: 'goto', text: 'Drive the shipment to the safehouse', target: 'safehouse', marker: 'safehouse' },
    ],
    outro: ['Juno', 'The Kings will think twice about our streets.'],
  },
  {
    id: 'beachfront-run',
    name: 'Beachfront Run',
    giver: 'Reyes',
    reward: 450,
    intro: ['Reyes', 'A buyer waits on Kumala Strand. Beach road, top speed, eighty seconds. Try not to sand the paint.'],
    stages: [
      { type: 'timed', text: 'Reach the beach drop in 80 seconds', target: 'beachDrop', marker: 'beachDrop', time: 80 },
    ],
    outro: ['Reyes', 'On time, on the sand, on the money.'],
  },
  {
    id: 'port-heist',
    name: 'Port Heist',
    giver: 'Juno',
    reward: 900,
    intro: ['Juno', 'A Hauler full of hardware sits in the port. Steal it, dodge the patrols, bring it to the garage. Big score, big heat.'],
    stages: [
      { type: 'steal', text: 'Steal the Hauler truck from the port', target: 'portTruck' },
      { type: 'goto', text: 'Drive the Hauler to Reyes\u2019 garage', target: 'reyesGarage', marker: 'reyesGarage' },
    ],
    outro: ['Juno', 'Nine hundred dollars of hardware, zero receipts.'],
  },
  {
    id: 'sun-sand-sirens',
    name: 'Sun, Sand & Sirens',
    giver: 'Reyes',
    reward: 1500,
    intro: ['Reyes', 'Last job, Mara. Five stars, the whole city on you. Lose them, reach the safehouse, and Solmar Bay is ours.'],
    stages: [
      { type: 'survive', text: 'Survive 75 seconds at 5 stars', time: 75, stars: 5 },
      { type: 'goto', text: 'Lose the heat and reach the safehouse', target: 'safehouse', marker: 'safehouse' },
    ],
    outro: ['Reyes', 'Sun, sand and sirens — and you outran all three.'],
  },
  {
    id: 'harbor-heist',
    name: 'The Harbor Heist',
    giver: 'Reyes',
    reward: 2500,
    minRank: 1,
    intro: ['Reyes', 'The big one, Mara. The Kings stash their take in the downtown vault. Steal the getaway car, crack the vault, and outrun five stars of fury.'],
    stages: [
      { type: 'steal', text: 'Steal the getaway car from the marina', target: 'getawayCar' },
      { type: 'timed', text: 'Reach the downtown vault in 90 seconds', target: 'vault', marker: 'vault', time: 90 },
      { type: 'survive', text: 'Escape the vault with 5 stars for 60 seconds', time: 60, stars: 5 },
      { type: 'goto', text: 'Lose the heat and reach the safehouse', target: 'safehouse', marker: 'safehouse' },
    ],
    outro: ['Reyes', 'Two and a half grand, clean. The Kings are finished in this town.'],
  },
  {
    id: 'strand-grand-prix',
    name: 'Strand Grand Prix',
    giver: 'Juno',
    reward: 1200,
    minRank: 1,
    intro: ['Juno', 'Vex is talking trash about your driving all over the Strand. Shut him up — win the street race, first place, no excuses.'],
    stages: [
      { type: 'race', text: 'Win the street race at the old arcade', target: 'raceStart', marker: 'raceStart' },
    ],
    outro: ['Juno', 'Vex is quiet now. The whole Strand saw you win.'],
  },
  {
    id: 'cordon-break',
    name: 'Cordon Break',
    giver: 'Reyes',
    reward: 1800,
    minRank: 2,
    intro: ['Reyes', 'Dante is trapped in a police cordon downtown — four Kings holding the block. Break the cordon, get him out, bring him home.'],
    stages: [
      { type: 'kill', text: 'Clear the 4 Coral Kings at the cordon', target: 'cordon', count: 4, marker: 'cordon' },
      { type: 'goto', text: 'Drive Dante to the safehouse', target: 'safehouse', marker: 'safehouse' },
    ],
    outro: ['Reyes', 'Dante owes you his life. The crew owes you everything.'],
  },
  {
    id: 'turf-war',
    name: 'Turf War',
    giver: 'Juno',
    reward: 3000,
    minRank: 3,
    intro: ['Juno', 'Downtown belongs to whoever holds it at midnight. Take it back — five Kings, on their own turf — and Solmar Bay is ours for good.'],
    stages: [
      { type: 'turf', text: 'Take Downtown: defeat 5 Coral Kings in the district', target: 'downtown', count: 5, marker: 'raceStart' },
      { type: 'goto', text: 'Plant the flag at the safehouse', target: 'safehouse', marker: 'safehouse' },
    ],
    outro: ['Juno', 'Downtown is Harbor Crew turf now. You did it, Mara. Street boss.'],
  },
];

export class MissionManager {
  constructor(spawns) {
    this.spawns = spawns;
    this.index = 0;
    this.stage = 0;
    this.active = false;
    this.timer = 0;
    this.kills = 0;
    this.wrecks = 0;
    this.completed = 0;
    this.banner = null; // {title, sub, t}
    this.dialogue = null; // {name, text, t}
    this.justCompleted = null;
  }

  get mission() {
    return MISSIONS[this.index] || null;
  }

  get stageDef() {
    const m = this.mission;
    return m ? m.stages[this.stage] : null;
  }

  get stageLabel() {
    const m = this.mission;
    if (!m) return '';
    return `STAGE ${this.stage + 1}/${m.stages.length}`;
  }

  get isDone() {
    return this.index >= MISSIONS.length;
  }

  // The respect-rank gate: the later jobs need a name on the street.
  rankGate(world) {
    const m = this.mission;
    if (!m || !m.minRank) return true;
    return world.progression.rankIndex() >= m.minRank;
  }

  rankGateText(world) {
    const m = this.mission;
    if (!m || !m.minRank) return '';
    const need = ['NOBODY', 'HUSTLER', 'STREET NAME', 'SHOT CALLER', 'STREET BOSS'][m.minRank];
    return `REQUIRES RESPECT: ${need}`;
  }

  start() {
    const m = this.mission;
    if (!m || this.active) return;
    this.active = true;
    this.stage = 0;
    this.kills = 0;
    this.wrecks = 0;
    this.timer = 0;
    this.say(m.intro[0], m.intro[1]);
  }

  say(name, text, hold = 5) {
    this.dialogue = { name, text, t: hold };
  }

  markerPos() {
    const s = this.stageDef;
    if (!s || !s.marker) return null;
    const p = this.spawns[s.marker];
    return p ? [p[0], p[1]] : null;
  }

  // One frame. Returns 'completed' | 'failed' | 'advanced' | null.
  update(dt, world) {
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (this.dialogue) {
      this.dialogue.t -= dt;
      if (this.dialogue.t <= 0) this.dialogue = null;
    }
    if (!this.active || !this.mission) return null;
    const s = this.stageDef;
    const px = world.player.x;
    const pz = world.player.z;
    if (s.type === 'goto' || s.type === 'timed') {
      const p = this.spawns[s.target];
      if (s.type === 'timed') {
        if (this.timer === 0) this.timer = s.time;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.fail(world, 'Out of time');
          return 'failed';
        }
      }
      if (p && Math.hypot(px - p[0], pz - p[1]) < 12) return this.advance(world);
    } else if (s.type === 'steal') {
      if (world.stolenTarget) return this.advance(world);
    } else if (s.type === 'kill') {
      if (this.kills >= s.count) return this.advance(world);
    } else if (s.type === 'wreck') {
      if (this.wrecks >= s.count) return this.advance(world);
    } else if (s.type === 'race') {
      // The race mission completes when Mara wins a street race; a
      // loss just leaves the stage open to retry.
      if (world.races.lastResult === 'win') return this.advance(world);
      if (world.races.lastResult === 'lose') {
        world.races.lastResult = null;
        this.say('Juno', 'Not this time. Get back to the start line and try again.', 4);
      }
    } else if (s.type === 'turf') {
      // Kills only count inside Downtown (the turf stage's district).
      if (this.kills >= s.count) return this.advance(world);
    } else if (s.type === 'survive') {
      if (this.timer === 0) {
        this.timer = s.time;
        world.police.heat = Math.max(world.police.heat, (s.stars - 1) * 20 + 1);
      }
      this.timer -= dt;
      if (this.timer <= 0) return this.advance(world);
    }
    return null;
  }

  advance(world) {
    const m = this.mission;
    this.stage += 1;
    this.timer = 0;
    if (this.stage >= m.stages.length) {
      this.active = false;
      this.completed += 1;
      world.cash += m.reward;
      world.xp += 400;
      world.progression.addXp(400, m.name);
      // The turf war flips Downtown to the crew.
      if (m.id === 'turf-war') {
        world.progression.turf.downtown = 100;
      }
      this.justCompleted = m;
      this.banner = { title: 'JOB COMPLETE', sub: `${m.name}  +$${m.reward}`, t: 4 };
      this.say(m.outro[0], m.outro[1], 6);
      this.index += 1;
      this.stage = 0;
      world.audio.missionDone();
      world.save();
      return 'completed';
    }
    return 'advanced';
  }

  fail(world, reason) {
    this.active = false;
    this.stage = 0;
    this.timer = 0;
    this.banner = { title: 'JOB FAILED', sub: reason, t: 4 };
    this.say('Reyes', 'That one slipped away. Shake it off — the next job is waiting.', 6);
    world.audio.missionFail();
  }
}
