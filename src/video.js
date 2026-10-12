'use strict';
// Video clips as layers or backgrounds. Each clip is decoded by its own ffmpeg
// process, already scaled and cropped to the size it is drawn at, and streamed
// as raw RGBA frames. Rendering moves forward in time, so the decoder usually
// just hands over the next frame; it is restarted only on a jump (a loop, or
// a preview that samples random times).

const { spawn, spawnSync } = require('child_process');
const { ffmpegPath } = require('./ffmpeg');

const probeCache = new Map();

// duration, size and whether the file has an audio track
function probe(src) {
  if (probeCache.has(src)) return probeCache.get(src);
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-i', src], { encoding: 'utf8' });
  const err = r.stderr || '';
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(err);
  const size = /Stream #[^\n]*Video:[^\n]*?(\d{2,5})x(\d{2,5})/.exec(err);
  if (!size) throw new Error(`Could not read video "${src}". Is it a video file ffmpeg can open?`);
  const info = {
    duration: dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : null,
    width: +size[1],
    height: +size[2],
    hasAudio: /Stream #[^\n]*Audio:/.test(err),
  };
  // rotated phone videos report the stored size; swap so the aspect is right
  if (/rotate\s*:\s*-?(90|270)/.test(err) || /displaymatrix: rotation of -?90/.test(err)) [info.width, info.height] = [info.height, info.width];
  probeCache.set(src, info);
  return info;
}

class VideoSource {
  constructor({ src, width, height, fit = 'cover', fps, rate = 1 }) {
    this.src = src;
    this.w = Math.max(2, Math.round(width));
    this.h = Math.max(2, Math.round(height));
    this.fit = fit;
    this.decFps = fps / rate;
    this.frameBytes = this.w * this.h * 4;
    this.proc = null;
    this.idx = -1;
    this.frame = null;
  }

  filter() {
    const { w, h } = this;
    if (this.fit === 'contain') return `fps=${this.decFps},scale=${w}:${h}:force_original_aspect_ratio=decrease,format=rgba,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;
    return `fps=${this.decFps},scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},format=rgba`;
  }

  start(k) {
    this.stop();
    const seek = Math.max(0, k / this.decFps);
    const p = spawn(ffmpegPath(), ['-v', 'error', '-ss', seek.toFixed(4), '-i', this.src, '-an', '-sn', '-vf', this.filter(), '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { stdio: ['ignore', 'pipe', 'ignore'] });
    this.proc = p;
    this.chunks = [];
    this.have = 0;
    this.ended = false;
    this.waiter = null;
    p.stdout.on('data', (c) => {
      this.chunks.push(c);
      this.have += c.length;
      // don't let the decoder run far ahead of the renderer
      if (this.have > this.frameBytes * 4) p.stdout.pause();
      this.wake();
    });
    p.stdout.on('end', () => { this.ended = true; this.wake(); });
    p.on('error', () => { this.ended = true; this.wake(); });
    this.idx = k - 1;
  }

  wake() { if (this.waiter) { const w = this.waiter; this.waiter = null; w(); } }

  async readFrame() {
    while (this.have < this.frameBytes && !this.ended) {
      if (this.proc.stdout.isPaused()) this.proc.stdout.resume();
      await new Promise((r) => (this.waiter = r));
    }
    if (this.have < this.frameBytes) return null;
    const out = Buffer.allocUnsafe(this.frameBytes);
    let off = 0;
    while (off < this.frameBytes) {
      const c = this.chunks[0];
      const take = Math.min(c.length, this.frameBytes - off);
      c.copy(out, off, 0, take);
      off += take;
      if (take === c.length) this.chunks.shift(); else this.chunks[0] = c.subarray(take);
    }
    this.have -= this.frameBytes;
    if (this.have < this.frameBytes * 2 && this.proc.stdout.isPaused()) this.proc.stdout.resume();
    return out;
  }

  // RGBA frame for a time inside the clip (seconds)
  async frameAt(clipTime) {
    const k = Math.max(0, Math.round(clipTime * this.decFps));
    if (this.frame && k === this.idx) return this.frame;
    if (!this.proc || k < this.idx || k > this.idx + this.decFps * 2) this.start(k);
    while (this.idx < k) {
      const f = await this.readFrame();
      if (!f) break; // end of clip: keep showing the last frame
      this.frame = f;
      this.idx++;
    }
    if (!this.frame) throw new Error(`Could not decode video "${this.src}" at ${clipTime.toFixed(2)}s`);
    return this.frame;
  }

  stop() {
    if (this.proc) { try { this.proc.kill('SIGKILL'); } catch { /* already gone */ } }
    this.proc = null;
  }
}

// clip time for a layer/background that has been on screen for `lt` seconds
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

module.exports = { probe, VideoSource, clipTimeFor };
