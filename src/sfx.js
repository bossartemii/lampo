'use strict';
// Sound effects, synthesized from scratch (no sample files, no licensing issues,
// identical output on every render). Sounds are placed automatically from the
// animations — whoosh on transitions, pop on popIn, ticks on typewriter and
// counters, impact on big titles — or by hand with "sfx" and "sounds".

const { enter, splitTiming } = require('./effects');
const { easings } = require('./easing');

const SR = 44100;

// deterministic noise: same spec, same sound
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

const buf = (sec) => new Float32Array(Math.max(1, Math.round(sec * SR)));

// state-variable bandpass, frequency can change every sample
function bandpass(input, freqAt, q = 1.2) {
  const out = new Float32Array(input.length);
  let low = 0, band = 0;
  for (let i = 0; i < input.length; i++) {
    const f = 2 * Math.sin((Math.PI * Math.min(freqAt(i / SR), SR / 6)) / SR);
    const high = input[i] - low - band / q;
    band += f * high;
    low += f * band;
    out[i] = band;
  }
  return out;
}

function highpass(input, cutoff) {
  const out = new Float32Array(input.length);
  const rc = 1 / (2 * Math.PI * cutoff), a = rc / (rc + 1 / SR);
  let prevIn = 0, prevOut = 0;
  for (let i = 0; i < input.length; i++) { prevOut = a * (prevOut + input[i] - prevIn); prevIn = input[i]; out[i] = prevOut; }
  return out;
}

function lowpass(input, cutoff) {
  const out = new Float32Array(input.length);
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < input.length; i++) { y += a * (input[i] - y); out[i] = y; }
  return out;
}

function noise(sec, seed) { const r = rng(seed), b = buf(sec); for (let i = 0; i < b.length; i++) b[i] = r(); return b; }

// sine with a frequency curve; phase is integrated so sweeps stay clean
function tone(sec, freqAt, env) {
  const b = buf(sec);
  let ph = 0;
  for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (2 * Math.PI * freqAt(t)) / SR; b[i] = Math.sin(ph) * env(t); }
  return b;
}

// band-limited enough for short effects: sine, square, saw, triangle with a frequency curve
function osc(sec, freqAt, env, shape = 'sine') {
  const b = buf(sec);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph = (ph + freqAt(t) / SR) % 1;
    const v = shape === 'square' ? (ph < 0.5 ? 1 : -1) : shape === 'saw' ? 2 * ph - 1 : shape === 'triangle' ? 1 - 4 * Math.abs(ph - 0.5) : Math.sin(2 * Math.PI * ph);
    b[i] = v * env(t);
  }
  return b;
}

// a plucked note with two soft harmonics
function melodic(sec, f, tau) {
  const b = tone(sec, () => f, decay(0.003, tau));
  mixInto(b, tone(sec, () => f * 2, decay(0.003, tau / 2)), 0.25);
  return b;
}

function applyEnv(b, env) { for (let i = 0; i < b.length; i++) b[i] *= env(i / SR); return b; }
function mixInto(dst, src, gain = 1) { for (let i = 0; i < Math.min(dst.length, src.length); i++) dst[i] += src[i] * gain; return dst; }
function normalize(b, peak = 0.9) { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / m; return b; }

const bell = (d, peakAt = 0.45) => (t) => { const x = t / d; if (x <= 0 || x >= 1) return 0; return x < peakAt ? Math.sin((x / peakAt) * Math.PI / 2) ** 2 : Math.cos(((x - peakAt) / (1 - peakAt)) * Math.PI / 2) ** 2; };
const decay = (attack, tau) => (t) => (t < attack ? t / attack : Math.exp(-(t - attack) / tau));

// --- the sound library. Each returns a mono buffer and where its "hit" is (seconds) ---
const SOUNDS = {
  whoosh: (o, seed) => {
    const d = o.duration ?? 0.55;
    const b = bandpass(noise(d, seed), (t) => 250 + 2800 * Math.sin(Math.min(1, t / d) * Math.PI) ** 1.5, 1.4);
    return { data: normalize(applyEnv(b, bell(d, 0.5))), hit: d * 0.5 };
  },
  swoosh: (o, seed) => {
    const d = o.duration ?? 0.3;
    const b = bandpass(noise(d, seed), (t) => 900 + 5200 * (t / d), 1.6);
    return { data: normalize(applyEnv(b, bell(d, 0.35)), 0.8), hit: d * 0.35 };
  },
  swipe: (o, seed) => {
    const d = o.duration ?? 0.18;
    const b = highpass(noise(d, seed), 2500);
    return { data: normalize(applyEnv(b, decay(0.01, d / 4)), 0.6), hit: 0.01 };
  },
  pop: (o) => {
    const d = 0.14, f0 = o.pitch ?? 950;
    const b = tone(d, (t) => f0 * Math.exp(-t * 28) + f0 * 0.22, decay(0.002, 0.035));
    return { data: normalize(b, 0.85), hit: 0.002 };
  },
  click: (o, seed) => {
    const d = 0.03;
    const b = highpass(noise(d, seed), 3000);
    return { data: normalize(applyEnv(b, decay(0.0005, 0.004)), 0.6), hit: 0 };
  },
  tick: (o) => {
    const d = 0.05, f = o.pitch ?? 2100;
    return { data: normalize(tone(d, () => f, decay(0.001, 0.008)), 0.45), hit: 0 };
  },
  impact: (o, seed) => {
    const d = o.duration ?? 0.9;
    const body = tone(d, (t) => 48 + 70 * Math.exp(-t * 18), decay(0.003, 0.22));
    const hit = applyEnv(lowpass(noise(d, seed), 1800), decay(0.001, 0.035));
    return { data: normalize(mixInto(body, hit, 0.7), 0.95), hit: 0.003 };
  },
  boom: (o, seed) => {
    const d = o.duration ?? 1.8;
    const body = tone(d, (t) => 32 + 40 * Math.exp(-t * 6), decay(0.005, 0.55));
    const air = applyEnv(lowpass(noise(d, seed), 500), decay(0.002, 0.25));
    return { data: normalize(mixInto(body, air, 0.8), 0.95), hit: 0.005 };
  },
  riser: (o, seed) => {
    const d = o.duration ?? 1.6;
    const n = bandpass(noise(d, seed), (t) => 200 + 6000 * (t / d) ** 2, 2);
    const s = tone(d, (t) => 180 + 700 * (t / d) ** 2, () => 0.25);
    const b = applyEnv(mixInto(n, s, 1), (t) => (t / d) ** 2 * (t > d - 0.03 ? (d - t) / 0.03 : 1));
    return { data: normalize(b, 0.8), hit: d };
  },
  ding: (o) => {
    const d = 1.4, f = o.pitch ?? 1318.5;
    const b = tone(d, () => f, decay(0.002, 0.35));
    mixInto(b, tone(d, () => f * 2.01, decay(0.002, 0.18)), 0.3);
    mixInto(b, tone(d, () => f * 3.02, decay(0.002, 0.09)), 0.12);
    return { data: normalize(b, 0.6), hit: 0.002 };
  },
  chime: (o) => {
    const notes = [1046.5, 1318.5, 1568], d = 1.6;
    const b = buf(d);
    notes.forEach((f, k) => { const n = SOUNDS.ding({ pitch: f }).data; const off = Math.round(k * 0.08 * SR); for (let i = 0; i < n.length && off + i < b.length; i++) b[off + i] += n[i] * 0.6; });
    return { data: normalize(b, 0.6), hit: 0.002 };
  },
  glitch: (o, seed) => {
    const d = o.duration ?? 0.28, r = rng(seed), b = buf(d);
    let i = 0;
    while (i < b.length) {
      const len = Math.floor((0.008 + Math.abs(r()) * 0.03) * SR), f = 200 + Math.abs(r()) * 3000, on = r() > -0.3, amp = 0.4 + Math.abs(r()) * 0.6;
      for (let k = 0; k < len && i < b.length; k++, i++) b[i] = on ? Math.sign(Math.sin((2 * Math.PI * f * k) / SR)) * amp * 0.5 : 0;
    }
    return { data: normalize(lowpass(b, 6000), 0.55), hit: 0 };
  },

  // --- UI ---
  tap: (o, seed) => {
    const d = 0.06;
    const b = tone(d, (t) => (o.pitch ?? 520) * (1 - t * 3), decay(0.0008, 0.012));
    mixInto(b, applyEnv(bandpass(noise(d, seed), () => 3200, 2), decay(0.0003, 0.003)), 0.5);
    return { data: normalize(b, 0.55), hit: 0 };
  },
  bubble: (o) => {
    const d = 0.16, f0 = o.pitch ?? 420;
    return { data: normalize(tone(d, (t) => f0 * (1 + 2.2 * (t / d) ** 0.6), bell(d, 0.15)), 0.7), hit: 0.02 };
  },
  notification: (o) => {
    const f = o.pitch ?? 880, b = buf(0.7);
    mixInto(b, tone(0.35, () => f, decay(0.003, 0.08)), 0.8);
    const second = tone(0.6, () => f * 1.5, decay(0.003, 0.14));
    mixInto(b.subarray(Math.round(0.11 * SR)), second, 0.8);
    return { data: normalize(b, 0.6), hit: 0.003 };
  },
  success: (o) => {
    const root = o.pitch ?? 523.25, d = 1.1, b = buf(d);
    [1, 1.26, 1.5, 2].forEach((m, k) => mixInto(b.subarray(Math.round(k * 0.075 * SR)), melodic(0.8, root * m, 0.18), 0.55));
    return { data: normalize(b, 0.6), hit: 0.003 };
  },
  error: (o) => {
    const d = 0.5, f = o.pitch ?? 185, b = buf(d);
    for (const off of [0, 0.2]) mixInto(b.subarray(Math.round(off * SR)), lowpass(osc(0.17, () => f, (t) => (t < 0.15 ? 1 : 0) * (t < 0.005 ? t / 0.005 : 1), 'square'), 1800), 0.5);
    return { data: normalize(b, 0.55), hit: 0 };
  },
  keyboard: (o, seed) => {
    const d = 0.07;
    const thock = tone(d, (t) => 260 + 400 * Math.exp(-t * 90), decay(0.0008, 0.01));
    mixInto(thock, applyEnv(bandpass(noise(d, seed), () => 2400 + Math.abs(rng(seed)()) * 1500, 3), decay(0.0004, 0.005)), 0.8);
    return { data: normalize(thock, 0.5), hit: 0 };
  },
  shutter: (o, seed) => {
    const d = 0.22, b = buf(d);
    for (const [off, f] of [[0, 2600], [0.085, 1800]]) mixInto(b.subarray(Math.round(off * SR)), applyEnv(bandpass(noise(0.08, seed + off * 100), () => f, 2.5), decay(0.0005, 0.012)), 1);
    return { data: normalize(b, 0.65), hit: 0 };
  },
  coin: (o) => {
    const f = o.pitch ?? 988, d = 0.55, b = buf(d);
    mixInto(b, osc(0.08, () => f, () => 0.5, 'square'), 1);
    mixInto(b.subarray(Math.round(0.08 * SR)), osc(0.47, () => f * 1.335, decay(0.001, 0.12), 'square'), 1);
    return { data: normalize(lowpass(b, 7000), 0.45), hit: 0 };
  },
  cash: (o, seed) => {
    const d = 1.3, b = buf(d);
    const rattle = applyEnv(bandpass(noise(0.25, seed), (t) => 3000 + 2000 * Math.sin(t * 90), 2), (t) => (Math.sin(t * 160) > 0 ? 1 : 0.3) * decay(0.002, 0.07)(t));
    mixInto(b, rattle, 0.7);
    mixInto(b.subarray(Math.round(0.12 * SR)), SOUNDS.ding({ pitch: 1975.5 }).data, 0.9);
    return { data: normalize(b, 0.6), hit: 0.12 };
  },
  toggle: (o, seed) => {
    const d = 0.1, b = buf(d);
    for (const [off, f] of [[0, 1500], [0.035, 2300]]) mixInto(b.subarray(Math.round(off * SR)), tone(0.03, () => f, decay(0.0005, 0.005)), 1);
    return { data: normalize(b, 0.45), hit: 0.035 };
  },

  // --- transitions and movement ---
  zap: (o) => {
    const d = o.duration ?? 0.25;
    const b = lowpass(osc(d, (t) => 2400 * Math.exp(-t * 14) + 90, decay(0.001, d / 3), 'saw'), 5000);
    return { data: normalize(b, 0.5), hit: 0 };
  },
  laser: (o) => {
    const d = 0.3, f0 = o.pitch ?? 1800;
    const b = osc(d, (t) => f0 * Math.exp(-t * 9) + 120, decay(0.001, 0.09), 'square');
    return { data: normalize(lowpass(b, 6000), 0.45), hit: 0 };
  },
  downlifter: (o, seed) => {
    const d = o.duration ?? 1.4;
    const n = bandpass(noise(d, seed), (t) => 6000 * (1 - t / d) ** 2 + 150, 1.8);
    mixInto(n, tone(d, (t) => 900 * (1 - t / d) ** 2 + 60, () => 0.25), 1);
    return { data: normalize(applyEnv(n, decay(0.01, d / 2.5)), 0.75), hit: 0.01 };
  },
  reverse: (o, seed) => {
    // a reversed cymbal: swells up and stops dead on the hit
    const d = o.duration ?? 1.2;
    const n = highpass(noise(d, seed), 3500);
    const b = applyEnv(n, (t) => (t / d) ** 3 * (t > d - 0.01 ? (d - t) / 0.01 : 1));
    return { data: normalize(b, 0.7), hit: d };
  },
  air: (o, seed) => {
    const d = o.duration ?? 0.8;
    const b = lowpass(bandpass(noise(d, seed), (t) => 500 + 900 * Math.sin((t / d) * Math.PI), 0.8), 2500);
    return { data: normalize(applyEnv(b, bell(d, 0.55)), 0.55), hit: d * 0.55 };
  },
  flyby: (o, seed) => {
    // passes in front of the camera: pitch drops as it goes by (doppler)
    const d = o.duration ?? 0.9;
    const n = bandpass(noise(d, seed), (t) => 600 + 2600 * Math.exp(-(((t / d) - 0.5) ** 2) / 0.03), 1.2);
    mixInto(n, osc(d, (t) => 260 * (t < d / 2 ? 1.25 : 0.8), () => 0.35, 'saw'), 0.5);
    return { data: normalize(applyEnv(lowpass(n, 6000), bell(d, 0.5)), 0.8), hit: d * 0.5 };
  },
  spin: (o, seed) => {
    const d = o.duration ?? 0.7;
    const b = bandpass(noise(d, seed), (t) => 1400 + 1100 * Math.sin(t * 2 * Math.PI * (6 + 10 * t / d)), 2.2);
    return { data: normalize(applyEnv(b, bell(d, 0.4)), 0.7), hit: d * 0.4 };
  },
  whistle: (o) => {
    const d = o.duration ?? 0.55, f0 = o.pitch ?? 700;
    const b = tone(d, (t) => f0 * (1 + 1.4 * (t / d) ** 1.4) * (1 + 0.01 * Math.sin(t * 40)), bell(d, 0.7));
    return { data: normalize(b, 0.45), hit: d * 0.7 };
  },

  // --- impacts and drums ---
  thud: (o) => {
    const d = 0.45;
    return { data: normalize(lowpass(tone(d, (t) => 70 + 60 * Math.exp(-t * 30), decay(0.003, 0.09)), 600), 0.9), hit: 0.003 };
  },
  punch: (o, seed) => {
    const d = 0.35;
    const body = tone(d, (t) => 90 + 160 * Math.exp(-t * 40), decay(0.001, 0.07));
    mixInto(body, applyEnv(lowpass(noise(d, seed), 3500), decay(0.0005, 0.02)), 0.9);
    return { data: normalize(body, 0.95), hit: 0.001 };
  },
  slam: (o, seed) => {
    const d = 1.0;
    const body = tone(d, (t) => 55 + 90 * Math.exp(-t * 25), decay(0.002, 0.16));
    mixInto(body, applyEnv(bandpass(noise(d, seed), () => 900, 0.7), decay(0.001, 0.06)), 1.1);
    mixInto(body, applyEnv(highpass(noise(d, seed + 9), 4000), decay(0.001, 0.12)), 0.25);
    return { data: normalize(body, 0.95), hit: 0.002 };
  },
  kick: (o) => {
    const d = 0.5;
    return { data: normalize(tone(d, (t) => 50 + 110 * Math.exp(-t * 35), decay(0.001, 0.13)), 0.95), hit: 0.001 };
  },
  snare: (o, seed) => {
    const d = 0.3;
    const b = tone(d, (t) => 190 + 40 * Math.exp(-t * 40), decay(0.001, 0.04));
    mixInto(b, applyEnv(highpass(noise(d, seed), 1500), decay(0.001, 0.07)), 1.2);
    return { data: normalize(b, 0.8), hit: 0.001 };
  },
  clap: (o, seed) => {
    const d = 0.35, b = buf(d), n = bandpass(noise(d, seed), () => 1300, 1.5);
    for (const off of [0, 0.011, 0.022]) mixInto(b.subarray(Math.round(off * SR)), applyEnv(n.slice(0), decay(0.0005, off === 0.022 ? 0.06 : 0.006)), 1);
    return { data: normalize(b, 0.75), hit: 0.022 };
  },
  hihat: (o, seed) => {
    const d = o.duration ?? 0.09;
    return { data: normalize(applyEnv(highpass(noise(d, seed), 7000), decay(0.0005, d / 4)), 0.45), hit: 0 };
  },
  cymbal: (o, seed) => {
    const d = o.duration ?? 2.2;
    const b = highpass(noise(d, seed), 4500);
    mixInto(b, bandpass(noise(d, seed + 3), () => 5200, 1.2), 0.6);
    applyEnv(b, decay(0.002, d / 4));
    return { data: normalize(b, 0.55), hit: 0.002 };
  },

  // --- musical and magic ---
  sparkle: (o, seed) => {
    const d = 1.0, r = rng(seed), b = buf(d);
    for (let k = 0; k < 9; k++) {
      const f = 2200 + Math.abs(r()) * 3800;
      mixInto(b.subarray(Math.round((k * 0.07 + Math.abs(r()) * 0.03) * SR)), tone(0.3, () => f, decay(0.001, 0.05)), 0.5 + Math.abs(r()) * 0.4);
    }
    return { data: normalize(b, 0.5), hit: 0 };
  },
  magic: (o) => {
    // a quick upward harp glissando with a shimmer tail
    const d = 1.4, b = buf(d), scale = [1, 1.125, 1.26, 1.5, 1.68, 2, 2.25, 2.52, 3, 3.36, 4];
    scale.forEach((m, k) => mixInto(b.subarray(Math.round(k * 0.035 * SR)), melodic(0.9, (o.pitch ?? 523.25) * m, 0.2), 0.4));
    return { data: normalize(b, 0.55), hit: scale.length * 0.035 };
  },
  drop: (o, seed) => {
    // bass drop: a sub that dives, for the big reveal
    const d = o.duration ?? 1.4;
    const b = tone(d, (t) => 30 + 180 * Math.exp(-t * 4), decay(0.004, d / 2.2));
    mixInto(b, applyEnv(lowpass(noise(d, seed), 300), decay(0.002, 0.2)), 0.5);
    return { data: normalize(b, 0.95), hit: 0.004 };
  },
  heartbeat: (o) => {
    const d = 0.75, b = buf(d), lub = tone(0.2, (t) => 55 + 40 * Math.exp(-t * 30), decay(0.004, 0.05));
    mixInto(b, lub, 1);
    mixInto(b.subarray(Math.round(0.22 * SR)), lub, 0.7);
    return { data: normalize(lowpass(b, 400), 0.95), hit: 0.004 };
  },
};

const SOUND_NAMES = Object.keys(SOUNDS);

// which sound an animation makes when sfx are automatic
const AUTO = {
  popIn: 'pop', wordsPop: 'pop', spin: 'pop', stamp: 'stamp', draw: 'swipe', slideUp: 'swoosh', glitch: 'glitch', rush: 'whoosh',
  zoomOut: 'impact', drop: 'impact',
  blurIn: 'swoosh', rise: 'swoosh', fadeUp: null, wordsUp: 'swoosh',
  slideLeft: 'swipe', slideRight: 'swipe', grow: 'swipe', growUp: 'swipe', wipe: 'swipe', wipeUp: 'swipe',
  typewriter: 'tick', letters: 'tick',
  slideDown: 'swoosh', growLeft: 'swipe', growDown: 'swipe', wipeLeft: 'swipe', wipeDown: 'swipe', unfold: 'air', iris: 'air',
  flip: 'swipe', flipUp: 'swipe', elastic: 'bubble', swing: 'swoosh', skewIn: 'whoosh', flicker: 'zap', focus: 'air',
  wordsRise: 'swoosh', wordsSlide: 'swoosh', wordsFlip: 'pop', lettersBlur: 'swoosh', cascade: 'tick',
};
const AUTO_TRANSITION = {
  circle: 'whoosh', fade: null, slide: 'whoosh', push: 'whoosh', slideUp: 'whoosh', zoom: 'whoosh', wipe: 'swoosh', blur: 'whoosh',
  slideDown: 'whoosh', pushUp: 'whoosh', whip: 'flyby', zoomIn: 'whoosh', wipeLeft: 'swoosh', wipeUp: 'swoosh', wipeDown: 'swoosh', barn: 'swoosh', fadeBlack: null, flash: 'impact',
};

function sfxOpts(v) {
  if (v == null || v === true) return null;
  if (v === false) return { off: true };
  if (typeof v === 'string') return { sound: v };
  return { ...v, sound: v.sound || v.name || v.effect };
}

// Every sound event of the video, in absolute seconds.
function buildEvents(spec) {
  const cfg = spec.sfx === true || spec.sfx === 'auto' ? { auto: true } : spec.sfx && typeof spec.sfx === 'object' ? spec.sfx : { auto: false };
  const auto = cfg.auto !== false && (spec.sfx === true || spec.sfx === 'auto' || cfg.auto === true);
  const events = [];
  const push = (t, sound, vol = 1, o = {}) => { if (t >= 0 && t <= spec.duration && SOUNDS[sound]) events.push({ t, sound, vol, o }); };

  const layerEvents = (L, base) => {
    const own = sfxOpts(L.sfx);
    if (own?.off) return;
    const t0 = base + (L.start ?? 0);
    if (own && own.sound) { push(t0 + (own.at ?? L.in?.delay ?? 0), own.sound, own.volume ?? 1, own); events[events.length - 1] && (events[events.length - 1].manual = true); return; }
    if (!auto || !L.in) return;
    const fx = enter[L.in.effect];
    const name = AUTO[L.in.effect];
    if (!fx || !name) return;
    const delay = L.in.delay ?? 0, dur = L.in.duration ?? fx.duration;
    const big = (L.size ?? 72) >= 140;
    if (name === 'stamp') { push(t0 + delay + dur * 0.5, 'impact', 0.55, { duration: 0.5 }); return; }
    if (name === 'impact') { if (big || L.in.effect === 'drop') push(t0 + delay + dur * (L.in.effect === 'drop' ? 0.36 : 0.55), 'impact', 0.7); else push(t0 + delay, 'swoosh', 0.5); return; }
    if (name === 'tick') {
      // one tick per character for typewriter; letters get a light tick every 2 characters
      const chars = Array.from(String(L.text ?? '')).filter((c) => c.trim()).length || 1;
      const tm = splitTiming(fx, L.in, chars);
      const every = L.in.effect === 'letters' ? 2 : 1;
      for (let i = 0; i < chars; i += every) push(t0 + delay + i * tm.stagger, 'tick', 0.6, { pitch: 1900 + (i % 3) * 120 });
      return;
    }
    if (name === 'pop' && fx.split) {
      const words = String(L.text ?? '').split(/\s+/).filter(Boolean).length || 1;
      const tm = splitTiming(fx, L.in, words);
      for (let i = 0; i < words; i++) push(t0 + delay + i * tm.stagger + 0.03, 'pop', 0.6, { pitch: 850 + (i % 4) * 90 });
      return;
    }
    push(t0 + delay + (name === 'pop' ? 0.02 : 0), name, name === 'swipe' ? 0.45 : 0.55);
  };

  // children of groups/phones, cursor taps
  const childEvents = (L, base) => {
    const t0 = base + (L.start ?? 0);
    if (L.type === 'cursor' && auto && !sfxOpts(L.sfx)?.off) for (const p of L.path || L.taps || []) if (p.tap) push(t0 + (p.t ?? 0), 'click', 0.8);
    if (L.type === 'group' || L.type === 'phone') for (const C of L.layers || []) { layerEvents(C, t0); counterEvents(C, t0); childEvents(C, t0); }
  };

  const counterEvents = (L, base) => {
    if (!auto || L.type !== 'counter' || sfxOpts(L.sfx)?.off) return;
    const t0 = base + (L.start ?? 0) + (L.countDelay ?? L.in?.delay ?? 0);
    const d = L.countDuration ?? 1.6;
    // ticks follow the number: fast at the start, slowing down, then a ding
    let last = -1;
    for (let k = 0; k <= 60; k++) {
      const p = easings.expoOut(k / 60);
      if (p > 0.97) break;
      const step = Math.floor(p * 14);
      if (step !== last) { push(t0 + (k / 60) * d, 'tick', 0.5, { pitch: 1700 + step * 40 }); last = step; }
    }
    push(t0 + d * 0.95, 'ding', 0.35);
  };

  spec.scenes.forEach((S, i) => {
    const own = sfxOpts(S.sfx);
    if (S.transition && !own?.off) {
      const sound = own?.sound || (auto ? AUTO_TRANSITION[S.transition.type] : null);
      if (sound) { const o = { duration: Math.max(0.35, S.transition.duration + 0.15) }; const hit = SOUNDS[sound](o, 1).hit; push(S.start + S.transition.duration * 0.5 - hit, sound, own?.volume ?? 0.6, o); }
    }
    // a light sound right inside the transition would just blur into the whoosh
    const quietUntil = S.transition ? S.start + S.transition.duration : -1;
    const before = events.length;
    for (const L of S.layers) { layerEvents(L, S.start); counterEvents(L, S.start); childEvents(L, S.start); }
    for (let k = events.length - 1; k >= before; k--) {
      const e = events[k];
      if (e.t < quietUntil && (e.sound === 'swoosh' || e.sound === 'swipe') && !e.manual) events.splice(k, 1);
    }
  });
  for (const L of spec.layers) { layerEvents(L, 0); counterEvents(L, 0); childEvents(L, 0); }
  for (const s of spec.sounds || []) push(s.at ?? 0, s.sound, s.volume ?? 1, s);

  // keep it clean: the same sound can't retrigger closer than 40 ms
  events.sort((a, b) => a.t - b.t);
  const lastBy = {};
  return events.filter((e) => { const ok = lastBy[e.sound] == null || e.t - lastBy[e.sound] >= 0.04; if (ok) lastBy[e.sound] = e.t; return ok; });
}

// Render all events into one stereo 16-bit WAV.
function renderTrack(spec, events) {
  const master = (spec.sfx && typeof spec.sfx === 'object' ? spec.sfx.volume : null) ?? 0.8;
  const mix = new Float32Array(Math.ceil((spec.duration + 0.05) * SR));
  const cache = new Map();
  events.forEach((e, idx) => {
    const key = e.sound + JSON.stringify(e.o) + (['whoosh', 'swoosh', 'swipe', 'impact', 'boom', 'riser', 'glitch', 'click', 'tap', 'keyboard', 'shutter', 'air', 'flyby', 'spin', 'punch', 'slam', 'snare', 'clap', 'hihat', 'sparkle'].includes(e.sound) ? idx % 4 : '');
    let s = cache.get(key);
    if (!s) { s = SOUNDS[e.sound](e.o || {}, 1234 + (idx % 4) * 77); cache.set(key, s); }
    const off = Math.round(e.t * SR);
    for (let i = 0; i < s.data.length; i++) { const j = off + i; if (j >= 0 && j < mix.length) mix[j] += s.data[i] * e.vol * master; }
  });
  // short fade at the very end so nothing clicks when the video stops
  const fade = Math.round(0.03 * SR);
  for (let i = 0; i < fade; i++) mix[mix.length - 1 - i] *= i / fade;
  const n = mix.length, bufOut = Buffer.alloc(44 + n * 4);
  bufOut.write('RIFF', 0); bufOut.writeUInt32LE(36 + n * 4, 4); bufOut.write('WAVE', 8);
  bufOut.write('fmt ', 12); bufOut.writeUInt32LE(16, 16); bufOut.writeUInt16LE(1, 20); bufOut.writeUInt16LE(2, 22);
  bufOut.writeUInt32LE(SR, 24); bufOut.writeUInt32LE(SR * 4, 28); bufOut.writeUInt16LE(4, 32); bufOut.writeUInt16LE(16, 34);
  bufOut.write('data', 36); bufOut.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.tanh(mix[i] * 1.1) * 32000); // soft limiter
    bufOut.writeInt16LE(v, 44 + i * 4); bufOut.writeInt16LE(v, 46 + i * 4);
  }
  return bufOut;
}

function hasSfx(spec) {
  if (spec.sfx === true || spec.sfx === 'auto' || (spec.sfx && typeof spec.sfx === 'object' && spec.sfx.auto)) return true;
  if ((spec.sounds || []).length) return true;
  const own = (L) => L.sfx && L.sfx !== false;
  return spec.scenes.some((S) => (S.sfx && S.sfx !== false) || S.layers.some(own)) || spec.layers.some(own);
}

module.exports = { SOUND_NAMES, SOUNDS, buildEvents, renderTrack, hasSfx, SR };
