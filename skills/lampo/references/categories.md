# Routes: what kind of video is this?

Pick the **one** route that matches the requested deliverable (not a word mentioned in passing). Each route
fixes length, format, scene count, the blueprint sequence and the default style. It's a starting shape:
change it when the content asks for it, but know why.

| # | Request | Route |
|---|---|---|
| 1 | a short unnarrated motion piece where the words/number/logo *are* the message (title, quote, stat, logo sting) | `motion-graphic` |
| 2 | an ad / reel / TikTok for a business, offer or product | `social-ad` |
| 3 | launching an app, SaaS, website or feature | `product-launch` |
| 4 | showing how an app/site works step by step | `app-walkthrough` |
| 5 | explaining a topic, steps, a list, "3 reasons…" | `explainer` |
| 6 | a video cut to a music track, a teaser, a countdown, an event drop | `beat-promo` |
| 7 | an intro/outro, end card, logo animation for a channel | `brand-sting` |
| 8 | footage the user supplies (clips, photos) that needs designed text on top | `footage-promo` |

Ambiguities:
- A single animated number, quote or logo under ~8s → `motion-graphic`, even if it's "for Instagram".
- "A video for my restaurant/shop" without a product flow → `social-ad`; with an app or booking flow → `app-walkthrough`.
- Music given as a background bed doesn't make it `beat-promo`; only when cuts must follow the beat.
- When the user supplies footage, `footage-promo` wins over the subject route; reuse that route's copy structure.

---

## motion-graphic

**Length** 4–10s · **Format** what the user asks, else 9:16 (1:1 for a loopable post) · **Scenes** 1–3 · **Style** Mono Motion, Keynote Glow or Bold Poster.
**Shape:** one dominant motif, hook in the first 0.5s, a pattern interrupt every ~2.5s (change exactly one thing: the palette, the scale, the direction).
**Blueprints:** kinetic-slam · stat-hit · morph-lockup · fixed-anchor-cycle · color-takeover · ticker-takeover · camera-pan.
**Typical sequence:** kinetic-slam → color-takeover → morph-lockup.
**Hold** the final frame ≥ 1s (people screenshot it).

## social-ad

**Length** 10–20s · **Format** 9:16 · **Scenes** 4–6 · **Style** Street Warm (local business), Bold Poster (offer), Soft Pastel (beauty/wellness), Keynote Glow (premium).
**Copy structure:** Hook (the pain or the desire, ≤ 5 words) → Product (what it is) → Proof or offer (number, price, before/after) → CTA (one action, with the name and where).
**Typical sequence:** kinetic-slam or photo-hero → photo-hero / grid-assemble → stat-hit or comparison-split → cta-press.
**Must:** `"sfx": true`, the brand name visible in the last 2s, the offer readable for ≥ 1.5s, safe zone respected.

## product-launch

**Length** 15–30s · **Format** 9:16 for social, 16:9 for site/YouTube · **Scenes** 5–8 · **Style** Keynote Glow, Data Drift or Mono Motion.
**Copy structure:** Hook → Problem → Product intro (name + one line) → 2–3 key features → Proof → CTA.
**Typical sequence:** typewriter-collapse or ticker-takeover → kinetic-slam (problem) → morph-lockup (intro) → app-demo / grid-assemble → stat-hit → cta-press.
**Must:** one continuity moment (morph or takeover) between problem and product; the product name appears once big, not in every scene.

## app-walkthrough

**Length** 12–25s · **Format** 9:16 · **Scenes** 3–5 (the phone can stay across one long scene) · **Style** Soft Pastel or Keynote Glow light variant, warm off-white background.
**Shape:** headline above the phone, the phone `slideUp`s in, screens as timed groups inside it (`slideLeft` between screens), a finger `cursor` that taps buttons (button `keyframes` press at the same time), `typewriter` in fields, a `fadeDown` notification group, a `stamp` on the key promise.
**Typical sequence:** kinetic-slam (hook) → app-demo (long) → stat-hit or list-steps → cta-press.
See `examples/it/artemii-preventivo.json`.

## explainer

**Length** 15–40s · **Format** 9:16 or 16:9 · **Scenes** one per idea, 3–4s each · **Style** Swiss Pulse or Soft Pastel.
**Shape:** a title card, then one idea per scene, numbered, each with an icon or a drawn path; a recap list at the end.
**Typical sequence:** titlecard → list-steps or one scene per step (alternate kinetic-slam / stat-hit / comparison-split) → list-steps recap → cta-press.
**Must:** consistent numbering position across scenes (match position), transitions `push`/`slideUp` to say "next".

## beat-promo

**Length** 6–20s · **Format** 9:16 · **Scenes** many, short (0.25–1s) · **Style** Bold Poster or Neon Night.
**Timing:** get the BPM (ask or assume 120). Beat = 60 / BPM s. Every scene a whole number of beats; the drop gets a `flash` and a boom; hold the final card 4–8 beats.
`audio` with `"start"` so the first downbeat lands at t=0; `fadeOut` 0.5.
**Blueprints:** beat-cut-montage, kinetic-slam (with swaps on beats), stat-hit for dates/prices.

## brand-sting

**Length** 3–6s · **Format** 16:9 (YouTube) or 9:16 · **Scenes** 1–2 · **Style** Mono Motion, Velvet Luxury or the brand's own.
**Blueprints:** morph-lockup, color-takeover → titlecard, cta-press (outro with subscribe/URL).
**Must:** loopable or with a clean final hold; one sound accent (boom/chime) on the name.

## footage-promo

**Length** match the footage (10–30s) · **Format** the footage's · **Style** follows the footage's color; pick an accent from it.
**Shape:** clips as scene `background` (`type: "video"`, `overlay` 0.3–0.45, `trim` to the best moment, `rate` 0.7 for slow motion) or as rounded `video` layers; text anchored left/bottom with `wordsRise`; hard cuts between clips, `whip` for energy.
**Blueprints:** photo-hero (with a video background), kinetic-slam over footage, stat-hit, cta-press.
