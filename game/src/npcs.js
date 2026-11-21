// Talkable NPCs: six named locals stand at fixed spots around the
// city with a yellow marker above their heads. Walk up, press E, and
// a dialogue bubble opens with one of their scripted lines — tips
// about the garage, the races, the Kings, the heat. Each NPC cycles
// through their lines; the first chat with each one is worth +25
// respect XP. The renderer draws the marker; the world handles the
// E key; this module owns the NPC list and the dialogue.

import { Walker } from './entities.js';
import { NPC_DEFS } from './config.js';
import { dist2D } from './math3.js';

export class NPCs {
  constructor() {
    this.list = NPC_DEFS.map((d) => {
      const w = new Walker(d.x, d.z, 0, 'npc');
      w.shirt = d.shirt;
      w.npcName = d.name;
      w.npcLines = d.lines;
      w.npcLineIdx = 0;
      return w;
    });
    this.talkedTo = new Set();
    this.active = null; // {npc, line, t} — the open dialogue bubble
  }

  nearest(x, z, maxDist = 5) {
    let best = null;
    let bestD = maxDist;
    for (const n of this.list) {
      const d = dist2D(x, z, n.x, n.z);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  talk(npc, world) {
    if (!npc || !npc.npcLines) return;
    const line = npc.npcLines[npc.npcLineIdx % npc.npcLines.length];
    npc.npcLineIdx += 1;
    this.active = { npc, line, t: 5 };
    world.audio.click();
    if (!this.talkedTo.has(npc.npcName)) {
      this.talkedTo.add(npc.npcName);
      world.progression.addXp(25, `Met ${npc.npcName}`);
      world.setHint(`+25 RESPECT — met ${npc.npcName}`, 2.5);
    }
  }

  update(dt) {
    if (this.active) {
      this.active.t -= dt;
      if (this.active.t <= 0) this.active = null;
    }
  }
}
