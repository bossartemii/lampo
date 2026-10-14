'use strict';
// Builds the browser version of Lampo for the playground (docs/playground/):
//   lampo.js       the engine (src/) bundled for the browser, with web/shims for canvas, video, fs, path
//   examples.json  the repo examples, the 16 blueprints and the 9 styles, ready to load in the editor
//   media/         the clips those examples use
// Run: node scripts/build-web.js   (also part of npm run build:web)
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs/playground');
const shim = (n) => path.join(ROOT, 'web/shims', n);

// the engine requires Node modules by name or by relative path: point them to the browser shims
const shims = {
  name: 'lampo-shims',
  setup(b) {
    b.onResolve({ filter: /^@napi-rs\/canvas$/ }, () => ({ path: shim('canvas.js') }));
    b.onResolve({ filter: /^(fs|path)$/ }, (a) => ({ path: shim(`${a.path}.js`) }));
    b.onResolve({ filter: /^\.\/video$/ }, (a) => (a.importer.startsWith(path.join(ROOT, 'src')) ? { path: shim('video.js') } : undefined));
    b.onResolve({ filter: /^(child_process|os|worker_threads|crypto|http)$/ }, (a) => { throw new Error(`browser bundle pulled in Node module "${a.path}" from ${a.importer}`); });
  },
};

function snippets(file) {
  const md = fs.readFileSync(path.join(ROOT, 'skills/lampo/references', file), 'utf8');
  const out = [];
  let title = '';
  for (const m of md.matchAll(/^#{2,3} (?:\d+\. )?(.*)$|```json\n([\s\S]*?)```/gm)) {
    if (m[1]) title = m[1].trim();
    else out.push({ name: title, spec: JSON.parse(m[2]) });
  }
  return out;
}

// placeholder photos in the snippets become the repo's b-roll clip
function webMedia(spec) {
  const s = JSON.parse(JSON.stringify(spec));
  for (const S of s.scenes) {
    const bg = S.background;
    if (bg && typeof bg === 'object' && !Array.isArray(bg) && bg.src) {
      if (bg.type === 'image') S.background = { type: 'video', src: 'media/abstract.mp4', overlay: bg.overlay, rate: 0.7 };
      else S.background = { ...bg, src: `media/${path.basename(bg.src)}` };
    }
  }
  return s;
}
const asSpec = (o) => (o.scenes ? { format: '9:16', ...o } : { format: '9:16', scenes: [o] });
const id = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

(async () => {
  fs.mkdirSync(path.join(OUT, 'media'), { recursive: true });
  const r = await esbuild.build({
    entryPoints: [path.join(ROOT, 'web/entry.js')],
    bundle: true,
    format: 'iife',
    globalName: 'Lampo',
    platform: 'browser',
    target: ['chrome110', 'safari16', 'firefox115'],
    minify: true,
    legalComments: 'none',
    banner: { js: '/* Lampo for the browser — Apache-2.0 — https://github.com/bossartemii/lampo */\nvar process = { cwd: function () { return ""; }, env: {} };' },
    plugins: [shims],
    outfile: path.join(OUT, 'lampo.js'),
    metafile: true,
  });
  const size = Object.values(r.metafile.outputs)[0].bytes;

  const examples = [];
  const add = (group, name, spec) => examples.push({ id: `${id(group)}-${id(name)}`, group, name, spec: webMedia(asSpec(spec)) });
  for (const f of ['showreel', 'coffee', 'launch', 'broll', 'starter']) add('Examples', f, JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', `${f}.json`), 'utf8')));
  for (const f of fs.readdirSync(path.join(ROOT, 'examples/it')).filter((n) => n.endsWith('.json')).sort()) add('Esempi in italiano', f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/it', f), 'utf8')));
  for (const b of snippets('blueprints.md')) add('Blueprints', b.name, b.spec);
  for (const s of snippets('visual-styles.md')) add('Styles', s.name, s.spec);
  fs.writeFileSync(path.join(OUT, 'examples.json'), JSON.stringify(examples));
  fs.copyFileSync(path.join(ROOT, 'examples/media/abstract.mp4'), path.join(OUT, 'media/abstract.mp4'));
  // browsers without H.264 decoding load the WebM copy (see web/shims/video.js)
  const { ffmpegPath } = require('../src/ffmpeg');
  require('child_process').execFileSync(ffmpegPath(), ['-loglevel', 'error', '-y', '-i', path.join(ROOT, 'examples/media/abstract.mp4'), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-an', path.join(OUT, 'media/abstract.webm')]);
  console.log(`✓ docs/playground/lampo.js ${(size / 1024).toFixed(0)} KB · ${examples.length} examples`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
