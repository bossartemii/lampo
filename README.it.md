# ⚡ Lampo

[English](README.md) · **Italiano**

**Video veloci da JSON, pensati per gli agenti AI.** Spot, reel, TikTok, titoli animati, motion graphics in stile Apple.
L'agente scrive poche righe di JSON con effetti già pronti, Lampo fa il video in MP4.

Funziona come **plugin per Claude Code**, **estensione per Gemini CLI**, **server MCP** per Claude Desktop, Codex e ChatGPT, e come **CLI / libreria Node**.

<p align="center"><img src="media/showreel-it.gif" height="420" alt="Showreel da 17 secondi fatto con Lampo"> &nbsp; <img src="media/coffee.gif" height="420" alt="Spot verticale per una caffetteria fatto con Lampo"></p>
<p align="center"><sub>Ogni video è un file JSON: <a href="examples/it/showreel.json">showreel.json</a> (17 s, renderizzato in ~10 s) · <a href="examples/coffee.json">coffee.json</a> · versione con l'audio sul <a href="https://bossartemii.github.io/lampo/">sito</a></sub></p>

```
spec.json  →  motore Skia (niente browser)  →  N worker in parallelo  →  ffmpeg  →  video.mp4
```

## Playground

**[Provalo nel browser →](https://bossartemii.github.io/lampo/playground/)** Scrivi lo spec e il video si aggiorna mentre scrivi, con il suono; poi lo scarichi. È il vero motore di Lampo nel browser: MP4 in Chrome, Edge e Safari, WebM in Firefox, senza caricare niente su un server. Parti da un esempio, un blueprint o uno stile, e condividi lo spec con un link.

## Lampo Cloud

Niente installazione per chi lo usa: un server HTTPS fa il render per tutti, anche da **ChatGPT** e **Claude.ai** (connettore con l'URL `https://tuo-host/mcp/lk_…`), da Claude Code / Cursor / Codex (header `Authorization: Bearer lk_…`) e via API (`POST /api/render`). I render gratuiti hanno la filigrana Lampo; il video pulito si paga una volta con **Stripe** (oppure con una chiave a crediti). Chiavi con crediti, limiti, link di download firmati e solo media https pubblici. Deploy gratis su **Hugging Face Spaces** (tre file da caricare, in `cloud/huggingface-free/`) oppure su Fly.io, Render o Docker: guida in **[CLOUD.md](CLOUD.md)**.

## Galleria

### 16 blueprint di scena
Modelli di scena con tempi precisi, una mossa firma e JSON pronto: l'agente ne copia uno per scena e cambia i testi.
<img src="media/blueprints.gif" width="100%" alt="Otto blueprint di Lampo">

<sub>kinetic-slam · morph-lockup · ticker-takeover · stat-hit · grid-assemble · app-demo · camera-pan · cta-press — tutti e 16 con JSON in <a href="skills/lampo/references/blueprints.md">blueprints.md</a></sub>

<table>
<tr>
<td width="50%" valign="top">

### 9 stili visivi
Keynote Glow · Swiss Pulse · Bold Poster · Neon Night · Velvet Luxury · Soft Pastel · Data Drift · Mono Motion · Street Warm.

Ogni stile fissa palette, tipografia, effetti, transizioni e suoni: il video sembra un unico progetto. I colori e il font del brand si sostituiscono, le regole di movimento restano. In [visual-styles.md](skills/lampo/references/visual-styles.md).

### Anche orizzontale
<img src="media/launch.gif" width="100%" alt="Video di lancio 16:9 fatto con Lampo">

</td>
<td width="50%" valign="top"><img src="media/styles.gif" width="100%" alt="I 9 stili visivi di Lampo"></td>
</tr>
</table>

### 42 suoni sintetizzati
Con `"sfx": true` ogni entrata, transizione, tocco e contatore ha il suo suono, sul fotogramma giusto. Niente file audio, niente diritti. **[▶ Ascoltali tutti](docs/media/sfx.mp4)**.

## Un motion designer dentro l'agente

Lo skill di Lampo (Claude Code, Gemini CLI, o `lampo_guide` con `topic` per gli altri client MCP) dirige il video:

1. **Tipo di video**: spot social, lancio prodotto, demo app, explainer, promo a tempo di musica, sigla… (8 percorsi con durata, scene e struttura del testo)
2. **Stile**: uno dei 9 qui sopra, o i colori del brand con le regole di quello stile
3. **Piano delle scene**: un blueprint per scena, un momento di continuità (morph, cambio colore, spinta), dove finisce il riser e dove cade il boom
4. **Spec**: seguendo le regole di motion (tempi e curve diverse, entrate in ordine di importanza, tre livelli per scena)
5. **Guarda e correggi**: `lampo_preview` restituisce i fotogrammi chiave come immagine in ~1 s, con una checklist
6. **Render**: l'MP4, più una variante proposta

## Perché è più veloce di HyperFrames e Remotion

| | Lampo | HyperFrames / Remotion |
|---|---|---|
| Cosa scrive l'agente | JSON corto con effetti per nome | HTML + CSS + GSAP / React TSX |
| Motore | Skia diretto (la grafica di Chrome, senza Chrome) | Chrome headless, screenshot per ogni frame |
| Errori tipici dell'agente | Validazione con messaggi "cosa correggere" | Animazioni rotte, timing, layout CSS |
| Anteprima per l'agente | `lampo_preview`: un'immagine con i fotogrammi chiave in ~1s | Render o browser |
| Licenza | Apache 2.0 | HyperFrames Apache 2.0 · Remotion a pagamento oltre 3 persone |

### Benchmark (stesso spot da 10,9 s, 1080×1920, 30 fps, macchina con 2 core)

| Metodo | Tempo | |
|---|---|---|
| Metodo browser (Chrome headless + screenshot + ffmpeg, la pipeline di Remotion/HyperFrames) | **53,4 s** | |
| Lampo, qualità standard | **13,7 s** | ~3,9× più veloce |
| Lampo, qualità draft (540×960, per iterare) | **3,0 s** | ~18× più veloce |

Note oneste: il confronto usa la stessa pipeline di base di quei tool, non i tool stessi (`bench/browser-baseline.js`, puoi rifarlo tu). Lampo fa anche più lavoro (transizioni tra scene, contatore, typewriter). Su un PC con più core il distacco cresce, perché i worker scalano coi core.

La spec dello spot è 2,3 KB di JSON. La versione HTML/CSS equivalente (senza transizioni e senza contatore) è 3,9 KB: meno token, meno cose da sbagliare.

## Installazione

Serve **Node 18+**. ffmpeg viene installato in automatico (`ffmpeg-static`) o usa quello di sistema.

```bash
git clone https://github.com/bossartemii/lampo && cd lampo && npm install
```

### Claude Code (plugin con skill + MCP)
```
/plugin marketplace add bossartemii/lampo
/plugin install lampo@lampo
```
Oppure in locale: `claude --plugin-dir ./lampo`

### Gemini CLI (estensione con skill + MCP)
```bash
gemini extensions install https://github.com/bossartemii/lampo
```

### Claude Desktop / Cursor / altri client MCP
```json
{ "mcpServers": { "lampo": { "command": "node", "args": ["/percorso/lampo/mcp/launch.js"] } } }
```
Dopo la pubblicazione su npm: `"command": "npx", "args": ["-y", "lampo-video", "mcp"]`

### Codex CLI (OpenAI) — `~/.codex/config.toml`
```toml
[mcp_servers.lampo]
command = "node"
args = ["/percorso/lampo/mcp/launch.js"]
```

### ChatGPT e Claude.ai sul web (Lampo Cloud)
Serve un server HTTPS (`mcp/server.js --http`) con chiave master, segreto per i link e URL pubblico. Deploy su Fly.io (`fly.toml`), Render (`render.yaml`) o qualsiasi host Docker, poi in Claude.ai o ChatGPT aggiungi un connettore con l'URL `https://tuo-host/mcp/lk_…`. Tutti i passaggi in [CLOUD.md](CLOUD.md).

## Uso da CLI
```bash
npx lampo init spot                  # spec di partenza
npx lampo preview spot.json          # griglia di fotogrammi chiave (PNG)
npx lampo render spot.json -q draft  # bozza veloce
npx lampo render spot.json -o spot.mp4
npx lampo guide                      # riferimento completo del formato
npx lampo guide blueprints           # anche: routes, styles, motion, review
```

## Esempio di spec
```json
{
  "format": "9:16",
  "theme": { "font": "Inter", "accent": "#FF9F0A" },
  "scenes": [
    {
      "duration": 3,
      "background": { "type": "glow", "colors": ["#FF6B00", "#FF2D55"] },
      "layers": [
        { "text": "Fame?", "size": 220, "weight": 900, "in": "blurIn" },
        { "text": "Ci pensiamo **noi**.", "size": 78, "y": "56%", "in": { "effect": "wordsUp", "delay": 0.6 } }
      ]
    },
    {
      "duration": 3, "transition": "zoom",
      "layers": [ { "type": "counter", "to": 20, "suffix": " min", "size": 240, "in": "popIn" } ]
    }
  ]
}
```
Esempi in italiano in `examples/it/`: `pizzeria.json`, `barbiere.json`, `lancio-app.json` (16:9). In inglese in `examples/`.

## Cosa c'è dentro
- **Skill di motion design** (un regista dentro l'agente): 8 tipi di video, 9 stili visivi, 16 blueprint con JSON pronto (kinetic slam, morph del logo, ticker, camera pan, demo app…), regole di motion e revisione visiva. In `skills/lampo/`, anche via `lampo_guide`. Esempio: `examples/it/showreel.json`
- **Formati**: 9:16, 1:1, 4:5, 16:9 (o width/height a mano), 1–120 fps, qualità draft/standard/high
- **Motion design**: forme che si **trasformano** (punto → linea → etichetta → icona app → schermo intero), cerchi che riempiono lo schermo, transizione a **cerchio**, testo con **glitch RGB**, **25 icone** (anche dentro il testo), **spinner**, entrate veloci con scia (`rush`). Vedi `examples/it/artemii-app.json`
- **Demo di app e siti**: un iPhone il cui schermo si disegna in punti reali, gruppi per card/bottoni/schermate, un **dito** che scorre e tocca con l'onda del tocco, **keyframe** per zoom e bottoni premuti, **tratti a mano** che si disegnano da soli (sottolineatura, cerchio, freccia, spunta, qualsiasi SVG) e l'effetto **timbro**. Vedi `examples/it/artemii-preventivo.json`
- **Layer**: text (con `**evidenziato**`, gradiente, bordo, pillola/bottone), counter, rect, circle, line, image, **clip video** (taglio iniziale, rallentatore, loop, angoli arrotondati, audio del clip a scelta)
- **44 effetti** di entrata/uscita, tra cui `rise` (righe che salgono da una maschera, stile keynote), `wordsRise`, `wordsUp`, `letters`, `lettersBlur`, `cascade`, `typewriter`, `blurIn`, `zoomOut`, `popIn`, `grow`, `iris`, `flip`, `elastic`, `swing`, `skewIn`, `flicker` (insegna al neon), `focus`, `unfold`
- **14 loop**: float, pulse, rotate, kenburns, drift, shake, breathe, wiggle, swing, bounce, orbit, heartbeat, flicker, glitch
- **19 transizioni**: fade, slide, slideUp, slideDown, push, pushUp, whip, zoom, zoomIn, wipe, wipeLeft, wipeUp, wipeDown, barn, blur, circle, fadeBlack, flash, none
- **Sfondi**: colore, gradiente animato, "glow" (luci morbide in movimento), immagine con Ken Burns, **video b-roll**
- **Effetti sonori (SFX)** generati da Lampo e sincronizzati da soli con le animazioni (`"sfx": true`): 42 suoni (whoosh, flyby, riser, reverse, pop, tap, tastiera, successo, cassa, scatto, impact, slam, drop, kick, snare, magic, sparkle…), senza file audio e senza problemi di diritti
- **Audio** con fade in/out, **font personalizzati**, **layer globali** (logo/watermark), vignettatura
- **JSON tollerante**: accetta commenti e virgole finali, errori tipici degli LLM

## Struttura
```
src/           motore: spec.js (validazione), frame.js (disegno), effects.js, render.js (parallelo)
mcp/           server.js (stdio + HTTP, zero dipendenze), launch.js (auto-installa il motore)
cli/lampo.js   riga di comando
skills/lampo/  SKILL.md + references/ (tipi di video, stili, blueprint, regole di motion, revisione) per Claude e Gemini
.claude-plugin/, .mcp.json      plugin Claude Code
gemini-extension.json, GEMINI.md estensione Gemini CLI
bench/         benchmark contro il metodo browser
test/smoke.js  test con ogni effetto, transizione, immagine e audio
```

## Limiti attuali (v0.1)
- Niente HTML/CSS arbitrario: è il prezzo della velocità. Per scene particolari serve un nuovo tipo di layer.
- Niente sottotitoli automatici da audio, per ora.
- Il render distribuito su più macchine (tipo Remotion Lambda) non c'è: scala sui core di una macchina.

## Roadmap
1. Sottotitoli automatici da audio con Whisper
2. Template pronti per settore (ristoranti, barbieri, immobiliari, palestre)
3. ✅ Lampo Cloud: server per ChatGPT e Claude.ai, API REST, chiavi e crediti ([CLOUD.md](CLOUD.md))
4. ✅ Playground nel browser: JSON → video
5. Istanza pubblica di Lampo Cloud già pronta

Licenza Apache 2.0.
