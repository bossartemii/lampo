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
const { render, preview, still } = require('../src/render');
const { normalize, SpecError } = require('../src/spec');
const { describe } = require('../src/effects');
const { SOUND_NAMES } = require('../src/sfx');

const VERSION = require('../package.json').version;
const GUIDE = fs.readFileSync(path.join(__dirname, '../src/guide.md'), 'utf8');
const OUT_DIR = path.resolve(process.env.LAMPO_OUT || path.join(process.cwd(), 'lampo-out'));
const PUBLIC_URL = process.env.LAMPO_PUBLIC_URL || null; // public HTTPS base URL
const FILE_SECRET = process.env.LAMPO_FILE_SECRET || '';
const KEYS_FILE = path.resolve(process.env.LAMPO_KEYS_FILE || path.join(process.cwd(), 'keys.json'));
const BILLING_URL = process.env.LAMPO_BILLING_URL || 'https://github.com/sponsors/bossartemii';

function loadKeys() {
  try { return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')); }
  catch { return {}; }
}
function saveKeys(keys) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2) + '\n');
}
function cleanOldFiles(maxAgeSec = 1800) {
  if (!fs.existsSync(OUT_DIR)) return;
  const now = Date.now();
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
    description: 'Read this first. Returns the full Lampo spec reference: formats, layers, effects, transitions and design recipes for short ads and social videos.',
    inputSchema: { type: 'object', properties: {} },
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
    description: 'Render the spec to an MP4 file (H.264). Returns the file path (and a download URL in HTTP mode) plus render stats.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: specProp,
        output: { type: 'string', description: 'Output file name or path, e.g. "coffee-ad.mp4". Default: video-<timestamp>.mp4' },
        quality: { type: 'string', enum: ['draft', 'standard', 'high'] },
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

async function callTool(name, args = {}, auth = { master: true }) {
  const baseDir = process.cwd();
  const heavy = httpMode && ['lampo_preview', 'lampo_still', 'lampo_render'].includes(name);
  if (heavy && cloudBusy) {
    return { isError: true, content: [{ type: 'text', text: 'Lampo è occupato. Riprova tra poco.' }] };
  }
  if (heavy) cloudBusy = true;

  try {
    if (httpMode && ['lampo_validate', 'lampo_preview', 'lampo_still', 'lampo_render'].includes(name)) {
      validateCloudSpec(args.spec, baseDir);
    }
    switch (name) {
      case 'lampo_guide':
        return text(GUIDE + '\n\n## Effect catalog\n' + JSON.stringify({ ...describe(), sounds: SOUND_NAMES }));
      case 'lampo_validate': {
        const s = normalize(toSpec(args.spec), { baseDir });
        return text({ ok: true, duration: +s.duration.toFixed(2), scenes: s.scenes.length, size: `${s.outWidth}x${s.outHeight}`, frames: s.totalFrames });
      }
      case 'lampo_preview': {
        const file = path.join(os.tmpdir(), `lampo-preview-${process.pid}-${Date.now()}.png`);
        const r = await preview(toSpec(args.spec), file, { baseDir, times: args.times });
        const data = fs.readFileSync(file).toString('base64');
        fs.rmSync(file, { force: true });
        return { content: [{ type: 'image', data, mimeType: 'image/png' }, { type: 'text', text: `Keyframes at ${r.times.join(', ')}s. Total ${r.duration}s.` }] };
      }
      case 'lampo_still': {
        const file = path.join(os.tmpdir(), `lampo-still-${process.pid}-${Date.now()}.png`);
        await still(toSpec(args.spec), file, Number(args.time) || 0, { baseDir });
        const data = fs.readFileSync(file).toString('base64');
        fs.rmSync(file, { force: true });
        return { content: [{ type: 'image', data, mimeType: 'image/png' }] };
      }
      case 'lampo_render': {
        if (httpMode && !auth.master) {
          const keys = loadKeys();
          const record = keys[auth.token];
          if (!record || typeof record.credits !== 'number' || record.credits < 1) {
            return { isError: true, content: [{ type: 'text', text: `Crediti esauriti (0 rimasti). Ricarica qui: ${BILLING_URL}` }] };
          }
        }
        cleanOldFiles();
        const file = outPath(httpMode ? `video-${crypto.randomUUID()}.mp4` : args.output, '.mp4');
        const r = await render(toSpec(args.spec), file, { baseDir, quality: args.quality });
        if (httpMode && !auth.master) {
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
        if (httpMode && PUBLIC_URL) {
          const name = path.basename(file);
          const expires = Math.floor(Date.now() / 1000) + 900;
          const sig = crypto.createHmac('sha256', FILE_SECRET)
            .update(`${name}:${expires}`).digest('hex');
          r.url = `${PUBLIC_URL.replace(/\/$/, '')}/files/${encodeURIComponent(name)}?expires=${expires}&sig=${sig}`;
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
        instructions: 'Lampo renders short videos (ads, reels, intros) from a JSON spec. Call lampo_guide once, write the spec, check it with lampo_preview, then lampo_render.',
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
    if (url.pathname !== '/mcp') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('Lampo MCP server. Endpoint: POST /mcp'); }
    const authHeader = req.headers.authorization || '';
    const suppliedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const isMaster = suppliedToken === token;
    const clientKeys = !isMaster && suppliedToken ? loadKeys() : {};
    if (!isMaster && !clientKeys[suppliedToken]) {
      res.writeHead(401); return res.end('unauthorized');
    }
    const auth = { master: isMaster, token: suppliedToken };
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
