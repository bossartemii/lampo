#!/usr/bin/env node
'use strict';
// Controlla il tuo Lampo Cloud da remoto:
// LAMPO_CLOUD_URL=https://... LAMPO_TOKEN=... node cli/cloud.js add cliente@email.com 50
const url = (process.env.LAMPO_CLOUD_URL || '').replace(/\/$/, '');
const token = process.env.LAMPO_TOKEN || '';
const [,, action, arg1, arg2] = process.argv;

if (!url || !token || !action) {
  console.log('Uso: LAMPO_CLOUD_URL=https://tuo-cloud LAMPO_TOKEN=master_key node cli/cloud.js <list | add <email> [credits] | topup <key> <credits> | revoke <key>>');
  process.exit(1);
}

const payload = { action };
if (action === 'add') { payload.label = arg1; payload.credits = Number(arg2 ?? 10); }
if (action === 'topup') { payload.token = arg1; payload.credits = Number(arg2 || 0); }
if (action === 'revoke') { payload.token = arg1; }

fetch(`${url}/admin/keys`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
}).then(async r => {
  console.log(`HTTP ${r.status}`);
  console.log(await r.text());
}).catch(e => console.error(e.message));
