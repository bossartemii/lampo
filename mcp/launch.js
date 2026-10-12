#!/usr/bin/env node
'use strict';
// Starts the MCP server when Lampo is installed as a Claude Code plugin or a
// Gemini CLI extension: if the render engine is missing, installs it once into
// a data folder, then launches the server. All logging goes to stderr because
// stdout is reserved for the MCP protocol.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA = process.env.CLAUDE_PLUGIN_DATA || process.env.LAMPO_HOME || path.join(os.homedir(), '.lampo');
const DEPS = ['@napi-rs/canvas@^0.1.100', 'ffmpeg-static@^5.2.0'];

function hasCanvas(paths) {
  try { require.resolve('@napi-rs/canvas', { paths }); return true; } catch { return false; }
}

const nodePaths = [path.join(ROOT, 'node_modules'), path.join(DATA, 'node_modules')];
if (!hasCanvas([ROOT]) && !hasCanvas([DATA])) {
  fs.mkdirSync(DATA, { recursive: true });
  if (!fs.existsSync(path.join(DATA, 'package.json'))) fs.writeFileSync(path.join(DATA, 'package.json'), '{"name":"lampo-deps","private":true}');
  process.stderr.write(`[lampo] first run: installing the render engine in ${DATA}...\n`);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npm, ['install', '--no-audit', '--no-fund', '--omit=dev', ...DEPS], { cwd: DATA, stdio: ['ignore', 2, 2], shell: process.platform === 'win32' });
  if (r.status !== 0) process.stderr.write('[lampo] install failed: run "npm install" in the Lampo folder.\n');
}

const env = { ...process.env, NODE_PATH: [...nodePaths, process.env.NODE_PATH].filter(Boolean).join(path.delimiter) };
const child = spawn(process.execPath, [path.join(__dirname, 'server.js'), ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
