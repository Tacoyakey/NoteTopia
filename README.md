# NoteTopia

A browser music composer and Growtopia-style world visualizer. Write a song in the piano roll, then watch it play as stacked sheet-music tiles in a 2D world.

**Alpha** — unofficial fan project. **Not affiliated with Ubisoft or Growtopia.**

**100% client-side** — no backend. Deploy as a static site (GitHub Pages included).

## Features

- **World Mode** — Sunny hills, Stargazing, nothingness, or a solid color. 14-lane Growtopia pitch grid, click-to-place / right-click-to-break tiles, follow-playhead camera, density, and zoom
- **Composer Mode** — DAW-style arrange with one lane per track, plus a piano roll for the selected layer. Mute, solo, volume, snap grid. Arrange and piano roll are resizable and can be minimized.
- **Export** — Mix down to MP3 or WAV in the browser using Growtopia note samples (mute/solo respected)
- **Instruments** — Piano, bass, drums, sax, flute, Spanish guitar, electric guitar, violin, lyre, trumpet, spooky, Winterfest (flat/sharp variants where the game has them)
- **MIDI + GT import** — Drag-and-drop `.mid` / `.midi` / `.gtmusic` / `.gmsf`. MIDI import opens a convert picker (Basic, Preserve, or Adapt). Preserve keeps the original melody shape. Adapt analyzes phrases and importance, then arranges the mix into Growtopia’s two-octave staff. Mixed overlaps become Audio Racks. The method is remembered on the song.
- **GMSF** — Export `.GMSF` for [kixnoway.com](https://kixnoway.com) (KixDev’s web GMSF). `.gtmusic` stays Cernodile’s text format. Lua TXT is a NoteTopia-only blueprint.
- **Projects** — Auto-save to IndexedDB, manual save/load, JSON export/import
- **Keyboard** — Space play, Tab switch modes, `?` help, Ctrl+Z/C/V/A, arrows

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

The first launch loads **Night Chorus**, an original stacked-tile demo. Click WORLD tiles to build; pick an instrument in the **Place as** palette.

## Scripts

```bash
npm run test
npm run lint
npm run build
npm run preview
```

## Deploy

Live site is a Cloudflare Worker (`notetopia`). Push to `main` rebuilds it. GitHub Actions only runs tests, lint, and `npm run build`.

## Architecture

```
Song Model (source of truth)
  → Audio Engine (Tone.js Transport)
  → Composer Renderer (Canvas piano roll)
  → World Renderer (Canvas 2D)
```

Timing is stored in **beats**, never pixels or seconds. BPM changes playback speed without moving notes. World spacing is a separate density multiplier.

MIDI → Growtopia convert methods live in `src/music/convert/`. Adapt builds an intermediate musical score (phrases, chords, importance), arranges within the hard two-octave staff, then bakes tiles. Basic and Preserve stay independent. Add a new file, register it in `CONVERT_MODELS`, and optionally retarget `DEFAULT_CONVERT_MODEL_ID`. Saved projects keep `worldSettings.convertModel`.

## Languages

Help, buttons, and instructions live in JSON files under [`locales/`](locales/README.md). Copy `en.json` to `es.json` (or any language code), translate the values, and open a pull request. Missing strings fall back to English, so you can start with the help text. The in-app **Language** picker (toolbar and help) picks up every `locales/*.json` file after a rebuild.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| Tab | Switch Composer ↔ World |
| ? | Help |
| Click / right-click (World) | Place / break a tile |
| Delete | Delete selected notes |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+C / V / A | Copy / paste / select all |
| Arrow keys | Move selected notes |

## License

Original NoteTopia code is [MIT](LICENSE). Third-party notices, Growtopia/Ubisoft disclaimers, and library credits: [CREDITS.md](CREDITS.md).

Growtopia audio and sheet sprites are **© Ubisoft** and are **not** part of the MIT license. If `public/notes/` or `public/tiles/` are empty, playback uses synthesizers and drawn tiles.
