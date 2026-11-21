// Solmar Bay — Sun, Sand & Sirens (3D, v2.1)
// One place for every number the game agrees on: the city grid, the
// golden-hour palette, the six car types, the wanted ladder and the
// economy. The modules import from here so the world stays consistent.

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

// SBPD callsigns for the dispatch panel.
export const CALLSIGNS = [
  'KITE-1', 'MARLIN-3', 'CORAL-48', 'CORAL-85', 'CORAL-43', 'SIERRA-12',
  'TANGO-7', 'PELICAN-11', 'GECKO-25', 'BARRACUDA-18', 'TAC-45', 'CONDOR-1',
  'VIPER-9', 'HAMMER-4', 'FALCON-2', 'ORCA-6', 'HAWK-21', 'REBEL-8',
];

export const RADIO = [
  { name: 'SOLMAR 98.4', track: 'Island Pop — Marisol Reyes' },
  { name: 'CELESTE 98.1', track: 'Malecon Mirage — Vela Roja' },
  { name: 'KUMALA FM', track: 'Neon Palms — The Drifters' },
  { name: 'HARBOR ROCK', track: 'Harbor Lights — Coral Kings' },
];

export const RANKS = [
  { xp: 0, name: 'ROOKIE' },
  { xp: 400, name: 'DRIVER' },
  { xp: 1000, name: 'WHEELMAN' },
  { xp: 2000, name: 'FIXER' },
  { xp: 3500, name: 'SHOT CALLER' },
  { xp: 6000, name: 'LEGEND' },
];
