'use strict';
// The cinematic layer of Lampo: a virtual camera with parallax, particles and a film look.
// Everything is a pure function of time (no simulation state), so any frame renders the same
// in any worker, in any order.

const { getEasing, clamp01 } = require('./easing');

// deterministic pseudo-random in [0, 1)
function hash(n) { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
const rnd = (seed, i, k) => hash(seed * 1000.17 + i * 7.31 + k * 131.7);

// ---------- camera ----------
// A scene's "camera" moves every layer; each layer's "depth" scales the move (parallax):
// 0 = fixed, 0.3 = far background, 1 = default, 1.5 = foreground that rushes past.

const MOVES = {
  pushIn: { amount: 0.12, easing: 'inOut' },
  pullOut: { amount: 0.12, easing: 'inOut' },
  panLeft: { amount: 0.1, easing: 'inOut' },
  panRight: { amount: 0.1, easing: 'inOut' },
  tiltUp: { amount: 0.08, easing: 'inOut' },
  tiltDown: { amount: 0.08, easing: 'inOut' },
  orbit: { amount: 3, easing: 'inOut' },
  drift: { amount: 1, easing: 'linear' },
  handheld: { amount: 1, easing: 'linear' },
  crashZoom: { amount: 0.35, easing: 'expoOut', duration: 0.35 },
  shake: { amount: 1, easing: 'linear', duration: 0.6 },
  dutch: { amount: 4, easing: 'inOut' },
};
const CAMERA_MOVES = Object.keys(MOVES);

function cameraMoves(cam) {
  if (!cam) return [];
  const list = Array.isArray(cam) ? cam : [cam];
  return list.map((m) => (typeof m === 'string' ? { move: m } : m)).filter((m) => m && MOVES[m.move]);
}

// camera state at scene time st: { dx, dy, scale, rotate } in design pixels / degrees
function cameraAt(cam, st, sceneDur, W, H) {
  const moves = cameraMoves(cam);
  if (!moves.length) return null;
  const c = { dx: 0, dy: 0, scale: 1, rotate: 0 };
  for (const m of moves) {
    const def = MOVES[m.move];
    const a = m.amount ?? def.amount;
    const start = m.start ?? 0;
    const dur = Math.max(0.05, m.duration ?? def.duration ?? sceneDur - start);
    const lt = st - start;
    const p = getEasing(m.easing || def.easing)(lt / dur);
    switch (m.move) {
      case 'pushIn': c.scale += a * p; break;
      case 'pullOut': c.scale += a * (1 - p); break;
      case 'panLeft': c.dx += W * a * (0.5 - p); break;
      case 'panRight': c.dx += W * a * (p - 0.5); break;
      case 'tiltUp': c.dy += H * a * (0.5 - p); break;
      case 'tiltDown': c.dy += H * a * (p - 0.5); break;
      case 'orbit': c.rotate += a * (p * 2 - 1); c.scale += 0.05; c.dx += W * 0.025 * Math.sin(p * Math.PI * 2); break;
      case 'dutch': c.rotate += a * p; c.scale += 0.03 + 0.02 * p; break;
      case 'drift': c.dx += W * 0.012 * a * Math.sin(st * 0.45 + 1); c.dy += H * 0.008 * a * Math.cos(st * 0.37); c.scale += 0.02 * a; break;
      case 'handheld': {
        // a few incommensurate sines: smooth, never repeating, deterministic
        const n = (k) => Math.sin(st * (1.3 + k * 0.71) + k * 4.1) * 0.6 + Math.sin(st * (2.9 + k * 1.37) + k) * 0.4;
        c.dx += W * 0.005 * a * n(1); c.dy += H * 0.004 * a * n(2); c.rotate += 0.35 * a * n(3); c.scale += 0.015 * a;
        break;
      }
      case 'crashZoom': if (lt >= 0) c.scale += a * p; break;
      case 'shake': if (lt >= 0 && lt <= dur) { const k = Math.exp(-lt * 7) * a; c.dx += 18 * k * Math.sin(lt * 71); c.dy += 14 * k * Math.cos(lt * 53); c.rotate += 0.8 * k * Math.sin(lt * 37); } break;
      default:
    }
  }
  return c;
}

// apply the camera to ctx for one layer depth; cover: true scales a background so no edge shows
function applyCamera(ctx, c, depth, W, H, cover) {
  if (!c) return;
  const d = depth ?? 1;
  let sc = 1 + (c.scale - 1) * d;
  const dx = c.dx * d, dy = c.dy * d, rot = c.rotate * d;
  if (cover) {
    const k = 1 + 2 * Math.max(Math.abs(dx) / W, Math.abs(dy) / H) + Math.abs(Math.sin((rot * Math.PI) / 180)) * (Math.max(W, H) / Math.min(W, H));
    sc = Math.max(sc, 1) * k;
  }
  ctx.translate(W / 2 + dx, H / 2 + dy);
  if (rot) ctx.rotate((rot * Math.PI) / 180);
  if (sc !== 1) ctx.scale(sc, sc);
  ctx.translate(-W / 2, -H / 2);
}

// ---------- particles ----------

const PARTICLES = {
  sparks: { count: 45, colors: ['#FFE7A3', '#FFC24D', '#FF8A3D'], size: [2, 6], blend: 'lighter' },
  embers: { count: 40, colors: ['#FF9A3D', '#FF5A1F', '#FFD27A'], size: [2, 5], blend: 'lighter' },
  confetti: { count: 70, colors: ['#FF375F', '#FFD60A', '#30D158', '#0A84FF', '#BF5AF2', '#ffffff'], size: [10, 20] },
  snow: { count: 90, colors: ['#ffffff'], size: [3, 9] },
  dust: { count: 80, colors: ['#ffffff'], size: [1.5, 3.5] },
  bokeh: { count: 22, colors: ['#FFD27A', '#ffffff', '#7AB8FF'], size: [30, 110], blend: 'lighter' },
  stars: { count: 120, colors: ['#ffffff', '#CFE3FF'], size: [1.2, 3.2] },
  bubbles: { count: 30, colors: ['#ffffff'], size: [8, 26] },
  burst: { count: 90, colors: ['#FF375F', '#FFD60A', '#30D158', '#0A84FF', '#BF5AF2', '#ffffff'], size: [9, 18] },
  sparkBurst: { count: 36, colors: ['#FFE7A3', '#ffffff', '#FFC24D'], size: [3, 6], blend: 'lighter' },
};
const PARTICLE_PRESETS = Object.keys(PARTICLES);

// draws particles in a box w×h centred on the current origin, at layer time lt
function drawParticles(ctx, L, lt, theme) {
  const def = PARTICLES[L.preset] || PARTICLES.dust;
  const w = L.w ?? 1080, h = L.h ?? 1920;
  const count = Math.min(400, Math.max(1, Math.round(L.count ?? def.count)));
  const colors = L.colors || (L.color ? [L.color] : def.colors.map((c) => (c === 'accent' ? theme.accent : c)));
  const [smin, smax] = L.size ? [L.size * 0.6, L.size * 1.4] : def.size;
  const speed = L.speed ?? 1;
  const seed = L.seed ?? 7;
  const x0 = -w / 2, y0 = -h / 2;
  const wrap = (v, size, m) => ((((v + m) % (size + 2 * m)) + size + 2 * m) % (size + 2 * m)) - m;
  ctx.save();
  if (def.blend) ctx.globalCompositeOperation = def.blend;
  const baseAlpha = ctx.globalAlpha;
  for (let i = 0; i < count; i++) {
    const r = (k) => rnd(seed, i, k);
    const size = smin + (smax - smin) * r(1);
    const color = colors[Math.floor(r(2) * colors.length) % colors.length];
    let x, y, a = 1, rot = 0, shape = 'dot';
    const t = lt * speed;
    switch (L.preset) {
      case 'sparks': case 'embers': {
        const vy = -(60 + 140 * r(3)) * (L.preset === 'embers' ? 0.6 : 1);
        x = x0 + wrap(r(4) * w + Math.sin(t * (1 + r(5) * 2) + i) * (L.preset === 'embers' ? 30 : 12), w, 20);
        y = y0 + wrap(r(6) * h + vy * t, h, 20);
        a = 0.45 + 0.55 * Math.abs(Math.sin(t * (4 + r(7) * 8) + i));
        shape = 'glow';
        break;
      }
      case 'confetti': {
        const vy = 110 + 160 * r(3);
        x = x0 + wrap(r(4) * w + Math.sin(t * (1.2 + r(5) * 2) + i) * 40, w, 30);
        y = y0 + wrap(r(6) * h + vy * t, h, 30);
        rot = t * (2 + r(7) * 6) + i; shape = 'rect';
        break;
      }
      case 'snow': {
        x = x0 + wrap(r(4) * w + Math.sin(t * (0.6 + r(5)) + i) * 30, w, 20);
        y = y0 + wrap(r(6) * h + (40 + 70 * r(3)) * t, h, 20);
        a = 0.5 + 0.5 * r(8);
        break;
      }
      case 'dust': {
        const ang = r(3) * Math.PI * 2;
        x = x0 + wrap(r(4) * w + Math.cos(ang) * 14 * t, w, 10);
        y = y0 + wrap(r(6) * h + Math.sin(ang) * 10 * t - 6 * t, h, 10);
        a = 0.25 + 0.5 * Math.abs(Math.sin(t * (0.5 + r(7)) + i));
        break;
      }
      case 'bokeh': {
        x = x0 + wrap(r(4) * w + Math.sin(t * 0.2 + i) * 40 + 12 * t * (r(3) - 0.5), w, smax);
        y = y0 + wrap(r(6) * h + Math.cos(t * 0.17 + i) * 30, h, smax);
        a = 0.08 + 0.2 * r(8) * (0.7 + 0.3 * Math.sin(t * 0.8 + i));
        shape = 'soft';
        break;
      }
      case 'stars': {
        x = x0 + r(4) * w; y = y0 + r(6) * h;
        a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * (1 + r(7) * 3) + i * 3));
        break;
      }
      case 'bubbles': {
        x = x0 + wrap(r(4) * w + Math.sin(t * (1 + r(5)) + i) * 20, w, 30);
        y = y0 + wrap(r(6) * h - (50 + 80 * r(3)) * t, h, 30);
        a = 0.35 + 0.35 * r(8); shape = 'ring';
        break;
      }
      case 'burst': case 'sparkBurst': {
        // an explosion from the centre at the layer start, falling with gravity, fading out
        const ang = r(3) * Math.PI * 2;
        const v = (L.preset === 'burst' ? 500 : 700) + 700 * r(4);
        const life = L.preset === 'burst' ? 2.2 : 0.9;
        if (t > life) continue;
        const drag = Math.exp(-t * 1.8);
        const dist = (v * (1 - drag)) / 1.8;
        x = Math.cos(ang) * dist; y = Math.sin(ang) * dist + (L.preset === 'burst' ? 420 * t * t : 0);
        a = 1 - clamp01((t - life * 0.55) / (life * 0.45));
        rot = t * (4 + r(7) * 8) + i;
        shape = L.preset === 'burst' ? 'rect' : 'streak';
        if (shape === 'streak') { const sp = v * drag; ctx.save(); ctx.globalAlpha = baseAlpha * a; ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * sp * 0.05, y - Math.sin(ang) * sp * 0.05); ctx.stroke(); ctx.restore(); continue; }
        break;
      }
      default: x = x0 + r(4) * w; y = y0 + r(6) * h;
    }
    ctx.globalAlpha = baseAlpha * clamp01(a);
    if (shape === 'rect') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(rot * 1.3)));
      ctx.fillStyle = color; ctx.fillRect(-size / 2, -size * 0.3, size, size * 0.6); ctx.restore();
    } else if (shape === 'glow' || shape === 'soft') {
      const R = shape === 'glow' ? size * 2.2 : size;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, color); g.addColorStop(shape === 'glow' ? 0.25 : 0.55, color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    } else if (shape === 'ring') {
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, size * 0.12); ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------- film look: grain, light leaks, letterbox ----------

let grainTiles = null;
function makeGrain(createCanvas) {
  const tiles = [];
  for (let k = 0; k < 4; k++) {
    const N = 160, c = createCanvas(N, N), x = c.getContext('2d');
    const img = x.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
      const v = Math.round(128 + (hash(i * 3.17 + k * 9173.1) - 0.5) * 255 * 0.9);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
}

// draws the look over the finished frame, in output pixels
function drawLook(ctx, look, t, W, H, scaleOut, createCanvas) {
  if (!look) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (look.lightLeak) {
    const o = typeof look.lightLeak === 'object' ? look.lightLeak : {};
    const colors = o.colors || ['#FF7A18', '#FF2D55', '#FFD27A'];
    const speed = o.speed ?? 0.35;
    ctx.globalCompositeOperation = 'screen';
    colors.forEach((c, i) => {
      const ph = i * 2.4;
      const x = W * (i % 2 ? 1.05 : -0.05) + W * 0.18 * Math.sin(t * speed + ph);
      const y = H * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * speed * 0.7 + ph * 1.7)));
      const R = Math.max(W, H) * (0.45 + 0.1 * Math.sin(t * speed * 1.3 + ph));
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = (o.intensity ?? 0.32) * (0.75 + 0.25 * Math.sin(t * 2.3 + ph));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    ctx.globalCompositeOperation = 'source-over';
  }
  if (look.grain) {
    if (!grainTiles) grainTiles = makeGrain(createCanvas);
    const amount = look.grain === true ? 0.06 : Number(look.grain);
    const frame = Math.floor(t * 24);
    const tile = grainTiles[frame % 4];
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = clamp01(amount * 3);
    ctx.translate(-Math.floor(hash(frame) * 160), -Math.floor(hash(frame + 0.5) * 160));
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W + 160, H + 160);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (look.letterbox) {
    // true: cinemascope 2.39:1 on landscape, slim bars on portrait/square
    const frac = look.letterbox === true ? (W > H ? Math.max(0, (1 - W / 2.39 / H) / 2) : 0.06) : Number(look.letterbox);
    const bar = Math.round(H * clamp01(frac));
    ctx.globalAlpha = 1;
    ctx.fillStyle = look.letterboxColor || '#000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
  }
  ctx.restore();
}

module.exports = { cameraAt, applyCamera, cameraMoves, CAMERA_MOVES, drawParticles, PARTICLE_PRESETS, drawLook };
