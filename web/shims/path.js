'use strict';
// Minimal path for the browser: specs use URLs relative to the page.
const isAbsolute = (p) => /^(\/|[a-z]+:)/i.test(String(p));
const resolve = (...parts) => {
  const p = parts.filter((x) => x != null && x !== '');
  let out = '';
  for (const x of p) out = isAbsolute(x) || !out ? String(x) : `${out.replace(/\/$/, '')}/${x}`;
  return out;
};
const basename = (p) => String(p).split('/').pop();
const dirname = (p) => String(p).split('/').slice(0, -1).join('/') || '.';
module.exports = { isAbsolute, resolve, basename, dirname, join: (...a) => a.join('/') };
