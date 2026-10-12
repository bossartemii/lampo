'use strict';
// Comparison benchmark: the same ad (examples/it/pizzeria.json) made with the BROWSER METHOD,
// the pipeline behind Remotion and HyperFrames: an animated HTML/CSS page in headless
// Chrome; for every frame the animations are seeked, screenshotted and piped to ffmpeg.
// This is not their actual tooling, it is the same underlying pipeline.
//
// usage: node bench/browser-baseline.js [tabs]   (CHROME=/path/to/chrome)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require(process.env.PUPPETEER || 'puppeteer');
const { ffmpegPath, run } = require('../src/ffmpeg');

const W = 1080, H = 1920, FPS = 30, DUR = 10.9;
const TABS = Number(process.argv[2]) || os.cpus().length;

const css = `
*{margin:0;box-sizing:border-box} body{width:${W}px;height:${H}px;overflow:hidden;background:#000;font-family:Inter,sans-serif;color:#fff}
.scene{position:absolute;inset:0;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.glow{background:#0b0603}
.blob{position:absolute;width:2100px;height:2100px;border-radius:50%;mix-blend-mode:screen;opacity:.55;left:-510px;top:-90px}
.b1{background:radial-gradient(circle,#FF6B00,transparent 70%);animation:d1 12s linear infinite}
.b2{background:radial-gradient(circle,#FF2D55,transparent 70%);animation:d2 12s linear infinite}
.b3{background:radial-gradient(circle,#FFB800,transparent 70%);animation:d3 12s linear infinite}
@keyframes d1{to{transform:translate(300px,-500px)}} @keyframes d2{to{transform:translate(-300px,400px)}} @keyframes d3{to{transform:translate(200px,600px)}}
.vig{position:absolute;inset:0;background:radial-gradient(circle,transparent 35%,rgba(0,0,0,.55) 75%)}
h1{position:relative;font-weight:900}
.acc{color:#FF9F0A}
@keyframes blurIn{from{opacity:0;filter:blur(26px);transform:scale(1.05)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(70px);filter:blur(10px)}}
@keyframes rise{from{transform:translateY(110%)}}
@keyframes pop{0%{opacity:0;transform:scale(0)}70%{transform:scale(1.1)}100%{opacity:1;transform:scale(1)}}
@keyframes grow{from{transform:scaleX(0)}}
@keyframes pulse{50%{transform:scale(1.04)}}
@keyframes show{0%,100%{opacity:1}}
.line{overflow:hidden;display:block;line-height:1.12}.line span{display:inline-block;animation:rise .9s cubic-bezier(.22,1,.36,1) both}
`;

const html = `<!doctype html><html><head><meta charset=utf-8><style>${css}</style></head><body>
<div class="scene glow" style="animation:show 3s 0s linear" data-start="0"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
  <h1 style="font-size:220px;animation:blurIn .9s cubic-bezier(.22,1,.36,1) both, pulse 1.2s infinite">Fame?</h1>
  <h1 style="font-size:78px;font-weight:600;margin-top:60px;animation:fadeUp .7s .6s cubic-bezier(.22,1,.36,1) both">Ci pensiamo <span class=acc>noi</span>.</h1><div class=vig></div></div>
<div class="scene" style="background:linear-gradient(160deg,#1a0b02,#3d1402);animation:show 3.2s 2.4s linear" data-start="2.4">
  <h1 style="font-size:104px;font-weight:800"><span class=line><span>Pizza napoletana</span></span><span class=line><span style="animation-delay:.12s">cotta nel forno</span></span><span class=line><span style="animation-delay:.24s">a <span class=acc>legna</span></span></span></h1>
  <div style="width:360px;height:10px;border-radius:5px;background:#FF9F0A;margin-top:120px;transform-origin:left;animation:grow .8s .9s both"></div><div class=vig></div></div>
<div class="scene" style="background:#0d0d0d;animation:show 3s 5s linear" data-start="5">
  <h1 style="font-size:240px;background:linear-gradient(135deg,#FFD60A,#FF6B00);-webkit-background-clip:text;color:transparent;animation:pop .6s both">20 min</h1>
  <h1 style="font-size:70px;font-weight:500;color:#d4d4d8;animation:fadeUp .7s .4s both">consegna a casa tua</h1><div class=vig></div></div>
<div class="scene glow" style="animation:show 3.5s 7.4s linear" data-start="7.4"><div class="blob b1"></div><div class="blob b2"></div>
  <h1 style="font-size:150px;letter-spacing:12px;text-shadow:0 0 40px rgba(255,159,10,.6);animation:pop .6s both">DA GINO</h1>
  <h1 style="font-size:60px;font-weight:500;animation:fadeUp .7s .7s both">Pizzeria · Brescia</h1>
  <h1 style="font-size:64px;font-weight:700;color:#111;background:#FF9F0A;border-radius:60px;padding:24px 50px;margin-top:150px;animation:pop .6s 1.1s both, pulse 1.2s 1.7s infinite">Ordina ora →</h1>
  <h1 style="font-size:52px;font-weight:600;color:#a1a1aa;margin-top:60px;animation:fadeUp .9s 1.5s both">030 123 4567</h1><div class=vig></div></div>
</body></html>`;

async function renderRange(browser, from, to, out) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const ff = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', String(FPS), '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const done = new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))));
  for (let i = from; i < to; i++) {
    const ms = (i / FPS) * 1000;
    await page.evaluate((t) => {
      for (const sc of document.querySelectorAll('.scene')) {
        const st = parseFloat(sc.dataset.start) * 1000;
        for (const a of sc.getAnimations({ subtree: true })) a.currentTime = a.effect.target === sc ? t : t - st;
      }
    }, ms);
    const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  await page.close();
}

(async () => {
  const t0 = Date.now();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME,
    headless: 'shell',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--font-render-hinting=none'],
  });
  const frames = Math.round(DUR * FPS);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-'));
  const per = Math.ceil(frames / TABS);
  const parts = [];
  for (let i = 0; i < TABS; i++) parts.push({ from: i * per, to: Math.min(frames, (i + 1) * per), file: path.join(tmp, `p${i}.mp4`) });
  await Promise.all(parts.map((p) => renderRange(browser, p.from, p.to, p.file)));
  await browser.close();
  fs.writeFileSync(path.join(tmp, 'l.txt'), parts.map((p) => `file '${p.file}'`).join('\n'));
  const out = path.resolve(__dirname, '../out/pizzeria-browser.mp4');
  await run(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'l.txt'), '-c', 'copy', out]);
  const s = (Date.now() - t0) / 1000;
  console.log(JSON.stringify({ method: 'browser (Chrome headless + screenshot)', tabs: TABS, frames, renderSeconds: +s.toFixed(2), speed: +(DUR / s).toFixed(2), file: out }));
})().catch((e) => { console.error(e); process.exit(1); });
