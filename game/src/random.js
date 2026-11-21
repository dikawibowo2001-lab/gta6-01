// Seeded randomness for Solmar Bay: one deterministic stream drives the
// city layout, the traffic colours and the pedestrian wardrobes, so the
// same seed always builds the same city. Mulberry32 — small, fast, and
// good enough for a game that never needs cryptographic dice.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function rangeInt(rng, lo, hi) {
  return Math.floor(lo + rng() * (hi - lo + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function chance(rng, p) {
  return rng() < p;
}

// A tiny shuffle for callsigns and playlists: Fisher-Yates on a copy.
export function shuffled(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}
