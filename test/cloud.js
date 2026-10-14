'use strict';
// Lampo Cloud end to end: starts `mcp/server.js --http` on a free port and checks keys, credits,
// the REST API used by the playground, MCP with the key in the URL, signed file links and media rules.
const assert = require('assert');
const { spawn } = require('child_process');
const net = require('net');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

 // a fake Stripe: Checkout Sessions in memory, marked paid by the test
function fakeStripe() {
  const sessions = new Map();
  const srv = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const send = (o, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.headers.authorization !== 'Bearer sk_test_lampo') return send({ error: { message: 'bad key' } }, 401);
    if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
      const f = new URLSearchParams(Buffer.concat(chunks).toString());
      const id = `cs_test_${sessions.size + 1}abcdefgh`;
      const s = { id, url: `https://checkout.stripe.test/${id}`, payment_status: 'unpaid', amount: f.get('line_items[0][price_data][unit_amount]'), success_url: f.get('success_url'), cancel_url: f.get('cancel_url'), metadata: { spec_hash: f.get('metadata[spec_hash]') } };
      sessions.set(id, s);
      return send(s);
    }
    const m = /^\/v1\/checkout\/sessions\/(cs_[\w]+)$/.exec(req.url);
    if (req.method === 'GET' && m && sessions.has(m[1])) return send(sessions.get(m[1]));
    send({ error: { message: 'not found' } }, 404);
  });
  return { sessions, srv };
}

const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const MASTER = 'm'.repeat(40);

(async () => {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lampo-cloud-'));
  const base = `http://127.0.0.1:${port}`;
  const stripe = fakeStripe();
  const stripePort = await freePort();
  await new Promise((r) => stripe.srv.listen(stripePort, '127.0.0.1', r));
  const srv = spawn(process.execPath, [path.join(__dirname, '../mcp/server.js'), '--http', String(port)], {
    env: { ...process.env, PORT: String(port), LAMPO_TOKEN: MASTER, LAMPO_FILE_SECRET: 's'.repeat(40), LAMPO_PUBLIC_URL: base, LAMPO_OUT: path.join(dir, 'out'), LAMPO_KEYS_FILE: path.join(dir, 'keys.json'), STRIPE_SECRET_KEY: 'sk_test_lampo', LAMPO_STRIPE_API: `http://127.0.0.1:${stripePort}`, LAMPO_PRICE_CENTS: '299' },
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
    assert.strictEqual(health.payments, true);
    assert.strictEqual(health.price, '€2.99');

    // a client key with 1 credit
    const key = (await (await post('/admin/keys', { action: 'add', label: 'test', credits: 1 }, MASTER)).json()).token;
    assert.match(key, /^lk_[a-f0-9]{48}$/);

    const spec = { format: '1:1', fps: 12, quality: 'draft', scenes: [{ duration: 1, layers: [{ text: 'Cloud', in: 'popIn' }] }] };
    assert.strictEqual((await post('/api/render', { spec }, `lk_${'f'.repeat(48)}`)).status, 401, 'wrong key → 401');

    // no key: free render with the watermark and a link to buy the clean one
    const anon = await (await post('/api/render', { spec })).json();
    assert.strictEqual(anon.watermark, true, JSON.stringify(anon));
    assert.match(anon.clean.buyUrl, new RegExp(`^${base}/buy/[a-f0-9]{32}$`));
    assert.strictEqual(anon.clean.price, '€2.99');
    assert.strictEqual((await fetch(anon.url)).status, 200);

    // /buy → Stripe Checkout (303), then the buyer comes back to /paid
    const buy = await fetch(anon.clean.buyUrl, { redirect: 'manual' });
    assert.strictEqual(buy.status, 303);
    const sid = /cs_test_\w+/.exec(buy.headers.get('location'))[0];
    const sess = stripe.sessions.get(sid);
    assert.strictEqual(sess.amount, '299');
    assert.strictEqual(sess.metadata.spec_hash, anon.clean.buyUrl.split('/').pop());
    assert.strictEqual(sess.success_url, `${base}/paid?session_id={CHECKOUT_SESSION_ID}`);
    // not paid yet → no clean video
    assert.strictEqual((await fetch(`${base}/paid?session_id=${sid}`)).status, 402);
    assert.strictEqual((await post('/api/clean', { session_id: sid })).status, 402);
    assert.strictEqual((await fetch(`${base}/paid?session_id=cs_test_forged`)).status, 502, 'unknown session');
    sess.payment_status = 'paid';
    const paidPage = await (await fetch(`${base}/paid?session_id=${sid}`)).text();
    const cleanUrl = /href="([^"]+clean-[a-f0-9]{32}\.mp4[^"]*)"/.exec(paidPage)[1].replace(/&amp;/g, '&');
    const cleanMp4 = await fetch(cleanUrl);
    assert.strictEqual(cleanMp4.status, 200);
    assert.ok((await cleanMp4.arrayBuffer()).byteLength > 1000);

    // playground flow: /api/checkout with a return URL on the playground, then /api/clean
    const co = await (await post('/api/checkout', { spec, return: 'https://bossartemii.github.io/lampo/playground/#ex=x' })).json();
    const sid2 = /cs_test_\w+/.exec(co.url)[0];
    assert.strictEqual(stripe.sessions.get(sid2).success_url, 'https://bossartemii.github.io/lampo/playground/?paid={CHECKOUT_SESSION_ID}');
    const evil = await (await post('/api/checkout', { spec, return: 'https://evil.example/steal' })).json();
    assert.match(stripe.sessions.get(/cs_test_\w+/.exec(evil.url)[0]).success_url, /\/paid\?session_id=/, 'only allowed return origins');
    stripe.sessions.get(sid2).payment_status = 'paid';
    const cl = await post('/api/clean', { session_id: sid2, spec });
    const clOut = await cl.json();
    assert.strictEqual(cl.status, 200, JSON.stringify(clOut));
    assert.match(clOut.url, /clean-[a-f0-9]{32}\.mp4/);

    // the key can also be in the query string (the playground uses a simple request, no preflight)
    const q = await fetch(`${base}/api/validate?key=${key}`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ spec }) });
    assert.strictEqual(q.status, 200);
    assert.strictEqual(q.headers.get('access-control-allow-origin'), '*');

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

    assert.ok(!out.watermark, 'a key with credits renders clean');

    // out of credits → the watermarked video and the link to buy it
    const noCredit = await (await post('/api/render', { spec }, key)).json();
    assert.strictEqual(noCredit.watermark, true);
    assert.ok(noCredit.clean.buyUrl);

    // MCP with the key in the URL (for ChatGPT / Claude.ai connectors)
    const mcp = await post(`/mcp/${key}`, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.strictEqual(mcp.status, 200);
    assert.ok((await mcp.json()).result.tools.some((t) => t.name === 'lampo_render'));
    assert.strictEqual((await post(`/mcp/lk_${'0'.repeat(48)}`, { jsonrpc: '2.0', id: 1, method: 'tools/list' })).status, 401);

    // inline: the MP4 comes back in the MCP response (master key: no credits needed)
    const il = await (await post('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'lampo_render', arguments: { spec, inline: true } } }, MASTER)).json();
    const res = il.result.content.find((c) => c.type === 'resource');
    assert.ok(res, JSON.stringify(il).slice(0, 300));
    assert.strictEqual(res.resource.mimeType, 'video/mp4');
    assert.strictEqual(Buffer.from(res.resource.blob, 'base64').subarray(4, 8).toString(), 'ftyp');

  } finally {
    srv.kill();
    stripe.srv.close();
  }

  // Hugging Face Spaces setup: public URL from SPACE_HOST, keys from the LAMPO_KEYS secret,
  // no LAMPO_FILE_SECRET (a random one per start)
  const port2 = await freePort();
  const seeded = `lk_${'a'.repeat(48)}`;
  const hf = spawn(process.execPath, [path.join(__dirname, '../mcp/server.js'), '--http', String(port2)], {
    env: { ...process.env, PORT: String(port2), LAMPO_TOKEN: MASTER, LAMPO_FILE_SECRET: '', LAMPO_PUBLIC_URL: '', SPACE_HOST: 'someone-lampo.hf.space', LAMPO_KEYS: JSON.stringify({ [seeded]: { label: 'seed', credits: 2 } }), LAMPO_OUT: path.join(dir, 'out2'), LAMPO_KEYS_FILE: path.join(dir, 'data2/keys.json') },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let log2 = '';
  hf.stderr.on('data', (d) => { log2 += d; });
  try {
    for (let i = 0; i < 50 && !log2.includes('listening'); i++) await new Promise((r) => setTimeout(r, 100));
    assert.ok(log2.includes('1 client key(s) from LAMPO_KEYS'), log2);
    const r = await fetch(`http://127.0.0.1:${port2}/api/render`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${seeded}` }, body: JSON.stringify({ spec: { format: '1:1', fps: 12, quality: 'draft', scenes: [{ duration: 0.5, layers: [{ text: 'HF' }] }] } }) });
    const out = await r.json();
    assert.strictEqual(r.status, 200, JSON.stringify(out));
    assert.ok(out.url.startsWith('https://someone-lampo.hf.space/files/'), out.url);
    assert.strictEqual(out.creditsLeft, 1);
    console.log('ok · cloud: keys, credits, watermark, Stripe checkout → clean video, REST, MCP key in URL, signed files, media rules, Hugging Face setup');
  } finally {
    hf.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
