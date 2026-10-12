'use strict';
// Building blocks for product and app demos: SVG-like paths that draw themselves,
// keyframed movement, a touch cursor with tap ripples, and a phone mockup.

const { getEasing, clamp01, lerp } = require('./easing');

// ---------- paths ----------

// Hand-drawn presets in a 100x100 box, stretched to the layer's w x h.
const PRESETS = {
  underline: 'M2 64 C 22 52, 58 46, 98 54',
  'double-underline': 'M2 52 C 30 44, 66 42, 98 48 M8 74 C 36 66, 70 64, 94 70',
  circle: 'M52 6 C 84 6, 98 28, 97 50 C 96 78, 66 96, 44 95 C 16 93, 2 72, 4 48 C 6 22, 30 4, 64 9',
  arrow: 'M4 50 C 30 46, 60 46, 90 50 M70 30 L 92 50 L 70 70',
  'arrow-curved': 'M6 86 C 20 30, 60 14, 90 22 M72 8 L 92 22 L 76 40',
  check: 'M10 54 L 38 82 L 92 16',
  cross: 'M16 16 L 84 84 M84 16 L 16 84',
  strike: 'M0 54 C 30 48, 70 50, 100 46',
  bracket: 'M30 4 C 10 6, 12 40, 4 50 C 12 60, 10 94, 30 96',
  spark: 'M50 4 L 50 30 M50 70 L 50 96 M4 50 L 30 50 M70 50 L 96 50 M18 18 L 34 34 M66 66 L 82 82 M82 18 L 66 34 M34 66 L 18 82',
};

// Parse an SVG path into absolute segments: M, L, C (quadratics become cubics).
function parsePath(d) {
  const toks = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const segs = [];
  let i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0, lcx = null, lcy = null, lqx = null, lqy = null;
  const num = () => parseFloat(toks[i++]);
  const isNum = () => i < toks.length && !/^[A-Za-z]$/.test(toks[i]);
  while (i < toks.length) {
    if (/^[A-Za-z]$/.test(toks[i])) cmd = toks[i++];
    if (!cmd) break;
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') { segs.push({ t: 'L', p: [sx, sy] }); x = sx; y = sy; lcx = lqx = null; if (!isNum()) continue; }
    if (C === 'M') { x = ox + num(); y = oy + num(); sx = x; sy = y; segs.push({ t: 'M', p: [x, y] }); cmd = rel ? 'l' : 'L'; lcx = lqx = null; continue; }
    if (C === 'L') { x = ox + num(); y = oy + num(); segs.push({ t: 'L', p: [x, y] }); lcx = lqx = null; continue; }
    if (C === 'H') { x = ox + num(); segs.push({ t: 'L', p: [x, y] }); lcx = lqx = null; continue; }
    if (C === 'V') { y = oy + num(); segs.push({ t: 'L', p: [x, y] }); lcx = lqx = null; continue; }
    if (C === 'C' || C === 'S') {
      let x1, y1;
      if (C === 'C') { x1 = ox + num(); y1 = oy + num(); } else { x1 = lcx != null ? 2 * x - lcx : x; y1 = lcy != null ? 2 * y - lcy : y; }
      const x2 = ox + num(), y2 = oy + num(), ex = ox + num(), ey = oy + num();
      segs.push({ t: 'C', p: [x1, y1, x2, y2, ex, ey] });
      lcx = x2; lcy = y2; lqx = null; x = ex; y = ey; continue;
    }
    if (C === 'Q' || C === 'T') {
      let qx, qy;
      if (C === 'Q') { qx = ox + num(); qy = oy + num(); } else { qx = lqx != null ? 2 * x - lqx : x; qy = lqy != null ? 2 * y - lqy : y; }
      const ex = ox + num(), ey = oy + num();
      segs.push({ t: 'C', p: [x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey] });
      lqx = qx; lqy = qy; lcx = null; x = ex; y = ey; continue;
    }
    if (C === 'A') { for (let k = 0; k < 5; k++) num(); x = ox + num(); y = oy + num(); segs.push({ t: 'L', p: [x, y] }); lcx = lqx = null; continue; }
    i++; // unknown token
  }
  return segs;
}

function bounds(segs) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of segs) for (let k = 0; k < s.p.length; k += 2) { x0 = Math.min(x0, s.p[k]); x1 = Math.max(x1, s.p[k]); y0 = Math.min(y0, s.p[k + 1]); y1 = Math.max(y1, s.p[k + 1]); }
  return { x0, y0, w: Math.max(1e-6, x1 - x0), h: Math.max(1e-6, y1 - y0) };
}

function transformSegs(segs, fx) {
  return segs.map((s) => { const p = []; for (let k = 0; k < s.p.length; k += 2) { const [a, b] = fx(s.p[k], s.p[k + 1]); p.push(a, b); } return { t: s.t, p }; });
}

function pathLength(segs) {
  let len = 0, x = 0, y = 0;
  for (const s of segs) {
    if (s.t === 'M') { [x, y] = s.p; continue; }
    if (s.t === 'L') { len += Math.hypot(s.p[0] - x, s.p[1] - y); [x, y] = s.p; continue; }
    let px = x, py = y;
    for (let k = 1; k <= 20; k++) {
      const t = k / 20, u = 1 - t;
      const qx = u * u * u * x + 3 * u * u * t * s.p[0] + 3 * u * t * t * s.p[2] + t * t * t * s.p[4];
      const qy = u * u * u * y + 3 * u * u * t * s.p[1] + 3 * u * t * t * s.p[3] + t * t * t * s.p[5];
      len += Math.hypot(qx - px, qy - py); px = qx; py = qy;
    }
    x = s.p[4]; y = s.p[5];
  }
  return len;
}

function tracePath(ctx, segs) {
  ctx.beginPath();
  for (const s of segs) {
    if (s.t === 'M') ctx.moveTo(s.p[0], s.p[1]);
    else if (s.t === 'L') ctx.lineTo(s.p[0], s.p[1]);
    else ctx.bezierCurveTo(...s.p);
  }
}

const pathCache = new Map();
// segments fitted to a w x h box: presets stretch, custom paths keep their aspect
function fittedPath(L, w, h) {
  const key = JSON.stringify([L.shape, L.d, L.viewBox, w, h]);
  if (pathCache.has(key)) return pathCache.get(key);
  let segs;
  if (L.shape) segs = transformSegs(parsePath(PRESETS[L.shape]), (x, y) => [(x / 100) * w, (y / 100) * h]);
  else {
    const raw = parsePath(L.d);
    const vb = L.viewBox ? { x0: L.viewBox[0], y0: L.viewBox[1], w: L.viewBox[2], h: L.viewBox[3] } : bounds(raw);
    const sc = Math.min(w / vb.w, h / vb.h);
    const offX = (w - vb.w * sc) / 2, offY = (h - vb.h * sc) / 2;
    segs = transformSegs(raw, (x, y) => [offX + (x - vb.x0) * sc, offY + (y - vb.y0) * sc]);
  }
  const res = { segs, length: pathLength(segs) };
  pathCache.set(key, res);
  return res;
}

// ---------- keyframes ----------

const KF_PROPS = ['x', 'y', 'scale', 'rotate', 'opacity'];

// value of every keyframed property at local time lt (holds before the first and after the last)
function keyframeValues(kfs, lt, resolve) {
  const list = [...kfs].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  const out = {};
  for (const prop of KF_PROPS) {
    const pts = list.filter((k) => k[prop] != null).map((k) => ({ t: k.t ?? 0, v: resolve(prop, k[prop]), easing: k.easing }));
    if (!pts.length) continue;
    if (lt <= pts[0].t) { out[prop] = pts[0].v; continue; }
    const last = pts[pts.length - 1];
    if (lt >= last.t) { out[prop] = last.v; continue; }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (lt >= a.t && lt <= b.t) { out[prop] = lerp(a.v, b.v, getEasing(b.easing || 'inOut')((lt - a.t) / Math.max(1e-6, b.t - a.t))); break; }
    }
  }
  return out;
}

// ---------- touch cursor ----------

function cursorState(L, lt, resolve) {
  const pts = (L.path || L.taps || []).map((p) => ({ t: p.t ?? 0, x: resolve('x', p.x), y: resolve('y', p.y), tap: !!p.tap, easing: p.easing }));
  if (!pts.length) return null;
  let x = pts[0].x, y = pts[0].y;
  if (lt >= pts[pts.length - 1].t) { x = pts[pts.length - 1].x; y = pts[pts.length - 1].y; }
  else for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (lt >= a.t && lt <= b.t) { const p = getEasing(b.easing || 'inOut')((lt - a.t) / Math.max(1e-6, b.t - a.t)); x = lerp(a.x, b.x, p); y = lerp(a.y, b.y, p); break; }
  }
  let press = 0;
  const ripples = [];
  for (const p of pts) {
    if (!p.tap) continue;
    const d = lt - p.t;
    if (d > -0.08 && d < 0.22) press = Math.max(press, d < 0 ? (d + 0.08) / 0.08 : 1 - d / 0.22);
    if (d >= 0 && d < 0.5) ripples.push(d / 0.5);
  }
  return { x, y, press: clamp01(press), ripples };
}

function drawCursor(ctx, L, st) {
  const r = L.size ? L.size / 2 : 26;
  ctx.save();
  ctx.translate(st.x, st.y);
  for (const q of st.ripples) {
    ctx.beginPath();
    ctx.arc(0, 0, r * (1 + q * 1.6), 0, Math.PI * 2);
    ctx.strokeStyle = L.rippleColor || 'rgba(255,255,255,0.9)';
    ctx.globalAlpha *= 1;
    ctx.lineWidth = r * 0.18 * (1 - q);
    ctx.save(); ctx.globalAlpha *= (1 - q) * 0.9; ctx.stroke(); ctx.restore();
  }
  const sc = 1 - 0.18 * st.press;
  ctx.scale(sc, sc);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = L.color || 'rgba(60,60,64,0.38)';
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = r * 0.6; ctx.shadowOffsetY = r * 0.12;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.strokeStyle = L.border || 'rgba(255,255,255,0.95)';
  ctx.stroke();
  ctx.restore();
}

// ---------- phone mockup ----------

const PHONE = { pointsW: 390, pointsH: 844 };

// geometry of a phone of design width w: body box and screen box, centered on 0,0
function phoneGeometry(L) {
  const w = L.w ?? 600;
  const h = L.h ?? (w * PHONE.pointsH) / PHONE.pointsW * 1.035;
  const bezel = w * 0.035;
  return {
    w, h, bezel,
    radius: w * 0.17,
    screen: { x: -w / 2 + bezel, y: -h / 2 + bezel, w: w - bezel * 2, h: h - bezel * 2, r: w * 0.14 },
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawPhoneBody(ctx, L, g, scaleOut) {
  ctx.save();
  if (L.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 60 * scaleOut; ctx.shadowOffsetY = 24 * scaleOut; }
  roundRectPath(ctx, -g.w / 2, -g.h / 2, g.w, g.h, g.radius);
  ctx.fillStyle = L.frameColor || '#111113';
  ctx.fill();
  ctx.restore();
  // thin metal edge
  ctx.save();
  roundRectPath(ctx, -g.w / 2 + 1.5, -g.h / 2 + 1.5, g.w - 3, g.h - 3, g.radius - 1.5);
  ctx.strokeStyle = L.edgeColor || 'rgba(255,255,255,0.18)';
  ctx.lineWidth = Math.max(1.5, g.w * 0.004);
  ctx.stroke();
  ctx.restore();
}

function drawStatusBar(ctx, L, s, theme) {
  // screen coordinates are iPhone points (390 wide)
  const color = L.statusColor || '#111';
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 16px "${theme.font || 'Inter'}"`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(L.time || '9:41', 62, 26);
  // dynamic island
  roundRectPath(ctx, 195 - 62, 12, 124, 34, 17);
  ctx.fillStyle = '#000';
  ctx.fill();
  // battery
  ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.globalAlpha *= 0.9;
  roundRectPath(ctx, 336, 20, 25, 12, 3.5); ctx.stroke();
  ctx.fillStyle = color; roundRectPath(ctx, 338, 22, 18, 8, 2); ctx.fill();
  ctx.fillRect(362.5, 24, 1.8, 4);
  // signal bars
  for (let i = 0; i < 4; i++) ctx.fillRect(296 + i * 5, 30 - (i + 1) * 2.6, 3.2, (i + 1) * 2.6);
  ctx.restore();
}

module.exports = { PRESETS, parsePath, fittedPath, tracePath, keyframeValues, cursorState, drawCursor, phoneGeometry, drawPhoneBody, drawStatusBar, roundRectPath, PHONE };
