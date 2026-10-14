'use strict';
// Browser stand-in for src/video.js: clips are decoded by a <video> element and seeked per frame.
// probe() must be synchronous for the engine, so web/entry.js preloads every clip first (preloadVideos).
const cache = new Map();

function loadVideo(src) {
  if (cache.has(src)) return cache.get(src).ready;
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  if (/^https?:/.test(src)) el.crossOrigin = 'anonymous';
  const entry = { el, info: null };
  entry.ready = new Promise((resolve, reject) => {
    el.onloadeddata = () => {
      entry.info = { duration: Number.isFinite(el.duration) ? el.duration : null, width: el.videoWidth, height: el.videoHeight, hasAudio: false };
      resolve(entry.info);
    };
    // a browser without H.264 (e.g. open-source Chromium) gets the .webm next to the .mp4, if there is one
    let triedWebm = false;
    el.onerror = () => {
      if (!triedWebm && /\.mp4(\?|$)/i.test(src)) { triedWebm = true; el.src = src.replace(/\.mp4(\?|$)/i, '.webm$1'); return; }
      reject(new Error(`Could not load video "${src}" in the browser (CORS or format?)`));
    };
  });
  el.src = src;
  cache.set(src, entry);
  return entry.ready;
}

function probe(src) {
  const e = cache.get(src);
  if (!e || !e.info) throw new Error(`Video "${src}" is not loaded yet`);
  return e.info;
}

class VideoSource {
  constructor({ src, width, height, fit = 'cover' }) {
    this.el = cache.get(src).el;
    this.w = Math.max(2, Math.round(width));
    this.h = Math.max(2, Math.round(height));
    this.fit = fit;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.last = -1;
    this.frame = null;
  }

  async frameAt(t) {
    const el = this.el;
    const target = Math.max(0, Math.min(t, (el.duration || t + 1) - 0.001));
    if (this.frame && Math.abs(target - this.last) < 1e-3) return this.frame;
    if (Math.abs(el.currentTime - target) > 1e-3) {
      await new Promise((resolve) => {
        const done = () => { el.removeEventListener('seeked', done); resolve(); };
        el.addEventListener('seeked', done);
        el.currentTime = target;
      });
    }
    const iw = el.videoWidth, ih = el.videoHeight;
    const r = this.fit === 'contain' ? Math.min(this.w / iw, this.h / ih) : Math.max(this.w / iw, this.h / ih);
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.ctx.drawImage(el, (this.w - iw * r) / 2, (this.h - ih * r) / 2, iw * r, ih * r);
    this.frame = this.ctx.getImageData(0, 0, this.w, this.h).data;
    this.last = target;
    return this.frame;
  }

  stop() {}
}

function clipTimeFor(opts, info, lt) {
  const rate = opts.rate ?? 1;
  const trim = opts.trim ?? 0;
  const t = Math.max(0, lt) * rate;
  const usable = info.duration != null ? Math.max(0.05, info.duration - trim) : null;
  if (usable == null) return trim + t;
  const repeat = opts.clipLoop ?? (typeof opts.loop === 'boolean' ? opts.loop : true);
  if (repeat) return trim + (t % usable);
  return trim + Math.min(t, usable - 0.04);
}

module.exports = { probe, VideoSource, clipTimeFor, loadVideo };
