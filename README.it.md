# ⚡ Lampo

[English](README.md) · **Italiano**

**Video veloci da JSON, pensati per gli agenti AI.** Spot, reel, TikTok, titoli animati, motion graphics in stile Apple.
L'agente scrive poche righe di JSON con effetti già pronti, Lampo fa il video in MP4.

Funziona come **plugin per Claude Code**, **estensione per Gemini CLI**, **server MCP** per Claude Desktop, Codex e ChatGPT, e come **CLI / libreria Node**.

```
spec.json  →  motore Skia (niente browser)  →  N worker in parallelo  →  ffmpeg  →  video.mp4
```

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

### ChatGPT e Claude.ai sul web (server remoto)
I client web vogliono un server MCP raggiungibile via HTTPS:
```bash
LAMPO_PUBLIC_URL=https://video.tuodominio.it LAMPO_TOKEN=segreto node mcp/server.js --http 3333
```
Mettilo su un VPS / Railway / Fly, oppure provalo con un tunnel (`cloudflared tunnel --url http://localhost:3333`).
Poi in ChatGPT (modalità sviluppatore → connettori) aggiungi `https://.../mcp`. I video si scaricano da `/files/<nome>.mp4`.
`LAMPO_TOKEN` è facoltativo: richiede `Authorization: Bearer <token>`.

## Uso da CLI
```bash
npx lampo init spot                  # spec di partenza
npx lampo preview spot.json          # griglia di fotogrammi chiave (PNG)
npx lampo render spot.json -q draft  # bozza veloce
npx lampo render spot.json -o spot.mp4
npx lampo guide                      # riferimento completo del formato
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
- **Formati**: 9:16, 1:1, 4:5, 16:9 (o width/height a mano), 1–120 fps, qualità draft/standard/high
- **Layer**: text (con `**evidenziato**`, gradiente, bordo, pillola/bottone), counter, rect, circle, line, image, **clip video** (taglio iniziale, rallentatore, loop, angoli arrotondati, audio del clip a scelta)
- **20 effetti** di entrata/uscita, tra cui `rise` (righe che salgono da una maschera, stile keynote), `wordsUp`, `letters`, `typewriter`, `blurIn`, `zoomOut`, `popIn`, `grow`
- **7 loop**: float, pulse, rotate, kenburns, drift, shake, breathe
- **8 transizioni**: fade, slide, push, slideUp, zoom, wipe, blur, none
- **Sfondi**: colore, gradiente animato, "glow" (luci morbide in movimento), immagine con Ken Burns, **video b-roll**
- **Effetti sonori (SFX)** generati da Lampo e sincronizzati da soli con le animazioni (`"sfx": true`): whoosh, pop, tick, impact, boom, riser, ding e altri, senza file audio e senza problemi di diritti
- **Audio** con fade in/out, **font personalizzati**, **layer globali** (logo/watermark), vignettatura
- **JSON tollerante**: accetta commenti e virgole finali, errori tipici degli LLM

## Struttura
```
src/           motore: spec.js (validazione), frame.js (disegno), effects.js, render.js (parallelo)
mcp/           server.js (stdio + HTTP, zero dipendenze), launch.js (auto-installa il motore)
cli/lampo.js   riga di comando
skills/lampo/  SKILL.md per Claude e Gemini (rigenera con scripts/build-skill.sh)
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
3. Render in cloud a pagamento via API: il modello di business

Licenza Apache 2.0.
