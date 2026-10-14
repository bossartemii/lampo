# Lampo Cloud on a free Hugging Face Space (Gradio SDK, which stays free).
#
# The Space serves a Gradio app on port 7860. Lampo's MCP / REST server (Node) runs next to it
# on port 7861, and this app forwards Lampo's routes to it: /mcp, /mcp/<key>, /api/…, /buy/…,
# /paid, /files/<name>, /health. packages.txt installs Node, ffmpeg and fonts; Lampo is
# downloaded from GitHub on the first start (Settings → Factory rebuild updates it).

# ZeroGPU hardware checks, when the Gradio app launches, that at least one @spaces.GPU function
# exists. Lampo renders on the CPU, so this one is never called. Import `spaces` first.
try:
    import spaces

    @spaces.GPU
    def unused_gpu_slot():
        return None
except ImportError:
    spaces = None

import os
import subprocess
import time

import gradio as gr
import httpx
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Route

HOME = os.path.expanduser("~")
APP = os.path.join(HOME, "lampo")
REF = os.environ.get("LAMPO_REF", "main")
NODE_PORT = 7861
NODE = f"http://127.0.0.1:{NODE_PORT}"
HOST = os.environ.get("SPACE_HOST", "localhost:7860")

if not os.path.exists(os.path.join(APP, "package.json")):
    print(f"Downloading Lampo ({REF})…", flush=True)
    subprocess.run(["git", "clone", "--depth", "1", "--branch", REF, "https://github.com/bossartemii/lampo", APP], check=True)
    # keep optional dependencies: the canvas engine's native binary is one of them
    subprocess.run(["npm", "ci", "--omit=dev", "--no-audit", "--no-fund"], cwd=APP, check=True)

env = dict(os.environ)
env["PORT"] = str(NODE_PORT)
env.setdefault("LAMPO_OUT", os.path.join(HOME, "lampo-out"))
env.setdefault("LAMPO_KEYS_FILE", os.path.join(HOME, "lampo-data", "keys.json"))
server = subprocess.Popen(["node", "mcp/server.js", "--http", str(NODE_PORT)], cwd=APP, env=env)
for _ in range(100):
    try:
        if httpx.get(f"{NODE}/health", timeout=1).status_code == 200:
            break
    except httpx.HTTPError:
        pass
    if server.poll() is not None:
        raise SystemExit("Lampo server stopped while starting, see the logs above")
    time.sleep(0.2)
print(f"Lampo server ready on {NODE_PORT}", flush=True)

client = httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=5.0))
HOP = {"host", "content-length", "connection", "transfer-encoding", "content-encoding", "keep-alive"}


async def forward(request: Request) -> Response:
    url = f"{NODE}{request.url.path}" + (f"?{request.url.query}" if request.url.query else "")
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP}
    r = await client.request(request.method, url, content=await request.body(), headers=headers)
    return Response(r.content, status_code=r.status_code, headers={k: v for k, v in r.headers.items() if k.lower() not in HOP})


METHODS = ["GET", "POST", "DELETE", "OPTIONS"]
ROUTES = [Route(p, forward, methods=METHODS) for p in ["/mcp", "/mcp/{key}", "/api/render", "/api/validate", "/api/checkout", "/api/clean", "/buy/{id}", "/paid", "/files/{name}", "/health", "/admin/keys"]]

with gr.Blocks(title="Lampo Cloud") as demo:
    gr.Markdown(f"""
# ⚡ Lampo Cloud

Motion graphics from JSON, rendered for AI agents. This Space runs the [Lampo](https://github.com/bossartemii/lampo) server.

| | |
|---|---|
| **Claude.ai / ChatGPT** connector URL | `https://{HOST}/mcp/<your key>` |
| **Claude Code, Cursor, Codex** | `https://{HOST}/mcp` with `Authorization: Bearer <your key>` |
| **REST** | `POST https://{HOST}/api/render` with `{{"spec": {{...}}}}` |
| **Playground** | [bossartemii.github.io/lampo/playground](https://bossartemii.github.io/lampo/playground/) → *Render on Lampo Cloud* |
| **Status** | [`/health`](https://{HOST}/health) |

Guide: [CLOUD.md](https://github.com/bossartemii/lampo/blob/main/CLOUD.md)
""")

# Gradio 5 runs a Node server-side renderer by default: not needed here
demo.launch(server_name="0.0.0.0", server_port=7860, ssr_mode=False, prevent_thread_lock=True)
# Lampo's routes go before Gradio's own (Gradio also has /api/... routes)
demo.app.router.routes[0:0] = ROUTES
print("Lampo Cloud ready on port 7860", flush=True)
demo.block_thread()
