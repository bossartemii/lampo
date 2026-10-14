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
const captions = require('../src/captions');

(async () => {
  // Whisper JSON parsing and caption layer generation; no model required.
  const captionSegments = captions.parseWhisperJson({
    transcription: [
      { offsets: { from: 0, to: 1250 }, text: '  Hello  ' },
      { timestamps: { from: '00:00:01,250', to: '00:00:02,000' }, text: 'world' },
      { offsets: { from: 2000, to: 2500 }, text: '   ' },
    ],
  });

  assert.deepStrictEqual(captionSegments, [
    { start: 0, end: 1.25, text: 'Hello' },
    { start: 1.25, end: 2, text: 'world' },
  ]);

  const captionLayers = captions.buildCaptionLayers(captionSegments);
  assert.strictEqual(captionLayers.length, 2);
  assert.strictEqual(captionLayers[0].text, 'Hello');
  assert.strictEqual(captionLayers[0].start, 0);
  assert.strictEqual(captionLayers[0].end, 1.25);
  assert.strictEqual(captionLayers[1].start, 1.25);

  assert.throws(
    () => captions.parseWhisperJson({}),
    /no transcription or segments array/
  );
  assert.throws(
    () => captions.parseWhisperJson({ transcription: [] }),
    /no usable caption segments/
  );
  assert.throws(
    () => captions.parseWhisperJson({
      transcription: [{ offsets: { from: 2, to: 1 }, text: 'bad timing' }],
    }),
    /Invalid Whisper timestamps/
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lampo-test-'));
  // test image
  const c = createCanvas(400, 300); const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 400, 300); g.addColorStop(0, '#ff375f'); g.addColorStop(1, '#0a84ff');
  x.fillStyle = g; x.fillRect(0, 0, 400, 300);
  fs.writeFileSync(path.join(dir, 'img.png'), await c.encode('png'));
  // test clip with picture and sound
  execFileSync(ffmpegPath(), ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:d=1.5:r=24', '-f', 'lavfi', '-i', 'sine=f=300:d=1.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(dir, 'clip.mp4')]);
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
  scenes[1].layers.push({ text: 'manual', size: 40, y: '10%', sfx: { sound: 'chime', at: 0.1 } });
  scenes[2].background = { type: 'video', src: 'clip.mp4', overlay: 'rgba(0,0,0,.3)' };
  scenes[3].layers.push({ type: 'video', src: 'clip.mp4', w: 500, radius: 30, rate: 0.5, loop: false, audio: true, in: 'scaleIn' });
  scenes[4].layers.push({ src: 'clip.mp4', w: 400, trim: 0.5, y: '70%' });
  scenes[5].layers.push({ type: 'phone', w: 300, y: '55%', src: 'clip.mp4', in: 'slideUp', keyframes: [{ t: 0, scale: 1 }, { t: 1, scale: 1.1 }], layers: [
    { type: 'group', x: 0, y: 0, w: 390, h: 844, anchor: 'top-left', start: 0.2, in: 'slideLeft', layers: [
      { type: 'rect', x: 195, y: 400, w: 200, h: 60, radius: 12, keyframes: [{ t: 0.5, scale: 1 }, { t: 0.6, scale: 0.9 }, { t: 0.7, scale: 1 }] },
      { text: 'typed', size: 20, x: 40, y: 300, anchor: 'left', in: { effect: 'typewriter', delay: 0.1 } },
      { type: 'group', x: 195, y: 600, w: 160, h: 50, rotate: -8, in: 'stamp', layers: [{ type: 'rect', x: 0, y: 0, w: 160, h: 50, anchor: 'top-left', color: 'none', stroke: { color: '#f60', width: 3 } }, { text: 'STAMP', size: 20, wrap: false }] },
      { src: 'clip.mp4', w: 200, y: 700 },
    ] },
    { type: 'cursor', path: [{ t: 0, x: 100, y: 700 }, { t: 0.6, x: 195, y: 400, tap: true }] },
  ] });
  scenes[7].layers.push(
    { text: 'Veloce', size: 60, icon: 'gauge', iconDraw: true, in: 'glitch', y: '20%' },
    { type: 'icon', name: 'truck', size: 80, in: 'draw', y: '40%' },
    { type: 'spinner', size: 50, y: '55%' },
    { type: 'rect', w: 40, h: 40, radius: 20, color: '#000', y: '70%', in: 'rush', keyframes: [{ t: 0, w: 40, h: 40, radius: 20 }, { t: 0.5, w: 300, h: 6, radius: 3, color: '#ff0000' }, { t: 1, w: 200, h: 80, radius: 10, color: '#00f' }] },
    { type: 'circle', r: 10, x: '80%', y: '80%', keyframes: [{ t: 0, r: 10 }, { t: 1, r: 900 }] },
    { type: 'cursor', style: 'arrow', path: [{ t: 0, x: 100, y: 100 }, { t: 0.5, x: 500, y: 500, tap: true }] },
  );
  for (const shape of ['underline', 'circle', 'arrow', 'check']) scenes[6].layers.push({ type: 'path', shape, w: 300, h: 80, y: `${20 + scenes[6].layers.length * 8}%`, in: 'draw' });
  scenes[6].layers.push({ d: 'M10 80 Q 50 10 90 80 T 170 80', w: 300, h: 120, y: '80%', in: 'draw' });
  const spec = { format: '1:1', fps: 24, quality: 'draft', audio: { src: 'a.mp3', volume: 0.5 }, sfx: true, sounds: [{ sound: 'riser', at: 0.2, duration: 0.8 }, { sound: 'boom', at: 1.0 }, { sound: 'glitch', at: 2 }, { sound: 'click', at: 2.5 }], scenes, layers: [{ text: 'LOGO', size: 30, x: 'right', y: 'top', anchor: 'top-right', in: 'fade' }] };

  // the spec must be valid
  const s = lampo.validate(spec, { baseDir: dir });
  // a wrong spec gives useful errors
  // invalid dimensions and fps must be rejected
  // reject invalid input, duration, transition duration and output scale
  // every sound renders clean audio, with any seed and options
  const { SOUNDS } = require('../src/sfx');
  assert.ok(fx.sounds.length >= 42, 'expected at least 42 sounds');
  for (const n of fx.sounds) for (const seed of [1234, 1311]) for (const o of [{}, { duration: 0.4, pitch: 300 }, { duration: 3, pitch: 2000 }]) {
    const snd = SOUNDS[n](o, seed);
    let peak = 0;
    for (const v of snd.data) { assert.ok(Number.isFinite(v), `${n}: NaN in audio`); peak = Math.max(peak, Math.abs(v)); }
    assert.ok(peak > 0.05 && peak <= 1, `${n}: peak ${peak}`);
    assert.ok(snd.hit >= 0 && snd.hit <= snd.data.length / 44100 + 1e-6, `${n}: hit outside the sound`);
  }
  assert.throws(() => lampo.validate(null), /spec must be a JSON object/);
  assert.throws(() => lampo.validate(undefined), /spec must be a JSON object/);
  assert.throws(() => lampo.validate({ scenes: [{ duration: 'abc' }] }), /duration.*positive finite number/);
  assert.throws(() => lampo.validate({ scale: -1, scenes: [{ duration: 1 }] }), /scale must be a positive finite number/);
  const firstTransition = fx.transitions[0];
  const transitionType = typeof firstTransition === 'string' ? firstTransition : firstTransition.type;
  assert.throws(() => lampo.validate({
    scenes: [
      { duration: 1 },
      { duration: 1, transition: { type: transitionType, duration: -1 } }
    ]
  }), /transition: duration must be a finite number/);
  assert.throws(() => lampo.validate({ fps: 'abc', scenes: [{ duration: 1 }] }), /fps must be a number between 1 and 120/);
  assert.throws(() => lampo.validate({ width: -100, height: 200, scenes: [{ duration: 1 }] }), /width must be a positive finite number/);
  assert.throws(() => lampo.validate({ width: 200, height: 0, scenes: [{ duration: 1 }] }), /height must be a positive finite number/);
  assert.throws(() => lampo.validate({ fps: 121, scenes: [{ duration: 1 }] }), /fps must be a number between 1 and 120/);
  assert.throws(() => lampo.validate({ scenes: [{ duration: 1, layers: [{ text: 'x', in: 'boh' }] }] }), /effect "boh" does not exist/);
  assert.throws(() => lampo.validate({ format: 'xx', scenes: [] }), /unknown format "xx"/);
  assert.throws(() => lampo.validate({ sounds: [{ sound: 'meow', at: 1 }], scenes: [{ duration: 1 }] }), /sound "meow" does not exist/);
  assert.throws(() => lampo.validate({ scenes: [{ duration: 1, layers: [{ type: 'video', src: 'nope.mp4' }] }] }), /file not found/);
  assert.throws(() => lampo.validate({ scenes: [{ duration: 1, layers: [{ type: 'path', shape: 'blob' }] }] }), /shape "blob" does not exist/);
  assert.throws(() => lampo.validate({ scenes: [{ duration: 1, layers: [{ type: 'icon', name: 'unicorn' }] }] }), /icon "unicorn" does not exist/);
  assert.throws(() => lampo.validate({ scenes: [{ duration: 1, layers: [{ type: 'phone', layers: [{ type: 'cursor' }] }] }] }), /cursor needs "path"/);
  assert.strictEqual(s.scenes[4].layers[s.scenes[4].layers.length - 1].type, 'video');
  const sfx = require('../src/sfx');
  const events = sfx.buildEvents(s);
  for (const name of ['whoosh', 'pop', 'tick', 'chime', 'riser', 'boom', 'ding', 'click', 'impact', 'glitch']) assert(events.some((e) => e.sound === name), `missing auto/manual sound ${name}`);

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
