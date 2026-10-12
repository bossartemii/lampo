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

# Lampo spec — reference for AI agents

You describe a video as JSON. Lampo renders it to MP4 (no browser, Skia engine, parallel).
Write the spec, call `preview` once to look at it, fix, then `render`.

## Top level
```json
{
  "format": "9:16",            // 9:16 | 1:1 | 4:5 | 16:9  (design space 1080 wide; 16:9 is 1920x1080)
  "fps": 30,
  "quality": "standard",       // draft (half res, fastest) | standard | high
  "theme": { "font": "Inter", "color": "#fff", "accent": "#0A84FF", "background": "#000", "locale": "en-US" },
  "vignette": true,            // optional dark edges, cinematic
  "audio": "music.mp3",        // optional; or { "src", "volume", "start", "fadeIn", "fadeOut" }
  "sfx": true,                 // automatic sound effects synced to the animations (or { "auto": true, "volume": 0.8 })
  "sounds": [{ "sound": "riser", "at": 1.2 }],   // optional manual sounds, absolute seconds
  "fonts": [{ "path": "Brand.ttf", "family": "Brand" }],
  "scenes": [ ... ],           // played in order
  "layers": [ ... ]            // optional global layers on top of everything, absolute times (logo, watermark)
}
```

## Scene
```json
{ "duration": 3, "transition": "fade", "background": ..., "layers": [ ... ] }
```
- `transition` (into this scene): none | fade | slide | push | slideUp | zoom | wipe | blur. Or `{ "type": "zoom", "duration": 0.6 }`. Overlaps the previous scene.
- `background`:
  - `"#101010"` solid
  - `["#1a0b02", "#3d1402"]` or `{ "type": "gradient", "colors": [...], "angle": 160, "animate": 10 }` (animate = degrees/sec)
  - `{ "type": "glow", "base": "#05050a", "colors": ["#0A84FF", "#BF5AF2"], "intensity": 0.55, "speed": 0.25 }` — soft moving light blobs, the "Apple keynote" look
  - `{ "type": "image", "src": "photo.jpg", "overlay": "rgba(0,0,0,.45)", "kenburns": true }`
  - `{ "type": "video", "src": "broll.mp4", "overlay": "rgba(0,0,0,.35)", "trim": 2, "rate": 1, "loop": true, "audio": false }` — b-roll filling the frame (cover crop), text goes on top

## Layer (common keys)
- `type`: text | counter | rect | circle | line | image | video (inferred from `text` / `src` if omitted)
- `x`, `y`: px in design space, `"50%"`, or `"center" | "left" | "right" | "top" | "bottom"`. Default: center.
- `anchor`: center (default) | top | bottom | left | right | top-left | ...
- `start`, `end` or `duration`: seconds relative to the scene (default: whole scene)
- `in`: entrance effect. `"fadeUp"` or `{ "effect": "fadeUp", "delay": 0.4, "duration": 0.7, "easing": "apple" }`
- `out`: exit effect, same names, played in reverse at the end of the layer
- `loop`: `"float"` or `{ "effect": "pulse", "amount": 0.04, "period": 1.2 }` or an array
- `opacity`, `scale`, `rotate`, `shadow: true`, `glow: "rgba(255,160,0,.6)"`

### text
`text` (`\n` for new lines, `**word**` = accent color), `size` (default 72), `weight` (100–900, default 700),
`font`, `color` (string or gradient array), `accent`, `align` (center|left|right), `maxWidth` (default 86% width),
`lineHeight` (1.12), `letterSpacing` (px), `wrap: false` (single line), `fit: false` (by default text too wide for `maxWidth` is scaled down automatically), `stroke: { "color", "width" }`,
`bg: { "color": "#FF9F0A", "radius": 60, "padding": 34 }` (pill/button behind text), `caret: false` (typewriter).

### counter
Animated number: `from`, `to`, `prefix`, `suffix`, `decimals`, `locale` (default `theme.locale` or "en-US": 1,240.5; "it-IT": 1.240,5), `grouping: false`, `countDuration` (1.6s). Plus all text keys.

### video
A clip as a layer: `src` (mp4, mov, webm…), `w`, `h` (one is enough, the other follows the clip's aspect), `fit` (cover|contain), `radius`, `shadow`, `overlay` (tint on top),
`trim` (start the clip at N seconds), `rate` (0.5 = slow motion, 2 = double speed), `loop` (true by default; false freezes on the last frame),
`audio: true` or `volume: 0.6` to hear the clip's own sound (muted by default). All effects work on it (`in`, `out`, `loop` animations via `{ "effect": ... }`).

### rect / circle / line / image
- rect: `w`, `h`, `radius`, `color` (or gradient array), `stroke`
- circle: `r`, `color`
- line: `w`, `h` (thickness), `color` — use `in: "grow"` for an underline that draws itself
- image: `src` (local path or URL), `w`, `h`, `fit` (cover|contain), `radius`

## Effects
Entrance/exit (any layer): fade, fadeUp, fadeDown, slideLeft, slideRight, scaleIn, popIn, zoomOut, blurIn, drop, spin, wipe, wipeUp, grow, growUp
Text only (animate per unit): rise (lines slide up from a mask — keynote style), wordsUp, wordsPop, letters, typewriter
Loops: float, pulse, rotate, kenburns, drift, shake, breathe
Easings: apple (default), linear, in, out, inOut, expoOut, backOut, elasticOut, bounceOut, or a cubic-bezier array [x1,y1,x2,y2]

## Sound effects
Synthesized by Lampo (no audio files, no licensing). Sounds: whoosh, swoosh, swipe, pop, click, tick, impact, boom, riser, ding, chime, glitch.
- `"sfx": true` at top level adds them automatically: whoosh on slide/push/zoom/blur transitions, pop on popIn/wordsPop, impact on big zoomOut/drop titles, swoosh on rise/wordsUp/blurIn, swipe on slides and grow, ticks on typewriter/letters, ticks + ding on counters. Mixed under the music if `audio` is set.
- Per layer: `"sfx": "boom"` or `{ "sound": "ding", "at": 0.3, "volume": 0.6 }` (at = seconds from the layer start), `"sfx": false` to mute it.
- Per scene: `"sfx": "swoosh"` changes the transition sound, `"sfx": false` mutes it.
- Manual: `"sounds": [{ "sound": "riser", "at": 1.2, "duration": 1.5 }]` — a riser ends at `at + duration`, good right before a big reveal. `pitch` changes pop/tick/ding.

## Recipes that look good
- Hook first 1.5s: huge word (size 180–240, weight 900) + `blurIn` or `zoomOut`, then a smaller line with `wordsUp` delay 0.5.
- Keynote headline: 2–3 short lines, `rise`, weight 800, one `**accent**` word.
- Number: `counter` + `popIn`, gradient color `["#FFD60A","#FF6B00"]`.
- CTA end card: brand name `letters` + `glow`, button = text with `bg` + `popIn` + `loop: pulse`.
- B-roll: put the clip as the scene `background` with an `overlay` around 0.3–0.45 so white text stays readable; or as a rounded `video` layer next to the copy.
- 9:16 safe zone: keep text between y 15% and 80%; captions/UI of TikTok/Reels cover the edges.
- Turn on `"sfx": true` for social ads: sound makes motion feel twice as fast. Add a `riser` before the final reveal and a `boom` on the brand name.
- Stagger with `delay`, keep each scene 2.5–4s, transitions 0.5–0.7s, 3–5 scenes for a 10–15s ad.
- Fonts available by default depend on the machine; Inter is safest. Register brand fonts with `fonts`.
