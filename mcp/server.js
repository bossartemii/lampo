#!/usr/bin/env node
'use strict';
// Lampo MCP server, zero dependencies.
//   stdio (Claude Code, Claude Desktop, Gemini CLI, Codex):  node mcp/server.js
//   HTTP  (ChatGPT, remote clients):                           node mcp/server.js --http 3333
// Protocol: JSON-RPC 2.0, MCP 2025-06-18.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const { render, preview, still } = require('../src/render');
const { normalize, parseLoose, SpecError } = require('../src/spec');
const { watermark } = require('../src/watermark');
// stable id of a spec (what a payment unlocks)
const specHash = (spec) => crypto.createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 32);
const { describe } = require('../src/effects');
const { SOUND_NAMES } = require('../src/sfx');

const VERSION = require('../package.json').version;
const { guide, TOPICS } = require('../src/guide');
const OUT_DIR = path.resolve(process.env.LAMPO_OUT || path.join(process.cwd(), 'lampo-out'));
// public HTTPS base URL; on Hugging Face Spaces it is read from SPACE_HOST
const PUBLIC_URL = process.env.LAMPO_PUBLIC_URL || (process.env.SPACE_HOST ? `https://${process.env.SPACE_HOST}` : null);
// signs download links; without one, a random secret per start (links only live 15 minutes anyway)
const FILE_SECRET = process.env.LAMPO_FILE_SECRET || (process.argv.includes('--http') ? crypto.randomBytes(32).toString('hex') : '');
const KEYS_FILE = path.resolve(process.env.LAMPO_KEYS_FILE || path.join(process.cwd(), 'keys.json'));
const INLINE_MAX = 8 * 1024 * 1024; // lampo_render inline: biggest MP4 returned in the response

// Pay per video: renders without credits carry the Lampo watermark; Stripe Checkout unlocks the clean one.
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_API = (process.env.LAMPO_STRIPE_API || 'https://api.stripe.com').replace(/\/$/, '');
const PRICE_CENTS = Number(process.env.LAMPO_PRICE_CENTS || 299);
const CURRENCY = (process.env.LAMPO_CURRENCY || 'eur').toLowerCase();
// pages allowed to get the buyer back after paying (the playground)
const RETURN_ORIGINS = (process.env.LAMPO_RETURN_ORIGINS || 'https://bossartemii.github.io').split(',').map((x) => x.trim()).filter(Boolean);
// Stripe Managed Payments (on by default on new accounts) needs a product tax code:
// txcd_10103000 = SaaS, personal use (Stripe's code for online software). LAMPO_STRIPE_MANAGED=false turns it off.
const STRIPE_TAX_CODE = process.env.LAMPO_STRIPE_TAX_CODE || 'txcd_10103000';
const STRIPE_MANAGED = process.env.LAMPO_STRIPE_MANAGED;
const ANON_PER_HOUR = Number(process.env.LAMPO_ANON_PER_HOUR || 20);
const SPECS_DIR = path.join(OUT_DIR, 'specs');
const priceLabel = () => new Intl.NumberFormat('en', { style: 'currency', currency: CURRENCY.toUpperCase() }).format(PRICE_CENTS / 100);
const BILLING_URL = process.env.LAMPO_BILLING_URL || 'https://github.com/sponsors/bossartemii';

function loadKeys() {
  try { return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')); }
  catch { return {}; }
}
// Hosts without a persistent disk (Hugging Face Spaces free tier): client keys come from the
// LAMPO_KEYS secret, JSON like {"lk_…": {"label": "Mario", "credits": 50}}, added at every start
// if the keys file doesn't have them. Credits spent are kept until the next restart.
function seedKeys() {
  if (!process.env.LAMPO_KEYS) return 0;
  let seed;
  try { seed = JSON.parse(process.env.LAMPO_KEYS); } catch { throw new Error('LAMPO_KEYS must be JSON: {"lk_...": {"label": "...", "credits": 50}}'); }
  const keys = loadKeys();
  let added = 0;
  for (const [k, v] of Object.entries(seed)) {
    if (k.length < 32) throw new Error(`LAMPO_KEYS: key "${k.slice(0, 6)}…" is shorter than 32 characters`);
    if (!keys[k]) { keys[k] = { label: v.label || 'client', credits: Number(v.credits ?? 10), used: 0, createdAt: new Date().toISOString() }; added++; }
  }
  fs.mkdirSync(path.dirname(KEYS_FILE), { recursive: true });
  saveKeys(keys);
  return added;
}

function saveKeys(keys) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2) + '\n');
}
function cleanOldFiles(maxAgeSec = 1800) {
  if (!fs.existsSync(OUT_DIR)) return;
  const now = Date.now();
  if (fs.existsSync(SPECS_DIR)) for (const f of fs.readdirSync(SPECS_DIR)) {
    const full = path.join(SPECS_DIR, f);
    try { if (now - fs.statSync(full).mtimeMs > 7 * 86400 * 1000) fs.rmSync(full, { force: true }); } catch {}
  }
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (!f.endsWith('.mp4')) continue;
    const full = path.join(OUT_DIR, f);
    try {
      if (now - fs.statSync(full).mtimeMs > maxAgeSec * 1000) fs.rmSync(full, { force: true });
    } catch {}
  }
}

const specProp = {
  description: 'The video spec as a JSON object (see lampo_guide). A JSON string is also accepted.',
  oneOf: [{ type: 'object' }, { type: 'string' }],
};

const TOOLS = [
  {
    name: 'lampo_guide',
    description: 'Read this first. Without topic: the full Lampo spec reference (formats, layers, effects, transitions, sound). Topics for directing a great video: routes (video types), styles (visual styles), blueprints (ready shot templates with JSON), motion (motion-design rules), review (checklist and fixes), all.',
    inputSchema: { type: 'object', properties: { topic: { type: 'string', enum: TOPICS, description: 'Default: spec' } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'lampo_preview',
    description: 'Fast low-res contact sheet of keyframes (3 per scene) returned as an image, so you can look at the video before rendering. Takes ~1s.',
    inputSchema: { type: 'object', properties: { spec: specProp, times: { type: 'array', items: { type: 'number' }, description: 'Optional exact seconds to show' } }, required: ['spec'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'lampo_still',
    description: 'Render one full-resolution frame at a given second, returned as an image. Use it to check details.',
    inputSchema: { type: 'object', properties: { spec: specProp, time: { type: 'number' } }, required: ['spec', 'time'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'lampo_render',
    description: 'Render the spec to an MP4 file (H.264). Returns the file path (and a download URL in HTTP mode) plus render stats. On Lampo Cloud without credits the video carries a Lampo watermark and the result has a link to buy the clean version: give that link to the user.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: specProp,
        output: { type: 'string', description: 'Output file name or path, e.g. "coffee-ad.mp4". Default: video-<timestamp>.mp4' },
        quality: { type: 'string', enum: ['draft', 'standard', 'high'] },
        inline: { type: 'boolean', description: 'Also return the MP4 itself in the response (embedded resource, base64), for agents that cannot download from the server. Up to 8 MB; use quality "draft" to keep it small.' },
      },
      required: ['spec'],
    },
  },
  {
    name: 'lampo_validate',
    description: 'Check a spec without rendering. Returns the problems with how to fix them, or the total duration if valid.',
    inputSchema: { type: 'object', properties: { spec: specProp }, required: ['spec'] },
    annotations: { readOnlyHint: true },
  },
];

const text = (t) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] });
const toSpec = (s) => (typeof s === 'string' ? s : JSON.stringify(s));

function outPath(name, ext) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = name ? path.basename(String(name)) : `video-${Date.now()}${ext}`;
  // stdio mode may write anywhere; HTTP mode only inside the output folder
  if (name && !httpMode && path.isAbsolute(name)) return name;
  return path.join(OUT_DIR, base.endsWith(ext) ? base : base + ext);
}

let httpMode = false;
let cloudBusy = false;

function validateCloudSpec(input, baseDir) {
  const s = normalize(toSpec(input), { baseDir });

  if (s.duration > 60) throw new Error('Cloud beta: durata massima 60 secondi.');
  if (s.fps > 30) throw new Error('Cloud beta: massimo 30 FPS.');
  if (s.scenes.length > 50) throw new Error('Cloud beta: massimo 50 scene.');
  if (!Number.isFinite(s.width) || !Number.isFinite(s.height) ||
      s.width > 1920 || s.height > 1920 ||
      !Number.isFinite(s.outWidth) || !Number.isFinite(s.outHeight) ||
      s.outWidth > 1920 || s.outHeight > 1920) {
    throw new Error('Cloud beta: dimensioni massime 1920 x 1920.');
  }

  let layers = 0;
  function countLayers(items) {
    for (const layer of items || []) {
      layers++;
      if (layers > 300) throw new Error('Cloud beta: massimo 300 livelli complessivi.');
      if (Array.isArray(layer.layers)) countLayers(layer.layers);
    }
  }
  for (const scene of s.scenes) countLayers(scene.layers);
  countLayers(s.layers);

  return s;
}

// On a public server a spec may only use media from the internet (https) or data: URIs:
// no files from the server's disk, and no addresses inside the server's network.
function mediaRefs(s) {
  const refs = [];
  const add = (src, where) => { if (src) refs.push({ src: String(src), where }); };
  const walk = (layers, where) => (layers || []).forEach((L, i) => {
    if (['image', 'video', 'phone'].includes(L.type)) add(L.src, `${where}[${i}]`);
    if (L.layers) walk(L.layers, `${where}[${i}].layers`);
  });
  s.scenes.forEach((S, i) => {
    const bg = S.background;
    if (bg && typeof bg === 'object' && !Array.isArray(bg)) add(bg.src, `scenes[${i}].background`);
    walk(S.layers, `scenes[${i}].layers`);
  });
  walk(s.layers, 'layers');
  if (s.audio) add(s.audio.src, 'audio');
  (s.fonts || []).forEach((f, i) => add(f.path, `fonts[${i}]`));
  return refs;
}

function privateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return privateAddress(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertSafeMedia(s) {
  for (const { src, where } of mediaRefs(s)) {
    if (src.startsWith('data:')) continue;
    let u;
    try { u = new URL(src); } catch { u = null; }
    if (!u || u.protocol !== 'https:') throw new Error(`${where}: on Lampo Cloud media must be an https:// URL or a data: URI (got "${src.slice(0, 80)}")`);
    const host = u.hostname.replace(/^\[|\]$/g, '');
    const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
    if (!addrs.length) throw new Error(`${where}: cannot resolve ${host}`);
    if (addrs.some(privateAddress)) throw new Error(`${where}: ${host} is a private address`);
  }
}

function fileUrl(name, ttl = 900) {
  if (!PUBLIC_URL) return null;
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const sig = crypto.createHmac('sha256', FILE_SECRET).update(`${name}:${expires}`).digest('hex');
  return `${PUBLIC_URL.replace(/\/$/, '')}/files/${encodeURIComponent(name)}?expires=${expires}&sig=${sig}`;
}

const specObject = (spec) => (typeof spec === 'string' ? parseLoose(spec) : spec);

// keep the spec of a watermarked video, so a payment can render it clean later
function storeSpec(obj) {
  const hash = specHash(obj);
  fs.mkdirSync(SPECS_DIR, { recursive: true });
  fs.writeFileSync(path.join(SPECS_DIR, `${hash}.json`), JSON.stringify(obj));
  return hash;
}
function loadSpec(hash) {
  if (!/^[a-f0-9]{32}$/.test(hash)) return null;
  try { return JSON.parse(fs.readFileSync(path.join(SPECS_DIR, `${hash}.json`), 'utf8')); } catch { return null; }
}

// anonymous use is free with the watermark, a few heavy calls per hour per address
const anonHits = new Map();
function anonAllowed(ip) {
  const now = Date.now();
  const hits = (anonHits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (hits.length >= ANON_PER_HOUR) { anonHits.set(ip, hits); return false; }
  hits.push(now);
  anonHits.set(ip, hits);
  return true;
}

async function callTool(name, args = {}, auth = { master: true }) {
  const baseDir = process.cwd();
  const heavy = httpMode && ['lampo_preview', 'lampo_still', 'lampo_render'].includes(name);
  if (heavy && cloudBusy) {
    return { isError: true, content: [{ type: 'text', text: 'Lampo è occupato. Riprova tra poco.' }] };
  }
  if (heavy && auth.anon && !anonAllowed(auth.ip)) {
    return { isError: true, content: [{ type: 'text', text: `Free limit reached (${ANON_PER_HOUR} renders per hour without a key). Try again later or use a Lampo Cloud key.` }] };
  }
  if (heavy) cloudBusy = true;

  try {
    if (httpMode && ['lampo_validate', 'lampo_preview', 'lampo_still', 'lampo_render'].includes(name)) {
      const s = validateCloudSpec(args.spec, baseDir);
      await assertSafeMedia(s);
    }
    switch (name) {
      case 'lampo_guide':
        if (args.topic && args.topic !== 'spec') return text(guide(args.topic));
        return text(guide('spec') + '\n\n## Effect catalog\n' + JSON.stringify({ ...describe(), sounds: SOUND_NAMES }));
      case 'lampo_validate': {
        const s = normalize(toSpec(args.spec), { baseDir });
        return text({ ok: true, duration: +s.duration.toFixed(2), scenes: s.scenes.length, size: `${s.outWidth}x${s.outHeight}`, frames: s.totalFrames });
      }
      case 'lampo_preview': {
        const file = path.join(os.tmpdir(), `lampo-preview-${process.pid}-${Date.now()}.png`);
        const input = httpMode && auth.anon ? watermark(specObject(args.spec)) : toSpec(args.spec);
        const r = await preview(input, file, { baseDir, times: args.times });
        const data = fs.readFileSync(file).toString('base64');
        fs.rmSync(file, { force: true });
        return { content: [{ type: 'image', data, mimeType: 'image/png' }, { type: 'text', text: `Keyframes at ${r.times.join(', ')}s. Total ${r.duration}s.` }] };
      }
      case 'lampo_still': {
        const file = path.join(os.tmpdir(), `lampo-still-${process.pid}-${Date.now()}.png`);
        const input = httpMode && auth.anon ? watermark(specObject(args.spec)) : toSpec(args.spec);
        await still(input, file, Number(args.time) || 0, { baseDir });
        const data = fs.readFileSync(file).toString('base64');
        fs.rmSync(file, { force: true });
        return { content: [{ type: 'image', data, mimeType: 'image/png' }] };
      }
      case 'lampo_render': {
        // clean video: the master key, or a client key with credits. Everyone else gets the watermark.
        let paid = !httpMode || auth.master;
        if (httpMode && !auth.master && auth.token) {
          const record = loadKeys()[auth.token];
          paid = !!record && typeof record.credits === 'number' && record.credits >= 1;
        }
        cleanOldFiles();
        const file = outPath(httpMode ? `video-${crypto.randomUUID()}.mp4` : args.output, '.mp4');
        let hash = null;
        let input = toSpec(args.spec);
        if (!paid) {
          const obj = specObject(args.spec);
          hash = storeSpec(obj);
          input = watermark(obj);
        }
        const r = await render(input, file, { baseDir, quality: args.quality });
        if (!paid) {
          r.watermark = true;
          if (STRIPE_KEY && PUBLIC_URL) {
            r.clean = { price: priceLabel(), buyUrl: `${PUBLIC_URL.replace(/\/$/, '')}/buy/${hash}` };
            r.note = `This video has the Lampo watermark. The clean video costs ${priceLabel()}: pay at ${r.clean.buyUrl} and the download without watermark starts right after.`;
          } else {
            r.note = 'This video has the Lampo watermark. Use a Lampo Cloud key with credits for the clean video.';
          }
        }
        if (paid && httpMode && !auth.master) {
          const keys = loadKeys();
          const record = keys[auth.token];
          if (record) {
            record.credits = Math.max(0, (record.credits || 0) - 1);
            record.used = (record.used || 0) + 1;
            record.lastUsedAt = new Date().toISOString();
            saveKeys(keys);
            r.creditsLeft = record.credits;
          }
        }
        if (httpMode && PUBLIC_URL) r.url = fileUrl(path.basename(file));
        if (args.inline) {
          // the video itself, for agents whose network can't reach this server's download link
          const bytes = fs.statSync(file).size;
          if (bytes > INLINE_MAX) {
            r.inline = `not included: ${(bytes / 1048576).toFixed(1)} MB is over the ${INLINE_MAX / 1048576} MB inline limit. Render with quality "draft" or a shorter spec, or download the url.`;
            return text(r);
          }
          const out = text(r);
          out.content.push({ type: 'resource', resource: { uri: `lampo://renders/${path.basename(file)}`, mimeType: 'video/mp4', blob: fs.readFileSync(file).toString('base64') } });
          return out;
        }
        return text(r);
      }
      default:
        return { isError: true, content: [{ type: 'text', text: `Unknown tool ${name}` }] };
    }
  } catch (e) {
    const msg = e instanceof SpecError ? e.message + '\n\nCall lampo_guide for the reference.' : `Error: ${e.message}`;
    return { isError: true, content: [{ type: 'text', text: msg }] };
  } finally {
    if (heavy) cloudBusy = false;
  }
}

async function handle(msg, auth) {
  const { id, method, params } = msg;
  const reply = (result) => (id === undefined ? null : { jsonrpc: '2.0', id, result });
  const fail = (code, message) => (id === undefined ? null : { jsonrpc: '2.0', id, error: { code, message } });
  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'lampo', title: 'Lampo — fast video from JSON', version: VERSION },
        instructions: 'Lampo renders short videos (ads, reels, intros) from a JSON spec. Call lampo_guide once (topics routes, styles, blueprints, motion, review for direction), write the spec, check it with lampo_preview, then lampo_render.',
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call':
      return reply(await callTool(params?.name, params?.arguments, auth));
    case 'resources/list':
      return reply({ resources: [] });
    case 'prompts/list':
      return reply({ prompts: [] });
    default:
      if (method?.startsWith('notifications/')) return null;
      return fail(-32601, `Method not found: ${method}`);
  }
}

async function handleAny(body, auth) {
  if (Array.isArray(body)) return (await Promise.all(body.map(m => handle(m, auth)))).filter(Boolean);
  return handle(body, auth);
}

// ---------- stdio ----------
function startStdio() {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); continue; }
      handleAny(msg).then((res) => { if (res && (!Array.isArray(res) || res.length)) process.stdout.write(JSON.stringify(res) + '\n'); });
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

// ---------- REST API (the playground's "Render on Lampo Cloud") ----------
// POST /api/render   { "spec": {...}, "quality": "standard" }  →  { url, duration, width, height, renderSeconds, creditsLeft }
// POST /api/validate { "spec": {...} }                         →  { ok, duration, scenes, size, frames }
async function readJson(req, limit = 1024 * 1024) {
  const chunks = [];
  let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) { req.destroy(); throw Object.assign(new Error('Request body exceeds the 1 MiB limit.'), { status: 413 }); } chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('Body must be JSON: { "spec": { ... } }'), { status: 400 }); }
}

async function api(req, res, tool, auth) {
  const send = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return send(405, { error: 'Use POST with a JSON body: { "spec": { ... } }' });
  let body;
  try { body = await readJson(req); } catch (e) { return send(e.status || 400, { error: e.message }); }
  if (!body.spec) return send(400, { error: 'Missing "spec".' });
  if (tool === 'lampo_render' && cloudBusy) return send(429, { error: 'Lampo Cloud is busy with another render. Try again in a few seconds.' });
  const out = await callTool(tool, { spec: body.spec, quality: body.quality }, auth);
  const msg = out.content?.[0]?.text || '';
  if (out.isError) return send(/Crediti esauriti|credits/i.test(msg) ? 402 : /occupato|busy/i.test(msg) ? 429 : 400, { error: msg.replace(/\n\nCall lampo_guide for the reference\.$/, '') });
  let data;
  try { data = JSON.parse(msg); } catch { data = { message: msg }; }
  delete data.file; // server path, useless to the client
  return send(200, data);
}

// ---------- payments: Stripe Checkout unlocks the clean video ----------
const httpError = (status, message) => Object.assign(new Error(message), { status });

async function stripe(method, pathname, form) {
  const r = await fetch(`${STRIPE_API}${pathname}`, {
    method,
    headers: { authorization: `Bearer ${STRIPE_KEY}`, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw httpError(502, `Stripe: ${j.error?.message || `HTTP ${r.status}`}`);
  return j;
}

function safeReturn(u) {
  try { const x = new URL(u); return RETURN_ORIGINS.includes(x.origin) ? x : null; } catch { return null; }
}

// a Checkout Session for the clean version of one spec; after paying the buyer comes back to the
// playground (if it sent a return URL) or to this server's /paid page
async function checkout(hash, returnUrl) {
  const base = PUBLIC_URL.replace(/\/$/, '');
  const back = safeReturn(returnUrl);
  let success, cancel;
  if (back) {
    back.hash = '';
    back.searchParams.delete('paid');
    cancel = back.toString();
    success = `${cancel}${back.search ? '&' : '?'}paid={CHECKOUT_SESSION_ID}`;
  } else {
    success = `${base}/paid?session_id={CHECKOUT_SESSION_ID}`;
    cancel = `${base}/paid?cancelled=1`;
  }
  const session = await stripe('POST', '/v1/checkout/sessions', {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': CURRENCY,
    'line_items[0][price_data][unit_amount]': String(PRICE_CENTS),
    'line_items[0][price_data][product_data][name]': 'Lampo video without watermark',
    ...(STRIPE_TAX_CODE ? { 'line_items[0][price_data][product_data][tax_code]': STRIPE_TAX_CODE } : {}),
    ...(STRIPE_MANAGED === 'false' ? { 'managed_payments[enabled]': 'false' } : {}),
    success_url: success,
    cancel_url: cancel,
    client_reference_id: hash,
    'metadata[spec_hash]': hash,
  });
  return session.url;
}

// the spec a paid Checkout Session unlocks (the payment is checked with Stripe, never trusted from the URL)
async function paidHash(sessionId) {
  if (!/^cs_[A-Za-z0-9_]{8,}$/.test(sessionId || '')) throw httpError(400, 'Missing or invalid session_id.');
  const session = await stripe('GET', `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (session.payment_status !== 'paid') throw httpError(402, 'This checkout has not been paid.');
  const hash = session.metadata?.spec_hash;
  if (!/^[a-f0-9]{32}$/.test(hash || '')) throw httpError(400, 'This checkout is not for a Lampo video.');
  return hash;
}

async function renderClean(hash, obj) {
  const name = `clean-${hash}.mp4`;
  const file = path.join(OUT_DIR, name);
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 20 * 60e3) return { url: fileUrl(name), cached: true };
  if (cloudBusy) throw httpError(429, 'Lampo Cloud is busy with another render. Try again in a few seconds.');
  cloudBusy = true;
  try {
    const s = validateCloudSpec(obj, process.cwd());
    await assertSafeMedia(s);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const r = await render(toSpec(obj), file, { baseDir: process.cwd(), quality: obj.quality === 'high' ? 'high' : 'standard' });
    delete r.file;
    return { ...r, url: fileUrl(name) };
  } finally {
    cloudBusy = false;
  }
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#eef0f3;color:#000;font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}
main{background:#fff;border:1.5px solid #000;border-radius:16px;padding:24px;max-width:420px;width:100%}h1{font-size:24px;margin:0 0 8px}p{color:#4a4f5a;margin:0 0 14px}
video{width:100%;border-radius:12px;background:#000;margin:8px 0 14px}a.b{display:inline-block;background:#ffe14d;color:#000;border:1.5px solid #000;border-radius:999px;padding:10px 18px;font-weight:700;text-decoration:none}</style>
</head><body><main>${body}</main></body></html>`;
}
const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function payments(req, res, url) {
  const json = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const html = (status, title, body) => { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }); res.end(page(title, body)); };
  const enabled = !!(STRIPE_KEY && PUBLIC_URL);
  try {
    // POST /api/checkout { spec, return } → { url, price }: the playground's "Download without watermark"
    if (url.pathname === '/api/checkout') {
      if (req.method !== 'POST') return json(405, { error: 'Use POST' });
      if (!enabled) return json(503, { error: 'Payments are not set up on this server.' });
      const body = await readJson(req);
      if (!body.spec) return json(400, { error: 'Missing "spec".' });
      const obj = specObject(body.spec);
      const s = validateCloudSpec(obj, process.cwd());
      await assertSafeMedia(s);
      const hash = storeSpec(obj);
      return json(200, { url: await checkout(hash, body.return), price: priceLabel(), id: hash });
    }
    // POST /api/clean { session_id, spec } → { url }: the clean video after paying
    if (url.pathname === '/api/clean') {
      if (req.method !== 'POST') return json(405, { error: 'Use POST' });
      if (!enabled) return json(503, { error: 'Payments are not set up on this server.' });
      const body = await readJson(req);
      const hash = await paidHash(body.session_id);
      let obj = loadSpec(hash);
      if (!obj && body.spec && specHash(specObject(body.spec)) === hash) obj = specObject(body.spec);
      if (!obj) return json(410, { error: 'The spec of this payment is no longer on the server. Send it again with the request.' });
      return json(200, await renderClean(hash, obj));
    }
    // GET /buy/<id>: the link given to agents (ChatGPT, Claude) with a watermarked video
    if (url.pathname.startsWith('/buy/')) {
      if (!enabled) return html(503, 'Lampo', '<h1>Payments are not set up</h1><p>This Lampo Cloud server does not sell clean videos.</p>');
      const hash = url.pathname.slice(5);
      if (!loadSpec(hash)) return html(404, 'Lampo', '<h1>Video not found</h1><p>This link expired. Render the video again to get a new one.</p>');
      res.writeHead(303, { location: await checkout(hash, url.searchParams.get('return')) });
      return res.end();
    }
    // GET /paid?session_id=… : back from Stripe, render the clean video and offer the download
    if (url.pathname === '/paid') {
      if (url.searchParams.get('cancelled')) return html(200, 'Lampo', '<h1>Payment cancelled</h1><p>Nothing was charged. The watermarked video is still yours.</p>');
      const hash = await paidHash(url.searchParams.get('session_id'));
      const obj = loadSpec(hash);
      if (!obj) return html(410, 'Lampo', '<h1>Paid, but the video expired</h1><p>The spec is no longer on the server. Reply to the Stripe receipt and we will send the video.</p>');
      const r = await renderClean(hash, obj);
      return html(200, 'Your Lampo video', `<h1>⚡ Your video, without watermark</h1><p>Thanks! The download link works for 15 minutes; reload this page for a new one.</p><video src="${esc(r.url)}" controls playsinline></video><a class="b" href="${esc(r.url)}" download>Download MP4</a>`);
    }
  } catch (e) {
    const status = e.status || (e instanceof SpecError ? 400 : 500);
    if (url.pathname.startsWith('/api/')) return json(status, { error: e.message });
    return html(status, 'Lampo', `<h1>Something went wrong</h1><p>${esc(e.message)}</p>`);
  }
  return false;
}

// ---------- HTTP (Streamable HTTP, JSON responses) ----------
function startHttp(port) {
  httpMode = true;
  const token = process.env.LAMPO_TOKEN;
  if (!token || token.length < 32) {
    throw new Error('HTTP mode requires LAMPO_TOKEN with at least 32 characters.');
  }
  if (FILE_SECRET.length < 32) {
    throw new Error('HTTP mode requires LAMPO_FILE_SECRET with at least 32 characters.');
  }
  const seeded = seedKeys();
  if (seeded) console.error(`Lampo Cloud: ${seeded} client key(s) from LAMPO_KEYS`);
  if (!PUBLIC_URL) console.error('Lampo Cloud: LAMPO_PUBLIC_URL is not set, renders will not return download links');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, mcp-session-id, mcp-protocol-version');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      let name;
      try { name = path.basename(decodeURIComponent(url.pathname.slice(7))); }
      catch { res.writeHead(400); return res.end('bad filename'); }

      const expires = Number(url.searchParams.get('expires'));
      const sig = url.searchParams.get('sig') || '';
      if (!name || !Number.isSafeInteger(expires) ||
          expires < Math.floor(Date.now() / 1000) ||
          expires > Math.floor(Date.now() / 1000) + 3600 ||
          !/^[a-f0-9]{64}$/.test(sig)) {
        res.writeHead(403); return res.end('invalid or expired link');
      }

      const expected = crypto.createHmac('sha256', FILE_SECRET)
        .update(`${name}:${expires}`).digest();
      const supplied = Buffer.from(sig, 'hex');
      if (supplied.length !== expected.length ||
          !crypto.timingSafeEqual(supplied, expected)) {
        res.writeHead(403); return res.end('invalid or expired link');
      }

      const f = path.join(OUT_DIR, name);
      if (!fs.existsSync(f) || !fs.statSync(f).isFile()) {
        res.writeHead(404); return res.end('not found');
      }
      res.writeHead(200, {
        'content-type': 'video/mp4',
        'content-length': fs.statSync(f).size,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff'
      });
      const stream = fs.createReadStream(f);
      stream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
      return stream.pipe(res);
    }
    if (req.method === 'POST' && url.pathname === '/admin/keys') {
      if (req.headers.authorization !== `Bearer ${token}`) {
        res.writeHead(401); return res.end('unauthorized');
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      let body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {}
      const keys = loadKeys();
      if (body.action === 'add') {
        const k = 'lk_' + crypto.randomBytes(24).toString('hex');
        keys[k] = { label: body.label || 'client', credits: Number(body.credits ?? 10), used: 0, createdAt: new Date().toISOString() };
        saveKeys(keys);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ token: k, ...keys[k] }));
      }
      if (body.action === 'topup' && keys[body.token]) {
        keys[body.token].credits = (keys[body.token].credits || 0) + Number(body.credits || 0);
        saveKeys(keys);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ token: body.token, ...keys[body.token] }));
      }
      if (body.action === 'revoke' && keys[body.token]) {
        delete keys[body.token];
        saveKeys(keys);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, revoked: body.token }));
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(keys, null, 2));
    }
    if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, version: VERSION, busy: cloudBusy, payments: !!(STRIPE_KEY && PUBLIC_URL), price: STRIPE_KEY ? priceLabel() : null })); }
    if (['/api/checkout', '/api/clean', '/paid'].includes(url.pathname) || url.pathname.startsWith('/buy/')) return payments(req, res, url);
    // ChatGPT and Claude.ai connectors can't send headers: the key can also be the last part of the URL, /mcp/<key>
    const pathKey = /^\/mcp\/(lk_[a-f0-9]{48}|[A-Za-z0-9_-]{32,})$/.exec(url.pathname)?.[1] || '';
    const isApi = url.pathname === '/api/render' || url.pathname === '/api/validate';
    if (url.pathname !== '/mcp' && !pathKey && !isApi) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('Lampo Cloud. MCP endpoint: POST /mcp (Authorization: Bearer <key>, or no key for watermarked videos) or /mcp/<key>. REST: POST /api/render, /api/validate, /api/checkout, /api/clean.'); }
    const authHeader = req.headers.authorization || '';
    // the REST API also takes ?key=, so a browser can call it with a simple request (no CORS preflight)
    const queryKey = isApi ? (url.searchParams.get('key') || '') : '';
    const suppliedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : pathKey || queryKey;
    const isMaster = suppliedToken === token;
    const clientKeys = !isMaster && suppliedToken ? loadKeys() : {};
    // no key at all: free, anonymous use with the watermark; a wrong key is an error (so typos show up)
    if (suppliedToken && !isMaster && !clientKeys[suppliedToken]) {
      res.writeHead(401); return res.end('unauthorized');
    }
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
    const auth = { master: isMaster, token: suppliedToken, anon: !suppliedToken, ip };
    if (isApi) return api(req, res, url.pathname === '/api/render' ? 'lampo_render' : 'lampo_validate', auth);
    if (req.method === 'GET') { res.writeHead(405); return res.end(); } // no server-initiated stream
    if (req.method === 'DELETE') { res.writeHead(200); return res.end(); }
    const maxBodyBytes = 1024 * 1024;
    const chunks = [];
    let bodyBytes = 0;
    let tooLarge = false;
    for await (const c of req) {
      bodyBytes += c.length;
      if (bodyBytes > maxBodyBytes) {
        tooLarge = true;
        chunks.length = 0;
        req.destroy();
        break;
      } else if (!tooLarge) {
        chunks.push(c);
      }
    }
    if (tooLarge) {
      res.writeHead(413, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        jsonrpc: '2.0', id: null,
        error: { code: -32600, message: 'Request body exceeds the 1 MiB limit.' }
      }));
    }
    const body = Buffer.concat(chunks).toString('utf8');
    let msg;
    try { msg = JSON.parse(body); } catch { res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })); }
    const out = await handleAny(msg, auth);
    if (!out || (Array.isArray(out) && !out.length)) { res.writeHead(202); return res.end(); }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out));
  });
  setInterval(() => cleanOldFiles(), 300000).unref();
  server.listen(port, '0.0.0.0', () => console.error(`Lampo MCP listening on port ${port} (files in ${OUT_DIR})`));
}

if (require.main === module) {
  const i = process.argv.indexOf('--http');
  if (i >= 0) startHttp(Number(process.env.PORT) || Number(process.argv[i + 1]) || 3333);
  else startStdio();
}

module.exports = { handle, callTool, TOOLS, startStdio, startHttp };
