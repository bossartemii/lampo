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
- `transition` (into this scene): none | fade | slide | slideUp | slideDown | push | pushUp | whip (fast push with motion blur) | zoom | zoomIn (camera dives into the old scene) | wipe | wipeLeft | wipeUp | wipeDown | barn (opens from the center) | blur | circle (iris from `origin: {x, y}`, default center) | fadeBlack (dip to black) | flash (white flash, punchy cut). fadeBlack/flash accept `color`. Or `{ "type": "zoom", "duration": 0.6 }`. Overlaps the previous scene.
- `background`:
  - `"#101010"` solid
  - `["#1a0b02", "#3d1402"]` or `{ "type": "gradient", "colors": [...], "angle": 160, "animate": 10 }` (animate = degrees/sec)
  - `{ "type": "glow", "base": "#05050a", "colors": ["#0A84FF", "#BF5AF2"], "intensity": 0.55, "speed": 0.25 }` — soft moving light blobs, the "Apple keynote" look
  - `{ "type": "image", "src": "photo.jpg", "overlay": "rgba(0,0,0,.45)", "kenburns": true }`
  - `{ "type": "video", "src": "broll.mp4", "overlay": "rgba(0,0,0,.35)", "trim": 2, "rate": 1, "loop": true, "audio": false }` — b-roll filling the frame (cover crop), text goes on top

## Layer (common keys)
- `type`: text | counter | rect | circle | line | image | video | path | icon | spinner | group | phone | cursor (inferred from `text` / `src` / `shape` / `path` / `layers` if omitted)
- `x`, `y`: px in design space, `"50%"`, or `"center" | "left" | "right" | "top" | "bottom"`. Default: center.
- `anchor`: center (default) | top | bottom | left | right | top-left | ...
- `start`, `end` or `duration`: seconds relative to the scene (default: whole scene)
- `in`: entrance effect. `"fadeUp"` or `{ "effect": "fadeUp", "delay": 0.4, "duration": 0.7, "easing": "apple" }`
- `out`: exit effect, same names, played in reverse at the end of the layer
- `loop`: `"float"` or `{ "effect": "pulse", "amount": 0.04, "period": 1.2 }` or an array
- `opacity`, `scale`, `rotate`, `shadow: true`, `glow: "rgba(255,160,0,.6)"`
- `keyframes` also morph shapes: `w`, `h`, `r` (circle), `radius`, `color`, `size` (text), `blur`, `rgb` (chromatic split), `skew` (degrees). One rect can go dot → line → pill → app icon → full screen: `[{t:0,w:44,h:44,radius:22},{t:0.25,w:330,h:7,radius:4},{t:0.6,w:360,h:104,radius:10},{t:1.2,w:158,h:158,radius:40},{t:1.6,w:560,h:1000,color:"#9c9c9c"}]`. A circle whose `r` grows to ~1300 fills the screen (color takeover).
- `keyframes`: move/zoom over time, e.g. `[{ "t": 2, "y": "60%", "scale": 1 }, { "t": 2.8, "y": "52%", "scale": 1.15 }]` (t = seconds from the layer start; props x, y, scale, rotate, opacity; optional `easing`). A quick press: `[{t:1.9,scale:1},{t:2,scale:0.93},{t:2.15,scale:1}]`.

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

### group
A box of child `layers`: `w`, `h`, `anchor`, optional `bg`, `radius` (clips children), `shadow`, `clip: true`. Children use the group's coordinates (0..w, 0..h, `"50%"` = middle of the group) and the group's clock (their `start`/`end` are relative to the group). Effects and keyframes on the group move everything inside. Use it for cards, buttons, stamps, notifications, app screens.

### phone
An iPhone mockup: `w` (default 600; height follows), `screen` (screen color, default white), `src` (a screenshot or a screen recording that fills the screen), `statusBar: false`, `time: "9:41"`, `frameColor`.
Its `layers` are the screen content in **iPhone points: 390 wide, 844 tall** — design the app UI like a real phone. Typical pattern: several full-screen groups (`"x": 0, "y": 0, "w": 390, "h": 844, "anchor": "top-left"`) with `start`/`end`, each sliding in (`slideLeft`) as the next app screen; plus one `cursor` on top.

### cursor
A touch finger (or `"style": "arrow"` for a mouse pointer): `path`: `[{ "t": 0, "x": 250, "y": 640 }, { "t": 1, "x": 283, "y": 352, "tap": true }, ...]` (t relative to the cursor's `start`, positions in the parent's coordinates). It glides between points and shows a press + ripple on each `tap` (with a click sound when `sfx` is on). `size` (default 52). Pair taps with a button `keyframes` press at the same time.

### path
Strokes that draw themselves with `in: "draw"`: `shape` = underline | double-underline | circle | arrow | arrow-curved | check | cross | strike | bracket | spark (hand-drawn, stretched to `w` x `h`), or any SVG `d` (scaled to fit `w` x `h`). `color`, `strokeWidth` (default 14), `fill` (for solid shapes/logos, with `strokeWidth: 0`).

### icon
Line icons drawn with round strokes: `name` = gauge, check, check-circle, home, tool, box, pin, navigate, search, team, truck, clock, star, heart, bolt, phone, mail, calendar, arrow-right, plus, sparkle, euro, shield, play, key. `size` (default 96), `color`, `strokeWidth` (default 2.1 on a 24 grid). `in: "draw"` draws it.
Text can carry an icon in front: `{ "text": "Veloce", "icon": "gauge", "iconScale": 0.7, "iconDraw": true }`.

### spinner
A loading spinner: `size`, `color`, `track` (ring color or false), `speed`. Put it in a button after the tap to show "loading".

### rect / circle / line / image
- rect: `w`, `h`, `radius`, `color` (or gradient array), `stroke`
- circle: `r`, `color`
- line: `w`, `h` (thickness), `color` — use `in: "grow"` for an underline that draws itself
- image: `src` (local path or URL), `w`, `h`, `fit` (cover|contain), `radius`

## Effects
Entrance/exit (any layer): fade, fadeUp, fadeDown, slideLeft, slideRight, slideUp (from below the frame), scaleIn, popIn, zoomOut, blurIn, drop, spin, wipe, wipeUp, grow, growUp, stamp (slams down tilted, like a rubber stamp), draw (paths draw their stroke), glitch (red/cyan chromatic split that jitters and settles), rush (flies in from the right with speed blur — vans, cars, products), slideDown (from above the frame), growLeft, growDown, wipeLeft, wipeDown, unfold (opens from the center line), iris (circular reveal — photos, logos), flip / flipUp (card flip), elastic (springy pop with wobble), swing (hangs from the top edge and swings in), skewIn (slides in leaning, then straightens — sporty), flicker (switches on like a neon sign), focus (comes into focus from a big blur)
Text only (animate per unit): rise (lines slide up from a mask — keynote style), wordsRise (same, word by word), wordsUp, wordsPop, wordsSlide, wordsFlip, letters, lettersBlur (letters sharpen into place), cascade (letters fall in with a tilt), typewriter
Loops: float, pulse, rotate, kenburns, drift, shake, breathe, wiggle, swing (pendulum from the top edge), bounce, orbit, heartbeat (double beat), flicker (neon), glitch (periodic RGB bursts on text). Options: `amount`, `period` (`speed` for rotate/flicker)
Easings: apple (default), linear, in, out, inOut, expoOut, backOut, elasticOut, bounceOut, or a cubic-bezier array [x1,y1,x2,y2]

## Sound effects
Synthesized by Lampo (no audio files, no licensing). 42 sounds:
- Movement: whoosh, swoosh, swipe, air (soft breath), flyby (doppler pass), spin, whistle (slide up), zap, laser, riser (builds up to `at + duration`), downlifter (falls away), reverse (reversed cymbal that stops dead on its end — put it right before a hit)
- UI: click, tap, tick, keyboard, toggle, bubble, pop, notification, success, error, shutter (camera), coin, cash (register)
- Impacts and drums: impact, boom, thud, punch, slam, drop (bass drop), kick, snare, clap, hihat, cymbal, heartbeat
- Musical: ding, chime, sparkle, magic (harp glissando), glitch
`pitch` changes the tonal ones (pop, tick, ding, tap, bubble, notification, success, error, coin, laser, whistle, magic); `duration` stretches the swept ones (whoosh, swoosh, swipe, riser, downlifter, reverse, air, flyby, spin, whistle, zap, impact, boom, drop, hihat, cymbal).
- `"sfx": true` at top level adds them automatically: whoosh on slide/push/zoom/blur transitions, pop on popIn/wordsPop, impact on big zoomOut/drop titles, swoosh on rise/wordsUp/blurIn, swipe on slides and grow, bubble on elastic, air on focus/iris/unfold, zap on flicker, flyby on whip transitions, ticks on typewriter/letters, ticks + ding on counters. Mixed under the music if `audio` is set.
- Per layer: `"sfx": "boom"` or `{ "sound": "ding", "at": 0.3, "volume": 0.6 }` (at = seconds from the layer start), `"sfx": false` to mute it.
- Per scene: `"sfx": "swoosh"` changes the transition sound, `"sfx": false` mutes it.
- Manual: `"sounds": [{ "sound": "riser", "at": 1.2, "duration": 1.5 }]` — a riser ends at `at + duration`, good right before a big reveal. `pitch` changes pop/tick/ding.

## Recipes that look good
- Hook first 1.5s: huge word (size 180–240, weight 900) + `blurIn` or `zoomOut`, then a smaller line with `wordsUp` delay 0.5.
- Keynote headline: 2–3 short lines, `rise`, weight 800, one `**accent**` word.
- Number: `counter` + `popIn`, gradient color `["#FFD60A","#FF6B00"]`.
- CTA end card: brand name `letters` + `glow`, button = text with `bg` + `popIn` + `loop: pulse`.
- B-roll: put the clip as the scene `background` with an `overlay` around 0.3–0.45 so white text stays readable; or as a rounded `video` layer next to the copy.
- App / website demo (like a product walkthrough reel): warm light background, a `phone` that `slideUp`s in, screens as timed groups inside it, a `cursor` tapping buttons (button `keyframes` press at the tap time), `typewriter` text in input fields, a `stamp` group for the key promise, a `fadeDown` notification group above the phone, then an end card with the logo and a search bar typing the URL. See examples/it/artemii-preventivo.json.
- Motion-design opener (minimal, black & white): short words with icons (`"icon": "gauge"`), a dot that grows into a circle and fills the screen (circle `r` keyframes) to flip to black, then one rect morphing dot → line → pill with the brand name (`in: "glitch"`) → app icon → opening app. Then the product flow in white cards, a `rush` van, and a black end card with a search bar typing the handle. See examples/it/artemii-app.json.
- Hand-drawn emphasis: a `path` with `shape: "underline"` or `"circle"` and `in: "draw"` under/around the key word.
- 9:16 safe zone: keep text between y 15% and 80%; captions/UI of TikTok/Reels cover the edges.
- Turn on `"sfx": true` for social ads: sound makes motion feel twice as fast. Add a `riser` before the final reveal and a `boom` on the brand name.
- Stagger with `delay`, keep each scene 2.5–4s, transitions 0.5–0.7s, 3–5 scenes for a 10–15s ad.
- Fonts available by default depend on the machine; Inter is safest. Register brand fonts with `fonts`.
