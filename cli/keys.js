#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_FILE = path.resolve(process.env.LAMPO_KEYS_FILE || path.join(process.cwd(), 'keys.json'));
const load = () => { try { return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')); } catch { return {}; } };
const save = (k) => fs.writeFileSync(KEYS_FILE, JSON.stringify(k, null, 2) + '\n');

const [,, cmd, arg1, arg2] = process.argv;
const keys = load();

if (cmd === 'add') {
  const label = arg1 || 'client';
  const credits = Number(arg2 ?? 10);
  const token = 'lk_' + crypto.randomBytes(24).toString('hex');
  keys[token] = { label, credits, used: 0, createdAt: new Date().toISOString() };
  save(keys);
  console.log(JSON.stringify({ token, ...keys[token] }, null, 2));
} else if (cmd === 'topup') {
  if (!keys[arg1]) { console.error('Key non trovata'); process.exit(1); }
  keys[arg1].credits = (keys[arg1].credits || 0) + Number(arg2 || 0);
  save(keys);
  console.log(JSON.stringify({ token: arg1, ...keys[arg1] }, null, 2));
} else if (cmd === 'revoke') {
  delete keys[arg1];
  save(keys);
  console.log('Revocata:', arg1);
} else if (cmd === 'list') {
  console.table(Object.entries(keys).map(([k, v]) => ({ key: k.slice(0, 12) + '...', ...v })));
} else {
  console.log('Uso: node cli/keys.js <add [label] [credits] | topup <key> <credits> | revoke <key> | list>');
}
