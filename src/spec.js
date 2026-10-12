'use strict';
// Normalizes and validates the video spec. Errors are written for an AI agent:
// they say what is wrong and how to fix it, so it gets fixed on the first retry.

const fs = require('fs');
const path = require('path');
const { enter, loop, transitions } = require('./effects');
const { easings } = require('./easing');
const { SOUND_NAMES } = require('./sfx');
const { PRESETS } = require('./shapes');

const FORMATS = {
  '9:16': [1080, 1920], reel: [1080, 1920], story: [1080, 1920], tiktok: [1080, 1920],
  '1:1': [1080, 1080], square: [1080, 1080],
  '4:5': [1080, 1350], post: [1080, 1350],
  '16:9': [1920, 1080], youtube: [1920, 1080], landscape: [1920, 1080],
};

const QUALITY = {
  draft:    { scale: 0.5, crf: 28, preset: 'ultrafast' },
  standard: { scale: 1,   crf: 20, preset: 'veryfast' },
  high:     { scale: 1,   crf: 16, preset: 'medium' },
};

const LAYER_TYPES = ['text', 'rect', 'circle', 'image', 'video', 'counter', 'line', 'path', 'group', 'phone', 'cursor'];

class SpecError extends Error {
  constructor(problems) {
    super('Invalid spec:\n- ' + problems.join('\n- '));
    this.problems = problems;
  }
}

function fxOpts(v, kind) {
  if (v == null || v === false) return null;
  if (typeof v === 'string') return { effect: v };
  if (typeof v === 'object') return { ...v, effect: v.effect || v.name || v.type };
  throw new Error(`${kind} must be a string or an object`);
}

// Lenient JSON: accepts // and /* */ comments and trailing commas, common LLM mistakes
function parseLoose(text) {
  try { return JSON.parse(text); } catch (first) {
    let out = '', i = 0, inStr = false;
    while (i < text.length) {
      const c = text[i], n = text[i + 1];
      if (inStr) { out += c; if (c === '\\') { out += n; i += 2; continue; } if (c === '"') inStr = false; i++; continue; }
      if (c === '"') { inStr = true; out += c; i++; continue; }
      if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
      if (c === '/' && n === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; continue; }
      out += c; i++;
    }
    out = out.replace(/,(\s*[}\]])/g, '$1');
    try { return JSON.parse(out); } catch { throw new SpecError([`Invalid JSON: ${first.message}`]); }
  }
}

function normalize(input, { baseDir = process.cwd() } = {}) {
  const spec = typeof input === 'string' ? parseLoose(input) : JSON.parse(JSON.stringify(input));
  const problems = [];

  let [w, h] = FORMATS[spec.format || '9:16'] || [];
  if (!w) {
    problems.push(`unknown format "${spec.format}". Use one of: ${Object.keys(FORMATS).join(', ')} (or width/height)`);
    [w, h] = FORMATS['9:16'];
  }
  spec.width = spec.width || w;
  spec.height = spec.height || h;
  spec.fps = spec.fps || 30;
  if (spec.fps < 1 || spec.fps > 120) problems.push('fps must be between 1 and 120');
  spec.quality = spec.quality || 'standard';
  if (!QUALITY[spec.quality]) problems.push('quality must be draft, standard or high');
  spec.theme = { font: 'Inter', color: '#ffffff', accent: '#0A84FF', background: '#000000', ...(spec.theme || {}) };
  spec.baseDir = spec.baseDir || baseDir;
  const resolve = (p) => (!p || /^(data:|https?:)/.test(p) || path.isAbsolute(p) ? p : path.resolve(spec.baseDir, p));
  spec.fonts = (spec.fonts || []).map((f) => ({ ...f, path: resolve(f.path) }));
  if (spec.audio) spec.audio = typeof spec.audio === 'string' ? { src: resolve(spec.audio) } : { ...spec.audio, src: resolve(spec.audio.src) };

  if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) {
    problems.push('at least one scene is required: "scenes": [{ "duration": 3, "layers": [...] }]');
    spec.scenes = [];
  }

  const checkFile = (f, where) => {
    if (f && !/^(data:|https?:)/.test(f) && !fs.existsSync(f)) problems.push(`${where}: file not found: ${f}`);
  };
  const checkSound = (v, where) => {
    if (v == null || typeof v === 'boolean' || v === 'auto') return;
    const name = typeof v === 'string' ? v : v.sound || v.name || v.effect;
    if (!SOUND_NAMES.includes(name)) problems.push(`${where}: sound "${name}" does not exist. Sounds: ${SOUND_NAMES.join(', ')}`);
  };
  checkSound(spec.sfx && typeof spec.sfx === 'object' ? null : spec.sfx, 'sfx');
  spec.sounds = spec.sounds || [];
  spec.sounds.forEach((x, i) => { checkSound(x, `sounds[${i}]`); if (!(x.at >= 0)) problems.push(`sounds[${i}]: "at" (seconds) is required`); });

  const checkLayer = (L, where) => {
    if (!L.type) L.type = L.text != null ? 'text' : L.path || L.taps ? 'cursor' : L.shape || L.d ? 'path' : L.layers ? 'group' : L.src ? (/\.(mp4|mov|m4v|webm|mkv|avi)(\?|$)/i.test(L.src) ? 'video' : 'image') : 'rect';
    if (!LAYER_TYPES.includes(L.type)) problems.push(`${where}: type "${L.type}" does not exist. Types: ${LAYER_TYPES.join(', ')}`);
    if (L.type === 'text' && (L.text == null || L.text === '')) problems.push(`${where}: a text layer needs "text"`);
    if (L.type === 'image' || L.type === 'video') {
      if (!L.src) problems.push(`${where}: an ${L.type} layer needs "src"`);
      else { L.src = resolve(L.src); checkFile(L.src, where); }
    }
    if (L.type === 'video' && L.rate != null && !(L.rate > 0)) problems.push(`${where}: "rate" must be > 0 (0.5 = slow motion, 2 = double speed)`);
    if (L.type === 'counter' && L.to == null) problems.push(`${where}: a counter needs "to" (and optionally "from")`);
    if (L.type === 'path') {
      if (!L.d && !L.shape) problems.push(`${where}: a path needs "shape" (${Object.keys(PRESETS).join(', ')}) or an SVG "d"`);
      if (L.shape && !PRESETS[L.shape]) problems.push(`${where}: shape "${L.shape}" does not exist. Shapes: ${Object.keys(PRESETS).join(', ')}`);
    }
    if (L.type === 'cursor') {
      const pts = L.path || L.taps;
      if (!Array.isArray(pts) || !pts.length) problems.push(`${where}: a cursor needs "path": [{ "t": 0, "x": 200, "y": 400 }, { "t": 0.8, "x": 300, "y": 500, "tap": true }]`);
      else pts.forEach((pt, k) => { if (pt.x == null || pt.y == null) problems.push(`${where}.path[${k}]: needs "x" and "y"`); });
    }
    if (L.type === 'phone' && L.src) { L.src = resolve(L.src); checkFile(L.src, where); }
    if (Array.isArray(L.keyframes)) L.keyframes.forEach((k, j) => { if (k.t == null) problems.push(`${where}.keyframes[${j}]: needs "t" (seconds from the layer start)`); });
    if (L.type === 'group' || L.type === 'phone') {
      L.layers = L.layers || [];
      L.layers.forEach((C, j) => checkLayer(C, `${where}.layers[${j}]`));
    }
    for (const k of ['in', 'out']) {
      try { L[k] = fxOpts(L[k], k); } catch (e) { problems.push(`${where}.${k}: ${e.message}`); L[k] = null; }
      if (L[k] && !enter[L[k].effect]) problems.push(`${where}.${k}: effect "${L[k].effect}" does not exist. Effects: ${Object.keys(enter).join(', ')}`);
      if (L[k] && enter[L[k].effect]?.split && !['text', 'counter'].includes(L.type)) problems.push(`${where}.${k}: "${L[k].effect}" only works on text and counter layers`);
      if (L[k] && L[k].easing && typeof L[k].easing === 'string' && !easings[L[k].easing]) problems.push(`${where}.${k}: easing "${L[k].easing}" does not exist. Use: ${Object.keys(easings).join(', ')}`);
    }
    // on a video, "loop": true/false means "repeat the clip", not a loop animation
    if (L.type === 'video' && typeof L.loop === 'boolean') { L.clipLoop = L.loop; delete L.loop; }
    checkSound(L.sfx, `${where}.sfx`);
    const loops = L.loop == null ? [] : Array.isArray(L.loop) ? L.loop : [L.loop];
    L.loop = loops.map((x) => fxOpts(x, 'loop'));
    for (const lp of L.loop) if (!loop[lp.effect]) problems.push(`${where}.loop: "${lp.effect}" does not exist. Loops: ${Object.keys(loop).join(', ')}`);
  };

  // timeline: scenes play in order; the next scene's transition overlaps
  let cursor = 0;
  spec.scenes.forEach((S, i) => {
    const where = `scenes[${i}]`;
    if (!(S.duration > 0)) problems.push(`${where}: "duration" (seconds) is required and must be > 0`);
    S.duration = S.duration > 0 ? S.duration : 1;
    let tr = S.transition == null ? null : typeof S.transition === 'string' ? { type: S.transition } : { ...S.transition };
    if (tr && !transitions.includes(tr.type)) { problems.push(`${where}.transition: "${tr.type}" does not exist. Use: ${transitions.join(', ')}`); tr = null; }
    if (i === 0 || !tr || tr.type === 'none') tr = null;
    else tr.duration = Math.min(tr.duration ?? 0.6, S.duration * 0.5, spec.scenes[i - 1].duration * 0.5);
    S.transition = tr;
    S.start = Math.max(0, cursor - (tr ? tr.duration : 0));
    S.end = S.start + S.duration;
    cursor = S.end;
    checkSound(S.sfx, `${where}.sfx`);
    if (S.background && typeof S.background === 'object' && !Array.isArray(S.background) && S.background.src) { S.background = { ...S.background, src: resolve(S.background.src) }; checkFile(S.background.src, `${where}.background`); }
    S.layers = S.layers || [];
    S.layers.forEach((L, j) => checkLayer(L, `${where}.layers[${j}]`));
  });
  spec.duration = cursor;
  if (spec.duration > 600) problems.push('maximum duration is 600 seconds');

  // global layers (logo, watermark, captions): absolute times over the whole video
  spec.layers = spec.layers || [];
  spec.layers.forEach((L, j) => checkLayer(L, `layers[${j}]`));

  if (problems.length) throw new SpecError(problems);
  const q = QUALITY[spec.quality];
  spec.outScale = spec.scale || q.scale;
  spec.outWidth = Math.round((spec.width * spec.outScale) / 2) * 2;
  spec.outHeight = Math.round((spec.height * spec.outScale) / 2) * 2;
  spec.encode = { crf: spec.crf ?? q.crf, preset: q.preset };
  spec.totalFrames = Math.max(1, Math.round(spec.duration * spec.fps));
  return spec;
}

module.exports = { normalize, parseLoose, SpecError, FORMATS, QUALITY, LAYER_TYPES };
