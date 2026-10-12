'use strict';
// Draws a single frame with Skia (via @napi-rs/canvas). No browser, no DOM:
// every frame is a pure function of time, so rendering is deterministic
// and can run in parallel across processes.

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { enter, loop, splitTiming } = require('./effects');
const { getEasing, easings, clamp01, lerp } = require('./easing');

// ---------- utilities ----------

function makeFill(ctx, fill, x, y, w, h, fallback) {
  if (fill == null) return fallback;
  if (typeof fill === 'string') return fill;
  const colors = Array.isArray(fill) ? fill : fill.colors;
  if (!colors || colors.length === 0) return fallback;
  if (colors.length === 1) return colors[0];
  const angle = ((Array.isArray(fill) ? 135 : fill.angle ?? 135) * Math.PI) / 180;
  const cx = x + w / 2, cy = y + h / 2;
  const r = (Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))) / 2;
  const g = ctx.createLinearGradient(cx - Math.cos(angle) * r, cy - Math.sin(angle) * r, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  return g;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function resolvePos(v, size, fallback) {
  if (v == null) return fallback;
  if (typeof v === 'number') return v;
  const k = String(v).trim();
  if (k === 'center') return size / 2;
  if (k === 'left' || k === 'top') return size * 0.08;
  if (k === 'right' || k === 'bottom') return size * 0.92;
  if (k.endsWith('%')) return (parseFloat(k) / 100) * size;
  const n = parseFloat(k);
  return Number.isFinite(n) ? n : fallback;
}

const ANCHORS = {
  center: [0.5, 0.5], top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5],
  'top-left': [0, 0], 'top-right': [1, 0], 'bottom-left': [0, 1], 'bottom-right': [1, 1],
};

function fontString(L, theme) {
  const family = L.font || theme.font || 'Inter';
  return `${L.italic ? 'italic ' : ''}${L.weight ?? 700} ${L.size ?? 72}px "${family}"`;
}

// text with **highlighted words** in the accent color
function parseRuns(text) {
  const words = [];
  let accent = false;
  for (const raw of String(text).split(/(\*\*)/)) {
    if (raw === '**') { accent = !accent; continue; }
    for (const w of raw.split(/(\s+)/)) {
      if (w === '' ) continue;
      words.push({ text: w, accent, space: /^\s+$/.test(w) });
    }
  }
  return words;
}

// ---------- text layout (cached: the same text is measured once) ----------

const layoutCache = new Map();

// Lays out text; if a single word is wider than maxWidth (it can't wrap),
// the font is scaled down so nothing gets cut off at the frame edge.
function layoutText(ctx, L, theme, spec) {
  const key = JSON.stringify([L.text, L.size, L.weight, L.font, L.maxWidth, L.lineHeight, L.letterSpacing, L.align, L.italic, L.fit, theme.font]);
  if (layoutCache.has(key)) return layoutCache.get(key);
  let res = layoutOnce(ctx, L, theme, spec);
  const maxW = L.maxWidth ?? spec.width * 0.86;
  if (L.fit !== false && res.w > maxW + 1) {
    const size = (L.size ?? 72) * (maxW / res.w);
    res = layoutOnce(ctx, { ...L, size, letterSpacing: L.letterSpacing != null ? L.letterSpacing * (size / (L.size ?? 72)) : undefined }, theme, spec);
    res.fitSize = size;
  }
  layoutCache.set(key, res);
  return res;
}

function layoutOnce(ctx, L, theme, spec) {
  ctx.save();
  ctx.font = fontString(L, theme);
  ctx.letterSpacing = `${L.letterSpacing ?? 0}px`;
  const maxW = L.maxWidth ?? spec.width * 0.86;
  const size = L.size ?? 72;
  const lh = (L.lineHeight ?? 1.12) * size;
  const lines = [];
  for (const para of String(L.text).split('\n')) {
    const tokens = parseRuns(para);
    let cur = [];
    const width = (toks) => ctx.measureText(toks.map((t) => t.text).join('')).width;
    for (const tok of tokens) {
      if (tok.space && cur.length === 0) continue;
      const next = [...cur, tok];
      if (L.wrap !== false && !tok.space && cur.length && width(next) > maxW) {
        while (cur.length && cur[cur.length - 1].space) cur.pop();
        lines.push(cur);
        cur = [tok];
      } else cur = next;
    }
    while (cur.length && cur[cur.length - 1].space) cur.pop();
    lines.push(cur);
  }
  const out = lines.map((toks) => {
    let x = 0;
    const words = [];
    for (const t of toks) {
      const w = ctx.measureText(t.text).width;
      if (!t.space) {
        const chars = [];
        let cx = 0;
        for (const ch of Array.from(t.text)) {
          const cw = ctx.measureText(ch).width;
          chars.push({ text: ch, x: cx, w: cw });
          cx = ctx.measureText(Array.from(t.text).slice(0, chars.length).join('')).width;
        }
        words.push({ text: t.text, accent: t.accent, x, w, chars });
      }
      x += w;
    }
    return { words, w: x };
  });
  const boxW = Math.max(1, ...out.map((l) => l.w));
  const res = { lines: out, w: boxW, h: lh * out.length, lh, size };
  ctx.restore();
  return res;
}

// ---------- animated layer state ----------

function baseState(L) {
  return { opacity: L.opacity ?? 1, dx: 0, dy: 0, scale: L.scale ?? 1, scaleX: 1, scaleY: 1, rotate: L.rotate ?? 0, blur: 0, clip: null, origin: null };
}

function layerWindow(L, sceneDur) {
  const start = L.start ?? 0;
  const end = L.end != null ? L.end : L.duration != null ? start + L.duration : sceneDur;
  return { start, end, dur: end - start };
}

function computeState(L, lt, win) {
  const s = baseState(L);
  const split = { in: null, out: null };
  if (L.in) {
    const fx = enter[L.in.effect];
    if (fx.split) split.in = { fx, opts: L.in, t: lt - (L.in.delay ?? 0) };
    else {
      const d = L.in.duration ?? fx.duration;
      const p = getEasing(L.in.easing || fx.easing || 'apple')((lt - (L.in.delay ?? 0)) / d);
      fx.apply(s, p, null);
    }
  }
  if (L.out) {
    const fx = enter[L.out.effect];
    const d = L.out.duration ?? fx.duration;
    const outStart = win.dur - d;
    if (fx.split) split.out = { fx, opts: L.out, t: lt - outStart };
    else if (lt >= outStart) {
      const p = 1 - getEasing(L.out.easing || 'in')((lt - outStart) / d);
      fx.apply(s, p, null);
    }
  }
  for (const lp of L.loop || []) loop[lp.effect](s, lt - (lp.delay ?? 0), lp, win);
  return { s, split };
}

function applyTransform(ctx, s, box, scaleOut) {
  ctx.translate(s.dx, s.dy);
  // pivot: box center, or left / bottom edge for grow effects
  let px = box.x + box.w / 2, py = box.y + box.h / 2;
  if (s.origin === 'left') px = box.x;
  if (s.origin === 'bottom') py = box.y + box.h;
  ctx.translate(px, py);
  if (s.rotate) ctx.rotate((s.rotate * Math.PI) / 180);
  const sx = s.scale * s.scaleX, sy = s.scale * s.scaleY;
  if (sx !== 1 || sy !== 1) ctx.scale(Math.max(1e-4, sx), Math.max(1e-4, sy));
  ctx.translate(-px, -py);
  ctx.globalAlpha *= clamp01(s.opacity);
  if (s.blur > 0.3) ctx.filter = `blur(${(s.blur * scaleOut).toFixed(2)}px)`;
  if (s.clip) {
    const c = s.clip;
    const pad = 4;
    ctx.beginPath();
    ctx.rect(box.x + box.w * c.x0 - pad, box.y + box.h * c.y0 - pad, box.w * (c.x1 - c.x0) + pad * 2, box.h * (c.y1 - c.y0) + pad * 2);
    ctx.clip();
  }
}

function visible(s) {
  return s.opacity > 0.002 && s.scale * s.scaleX > 1e-3 && s.scale * s.scaleY > 1e-3;
}

// ---------- layer drawing ----------

function setShadow(ctx, L, scaleOut) {
  const sh = L.glow ? { color: L.glow === true ? 'rgba(255,255,255,0.55)' : L.glow, blur: 40 } : L.shadow === true ? { color: 'rgba(0,0,0,0.45)', blur: 30, y: 12 } : L.shadow;
  if (!sh) return;
  ctx.shadowColor = sh.color || 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = (sh.blur ?? 24) * scaleOut;
  ctx.shadowOffsetX = (sh.x ?? 0) * scaleOut;
  ctx.shadowOffsetY = (sh.y ?? 0) * scaleOut;
}

function formatNumber(v, L, theme) {
  const dec = L.decimals ?? 0;
  // locale-aware grouping: "en-US" → 1,240.5 · "it-IT" → 1.240,5 · "de-DE" → 1.240,5
  const locale = L.locale || theme.locale || 'en-US';
  let txt;
  try { txt = new Intl.NumberFormat(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: L.grouping !== false }).format(v); }
  catch { txt = v.toFixed(dec); }
  return (L.prefix ?? '') + txt + (L.suffix ?? '');
}

function drawText(ctx, L, theme, spec, s, split, scaleOut, lt) {
  const lay = layoutText(ctx, L, theme, spec);
  const [ax, ay] = ANCHORS[L.anchor || 'center'] || ANCHORS.center;
  const box = { x: -lay.w * ax, y: -lay.h * ay, w: lay.w, h: lay.h };
  const align = L.align || 'center';

  ctx.save();
  applyTransform(ctx, s, box, scaleOut);

  if (L.bg) {
    const bg = typeof L.bg === 'string' ? { color: L.bg } : L.bg;
    const pad = bg.padding ?? Math.round(lay.size * 0.35);
    ctx.save();
    ctx.fillStyle = makeFill(ctx, bg.color, box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2, 'rgba(0,0,0,0.6)');
    roundRect(ctx, box.x - pad, box.y - pad * 0.8, box.w + pad * 2, box.h + pad * 1.6, bg.radius ?? pad);
    ctx.fill();
    ctx.restore();
  }

  const drawL = lay.fitSize ? { ...L, size: lay.fitSize, letterSpacing: L.letterSpacing != null ? L.letterSpacing * (lay.fitSize / (L.size ?? 72)) : undefined } : L;
  ctx.font = fontString(drawL, theme);
  ctx.letterSpacing = `${drawL.letterSpacing ?? 0}px`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const fill = makeFill(ctx, L.color, box.x, box.y, box.w, box.h, theme.color);
  const accentFill = makeFill(ctx, L.accent ?? theme.accent, box.x, box.y, box.w, box.h, theme.accent);
  if (L.stroke) { ctx.strokeStyle = L.stroke.color || '#000'; ctx.lineWidth = L.stroke.width ?? 4; ctx.lineJoin = 'round'; }
  setShadow(ctx, L, scaleOut);

  // animatable units in reading order
  const anySplit = split.in || split.out;
  const mode = (split.in || split.out)?.fx.split || 'none';
  const units = [];
  lay.lines.forEach((line, li) => {
    const lx = box.x + (align === 'left' ? 0 : align === 'right' ? lay.w - line.w : (lay.w - line.w) / 2);
    const cy = box.y + lay.lh * (li + 0.5);
    if (mode === 'line') units.push({ words: line.words.map((w) => ({ ...w, ax: lx + w.x })), x: lx, y: cy - lay.lh / 2, w: line.w, h: lay.lh, cy });
    else for (const w of line.words) {
      if (mode === 'char') for (const c of w.chars) units.push({ char: c.text, accent: w.accent, x: lx + w.x + c.x, y: cy - lay.lh / 2, w: c.w, h: lay.lh, cy });
      else units.push({ words: [{ ...w, ax: lx + w.x }], x: lx + w.x, y: cy - lay.lh / 2, w: w.w, h: lay.lh, cy });
    }
  });

  const timing = {};
  for (const ph of ['in', 'out']) if (split[ph]) timing[ph] = splitTiming(split[ph].fx, split[ph].opts, units.length);

  const baseAlpha = ctx.globalAlpha;
  units.forEach((u, i) => {
    const us = { opacity: 1, dx: 0, dy: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0, blur: 0 };
    if (split.in) {
      const tm = timing.in;
      const p = getEasing(split.in.opts.easing || split.in.fx.easing || 'apple')((split.in.t - i * tm.stagger) / tm.unitDur);
      split.in.fx.apply(us, p, u);
    }
    if (split.out) {
      const tm = timing.out;
      // on exit, units leave in the same order
      const q = (split.out.t - i * tm.stagger) / tm.unitDur;
      if (q > 0) split.out.fx.apply(us, 1 - getEasing(split.out.opts.easing || 'in')(q), u);
    }
    if (us.opacity <= 0.002 || us.scale <= 1e-3) return;
    ctx.save();
    if (anySplit && (split.in?.fx.mask || split.out?.fx.mask)) {
      ctx.beginPath();
      ctx.rect(u.x - lay.size, u.y - lay.lh * 0.08, u.w + lay.size * 2, u.h * 1.12);
      ctx.clip();
    }
    if (us.dx || us.dy || us.scale !== 1 || us.rotate) {
      ctx.translate(u.x + u.w / 2 + us.dx, u.cy + us.dy);
      if (us.rotate) ctx.rotate((us.rotate * Math.PI) / 180);
      if (us.scale !== 1) ctx.scale(us.scale, us.scale);
      ctx.translate(-(u.x + u.w / 2), -u.cy);
    }
    ctx.globalAlpha = baseAlpha * clamp01(us.opacity);
    if (us.blur > 0.3) ctx.filter = `blur(${(us.blur * scaleOut).toFixed(2)}px)`;
    const paint = (txt, x, accent) => {
      if (L.stroke) ctx.strokeText(txt, x, u.cy);
      ctx.fillStyle = accent ? accentFill : fill;
      ctx.fillText(txt, x, u.cy);
    };
    if (u.char != null) paint(u.char, u.x, u.accent);
    else for (const w of u.words) paint(w.text, w.ax, w.accent);
    ctx.restore();
  });

  // blinking caret for typewriter
  if (split.in?.fx.typewriter && L.caret !== false) {
    const tm = timing.in;
    const shown = Math.min(units.length, Math.max(0, Math.floor(split.in.t / tm.stagger) + 1));
    const last = units[Math.max(0, shown - 1)];
    if (last && Math.floor(lt * 2) % 2 === 0) {
      ctx.fillStyle = L.caretColor || theme.accent;
      ctx.fillRect(last.x + (shown ? last.w : 0) + 4, last.cy - lay.size * 0.42, Math.max(3, lay.size * 0.06), lay.size * 0.84);
    }
  }
  ctx.restore();
}

function shapeBox(L) {
  const w = L.type === 'circle' ? (L.r ?? 100) * 2 : L.w ?? 400;
  const h = L.type === 'circle' ? (L.r ?? 100) * 2 : L.h ?? (L.type === 'line' ? 8 : 400);
  const [ax, ay] = ANCHORS[L.anchor || 'center'] || ANCHORS.center;
  return { x: -w * ax, y: -h * ay, w, h };
}

function drawShape(ctx, L, theme, s, scaleOut) {
  const box = shapeBox(L);
  ctx.save();
  applyTransform(ctx, s, box, scaleOut);
  setShadow(ctx, L, scaleOut);
  ctx.fillStyle = makeFill(ctx, L.color ?? L.fill, box.x, box.y, box.w, box.h, L.type === 'line' ? theme.accent : theme.color);
  if (L.type === 'circle') { ctx.beginPath(); ctx.arc(0 + box.x + box.w / 2, box.y + box.h / 2, box.w / 2, 0, Math.PI * 2); }
  else roundRect(ctx, box.x, box.y, box.w, box.h, L.type === 'line' ? box.h / 2 : L.radius ?? 0);
  if (L.color !== 'none' && L.fill !== 'none') ctx.fill();
  if (L.stroke) {
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = makeFill(ctx, L.stroke.color, box.x, box.y, box.w, box.h, theme.color);
    ctx.lineWidth = L.stroke.width ?? 4;
    ctx.stroke();
  }
  ctx.restore();
}

function drawImage(ctx, L, s, assets, scaleOut) {
  const img = assets.get(L.src);
  if (!img) return;
  const iw = img.width, ih = img.height;
  let w = L.w, h = L.h;
  if (!w && !h) { w = iw; h = ih; }
  else if (!w) w = (h * iw) / ih;
  else if (!h) h = (w * ih) / iw;
  const [ax, ay] = ANCHORS[L.anchor || 'center'] || ANCHORS.center;
  const box = { x: -w * ax, y: -h * ay, w, h };
  ctx.save();
  applyTransform(ctx, s, box, scaleOut);
  if (L.shadow || L.glow) {
    // the shadow is drawn under the shape, before clipping
    ctx.save(); setShadow(ctx, L, scaleOut); ctx.fillStyle = '#000';
    roundRect(ctx, box.x, box.y, box.w, box.h, L.radius ?? 0); ctx.fill(); ctx.restore();
  }
  roundRect(ctx, box.x, box.y, box.w, box.h, L.radius ?? 0);
  ctx.clip();
  const fit = L.fit || 'cover';
  const r = fit === 'contain' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
  const dw = iw * r, dh = ih * r;
  ctx.drawImage(img, box.x + (w - dw) / 2, box.y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function drawLayer(ctx, L, lt, win, env) {
  if (lt < 0 || lt > win.dur + 1e-6) return;
  const { s, split } = computeState(L, lt, win);
  if (!visible(s)) return;
  ctx.save();
  ctx.translate(resolvePos(L.x, env.spec.width, env.spec.width / 2), resolvePos(L.y, env.spec.height, env.spec.height / 2));
  if (L.type === 'text') drawText(ctx, L, env.theme, env.spec, s, split, env.scaleOut, lt);
  else if (L.type === 'counter') {
    const d = L.countDuration ?? 1.6;
    const p = easings.expoOut((lt - (L.countDelay ?? L.in?.delay ?? 0)) / d);
    // size is fitted on the final value, so the number doesn't jitter while counting
    const fin = layoutText(ctx, { ...L, wrap: false, text: formatNumber(L.to, L, env.theme) }, env.theme, env.spec);
    drawText(ctx, { ...L, wrap: false, fit: false, size: fin.fitSize ?? L.size, text: formatNumber(lerp(L.from ?? 0, L.to, p), L, env.theme) }, env.theme, env.spec, s, split, env.scaleOut, lt);
  } else if (L.type === 'image') drawImage(ctx, L, s, env.assets, env.scaleOut);
  else drawShape(ctx, L, env.theme, s, env.scaleOut);
  ctx.restore();
}

// ---------- backgrounds ----------

function drawBackground(ctx, bg, st, spec, env) {
  const W = spec.width, H = spec.height;
  bg = bg ?? env.theme.background;
  if (typeof bg === 'string' || Array.isArray(bg)) bg = Array.isArray(bg) ? { type: 'gradient', colors: bg } : { type: 'color', color: bg };
  const type = bg.type || (bg.colors ? 'gradient' : bg.src ? 'image' : 'color');
  if (type === 'color') { ctx.fillStyle = bg.color || '#000'; ctx.fillRect(0, 0, W, H); return; }
  if (type === 'gradient') {
    const angle = (bg.angle ?? 160) + (bg.animate ? st * (typeof bg.animate === 'number' ? bg.animate : 20) : 0);
    ctx.fillStyle = makeFill(ctx, { colors: bg.colors, angle }, 0, 0, W, H, '#000');
    ctx.fillRect(0, 0, W, H);
    return;
  }
  if (type === 'glow') {
    // "Apple" background: dark base with soft, slowly drifting light blobs
    ctx.fillStyle = bg.base || '#05050a';
    ctx.fillRect(0, 0, W, H);
    const colors = bg.colors || ['#0A84FF', '#BF5AF2', '#FF375F'];
    const speed = bg.speed ?? 0.25;
    const R = Math.max(W, H) * (bg.size ?? 0.55);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    colors.forEach((c, i) => {
      const ph = i * 2.1;
      const x = W * (0.5 + 0.32 * Math.sin(st * speed + ph));
      const y = H * (0.5 + 0.3 * Math.cos(st * speed * 0.8 + ph * 1.3));
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = bg.intensity ?? 0.55;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
    ctx.restore();
    return;
  }
  if (type === 'image') {
    ctx.fillStyle = bg.base || '#000';
    ctx.fillRect(0, 0, W, H);
    const img = env.assets.get(bg.src);
    if (img) {
      const z = bg.kenburns === false ? 1 : 1 + 0.1 * clamp01(st / Math.max(0.1, env.sceneDur));
      const r = Math.max(W / img.width, H / img.height) * z;
      ctx.drawImage(img, (W - img.width * r) / 2, (H - img.height * r) / 2, img.width * r, img.height * r);
    }
    if (bg.overlay !== false) { ctx.fillStyle = bg.overlay || 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H); }
  }
}

// ---------- scenes and transitions ----------

function drawScene(ctx, S, t, env) {
  const st = t - S.start;
  env.sceneDur = S.duration;
  drawBackground(ctx, S.background, st, env.spec, env);
  for (const L of S.layers) drawLayer(ctx, L, st, layerWindow(L, S.duration), env);
  if (S.vignette !== false && (S.vignette || env.spec.vignette)) {
    const W = env.spec.width, H = env.spec.height;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

async function loadAssets(spec) {
  for (const f of spec.fonts || []) GlobalFonts.registerFromPath(f.path, f.family);
  const srcs = new Set();
  const walk = (L) => { if (L.type === 'image' && L.src) srcs.add(L.src); };
  for (const S of spec.scenes) {
    S.layers.forEach(walk);
    const bg = S.background;
    if (bg && typeof bg === 'object' && !Array.isArray(bg) && bg.src) srcs.add(bg.src);
  }
  spec.layers.forEach(walk);
  const assets = new Map();
  await Promise.all([...srcs].map(async (src) => {
    try { assets.set(src, await loadImage(src)); }
    catch (e) { throw new Error(`Could not load image "${src}": ${e.message}`); }
  }));
  return assets;
}

async function createRenderer(spec) {
  const assets = await loadAssets(spec);
  const W = spec.outWidth, H = spec.outHeight;
  const scaleOut = W / spec.width;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const offA = createCanvas(W, H), offB = createCanvas(W, H);
  const env = { spec, theme: spec.theme, assets, scaleOut };

  const renderSceneTo = (c, S, t) => {
    const x = c.getContext('2d');
    x.setTransform(scaleOut, 0, 0, scaleOut, 0, 0);
    x.globalAlpha = 1; x.filter = 'none';
    drawScene(x, S, t, env);
    return c;
  };

  function renderAt(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const last = spec.scenes[spec.scenes.length - 1];
    const active = spec.scenes.filter((S) => t >= S.start && (t < S.end || (S === last && t <= S.end + 1e-6)));
    if (active.length === 0 && t >= last.end) active.push(last);
    const B = active[active.length - 1];
    const A = active.length > 1 ? active[active.length - 2] : null;
    if (!A || !B.transition) {
      ctx.setTransform(scaleOut, 0, 0, scaleOut, 0, 0);
      drawScene(ctx, B, t, env);
    } else {
      const tr = B.transition;
      const q = easings.inOut((t - B.start) / tr.duration);
      const a = renderSceneTo(offA, A, t), b = renderSceneTo(offB, B, t);
      const put = (img, alpha, dx = 0, dy = 0, sc = 1, blur = 0) => {
        ctx.save();
        ctx.globalAlpha = clamp01(alpha);
        if (blur > 0.3) ctx.filter = `blur(${(blur * scaleOut).toFixed(2)}px)`;
        ctx.translate(W / 2 + dx, H / 2 + dy); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      };
      switch (tr.type) {
        case 'fade': put(a, 1); put(b, q); break;
        case 'slide': put(a, 1, -q * W * 0.25); put(b, 1, (1 - q) * W); break;
        case 'push': put(a, 1, -q * W); put(b, 1, (1 - q) * W); break;
        case 'slideUp': put(a, 1, 0, -q * H * 0.2); put(b, 1, 0, (1 - q) * H); break;
        case 'zoom': put(a, 1 - q, 0, 0, 1 + q * 0.25); put(b, q, 0, 0, 0.85 + 0.15 * q); break;
        case 'blur': put(a, 1 - q, 0, 0, 1, q * 30); put(b, q, 0, 0, 1, (1 - q) * 30); break;
        case 'wipe':
          put(a, 1);
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * q, H); ctx.clip(); ctx.drawImage(b, 0, 0); ctx.restore();
          break;
        default: put(b, 1);
      }
      ctx.setTransform(scaleOut, 0, 0, scaleOut, 0, 0);
    }
    // global layers on top of everything, absolute time
    ctx.setTransform(scaleOut, 0, 0, scaleOut, 0, 0);
    env.sceneDur = spec.duration;
    for (const L of spec.layers) drawLayer(ctx, L, t, layerWindow(L, spec.duration), env);
    return canvas;
  }

  return {
    canvas,
    width: W,
    height: H,
    renderAt,
    renderFrame: (i) => renderAt(i / spec.fps),
    raw: () => canvas.data(),
  };
}

module.exports = { createRenderer, layoutText };
