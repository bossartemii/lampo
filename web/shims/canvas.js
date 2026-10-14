'use strict';
// Browser stand-in for @napi-rs/canvas: the engine only needs a 2D canvas, images and fonts.
const fontQueue = [];

function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('the browser could not load it (CORS or a wrong URL?)'));
    img.src = src;
  });
}

const GlobalFonts = {
  // fonts are fetched by URL; the renderer waits for them in web/entry.js
  registerFromPath(url, family) { fontQueue.push({ url, family }); },
};

module.exports = { createCanvas, loadImage, GlobalFonts, ImageData: globalThis.ImageData, fontQueue };
