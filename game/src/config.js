// Solmar Bay — Sun, Sand & Sirens (3D, v3)
// One place for every number the game agrees on: the city grid, the
// golden-hour palette, the six car types, the wanted ladder, the
// economy, the radio stations, the garage catalogue, the race series,
// the respect ladder, the crew abilities and the talkable NPCs. The
// modules import from here so the world stays consistent.

export const WORLD = {
  bound: 430, // soft edge of the playable city
  roadHalf: 7, // half-width of a road surface
  grid: [-280, -200, -120, -40, 40, 120, 200, 280], // road centre lines
  blocks: [-240, -160, -80, 0, 80, 160, 240], // block centres between roads
  blockSize: 64,
  sandX: 316, // the beach begins here
  seaX: 396, // the ocean begins here
};

// Golden hour over a Caribbean-style coast: the sun hangs low in the
// west, the sky burns rose-orange, the sea goes teal.
export const PALETTE = {
  skyTop: [0.32, 0.46, 0.76],
  skyMid: [0.99, 0.6, 0.4],
  skyLow: [1.0, 0.8, 0.58],
  sunTint: [1.0, 0.8, 0.52],
  sunDir: [-0.58, 0.42, -0.32],
  fog: [0.97, 0.64, 0.46],
  fogNear: 110,
  fogFar: 540,
  ambient: [0.58, 0.52, 0.5],
  grass: [0.4, 0.54, 0.3],
  asphalt: [0.15, 0.15, 0.17],
  linePaint: [0.88, 0.82, 0.62],
  walkway: [0.56, 0.53, 0.48],
  sand: [0.95, 0.83, 0.6],
  sea: [0.08, 0.44, 0.6],
  facades: [
    [0.86, 0.73, 0.61],
    [0.79, 0.67, 0.59],
    [0.91, 0.81, 0.69],
    [0.71, 0.63, 0.61],
    [0.83, 0.71, 0.56],
    [0.66, 0.61, 0.63],
    [0.88, 0.76, 0.72],
  ],
  litWindow: [1.0, 0.86, 0.46],
  darkWindow: [0.24, 0.34, 0.44],
  trunk: [0.46, 0.33, 0.21],
  frond: [0.16, 0.52, 0.24],
  cranePaint: [0.96, 0.62, 0.16],
  boxColors: [
    [0.82, 0.26, 0.21],
    [0.21, 0.46, 0.76],
    [0.26, 0.66, 0.36],
    [0.91, 0.71, 0.21],
    [0.61, 0.36, 0.66],
  ],
};

// Six stealable car types. Arcade handling: top speed, acceleration,
// grip (how eagerly the nose follows the wheel) and braking.
export const CAR_TYPES = {
  sedan: { name: 'Meridian GT', top: 33, accel: 15, grip: 2.5, brake: 29, paint: [[0.76, 0.11, 0.13], [0.11, 0.26, 0.61], [0.86, 0.86, 0.86], [0.14, 0.14, 0.15]] },
  sports: { name: 'Rukan Pelo GT', top: 47, accel: 25, grip: 3.5, brake: 35, paint: [[1.0, 0.46, 0.16], [0.96, 0.86, 0.11], [0.11, 0.71, 0.71], [0.61, 0.11, 0.51]] },
  suv: { name: 'Bison XL', top: 29, accel: 12, grip: 2.1, brake: 25, paint: [[0.21, 0.21, 0.23], [0.76, 0.76, 0.73], [0.31, 0.41, 0.21]] },
  taxi: { name: 'Solmar Cab', top: 31, accel: 14, grip: 2.4, brake: 29, paint: [[0.96, 0.76, 0.11]] },
  truck: { name: 'Hauler 6T', top: 23, accel: 8, grip: 1.7, brake: 21, paint: [[0.86, 0.86, 0.86], [0.21, 0.51, 0.81]] },
  police: { name: 'SBPD Interceptor', top: 43, accel: 23, grip: 3.3, brake: 37, paint: [[0.09, 0.09, 0.11]] },
};

// The wanted ladder: heat 0–100 maps to stars; each star brings more
// cruisers, then foot cops, then the helicopter, then roadblocks.
export const WANTED = {
  cruisersByStar: [0, 2, 3, 4, 5, 6],
  footCopsAt: 2,
  heliAt: 3,
  roadblockAt: 4,
  heatLoss: 0.5, // heat shed per second while no cop can see Mara
  heatFor: { steal: 22, kill: 45, shoot: 12, hitPed: 30, hitCop: 40, speed: 0.4 },
  bustedWait: 3.0, // seconds pinned before the busted screen
  finePerStar: 150,
};

export const ECONOMY = {
  startCash: 100,
  pickupCash: 50,
  finePerStar: 150,
  racePrize: [500, 200, 100, 0], // by finishing position
};

export const DISTRICTS = [
  { name: 'Downtown', x0: -160, z0: -160, x1: 160, z1: 160 },
  { name: 'Portside', x0: -430, z0: -430, x1: -200, z1: -200 },
  { name: 'Harbor', x0: -200, z0: -430, x1: 200, z1: -200 },
  { name: 'Kumala Strand', x0: 280, z0: -430, x1: 430, z1: 430 },
  { name: 'Old Town', x0: -430, z0: 200, x1: -160, z1: 430 },
  { name: 'Marina', x0: 160, z0: 200, x1: 430, z1: 430 },
  { name: 'Little Havana', x0: -430, z0: -200, x1: -160, z1: 200 },
  { name: 'Sunset Hills', x0: 160, z0: -200, x1: 280, z1: 200 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Solmar Bay';
}

// The three districts the crew fights over (progression standing).
export const TURF_DISTRICTS = [
  { id: 'harbor', name: 'Harbor', x0: -430, z0: -430, x1: 200, z1: -160 },
  { id: 'downtown', name: 'Downtown', x0: -160, z0: -160, x1: 200, z1: 200 },
  { id: 'beachfront', name: 'Beachfront', x0: 200, z0: -430, x1: 430, z1: 430 },
];

export function turfAt(x, z) {
  for (const d of TURF_DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.id;
  }
  return null;
}

// SBPD callsigns for the dispatch panel.
export const CALLSIGNS = [
  'KITE-1', 'MARLIN-3', 'CORAL-48', 'CORAL-85', 'CORAL-43', 'SIERRA-12',
  'TANGO-7', 'PELICAN-11', 'GECKO-25', 'BARRACUDA-18', 'TAC-45', 'CONDOR-1',
  'VIPER-9', 'HAMMER-4', 'FALCON-2', 'ORCA-6', 'HAWK-21', 'REBEL-8',
];

// Three procedural radio stations — each with its own genre, tracks and
// a WebAudio recipe (see radio.js). No audio files anywhere.
export const RADIO_STATIONS = [
  {
    id: 'surf',
    name: 'SOLMAR SURF 98.4',
    genre: 'Surf rock',
    tracks: ['Pipeline Sunset — The Breakers', 'Wax & Neon — Marisol Reyes', 'Tide Chaser — Los Olas'],
  },
  {
    id: 'synth',
    name: 'NEON 101.7',
    genre: 'Synthwave',
    tracks: ['Midnight Overpass — Vela Roja', 'Chrome Palms — The Drifters', 'Afterglow Drive — Neon Marlin'],
  },
  {
    id: 'talk',
    name: 'HARBOR TALK 88.1',
    genre: 'Talk radio',
    tracks: ['The Dockside Hour — with Sal Vega', 'Solmar Tonight — call-in show', 'Harbor News — traffic & tides'],
  },
];

// Garage catalogue: engine and armour in 3 levels, nitro as a single
// unlock, and five paint jobs. Prices in dollars.
export const GARAGE = {
  engine: [
    { level: 1, name: 'Sport intake', price: 300, topBonus: 0.12 },
    { level: 2, name: 'Turbo kit', price: 600, topBonus: 0.24 },
    { level: 3, name: 'Twin-turbo V8', price: 1000, topBonus: 0.4 },
  ],
  armor: [
    { level: 1, name: 'Reinforced frame', price: 250, hpBonus: 40 },
    { level: 2, name: 'Plated panels', price: 500, hpBonus: 80 },
    { level: 3, name: 'Full roll cage', price: 900, hpBonus: 140 },
  ],
  nitro: { name: 'Nitro boost (hold Shift)', price: 400 },
  paints: [
    { name: 'Sunset Orange', price: 150, color: [1.0, 0.46, 0.16] },
    { name: 'Lagoon Teal', price: 150, color: [0.11, 0.71, 0.71] },
    { name: 'Coral Pink', price: 150, color: [1.0, 0.35, 0.55] },
    { name: 'Midnight Black', price: 150, color: [0.08, 0.08, 0.1] },
    { name: 'Gold Rush', price: 150, color: [0.95, 0.75, 0.2] },
  ],
};

// Respect ranks: the street knows Mara's name as her XP grows.
export const RESPECT_RANKS = [
  { xp: 0, name: 'NOBODY', blurb: 'Nobody knows your name. Yet.' },
  { xp: 500, name: 'HUSTLER', blurb: 'The docks whisper your name.' },
  { xp: 1500, name: 'STREET NAME', blurb: 'Every corner crew knows the Pelo GT.' },
  { xp: 3000, name: 'SHOT CALLER', blurb: 'Reyes trusts you with the big jobs.' },
  { xp: 5000, name: 'STREET BOSS', blurb: 'Solmar Bay is yours.' },
];

// Crew abilities (keys 5/6/7): name, cooldown seconds, flavour.
export const CREW_ABILITIES = [
  { id: 'backup', key: '5', name: 'BACKUP DRIVER', cooldown: 60, desc: 'Juno joins the chase in her own car for 30s.' },
  { id: 'decoy', key: '6', name: 'DISTRACTION', cooldown: 45, desc: 'A decoy car pulls every cop off your tail for 10s.' },
  { id: 'getaway', key: '7', name: 'GETAWAY', cooldown: 90, desc: 'A clean route out: lose one wanted star instantly.' },
];

// Talkable NPCs: name, spot, shirt colour and scripted lines.
export const NPC_DEFS = [
  { name: 'Sal the Fisherman', x: 320, z: 280, shirt: [0.2, 0.5, 0.9], lines: [
    'The Kings moved a shipment through the port last night. Big boxes, no labels.',
    'Fish bite best at golden hour. So do cops, mind you.',
    'You need a boat? The marina boys owe me a favour. Talk to me again later.',
  ] },
  { name: 'Dita the Mechanic', x: 44, z: 188, shirt: [0.9, 0.5, 0.1], lines: [
    'Reyes\u2019 garage is the best in Solmar Bay. Bring cash, leave faster.',
    'That Pelo GT of yours? Twin-turbo it and the SBPD will eat your dust.',
    'Nitro is cheap insurance. One tank and no cruiser keeps up with you.',
  ] },
  { name: 'Old Man Kito', x: -120, z: 40, shirt: [0.6, 0.2, 0.7], lines: [
    'I watched the Harbor Crew grow from three kids to the kings of the docks.',
    'The Coral Kings pay the beat cops. Watch the alley behind the market.',
    'Downtown belongs to whoever holds it at midnight. Remember that.',
  ] },
  { name: 'Lena the Courier', x: 120, z: -120, shirt: [0.95, 0.85, 0.2], lines: [
    'Fastest way across town? Beach road, no lights, no mercy.',
    'I outran a helicopter once. Once. Never again.',
    'The street races start near the old arcade. Win one and the crews notice.',
  ] },
  { name: 'Father Anselmo', x: -200, z: 280, shirt: [0.9, 0.9, 0.92], lines: [
    'The city forgives, Mara. Even getaway drivers.',
    'Drive carefully past the church. The children play in the square.',
    'Reyes was an altar boy once. The sea air changed him.',
  ] },
  { name: 'Vex the Racer', x: 200, z: 44, shirt: [0.3, 0.8, 0.4], lines: [
    'You think you can drive? The checkpoint race decides. Bring a fast car.',
    'Three rivals, five checkpoints, one winner. No excuses.',
    'Beat me and I\u2019ll tell the crews you\u2019re the real deal.',
  ] },
];

// Street race: checkpoints around the city, 3 AI rivals.
export const RACE = {
  start: [200, 40],
  checkpoints: [
    [200, -120],
    [40, -200],
    [-120, -120],
    [-120, 120],
    [40, 200],
  ],
  rivalNames: ['Vex', 'Rook', 'Dante'],
  rivalColors: [[0.9, 0.2, 0.25], [0.2, 0.5, 0.9], [0.95, 0.85, 0.2]],
};

export const RANKS = [
  { xp: 0, name: 'ROOKIE' },
  { xp: 400, name: 'DRIVER' },
  { xp: 1000, name: 'WHEELMAN' },
  { xp: 2000, name: 'FIXER' },
  { xp: 3500, name: 'SHOT CALLER' },
  { xp: 6000, name: 'LEGEND' },
];
