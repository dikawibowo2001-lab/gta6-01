// Solmar Bay v4 — talkable NPCs.
//
// Six locals stand at fixed spots around the city with a floating
// marker overhead. Walk up and press E: each one has three lines
// that cycle (tips, gossip, flavour), and the first chat with each
// earns +25 respect. They make the city feel inhabited instead of
// just driven through.

import { v3DistXZ } from './math3.js';

const NPC_DEFS = [
  {
    name: 'Old Sal — Fisherman',
    lines: [
      'Dulu pelabuhan ini punyaku, nak. Sekarang? Coral Kings yang atur.',
      'Kalau mau hilang dari polisi, sembunyi di dermaga selatan. Mereka nggak pernah ke sana.',
      'Ikan lagi bagus minggu ini. Sayang, kotanya lagi nggak.',
    ],
  },
  {
    name: 'Mira — Street Racer',
    lines: [
      'Kamu yang bawa mobil hijau itu ya? Lumayan. Tapi belum pernah lawan aku.',
      'Balapan jalanan mulai di perempatan utara tiap malam. Datang bawa nyali.',
      'Mesin boleh standar, tapi nyali harus turbo.',
    ],
  },
  {
    name: 'Reyes — Mechanic',
    lines: [
      'Bengkel ini buka 24 jam buat Harbor Crew. Mesin, armor, nitro — semua ada.',
      'Cat mobilmu? Kusam. Lima belas menit di sini, keluar kinclong.',
      'Jangan bawa mobil curian ke sini pas polisi lagi panas. Tunggu adem dulu.',
    ],
  },
  {
    name: 'Dee — Radio Host',
    lines: [
      'Kamu dengerin Bay Talk? Aku yang siaran tiap sore dari marina.',
      'Kota ini butuh suara baru. Mungkin suara kamu, Mara.',
      'Jangan percaya gosip soal gudang pelabuhan... kecuali yang ini: itu benar.',
    ],
  },
  {
    name: 'Vic — Ex-Cop',
    lines: [
      'Aku dulu SBPD. Sekarang aku jual info. Lebih jujur, lebih bayar.',
      'Helikopter itu namanya CONDOR-1. Terbangnya bagus, pilotnya payah.',
      'Roadblock selalu dua mobil. Selalu. Lewat trotoar, jangan rem.',
    ],
  },
  {
    name: 'Luna — Beach Vendor',
    lines: [
      'Es kelapa? Dua dolar. Info soal Kings? Gratis, kalau kamu baik.',
      'Pantai ini aman. Kings nggak suka pasir di sepatu mereka.',
      'Matahari terbenam di Solmar paling cantik jam 6 sore. Jangan lewatkan.',
    ],
  },
];

export function makeNpcs(G) {
  const npcs = NPC_DEFS.map((def, i) => {
    const spot = G.city.npcSpots[i] || [0, 0, 0];
    return {
      ...def,
      pos: [...spot],
      angle: G.rng.range(0, Math.PI * 2),
      shirt: [[0.9, 0.7, 0.3], [0.3, 0.8, 0.9], [0.8, 0.3, 0.3], [0.6, 0.3, 0.9], [0.3, 0.6, 0.3], [0.95, 0.6, 0.8]][i],
      pants: [0.2, 0.2, 0.3],
      lineIdx: 0,
      talked: false,
      walkPhase: 0,
      bobPhase: G.rng.range(0, 6),
    };
  });

  function nearest() {
    let best = null;
    let bestD = 3.5;
    for (const n of npcs) {
      const d = v3DistXZ(G.player.pos, n.pos);
      if (d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  function talk(npc) {
    const line = npc.lines[npc.lineIdx % npc.lines.length];
    npc.lineIdx += 1;
    G.hud.showDialogue(npc.name, line);
    G.audio.play('click');
    if (!npc.talked) {
      npc.talked = true;
      G.progression.addRespect(25);
    }
  }

  return {
    npcs,
    nearest,
    talk,
    update(dt) {
      for (const n of npcs) n.bobPhase += dt * 2;
      if (G.inTitle || G.paused || G.garage.open) return;
      if (G.input.wasPressed('KeyE')) {
        const npc = nearest();
        // Boats take priority at the marina dock (handled in boats.js).
        const boatNear = G.boats.nearestBoat(G.player.pos, 5);
        if (npc && !boatNear) talk(npc);
      }
    },
  };
}
