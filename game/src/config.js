// Solmar Bay — tuning, world dimensions and the sun-soaked palette.
// Every number the game balances on lives here so the other modules read
// it instead of hiding magic constants in their own logic.

export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-bay-save-v1';

// The city, in world pixels. Roads run on a grid inside these bounds.
export const WORLD = { width: 3200, height: 2400 };
export const ROAD_WIDTH = 76;
export const ROAD_X = [200, 560, 920, 1280, 1640, 2000, 2360, 2720];
export const ROAD_Y = [200, 560, 920, 1280, 1640, 2000];

// South edge: sand, then sea. East edge: the port.
export const BEACH_TOP = 2120;
export const SEA_TOP = 2280;
export const PORT_LEFT = 2880;

// On foot.
export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  sprintSpeed: 250,
  maxHp: 100,
  maxArmor: 100,
  magSize: 12,
  reloadTime: 1.1,
  shootCooldown: 0.22,
  punchCooldown: 0.45,
  punchRange: 34,
  punchDamage: 18,
};

// Cars: arcade handling, one model for every type with per-type tuning.
export const CARS = {
  sedan: { length: 52, width: 26, accel: 420, maxSpeed: 520, reverseMax: 180, turn: 2.6, grip: 6.5, health: 100 },
  sports: { length: 50, width: 25, accel: 560, maxSpeed: 680, reverseMax: 200, turn: 3.0, grip: 7.5, health: 80 },
  taxi: { length: 52, width: 26, accel: 400, maxSpeed: 500, reverseMax: 180, turn: 2.6, grip: 6.5, health: 100 },
  truck: { length: 64, width: 30, accel: 300, maxSpeed: 400, reverseMax: 150, turn: 2.1, grip: 5.5, health: 160 },
  police: { length: 54, width: 27, accel: 520, maxSpeed: 620, reverseMax: 200, turn: 2.9, grip: 7.0, health: 140 },
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const PARKED_COUNT = 18;

// Wanted level: heat thresholds, how fast it cools, and the bust rules.
export const WANTED = {
  heatPerStar: 100,
  decayDelay: 12, // seconds out of every cop's sight before heat starts falling
  decayRate: 12, // heat per second while hidden
  bustRange: 46,
  bustTime: 2.2, // seconds a cop must stand next to a slow player to bust them
  bustFine: 150,
  wastedFine: 200,
};

// Mission rewards, in order.
export const MISSION_REWARDS = [200, 350, 500, 800];

// The clock: the city starts mid-morning and the light warms toward dusk.
export const DAY_START_MINUTES = 10 * 60;
export const MINUTES_PER_SECOND = 0.5;

export const PALETTE = {
  grass: '#7fb069',
  grassDark: '#6da25a',
  sidewalk: '#cfc4ae',
  road: '#3d3a38',
  roadEdge: '#2e2b29',
  lane: '#e8d44d',
  sand: '#ecd9a0',
  sea: '#2e86ab',
  seaDeep: '#1d6a8a',
  building: ['#e8b4b8', '#f4d58d', '#8ecae6', '#ffb703', '#c77dff', '#90be6d', '#f9c74f', '#e07a5f'],
  roof: ['#b56576', '#6d6875', '#355070', '#7f5539', '#4a4e69'],
  park: '#5d9c59',
  portGround: '#9a8c98',
  container: ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#6d6875'],
};
