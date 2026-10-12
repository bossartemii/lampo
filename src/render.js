'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const { createCanvas } = require('@napi-rs/canvas');
const { normalize, parseLoose } = require('./spec');
const { createRenderer } = require('./frame');
const { run, ffmpegPath } = require('./ffmpeg');
const sfx = require('./sfx');
const video = require('./video');
const { isVideoSrc } = require('./frame');

function runWorker(spec, from, to, out, onProgress) {
  return new Promise((resolve, reject) => {
    const w = new Worker(path.join(__dirname, 'worker.js'), { workerData: { spec, from, to, out } });
    w.on('message', (m) => {
      if (m.type === 'progress') onProgress(m.done);
      else if (m.type === 'done') resolve();
      else if (m.type === 'error') reject(new Error(m.message));
    });
    w.on('error', reject);
    w.on('exit', (code) => { if (code !== 0) reject(new Error(`worker exited with code ${code}`)); });
  });
}

/**
 * Render a video. The timeline is split into chunks; each chunk is rendered
 * and encoded in parallel, then the parts are joined without re-encoding.
 */
async function render(input, out, opts = {}) {
  const t0 = Date.now();
  const parsed = typeof input === 'string' ? parseLoose(input) : input;
  const spec = normalize(opts.quality ? { ...parsed, quality: opts.quality } : parsed, { baseDir: opts.baseDir });
  ffmpegPath();
  out = path.resolve(out || 'video.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const frames = spec.totalFrames;
  // a chunk is only worth it with at least ~1 second of frames
  const maxW = opts.workers ?? Math.max(1, os.availableParallelism ? os.availableParallelism() : os.cpus().length);
  const n = Math.max(1, Math.min(maxW, Math.floor(frames / spec.fps) || 1));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lampo-'));
  const withSfx = sfx.hasSfx(spec);
  // clips that should be heard: "audio": true or a "volume" on a video layer / background
  const clipAudio = [];
  const wantAudio = (o) => o.audio === true || (typeof o.volume === 'number' && o.volume > 0);
  for (const S of spec.scenes) {
    const bg = S.background;
    if (bg && typeof bg === 'object' && !Array.isArray(bg) && bg.src && (bg.type === 'video' || isVideoSrc(bg.src)) && wantAudio(bg)) clipAudio.push({ o: bg, at: S.start, dur: S.duration });
    for (const L of S.layers) if (L.type === 'video' && wantAudio(L)) { const st = L.start ?? 0; const end = L.end ?? (L.duration != null ? st + L.duration : S.duration); clipAudio.push({ o: L, at: S.start + st, dur: end - st }); }
  }
  for (const L of spec.layers) if (L.type === 'video' && wantAudio(L)) { const st = L.start ?? 0; clipAudio.push({ o: L, at: st, dur: (L.end ?? (L.duration != null ? st + L.duration : spec.duration)) - st }); }
  const heard = clipAudio.filter((c) => video.probe(c.o.src).hasAudio);
  const silentOut = spec.audio || withSfx || heard.length ? path.join(tmp, 'video.mp4') : out;

  const done = new Array(n).fill(0);
  const report = () => opts.onProgress && opts.onProgress(done.reduce((a, b) => a + b, 0) / frames);

  try {
    if (n === 1) {
      await runWorker(spec, 0, frames, silentOut, (d) => { done[0] = d; report(); });
    } else {
      const per = Math.ceil(frames / n);
      const parts = [];
      for (let i = 0; i < n; i++) {
        const from = i * per, to = Math.min(frames, from + per);
        if (from >= to) break;
        parts.push({ from, to, file: path.join(tmp, `part${i}.mp4`), i });
      }
      await Promise.all(parts.map((p) => runWorker(spec, p.from, p.to, p.file, (d) => { done[p.i] = d; report(); })));
      const list = path.join(tmp, 'list.txt');
      fs.writeFileSync(list, parts.map((p) => `file '${p.file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
      await run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', silentOut]);
    }
    if (spec.audio || withSfx || heard.length) {
      const inputs = ['-i', silentOut];
      const chains = [];
      const labels = [];
      if (spec.audio) {
        const a = spec.audio;
        const fade = a.fadeOut ?? 1;
        inputs.push('-ss', String(a.start ?? 0), '-i', a.src);
        chains.push(`[${inputs.filter((x) => x === '-i').length - 1}:a]afade=t=in:st=0:d=${a.fadeIn ?? 0.3},afade=t=out:st=${Math.max(0, spec.duration - fade)}:d=${fade},volume=${a.volume ?? 1}[music]`);
        labels.push('[music]');
      }
      heard.forEach((c, k) => {
        const info = video.probe(c.o.src);
        const trim = c.o.trim ?? 0;
        const len = Math.max(0.05, Math.min(c.dur, info.duration != null ? info.duration - trim : c.dur));
        inputs.push('-ss', String(trim), '-t', len.toFixed(3), '-i', c.o.src);
        const idx = inputs.filter((x) => x === '-i').length - 1;
        const ms = Math.round(c.at * 1000);
        chains.push(`[${idx}:a]aresample=44100,adelay=${ms}|${ms},volume=${c.o.volume ?? 1}[clip${k}]`);
        labels.push(`[clip${k}]`);
      });
      if (withSfx) {
        const wav = path.join(tmp, 'sfx.wav');
        fs.writeFileSync(wav, sfx.renderTrack(spec, sfx.buildEvents(spec)));
        inputs.push('-i', wav);
        labels.push(`[${inputs.filter((x) => x === '-i').length - 1}:a]`);
      }
      const filter = chains.concat(labels.length > 1 ? [`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest[aout]`] : [`${labels[0]}anull[aout]`]).join(';');
      await run([...inputs, '-filter_complex', filter, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(spec.duration), '-movflags', '+faststart', out]);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const seconds = (Date.now() - t0) / 1000;
  return {
    file: out,
    duration: +spec.duration.toFixed(2),
    frames,
    width: spec.outWidth,
    height: spec.outHeight,
    fps: spec.fps,
    workers: n,
    renderSeconds: +seconds.toFixed(2),
    speed: +(spec.duration / seconds).toFixed(2),
    sizeKB: Math.round(fs.statSync(out).size / 1024),
  };
}

/**
 * Fast preview: one image with N keyframes in a grid.
 * Lets the agent "look" at the video before the final render.
 */
async function preview(input, out, opts = {}) {
  const spec = normalize({ ...(typeof input === 'string' ? parseLoose(input) : input), quality: 'draft' }, { baseDir: opts.baseDir });
  spec.outScale = opts.scale ?? 0.3;
  spec.outWidth = Math.round(spec.width * spec.outScale);
  spec.outHeight = Math.round(spec.height * spec.outScale);
  const r = await createRenderer(spec);
  let times = opts.times;
  if (!times) {
    // per scene: early, middle, near the end
    times = [];
    for (const S of spec.scenes) times.push(S.start + Math.min(0.35, S.duration * 0.15), S.start + S.duration * 0.55, S.end - 0.05);
  }
  times = times.map((t) => Math.max(0, Math.min(spec.duration, t)));
  const cols = opts.cols ?? Math.min(times.length, spec.width > spec.height ? 3 : 6);
  const rows = Math.ceil(times.length / cols);
  const gap = 8, label = 26;
  const sheet = createCanvas(cols * (r.width + gap) + gap, rows * (r.height + gap + label) + gap);
  const sx = sheet.getContext('2d');
  sx.fillStyle = '#18181b';
  sx.fillRect(0, 0, sheet.width, sheet.height);
  sx.font = '600 16px "Inter"';
  for (const [i, t] of times.entries()) {
    if (r.hasVideo) await r.prepare(t);
    r.renderAt(t);
    const x = gap + (i % cols) * (r.width + gap);
    const y = gap + Math.floor(i / cols) * (r.height + gap + label);
    sx.drawImage(r.canvas, x, y + label);
    sx.fillStyle = '#a1a1aa';
    sx.fillText(`${t.toFixed(2)}s`, x + 2, y + 18);
  }
  r.close();
  out = path.resolve(out || 'preview.png');
  fs.writeFileSync(out, await sheet.encode('png'));
  return { file: out, times: times.map((t) => +t.toFixed(2)), duration: +spec.duration.toFixed(2) };
}

/** A single full-resolution frame, as PNG. */
async function still(input, out, t, opts = {}) {
  const spec = normalize(input, { baseDir: opts.baseDir });
  const r = await createRenderer(spec);
  const tt = Math.max(0, Math.min(spec.duration, t));
  if (r.hasVideo) await r.prepare(tt);
  r.renderAt(tt);
  r.close();
  out = path.resolve(out || 'frame.png');
  fs.writeFileSync(out, await r.canvas.encode('png'));
  return { file: out, time: t };
}

module.exports = { render, preview, still };
