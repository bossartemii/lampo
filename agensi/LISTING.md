# Lampo on Agensi: listing kit

> **Come pubblicarlo (per Dimitri):**
> 1. `node private/packs/build.js && node scripts/build-agensi.js` → `agensi/lampo-motion-designer.zip` (non è nel repo pubblico: contiene i pack a pagamento).
> 2. agensi.io → Settings → *Creator Mode* → collega **Stripe Connect** (prima del caricamento, altrimenti non incassi).
> 3. Creator Dashboard → nuova skill → carica lo zip → copia i campi qui sotto → immagini da `agensi/` → prezzo → invia per la revisione.
> 4. Prima di pubblicare: Space HF su hardware sempre acceso (o accetta che il fallback cloud abbia 20–90 s di risveglio).

---

## Name
Lampo — Motion Designer for AI Agents

## Tagline (one line)
Your agent directs and renders cinematic ads, reels and logo stings to MP4: 12 industry packs, camera, depth, motion blur and sound.

## Category / tags
Category: Video & Motion / Marketing & Content
Tags: video, motion graphics, product video, ads, reels, tiktok, higgsfield, remotion alternative, after effects alternative, kinetic typography, logo animation, social media, marketing, mp4

## Price
**$7.99**. Launch deal: **$5.99 for the first 72 hours**. Raise to **$12** after 25 reviews.

## Short description
Ask your agent for "a 15-second reel for my coffee shop" and it works like a senior motion designer: it starts from a finished industry pack, plans every shot with camera and depth, writes the Lampo spec, reviews a contact sheet, fixes what's off and renders an MP4 with sound. No After Effects, no browser, no template editor.

## What you're paying for
The Lampo engine is free and open source (Apache-2.0). **This package is the paid direction layer: packs, recipes, review gate. You are buying the director, not the renderer.**

- **12 industry packs, 36 finished videos**: restaurant, gym, real estate, SaaS, café, barber, e-commerce, clinic, hotel, car dealer, creative agency, event. Each pack has a 15 s ad, a 5 s offer hit and a 4 s brand sting, already reviewed frame by frame, plus the copy structure (what each scene must say) and the brand slots to swap. Not in the open-source repo.
- **The director workflow**: intent → route → style → shot plan (blueprint, camera move, depth plane per scene) → spec → visual review → finish pass → render.
- **Cinematography recipes**: camera language (push-in, orbit, crash zoom, handheld…), three-plane parallax, motion blur, particles, film look, grading by style, 5 cinematic recipes.
- **The review gate**: the agent must look at a contact sheet before rendering and fix cut text, overlaps, empty frames and repeated motion. It never describes a video it didn't render.
- **A deterministic render preflight** (`scripts/preflight.sh`): MCP → local CLI → Lampo Cloud, in that order, with fixed time limits.

## Requirements
- **Primary: Node 18+ and a shell.** The first render downloads the engine with `npx` (measured: 16 s cold on a clean machine, then a 15 s 1080×1920 ad renders in ~25 s). ffmpeg is bundled.
- **Or** the Lampo MCP server (Claude Code plugin, Claude Desktop, Cursor, Gemini CLI).
- **Fallback: Lampo Cloud** over HTTP for agents without a shell. Free renders carry a watermark; clean videos with a key or a one-time payment. The cloud can take 20–90 s to wake up.
- No API key needed to start.

## Permissions
| Permission | Why |
|---|---|
| Terminal / shell | runs `scripts/preflight.sh` and `npx … render` |
| Read / write files | writes `spec.json`, preview PNGs and the final `.mp4` in your project |
| Network: npm registry + GitHub | first run only, to fetch the open-source engine with `npx` |
| Network: Lampo Cloud (`dimaartemi-lampo.hf.space`) | only if there is no Node/shell: render over HTTP |

No telemetry. Nothing is uploaded unless the agent uses the Cloud path.

## Example session (real output)
> **You:** Make a 15-second vertical ad for my coffee shop North Bean. Second cup half price before 10am. Site northbean.coffee.

1. **Preflight**: `bash scripts/preflight.sh` → `LAMPO_PATH=npx` (Node found, engine fetched in 16 s).
2. **Route and pack**: social ad · café pack · style Soft Pastel.
3. **Shot plan** (screenshot 2): hook ticker takeover (handheld + push-in) → three benefit cards on a pull-out → "-50%" price stamp on a crash zoom → the brand condenses into a button, a cursor clicks it.
4. **Spec**: the pack's ad with the slots swapped (brand, offer, benefits, contact).
5. **Review** (screenshot 3): 10-frame contact sheet; the agent checks overlaps and safe areas, fixes, previews again.
6. **Render**: `npx -y github:bossartemii/lampo render spec.json -o north-bean.mp4` → 1080×1920, 14.5 s, 30 fps, with sound, 1.5 MB.

## How I made it
I built Lampo, an open-source JSON → MP4 engine for agents (Skia canvas + ffmpeg, deterministic frames, parallel workers). Then I wrote down how a motion designer actually works: routes, styles, 16 shot blueprints, camera and depth rules, a finish pass, a review checklist. Every pack spec in this package was rendered, reviewed on a contact sheet and fixed until nothing overlapped or got cut. The cover and screenshots are frames from those packs, rendered by Lampo.

## What's inside
```
lampo-motion-designer/
├── SKILL.md                     director workflow + render preflight
├── LICENSE                      Apache-2.0
├── NOTICE                       what is free, what is paid
├── scripts/preflight.sh         MCP → CLI → Cloud, deterministic
└── references/
    ├── spec.md                  full JSON reference
    ├── categories.md            8 video routes
    ├── visual-styles.md         9 styles with palette, type, motion
    ├── blueprints.md            16 shot blueprints (runnable JSON)
    ├── motion-principles.md     easing, choreography, sound rules
    ├── pro-motion.md            camera, depth, grading, 5 cinematic recipes
    ├── review.md                review checklist, defects → fixes
    └── packs/                   12 industry packs × 3 finished specs
```

## FAQ
**Isn't Lampo free on GitHub?** The engine is. The industry packs, the recipes and the review gate in this package are not in the repo. You pay for direction, not rendering.

**Do I need a GPU or After Effects?** No. It renders on CPU with Node 18+. A 15 s vertical ad takes about 25 s on a laptop.

**Which agents does it work with?** Any agent that loads SKILL.md: Claude Code, Claude Desktop, Cursor, Gemini CLI, Codex and others. Shell agents render locally; agents with only HTTP use Lampo Cloud.

**Can I use the videos commercially, for clients?** Yes. Videos you render are yours. The packs are licensed for your and your clients' videos; you can't resell them as a pack or skill.

**What if rendering isn't possible in my environment?** The preflight says so (`LAMPO_PATH=none`). The agent hands you the spec and the two commands to render it elsewhere, and never pretends a video exists.

## Images for the listing (folder `agensi/`)
1. `cover.png` (1080×1080): cover
2. `shot-plan.png` (1920×1080): the shot plan the agent writes before any JSON
3. `contact-sheet.png`: the review sheet it reads before rendering
4. `final-frame.png` (1080×1920): a frame of the finished video
Extra: `media/cinematic.gif`, `media/showreel.gif`; video with sound `docs/media/showreel.mp4`.

## Creator
**Dimitri Artemii**, builder of Lampo, an open-source motion engine for AI agents.
GitHub: [@bossartemii](https://github.com/bossartemii) · Hugging Face: [dimaartemi](https://huggingface.co/dimaartemi) · Playground: https://bossartemii.github.io/lampo/playground/
<!-- add X / Instagram / LinkedIn here -->

## Links
- Engine (free): https://github.com/bossartemii/lampo
- Playground: https://bossartemii.github.io/lampo/playground/
- Lampo Cloud: https://dimaartemi-lampo.hf.space
