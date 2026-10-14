# Motion principles

The rules that separate "a template" from motion design. Read them before writing a spec, and check against
them in review. Each rule is written for Lampo's JSON: effect names, `easing`, `delay`, `duration`, `keyframes`.

## Guardrails: you know these, and you still break them

- **Don't use the same entrance on everything.** The lazy default is `fadeUp` on every layer. In one scene, use at least 2 different entrances; across the video, never repeat a scene's hero entrance in the next scene.
- **Don't use the same speed on everything.** The lazy default is 0.6–0.7s for everything. The slowest move in the video should be ~3× slower than the fastest (a 0.25s `stamp` next to a 1.2s `focus`).
- **Don't use the same easing on everything.** The default `apple` is fine for most. Then add contrast: `expoOut` for confident, `backOut`/`elasticOut` for playful, `inOut` for camera moves, `linear` only for typewriters and constant drifts.
- **Don't enter everything from the same direction.** Mix: from below (`fadeUp`, `rise`), from the side (`slideLeft`, `skewIn`, `rush`), from depth (`zoomOut`, `focus`, `blurIn`), from nothing (`popIn`, `elastic`, `stamp`), revealed (`wipe`, `iris`, `unfold`).
- **Don't start at t=0.** Offset the first entrance by 0.1–0.3s (`delay`). Zero-delay feels like a jump cut.
- **Don't dump everything at once.** Stagger with `delay`. The whole build of a scene happens in its first 30%.
- **Don't put the same ambient loop on every scene.** One scene floats, another drifts, another stays still. Stillness after motion is powerful.
- **Don't center everything.** Centered and floating is a web pattern. Anchor to the left edge (`"x": 90–120, "anchor": "left", "align": "left"`) for editorial, split the frame for comparisons.

## Easing is emotion

The effect is the verb, the easing is the adverb. A `slideLeft` with `expoOut` is confident, with `inOut` is dreamy, with `backOut` is playful.

| Feeling | Easing | Typical effects |
|---|---|---|
| Premium, calm (default) | `apple` | `rise`, `fadeUp`, `blurIn`, `focus`, `wordsRise` |
| Confident, fast, tech | `expoOut` | `skewIn`, `rush`, `stamp`, `slideLeft`, `wordsSlide` |
| Playful, friendly | `backOut`, `elasticOut` | `popIn`, `elastic`, `wordsPop`, `flip`, `letters` |
| Physical, heavy | `bounceOut` | `drop` |
| Camera, morph, between states | `inOut` | `keyframes` on groups, `grow`, `wipe`, `unfold`, `iris` |
| Mechanical | `linear` | `typewriter`, `drift` |

Direction rules (not optional):
- **Entrances decelerate** (`out`-type easings: `apple`, `expoOut`, `backOut`). This is every `in`.
- **Exits accelerate** (`in`). `out` effects use `in` by default; leave it.
- **Moves between two positions** use `inOut` (in `keyframes`, set `"easing": "inOut"` on the target keyframe).

## Speed is weight

| Duration | Reads as | Use for |
|---|---|---|
| 0.15–0.3s | energy, urgency, impact | `stamp`, beat swaps, `flash`/`whip` transitions, button presses |
| 0.3–0.5s | professional | most UI, pills, icons, `popIn` |
| 0.5–0.8s | gravity, premium | headlines (`rise`), cards, `slideUp` phones |
| 0.8–2.0s | cinematic, emotional | `focus`, `blurIn` on a solemn line, camera pull-backs, Ken Burns |

Asymmetry: **exits are faster than entrances** (a card takes 0.5s to appear, 0.25s to go: `"out": { "effect": "fade", "duration": 0.25 }`).

## Scene structure: build → breathe → resolve

Every scene has three phases. The common mistake is to spend everything in the build.

- **Build (0–30%)**: elements enter, staggered, in order of importance.
- **Breathe (30–70%)**: everything is readable and alive with **one** ambient motion (a `loop`, a slow camera `keyframes`, an animated background).
- **Resolve (70–100%)**: an exit, an emphasis beat (`heartbeat`, a press, a drawn underline) or a decisive hold before the cut.

A key element must stay fully readable for at least ~0.3s per word of copy (a 6-word line ≈ 1.8s on screen).

## Choreography is hierarchy

- What moves first is what matters most. Stagger by importance, not by layer order: hero (0.1–0.2s) → support line (+0.3–0.5s) → details/CTA (+0.3s).
- Overlap entries; don't wait for one to finish. A whole stagger sequence stays under ~0.5s regardless of item count (6 cards → 0.08–0.09s apart).
- Per-unit text effects already stagger (`wordsUp`, `letters`...). Tune with `"stagger"` in the `in` object: 0.03–0.05 for letters, 0.06–0.1 for words, 0.1–0.15 for lines.

## Transitions are meaning

| Transition | Says | Duration |
|---|---|---|
| none (hard cut) | "wake up", disruption, beat | 0 |
| `fade`, `blur` | "this continues" | 0.5–0.7 |
| `slide`, `push`, `pushUp`, `slideUp`/`slideDown` | "next item", a sequence | 0.5–0.6 |
| `whip` | energy, "and also…" | 0.25–0.4 |
| `zoom`, `zoomIn` | going deeper, a reveal | 0.5–0.7 |
| `wipe*`, `barn` | a new chapter, editorial | 0.5–0.7 |
| `circle` (iris from `origin`) | focus on one point, playful | 0.6–0.8 |
| `fadeBlack` | pause, solemn line, ending | 0.6–1.0 |
| `flash` | impact, drop, reveal on a beat | 0.15–0.3 |

The lazy default is `fade` everywhere. In a 4–5 scene video use at least 2 different transition types, and at least one hard cut.
Even better than a transition: **continuity** (see below).

## Continuity: the motion-design signature

What makes a video feel "designed" instead of "assembled" is that things transform instead of appearing.

- **Morph instead of cut**: one `rect` with `keyframes` on `w`, `h`, `radius`, `color` goes dot → line → pill → card → full screen. The full-screen state's color becomes the next scene background (hard cut, invisible).
- **Color takeover**: a `circle` whose `r` keyframes grow to ~1300 fills the frame with the next scene's background.
- **Match position**: the hero of scene B appears where the hero of scene A was (same `x`/`y`).
- **Camera**: a `group` without `w`/`h` wraps the whole scene; `keyframes` on its `scale`/`x`/`y`/`rotate`/`blur` are camera moves (push-in, pull-back, pan with motion blur). Use one camera move per scene at most.
- **Shove, don't fade**: a hero that arrives pushes the old element out (`keyframes` on the old element's `x` timed to the hero's arrival).

## Emphasis (in place, on a beat)

- Scale punch: `"keyframes": [{ "t": 1.0, "scale": 1 }, { "t": 1.08, "scale": 1.12 }, { "t": 1.25, "scale": 1 }]`
- Press: same with `scale` 0.92 (buttons, cards being tapped).
- Loops: `pulse` (gentle), `heartbeat` (urgent), `shake` (error, alarm, impact), `glitch` (tech), `flicker` (neon), `wiggle` (playful attention).
- Hand-drawn: a `path` `underline`/`circle`/`arrow` with `in: "draw"` 0.3–0.4s after the word lands.
- Color: the `**accent**` word is the emphasis. One accent word per line, max two per scene.

## Visual composition

You are designing for a phone screen at arm's length, not a web page.

- **Fill the frame.** Hero text 60–80% of the width. In the 1080-wide design space: hero 160–260 (`weight` 800–900), headline 90–130, support 44–60, labels 28–36 with `letterSpacing` 4–12 in caps. Nothing under 28.
- **Three layers per scene minimum.**
  1. Background treatment: `glow`, animated `gradient`, image/video with `overlay`, or a flat color plus ghost type.
  2. Foreground content: the hero and its support line.
  3. Accent elements: a `line` that grows, a drawn `path`, an `icon`, a pill, a small label pinned to a corner.
- **The background is never just empty.** Pure `#000`/`#fff` with one centered line reads as "nothing loaded". Use a tinted near-black (`#0b0b10`) or warm off-white (`#F4F2EE`), a `glow`, or **ghost type**: the scene's key word at size 400–600, `opacity` 0.04–0.08, `wrap: false`, `fit: false`, with `loop: drift`.
- **Two focal points.** The eye needs to travel: hero + an accent element, number + a bar, title + a pinned label.
- **Anchor to edges** for editorial looks; use structural elements (hairline `line` rules, dividers) that animate with `grow`.
- **Every line must earn its place**: a drawn underline points at a word, a connector joins two real elements. Decorative lines that point at nothing: cut them.
- **9:16 safe zone**: keep text between y 15% and 80% and x 8%–92%. Social UI covers the rest.

## Image and video treatment

Never place a flat, static photo.
- As background: `"kenburns": true` + `overlay` 0.35–0.5 for white text.
- As a layer: `radius` 24–40, `shadow: true`, an entrance (`iris`, `scaleIn`, `wipeUp`) and a slow loop (`kenburns`, `float` with amount 8).
- Device frame: put screenshots or recordings in a `phone` (`src`) instead of a bare rectangle.
- Clips: `rate` 0.5–0.8 for cinematic slow motion; `trim` to start on the interesting frame.

## Sound design

- Turn on `"sfx": true` for anything social: sound makes motion feel twice as fast.
- One `riser` (or `reverse`) ending exactly on the main reveal (`"at": reveal - duration`), one `boom`, `impact` or `drop` on the brand name. Not more than one boom per 5s.
- Match the sound to the gesture: UI taps → `tap`/`click`, typing → `keyboard`, a success state → `success`/`ding`, a price → `cash`/`coin`, a photo → `shutter`, magic/AI reveal → `magic`/`sparkle`, something leaving → `downlifter`, tension → `heartbeat`, beats → `kick`/`snare`/`clap`/`hihat`.
- Mute noisy duplicates: many identical swaps in a row → `"sfx": false` on most of them, keep the last.
- With music (`audio`), cut scenes on the beat: scene duration = beats × 60 / BPM.
