'use strict';
const { spawn, spawnSync } = require('child_process');

let cached;
function ffmpegPath() {
  if (cached) return cached;
  const candidates = [process.env.LAMPO_FFMPEG];
  try { candidates.push(require('ffmpeg-static')); } catch { /* optional */ }
  candidates.push('ffmpeg');
  for (const c of candidates) {
    if (!c) continue;
    const r = spawnSync(c, ['-version'], { stdio: 'ignore' });
    if (r.status === 0) return (cached = c);
  }
  throw new Error('ffmpeg not found. Install it (brew install ffmpeg / apt install ffmpeg / winget install ffmpeg) or run: npm i ffmpeg-static');
}

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg: ' + err.trim()))));
  });
}

// ffmpeg process that receives raw RGBA frames on stdin
function encoder({ width, height, fps, out, crf, preset }) {
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', out,
  ];
  const p = spawn(ffmpegPath(), args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => (err += d));
  const done = new Promise((resolve, reject) => {
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg: ' + err.trim()))));
  });
  p.stdin.on('error', () => { /* the real error is reported on "close" */ });
  let closed = false;
  done.catch(() => {}).finally(() => (closed = true));
  const write = (buf) => {
    if (closed) return done;
    if (p.stdin.write(buf)) return Promise.resolve();
    return Promise.race([new Promise((r) => p.stdin.once('drain', r)), done]);
  };
  const end = () => { p.stdin.end(); return done; };
  return { write, end };
}

module.exports = { ffmpegPath, run, encoder };
