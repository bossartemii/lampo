---
name: lampo
description: Make short videos — ads, reels, TikToks, promo clips, intros, animated titles, motion graphics, product launches — by writing a JSON spec that Lampo renders to MP4 in seconds. Use when the user asks for a video, spot, reel, animated text, motion ad or "video in stile Apple".
---

# Lampo — video from JSON

Lampo turns a short JSON spec into an MP4. You don't write HTML, CSS or animation code:
you pick layers and named effects, Lampo does the motion design. Rendering is Skia
(no browser), split across CPU cores, so a 15s 1080x1920 ad renders in seconds.

## Workflow (keep it to these steps)
1. Ask nothing unless brand name or the offer is missing. Decide format (9:16 for social by default), 3–5 scenes, 10–15s.
2. Write the spec (reference below). Short copy: 2–6 words per line, one idea per scene.
3. Look at it: `lampo_preview` tool (MCP) or `lampo preview spec.json` (CLI) → a keyframe sheet image. Check overlaps, text cut off, contrast, safe zone.
4. Fix what you saw, then render: `lampo_render` (MCP) or `lampo render spec.json -o video.mp4`.
   Use `quality: "draft"` for quick iterations, `standard` for delivery.
5. Report the file path and length. Offer one variation (other hook, other format).

If the MCP tools are not available, use the CLI: `npx lampo-video render spec.json` (needs Node 18+ and ffmpeg).

