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
  const subscriptions = new Map();
  const srv = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const send = (o, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.headers.authorization !== 'Bearer sk_test_lampo') return send({ error: { message: 'bad key' } }, 401);
    if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
      const f = new URLSearchParams(Buffer.concat(chunks).toString());
      const id = `cs_test_${sessions.size + 1}abcdefgh`;
      const mode = f.get('mode');
      const s = { id, mode, status: 'open', url: `https://checkout.stripe.test/${id}`, payment_status: 'unpaid', amount: f.get('line_items[0][price_data][unit_amount]'), interval: f.get('line_items[0][price_data][recurring][interval]'), success_url: f.get('success_url'), cancel_url: f.get('cancel_url'), taxCode: f.get('line_items[0][price_data][product_data][tax_code]'), metadata: { spec_hash: f.get('metadata[spec_hash]'), ref: f.get('metadata[ref]'), kind: f.get('metadata[kind]') }, subscription: mode === 'subscription' ? `sub_test${sessions.size + 1}` : null };
      sessions.set(id, s);
      return send(s);
    }
    const m = /^\/v1\/checkout\/sessions\/(cs_[\w]+)$/.exec(req.url);
    if (req.method === 'GET' && m && sessions.has(m[1])) return send(sessions.get(m[1]));
    const sub = /^\/v1\/subscriptions\/(sub_\w+)$/.exec(req.url);
    if (req.method === 'GET' && sub) return send({ id: sub[1], status: subscriptions.get(sub[1]) || 'canceled' });
    send({ error: { message: 'not found' } }, 404);
  });
  return { sessions, subscriptions, srv };
}

// a fake Claude API: streams scripted answers (an invalid spec first, so the repair turn runs)
function fakeClaude() {
  const calls = [];
  const good = { format: '1:1', fps: 12, quality: 'draft', scenes: [{ duration: 1, layers: [{ text: 'Pizza **Roma**', in: 'popIn' }] }] };
  const answers = [
    JSON.stringify({ ...good, scenes: [{ duration: 1, layers: [{ text: 'x', in: 'flyIn' }] }] }),
    JSON.stringify(good),
    JSON.stringify({ ...good, scenes: [{ duration: 1.2, layers: [{ text: 'Pizza **Roma**', in: 'rise' }] }] }),
  ];
  const srv = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    calls.push({ url: req.url, headers: req.headers, body });
    const text = answers[Math.min(calls.length - 1, answers.length - 1)];
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    ev('message_start', { message: { id: `msg_${calls.length}`, type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } });
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
    ev('content_block_stop', { index: 0 });
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } });
    ev('message_stop', {});
    res.end();
  });
  return { calls, srv };
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
  const claude = fakeClaude();
  const claudePort = await freePort();
  await new Promise((r) => claude.srv.listen(claudePort, '127.0.0.1', r));
  const srv = spawn(process.execPath, [path.join(__dirname, '../mcp/server.js'), '--http', String(port)], {
    env: { ...process.env, PORT: String(port), LAMPO_TOKEN: MASTER, LAMPO_FILE_SECRET: 's'.repeat(40), LAMPO_PUBLIC_URL: base, LAMPO_OUT: path.join(dir, 'out'), LAMPO_KEYS_FILE: path.join(dir, 'keys.json'), STRIPE_SECRET_KEY: 'sk_test_lampo', LAMPO_STRIPE_API: `http://127.0.0.1:${stripePort}`, LAMPO_PRICE_CENTS: '299', ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_BASE_URL: `http://127.0.0.1:${claudePort}` },
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
    assert.deepStrictEqual(health.prices, { clean: '€2.99', lifetime: '€399.00', ai: '€8.00', ai_sub: '€25.00' });
    assert.strictEqual(health.ai, true);

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
    assert.strictEqual(sess.taxCode, 'txcd_10103000', 'product tax code for Stripe Managed Payments');
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

    const pay = (id) => { stripe.sessions.get(id).payment_status = 'paid'; stripe.sessions.get(id).status = 'complete'; };
    const sidOf = (u) => /cs_test_\w+/.exec(u)[0];

    // Lampo Key (lifetime): a signed key, clean renders, no credits
    const lt = await (await post('/api/checkout', { kind: 'lifetime' })).json();
    assert.strictEqual(lt.price, '€399.00');
    assert.strictEqual(stripe.sessions.get(sidOf(lt.url)).amount, '39900');
    assert.strictEqual((await post('/api/claim', { session_id: sidOf(lt.url) })).status, 402, 'not paid yet');
    pay(sidOf(lt.url));
    const life = await (await post('/api/claim', { session_id: sidOf(lt.url) })).json();
    assert.match(life.key, /^lkl_[a-f0-9]{52}$/);
    assert.strictEqual((await (await post('/api/claim', { session_id: sidOf(lt.url) })).json()).key, life.key, 'same key on reload');
    const lifeRender = await (await post('/api/render', { spec }, life.key)).json();
    assert.ok(!lifeRender.watermark && lifeRender.url, JSON.stringify(lifeRender));
    assert.strictEqual((await post('/api/render', { spec }, life.key.slice(0, -1) + (life.key.endsWith('0') ? '1' : '0'))).status, 401, 'forged key');
    const lifePage = await (await fetch(`${base}/paid?session_id=${sidOf(lt.url)}`)).text();
    assert.ok(lifePage.includes(life.key) && lifePage.includes(`/mcp/${life.key}`));

    // Lampo AI, one video (€8): pay first, then Claude writes the spec (repair + visual review), clean video
    const aiCo = await (await post('/api/checkout', { kind: 'ai', brief: 'Uno spot per la pizzeria Roma', format: '1:1' })).json();
    assert.strictEqual(aiCo.price, '€8.00');
    pay(sidOf(aiCo.url));
    const aiOut = await post('/api/claim', { session_id: sidOf(aiCo.url) });
    const ai = await aiOut.json();
    assert.strictEqual(aiOut.status, 200, JSON.stringify(ai));
    assert.strictEqual(ai.spec.scenes[0].layers[0].in, 'rise', 'the reviewed spec is the one rendered');
    assert.strictEqual((await fetch(ai.url)).status, 200);
    assert.strictEqual(claude.calls.length, 3, 'write, fix, review');
    const first = claude.calls[0];
    assert.strictEqual(first.body.model, 'claude-opus-5-5');
    assert.strictEqual(first.body.fallbacks, 'default');
    assert.match(first.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
    assert.deepStrictEqual(first.body.system[0].cache_control, { type: 'ephemeral' });
    assert.ok(first.body.system[0].text.includes('Blueprints: proven shot shapes'), 'the skill is the system prompt');
    assert.match(JSON.stringify(claude.calls[1].body.messages), /flyIn/, 'validation errors sent back');
    assert.ok(claude.calls[2].body.messages.at(-1).content.some((c) => c.type === 'image'), 'review sees the preview');
    const again = await (await post('/api/claim', { session_id: sidOf(aiCo.url) })).json();
    assert.strictEqual(claude.calls.length, 3, 'a reload does not call Claude again');
    assert.deepStrictEqual(again.spec, ai.spec);

    // Lampo AI monthly (€25): a subscription key, valid while Stripe says active
    const subCo = await (await post('/api/checkout', { kind: 'ai_sub' })).json();
    const subSession = stripe.sessions.get(sidOf(subCo.url));
    assert.strictEqual(subSession.mode, 'subscription');
    assert.strictEqual(subSession.interval, 'month');
    assert.strictEqual(subSession.amount, '2500');
    pay(sidOf(subCo.url));
    stripe.subscriptions.set(subSession.subscription, 'active');
    const subKeyOut = await (await post('/api/claim', { session_id: sidOf(subCo.url) })).json();
    assert.match(subKeyOut.key, /^lks_sub_test\w+_[a-f0-9]{32}$/);
    const aiSub = await fetch(`${base}/api/ai`, { method: 'POST', headers: { 'content-type': 'text/plain', authorization: `Bearer ${subKeyOut.key}` }, body: JSON.stringify({ brief: 'Reel per un barbiere', format: '1:1' }) });
    assert.strictEqual(aiSub.status, 200, await aiSub.clone().text());
    assert.ok((await aiSub.json()).url);
    assert.strictEqual((await post('/api/ai', { brief: 'x' })).status, 402, 'AI without a subscription');
    const subRender = await (await post('/api/render', { spec }, subKeyOut.key)).json();
    assert.ok(!subRender.watermark, 'subscribers render clean');

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
    claude.srv.close();
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
    console.log('ok · cloud: keys, credits, watermark, Stripe checkout → clean video, lifetime key, AI video (write/fix/review), AI subscription, REST, MCP key in URL, signed files, media rules, Hugging Face setup');
  } finally {
    hf.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
