'use strict';
// A worker renders frames [from, to) and encodes them into one MP4 segment.
const { parentPort, workerData } = require('worker_threads');
const { createRenderer } = require('./frame');
const { encoder } = require('./ffmpeg');

(async () => {
  const { spec, from, to, out } = workerData;
  try {
    const r = await createRenderer(spec);
    const enc = encoder({ width: r.width, height: r.height, fps: spec.fps, out, ...spec.encode });
    let last = Date.now();
    for (let i = from; i < to; i++) {
      r.renderFrame(i);
      await enc.write(r.raw());
      if (Date.now() - last > 250) { parentPort.postMessage({ type: 'progress', done: i - from + 1 }); last = Date.now(); }
    }
    await enc.end();
    parentPort.postMessage({ type: 'progress', done: to - from });
    parentPort.postMessage({ type: 'done' });
  } catch (e) {
    parentPort.postMessage({ type: 'error', message: e.message });
  }
})();
