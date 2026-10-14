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

// SVG elliptical arc -> cubic béziers (endpoint parameterization, SVG spec F.6)
function arcToCubics(x1, y1, rx, ry, angle, large, sweep, x2, y2) {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [[x1, y1, x2, y2, x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (angle * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.ceil(Math.abs(dt) / (Math.PI / 2));
  const d = dt / n, k = (4 / 3) * Math.tan(d / 4);
  const pt = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const der = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = t1 + i * d, b = a + d;
    const [ax, ay] = pt(a), [bx, by] = pt(b), [dax, day] = der(a), [dbx, dby] = der(b);
    out.push([ax + k * dax, ay + k * day, bx - k * dbx, by - k * dby, bx, by]);
  }
  return out;
}

// Line icons on a 24x24 grid, drawn with round strokes (original drawings).
const ICONS = {
  gauge: 'M3.5 16.5 A9 9 0 0 1 20.5 16.5 M12 16.5 L16.2 10.8 M6.4 12.2 L7.6 12.9 M12 7.6 L12 9 M17.6 12.2 L16.4 12.9',
  check: 'M5 12.5 L10 17.5 L19.5 7',
  'check-circle': 'M12 3 A9 9 0 1 1 11.99 3 M8 12.4 L11 15.4 L16.5 9.4',
  home: 'M3.5 11 L12 4 L20.5 11 M6 9.5 L6 20 L18 20 L18 9.5 M10 20 L10 14.5 L14 14.5 L14 20',
  tool: 'M15 4 A4.5 4.5 0 0 0 10.6 9.6 L4 16.2 L7.8 20 L14.4 13.4 A4.5 4.5 0 0 0 20 9 L16.8 12.2 L11.8 7.2 Z',
  box: 'M4 7.5 L12 3.5 L20 7.5 L20 16.5 L12 20.5 L4 16.5 Z M4 7.5 L12 11.5 L20 7.5 M12 11.5 L12 20.5',
  pin: 'M12 21 C 8 16.5, 5 13, 5 9.5 A7 7 0 0 1 19 9.5 C 19 13, 16 16.5, 12 21 Z M14.5 9.5 A2.5 2.5 0 1 1 14.49 9.4',
  navigate: 'M20 4 L4 11 L11 13 L13 20 Z',
  search: 'M16.5 10.5 A6 6 0 1 1 16.49 10.4 M15 15 L20 20',
  team: 'M9 11 A3 3 0 1 1 9.01 11 M3.5 19.5 C 3.5 16, 6 14, 9 14 C 12 14, 14.5 16, 14.5 19.5 M16.5 10 A2.5 2.5 0 1 1 16.51 10 M16.5 13.5 C 19 13.5, 21 15, 21 18',
  truck: 'M2.5 6.5 L14 6.5 L14 16.5 L2.5 16.5 Z M14 9.5 L18 9.5 L21 13 L21 16.5 L14 16.5 M8.5 18 A2 2 0 1 1 8.49 18 M18.5 18 A2 2 0 1 1 18.49 18',
  clock: 'M21 12 A9 9 0 1 1 20.99 11.9 M12 7 L12 12 L15.5 14',
  star: 'M12 3.5 L14.6 9 L20.5 9.6 L16 13.6 L17.3 19.5 L12 16.5 L6.7 19.5 L8 13.6 L3.5 9.6 L9.4 9 Z',
  heart: 'M12 20 C 6 15.5, 3 12.5, 3 9 A4.5 4.5 0 0 1 12 7 A4.5 4.5 0 0 1 21 9 C 21 12.5, 18 15.5, 12 20 Z',
  bolt: 'M13.5 2.5 L5 13.5 L11.5 13.5 L10.5 21.5 L19 10.5 L12.5 10.5 Z',
  phone: 'M8 3 L16 3 A2 2 0 0 1 18 5 L18 19 A2 2 0 0 1 16 21 L8 21 A2 2 0 0 1 6 19 L6 5 A2 2 0 0 1 8 3 Z M11 18 L13 18',
  mail: 'M3.5 6 L20.5 6 L20.5 18 L3.5 18 Z M3.5 6.5 L12 13 L20.5 6.5',
  calendar: 'M4 6 L20 6 L20 20 L4 20 Z M4 10 L20 10 M8 3.5 L8 7.5 M16 3.5 L16 7.5',
  'arrow-right': 'M4 12 L19.5 12 M13.5 6 L19.5 12 L13.5 18',
  plus: 'M12 5 L12 19 M5 12 L19 12',
  sparkle: 'M12 3 C 12.8 8.5, 15.5 11.2, 21 12 C 15.5 12.8, 12.8 15.5, 12 21 C 11.2 15.5, 8.5 12.8, 3 12 C 8.5 11.2, 11.2 8.5, 12 3 Z',
  euro: 'M17.5 6.5 A7 7 0 1 0 17.5 17.5 M4 10.5 L13 10.5 M4 13.5 L13 13.5',
  shield: 'M12 3 L19.5 6 L19.5 11.5 C 19.5 16, 16.5 19.5, 12 21 C 7.5 19.5, 4.5 16, 4.5 11.5 L4.5 6 Z M8.6 12 L11 14.4 L15.6 9.6',
  play: 'M7 4.5 L19 12 L7 19.5 Z',
  key: 'M10 14 A5 5 0 1 1 13.9 9.7 L21 9.7 L21 12.7 M18 9.7 L18 12.2',
};

// Parse an SVG path into absolute segments: M, L, C (quadratics and arcs become cubics).
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
    if (C === 'A') {
      const rx = num(), ry = num(), rot = num(), large = num(), sweep = num();
      const ex = ox + num(), ey = oy + num();
      for (const c of arcToCubics(x, y, rx, ry, rot, large, sweep, ex, ey)) segs.push({ t: 'C', p: c });
      x = ex; y = ey; lcx = lqx = null; continue;
    }
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
  const key = JSON.stringify([L.shape, L.d, L.icon || L.name, L.viewBox, w, h]);
  if (pathCache.has(key)) return pathCache.get(key);
  let segs;
  if (L.type === 'icon') { const sc = Math.min(w, h) / 24; segs = transformSegs(parsePath(ICONS[L.name || L.icon]), (x, y) => [(w - 24 * sc) / 2 + x * sc, (h - 24 * sc) / 2 + y * sc]); }
  else if (L.shape) segs = transformSegs(parsePath(PRESETS[L.shape]), (x, y) => [(x / 100) * w, (y / 100) * h]);
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

const KF_PROPS = ['x', 'y', 'scale', 'rotate', 'opacity', 'w', 'h', 'r', 'radius', 'blur', 'rgb', 'skew', 'size', 'color'];

// colors: "#rgb", "#rrggbb", "#rrggbbaa", "rgb(...)", "rgba(...)"
function parseColor(c) {
  if (typeof c !== 'string') return null;
  let m = /^#([0-9a-f]{3,8})$/i.exec(c.trim());
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(c.trim());
  if (m) { const p = m[1].split(',').map((v) => parseFloat(v)); return [p[0], p[1], p[2], p[3] ?? 1]; }
  return null;
}
const mixColor = (a, b, t) => { const A = parseColor(a), B = parseColor(b); if (!A || !B) return t < 0.5 ? a : b; const v = A.map((x, i) => x + (B[i] - x) * t); return `rgba(${Math.round(v[0])},${Math.round(v[1])},${Math.round(v[2])},${v[3].toFixed(3)})`; };

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
      if (lt >= a.t && lt <= b.t) {
        const q = getEasing(b.easing || 'inOut')((lt - a.t) / Math.max(1e-6, b.t - a.t));
        out[prop] = prop === 'color' ? mixColor(a.v, b.v, q) : lerp(a.v, b.v, q);
        break;
      }
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

function drawArrowPointer(ctx, L, st) {
  const k = (L.size ?? 44) / 24;
  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.scale(k * (1 - 0.12 * st.press), k * (1 - 0.12 * st.press));
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.2, 13.2); ctx.lineTo(7, 19.5); ctx.lineTo(9.6, 18.4); ctx.lineTo(6.9, 12.3); ctx.lineTo(12.4, 12.3); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1.5;
  ctx.fillStyle = L.color || '#000'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.strokeStyle = L.border || '#fff'; ctx.stroke();
  ctx.restore();
}

// a loading spinner: an arc that spins and breathes
function drawSpinner(ctx, L, lt) {
  const r = (L.size ?? 48) / 2, w = L.strokeWidth ?? Math.max(2, r * 0.16);
  const rot = lt * (L.speed ?? 1.4) * Math.PI * 2;
  const span = Math.PI * (0.55 + 0.35 * Math.sin(lt * 3));
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineWidth = w;
  if (L.track !== false) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.strokeStyle = L.track || 'rgba(127,127,127,0.25)'; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, r, rot, rot + span); ctx.strokeStyle = L.color || '#fff'; ctx.stroke();
  ctx.restore();
}

function drawCursor(ctx, L, st) {
  if (L.style === 'arrow' || L.style === 'pointer' || L.style === 'mouse') return drawArrowPointer(ctx, L, st);
  const r = L.size ? L.size / 2 : 26;
  ctx.save();
  ctx.translate(st.x, st.y);
  for (const q of st.ripples) {
    ctx.beginPath();
    ctx.arc(0, 0, r * (1 + q * 1.6), 0, Math.PI * 2);
    ctx.strokeStyle = L.rippleColor || 'rgba(255,255,255,0.9)';
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

module.exports = { PRESETS, ICONS, drawSpinner, parsePath, fittedPath, tracePath, keyframeValues, cursorState, drawCursor, phoneGeometry, drawPhoneBody, drawStatusBar, roundRectPath, PHONE };
