'use strict';
// The "Lampo" watermark on videos that aren't paid for (Lampo Cloud without credits, the playground).
// It is added as the last global layers, so it is drawn on top of everything in the spec.
const LAYERS = [
  // big diagonal mark across the frame: white with a dark outline, readable on any background
  { type: 'text', text: 'LAMPO', size: 240, weight: 900, letterSpacing: 18, color: '#ffffff', stroke: { color: 'rgba(0,0,0,0.85)', width: 6 }, opacity: 0.2, rotate: -24, wrap: false, fit: false, sfx: false },
  // corner badge
  { type: 'text', text: 'Made with Lampo', icon: 'bolt', iconScale: 0.8, size: 30, weight: 700, color: '#111111', bg: { color: '#FFE14D', radius: 30, padding: 16 }, x: '94%', y: '94%', anchor: 'bottom-right', opacity: 0.95, sfx: false },
];

/** A copy of the spec with the watermark on top. */
function watermark(spec) {
  const s = typeof spec === 'string' ? JSON.parse(spec) : JSON.parse(JSON.stringify(spec));
  s.layers = [...(Array.isArray(s.layers) ? s.layers : []), ...LAYERS.map((L) => ({ ...L, _watermark: true }))];
  return s;
}

module.exports = { watermark, WATERMARK_LAYERS: LAYERS };
