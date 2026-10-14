# Review loop

Never render the final file without looking at it. Lampo gives you three ways to see the video:

| Tool (MCP) | CLI | Use |
|---|---|---|
| `lampo_validate` | `lampo validate spec.json` | errors in the spec, with what to fix |
| `lampo_preview` | `lampo preview spec.json -o sheet.png` | contact sheet, 3 frames per scene (~1s). Pass `times` to choose the frames |
| `lampo_still` | `lampo still spec.json 2.4 -o f.png` | one full-resolution frame, to check details |

## Proof frames

Don't only look at the default sheet. Ask for the frames that prove the design works:
- **the opening state** (t ≈ 0.3): is the hook already there?
- **each signature move at its peak** (the morph mid-way, the takeover at 50%, the crash of the ticker, the tap).
- **each scene's breathe phase** (≈ 60% of the scene): everything readable at once?
- **the final hold** (last 0.1s): brand + CTA clean?

`lampo_preview` with `"times": [0.3, 1.2, 2.6, 4.1, 6.0, 9.8]`.

## Checklist (fix every "no" before rendering)

**Readability**
- [ ] Every text fits the frame (nothing cut at the edges) and sits in the safe zone (9:16: y 15–80%, x 8–92%).
- [ ] Contrast: text readable on its background (on photos/video there is an `overlay`).
- [ ] No two texts overlap unintentionally in the breathe phase.
- [ ] Each line stays on screen long enough to read (~0.3s per word).

**Design**
- [ ] One style; one accent color; the same background family across scenes.
- [ ] Three layers per scene (background treatment, content, accent). No empty flat frame with one centered line.
- [ ] The hero is big (60–80% of the width) and the hierarchy is obvious at a glance.

**Motion**
- [ ] At least 2 different entrances per scene, no scene repeats the previous scene's hero entrance.
- [ ] Durations vary (fast stamps and slow focuses), first entrance offset 0.1–0.3s.
- [ ] Each scene has a signature move; at least one continuity moment (morph, takeover, match position, shove) in the video.
- [ ] Transitions: at least two different types and one hard cut in 4+ scenes.

**Story**
- [ ] The hook lands in the first 1.5s.
- [ ] One idea per scene; the CTA is a single action with the brand name; the final frame holds ≥ 1s.

## Common defects → fixes

| You see | Fix |
|---|---|
| text cut off at the edges | lower `size`, add `\n`, or keep default `fit` (don't set `fit: false` on real copy) |
| text overlapping another | stagger with `start`/`end`, or move `y` by ≥ size × 1.2 |
| flat, empty-looking scene | `glow` or animated `gradient` background, ghost type (opacity 0.05, `drift`), a growing `line`, a pinned label |
| everything appears at once | `delay` / `start` staggered 0.1–0.4s in order of importance |
| feels slow / boring | shorten scenes to 2.5–3.5s, use hard cuts, a `whip`, a scale punch on the key word, `"sfx": true` |
| feels chaotic | fewer effects: one signature move per scene, the rest `fade`/`fadeUp` |
| cursor tap doesn't match the button press | the cursor `tap` time (cursor `start` + point `t`) must equal the button's press keyframe time in the same clock |
| shape morph jumps | every morph keyframe needs the same props (`w`, `h`, `radius`) on both sides; add `easing: "inOut"` |
| takeover shows a seam | the circle color must equal the next scene's background, and the next scene has no transition |
| text on a photo unreadable | `overlay` 0.45–0.55, or put the text in a pill (`bg`) |

Loop: preview → fix → preview. Two or three rounds are normal. Render `quality: "draft"` only if you need to
judge timing in motion; then deliver with `standard` (or `high` for big screens).
