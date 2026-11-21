// Solmar Bay v4 — entry point for the gta6-01 bounty (Node 22+,
// standard library only).
//
// The game itself is plain static files under game/: index.html plus
// ES modules, no third-party code and no network access anywhere.
// This script is the hand-in: it stages game/ and screenshots/ into
// the output directory and writes dossier.json — the summary the
// judge reads — through the vendored make.fun helper
// (vendor/makefun-game.ts, untouched).
//
// Run it the way the grader does:
//   node main.ts
// or, outside the grader container, point the output elsewhere:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's caps, from the competition's gate: the text budget
// shapes the dossier's bytes, and the rest refuse an entry the
// scorer would refuse — more than 4 screenshots, a screenshot over
// 256 KiB, more than 993 files under game/, more than 48 MiB of
// game files, or a game path longer than 1000 bytes.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
