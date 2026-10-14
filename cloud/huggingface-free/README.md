---
title: Lampo Cloud
emoji: ⚡
colorFrom: yellow
colorTo: gray
sdk: gradio
sdk_version: 4.44.1
app_file: app.py
app_port: 7860
pinned: false
license: apache-2.0
short_description: Motion graphics from JSON, rendered for AI agents
---

# Lampo Cloud

[Lampo](https://github.com/bossartemii/lampo) as an MCP server and REST API: render MP4 videos from a JSON spec
from ChatGPT, Claude.ai, Claude Code, Cursor or any app. `app.py` runs the Lampo server (Node) on this Space's port.
Setup and connection guide: [CLOUD.md](https://github.com/bossartemii/lampo/blob/main/CLOUD.md).

- MCP: `https://<this-space>.hf.space/mcp/<key>` (ChatGPT, Claude.ai) or `/mcp` with `Authorization: Bearer <key>`
- REST: `POST /api/render { "spec": {...} }`
- Health: `GET /health`
