// Solmar Bay v4 — deterministic random numbers.
//
// The city, traffic colours and pedestrian variety all come from a
// seeded generator so the world is identical on every load. The core
// is splitmix32: a tiny integer hash that advances its state by the
// golden-ratio constant and mixes it with xorshifts. Seeding from a
// string runs the same mixer over each character, so 'solmar' and
// 'Solmar' build different (but stable) worlds.

const GOLDEN = 0x9e3779b9;

function mix32(state) {
  let z = (state + GOLDEN) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

export function hashSeed(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A small PRNG object. `next()` yields [0, 1); the helpers build the
// distributions the game needs (uniform ranges, integer picks, list
// choices, weighted chances and in-place shuffles).
export function makeRng(seed) {
  let state = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;
  const api = {
    next() {
      state = mix32(state);
      return state / 4294967296;
    },
    range(min, max) {
      return min + api.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(api.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(api.next() * list.length)];
    },
    chance(p) {
      return api.next() < p;
    },
    shuffle(list) {
      for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(api.next() * (i + 1));
        const tmp = list[i];
        list[i] = list[j];
        list[j] = tmp;
      }
      return list;
    },
    // Gaussian-ish value in [-1, 1] for natural variation.
    bell() {
      return (api.next() + api.next() + api.next() - 1.5) * (2 / 3);
    },
  };
  return api;
}
