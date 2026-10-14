---
name: lampo
description: >
  Entry point for any request to make, animate or render a video or motion graphic with Lampo: ads, reels,
  TikToks, promos, product launches, app walkthroughs, explainers, kinetic typography, animated titles and
  quotes, stat/counter hits, logo stings, intros/outros, end cards, countdowns, beat-synced teasers, "video in
  stile Apple". Lampo renders a short JSON spec to MP4 in seconds (Skia, no browser). This skill runs the whole
  flow: intent, route, style, blueprints, spec, visual review, render.
---

# Lampo: motion graphics from JSON

Lampo turns a short JSON spec into an MP4. You don't write HTML, CSS or animation code: you choose layers and
named effects, and the motion engine does the hard part. A 15s 1080×1920 ad renders in seconds, a preview
sheet in ~1s, so you can look at your work and iterate like a motion designer.

**The bar is not "a video that plays". It's a video a motion designer would be proud of:** a hook in the first
half second, one signature move per scene, things that transform instead of just appearing, a single coherent
style, sound that lands on the motion, a clean final hold.

References (read them in the order of the flow; they are short):

| File | What's inside | Read when |
|---|---|---|
| `references/spec.md` | the full JSON reference: layers, effects, transitions, keyframes, sound | before writing the first spec |
| `references/categories.md` | 8 routes (social ad, product launch, motion graphic…): length, scenes, sequence | step 2 |
| `references/visual-styles.md` | 9 named styles with palette, type, motion and a runnable sample | step 3 |
| `references/blueprints.md` | 16 time-coded shot templates (kinetic slam, morph lockup, app demo…), all runnable | step 3–4 |
| `references/motion-principles.md` | easing, speed, choreography, continuity, composition, sound rules | step 4, and in review |
| `references/review.md` | proof frames, checklist, common defects → fixes | step 5 |

Without the files (MCP only): `lampo_guide` returns the same content; pass `topic`: `spec` (default),
`routes`, `styles`, `blueprints`, `motion`, `review`, or `all`.

## 0. Tools

| MCP | CLI | |
|---|---|---|
| `lampo_guide` | `lampo guide [topic]` | the references above |
| `lampo_validate` | `lampo validate spec.json` | fixable errors |
| `lampo_preview` | `lampo preview spec.json -o sheet.png` | contact sheet image (~1s); MCP accepts `times` |
| `lampo_still` | `lampo still spec.json <sec> -o f.png` | one full-res frame |
| `lampo_render` | `lampo render spec.json -o video.mp4 -q standard` | the MP4 |

No MCP and no global CLI: `npx lampo-video <command>` (Node 18+; ffmpeg is bundled).

## 1. Start from the state

Apply the first matching row:

| State | Action |
|---|---|
| The user asks only to render / preview / validate an existing spec | Do only that. |
| A specific edit to an existing spec ("make the logo bigger", "change scene 3") | Make the edit, preview the touched scene, render. No intent questions. |
| Feedback on a video you made ("it's boring", "too slow") | Map it with `references/review.md` (defects table) and `motion-principles.md`, change the motion, not just the copy. |
| A new video | Steps 2–6. |

## 2. Intent and route (at most one question)

Collect in one pass, from the request and the context; fill the gaps with defaults instead of asking:

- **Subject and the one message** (one sentence). Missing → this is the one question you ask.
- **Brand**: name, colors, logo file, font, website/handle. Missing → pick a style palette; don't ask.
- **Platform → format**: social = 9:16 (default), feed post = 1:1 or 4:5, YouTube/site = 16:9.
- **Length**: from the route. **Language**: the user's. **Media**: files the user gave (photos, clips, logo, music).
- **CTA**: one action ("book on lampo.video", "link in bio").

Then pick the route in `references/categories.md` (social-ad, product-launch, app-walkthrough, motion-graphic,
explainer, beat-promo, brand-sting, footage-promo). The route gives you length, scene count, copy structure
and a typical blueprint sequence.

## 3. Direction: a shot plan before any JSON

Write a short plan (show it to the user in 5–8 lines while you work; don't wait for approval unless they asked
to review first):

1. **Style** from `references/visual-styles.md` (mood first). Brand colors/font override the style's palette, never its motion rules.
2. **One blueprint per scene** from `references/blueprints.md`. Never the same blueprint twice in a row. Alternate loud and calm.
3. **Per scene:** time · blueprint · copy (2–6 words per line) · signature move · transition into it.
4. **One continuity moment** in the video (morph, color takeover, match position, shove).
5. **Sound:** `"sfx": true`, where the riser ends, where the one boom lands.

Example:

```
Style: Mono Motion · 9:16 · 12s · sfx on
1  0–3.4   kinetic-slam      "Still editing / for days?"          stamp→zoomOut→skewIn      (cut)
2  3.4–6.4 morph-lockup      "LAMPO" + "videos from JSON"        dot→line→pill, glitch name (cut, continuity: dot)
3  6.4–9.4 stat-hit          "3 s per render"                     counter + bar + delta pill (whip)
4  9.4–12  cta-press         "Try it free · lampo.video"          brand→button, click        (blur) riser→boom 9.4
```

## 4. Build the spec

- Start from the chosen blueprints: copy their JSON, swap the slots, apply the style's `theme`, background and effects. Re-time to your copy, keeping the rhythm (build 0–30%, breathe, resolve).
- Follow `references/motion-principles.md`: vary entrances, durations and easings; offset the first entrance; stagger by importance; one ambient loop per scene at most; three layers per scene; fill the frame.
- Use `references/spec.md` for every key. Common mistakes it prevents: `start`/`end` are relative to the scene (or to the parent group); `keyframes` `t` is relative to the layer's start; `in.delay` is relative to the layer's start; children of groups/phones use the parent's coordinates.
- Text is real copy in the user's language: no lorem ipsum, no placeholder brand names unless the user has none.
- Media the user gave: use it (photos as `image` backgrounds with `kenburns`, clips as `video`, the logo as an `image` with `iris`/`scaleIn`, music as `audio`).
- Save the spec to a file named after the project (`<brand>-<route>.json`) so later edits are easy.

## 5. Look at it, fix it

1. `lampo_validate` → fix every error (messages say what to change).
2. `lampo_preview` with proof `times` (opening, each signature move at its peak, each breathe phase, final hold).
3. Read the sheet like a director, go through the checklist in `references/review.md`, fix, and preview again. Two or three rounds are normal; use `lampo_still` for details (text edges, small labels).

Don't skip this step. Defects that are obvious in the image (cut text, overlaps, empty frames, a morph that jumps) are invisible in the JSON.

## 6. Render and deliver

- `lampo_render` with `quality: "standard"` (`high` for big screens, `draft` only to judge timing).
- Report: the file path, length and format, the style and the shot plan in 3–4 lines.
- Offer exactly one variation that would make it better or reach further (another hook, 1:1 cut, a version with their music). Don't list ten.

## What makes it "pazzesco": quick reference

- **Hook ≤ 0.5s**: a huge word (160–260, weight 900) with `stamp`/`zoomOut`, or a number already counting, or a shape already moving.
- **Signature move per scene**, named in the plan. If you can't name it, the scene is a slide.
- **Transform, don't cut**: one shape that becomes the next thing (`rect` keyframes on `w`/`h`/`radius`/`color`; `circle` `r` to 1300).
- **Camera**: a full-frame `group` with `scale`/`x`/`blur` keyframes = push-ins, pull-backs, pans with motion blur.
- **Contrast of speed**: 0.25s stamps next to 1.2s focuses; hard cuts next to slow fades.
- **Depth**: ghost type, glow backgrounds, accents that draw themselves.
- **Sound**: `sfx` on, a riser that ends on the reveal, one boom on the name.
- **Hold**: the final frame stays ≥ 1s, clean.
