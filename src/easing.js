'use strict';
// Easing curves. All take t in [0,1] and return progress.

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

const bezier = (x1, y1, x2, y2) => {
  // cubic-bezier as in CSS, solved with Newton + bisection
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    x = clamp01(x);
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = sx(t) - x;
      const d = dx(t);
      if (Math.abs(e) < 1e-5) return sy(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 20; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
};

const easings = {
  linear: (t) => clamp01(t),
  in: (t) => clamp01(t) ** 3,
  out: (t) => 1 - (1 - clamp01(t)) ** 3,
  inOut: (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; },
  // the "Apple" curve: starts decisively, lands softly
  apple: bezier(0.22, 1, 0.36, 1),
  expoOut: (t) => { t = clamp01(t); return t === 1 ? 1 : 1 - 2 ** (-10 * t); },
  backOut: (t) => { t = clamp01(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  elasticOut: (t) => {
    t = clamp01(t);
    if (t === 0 || t === 1) return t;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  bounceOut: (t) => {
    t = clamp01(t);
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

function getEasing(name) {
  if (typeof name === 'function') return name;
  if (Array.isArray(name) && name.length === 4) return bezier(...name);
  return easings[name] || easings.apple;
}

const lerp = (a, b, t) => a + (b - a) * t;

module.exports = { easings, getEasing, bezier, clamp01, lerp };
