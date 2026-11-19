'use strict';
// Packages the Lampo skill for skill marketplaces (Agensi and others that take a SKILL.md zip):
//   agensi/lampo-motion-designer.zip  →  lampo-motion-designer/SKILL.md + references/*.md
// The skill is the same as skills/lampo; only the folder name changes (the marketplace slug).
// Run: node scripts/build-agensi.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'skills/lampo');
const NAME = 'lampo-motion-designer';
const OUT = path.join(ROOT, 'agensi', `${NAME}.zip`);

execFileSync('sh', [path.join(ROOT, 'scripts/build-skill.sh')]); // refresh references/spec.md from src/guide.md
const skill = fs.readFileSync(path.join(SRC, 'SKILL.md'), 'utf8');
const fm = /^---\n([\s\S]*?)\n---/.exec(skill);
if (!fm || !/^name:\s*\S/m.test(fm[1]) || !/^description:/m.test(fm[1])) throw new Error('SKILL.md needs frontmatter with name and description');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lampo-agensi-'));
const dir = path.join(tmp, NAME);
fs.mkdirSync(path.join(dir, 'references'), { recursive: true });
fs.writeFileSync(path.join(dir, 'SKILL.md'), skill.replace(/^name:\s*.*$/m, `name: ${NAME}`));
for (const f of fs.readdirSync(path.join(SRC, 'references')).filter((n) => n.endsWith('.md')).sort()) {
  fs.copyFileSync(path.join(SRC, 'references', f), path.join(dir, 'references', f));
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.rmSync(OUT, { force: true });
execFileSync('zip', ['-qrX', OUT, NAME], { cwd: tmp });
fs.rmSync(tmp, { recursive: true, force: true });
const list = execFileSync('unzip', ['-l', OUT]).toString().trim().split('\n').slice(3, -2).map((l) => l.trim().split(/\s+/).pop());
console.log(`✓ ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB): ${list.join(', ')}`);
