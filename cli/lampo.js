#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const lampo = require('..');

const HELP = `Lampo — fast videos from JSON, no browser

  lampo render  <spec.json> [-o video.mp4] [-q draft|standard|high] [-w workers]
  lampo preview <spec.json> [-o preview.png]       keyframe contact sheet
  lampo still   <spec.json> <seconds> [-o f.png]   one full-resolution frame
  lampo validate <spec.json>                       check a spec
  lampo effects                                    list effects and transitions
  lampo guide                                      full format reference
  lampo init [name]                                create a starter spec
  lampo mcp [--http 3333]                          start the MCP server
`;

function arg(flags, def) {
  for (const f of flags) { const i = process.argv.indexOf(f); if (i >= 0) return process.argv[i + 1]; }
  return def;
}

function readSpec(file) {
  if (!file) { console.error('Missing spec file.\n\n' + HELP); process.exit(1); }
  return { text: fs.readFileSync(file, 'utf8'), baseDir: path.dirname(path.resolve(file)) };
}

function bar(p) {
  if (!process.stderr.isTTY) return;
  const n = 28, f = Math.round(p * n);
  process.stderr.write(`\r  [${'█'.repeat(f)}${'░'.repeat(n - f)}] ${(p * 100).toFixed(0).padStart(3)}%`);
}

(async () => {
  const [cmd, a1, a2] = process.argv.slice(2);
  switch (cmd) {
    case 'render': {
      const { text, baseDir } = readSpec(a1);
      const out = arg(['-o', '--out'], a1.replace(/\.json$/i, '') + '.mp4');
      const r = await lampo.render(text, out, { baseDir, quality: arg(['-q', '--quality']), workers: arg(['-w', '--workers']) ? Number(arg(['-w', '--workers'])) : undefined, onProgress: bar });
      if (process.stderr.isTTY) process.stderr.write('\n');
      console.log(`✓ ${r.file}\n  ${r.width}x${r.height} · ${r.duration}s · ${r.frames} frames · ${r.workers} workers · rendered in ${r.renderSeconds}s (${r.speed}x real time) · ${r.sizeKB} KB`);
      break;
    }
    case 'preview': {
      const { text, baseDir } = readSpec(a1);
      const r = await lampo.preview(text, arg(['-o', '--out'], a1.replace(/\.json$/i, '') + '.preview.png'), { baseDir });
      console.log(`✓ ${r.file}  (keyframes at ${r.times.join(', ')}s)`);
      break;
    }
    case 'still': {
      const { text, baseDir } = readSpec(a1);
      const r = await lampo.still(text, arg(['-o', '--out'], `frame-${a2}.png`), Number(a2) || 0, { baseDir });
      console.log(`✓ ${r.file}`);
      break;
    }
    case 'validate': {
      const { text, baseDir } = readSpec(a1);
      const s = lampo.validate(text, { baseDir });
      console.log(`✓ valid: ${s.scenes.length} scenes, ${s.duration.toFixed(2)}s, ${s.outWidth}x${s.outHeight}`);
      break;
    }
    case 'effects':
      console.log(JSON.stringify(lampo.effects(), null, 2));
      break;
    case 'guide':
      console.log(fs.readFileSync(path.join(__dirname, '../src/guide.md'), 'utf8'));
      break;
    case 'init': {
      const name = (a1 || 'video').replace(/\.json$/i, '') + '.json';
      fs.copyFileSync(path.join(__dirname, '../examples/starter.json'), name);
      console.log(`✓ created ${name}. Next: lampo preview ${name}`);
      break;
    }
    case 'mcp': {
      const srv = require('../mcp/server');
      const i = process.argv.indexOf('--http');
      if (i >= 0) srv.startHttp(Number(process.argv[i + 1]) || 3333); else srv.startStdio();
      break;
    }
    default:
      console.log(HELP);
  }
})().catch((e) => { console.error('\n✗ ' + e.message); process.exit(1); });
