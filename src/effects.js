'use strict';
// Library of ready-made effects. The agent only writes the name ("fadeUp", "rise"...);
// the hard, tested motion design lives here.
//
// ENTER effects: apply(s, p) with p from 0 (hidden) to 1 (in place).
// EXITS reuse the same effects in reverse.
// LOOP effects: apply(s, t, layer) with t = seconds since the layer started.

const soft = (p) => (p <= 1 ? Math.max(0, p) : 1 + (p - 1) * 0.35);
// deterministic pseudo-random in [0, 1) (same frame → same value, in every worker)
const hash = (k) => { const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

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
  // stamp: slams down from big and tilted, like a rubber stamp
  stamp:     { duration: 0.42, easing: 'expoOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 4); s.scale *= 1 + (1 - p) * 1.6; s.rotate += (1 - p) * -10; } },
  // draw: a path layer draws its stroke from start to end (on other layers it acts as a wipe)
  draw:      { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.draw = Math.min(s.draw, Math.max(0, p)); } },
  // glitch: a chromatic red/cyan split that jitters and settles (text)
  glitch:    { duration: 0.55, easing: 'out', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 3); s.rgb += (1 - p) * 18; s.dx += Math.sin(p * 95) * (1 - p) * 16; } },
  // rush: flies in from the right with speed blur (cars, vans, products)
  rush:      { duration: 0.75, easing: 'expoOut', apply: (s, p) => { s.dx += (1 - p) * 1500; s.blur += (1 - p) * 22; s.opacity *= Math.min(1, p * 4); } },
  slideUp:   { duration: 0.8, apply: (s, p) => { s.opacity *= Math.min(1, p * 2); s.dy += (1 - p) * 900; } },
  growUp:    { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.scaleY *= p; s.origin = 'bottom'; } },
  slideDown: { duration: 0.8, apply: (s, p) => { s.opacity *= Math.min(1, p * 2); s.dy -= (1 - p) * 900; } },
  growLeft:  { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.scaleX *= p; s.origin = 'right'; } },
  growDown:  { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.scaleY *= p; s.origin = 'top'; } },
  wipeLeft:  { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.clip = { x0: 1 - p, x1: 1, y0: 0, y1: 1 }; } },
  wipeDown:  { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.clip = { x0: 0, x1: 1, y0: 0, y1: p }; } },
  // unfold: opens from the center line outward, like a curtain
  unfold:    { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.clip = { x0: 0.5 - p / 2, x1: 0.5 + p / 2, y0: 0, y1: 1 }; } },
  // iris: circular reveal from the center (photos, logos, cards)
  iris:      { duration: 0.8, easing: 'inOut', apply: (s, p) => { s.clip = { circle: Math.max(0, p) }; } },
  // flip: turns around its vertical axis like a card
  flip:      { duration: 0.7, easing: 'backOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 3); s.scaleX *= Math.max(0, p); } },
  flipUp:    { duration: 0.7, easing: 'backOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 3); s.scaleY *= Math.max(0, p); } },
  // elastic: springs into place with a wobble
  elastic:   { duration: 1.0, easing: 'elasticOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 3); s.scale *= Math.max(0, p); } },
  // swing: hangs from the top edge and swings into place
  swing:     { duration: 0.9, easing: 'elasticOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 3); s.rotate += (1 - p) * 35; s.origin = 'top'; } },
  // skewIn: slides in from the left leaning forward, then straightens (sporty, fast)
  skewIn:    { duration: 0.7, easing: 'expoOut', apply: (s, p) => { s.opacity *= Math.min(1, p * 3); s.dx -= (1 - p) * 500; s.skew -= (1 - p) * 30; } },
  // flicker: switches on like a neon sign
  flicker:   { duration: 0.8, easing: 'linear', apply: (s, p) => { s.opacity *= p >= 0.85 ? 1 : p <= 0 ? 0 : hash(Math.floor(p * 22)) < 0.25 + 0.7 * p ? 1 : 0.1; } },
  // focus: comes into focus from a big soft blur, no movement
  focus:     { duration: 1.0, easing: 'out', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 2); s.blur += (1 - p) * 40; } },

  // --- text effects, unit by unit (word, letter, line) ---
  // rise: each line slides up from under a mask. Apple keynote style.
  rise:      { duration: 0.9, split: 'line', stagger: 0.12, mask: true, apply: (s, p, u) => { s.dy += (1 - p) * u.h * 1.05; } },
  wordsUp:   { duration: 0.7, split: 'word', stagger: 0.07, apply: (s, p) => { s.opacity *= p; s.dy += (1 - p) * 45; s.blur += (1 - p) * 10; } },
  // for words and letters the overshoot is reduced so neighbors don't collide
  wordsPop:  { duration: 0.5, split: 'word', stagger: 0.09, easing: 'backOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 2); s.scale *= soft(p); } },
  letters:   { duration: 0.5, split: 'char', stagger: 0.035, easing: 'backOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 2); s.dy += (1 - p) * 30; s.scale *= 0.5 + 0.5 * soft(p); } },
  wordsRise: { duration: 0.75, split: 'word', stagger: 0.08, mask: true, apply: (s, p, u) => { s.dy += (1 - p) * u.h * 1.05; } },
  wordsSlide:{ duration: 0.6, split: 'word', stagger: 0.08, easing: 'expoOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 2); s.dx -= (1 - p) * 80; } },
  wordsFlip: { duration: 0.6, split: 'word', stagger: 0.09, easing: 'backOut', apply: (s, p) => { s.opacity *= Math.min(1, Math.max(0, p) * 3); s.scaleY *= Math.max(0.001, p); } },
  lettersBlur:{ duration: 0.6, split: 'char', stagger: 0.04, easing: 'out', apply: (s, p) => { s.opacity *= Math.max(0, p); s.blur += (1 - p) * 14; s.scale *= 1.3 - 0.3 * p; } },
  // cascade: letters fall from above with a little tilt
  cascade:   { duration: 0.6, split: 'char', stagger: 0.04, easing: 'backOut', apply: (s, p, u) => { s.opacity *= Math.min(1, Math.max(0, p) * 2); s.dy -= (1 - p) * u.h * 0.9; s.rotate += (1 - p) * -25; } },
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
  wiggle:   (s, t, o) => { const a = o.amount ?? 4, per = o.period ?? 0.5; s.rotate += Math.sin((t / per) * Math.PI * 2) * a; },
  swing:    (s, t, o) => { const a = o.amount ?? 8, per = o.period ?? 2; s.rotate += Math.sin((t / per) * Math.PI * 2) * a; s.origin = 'top'; },
  bounce:   (s, t, o) => { const a = o.amount ?? 30, per = o.period ?? 0.8; s.dy -= Math.abs(Math.sin((t / per) * Math.PI)) * a; },
  orbit:    (s, t, o) => { const a = o.amount ?? 20, per = o.period ?? 4, k = (t / per) * Math.PI * 2; s.dx += Math.cos(k) * a; s.dy += Math.sin(k) * a; },
  heartbeat:(s, t, o) => { const a = o.amount ?? 0.08, per = o.period ?? 1.1, f = (t / per) % 1; s.scale *= 1 + a * (Math.exp(-((f - 0.1) ** 2) / 0.002) + 0.6 * Math.exp(-((f - 0.3) ** 2) / 0.002)); },
  flicker:  (s, t, o) => { s.opacity *= hash(Math.floor(t * (o.speed ?? 12))) < (o.amount ?? 0.15) ? 0.25 : 1; },
  // glitch: short bursts of chromatic split and jitter every "period" seconds
  glitch:   (s, t, o) => { const per = o.period ?? 2, f = t % per; if (f < 0.18) { const a = o.amount ?? 12; s.rgb += a; s.dx += Math.sin(t * 177) * a * 0.8; } },
};

const transitions = ['none', 'fade', 'slide', 'slideUp', 'slideDown', 'push', 'pushUp', 'whip', 'zoom', 'zoomIn', 'wipe', 'wipeLeft', 'wipeUp', 'wipeDown', 'barn', 'blur', 'circle', 'fadeBlack', 'flash'];

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
