'use strict';
// Rebuilds the demo media of the README (media/*.gif) and of the site (docs/media/*.mp4, posters)
// from specs in the repo, so every demo is reproducible:
//   node scripts/build-media.js            all
//   node scripts/build-media.js styles     only some: showreel, styles, blueprints, sfx
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const lampo = require('..');
const { ffmpegPath } = require('../src/ffmpeg');
const { SOUND_NAMES } = require('../src/sfx');

const ROOT = path.join(__dirname, '..');
const GIF_DIR = path.join(ROOT, 'media');
const SITE_DIR = path.join(ROOT, 'docs/media');
const REF = path.join(ROOT, 'skills/lampo/references');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lampo-media-'));
const ff = (args) => execFileSync(ffmpegPath(), ['-loglevel', 'error', '-y', ...args]);

// the ```json blocks of a reference file, keyed by the heading above them
function snippets(file) {
  const md = fs.readFileSync(path.join(REF, file), 'utf8');
  const out = {};
  let title = '';
  for (const m of md.matchAll(/^#{2,3} (?:\d+\. )?(.*)$|```json\n([\s\S]*?)```/gm)) {
    if (m[1]) title = m[1].trim();
    else out[title] = JSON.parse(m[2]);
  }
  return out;
}
const asSpec = (o) => (o.scenes ? { format: '9:16', ...o } : { format: '9:16', scenes: [o] });

// snippets point to a placeholder photo: use the repo's b-roll instead
function withBroll(spec) {
  const s = JSON.parse(JSON.stringify(spec));
  for (const S of s.scenes) if (S.background?.type === 'image') S.background = { type: 'video', src: path.join(ROOT, 'examples/media/abstract.mp4'), overlay: S.background.overlay, rate: 0.7 };
  return s;
}

function gif(mp4, out, { fps = 12, width } = {}) {
  const scale = width ? `scale=${width}:-1:flags=lanczos,` : '';
  ff(['-i', mp4, '-vf', `fps=${fps},${scale}split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, '-loop', '0', out]);
}
const poster = (mp4, out, t) => ff(['-ss', String(t), '-i', mp4, '-frames:v', '1', '-q:v', '3', out]);

// a grid video from tiles of equal size, each looped/held to the same length
function grid(tiles, cols, out, dur) {
  const rows = Math.ceil(tiles.length / cols);
  const inputs = tiles.flatMap((t) => ['-i', t]);
  const pads = tiles.map((_, i) => `[${i}:v]tpad=stop_mode=clone:stop_duration=${dur},trim=duration=${dur},setpts=PTS-STARTPTS,fps=30[v${i}]`);
  const w = `w0`, h = `h0`;
  const layout = tiles.map((_, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = c === 0 ? '0' : Array.from({ length: c }, () => w).join('+');
    const y = r === 0 ? '0' : Array.from({ length: r }, () => h).join('+');
    return `${x}_${y}`;
  }).join('|');
  const filter = `${pads.join(';')};${tiles.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${tiles.length}:layout=${layout}:fill=black[out]`;
  ff([...inputs, '-filter_complex', filter, '-map', '[out]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'veryfast', '-movflags', '+faststart', out]);
  return rows;
}

async function tile(spec, name, scale) {
  const out = path.join(TMP, `${name}.mp4`);
  await lampo.render({ ...withBroll(spec), sfx: false, scale, fps: 30 }, out, { baseDir: ROOT });
  return out;
}

const jobs = {
  async showreel() {
    for (const [src, name] of [['examples/showreel.json', 'showreel'], ['examples/it/showreel.json', 'showreel-it']]) {
      const spec = JSON.parse(fs.readFileSync(path.join(ROOT, src), 'utf8'));
      const mp4 = path.join(SITE_DIR, `${name}.mp4`);
      await lampo.render(spec, mp4, { baseDir: path.dirname(path.join(ROOT, src)) });
      poster(mp4, path.join(SITE_DIR, `${name}-poster.jpg`), 4.6);
      const small = path.join(TMP, `${name}-small.mp4`);
      await lampo.render({ ...spec, sfx: false, scale: 0.25 }, small, { baseDir: path.dirname(path.join(ROOT, src)) });
      gif(small, path.join(GIF_DIR, `${name}.gif`), { fps: 12 });
    }
  },
  async styles() {
    const s = snippets('visual-styles.md');
    const names = Object.keys(s);
    const tiles = [];
    for (const [i, n] of names.entries()) tiles.push(await tile(asSpec(s[n]), `style-${i}`, 1 / 6));
    const mp4 = path.join(SITE_DIR, 'styles.mp4');
    grid(tiles, 3, mp4, 4);
    poster(mp4, path.join(SITE_DIR, 'styles-poster.jpg'), 3.2);
    gif(mp4, path.join(GIF_DIR, 'styles.gif'), { fps: 12 });
    console.log('styles:', names.join(', '));
  },
  async blueprints() {
    const s = snippets('blueprints.md');
    const pick = ['kinetic-slam', 'morph-lockup', 'ticker-takeover', 'stat-hit', 'grid-assemble', 'app-demo', 'camera-pan', 'cta-press'];
    const tiles = [];
    for (const n of pick) { if (!s[n]) throw new Error(`blueprint ${n} not found`); tiles.push(await tile(asSpec(s[n]), `bp-${n}`, 0.185)); }
    const mp4 = path.join(SITE_DIR, 'blueprints.mp4');
    grid(tiles, 4, mp4, 5);
    poster(mp4, path.join(SITE_DIR, 'blueprints-poster.jpg'), 4);
    gif(mp4, path.join(GIF_DIR, 'blueprints.gif'), { fps: 12 });
  },
  async sfx() {
    // every sound, one per beat, with its name on screen (this one is meant to be heard)
    const long = ['cymbal', 'reverse', 'downlifter', 'magic', 'cash', 'drop', 'boom', 'riser', 'chime', 'ding'];
    const spec = {
      format: '1:1', fps: 30, sfx: true,
      theme: { font: 'Inter', color: '#ffffff', accent: '#FFD60A' },
      scenes: SOUND_NAMES.map((n, i) => ({
        duration: long.includes(n) ? 1.5 : 0.85,
        background: { type: 'glow', base: '#07070b', colors: ['#FFD60A', '#3a3aff'], intensity: 0.3, speed: 0.3 },
        layers: [
          { text: `${String(i + 1).padStart(2, '0')} / ${SOUND_NAMES.length}`, size: 34, weight: 600, letterSpacing: 6, color: '#8e8e93', y: '40%' },
          { text: n, size: 140, weight: 900, y: '52%', in: { effect: 'popIn', duration: 0.3 }, sfx: { sound: n, at: ['reverse', 'riser'].includes(n) ? 0 : 0.12 } },
        ],
      })),
    };
    const mp4 = path.join(SITE_DIR, 'sfx.mp4');
    await lampo.render({ ...spec, scale: 0.6 }, mp4);
    poster(mp4, path.join(SITE_DIR, 'sfx-poster.jpg'), 0.5);
  },
};

(async () => {
  const want = process.argv.slice(2);
  fs.mkdirSync(GIF_DIR, { recursive: true });
  fs.mkdirSync(SITE_DIR, { recursive: true });
  for (const [name, job] of Object.entries(jobs)) {
    if (want.length && !want.includes(name)) continue;
    const t = Date.now();
    await job();
    console.log(`✓ ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  }
  fs.rmSync(TMP, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
