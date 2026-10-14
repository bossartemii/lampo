#!/bin/sh
# Copies the spec reference (src/guide.md, single source of truth) into the skill's references.
# The other references live in skills/lampo/references/ and are read directly by the MCP server and CLI.
cd "$(dirname "$0")/.." && cp src/guide.md skills/lampo/references/spec.md && echo "skills/lampo/references/spec.md updated"
