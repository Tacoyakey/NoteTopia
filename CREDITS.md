# Credits & third-party notices

NoteTopia is an unofficial fan project by **Takuya**. It is **not** affiliated with, endorsed by, or sponsored by Ubisoft, Growtopia, kixnoway.com, or any related company.

## NoteTopia (original)

- App design, Composer DAW, World view, MIDI convert, and original weather/backdrop art: Takuya
- License: MIT (`LICENSE`)

## Growtopia / Ubisoft (not included in public builds)

Growtopia, Growtopia item names, sheet-music block art, and note samples are **© Ubisoft** (or their respective owners). All rights reserved.

NoteTopia does **not** claim those assets. Public GitHub Pages builds omit game WAVs and sheet sprites. For personal local use you may place files you are allowed to use in:

- `public/notes/` — WAV/OGG/MP3 named like GTMusicSim (`piano_1.wav`, …)
- `public/tiles/` — 32×32 sheet-music PNGs

If those folders are empty, playback uses Tone.js synthesizers and World draws fallback tiles.

## GMSF / kixnoway.com

`.GMSF` import and export follow the v1 layout published in [KixDev / GrowtopiaMusicSimulatorFinal-Web](https://github.com/Kixdev/GrowtopiaMusicSimulatorFinal-Web) (`public/gmsf.js`), the source for [kixnoway.com](https://kixnoway.com). That project is **GNU GPL v3 or later**. NoteTopia does not copy that code; it reads and writes the same file bytes so songs can move between the two apps.

KixDev credits the original GMSF work as:

- MyLegGuy — programming
- HonestyCow — sound matching
- D.RS — theme
- Bonk — BPM formula
- KixDev — web version

Lua TXT from NoteTopia is a **NoteTopia blueprint**, not a kixnoway export.

## GTMusicSim

Pitch-lane tables, WAV index mapping, Audio Rack token format, and `.gtmusic` (`%cernmusicsim;`) follow [Cernodile’s Growtopia Music Simulator](https://github.com/cernodile/GTMusicSim) (AGPL-3.0). NoteTopia is a separate original codebase; GTMusicSim’s license applies to *their* code, not to NoteTopia.

GTMusicSim does not ship audio. Same rule here.

## Wiki sprites (local only)

Sheet-music icons used in local World Mode were referenced from [Growtopia Wiki — Sheet Music](https://growtopiawiki.com/w/Sheet_Music_(block_category)). Wiki hosting does not transfer Ubisoft’s copyright.

## Open-source libraries

| Package | License |
|---|---|
| React, React DOM | MIT |
| Tone.js | MIT |
| @tonejs/midi | MIT |
| @breezystack/lamejs | Apache-2.0 |
| idb | ISC |
| lucide-react | ISC |
| uuid | MIT |
| Vite, TypeScript, Vitest | MIT |
| Inter (font) | SIL Open Font License |

## Warranty

Software is provided “as is”, without warranty of any kind.
