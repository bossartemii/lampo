# Pro motion: direct it like a film

What separates a template from a piece a top motion studio would ship is not more effects. It is **camera, depth,
timing and finish**. This file is the craft layer on top of the blueprints: use it on every video that has to look
expensive. Every recipe below is a runnable spec, tested with the rest of the skill.

## 1. Think in shots, not slides

A slide is text that appears on a background. A shot has a **camera** that moves through **space** for a reason.

- Every scene gets a camera intention. Even a "static" title breathes (`drift`, `handheld` at amount 0.5).
- The camera moves **toward** what matters (`pushIn` on the hero line, `crashZoom` on the punchline) and **away**
  to reveal context (`pullOut` to an end card, `panLeft` across a list of features).
- Never the same camera move in two consecutive scenes. Alternate energy: `crashZoom` → `drift` → `orbit` → `pullOut`.

| Move | Says | Use for |
|---|---|---|
| `pushIn` (0.08–0.15) | "look closer, this matters" | hero lines, product reveals, emotional beats |
| `pullOut` | "here's the bigger picture" | end cards, "and it does all this", context |
| `panLeft` / `panRight` | "and next…" | lists, timelines, before→after |
| `tiltUp` | aspiration, growth | "level up", numbers going up, launches |
| `tiltDown` | settling, landing | closing lines, grounding a statement |
| `orbit` (2–4°) | premium, product on a turntable | products, logos, luxury |
| `dutch` | tension, something is off | problems, glitches, "stop doing this" |
| `drift` | calm, alive | breathers, titlecards, backgrounds |
| `handheld` (0.5–1) | real, documentary, urgent | UGC style, testimonials, street food, energy |
| `crashZoom` at `start` | punch, comedy, surprise | the beat of the punchline, prices, "BOOM" |
| `shake` at `start` | impact | a stamp landing, a bass drop, a slam |

Combine a travel move with texture: `["pushIn", "handheld"]` reads like a real operator; `["orbit", "drift"]` like a gimbal.

## 2. Stage in three planes (parallax)

Under a moving camera, layers at different `depth` slide at different speeds: the brain reads that as real space.
Stage every scene in three planes:

| Plane | depth | What goes there |
|---|---|---|
| Background | 0.2–0.5 | `glow`/gradient background (follows `backgroundDepth`), ghost type at opacity 0.05, `bokeh`, `stars`, `dust` |
| Subject | 1 | the copy, the product, the number |
| Foreground | 1.4–2 | the hero word slightly larger, `sparks`/`embers`/`confetti`, a shape that crosses the frame |

The difference between planes is what sells it: background 0.3 and hero 1.5 is a strong parallax; everything at 1 is flat.

## 3. Animation principles (the 12, applied)

- **Anticipation**: before a big entrance, something small moves first (a line grows, a dot pops, a `riser` builds).
- **Follow-through and overshoot**: entrances settle with `spring`, `backOut` or `elasticOut`; never stop dead except for `stamp`.
- **Overlap**: staggered words and letters (`wordsRise`, `cascade`); the next element starts before the previous one finishes.
- **Slow in / slow out**: travel moves on `inOut`; entrances on `apple`/`expoOut`; exits on `in`.
- **Arcs**: things that travel far go through `orbit`/`swing`/rotated paths, not straight lines.
- **Secondary action**: while the hero holds, something small lives (`shine` on the CTA, `breathe` on a glow, particles).
- **Timing on beats**: cuts and hits land on the music grid (scene duration = beats × 60 / BPM); a `crashZoom`, `shake` and `boom` on the same frame.
- **Exaggeration**: a hero word is 180–300 px, not 90. Motion amounts are bigger than you think; motion blur keeps them smooth.
- **Solid drawing**: one type family, two weights, a real grid; nothing floats at random positions.
- **Appeal**: one accent color, used rarely; generous negative space; a final frame you'd screenshot.

## 4. Finish: the "expensive" pass

Do this on every delivery, it is what clients notice without knowing why:

1. `"motionBlur": true`: fast moves get streaks instead of strobing.
2. `"look"`: `grain` 0.04–0.07 on dark or photographic styles (none on flat UI/Swiss styles); `lightLeak` on warm, emotional or luxury pieces; `letterbox` for cinematic 16:9 (slim bars on vertical, only for trailer-like pieces).
3. `vignette: true` on dark scenes to focus the eye.
4. `shine` loop on the CTA pill or logo in the last scene.
5. A sound pass: `"sfx": true`, a `riser` ending on the reveal, one `boom`/`drop` on the brand, `whoosh`/`flyby` on camera moves.
6. Final hold ≥ 1 s with the camera still moving slightly (`drift`), so the end card doesn't freeze.

## 5. Typography like a title designer

- Hero: weight 800–900, `letterSpacing` −2 to −6 at 180 px+, `lineHeight` 0.92–1.0 for stacked words.
- Labels: caps, weight 500–700, `letterSpacing` 6–14, size 26–34.
- Max two sizes fighting for attention per frame. Everything else is clearly secondary.
- Break lines on meaning ("Fast.\nSimple.\n**Yours.**"), never in the middle of a phrase.
- Color: one accent on the single most important word (`**word**`); gradients only on numbers or one hero word.

## 6. Grading by style

| Style | Camera | Particles | Look |
|---|---|---|---|
| Keynote Glow | slow `pushIn`, `drift` | `bokeh` at depth 0.4, `dust` | grain 0.03 |
| Swiss Pulse | `panLeft`/`panRight` on lists, hard cuts | none | none (clean) |
| Bold Poster | `crashZoom`, `shake`, `handheld` | `burst`, `confetti` | grain 0.05 |
| Neon Night | `handheld`, `dutch` | `embers`, `sparks` | grain 0.07, lightLeak pink/cyan |
| Velvet Luxury | `orbit`, slow `pullOut` | `dust` at 0.4, `bokeh` gold | grain 0.04, lightLeak warm 0.2, letterbox (16:9) |
| Soft Pastel | `drift`, gentle `pushIn` | `bubbles`, `confetti` sparse | none |
| Data Drift | `pushIn`, `tiltUp` | `stars`, `dust` cyan | grain 0.04 |
| Mono Motion | morph continuity, `crashZoom` on the name | none or `sparkBurst` | none |
| Street Warm | `handheld`, `pushIn` | `embers` or `sparks` | grain 0.05, lightLeak warm |

---

## Cinematic recipes

### Cinematic title

**Use for:** an opener or a trailer-style hook. **Signature:** a slow push-in through three planes (ghost type, bokeh, hero, sparks) with motion blur, grain and a warm light leak; the title rises on a spring.

```json
{
  "format": "9:16",
  "motionBlur": true,
  "look": { "grain": 0.05, "lightLeak": { "intensity": 0.25 } },
  "vignette": true,
  "sfx": true,
  "sounds": [ { "sound": "riser", "at": 0.2, "duration": 1.2 }, { "sound": "boom", "at": 1.4 } ],
  "scenes": [ { "duration": 4,
    "camera": ["pushIn", { "move": "handheld", "amount": 0.4 }],
    "background": { "type": "glow", "base": "#06060a", "colors": ["#FF6B00", "#7A00FF"], "intensity": 0.45 },
    "layers": [
      { "text": "2026", "size": 560, "weight": 900, "opacity": 0.05, "wrap": false, "fit": false, "depth": 0.3 },
      { "type": "particles", "preset": "bokeh", "depth": 0.5, "count": 16 },
      { "text": "THE NEW ERA", "size": 32, "weight": 600, "letterSpacing": 14, "color": "#c9c9d1", "y": "40%", "depth": 0.9, "in": { "effect": "fade", "delay": 0.3, "duration": 0.8 } },
      { "text": "Made to\n**move.**", "size": 190, "weight": 900, "lineHeight": 0.95, "letterSpacing": -4, "accent": "#FF8A3D", "y": "50%", "depth": 1.4, "in": { "effect": "rise", "delay": 1.2, "easing": "spring" } },
      { "type": "particles", "preset": "sparks", "depth": 1.8, "count": 24 }
    ] } ]
}
```

### Product orbit

**Use for:** a product or app hero shot. **Signature:** the camera orbits like a turntable while the product floats in front of soft lights; the price stamps in and the CTA shines.

```json
{
  "format": "9:16",
  "motionBlur": true,
  "look": { "grain": 0.04 },
  "scenes": [ { "duration": 4.5,
    "camera": ["orbit", "drift"],
    "background": { "type": "gradient", "colors": ["#0b0b12", "#1d1630"], "angle": 160, "animate": 6 },
    "layers": [
      { "type": "particles", "preset": "bokeh", "depth": 0.4, "colors": ["#BF5AF2", "#5E8BFF", "#ffffff"], "count": 18 },
      { "type": "circle", "r": 300, "color": ["#5E8BFF", "#BF5AF2"], "opacity": 0.25, "y": "44%", "depth": 0.7, "loop": "breathe" },
      { "type": "phone", "w": 440, "y": "45%", "screen": ["#5E8BFF", "#BF5AF2"], "depth": 1.2, "in": { "effect": "slideUp", "easing": "spring", "duration": 1.0 }, "loop": { "effect": "float", "amount": 10 } },
      { "type": "group", "x": "78%", "y": "26%", "w": 250, "h": 120, "rotate": -10, "bg": "#FFD60A", "radius": 60, "start": 1.2, "depth": 1.6, "in": "stamp", "sfx": "slam", "layers": [
        { "text": "€4.99", "size": 56, "weight": 900, "color": "#111111", "x": 125, "y": 60 } ] },
      { "text": "Get the app", "size": 48, "weight": 800, "color": "#111111", "bg": { "color": "#ffffff", "radius": 50, "padding": 28 }, "y": "80%", "start": 2, "depth": 1.1, "in": "popIn", "loop": { "effect": "shine", "period": 1.6, "delay": 0.4 } }
    ] } ]
}
```

### Energy drop

**Use for:** a sale, a launch drop, a punchline on the beat. **Signature:** a hard cut into a crash zoom and an impact shake on the same frame as a confetti burst, a white flash and a bass drop.

```json
{
  "format": "9:16",
  "motionBlur": true,
  "look": { "grain": 0.05 },
  "sfx": true,
  "scenes": [
    { "duration": 1.6, "camera": { "move": "handheld", "amount": 1.2 }, "background": "#0a0a0a", "layers": [
      { "text": "3 DAYS", "size": 200, "weight": 900, "color": "#ffffff", "in": { "effect": "skewIn", "duration": 0.35 } },
      { "text": "ONLY", "size": 60, "weight": 800, "letterSpacing": 12, "color": "#FFD60A", "y": "58%", "in": { "effect": "fade", "delay": 0.4 } } ] },
    { "duration": 2.6, "transition": { "type": "flash", "duration": 0.2 }, "camera": [{ "move": "crashZoom", "amount": 0.25 }, { "move": "shake", "amount": 1.4 }], "background": "#FFD60A", "layers": [
      { "text": "SALE", "size": 560, "weight": 900, "opacity": 0.08, "rotate": -8, "wrap": false, "fit": false, "depth": 0.3 },
      { "type": "particles", "preset": "burst", "y": "46%", "depth": 1.6 },
      { "text": "-50%", "size": 280, "weight": 900, "letterSpacing": -8, "color": "#111111", "y": "46%", "depth": 1.2, "in": { "effect": "stamp", "duration": 0.3 }, "sfx": "drop" },
      { "text": "Shop now", "size": 46, "weight": 800, "color": "#FFD60A", "bg": { "color": "#111111", "radius": 50, "padding": 26 }, "y": "66%", "start": 0.7, "in": { "effect": "elastic", "duration": 0.8 }, "loop": { "effect": "shine", "period": 1.2, "delay": 0.6 } }
    ] }
  ]
}
```

### Luxury reveal

**Use for:** fashion, jewelry, hotels, real estate. **Signature:** a slow pull-out through drifting gold dust, thin type that comes into focus, a warm light leak and slim letterbox bars.

```json
{
  "format": "9:16",
  "motionBlur": true,
  "look": { "grain": 0.04, "lightLeak": { "colors": ["#C8A86B", "#7A5A2E"], "intensity": 0.2, "speed": 0.25 }, "letterbox": 0.05 },
  "scenes": [ { "duration": 5,
    "camera": [{ "move": "pullOut", "amount": 0.14 }, { "move": "orbit", "amount": 1.5 }],
    "background": { "type": "gradient", "colors": ["#0b0a08", "#1c160e"], "angle": 180 },
    "layers": [
      { "type": "particles", "preset": "dust", "depth": 0.4, "colors": ["#E9D3A1"], "count": 60 },
      { "type": "line", "w": 1, "h": 200, "y": "34%", "color": "#C8A86B", "depth": 0.8, "in": { "effect": "growDown", "delay": 0.3, "duration": 1.1 } },
      { "text": "MAISON AURA", "size": 32, "weight": 400, "letterSpacing": 18, "color": "#C8A86B", "y": "43%", "depth": 1, "in": { "effect": "fade", "delay": 0.9, "duration": 1.2 } },
      { "text": "Crafted\nto last.", "size": 130, "weight": 200, "lineHeight": 1.02, "color": "#F3EEE6", "y": "52%", "depth": 1.3, "in": { "effect": "focus", "delay": 1.2, "duration": 1.6 } },
      { "type": "particles", "preset": "bokeh", "depth": 1.9, "colors": ["#C8A86B"], "count": 6, "opacity": 0.6 }
    ] } ]
}
```

### Neon handheld

**Use for:** nightlife, gaming, music, bars. **Signature:** a nervous handheld camera with a dutch tilt, embers rising in front, a neon word that flickers on and glitches.

```json
{
  "format": "9:16",
  "motionBlur": true,
  "look": { "grain": 0.07, "lightLeak": { "colors": ["#FF2D95", "#22E4FF"], "intensity": 0.22 } },
  "sfx": true,
  "scenes": [ { "duration": 4,
    "camera": ["handheld", { "move": "dutch", "amount": 3 }],
    "background": { "type": "glow", "base": "#07020f", "colors": ["#FF2D95", "#22E4FF"], "intensity": 0.5, "speed": 0.35 },
    "layers": [
      { "type": "particles", "preset": "stars", "depth": 0.3, "count": 60 },
      { "text": "OPEN", "size": 240, "weight": 900, "color": "#FF2D95", "glow": "rgba(255,45,149,0.8)", "y": "43%", "depth": 1.2, "in": { "effect": "flicker", "delay": 0.2, "duration": 0.9 }, "loop": { "effect": "flicker", "amount": 0.08, "delay": 1.2 } },
      { "text": "TILL 5AM", "size": 110, "weight": 900, "color": "#22E4FF", "glow": "rgba(34,228,255,0.7)", "y": "53%", "depth": 1.4, "in": { "effect": "glitch", "delay": 0.9 }, "loop": { "effect": "glitch", "period": 1.6, "delay": 1.5 } },
      { "type": "particles", "preset": "embers", "depth": 1.8, "colors": ["#FF2D95", "#22E4FF", "#ffffff"], "count": 30 }
    ] } ]
}
```
