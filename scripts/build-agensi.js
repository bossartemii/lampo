'use strict';
// Packages the Lampo skill for skill marketplaces (Agensi and others that take a SKILL.md zip):
//   agensi/lampo-motion-designer.zip  →  lampo-motion-designer/
//     SKILL.md, LICENSE, NOTICE, scripts/preflight.sh, references/*.md, references/packs/*.md
// The packs are the paid part: they live in private/packs (not in the public repo) and must be built first
// (node private/packs/build.js). The build fails if LICENSE or the packs are missing.
// Run: node scripts/build-agensi.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'skills/lampo');
const PACKS = path.join(ROOT, 'private/packs/out');
const NAME = 'lampo-motion-designer';
const OUT = path.join(ROOT, 'agensi', `${NAME}.zip`);
const need = (ok, msg) => { if (!ok) { console.error(`✗ ${msg}`); process.exit(1); } };

need(fs.existsSync(path.join(ROOT, 'LICENSE')), 'LICENSE is missing at the repo root');
need(fs.existsSync(path.join(SRC, 'scripts/preflight.sh')), 'skills/lampo/scripts/preflight.sh is missing');
const packs = fs.existsSync(PACKS) ? fs.readdirSync(PACKS).filter((n) => n.endsWith('.md')).sort() : [];
need(packs.length >= 13, `industry packs missing in private/packs/out (found ${packs.length}, need README + 12): run node private/packs/build.js`);

execFileSync('sh', [path.join(ROOT, 'scripts/build-skill.sh')]); // refresh references/spec.md from src/guide.md
let skill = fs.readFileSync(path.join(SRC, 'SKILL.md'), 'utf8');
const fm = /^---\n([\s\S]*?)\n---/.exec(skill);
need(fm && /^name:\s*\S/m.test(fm[1]) && /^description:/m.test(fm[1]), 'SKILL.md needs frontmatter with name and description');

// the packaged SKILL.md knows about the packs
skill = skill.replace(/^name:\s*.*$/m, `name: ${NAME}`);
const reviewRow = /^\| `references\/review\.md` .*$/m;
need(reviewRow.test(skill), 'SKILL.md references table changed: update build-agensi.js');
skill = skill.replace(reviewRow, (row) => `${row}\n| \`references/packs/\` | 12 industry packs (restaurant, gym, real estate, SaaS, café, barber, e-commerce, clinic, hotel, car dealer, agency, event): 3 finished specs each with copy structure and brand slots | step 2, whenever the client is in one of these industries |`);
const routeLine = /^and a typical blueprint sequence\.$/m;
need(routeLine.test(skill), 'SKILL.md route paragraph changed: update build-agensi.js');
skill = skill.replace(routeLine, (l) => `${l}\n\n**Industry packs first.** If the client is in one of the 12 industries of \`references/packs/README.md\`, open that pack:\nstart from its spec (15 s ad, 5 s offer, 4 s sting), swap the brand slots, keep the timing and camera, then direct the\ndifferences (their colors, media and offer). It is a starting point that already passed review, not a template to fill blindly.`);

const NOTICE = `Lampo Motion Designer (skill package)
Copyright 2026 Dimitri Artemii

The Lampo engine is free and Apache-2.0: https://github.com/bossartemii/lampo
This package is the paid direction layer: packs, recipes, review gate. You are buying the director, not the renderer.

The industry packs in references/packs/ are licensed to the buyer for use in their own and their clients' videos.
They may not be redistributed or resold as a skill, template pack or dataset.
The rest of this package is distributed under the Apache License 2.0 (see LICENSE).
`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lampo-agensi-'));
const dir = path.join(tmp, NAME);
fs.mkdirSync(path.join(dir, 'references/packs'), { recursive: true });
fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
fs.writeFileSync(path.join(dir, 'SKILL.md'), skill);
fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(dir, 'LICENSE'));
fs.writeFileSync(path.join(dir, 'NOTICE'), NOTICE);
fs.copyFileSync(path.join(SRC, 'scripts/preflight.sh'), path.join(dir, 'scripts/preflight.sh'));
fs.chmodSync(path.join(dir, 'scripts/preflight.sh'), 0o755);
for (const f of fs.readdirSync(path.join(SRC, 'references')).filter((n) => n.endsWith('.md')).sort()) {
  fs.copyFileSync(path.join(SRC, 'references', f), path.join(dir, 'references', f));
}
for (const f of packs) fs.copyFileSync(path.join(PACKS, f), path.join(dir, 'references/packs', f));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.rmSync(OUT, { force: true });
execFileSync('zip', ['-qrX', OUT, NAME], { cwd: tmp });
fs.rmSync(tmp, { recursive: true, force: true });
const list = execFileSync('unzip', ['-l', OUT]).toString().trim().split('\n').slice(3, -2).map((l) => l.trim().split(/\s+/).pop());
for (const must of ['SKILL.md', 'LICENSE', 'NOTICE', 'scripts/preflight.sh', 'references/packs/README.md']) need(list.includes(`${NAME}/${must}`), `zip lacks ${must}`);
console.log(`✓ ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, ${list.filter((f) => !f.endsWith('/')).length} files)`);
console.log(list.filter((f) => !f.endsWith('/')).map((f) => '  ' + f).join('\n'));
