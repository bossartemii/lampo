# Lampo Cloud

Lampo as a hosted service: one HTTPS server that renders on its own machine, so nobody has to install
Node or ffmpeg. It works in **ChatGPT** and **Claude.ai** (web and mobile), in any MCP client, and in the
[playground](https://bossartemii.github.io/lampo/playground/) ("Render on Lampo Cloud").

It is the same `mcp/server.js`, started with `--http`:

| Endpoint | What |
|---|---|
| `POST /mcp` with `Authorization: Bearer <key>` | MCP for clients that can send headers (Claude Code, Cursor, Codex…) |
| `POST /mcp/<key>` | MCP with the key in the URL, for **ChatGPT and Claude.ai connectors** (they can't send headers) |
| `POST /api/render` `{ "spec": {…}, "quality": "standard" }` | REST render → `{ url, duration, width, height, renderSeconds, creditsLeft }` |
| `POST /api/validate` `{ "spec": {…} }` | REST validation → `{ ok, duration, scenes, size }` or `{ error }` with what to fix |
| `GET /files/<name>?expires&sig` | the rendered MP4, behind a signed link valid 15 minutes |
| `GET /health` | `{ ok, version, busy }` |
| `POST /admin/keys` (master key) | create, top up, revoke client keys — or use `cli/cloud.js` |

What the server enforces:
- **Keys and credits**: one credit per render (`lampo_render` or `/api/render`); validation and previews are free. The master key (`LAMPO_TOKEN`) has no limit.
- **Limits**: 60 s, 30 fps, 1920×1920, 50 scenes, 300 layers, 1 MiB per request, one render at a time (others get "busy", HTTP 429).
- **Media**: specs can only use `https://` URLs or `data:` URIs. Files from the server's disk and addresses inside its network (localhost, 10.x, 192.168.x, cloud metadata…) are refused.
- **Files** are deleted after 30 minutes.

## 1. Deploy

### Hugging Face Spaces (free, no credit card)
Free CPU Spaces have 2 vCPU and 16 GB of RAM, plenty for Lampo. The free way is a **Gradio** Space (Docker Spaces need a paid plan):
its `app.py` can start any server on the Space's port, so ours downloads Lampo and runs it. Everything happens in the browser:

1. On huggingface.co: **New Space** → name it (e.g. `lampo`) → SDK **Gradio** → template **Blank** → hardware **Free** → **Public** (a private Space can't be reached by ChatGPT or Claude.ai).
   For hardware pick **CPU basic**. If the Space ends up on **ZeroGPU** it works too: `app.py` declares the GPU function ZeroGPU asks for, and Lampo still renders on the CPU.
2. **Files → Add file → Upload files**: upload the three files in [`cloud/huggingface-free/`](cloud/huggingface-free/): `app.py`, `packages.txt` and `README.md` (it replaces the Space's README; the header at the top configures the Space).
3. **Settings → Variables and secrets → New secret**:
   - `LAMPO_TOKEN`: your master key, any random string of at least 32 characters
   - `LAMPO_KEYS` (optional): client keys as JSON, `{"lk_<at least 32 characters>": {"label": "Mario", "credits": 50}}`
4. Wait for the build and the first start (a few minutes: it installs Node and ffmpeg, then downloads Lampo), then open `https://<user>-<space>.hf.space/health`.

On Spaces the public URL is detected by itself (`SPACE_HOST`) and the link-signing secret is generated at every start,
so `LAMPO_PUBLIC_URL` and `LAMPO_FILE_SECRET` are not needed. The free tier has no persistent disk: keys come back
from `LAMPO_KEYS` at every restart, with their credits reset. A free Space sleeps after 48 hours without visits and
wakes up on the next request (about a minute). Lampo is downloaded from GitHub `main`: to update, **Settings → Factory rebuild**.

With a paid plan you can use a **Docker** Space instead: upload [`cloud/huggingface/Dockerfile`](cloud/huggingface/Dockerfile) and [`cloud/huggingface/README.md`](cloud/huggingface/README.md).

### Other hosts

You need three secrets:

```bash
LAMPO_TOKEN=$(openssl rand -hex 24)         # master key: admin + unlimited renders
LAMPO_FILE_SECRET=$(openssl rand -hex 24)   # signs the download links
LAMPO_PUBLIC_URL=https://video.example.com  # where the server is reachable (used in download links)
```

### Fly.io (`fly.toml` is in the repo)
```bash
fly launch --no-deploy --copy-config        # pick an app name
fly volumes create lampo_data --size 1      # keys and credits survive deploys
fly secrets set LAMPO_TOKEN=... LAMPO_FILE_SECRET=... LAMPO_PUBLIC_URL=https://<app>.fly.dev
fly deploy
```
Machines stop when idle and start on the next request. A performance machine renders a 15 s 1080×1920 ad in a few seconds.

### Render (`render.yaml` is in the repo)
New → Blueprint → this repository. It creates the service with a disk and generates the two secrets.
After the first deploy, set `LAMPO_PUBLIC_URL` to the service URL and redeploy.

### Any VPS with Docker
```bash
docker build -t lampo-cloud .
docker run -d --restart unless-stopped -p 3333:3333 -v lampo-data:/data \
  -e LAMPO_TOKEN=... -e LAMPO_FILE_SECRET=... -e LAMPO_PUBLIC_URL=https://video.example.com lampo-cloud
```
Put HTTPS in front, for example with Caddy: `caddy reverse-proxy --from video.example.com --to localhost:3333`.
To try it without a domain: `cloudflared tunnel --url http://localhost:3333`.

Check it: `curl https://video.example.com/health`

## 2. Create keys

On a host with a disk (Fly.io, Render, a VPS) keys are created and topped up live; on Hugging Face put them in the `LAMPO_KEYS` secret.

```bash
export LAMPO_CLOUD_URL=https://video.example.com LAMPO_TOKEN=<master key>
node cli/cloud.js add client@example.com 50     # → lk_… with 50 renders
node cli/cloud.js topup lk_… 100
node cli/cloud.js list
node cli/cloud.js revoke lk_…
```

## 3. Connect

| Where | How |
|---|---|
| **Claude.ai** (web, desktop, mobile) | Add a custom connector with the URL `https://video.example.com/mcp/lk_…` (no OAuth) |
| **ChatGPT** | Add an MCP connector (developer mode) with the URL `https://video.example.com/mcp/lk_…`, no authentication |
| **Claude Code** | `claude mcp add --transport http lampo https://video.example.com/mcp --header "Authorization: Bearer lk_…"` |
| **Cursor, Codex, other MCP clients** | URL `https://video.example.com/mcp`, header `Authorization: Bearer lk_…` |
| **Playground** | "Render on Lampo Cloud": the URL and the key. Set `cloudUrl` in `docs/playground/config.js` to pre-fill the URL for visitors |
| **Your app** | `curl -X POST https://video.example.com/api/render -H "Authorization: Bearer lk_…" -H "content-type: application/json" -d '{"spec": {...}}'` |

Treat a URL with a key in it like a password: anyone who has it spends that key's credits. Revoke and reissue if it leaks.

## Test

`node test/cloud.js` starts a local server and checks keys, credits, the REST API, MCP with the key in the URL,
signed links and the media rules. It runs with `npm test`.
