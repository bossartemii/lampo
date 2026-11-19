#!/usr/bin/env bash
# Lampo preflight: which render path works in this environment? Deterministic, in order:
#   1. a `lampo` command already installed
#   2. the CLI straight from GitHub through npx (first run downloads it; 90 s limit)
#   3. Lampo Cloud over HTTP (20 s for a cold start, one retry with 90 s)
# Prints the result on the last line as LAMPO_PATH=cli|npx|cloud|none, plus the command or URL to use.
# MCP tools are not checked here: if the agent has lampo_* tools, it uses them and skips this script.
# Usage: bash preflight.sh [cloud-url]
set -u
CLOUD="${1:-${LAMPO_CLOUD_URL:-https://dimaartemi-lampo.hf.space}}"
CLOUD="${CLOUD%/}"
have() { command -v "$1" >/dev/null 2>&1; }
limit() { if have timeout; then timeout "$@"; else shift; "$@"; fi; }

if have lampo && limit 30 lampo version 2>/dev/null | grep -q "canvas ok"; then
  echo "lampo: $(lampo version)"
  echo "LAMPO_PATH=cli LAMPO_CMD=lampo"
  exit 0
fi

if have node && have npx; then
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "${major:-0}" -ge 18 ]; then
    echo "trying npx github:bossartemii/lampo (the first run downloads it, up to 90 s)…" >&2
    # only a working engine counts: the canvas binary loaded and ffmpeg found
    if out="$(limit 90 npx -y github:bossartemii/lampo version 2>/dev/null)" && printf '%s' "$out" | grep -q "canvas ok"; then
      echo "npx: $out"
      echo "LAMPO_PATH=npx LAMPO_CMD='npx -y github:bossartemii/lampo'"
      exit 0
    fi
    echo "npx: not usable here (offline, blocked, or too slow)" >&2
  else
    echo "node: version $major is too old (Lampo needs 18+)" >&2
  fi
else
  echo "node/npx: not installed" >&2
fi

if have curl; then
  for wait in 20 90; do
    echo "trying Lampo Cloud $CLOUD (up to ${wait} s, it may be waking up)…" >&2
    if curl -fsS -m "$wait" "$CLOUD/health" 2>/dev/null | grep -q '"ok":true'; then
      echo "cloud: $CLOUD is up"
      echo "LAMPO_PATH=cloud LAMPO_URL=$CLOUD"
      exit 0
    fi
  done
  echo "cloud: $CLOUD did not answer" >&2
else
  echo "curl: not installed, cannot reach Lampo Cloud" >&2
fi

echo "No way to render here. Deliver the spec file and these two ways to render it:"
echo "  npx -y github:bossartemii/lampo render spec.json -o video.mp4      (Node 18+)"
echo "  curl -X POST $CLOUD/api/render -H 'content-type: application/json' -d '{\"spec\": <spec>}'"
echo "LAMPO_PATH=none"
exit 1
