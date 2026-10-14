# Visual styles

Named looks for Lampo videos. Each one fixes the palette, type, background, the effects that belong to it,
its transitions and its sound, so a video reads as one designed system instead of a pile of effects.
**Pick one style per video and stay in it.** If the user has a brand (colors, font, logo), keep the style's
*motion and layout* and swap its palette and font for the brand's.

**How to pick:** match the mood first, the content second. Ask: *what should the viewer feel?*

| Style | Mood | Best for | Hero effects | Transitions |
|---|---|---|---|---|
| Keynote Glow | premium, calm, confident | tech products, apps, launches | `rise`, `blurIn`, `focus`, `wordsRise` | `blur`, `zoom`, hard cut |
| Swiss Pulse | precise, clinical | SaaS, data, B2B, reports | `wordsSlide`, `grow`, `counter`, `wipe` | hard cut, `wipeLeft`, `push` |
| Bold Poster | loud, kinetic | sales, announcements, events, drops | `stamp`, `wordsPop`, `zoomOut`, `skewIn` | `flash`, `whip`, hard cut |
| Neon Night | electric, nocturnal | nightlife, gaming, music, bars | `flicker`, `glitch`, `lettersBlur` | `flash`, `zoomIn`, `glitch`-style cuts |
| Velvet Luxury | timeless, slow, exclusive | fashion, jewelry, real estate, hotels | `focus`, `fade`, `unfold`, `iris` | `fadeBlack`, `fade` |
| Soft Pastel | warm, friendly, light | wellness, beauty, kids, food delivery | `elastic`, `popIn`, `wordsUp`, `flip` | `circle`, `slideUp`, `push` |
| Data Drift | futuristic, immersive | AI, fintech, crypto, dev tools | `typewriter`, `lettersBlur`, `counter`, `iris` | `zoomIn`, `blur`, `barn` |
| Mono Motion | minimal, graphic, clever | startups, apps, personal brands | morphing `rect`, circle takeover, `glitch`, `rush` | morph continuity, hard cut |
| Street Warm | tasty, local, human | restaurants, barbers, shops, gyms | photo `kenburns`, `wordsRise`, price `stamp` | `slide`, `whip`, `push` |

Mood → style quick map: *trust* → Swiss Pulse · *desire* → Velvet Luxury · *excitement* → Bold Poster / Neon Night ·
*innovation* → Keynote Glow / Data Drift · *warmth* → Soft Pastel / Street Warm · *cleverness* → Mono Motion.

## Palette rules

- Declare background, text color and **one** accent before writing layers (`theme.color`, `theme.accent`, `theme.background`). Don't invent new colors per layer.
- Same background family across all scenes; a single palette flip (color takeover) is allowed as a deliberate beat.
- Avoid dead pure `#000`/`#fff` backgrounds: tint toward the accent (`#0b0b10`, `#07020f`, `#F4F2EE`, `#FFF4EC`).
- Contrast: body text must stay readable with the decorations removed. On photos, `overlay` 0.35–0.5.
- Gradients: on numbers and one hero word, not on every line.
- Lazy AI tells to question: purple-to-blue gradients on everything, cyan-on-black neon by default, gradient text everywhere, identical card grids, everything centered. Use them only when the content calls for it.

## Typography rules

- Two weights carry a video: headline 800–900, support 400–500. Thin (200–300) only for luxury/editorial.
- One family is enough. Inter is always safe (default). For a serif or a display face, register the TTF/OTF:
  `"fonts": [{ "path": "PlayfairDisplay-Bold.ttf", "family": "Playfair Display" }]` and set `"font"` on the layers (or in `theme`).
- ALL CAPS labels need `letterSpacing` 4–12. Big tight headlines can go to `letterSpacing` -2 to -4.
- `lineHeight` 0.95–1.05 for stacked hero words, 1.12 (default) for sentences.
- Short lines: 2–6 words per line, break with `\n` on meaning, not on width.

Each style below is a runnable one-scene sample: copy its `theme`, background and layer recipes.

---

## Keynote Glow

**Feel:** the Apple keynote. Calm confidence, soft moving light, white type with one blue accent.
**Motion:** `apple` easing everywhere, entrances 0.7–1.2s, lines `rise` from masks, generous holds. One `breathe` or `float`.
**Transitions:** `blur` 0.6, `zoom` for the reveal, one hard cut. **Sound:** `swoosh` only, riser + soft boom on the logo.

```json
{
  "format": "9:16",
  "theme": { "font": "Inter", "color": "#ffffff", "accent": "#0A84FF", "background": "#05050a" },
  "scenes": [ { "duration": 3.5,
    "background": { "type": "glow", "base": "#05050a", "colors": ["#0A84FF", "#BF5AF2"], "intensity": 0.55, "speed": 0.25 },
    "layers": [
      { "text": "INTRODUCING", "size": 30, "weight": 600, "letterSpacing": 10, "color": "#8e8e93", "y": "38%", "in": { "effect": "fade", "delay": 0.2 } },
      { "text": "Thinner.\nFaster.\n**Brighter.**", "size": 130, "weight": 800, "lineHeight": 1.02, "y": "50%", "in": { "effect": "rise", "delay": 0.4 } },
      { "type": "line", "w": 90, "h": 5, "y": "64%", "in": { "effect": "grow", "delay": 1.2 } }
    ] } ]
}
```

## Swiss Pulse

**Feel:** Müller-Brockmann grid. Left-aligned, hairline rules, numbers dominate, nothing floats.
**Motion:** `expoOut`, fast (0.3–0.5s), `wordsSlide`, rules `grow` from the left, counters. No ambient loops.
**Transitions:** hard cuts, `wipeLeft`, `push`. **Sound:** `tick`, `swipe`, `click`.

```json
{
  "format": "9:16",
  "theme": { "font": "Inter", "color": "#111111", "accent": "#E10600", "background": "#F2F2F0" },
  "scenes": [ { "duration": 3.5, "background": "#F2F2F0",
    "layers": [
      { "text": "Q3 / REPORT", "size": 28, "weight": 600, "letterSpacing": 6, "x": 110, "y": "24%", "anchor": "left", "align": "left", "in": { "effect": "fade", "delay": 0.1 } },
      { "type": "line", "w": 860, "h": 3, "x": 110, "y": "27%", "anchor": "left", "color": "#111111", "in": { "effect": "grow", "delay": 0.15, "easing": "expoOut" } },
      { "type": "counter", "to": 87, "suffix": "%", "size": 300, "weight": 900, "color": "#E10600", "x": 100, "y": "41%", "anchor": "left", "align": "left", "countDuration": 1.1, "in": { "effect": "fadeUp", "delay": 0.3, "easing": "expoOut" } },
      { "text": "of teams ship\nweekly with Lampo", "size": 64, "weight": 700, "x": 110, "y": "56%", "anchor": "left", "align": "left", "in": { "effect": "wordsSlide", "delay": 0.6 } },
      { "type": "line", "w": 860, "h": 3, "x": 110, "y": "66%", "anchor": "left", "color": "#111111", "in": { "effect": "grow", "delay": 0.9, "easing": "expoOut" } }
    ] } ]
}
```

## Bold Poster

**Feel:** a screaming gig poster. Huge 900-weight type, one loud flat color, black, tilted stickers.
**Motion:** short and hard: `stamp` 0.25–0.35, `wordsPop`, `zoomOut`, `skewIn`, scale punches, `shake` on impact.
**Transitions:** `flash`, `whip`, hard cuts on beats. **Sound:** `impact`, `boom`, `pop`, riser before the drop.

```json
{
  "format": "9:16",
  "sfx": true,
  "theme": { "font": "Inter", "color": "#111111", "accent": "#ffffff", "background": "#FFD60A" },
  "scenes": [ { "duration": 3.2, "background": "#FFD60A",
    "layers": [
      { "text": "SALE", "size": 600, "weight": 900, "opacity": 0.07, "wrap": false, "fit": false, "rotate": -8, "loop": { "effect": "drift", "amount": 160 } },
      { "text": "MEGA\nSALE", "size": 260, "weight": 900, "lineHeight": 0.92, "letterSpacing": -6, "y": "44%", "in": { "effect": "stamp", "delay": 0.15, "duration": 0.32 } },
      { "type": "group", "x": "72%", "y": "62%", "w": 340, "h": 140, "rotate": 8, "bg": "#111111", "radius": 70, "start": 0.7, "in": "stamp", "loop": { "effect": "wiggle", "amount": 3, "delay": 0.4 }, "layers": [
        { "text": "-50%", "size": 84, "weight": 900, "color": "#FFD60A", "x": 170, "y": 70 } ] },
      { "text": "ONLY THIS WEEKEND", "size": 40, "weight": 800, "letterSpacing": 4, "y": "72%", "start": 1.1, "in": "wordsPop" }
    ] } ]
}
```

## Neon Night

**Feel:** a neon sign in a dark street. Deep violet black, magenta + cyan glow, things flicker on.
**Motion:** `flicker` entrances, `glitch` with chromatic split, `lettersBlur`, `glow` on the hero, loops `flicker`/`glitch`.
**Transitions:** `flash` (with `"color": "#FF2D95"`), `zoomIn`, hard cuts. **Sound:** `glitch`, `boom`, riser.

```json
{
  "format": "9:16",
  "sfx": true,
  "theme": { "font": "Inter", "color": "#F5F0FF", "accent": "#22E4FF", "background": "#07020f" },
  "scenes": [ { "duration": 3.5,
    "background": { "type": "glow", "base": "#07020f", "colors": ["#FF2D95", "#22E4FF"], "intensity": 0.5, "speed": 0.35 },
    "layers": [
      { "text": "OPEN", "size": 230, "weight": 900, "color": "#FF2D95", "glow": "rgba(255,45,149,0.8)", "y": "42%", "in": { "effect": "flicker", "delay": 0.2, "duration": 0.9 }, "loop": { "effect": "flicker", "amount": 0.08, "delay": 1.2 } },
      { "text": "**TILL 5AM**", "size": 120, "weight": 900, "glow": "rgba(34,228,255,0.7)", "y": "52%", "in": { "effect": "glitch", "delay": 0.9 }, "loop": { "effect": "glitch", "period": 1.6, "delay": 1.5 } },
      { "text": "friday · saturday", "size": 44, "weight": 500, "letterSpacing": 4, "color": "#b9a8d9", "y": "61%", "in": { "effect": "lettersBlur", "delay": 1.4 } }
    ] } ]
}
```

## Velvet Luxury

**Feel:** Vignelli restraint. Black, one gold, thin caps with wide spacing, lots of empty space.
**Motion:** slow (1–1.5s), `focus`, `fade`, `unfold`, `iris` on photos; nothing bounces, nothing snaps. Long holds.
**Transitions:** `fadeBlack` 0.8, `fade` 1.0. **Sound:** `chime`, soft `swoosh`; no boom.

```json
{
  "format": "9:16",
  "theme": { "font": "Inter", "color": "#F3EEE6", "accent": "#C8A86B", "background": "#0b0a08" },
  "scenes": [ { "duration": 4, "background": { "type": "gradient", "colors": ["#0b0a08", "#1a160f"], "angle": 180 },
    "layers": [
      { "type": "line", "w": 1, "h": 220, "y": "33%", "color": "#C8A86B", "in": { "effect": "growDown", "delay": 0.2, "duration": 1.0 } },
      { "text": "MAISON", "size": 34, "weight": 400, "letterSpacing": 18, "color": "#C8A86B", "y": "43%", "in": { "effect": "fade", "delay": 0.8, "duration": 1.0 } },
      { "text": "Crafted\nto last.", "size": 120, "weight": 200, "lineHeight": 1.05, "y": "51%", "in": { "effect": "focus", "delay": 1.0, "duration": 1.4 } },
      { "text": "SINCE 1962", "size": 26, "weight": 400, "letterSpacing": 14, "color": "#8c8578", "y": "62%", "in": { "effect": "unfold", "delay": 1.8, "duration": 1.0 } }
    ] } ]
}
```

## Soft Pastel

**Feel:** cream paper, rounded pills, a coral accent, things that bounce gently.
**Motion:** `elastic`, `popIn`, `wordsUp`, `flip` cards, loops `float`/`bounce` (small amounts).
**Transitions:** `circle` from the hero, `slideUp`, `push`. **Sound:** `pop`, `ding`, `chime`.

```json
{
  "format": "9:16",
  "sfx": true,
  "theme": { "font": "Inter", "color": "#3A2E2A", "accent": "#FF7A59", "background": "#FFF4EC" },
  "scenes": [ { "duration": 3.6, "background": ["#FFF4EC", "#FFE6DA"],
    "layers": [
      { "type": "circle", "r": 230, "color": "#FFD9C9", "x": "78%", "y": "30%", "in": { "effect": "elastic", "delay": 0.1 }, "loop": { "effect": "float", "amount": 18, "period": 4 } },
      { "type": "circle", "r": 120, "color": "#FFE9A8", "x": "18%", "y": "70%", "in": { "effect": "elastic", "delay": 0.25 }, "loop": { "effect": "float", "amount": 12, "period": 3.2 } },
      { "text": "Self-care,\n**delivered**.", "size": 120, "weight": 800, "y": "46%", "in": { "effect": "wordsUp", "delay": 0.4 } },
      { "text": "Book your first box", "size": 46, "weight": 700, "color": "#ffffff", "bg": { "color": "#FF7A59", "radius": 50, "padding": 30 }, "y": "60%", "start": 1.2, "in": "elastic", "loop": { "effect": "pulse", "amount": 0.03, "delay": 0.8 } }
    ] } ]
}
```

## Data Drift

**Feel:** a slowly rotating deep-blue gradient, cyan data, text that decodes itself.
**Motion:** `typewriter` prompts, `lettersBlur`, counters, `iris` reveals, camera push-ins with group `keyframes`.
**Transitions:** `zoomIn`, `blur`, `barn`. **Sound:** `tick`, `glitch` (light), `riser`.

```json
{
  "format": "9:16",
  "sfx": true,
  "theme": { "font": "Inter", "color": "#E6F1FF", "accent": "#22D3EE", "background": "#050816" },
  "scenes": [ { "duration": 4, "background": { "type": "gradient", "colors": ["#050816", "#0B1E3F", "#06283D"], "angle": 140, "animate": 12 },
    "layers": [
      { "type": "group", "keyframes": [ { "t": 0, "scale": 1 }, { "t": 4, "scale": 1.08 } ], "layers": [
        { "type": "group", "w": 880, "h": 110, "y": "36%", "bg": "rgba(255,255,255,0.06)", "radius": 22, "in": { "effect": "fade", "delay": 0.1 }, "layers": [
          { "text": "> analyze 2M transactions", "size": 38, "weight": 500, "color": "#22D3EE", "x": 40, "y": 55, "anchor": "left", "align": "left", "wrap": false, "start": 0.3, "in": { "effect": "typewriter", "duration": 1.1 } } ] },
        { "type": "counter", "from": 0, "to": 99.7, "decimals": 1, "suffix": "%", "size": 220, "weight": 900, "color": ["#E6F1FF", "#22D3EE"], "y": "50%", "start": 1.5, "countDuration": 1.2, "in": "lettersBlur" },
        { "text": "fraud caught before checkout", "size": 46, "weight": 500, "color": "#8FB3D9", "y": "59%", "start": 1.9, "in": "wordsUp" }
      ] }
    ] } ]
}
```

## Mono Motion

**Feel:** black and white only, flat shapes that transform into each other, icons drawn with a line.
**Motion:** one `rect` morphing through states (`keyframes` on `w`/`h`/`radius`/`color`), circle takeovers to flip black/white, `glitch` on the name, `rush` for objects, words with `icon`.
**Transitions:** continuity (morph, takeover) and hard cuts; almost never a crossfade. **Sound:** `pop`, `swipe`, `glitch`, one `boom`.

```json
{
  "format": "9:16",
  "sfx": true,
  "theme": { "font": "Inter", "color": "#0A0A0A", "accent": "#0A0A0A", "background": "#ffffff" },
  "scenes": [ { "duration": 3.4, "background": ["#FFFFFF", "#ECECEC"],
    "layers": [
      { "text": "Fast", "size": 96, "weight": 800, "icon": "bolt", "iconScale": 0.7, "iconDraw": true, "y": "40%", "end": 1.0, "in": { "effect": "fadeUp", "duration": 0.35 }, "out": { "effect": "fade", "duration": 0.15 } },
      { "text": "Simple", "size": 96, "weight": 800, "icon": "check-circle", "iconScale": 0.7, "iconDraw": true, "y": "40%", "start": 1.0, "end": 1.9, "in": { "effect": "fadeUp", "duration": 0.35 }, "out": { "effect": "fade", "duration": 0.15 } },
      { "type": "circle", "r": 12, "color": "#0A0A0A", "y": "55%", "start": 1.9, "in": "popIn",
        "keyframes": [ { "t": 0, "r": 12 }, { "t": 0.6, "r": 12 }, { "t": 1.4, "r": 1300, "easing": "in" } ] },
      { "text": "Yours.", "size": 120, "weight": 900, "color": "#ffffff", "y": "50%", "start": 3.0, "in": { "effect": "glitch", "duration": 0.4 } }
    ] } ]
}
```

## Street Warm

**Feel:** the real place, warm light, big confident copy, a price you can't miss.
**Motion:** photos with `kenburns`, `wordsRise` headlines anchored left/bottom, price tags that `stamp` tilted, `rush` for products.
**Transitions:** `slide`, `whip`, `push`. **Sound:** `whoosh`, `stamp`, `ding`.

```json
{
  "format": "9:16",
  "sfx": true,
  "theme": { "font": "Inter", "color": "#ffffff", "accent": "#FFB800", "background": "#1a0b02" },
  "scenes": [ { "duration": 3.6, "background": { "type": "image", "src": "photo.jpg", "overlay": "rgba(26,11,2,0.5)", "kenburns": true },
    "layers": [
      { "text": "FRESH EVERY MORNING", "size": 30, "weight": 700, "letterSpacing": 6, "color": "#FFB800", "x": 90, "y": "55%", "anchor": "left", "align": "left", "in": { "effect": "fade", "delay": 0.2 } },
      { "text": "Croissant\n+ cappuccino", "size": 110, "weight": 900, "x": 90, "y": "64%", "anchor": "left", "align": "left", "in": { "effect": "wordsRise", "delay": 0.35 } },
      { "type": "group", "x": "74%", "y": "34%", "w": 280, "h": 280, "rotate": -10, "start": 1.2, "in": "stamp", "layers": [
        { "type": "circle", "r": 140, "x": 140, "y": 140, "color": "#FFB800" },
        { "text": "€3", "size": 120, "weight": 900, "color": "#1a0b02", "x": 140, "y": 140 } ] }
    ] } ]
}
```
