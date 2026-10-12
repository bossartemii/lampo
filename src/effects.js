'use strict';
// Library of ready-made effects. The agent only writes the name ("fadeUp", "rise"...);
// the hard, tested motion design lives here.
//
// ENTER effects: apply(s, p) with p from 0 (hidden) to 1 (in place).
// EXITS reuse the same effects in reverse.
// LOOP effects: apply(s, t, layer) with t = seconds since the layer started.

const soft = (p) => (p <= 1 ? Math.max(0, p) : 1 + (p - 1) * 0.35);

const enter = {
  fade:      { duration: 0.5, apply: (s, p) => { s.opacity *= p; } },
  fadeUp:    { duration: 0.7, apply: (s, p) => { s.opacity *= p; s.dy += (1 - p) * 70; } },
  fadeDown:  { duration: 0.7, apply: (s, p) => { s.opacity *= p; s.dy -= (1 - p) * 70; } },
  slideLeft: { duration: 0.7, apply: (s, p) => { s.opacity *= p; s.dx += (1 - p) * 260; } },
  slideRight:{ duration: 0.7, apply: (s, p) => { s.opacity *= p; s.dx -= (1 - p) * 260; } },
  scaleIn:   { duration: 0.7, apply: (s, p) => { s.opacity *= p; s.scale *= 0.82 + 0.18 * p; } },
  popIn:     { duration: 0.6, easing: 'backOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 2.5); s.scale *= Math.max(0, p); } },
  zoomOut:   { duration: 0.9, apply: (s, p) => { s.opacity *= p; s.scale *= 1.7 - 0.7 * p; s.blur += (1 - p) * 18; } },
  blurIn:    { duration: 0.9, apply: (s, p) => { s.opacity *= p; s.blur += (1 - p) * 26; s.scale *= 1.05 - 0.05 * p; } },
  drop:      { duration: 0.9, easing: 'bounceOut', apply: (s, p) => { s.opacity *= Math.min(1, p * 3); s.dy -= (1 - p) * 420; } },
  spin:      { duration: 0.8, easing: 'backOut', apply: (s, p) => { s.opacity *= Math.min(1, p * 2); s.rotate += (1 - p) * -120; s.scale *= 0.4 + 0.6 * p; } },
  wipe:      { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.clip = { x0: 0, x1: p, y0: 0, y1: 1 }; } },
  wipeUp:    { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.clip = { x0: 0, x1: 1, y0: 1 - p, y1: 1 }; } },
  grow:      { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.scaleX *= p; s.origin = 'left'; } },
  growUp:    { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.scaleY *= p; s.origin = 'bottom'; } },

  // --- text effects, unit by unit (word, letter, line) ---
  // rise: each line slides up from under a mask. Apple keynote style.
  rise:      { duration: 0.9, split: 'line', stagger: 0.12, mask: true, apply: (s, p, u) => { s.dy += (1 - p) * u.h * 1.05; } },
  wordsUp:   { duration: 0.7, split: 'word', stagger: 0.07, apply: (s, p) => { s.opacity *= p; s.dy += (1 - p) * 45; s.blur += (1 - p) * 10; } },
  // for words and letters the overshoot is reduced so neighbors don't collide
  wordsPop:  { duration: 0.5, split: 'word', stagger: 0.09, easing: 'backOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 2); s.scale *= soft(p); } },
  letters:   { duration: 0.5, split: 'char', stagger: 0.035, easing: 'backOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 2); s.dy += (1 - p) * 30; s.scale *= 0.5 + 0.5 * soft(p); } },
  // typewriter: total duration is split across characters (see splitTiming)
  typewriter:{ duration: 1.2, split: 'char', typewriter: true, easing: 'linear', apply: (s, p) => { s.opacity *= p >= 1 ? 1 : 0; } },
};

const loop = {
  float:    (s, t, o) => { const a = o.amount ?? 14, per = o.period ?? 3; s.dy += Math.sin((t / per) * Math.PI * 2) * a; },
  pulse:    (s, t, o) => { const a = o.amount ?? 0.04, per = o.period ?? 1.2; s.scale *= 1 + Math.sin((t / per) * Math.PI * 2) * a; },
  rotate:   (s, t, o) => { s.rotate += t * (o.speed ?? 30); },
  kenburns: (s, t, o, L) => { const d = Math.max(0.1, L.dur); s.scale *= 1 + (o.amount ?? 0.12) * Math.min(1, t / d); },
  drift:    (s, t, o, L) => { const d = Math.max(0.1, L.dur); s.dx += (o.amount ?? 60) * (Math.min(1, t / d) - 0.5); },
  shake:    (s, t, o) => { const a = o.amount ?? 6; s.dx += Math.sin(t * 53) * a; s.dy += Math.cos(t * 41) * a; },
  breathe:  (s, t, o) => { const per = o.period ?? 2.4; s.opacity *= 0.75 + 0.25 * (0.5 + 0.5 * Math.sin((t / per) * Math.PI * 2)); },
};

const transitions = ['none', 'fade', 'slide', 'slideUp', 'push', 'zoom', 'wipe', 'blur'];

// For unit effects: when each unit starts and how long it lasts.
function splitTiming(fx, opts, count) {
  const dur = opts.duration ?? fx.duration;
  if (fx.typewriter) {
    const per = dur / Math.max(1, count);
    return { unitDur: per * 0.001 + 1e-6, stagger: per, total: dur };
  }
  const stagger = opts.stagger ?? fx.stagger ?? 0.06;
  return { unitDur: dur, stagger, total: dur + stagger * Math.max(0, count - 1) };
}

function describe() {
  return {
    enter: Object.keys(enter).map((k) => ({
      name: k,
      defaultDuration: enter[k].duration,
      textOnly: !!enter[k].split,
      splitBy: enter[k].split || null,
    })),
    exit: 'Qualsiasi effetto di entrata funziona anche come uscita (out), al contrario.',
    loop: Object.keys(loop),
    transitions,
  };
}

module.exports = { enter, loop, transitions, splitTiming, describe };
