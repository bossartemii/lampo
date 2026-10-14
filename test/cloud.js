'use strict';
// Lampo Cloud end to end: starts `mcp/server.js --http` on a free port and checks keys, credits,
// the REST API used by the playground, MCP with the key in the URL, signed file links and media rules.
const assert = require('assert');
const { spawn } = require('child_process');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');

const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const MASTER = 'm'.repeat(40);

(async () => {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lampo-cloud-'));
  const base = `http://127.0.0.1:${port}`;
  const srv = spawn(process.execPath, [path.join(__dirname, '../mcp/server.js'), '--http', String(port)], {
    env: { ...process.env, PORT: String(port), LAMPO_TOKEN: MASTER, LAMPO_FILE_SECRET: 's'.repeat(40), LAMPO_PUBLIC_URL: base, LAMPO_OUT: path.join(dir, 'out'), LAMPO_KEYS_FILE: path.join(dir, 'keys.json') },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let log = '';
  srv.stderr.on('data', (d) => { log += d; });
  try {
    for (let i = 0; i < 50 && !log.includes('listening'); i++) await new Promise((r) => setTimeout(r, 100));
    assert.ok(log.includes('listening'), `server did not start: ${log}`);
    const post = (p, body, key) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body) });

    const health = await (await fetch(`${base}/health`)).json();
    assert.strictEqual(health.ok, true);

    // a client key with 1 credit
    const key = (await (await post('/admin/keys', { action: 'add', label: 'test', credits: 1 }, MASTER)).json()).token;
    assert.match(key, /^lk_[a-f0-9]{48}$/);

    const spec = { format: '1:1', fps: 12, quality: 'draft', scenes: [{ duration: 1, layers: [{ text: 'Cloud', in: 'popIn' }] }] };
    assert.strictEqual((await post('/api/render', { spec })).status, 401, 'no key → 401');

    const v = await post('/api/validate', { spec }, key);
    assert.strictEqual(v.status, 200);
    assert.strictEqual((await v.json()).ok, true);

    const bad = await post('/api/validate', { spec: { scenes: [{ duration: 1, layers: [{ text: 'x', in: 'flyIn' }] }] } }, key);
    assert.strictEqual(bad.status, 400);
    assert.match((await bad.json()).error, /flyIn/);

    // media from the server's disk or its network is refused
    const local = await post('/api/validate', { spec: { scenes: [{ duration: 1, background: { type: 'image', src: '/etc/hostname' }, layers: [] }] } }, key);
    assert.strictEqual(local.status, 400);
    assert.match((await local.json()).error, /https:\/\/ URL/);
    const inner = await post('/api/validate', { spec: { scenes: [{ duration: 1, layers: [{ type: 'image', src: 'https://169.254.169.254/x.png' }] }] } }, key);
    assert.match((await inner.json()).error, /private address/);

    // render: signed URL, one credit spent
    const r = await post('/api/render', { spec }, key);
    const out = await r.json();
    assert.strictEqual(r.status, 200, JSON.stringify(out));
    assert.strictEqual(out.creditsLeft, 0);
    assert.ok(!out.file, 'server path is not leaked');
    const mp4 = await fetch(out.url);
    assert.strictEqual(mp4.status, 200);
    assert.ok((await mp4.arrayBuffer()).byteLength > 1000);
    assert.strictEqual((await fetch(out.url.replace(/sig=[a-f0-9]+/, `sig=${'0'.repeat(64)}`))).status, 403);

    // out of credits → 402
    assert.strictEqual((await post('/api/render', { spec }, key)).status, 402);

    // MCP with the key in the URL (for ChatGPT / Claude.ai connectors)
    const mcp = await post(`/mcp/${key}`, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.strictEqual(mcp.status, 200);
    assert.ok((await mcp.json()).result.tools.some((t) => t.name === 'lampo_render'));
    assert.strictEqual((await post(`/mcp/lk_${'0'.repeat(48)}`, { jsonrpc: '2.0', id: 1, method: 'tools/list' })).status, 401);

    console.log('ok · cloud: keys, credits, REST, MCP key in URL, signed files, media rules');
  } finally {
    srv.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
