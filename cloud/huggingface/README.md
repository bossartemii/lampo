---
title: Lampo Cloud
emoji: ⚡
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
license: apache-2.0
short_description: Motion graphics from JSON, rendered for AI agents
---

# Lampo Cloud

[Lampo](https://github.com/bossartemii/lampo) as an MCP server and REST API: render MP4 videos from a JSON spec
from ChatGPT, Claude.ai, Claude Code, Cursor or any app. Setup and connection guide:
[CLOUD.md](https://github.com/bossartemii/lampo/blob/main/CLOUD.md).

- MCP: `https://<this-space>.hf.space/mcp/<key>` (ChatGPT, Claude.ai) or `/mcp` with `Authorization: Bearer <key>`
- REST: `POST /api/render { "spec": {...} }`
- Health: `GET /health`
