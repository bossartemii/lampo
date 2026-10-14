'use strict';
// Lampo in the browser: the same engine as the CLI (spec validation, frame drawing, sound design),
// drawing on an HTML canvas. Used by the playground (docs/playground). Built by scripts/build-web.js.
const { normalize, parseLoose, SpecError } = require('../src/spec');
const { createRenderer } = require('../src/frame');
const { describe } = require('../src/effects');
const sfx = require('../src/sfx');
const { fontQueue } = require('./shims/canvas');
const { watermark } = require('../src/watermark');
const { loadVideo } = require('./shims/video');
const mp4 = require('mp4-muxer');
const webm = require('webm-muxer');

const SR = sfx.SR;

/**
 * Validate a spec (object or JSON text) for the browser. Throws SpecError with fix-it messages.
 * opts.watermark: true adds the Lampo watermark (the playground's free preview and download).
 */
function prepare(input, overrides = {}, opts = {}) {
  let obj = typeof input === 'string' ? parseLoose(input) : JSON.parse(JSON.stringify(input));
  if (opts.watermark) obj = watermark(obj);
  return normalize({ ...obj, ...overrides }, { baseDir: '' });
}

function walk(layers, fn) {
  for (const L of layers || []) { fn(L); if (L.layers) walk(L.layers, fn); }
}

/** Load what the frames need before drawing: fonts (and the weights in use) and video clips. */
async function load(spec) {
  const jobs = [];
  for (const f of spec.fonts || []) {
    const face = new FontFace(f.family, `url(${JSON.stringify(f.path)})`);
    jobs.push(face.load().then((ff) => document.fonts.add(ff)).catch(() => { throw new Error(`Could not load font "${f.path}"`); }));
  }
  fontQueue.length = 0;
  // ask the browser for every family/weight combination the spec draws with
  const want = new Set();
  const visit = (L) => {
    if (L.type === 'text' || L.type === 'counter') want.add(`${L.italic ? 'italic ' : ''}${L.weight ?? 700} 40px "${L.font || spec.theme.font || 'Inter'}"`);
  };
  for (const S of spec.scenes) walk(S.layers, visit);
  walk(spec.layers, visit);
  for (const w of want) jobs.push(document.fonts.load(w).catch(() => null));
  const videos = new Set();
  const isVid = (src) => /\.(mp4|mov|m4v|webm|mkv|avi)(\?|$)/i.test(String(src));
  const vv = (L) => { if ((L.type === 'video' || (L.type === 'phone' && L.src && isVid(L.src))) && L.src) videos.add(L.src); };
  for (const S of spec.scenes) {
    walk(S.layers, vv);
    const bg = S.background;
    if (bg && typeof bg === 'object' && !Array.isArray(bg) && bg.src && (bg.type === 'video' || isVid(bg.src))) videos.add(bg.src);
  }
  walk(spec.layers, vv);
  for (const v of videos) jobs.push(loadVideo(v));
  await Promise.all(jobs);
}

/** A ready renderer: load assets, then renderAt(t) draws synchronously (await prepare(t) first when it has video). */
async function renderer(spec) {
  await load(spec);
  return createRenderer(spec);
}

/** The whole soundtrack (sound effects + music) as a stereo AudioBuffer. Returns null when the video is silent. */
async function soundtrack(spec) {
  const hasSfx = sfx.hasSfx(spec);
  if (!hasSfx && !spec.audio) return null;
  const len = Math.ceil(spec.duration * SR);
  const ctx = new OfflineAudioContext(2, Math.max(1, len), SR);
  if (hasSfx) {
    // same mix as the CLI (src/sfx.js renderTrack), as float samples
    const events = sfx.buildEvents(spec);
    const master = (spec.sfx && typeof spec.sfx === 'object' ? spec.sfx.volume : null) ?? 0.8;
    const mix = new Float32Array(len);
    const cache = new Map();
    const varied = ['whoosh', 'swoosh', 'swipe', 'impact', 'boom', 'riser', 'glitch', 'click', 'tap', 'keyboard', 'shutter', 'air', 'flyby', 'spin', 'punch', 'slam', 'snare', 'clap', 'hihat', 'sparkle'];
    events.forEach((e, idx) => {
      const key = e.sound + JSON.stringify(e.o) + (varied.includes(e.sound) ? idx % 4 : '');
      let s = cache.get(key);
      if (!s) { s = sfx.SOUNDS[e.sound](e.o || {}, 1234 + (idx % 4) * 77); cache.set(key, s); }
      const off = Math.round(e.t * SR);
      for (let i = 0; i < s.data.length; i++) { const j = off + i; if (j >= 0 && j < len) mix[j] += s.data[i] * e.vol * master; }
    });
    for (let i = 0; i < len; i++) mix[i] = Math.tanh(mix[i] * 1.1) * 0.977;
    const fade = Math.min(len, Math.round(0.03 * SR));
    for (let i = 0; i < fade; i++) mix[len - 1 - i] *= i / fade;
    const buf = ctx.createBuffer(2, len, SR);
    buf.copyToChannel(mix, 0); buf.copyToChannel(mix, 1);
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.connect(ctx.destination);
    node.start(0);
  }
  if (spec.audio) {
    const a = spec.audio;
    const data = await fetch(a.src).then((r) => { if (!r.ok) throw new Error(`Could not load audio "${a.src}"`); return r.arrayBuffer(); });
    const music = await ctx.decodeAudioData(data);
    const node = ctx.createBufferSource();
    node.buffer = music;
    const gain = ctx.createGain();
    const vol = a.volume ?? 1, fin = a.fadeIn ?? 0.3, fout = a.fadeOut ?? 1;
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(vol, Math.max(0.001, fin));
    gain.gain.setValueAtTime(vol, Math.max(fin, spec.duration - fout));
    gain.gain.linearRampToValueAtTime(0, spec.duration);
    node.connect(gain).connect(ctx.destination);
    node.start(0, a.start ?? 0);
  }
  return ctx.startRendering();
}

// MP4 (H.264 + AAC) when the browser can encode it, else WebM (VP9 + Opus): Firefox and open-source Chromium
const FORMATS = [
  { type: 'mp4', mime: 'video/mp4', codecs: ['avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42e01f'], muxCodec: 'avc', audio: { codec: 'mp4a.40.2', mux: 'aac' } },
  { type: 'webm', mime: 'video/webm', codecs: ['vp09.00.40.08', 'vp09.00.31.08', 'vp8'], muxCodec: null, audio: { codec: 'opus', mux: 'A_OPUS' } },
];

async function pickFormat(W, H, fps, only) {
  for (const f of FORMATS) {
    if (only && f.type !== only) continue;
    for (const c of f.codecs) {
      const ok = await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 8e6, framerate: fps }).catch(() => ({ supported: false }));
      if (ok.supported) return { ...f, codec: c, muxCodec: f.muxCodec || (c.startsWith('vp09') ? 'V_VP9' : 'V_VP8') };
    }
  }
  return null;
}

/**
 * Encode the spec to a video file in the browser (WebCodecs), frame-exact and faster than real time.
 * MP4 (H.264/AAC) where the browser supports it, else WebM (VP9/Opus).
 * opts: { scale, format: 'mp4' | 'webm', watermark, onProgress(0..1), signal }. Returns a Blob; blob.type says which.
 */
async function exportVideo(input, opts = {}) {
  if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot encode video (no WebCodecs). Use Chrome, Edge or Safari 17+, or the Lampo CLI.');
  const spec = prepare(input, opts.scale ? { scale: opts.scale } : {}, { watermark: opts.watermark });
  // H.264 needs even dimensions
  spec.outWidth -= spec.outWidth % 2;
  spec.outHeight -= spec.outHeight % 2;
  const r = await renderer(spec);
  const W = r.width, H = r.height, fps = spec.fps;

  const fmt = await pickFormat(W, H, fps, opts.format);
  if (!fmt) throw new Error(`This browser cannot encode video at ${W}×${H}. Try a lower quality, another browser, or the Lampo CLI.`);
  const codec = fmt.codec;

  const audio = await soundtrack(spec);
  let audioOk = false;
  if (audio && typeof AudioEncoder !== 'undefined') {
    const s = await AudioEncoder.isConfigSupported({ codec: fmt.audio.codec, sampleRate: SR, numberOfChannels: 2, bitrate: 192000 }).catch(() => ({ supported: false }));
    audioOk = s.supported;
  }

  const lib = fmt.type === 'mp4' ? mp4 : webm;
  const target = new lib.ArrayBufferTarget();
  const muxer = new lib.Muxer({
    target,
    video: { codec: fmt.muxCodec, width: W, height: H, frameRate: fps },
    ...(audioOk ? { audio: { codec: fmt.audio.mux, numberOfChannels: 2, sampleRate: SR } } : {}),
    ...(fmt.type === 'mp4' ? { fastStart: 'in-memory' } : {}),
  });
  let failure = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
  venc.configure({ codec, width: W, height: H, bitrate: Math.round(W * H * fps * 0.12), framerate: fps, ...(fmt.type === 'mp4' ? { avc: { format: 'avc' } } : {}) });

  const frames = spec.totalFrames;
  for (let i = 0; i < frames; i++) {
    if (opts.signal?.aborted) { venc.close(); throw new DOMException('Export cancelled', 'AbortError'); }
    if (failure) throw failure;
    const t = i / fps;
    if (r.hasVideo) await r.prepare(t);
    r.renderAt(t);
    const frame = new VideoFrame(r.canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    venc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    while (venc.encodeQueueSize > 8) await new Promise((res) => setTimeout(res, 1));
    if (i % 6 === 0) { opts.onProgress?.(i / frames * (audioOk ? 0.95 : 1)); await new Promise((res) => setTimeout(res, 0)); }
  }
  await venc.flush();
  venc.close();

  if (audioOk) {
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { failure = e; } });
    aenc.configure({ codec: fmt.audio.codec, sampleRate: SR, numberOfChannels: 2, bitrate: 192000 });
    const L = audio.getChannelData(0), R = audio.getChannelData(1);
    const block = 1024;
    for (let off = 0; off < audio.length; off += block) {
      const n = Math.min(block, audio.length - off);
      const planar = new Float32Array(n * 2);
      planar.set(L.subarray(off, off + n), 0);
      planar.set(R.subarray(off, off + n), n);
      const data = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((off / SR) * 1e6), data: planar });
      aenc.encode(data);
      data.close();
    }
    await aenc.flush();
    aenc.close();
  }
  if (failure) throw failure;
  r.close();
  muxer.finalize();
  opts.onProgress?.(1);
  const blob = new Blob([target.buffer], { type: fmt.mime });
  blob.hasAudio = audioOk;
  return blob;
}

module.exports = {
  prepare,
  renderer,
  soundtrack,
  exportVideo,
  SpecError,
  effects: () => ({ ...describe(), sounds: sfx.SOUND_NAMES }),
  canEncode: () => typeof VideoEncoder !== 'undefined',
};
