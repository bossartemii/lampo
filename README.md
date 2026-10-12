<div align="center">

# ⚡ Lampo

**Motion graphics from JSON, built for AI agents.**
Ads, reels, TikToks, product launches and animated titles — rendered in seconds, without a browser.

Works as a **Claude Code plugin**, a **Gemini CLI extension**, an **MCP server** (Claude Desktop, Cursor, Codex, ChatGPT) and a **CLI / Node library**.

[![GitHub stars](https://img.shields.io/github/stars/bossartemii/lampo?style=social)](https://github.com/bossartemii/lampo/stargazers) &nbsp; [![License](https://img.shields.io/badge/license-Apache%202.0-black)](LICENSE)

[Quick start](#quick-start) · [Why it's fast](#why-its-fast) · [Spec reference](src/guide.md) · [Examples](examples/) · [Italiano](README.it.md)

<img src="media/coffee.gif" height="420" alt="9:16 coffee shop ad made with Lampo"> &nbsp; <img src="media/launch.gif" height="236" alt="16:9 product launch made with Lampo">

<sub>Both videos above are ~2 KB of JSON each: <a href="examples/coffee.json">coffee.json</a> · <a href="examples/launch.json">launch.json</a></sub>

</div>

---

## The idea

Today an AI agent that makes a video writes hundreds of lines of HTML, CSS and GSAP (HyperFrames) or React (Remotion), then a headless Chrome takes a screenshot of every frame. It works, but it's slow, and agents break animations, timing and layout all the time.

Lampo flips it around. The agent writes a short JSON spec with **named effects** (`"in": "rise"`, `"transition": "zoom"`). All the motion design lives in a tested engine that draws frames directly with **Skia** (the graphics library inside Chrome, without Chrome), splits the video across CPU cores and encodes in parallel.

```json
{
  "format": "9:16",
  "scenes": [
    {
      "duration": 3,
      "background": { "type": "glow", "colors": ["#B45309", "#F59E0B"] },
      "layers": [
        { "text": "Monday?", "size": 190, "weight": 900, "in": "zoomOut" },
        { "text": "We've got **you**.", "size": 80, "y": "55%", "in": { "effect": "wordsUp", "delay": 0.6 } }
      ]
    },
    {
      "duration": 3, "transition": "zoom",
      "layers": [ { "type": "counter", "to": 1240, "suffix": " cups", "size": 170, "in": "popIn" } ]
    }
  ]
}
```

## Why it's fast

**Render speed.** Same 10.9 s ad, 1080×1920 @ 30 fps, on a 2-core machine:

| Pipeline | Time | |
|---|---|---|
| Browser method — headless Chrome + per-frame screenshot + ffmpeg (the pipeline behind Remotion and HyperFrames) | **53.4 s** | |
| Lampo, `standard` quality | **13.7 s** | ~3.9× faster |
| Lampo, `draft` quality (540×960, for iterating) | **3.0 s** | ~18× faster |

The comparison reproduces the underlying browser pipeline, not those tools themselves — run it yourself with [`bench/browser-baseline.js`](bench/browser-baseline.js). Lampo does more work in that test (scene transitions, counter, typewriter). More cores = bigger gap, because chunks render in parallel.

**Agent speed** — the part that matters most:

- **Less to write.** The demo ad is 2.3 KB of JSON; the HTML/CSS equivalent is 3.9 KB *without* transitions or the counter. Fewer tokens, fewer bugs.
- **Errors written for agents.** `effect "flyIn" does not exist. Effects: fade, fadeUp, …` — fixed on the first retry. Lenient JSON parsing (comments, trailing commas).
- **The agent can see.** `lampo_preview` returns a keyframe contact sheet as an image in ~1 s, so the agent catches overlaps and cut-off text before rendering.
- **Safe by default.** Text that doesn't fit is scaled down automatically; counters size themselves on the final value.

| | Lampo | HyperFrames | Remotion |
|---|---|---|---|
| Agent writes | JSON with named effects | HTML + CSS + GSAP | React (TSX) |
| Renderer | Skia, no browser | Headless Chrome | Headless Chrome |
| Visual preview for the agent | Built in (MCP image) | Browser / render | Studio / render |
| License | Apache 2.0 | Apache 2.0 | Paid company license above 3 people |
| Arbitrary HTML/CSS | ✗ (the price of speed) | ✓ | ✓ (JSX) |
| Distributed cloud rendering | Single machine (for now) | Single machine | ✓ Lambda |

## Quick start

Requires **Node 18+**. ffmpeg comes bundled (`ffmpeg-static`) or uses your system one.

```bash
git clone https://github.com/bossartemii/lampo && cd lampo && npm install
npx lampo init my-ad             # starter spec
npx lampo preview my-ad.json     # keyframe sheet (PNG)
npx lampo render my-ad.json      # → my-ad.mp4
```

### Claude Code — plugin (skill + MCP)
```
/plugin marketplace add bossartemii/lampo
/plugin install lampo@lampo
```
Then just ask: *"make a 15-second vertical ad for my bakery"*.

### Gemini CLI — extension (skill + MCP)
```bash
gemini extensions install https://github.com/bossartemii/lampo
```

### Claude Desktop, Cursor, Windsurf, any MCP client
```json
{ "mcpServers": { "lampo": { "command": "node", "args": ["/path/to/lampo/mcp/launch.js"] } } }
```

### OpenAI Codex CLI — `~/.codex/config.toml`
```toml
[mcp_servers.lampo]
command = "node"
args = ["/path/to/lampo/mcp/launch.js"]
```

### ChatGPT and Claude.ai on the web — remote MCP
Web clients need an HTTPS server:
```bash
LAMPO_PUBLIC_URL=https://video.example.com LAMPO_TOKEN=secret node mcp/server.js --http 3333
```
Host it on any VPS (or try it with `cloudflared tunnel --url http://localhost:3333`), then add `https://…/mcp` as a connector. Rendered videos download from `/files/<name>.mp4`. `LAMPO_TOKEN` is optional and requires `Authorization: Bearer <token>`.

## MCP tools

| Tool | What it does |
|---|---|
| `lampo_guide` | Full spec reference + design recipes. The agent reads it once. |
| `lampo_preview` | Keyframe contact sheet as an image (~1 s) |
| `lampo_still` | One full-resolution frame as an image |
| `lampo_validate` | Checks a spec, returns fixable errors |
| `lampo_render` | Renders the MP4, returns path, stats and (HTTP mode) a download URL |

## What's inside

- **Formats** 9:16, 1:1, 4:5, 16:9 or custom · 1–120 fps · draft / standard / high
- **Layers** text (with `**highlights**`, gradients, stroke, pill buttons, auto-fit), counter (locale-aware), rect, circle, line, image
- **20 enter/exit effects** incl. `rise` (keynote-style line masks), `wordsUp`, `letters`, `typewriter`, `blurIn`, `zoomOut`, `popIn`, `grow`
- **7 loops** float, pulse, rotate, kenburns, drift, shake, breathe · **9 easings** + cubic-bezier
- **8 transitions** fade, slide, push, slideUp, zoom, wipe, blur, none
- **Backgrounds** solid, animated gradient, `glow` (soft drifting light), image with Ken Burns
- **Audio** with fades · **custom fonts** · **global layers** (logo, watermark) · vignette

Full reference: [`src/guide.md`](src/guide.md) · Examples: [`examples/`](examples/) (Italian ones in [`examples/it/`](examples/it/))

## Roadmap

- [ ] Video clips as layers (b-roll under the text)
- [ ] Auto-captions from audio (Whisper)
- [ ] Template packs per industry (restaurants, real estate, gyms, SaaS)
- [ ] **Lampo Cloud** — hosted MCP endpoint: no install, works in ChatGPT and Claude.ai, render on fast machines

## Support the project

Lampo is free and open source. If it saves you time:

- ⭐ **Star the repo** — it's how others find it
- 💛 **[Sponsor on GitHub](https://github.com/sponsors/bossartemii)**
- ☁️ **Lampo Cloud & custom templates** — [open an issue](https://github.com/bossartemii/lampo/issues/new?title=Lampo%20Cloud%20early%20access&labels=cloud) to join early access

## Development

```bash
npm test                          # smoke test: every effect, transition, image, audio
node bench/browser-baseline.js    # benchmark vs the browser pipeline (needs puppeteer)
./scripts/build-skill.sh          # rebuild skills/lampo/SKILL.md from src/guide.md
```

```
src/          engine: spec (validation) · frame (drawing) · effects · render (parallel)
mcp/          server.js (stdio + HTTP, zero deps) · launch.js (installs the engine on first run)
cli/          command line
skills/lampo/ SKILL.md shared by Claude Code and Gemini CLI
```

Contributions welcome — new effects live in [`src/effects.js`](src/effects.js) and are a few lines each.

## License

[Apache 2.0](LICENSE) © Dimitri Artemii
