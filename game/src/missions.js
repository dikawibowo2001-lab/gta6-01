// The story: eight jobs for The Harbor Crew. Mara Vega, getaway
// driver, runs work for Reyes and Juno while the Coral Kings try to
// take her streets. Each job is a chain of stages — steal a car, drive
// to a marker, clear the rivals, survive the heat — with dialogue at
// every turn. The manager tracks the active job, its stage, its timers
// and its payouts, and hands the HUD the objective text and the marker.

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
