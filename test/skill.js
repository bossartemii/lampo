'use strict';
// Every ```json block in the skill references must be a valid Lampo spec (or scene).
// `node test/skill.js --preview <dir>` also writes a contact sheet per block, to look at them.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { createCanvas } = require('@napi-rs/canvas');
const lampo = require('..');

const REF = path.join(__dirname, '../skills/lampo/references');

// placeholder media the snippets point to
async function fixtures(dir) {
  const c = createCanvas(1200, 800);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1200, 800);
  g.addColorStop(0, '#7a3b12'); g.addColorStop(1, '#e0a050');
  x.fillStyle = g; x.fillRect(0, 0, 1200, 800);
  x.fillStyle = '#fff3'; x.beginPath(); x.arc(600, 420, 260, 0, Math.PI * 2); x.fill();
  const png = await c.encode('png');
  for (const f of ['photo.jpg', 'logo.png', 'product.png']) fs.writeFileSync(path.join(dir, f), png);
}

function blocks() {
  const out = [];
  // spec.md is the key reference (annotated fragments, not runnable specs)
  for (const f of fs.readdirSync(REF).filter((n) => n.endsWith('.md') && n !== 'spec.md')) {
    const md = fs.readFileSync(path.join(REF, f), 'utf8');
    const re = /^(#{2,3} .*)$|```json\n([\s\S]*?)```/gm;
    let m, title = f;
    while ((m = re.exec(md))) {
      if (m[1]) { title = `${f} ${m[1].replace(/^#+ /, '')}`; continue; }
      out.push({ title, src: m[2] });
    }
  }
  return out;
}

function asSpec(obj) {
  if (obj.scenes) return { format: '9:16', ...obj };
  if (obj.layers || obj.duration) return { format: '9:16', scenes: [obj] };
  return null; // a fragment (theme, background...): only checked as JSON
}

(async () => {
  const args = process.argv.slice(2);
  const previewDir = args[0] === '--preview' ? path.resolve(args[1] || 'skill-previews') : null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lampo-skill-'));
  await fixtures(dir);
  if (previewDir) fs.mkdirSync(previewDir, { recursive: true });
  let n = 0;
  for (const [i, b] of blocks().entries()) {
    let obj;
    try { obj = JSON.parse(b.src); } catch (e) { assert.fail(`${b.title}: invalid JSON: ${e.message}`); }
    const spec = asSpec(obj);
    if (!spec) continue;
    try { lampo.validate(JSON.parse(JSON.stringify(spec)), { baseDir: dir }); }
    catch (e) { assert.fail(`${b.title}: ${e.message}`); }
    n++;
    if (previewDir) {
      const name = `${String(i).padStart(2, '0')}-${b.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      const sp = JSON.parse(JSON.stringify(spec));
      const total = sp.scenes.reduce((a, s) => a + s.duration, 0);
      const times = Array.from({ length: 6 }, (_, k) => +(0.1 + (k * (total - 0.15)) / 5).toFixed(2));
      await lampo.preview(sp, path.join(previewDir, name), { baseDir: dir, times, scale: 0.25 });
    }
  }
  assert.ok(n >= 16, `expected at least 16 runnable snippets, found ${n}`);
  console.log(`ok · ${n} skill snippets valid${previewDir ? ` · previews in ${previewDir}` : ''}`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
