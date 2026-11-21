// Solmar Bay v4 — central tuning. Every magic number the game uses
// lives here so a single edit retunes a whole system. Units are
// metres, seconds and radians; the world is a flat grid with +x east,
// +z south and +y up. The city sits between -160 and +160 on both
// axes; the ocean starts at x = -150 and the beach hugs its edge.

export const CFG = {
  // --- world layout -------------------------------------------------
  cityHalf: 160,          // city extends +/- this on x and z
  blockSize: 32,          // one city block (road centre to road centre)
  roadWidth: 10,          // drivable road surface width
  beachX: -150,           // sand starts west of this line
  oceanX: -168,           // water surface starts west of this line
  buildingCount: 118,     // tower blocks placed by the city builder
  palmCount: 90,
  treeCount: 60,
  // --- player -------------------------------------------------------
  walkSpeed: 7,
  runSpeed: 11,
  playerHealth: 100,
  playerArmorMax: 100,
  // --- cars ---------------------------------------------------------
  carTopSpeed: 42,        // m/s, before engine upgrades
  carAccel: 16,
  carBrake: 30,
  carGrip: 2.6,           // steering authority factor
  carHealth: 100,
  trafficCount: 14,
  trafficSpeed: 9,
  // --- police -------------------------------------------------------
  copTopSpeed: 47,
  copRamDamage: 8,
  heliHeight: 26,
  heliOrbitRadius: 30,
  wantedDecaySeconds: 45, // time hidden before one star drops
  // --- combat -------------------------------------------------------
  meleeDamage: 12,
  // --- economy ------------------------------------------------------
  missionCash: [250, 300, 350, 400, 450, 500, 550, 600, 700, 800, 900, 1500],
  racePrize: 400,
  respectPerMission: 120,
  // --- palette (golden hour) ---------------------------------------
  skyTop: [0.36, 0.52, 0.82],
  skyHorizon: [1.0, 0.62, 0.34],
  fogColor: [0.98, 0.66, 0.42],
  sunDir: [-0.55, 0.62, -0.35],
  groundColor: [0.32, 0.33, 0.30],
  roadColor: [0.13, 0.13, 0.15],
  sandColor: [0.93, 0.82, 0.58],
  waterColor: [0.10, 0.45, 0.62],
  // --- districts ----------------------------------------------------
  districts: [
    { name: 'Harbor', minX: -160, maxX: -40, minZ: 40, maxZ: 160 },
    { name: 'Downtown', minX: -40, maxX: 80, minZ: -80, maxZ: 80 },
    { name: 'Beachfront', minX: -160, maxX: 0, minZ: -160, maxZ: 40 },
  ],
};

// Respect ranks: name + respect points needed to reach it.
export const RANKS = [
  { name: 'Nobody', need: 0 },
  { name: 'Runner', need: 150 },
  { name: 'Hustler', need: 350 },
  { name: 'Shot Caller', need: 650 },
  { name: 'Street Boss', need: 1000 },
];
