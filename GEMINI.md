# Lampo

You have the Lampo MCP tools for making videos (ads, reels, motion graphics) from a JSON spec.
When the user asks for a video, work like a motion designer:
1. `lampo_guide` (spec), then `lampo_guide` with `topic: "routes"`, `"styles"` and `"blueprints"`.
2. Pick the route (video type), one visual style, and one blueprint per scene; write a short shot plan.
3. Write the spec following `lampo_guide` `topic: "motion"` (varied entrances and timing, continuity, 3 layers per scene).
4. `lampo_preview` with proof `times`, check it with `lampo_guide` `topic: "review"`, fix, then `lampo_render`.
Defaults: 9:16, 10–15 seconds, short copy in the user's language, `"sfx": true`. Full workflow in the `lampo` skill.
