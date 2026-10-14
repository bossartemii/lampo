# Lampo Cloud on a free Hugging Face Space (Gradio SDK, which stays free).
# A Space runs `python app.py` and serves whatever listens on port 7860: here that is the Lampo
# MCP / REST server (Node). packages.txt installs Node, ffmpeg and fonts; this file downloads Lampo
# from GitHub on the first start and runs it. Settings → Factory rebuild updates it.
import os
import subprocess

HOME = os.path.expanduser("~")
APP = os.path.join(HOME, "lampo")
REF = os.environ.get("LAMPO_REF", "main")

if not os.path.exists(os.path.join(APP, "package.json")):
    print(f"Downloading Lampo ({REF})…", flush=True)
    subprocess.run(["git", "clone", "--depth", "1", "--branch", REF, "https://github.com/bossartemii/lampo", APP], check=True)
    # keep optional dependencies: the canvas engine's native binary is one of them
    subprocess.run(["npm", "ci", "--omit=dev", "--no-audit", "--no-fund"], cwd=APP, check=True)

env = dict(os.environ)
env["PORT"] = "7860"  # the port the Space serves
env.setdefault("LAMPO_OUT", os.path.join(HOME, "lampo-out"))
env.setdefault("LAMPO_KEYS_FILE", os.path.join(HOME, "lampo-data", "keys.json"))
os.chdir(APP)
print("Starting Lampo Cloud on port 7860", flush=True)
os.execvpe("node", ["node", "mcp/server.js", "--http", "7860"], env)
