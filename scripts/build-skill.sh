#!/bin/sh
# Rebuilds skills/lampo/SKILL.md from header + reference (single source of truth)
cd "$(dirname "$0")/.." && cat scripts/skill-header.md src/guide.md > skills/lampo/SKILL.md && echo "SKILL.md aggiornato"
