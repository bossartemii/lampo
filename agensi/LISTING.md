# Lampo on Agensi: listing kit

> **Come pubblicarlo (per Dimitri):** su agensi.io crea l'account → Dashboard → Settings → attiva *Creator Mode* →
> Creator Dashboard → nuova skill → carica `lampo-motion-designer.zip` (questa cartella) → copia i campi qui sotto →
> immagini da `media/` → prezzo → invia per la revisione. Per i pagamenti collega Stripe Connect.
> Rigenera lo zip dopo ogni modifica allo skill: `node scripts/build-agensi.js`.

---

## Name
Lampo — Motion Designer for AI Agents

## Tagline (one line)
Your agent directs cinematic motion graphics: camera moves, parallax depth, motion blur, particles and sound, rendered to MP4 in seconds.

## Category / tags
Category: Video & Motion / Marketing & Content
Tags: video, motion graphics, ads, reels, tiktok, social media, kinetic typography, logo animation, product launch, marketing, mp4, after effects alternative

## Price
Suggested: **$12** (impulse range; the skill also leads buyers to Lampo Cloud renders, keys and AI videos).

## Short description
Ask your agent for "a 15-second reel for my pizzeria" and it works like a senior motion designer: it picks the video type, a visual style and a proven shot for every scene, plans the camera and depth, writes the Lampo spec, looks at a preview, fixes what's off, and renders a finished MP4 with sound. No After Effects, no browser, no templates to fill.

## Long description
Lampo is an open-source motion engine built for AI agents. This skill is the director that drives it.

**What your agent learns**
- **8 video routes**: social ad, product launch, app walkthrough, explainer, beat-synced promo, brand sting, motion graphic, footage promo, each with length, scenes and copy structure.
- **9 visual styles**: Keynote Glow, Swiss Pulse, Bold Poster, Neon Night, Velvet Luxury, Soft Pastel, Data Drift, Mono Motion, Street Warm: palette, type, motion and grade that belong together.
- **16 shot blueprints** with ready JSON: kinetic slam, morph lockup, ticker takeover, stat hit, grid assemble, app demo with a tapping finger, camera pan, CTA press, beat-cut montage, and more.
- **Cinematography**: a virtual camera (push-in, pull-out, pans, tilts, orbit, dutch, handheld, crash zoom, impact shake), three-plane parallax depth, real motion blur, particles (sparks, embers, confetti, bokeh, dust, bursts), and a film look (grain, light leaks, letterbox).
- **The craft**: the 12 animation principles applied, typography like a title designer, timing on the beat, a finish pass, and 5 cinematic recipes (cinematic title, product orbit, energy drop, luxury reveal, neon handheld).
- **A review loop**: the agent looks at keyframes before rendering and fixes cut text, overlaps, empty frames and repetitive motion.
- **Sound design**: 42 synthesized sound effects placed on the motion automatically.

**How it renders**, from any agent:
1. Lampo MCP tools (Claude Code plugin, Gemini CLI, Claude Desktop, Cursor…), or
2. the CLI straight from GitHub: `npx -y github:bossartemii/lampo render spec.json` (Node 18+, ffmpeg bundled), or
3. the Lampo Cloud HTTP API (any agent that can make an HTTP request): free with a watermark, clean videos with a key or a one-time payment.

**Output**: MP4 (H.264) in 9:16, 1:1, 4:5 or 16:9, up to 120 fps, with sound. A 15-second 1080×1920 ad renders in seconds.

## What's included
- `SKILL.md`: the director workflow (intent → route → style → shot plan with camera and depth → spec → visual review → finish → render)
- `references/`: spec reference, routes, styles, blueprints (JSON), motion principles, pro cinematography with recipes (JSON), review checklist

## Requirements
One of: the Lampo MCP server, Node 18+ with a shell (for `npx`), or HTTP access to Lampo Cloud. No API key needed to start (cloud renders without a key carry a watermark).

## Example prompts
- "Make a 15-second vertical ad for my coffee shop, North Bean, 20% off this week."
- "Animate our logo LAMPO as a 4-second premium sting, black and gold."
- "A cinematic 16:9 launch trailer for our app, three features, end on the App Store link."
- "Turn these three numbers into an animated stat reel for LinkedIn."

## Images and video for the listing (in this repository)
- `media/cinematic.gif`: the 5 cinematic recipes (camera, depth, particles, film look)
- `media/showreel.gif`: a 17-second showreel made with the skill
- `media/blueprints.gif`, `media/styles.gif`: shot blueprints and visual styles
- `docs/media/showreel.mp4`, `docs/media/sfx.mp4`: video with sound
- Live demo: https://bossartemii.github.io/lampo/playground/

## Links
- Source: https://github.com/bossartemii/lampo
- Playground: https://bossartemii.github.io/lampo/playground/
- Lampo Cloud: https://dimaartemi-lampo.hf.space
