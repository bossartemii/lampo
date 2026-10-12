'use strict';
// Smoke test: uses every effect, transition, images, audio and global layers.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const { createCanvas } = require('@napi-rs/canvas');
const lampo = require('..');
const { ffmpegPath } = require('../src/ffmpeg');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lampo-test-'));
  // test image
  const c = createCanvas(400, 300); const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 400, 300); g.addColorStop(0, '#ff375f'); g.addColorStop(1, '#0a84ff');
  x.fillStyle = g; x.fillRect(0, 0, 400, 300);
  fs.writeFileSync(path.join(dir, 'img.png'), await c.encode('png'));
  // test audio
  execFileSync(ffmpegPath(), ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=30', path.join(dir, 'a.mp3')]);

  const fx = lampo.effects();
  const scenes = fx.transitions.map((tr, i) => ({
    duration: 1.2,
    transition: tr,
    background: [i % 2 ? '#111' : { type: 'glow' }, { type: 'gradient', colors: ['#000', '#333'], animate: 20 }, { type: 'image', src: 'img.png' }][i % 3],
    layers: [],
  }));
  fx.enter.forEach((e, i) => {
    const S = scenes[i % scenes.length];
    const L = e.textOnly ? { text: `Test **${e.name}**\nsecond line`, size: 60 } : [{ type: 'rect', w: 200, h: 80, radius: 12 }, { type: 'circle', r: 50 }, { type: 'line', w: 300 }, { type: 'image', src: 'img.png', w: 240, radius: 20, shadow: true }][i % 4];
    S.layers.push({ ...L, y: `${20 + (S.layers.length * 12) % 70}%`, in: e.name, out: e.name });
  });
  fx.loop.forEach((l, i) => scenes[i % scenes.length].layers.push({ type: 'counter', to: 1234.5, decimals: 1, prefix: '€ ', size: 50, y: '85%', loop: l }));
  const spec = { format: '1:1', fps: 24, quality: 'draft', audio: { src: 'a.mp3', volume: 0.5 }, scenes, layers: [{ text: 'LOGO', size: 30, x: 'right', y: 'top', anchor: 'top-right', in: 'fade' }] };

  // the spec must be valid
  const s = lampo.validate(spec, { baseDir: dir });
  // a wrong spec gives useful errors
  assert.throws(() => lampo.validate({ scenes: [{ duration: 1, layers: [{ text: 'x', in: 'boh' }] }] }), /effect "boh" does not exist/);
  assert.throws(() => lampo.validate({ format: 'xx', scenes: [] }), /unknown format "xx"/);

  const out = path.join(dir, 'smoke.mp4');
  const r = await lampo.render(spec, out, { baseDir: dir });
  // probe with ffmpeg itself (ffmpeg-static ships no ffprobe)
  const probe = spawnSync(ffmpegPath(), ['-hide_banner', '-i', out]).stderr.toString();
  assert.match(probe, /Video: h264/); assert.match(probe, /Audio: aac/);
  assert(Math.abs(r.duration - s.duration) < 0.05);
  const p = await lampo.preview(spec, path.join(dir, 'p.png'), { baseDir: dir });
  assert(fs.statSync(p.file).size > 10000);
  console.log(`ok · ${scenes.length} scenes · ${fx.enter.length} effects · ${fx.loop.length} loops · ${r.duration}s rendered in ${r.renderSeconds}s`);
  console.log(dir);
})().catch((e) => { console.error(e); process.exit(1); });
