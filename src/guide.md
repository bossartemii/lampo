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

## Layer (common keys)
- `type`: text | counter | rect | circle | line | image (inferred from `text` / `src` if omitted)
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

## Recipes that look good
- Hook first 1.5s: huge word (size 180–240, weight 900) + `blurIn` or `zoomOut`, then a smaller line with `wordsUp` delay 0.5.
- Keynote headline: 2–3 short lines, `rise`, weight 800, one `**accent**` word.
- Number: `counter` + `popIn`, gradient color `["#FFD60A","#FF6B00"]`.
- CTA end card: brand name `letters` + `glow`, button = text with `bg` + `popIn` + `loop: pulse`.
- 9:16 safe zone: keep text between y 15% and 80%; captions/UI of TikTok/Reels cover the edges.
- Stagger with `delay`, keep each scene 2.5–4s, transitions 0.5–0.7s, 3–5 scenes for a 10–15s ad.
- Fonts available by default depend on the machine; Inter is safest. Register brand fonts with `fonts`.
