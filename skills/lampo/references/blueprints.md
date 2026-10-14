# Blueprints: proven shot shapes

A **blueprint** is a time-coded shot template with one named **signature move**. Pick one per scene, swap the
`[slots]` (copy, colors, icons) and keep the timing. Instantiating a blueprint gives the scene structure
(content keeps arriving, it doesn't all appear at t=0 and freeze).

Every JSON block below is a working scene (or a full spec when it has `scenes`) in 9:16 design space
(1080×1920). The test suite validates all of them. Copy them, then restyle with a style from
`visual-styles.md`. Write the copy in the user's language.

## Contents

| # | Blueprint | Signature move | Roles | Length |
|---|---|---|---|---|
| 1 | `kinetic-slam` | full-screen words hard-swap, then a payoff pops | hook, problem, CTA | 3–4s |
| 2 | `typewriter-collapse` | a search bar types a pain, collapses into the brand | hook, brand reveal | 4–5s |
| 3 | `stat-hit` | a hero number counts up with a filling bar and a delta pill | proof, results | 3–4s |
| 4 | `morph-lockup` | one shape goes dot → line → pill and becomes the logo | logo sting, outro | 3.5–4.5s |
| 5 | `color-takeover` | a dot grows to fill the frame and flips the palette | scene bridge, reveal | 2 scenes |
| 6 | `ticker-takeover` | cycling words get shoved off by a hero crashing in | hook, brand | 4–5s |
| 7 | `fixed-anchor-cycle` | a pinned line while the word under it swaps faster and faster | hook, benefits | 4–5s |
| 8 | `grid-assemble` | cards cascade into a grid under a camera pull-back | features, breadth | 4–5s |
| 9 | `titlecard` | one restrained move, then a still hold | breather, value line | 3–4s |
| 10 | `comparison-split` | two cards enter from opposite sides, VS stamp, verdict pills | before/after, A vs B | 4–5s |
| 11 | `app-demo` | phone slides up, a finger taps, the screen changes state | product demo | 5–7s |
| 12 | `cta-press` | the brand condenses into a button and a cursor clicks it | CTA, end card | 4–5s |
| 13 | `photo-hero` | a slow Ken Burns photo, headline rise, price stamp | local business, product | 3.5–4.5s |
| 14 | `list-steps` | numbered rows arrive one by one and get checked off | how it works, listicle | 4.5–5.5s |
| 15 | `camera-pan` | one wide canvas crossed by a camera with motion blur | timeline, journey | 4.5–6s |
| 16 | `beat-cut-montage` | one word per beat, hard cuts and flashes | music, energy, teaser | 3–6s |

## Role → blueprint menu

- **Hook (first 1.5s):** kinetic-slam, ticker-takeover, typewriter-collapse, stat-hit (cold-open on a shocking number), fixed-anchor-cycle.
- **Problem:** kinetic-slam (the pain as 3 hard words), comparison-split (the "before" side), typewriter-collapse (the question people type).
- **Product intro:** morph-lockup, color-takeover, app-demo, photo-hero.
- **Features / benefits:** grid-assemble, list-steps, fixed-anchor-cycle, camera-pan.
- **Proof:** stat-hit, comparison-split, grid-assemble (logo wall).
- **CTA / outro:** cta-press, morph-lockup, titlecard.

Rules for chaining blueprints into a video:
- **Never the same blueprint twice in a row.** Alternate high-energy (slam, ticker, beat-cut) with breathers (titlecard, stat-hit hold).
- **Bridge with continuity**: end one scene on a shape that the next scene starts from (color-takeover, morph-lockup), or match the position of the hero element across the cut.
- **Hard cut (`transition` omitted or `"none"`) for disruption, `whip`/`flash` for energy, `blur`/`fade` for continuation, `fadeBlack` before a solemn line.**

---

## 1. kinetic-slam

**Use for:** a punchy hook or pain statement where the words *are* the motion. **Signature:** three full-screen words hard-swapped on beats (each with a different entrance), landing on a payoff with a hand-drawn underline.
**Timeline:** 0.15 word 1 (stamp) · 0.8 word 2 (zoomOut) · 1.45 word 3 (skewIn) · 2.0 payoff (wordsPop) · 2.4 underline draws · hold.
**Variants:** 2–4 words; swap entrances for `flicker`/`glitch` (neon), `drop` (playful); add `"sfx": "impact"` on the payoff.

```json
{
  "duration": 3.4,
  "background": { "type": "glow", "base": "#07070b", "colors": ["#FF3D00", "#7A00FF"], "intensity": 0.45, "speed": 0.3 },
  "layers": [
    { "text": "MOVE", "size": 560, "weight": 900, "color": "#ffffff", "opacity": 0.05, "wrap": false, "fit": false, "loop": { "effect": "drift", "amount": 140 } },
    { "text": "Stop.", "size": 240, "weight": 900, "color": "#ffffff", "y": "46%", "start": 0.15, "end": 0.8, "in": { "effect": "stamp", "duration": 0.3 } },
    { "text": "Scroll.", "size": 240, "weight": 900, "color": "#ffffff", "y": "46%", "start": 0.8, "end": 1.45, "in": { "effect": "zoomOut", "duration": 0.35 } },
    { "text": "Watch.", "size": 240, "weight": 900, "color": "#ffffff", "y": "46%", "start": 1.45, "end": 2.0, "in": { "effect": "skewIn", "duration": 0.35 } },
    { "text": "This is\n**Lampo**.", "size": 150, "weight": 900, "color": "#ffffff", "accent": "#FF3D00", "y": "46%", "start": 2.0, "in": { "effect": "wordsPop", "stagger": 0.08 }, "loop": { "effect": "pulse", "amount": 0.02, "period": 1.4, "delay": 0.6 } },
    { "type": "path", "shape": "underline", "w": 480, "h": 50, "y": "54.5%", "color": "#FF3D00", "start": 2.4, "in": { "effect": "draw", "duration": 0.45 } }
  ]
}
```

## 2. typewriter-collapse

**Use for:** "here's what everyone searches / asks → here's us". **Signature:** a search bar types a relatable question, collapses, and the brand springs out of the same spot.
**Timeline:** 0 bar scales in · 0.5 typing (1.6s) · 2.9 bar collapses · 2.95 brand (elastic) · 3.25 tagline.
**Variants:** a chat bubble instead of a search bar (group with `radius` 40, left anchored); type a URL at the end of a video as CTA.

```json
{
  "duration": 4.4,
  "background": ["#F4F2EE", "#E9E6DF"],
  "layers": [
    { "type": "group", "w": 860, "h": 120, "y": "47%", "bg": "#ffffff", "radius": 60, "shadow": { "color": "rgba(0,0,0,0.12)", "blur": 40, "y": 14 }, "end": 2.9,
      "in": { "effect": "scaleIn", "duration": 0.5 }, "out": { "effect": "scaleIn", "duration": 0.25 },
      "layers": [
        { "type": "icon", "name": "search", "size": 46, "x": 66, "y": 60, "color": "#8a8a8a" },
        { "text": "how do I make a video fast?", "size": 40, "weight": 500, "color": "#1a1a1a", "x": 112, "y": 60, "anchor": "left", "align": "left", "wrap": false, "start": 0.5, "in": { "effect": "typewriter", "duration": 1.6 } }
      ] },
    { "text": "Lampo", "size": 200, "weight": 900, "color": "#111111", "y": "46%", "start": 2.95, "in": { "effect": "elastic", "duration": 0.9 }, "sfx": "pop" },
    { "text": "video from JSON, in seconds", "size": 46, "weight": 500, "color": "#6b6b6b", "y": "54%", "start": 3.25, "in": "fadeUp" }
  ]
}
```

## 3. stat-hit

**Use for:** one number that carries the argument (results, growth, social proof). **Signature:** a gradient counter pops and counts while a bar fills in sync, then a delta pill springs in and the number beats.
**Timeline:** 0.15 label · 0.25 counter pops (counts 1.4s) · 0.4 bar fills (same 1.4s) · 1.75 delta pill · 1.9 heartbeat on the number.
**Variants:** cold-open hook (start the count at t=0, no label); percentages with `suffix: "%"`; ring = `path` `shape: "circle"` drawn around the number.

```json
{
  "duration": 3.6,
  "background": { "type": "gradient", "colors": ["#0b0b10", "#1a1020"], "angle": 160, "animate": 8 },
  "layers": [
    { "text": "ORDERS THIS MONTH", "size": 34, "weight": 600, "letterSpacing": 8, "color": "#9aa0a6", "y": "35%", "in": { "effect": "fadeDown", "delay": 0.15 } },
    { "type": "counter", "from": 0, "to": 12480, "size": 220, "weight": 900, "color": ["#FFD60A", "#FF6B00"], "y": "45%", "countDuration": 1.4, "in": { "effect": "popIn", "delay": 0.25 }, "loop": { "effect": "heartbeat", "amount": 0.04, "delay": 1.9 } },
    { "type": "rect", "w": 760, "h": 18, "radius": 9, "color": "rgba(255,255,255,0.12)", "y": "56%", "in": { "effect": "fade", "delay": 0.3 } },
    { "type": "rect", "w": 760, "h": 18, "radius": 9, "color": ["#FFD60A", "#FF6B00"], "y": "56%", "in": { "effect": "grow", "delay": 0.4, "duration": 1.4, "easing": "out" } },
    { "text": "+38% vs last month", "size": 42, "weight": 700, "color": "#0b0b0b", "bg": { "color": "#34C759", "radius": 40, "padding": 22 }, "y": "64%", "in": { "effect": "elastic", "delay": 1.75 } }
  ]
}
```

## 4. morph-lockup

**Use for:** a premium logo sting or brand outro with no logo file needed. **Signature:** one shape pops as a dot, stretches into a line, inflates into a pill, and the brand name glitches in inside it.
**Timeline:** 0–0.25 dot pops · 0.65 thin line · 1.1 pill · 1.05 brand (glitch + boom) · 1.2 spark draws · 1.6 tagline rises.
**Variants:** keep morphing to an app icon (`w`/`h` 158, `radius` 40) then to full screen (`w` 1200, `h` 2100) to open the next scene; with a real logo put an `image` inside with `iris`.

```json
{
  "duration": 4,
  "background": "#000000",
  "layers": [
    { "type": "rect", "w": 40, "h": 40, "color": "#ffffff", "y": "50%",
      "keyframes": [ { "t": 0, "w": 40, "h": 40, "radius": 20, "scale": 0 }, { "t": 0.25, "scale": 1, "easing": "backOut" }, { "t": 0.65, "w": 520, "h": 8, "radius": 4 }, { "t": 1.1, "w": 620, "h": 150, "radius": 75, "easing": "backOut" } ] },
    { "text": "LAMPO", "size": 84, "weight": 900, "letterSpacing": 10, "color": "#000000", "y": "50%", "start": 1.05, "in": { "effect": "glitch", "duration": 0.5 }, "sfx": "boom" },
    { "type": "path", "shape": "spark", "w": 90, "h": 90, "x": "84%", "y": "44%", "color": "#FFD60A", "start": 1.2, "in": "draw" },
    { "text": "Motion graphics from JSON", "size": 44, "weight": 500, "color": "#bdbdbd", "y": "57%", "start": 1.6, "in": "wordsRise" }
  ]
}
```

## 5. color-takeover

**Use for:** bridging two scenes with a palette flip, "from small to everything". **Signature:** a dot under the line grows until it fills the frame in the next scene's background color; the next scene starts with a hard cut, so the viewer never sees the cut.
**Timeline:** scene A: 0 line rises · 0.9 dot pops · 1.8–2.4 dot grows to r 1300 · scene B: hard cut, line blurs in.
**Rule:** the dot color = scene B background exactly. Scene B has no `transition`.

```json
{
  "format": "9:16",
  "scenes": [
    { "duration": 2.4, "background": "#F5F5F2", "layers": [
      { "text": "It starts\nwith a **dot**.", "size": 110, "weight": 800, "color": "#111111", "accent": "#FF3B30", "y": "44%", "in": "rise" },
      { "type": "circle", "r": 14, "color": "#111111", "y": "60%", "start": 0.9, "in": "popIn",
        "keyframes": [ { "t": 0, "r": 14 }, { "t": 0.9, "r": 14 }, { "t": 1.5, "r": 1300, "easing": "in" } ] }
    ] },
    { "duration": 2.4, "background": "#111111", "layers": [
      { "text": "And becomes\n**everything**.", "size": 110, "weight": 800, "color": "#ffffff", "accent": "#FF3B30", "y": "46%", "in": { "effect": "blurIn", "delay": 0.1 } }
    ] }
  ]
}
```

## 6. ticker-takeover

**Use for:** "for X, for Y, for Z… → this is it". **Signature:** an accent word cycles under a fixed lead, then the hero crashes in from the right and physically shoves the line out of frame (a collision, not a fade).
**Timeline:** 0 lead · 0.4–2.6 five words flip in place, getting faster · 2.55 hero rushes in · 2.6–2.85 the lead and last word are shoved left · 3.1 sub line.

```json
{
  "duration": 4.4,
  "background": "#0B0B0F",
  "layers": [
    { "text": "Videos for", "size": 96, "weight": 800, "color": "#ffffff", "y": "41%", "in": "fadeUp",
      "keyframes": [ { "t": 2.6, "x": "50%", "opacity": 1 }, { "t": 2.85, "x": "-40%", "opacity": 0, "easing": "in" } ] },
    { "text": "restaurants", "size": 110, "weight": 900, "color": "#FFD60A", "y": "48%", "start": 0.4, "end": 0.95, "in": { "effect": "flipUp", "duration": 0.25 } },
    { "text": "barbers", "size": 110, "weight": 900, "color": "#FFD60A", "y": "48%", "start": 0.95, "end": 1.4, "in": { "effect": "flipUp", "duration": 0.22 } },
    { "text": "startups", "size": 110, "weight": 900, "color": "#FFD60A", "y": "48%", "start": 1.4, "end": 1.75, "in": { "effect": "flipUp", "duration": 0.2 } },
    { "text": "creators", "size": 110, "weight": 900, "color": "#FFD60A", "y": "48%", "start": 1.75, "end": 2.05, "in": { "effect": "flipUp", "duration": 0.18 } },
    { "text": "everyone", "size": 110, "weight": 900, "color": "#FFD60A", "y": "48%", "start": 2.05, "end": 2.9, "in": { "effect": "flipUp", "duration": 0.16 },
      "keyframes": [ { "t": 0.55, "x": "50%", "opacity": 1 }, { "t": 0.8, "x": "-40%", "opacity": 0, "easing": "in" } ] },
    { "text": "LAMPO", "size": 230, "weight": 900, "color": "#ffffff", "y": "45%", "start": 2.55, "in": { "effect": "rush", "duration": 0.45 }, "sfx": "impact",
      "keyframes": [ { "t": 0.45, "scale": 1 }, { "t": 0.55, "scale": 1.08 }, { "t": 0.7, "scale": 1 } ] },
    { "text": "one JSON, one video.", "size": 50, "weight": 500, "color": "#a0a0a8", "y": "53%", "start": 3.1, "in": "wordsUp" }
  ]
}
```

## 7. fixed-anchor-cycle

**Use for:** breadth around one identity — "made for reels, spots, intros…". **Signature:** the anchor line never moves while the word under it hard-swaps with an accelerating cadence, landing on a stamped payoff.
**Timeline:** 0 rule grows · 0.1 anchor · 0.5→2.85 seven swaps (0.6s → 0.15s each) · 2.85 payoff stamp + underline.
**Rule:** swaps are near-instant (`fade` 0.04s): the rhythm is the animation. Left-anchor everything to the same x.

```json
{
  "duration": 4.4,
  "background": "#F2F2F0",
  "layers": [
    { "type": "line", "w": 840, "h": 4, "x": 120, "y": "37%", "anchor": "left", "color": "#111111", "in": "grow" },
    { "text": "Made for", "size": 90, "weight": 500, "color": "#111111", "x": 120, "y": "42%", "anchor": "left", "align": "left", "in": { "effect": "fadeUp", "delay": 0.1 } },
    { "text": "reels", "size": 150, "weight": 900, "color": "#111111", "x": 120, "y": "50%", "anchor": "left", "align": "left", "start": 0.5, "end": 1.1, "in": { "effect": "fade", "duration": 0.04 } },
    { "text": "spots", "size": 150, "weight": 900, "color": "#111111", "x": 120, "y": "50%", "anchor": "left", "align": "left", "start": 1.1, "end": 1.6, "in": { "effect": "fade", "duration": 0.04 } },
    { "text": "TikToks", "size": 150, "weight": 900, "color": "#111111", "x": 120, "y": "50%", "anchor": "left", "align": "left", "start": 1.6, "end": 2.0, "in": { "effect": "fade", "duration": 0.04 } },
    { "text": "intros", "size": 150, "weight": 900, "color": "#111111", "x": 120, "y": "50%", "anchor": "left", "align": "left", "start": 2.0, "end": 2.3, "in": { "effect": "fade", "duration": 0.04 } },
    { "text": "launches", "size": 150, "weight": 900, "color": "#111111", "x": 120, "y": "50%", "anchor": "left", "align": "left", "start": 2.3, "end": 2.52, "in": { "effect": "fade", "duration": 0.04 } },
    { "text": "logos", "size": 150, "weight": 900, "color": "#111111", "x": 120, "y": "50%", "anchor": "left", "align": "left", "start": 2.52, "end": 2.7, "in": { "effect": "fade", "duration": 0.04 } },
    { "text": "promos", "size": 150, "weight": 900, "color": "#111111", "x": 120, "y": "50%", "anchor": "left", "align": "left", "start": 2.7, "end": 2.85, "in": { "effect": "fade", "duration": 0.04 } },
    { "text": "you.", "size": 150, "weight": 900, "color": "#0047FF", "x": 120, "y": "50%", "anchor": "left", "align": "left", "start": 2.85, "in": { "effect": "stamp", "duration": 0.35 } },
    { "type": "path", "shape": "underline", "w": 300, "h": 46, "x": 120, "y": "54.5%", "anchor": "left", "color": "#0047FF", "start": 3.15, "in": { "effect": "draw", "duration": 0.4 } },
    { "text": "LAMPO — MOTION FROM JSON", "size": 28, "weight": 600, "letterSpacing": 6, "color": "#8a8a86", "x": 120, "y": "78%", "anchor": "left", "align": "left", "in": { "effect": "fade", "delay": 0.4 } }
  ]
}
```

## 8. grid-assemble

**Use for:** "everything you need" — features, services, a logo wall. **Signature:** the cards cascade in with a tight stagger while the whole scene slowly pulls back (a camera group), so the grid feels part of something bigger.
**Timeline:** 0 camera starts at 1.18× · 0.1 title rises · 0.5→0.95 six cards pop (0.09 stagger) · camera settles to 1× at 3.6.
**Camera:** a `group` without `w`/`h` covers the whole frame; `keyframes` `scale` on it is a camera move. Children use frame coordinates.

```json
{
  "duration": 4.4,
  "background": { "type": "glow", "base": "#08080c", "colors": ["#0A84FF", "#30D158"], "intensity": 0.35, "speed": 0.2 },
  "layers": [
    { "type": "group", "keyframes": [ { "t": 0, "scale": 1.18 }, { "t": 3.6, "scale": 1, "easing": "out" } ], "layers": [
      { "text": "Everything\nyou need", "size": 100, "weight": 800, "color": "#ffffff", "y": 470, "in": { "effect": "rise", "delay": 0.1 } },
      { "type": "group", "x": 300, "y": 780, "w": 420, "h": 240, "bg": "#16161c", "radius": 36, "in": { "effect": "popIn", "delay": 0.5 }, "layers": [
        { "type": "icon", "name": "bolt", "size": 80, "x": 210, "y": 95, "color": "#FFD60A" }, { "text": "Fast", "size": 38, "weight": 700, "color": "#ffffff", "x": 210, "y": 185 } ] },
      { "type": "group", "x": 780, "y": 780, "w": 420, "h": 240, "bg": "#16161c", "radius": 36, "in": { "effect": "popIn", "delay": 0.59 }, "layers": [
        { "type": "icon", "name": "shield", "size": 80, "x": 210, "y": 95, "color": "#30D158" }, { "text": "Safe", "size": 38, "weight": 700, "color": "#ffffff", "x": 210, "y": 185 } ] },
      { "type": "group", "x": 300, "y": 1060, "w": 420, "h": 240, "bg": "#16161c", "radius": 36, "in": { "effect": "popIn", "delay": 0.68 }, "layers": [
        { "type": "icon", "name": "sparkle", "size": 80, "x": 210, "y": 95, "color": "#BF5AF2" }, { "text": "Beautiful", "size": 38, "weight": 700, "color": "#ffffff", "x": 210, "y": 185 } ] },
      { "type": "group", "x": 780, "y": 1060, "w": 420, "h": 240, "bg": "#16161c", "radius": 36, "in": { "effect": "popIn", "delay": 0.77 }, "layers": [
        { "type": "icon", "name": "team", "size": 80, "x": 210, "y": 95, "color": "#0A84FF" }, { "text": "Shared", "size": 38, "weight": 700, "color": "#ffffff", "x": 210, "y": 185 } ] },
      { "type": "group", "x": 300, "y": 1340, "w": 420, "h": 240, "bg": "#16161c", "radius": 36, "in": { "effect": "popIn", "delay": 0.86 }, "layers": [
        { "type": "icon", "name": "clock", "size": 80, "x": 210, "y": 95, "color": "#FF9F0A" }, { "text": "24/7", "size": 38, "weight": 700, "color": "#ffffff", "x": 210, "y": 185 } ] },
      { "type": "group", "x": 780, "y": 1340, "w": 420, "h": 240, "bg": "#16161c", "radius": 36, "in": { "effect": "popIn", "delay": 0.95 }, "layers": [
        { "type": "icon", "name": "heart", "size": 80, "x": 210, "y": 95, "color": "#FF375F" }, { "text": "Loved", "size": 38, "weight": 700, "color": "#ffffff", "x": 210, "y": 185 } ] }
    ] }
  ]
}
```

## 9. titlecard

**Use for:** the calm breather between loud scenes, a value line, a solemn ending. **Signature:** exactly one restrained move (a rule grows, the line comes into focus), then a still hold. Low motion is the point.
**Timeline:** 0.2 rule grows · 0.3 title focuses (1.2s) · 1.1 subtitle fades · hold ≥ 1.5s.
**Pair with:** `transition: "fadeBlack"` into it, hard cut out of it.

```json
{
  "duration": 3.6,
  "transition": { "type": "fadeBlack", "duration": 0.6 },
  "background": "#0E0E0E",
  "layers": [
    { "type": "line", "w": 120, "h": 4, "y": "40%", "color": "#C8A86B", "in": { "effect": "grow", "delay": 0.2 } },
    { "text": "Less noise.\nMore **meaning**.", "size": 110, "weight": 300, "color": "#f2f2f2", "accent": "#C8A86B", "y": "47%", "in": { "effect": "focus", "delay": 0.3, "duration": 1.2 } },
    { "text": "LAMPO STUDIO", "size": 32, "weight": 500, "letterSpacing": 12, "color": "#8d8d8d", "y": "57%", "in": { "effect": "fade", "delay": 1.1, "duration": 0.8 } }
  ]
}
```

## 10. comparison-split

**Use for:** before/after, old way vs new way, A vs B (exactly two). **Signature:** two equal cards enter from opposite wings, a VS badge stamps in the seam, then a verdict pill springs onto each.
**Timeline:** 0 left card slides in · 0.15 right card · 0.7 VS stamp · 1.2 / 1.35 verdict pills.

```json
{
  "duration": 4.4,
  "background": "#0d0d12",
  "layers": [
    { "text": "Same video.", "size": 80, "weight": 800, "color": "#ffffff", "y": "22%", "in": "wordsRise" },
    { "type": "group", "x": 290, "y": "50%", "w": 440, "h": 760, "bg": "#1c1c22", "radius": 40, "in": { "effect": "slideRight", "duration": 0.7 }, "layers": [
      { "text": "Before", "size": 40, "weight": 600, "color": "#8e8e93", "x": 220, "y": 90 },
      { "type": "icon", "name": "clock", "size": 140, "x": 220, "y": 330, "color": "#8e8e93" },
      { "text": "3 days\nin After Effects", "size": 46, "weight": 800, "color": "#ffffff", "x": 220, "y": 560 } ] },
    { "type": "group", "x": 790, "y": "50%", "w": 440, "h": 760, "bg": "#0A84FF", "radius": 40, "in": { "effect": "slideLeft", "duration": 0.7, "delay": 0.15 }, "layers": [
      { "text": "With Lampo", "size": 40, "weight": 600, "color": "#d6e9ff", "x": 220, "y": 90 },
      { "type": "icon", "name": "bolt", "size": 140, "x": 220, "y": 330, "color": "#ffffff" },
      { "text": "3 seconds\nfrom one JSON", "size": 46, "weight": 800, "color": "#ffffff", "x": 220, "y": 560 } ] },
    { "type": "circle", "r": 62, "color": "#ffffff", "y": "50%", "start": 0.7, "in": "stamp" },
    { "text": "VS", "size": 50, "weight": 900, "color": "#0d0d12", "y": "50%", "start": 0.7, "in": "stamp" },
    { "text": "slow", "size": 36, "weight": 800, "color": "#ffffff", "bg": { "color": "#FF453A", "radius": 30, "padding": 18 }, "x": 290, "y": "73%", "start": 1.2, "in": "elastic" },
    { "text": "instant", "size": 36, "weight": 800, "color": "#0b0b0b", "bg": { "color": "#30D158", "radius": 30, "padding": 18 }, "x": 790, "y": "73%", "start": 1.35, "in": "elastic" }
  ]
}
```

## 11. app-demo

**Use for:** showing an app or website flow. **Signature:** the phone slides up, a finger taps a button that visibly presses, the screen slides to the next state, a check draws itself.
**Timeline:** 0 headline · 0 phone slides up · 0.9 finger enters · 1.9 tap + button press · 2.4 screen 2 slides in · 2.8 check draws · 3.1 confirmation pops.
**Rules:** the screen is in iPhone points (390×844). A cursor `tap` time must equal the button `keyframes` press time (both in the phone's clock).

```json
{
  "duration": 5,
  "background": ["#FFF4E8", "#FFE3C7"],
  "layers": [
    { "text": "Book in **2 taps**", "size": 84, "weight": 800, "color": "#1a1a1a", "accent": "#FF6B00", "y": "15%", "in": "wordsRise" },
    { "type": "phone", "w": 520, "y": "60%", "in": { "effect": "slideUp", "duration": 0.8 }, "layers": [
      { "type": "group", "x": 0, "y": 0, "w": 390, "h": 844, "anchor": "top-left", "end": 2.6, "layers": [
        { "text": "Today", "size": 34, "weight": 800, "color": "#111111", "x": 28, "y": 120, "anchor": "left", "align": "left" },
        { "type": "group", "x": 195, "y": 300, "w": 334, "h": 180, "bg": "#F4F4F6", "radius": 24, "layers": [
          { "type": "icon", "name": "calendar", "size": 44, "x": 50, "y": 60, "color": "#FF6B00" },
          { "text": "Haircut", "size": 26, "weight": 700, "color": "#111111", "x": 90, "y": 60, "anchor": "left", "align": "left" },
          { "text": "Fri 18:30 · 30 min", "size": 20, "weight": 500, "color": "#8e8e93", "x": 28, "y": 130, "anchor": "left", "align": "left" } ] },
        { "type": "group", "x": 195, "y": 720, "w": 320, "h": 64, "bg": "#FF6B00", "radius": 32,
          "keyframes": [ { "t": 1.9, "scale": 1 }, { "t": 2.0, "scale": 0.92 }, { "t": 2.15, "scale": 1 } ],
          "layers": [ { "text": "Confirm", "size": 24, "weight": 700, "color": "#ffffff", "x": 160, "y": 32 } ] }
      ] },
      { "type": "group", "x": 0, "y": 0, "w": 390, "h": 844, "anchor": "top-left", "start": 2.4, "bg": "#ffffff", "in": { "effect": "slideLeft", "duration": 0.5 }, "layers": [
        { "type": "icon", "name": "check-circle", "size": 120, "x": 195, "y": 360, "color": "#30D158", "start": 0.4, "in": "draw" },
        { "text": "Booked!", "size": 40, "weight": 800, "color": "#111111", "x": 195, "y": 480, "start": 0.7, "in": "popIn" },
        { "text": "See you Friday", "size": 22, "weight": 500, "color": "#8e8e93", "x": 195, "y": 530, "start": 0.9, "in": "fadeUp" } ] },
      { "type": "cursor", "start": 0.9, "end": 2.6, "path": [ { "t": 0, "x": 300, "y": 820 }, { "t": 1.0, "x": 195, "y": 720, "tap": true }, { "t": 1.6, "x": 280, "y": 820 } ] }
    ] }
  ]
}
```

## 12. cta-press

**Use for:** the final ask. **Signature:** the brand name blurs out as a dot pops in its place and inflates into a button; a mouse arrow glides in and clicks it (the button presses), then the URL fades in.
**Timeline:** 0 brand blurs in · 1.2 dot → button (0.55s) · 1.75 label · 2.3 cursor enters · 3.2 click + press · 3.4 URL.

```json
{
  "duration": 4.6,
  "background": { "type": "glow", "base": "#06060a", "colors": ["#FFD60A", "#FF6B00"], "intensity": 0.4, "speed": 0.25 },
  "layers": [
    { "text": "Lampo", "size": 170, "weight": 900, "color": "#ffffff", "y": "46%", "end": 1.4, "in": "blurIn", "out": { "effect": "scaleIn", "duration": 0.3 } },
    { "type": "rect", "w": 40, "h": 40, "color": "#FFD60A", "y": "46%", "start": 1.2,
      "keyframes": [ { "t": 0, "w": 40, "h": 40, "radius": 20, "scale": 0 }, { "t": 0.2, "scale": 1, "easing": "backOut" }, { "t": 0.55, "w": 620, "h": 140, "radius": 70, "easing": "backOut" }, { "t": 2.0, "scale": 1 }, { "t": 2.08, "scale": 0.92 }, { "t": 2.25, "scale": 1 } ] },
    { "text": "Try it free", "size": 56, "weight": 800, "color": "#111111", "y": "46%", "start": 1.75, "in": "fadeUp",
      "keyframes": [ { "t": 1.45, "scale": 1 }, { "t": 1.53, "scale": 0.92 }, { "t": 1.7, "scale": 1 } ] },
    { "type": "cursor", "style": "arrow", "start": 2.3, "path": [ { "t": 0, "x": 900, "y": 1500 }, { "t": 0.9, "x": 770, "y": 905, "tap": true } ] },
    { "text": "lampo.video", "size": 40, "weight": 600, "letterSpacing": 2, "color": "#c7c7cc", "y": "54%", "start": 3.4, "in": "fadeUp" }
  ]
}
```

## 13. photo-hero

**Use for:** local businesses, food, products, places — anything with a good photo. **Signature:** the photo drifts in slowly (Ken Burns) under a dark overlay, a left-anchored headline rises word by word, and a tilted price tag stamps on.
**Timeline:** 0 photo + overlay · 0.3 headline · 1.0 line grows · 1.4 price stamp · 2.0 sub line.
**Rules:** overlay 0.35–0.5 for white text; left/bottom anchoring reads as editorial, centered reads as template.

```json
{
  "duration": 4,
  "background": { "type": "image", "src": "photo.jpg", "overlay": "rgba(0,0,0,0.45)", "kenburns": true },
  "layers": [
    { "text": "Neapolitan\npizza, done\n**right**.", "size": 120, "weight": 900, "color": "#ffffff", "accent": "#FFB800", "x": 90, "y": "60%", "anchor": "left", "align": "left", "in": { "effect": "wordsRise", "delay": 0.3 } },
    { "type": "line", "w": 260, "h": 8, "x": 90, "y": "73%", "anchor": "left", "color": "#FFB800", "in": { "effect": "grow", "delay": 1.0 } },
    { "type": "group", "x": "76%", "y": "30%", "w": 300, "h": 150, "rotate": -8, "bg": "#FFB800", "radius": 24, "start": 1.4, "in": "stamp", "layers": [
      { "text": "€ 7,90", "size": 64, "weight": 900, "color": "#111111", "x": 150, "y": 75 } ] },
    { "text": "Via Roma 12 · open till 1am", "size": 38, "weight": 600, "color": "#ffffff", "x": 90, "y": "78%", "anchor": "left", "align": "left", "start": 2.0, "in": "fadeUp" }
  ]
}
```

## 14. list-steps

**Use for:** "how it works", 3 reasons, a recipe, a checklist. **Signature:** numbered rows slide in one by one on a vertical rhythm, each gets a check that draws itself.
**Timeline:** 0 title · 0.5 / 0.95 / 1.4 rows · each check +0.35 after its row · hold.

```json
{
  "duration": 5,
  "background": "#FAFAF7",
  "layers": [
    { "text": "How it works", "size": 92, "weight": 900, "color": "#111111", "x": 110, "y": "30%", "anchor": "left", "align": "left", "in": "wordsRise" },
    { "text": "01", "size": 64, "weight": 900, "color": "#FF5A1F", "x": 110, "y": "42%", "anchor": "left", "start": 0.5, "in": "fadeUp" },
    { "text": "Write the JSON", "size": 56, "weight": 700, "color": "#111111", "x": 240, "y": "42%", "anchor": "left", "align": "left", "start": 0.5, "in": "wordsSlide" },
    { "type": "icon", "name": "check", "size": 64, "x": 960, "y": "42%", "color": "#30A14E", "start": 0.85, "in": "draw" },
    { "text": "02", "size": 64, "weight": 900, "color": "#FF5A1F", "x": 110, "y": "54%", "anchor": "left", "start": 0.95, "in": "fadeUp" },
    { "text": "Look at the preview", "size": 56, "weight": 700, "color": "#111111", "x": 240, "y": "54%", "anchor": "left", "align": "left", "start": 0.95, "in": "wordsSlide" },
    { "type": "icon", "name": "check", "size": 64, "x": 960, "y": "54%", "color": "#30A14E", "start": 1.3, "in": "draw" },
    { "text": "03", "size": 64, "weight": 900, "color": "#FF5A1F", "x": 110, "y": "66%", "anchor": "left", "start": 1.4, "in": "fadeUp" },
    { "text": "Render the MP4", "size": 56, "weight": 700, "color": "#111111", "x": 240, "y": "66%", "anchor": "left", "align": "left", "start": 1.4, "in": "wordsSlide" },
    { "type": "icon", "name": "check", "size": 64, "x": 960, "y": "66%", "color": "#30A14E", "start": 1.75, "in": "draw" },
    { "type": "line", "w": 860, "h": 3, "x": 110, "y": "74%", "anchor": "left", "color": "#d8d8d2", "start": 1.9, "in": "grow" }
  ]
}
```

## 15. camera-pan

**Use for:** a timeline, a journey, "from A to B to C". **Signature:** stations sit on one canvas three screens wide; a virtual camera pans across with a motion-blur kick on each move, and each station reveals as the camera arrives.
**Timeline:** 0 station 1 · 1.2–1.7 pan (blur) · 1.65 station 2 reveals · 2.9–3.4 pan · 3.35 station 3 · hold.
**Mechanics:** the camera is a `group` `w` 3240 centred on the frame; station i is centred when the group's `x` = 1620 − 1080·i. Children use the group's clock, so reveal delays match the pan times.

```json
{
  "duration": 5,
  "background": { "type": "gradient", "colors": ["#0b1020", "#141a33"], "angle": 90 },
  "layers": [
    { "type": "group", "w": 3240, "h": 1920,
      "keyframes": [ { "t": 0, "x": 1620, "blur": 0 }, { "t": 1.2, "x": 1620, "blur": 0 }, { "t": 1.45, "blur": 12 }, { "t": 1.7, "x": 540, "blur": 0, "easing": "inOut" }, { "t": 2.9, "x": 540, "blur": 0 }, { "t": 3.15, "blur": 12 }, { "t": 3.4, "x": -540, "blur": 0, "easing": "inOut" } ],
      "layers": [
        { "type": "line", "w": 3000, "h": 4, "x": 1620, "y": 1060, "color": "rgba(255,255,255,0.25)" },
        { "type": "circle", "r": 18, "x": 540, "y": 1060, "color": "#5E8BFF", "in": "popIn" },
        { "text": "2019", "size": 200, "weight": 900, "color": "#ffffff", "x": 540, "y": 860, "in": { "effect": "lettersBlur", "delay": 0.1 } },
        { "text": "One idea", "size": 56, "weight": 600, "color": "#9fb3ff", "x": 540, "y": 1180, "in": { "effect": "fadeUp", "delay": 0.4 } },
        { "type": "circle", "r": 18, "x": 1620, "y": 1060, "color": "#5E8BFF", "in": { "effect": "popIn", "delay": 1.6 } },
        { "text": "2022", "size": 200, "weight": 900, "color": "#ffffff", "x": 1620, "y": 860, "in": { "effect": "lettersBlur", "delay": 1.65 } },
        { "text": "10,000 users", "size": 56, "weight": 600, "color": "#9fb3ff", "x": 1620, "y": 1180, "in": { "effect": "fadeUp", "delay": 1.9 } },
        { "type": "circle", "r": 18, "x": 2700, "y": 1060, "color": "#FFD60A", "in": { "effect": "popIn", "delay": 3.3 } },
        { "text": "2025", "size": 200, "weight": 900, "color": "#FFD60A", "x": 2700, "y": 860, "in": { "effect": "lettersBlur", "delay": 3.35 } },
        { "text": "Everywhere.", "size": 56, "weight": 600, "color": "#ffffff", "x": 2700, "y": 1180, "in": { "effect": "fadeUp", "delay": 3.6 } }
      ] }
  ]
}
```

## 16. beat-cut-montage

**Use for:** music-driven teasers, energy openers, countdowns. **Signature:** one word per beat, hard cuts, a white flash on the downbeat, each word with a different entrance.
**Timing:** scene duration = beats × 60 / BPM (120 BPM → 0.5s per beat). Put the `audio` in the spec, start it on the first downbeat (`"start"`), and keep every scene a whole number of beats.
**Rule:** short scenes cap transitions at half their length, so use `none` or a 0.15–0.2s `flash`/`whip`.

```json
{
  "format": "9:16",
  "sfx": true,
  "scenes": [
    { "duration": 0.5, "background": "#000000", "layers": [ { "text": "3", "size": 420, "weight": 900, "color": "#ffffff", "in": { "effect": "stamp", "duration": 0.2 } } ] },
    { "duration": 0.5, "background": "#000000", "layers": [ { "text": "2", "size": 420, "weight": 900, "color": "#ffffff", "in": { "effect": "zoomOut", "duration": 0.25 } } ] },
    { "duration": 0.5, "background": "#000000", "layers": [ { "text": "1", "size": 420, "weight": 900, "color": "#ffffff", "in": { "effect": "glitch", "duration": 0.3 } } ] },
    { "duration": 0.5, "transition": { "type": "flash", "duration": 0.2 }, "background": "#FF2D55", "layers": [ { "text": "NEW", "size": 300, "weight": 900, "color": "#ffffff", "in": { "effect": "popIn", "duration": 0.25 } } ] },
    { "duration": 0.5, "transition": { "type": "whip", "duration": 0.2 }, "background": "#FFD60A", "layers": [ { "text": "DROP", "size": 300, "weight": 900, "color": "#000000", "in": { "effect": "skewIn", "duration": 0.25 } } ] },
    { "duration": 1.5, "background": "#000000", "layers": [ { "text": "FRIDAY\n**20:00**", "size": 180, "weight": 900, "color": "#ffffff", "accent": "#FFD60A", "in": { "effect": "wordsPop", "stagger": 0.1 }, "loop": { "effect": "heartbeat", "period": 0.5, "delay": 0.5 } } ] }
  ]
}
```
