# Sound effects (WAV samples)

Place Growtopia-style note `.wav` files here. The app loads them at runtime from `/notes/`.

## Folder location

```
public/notes/
  piano_1.wav
  piano_3.wav
  bass_1.wav
  drum_1.wav
  ...
```

After adding files, restart the dev server (`npm run dev`) and enable **WAV Samples** in World Mode settings.

## Naming convention

Files follow [GTMusicSim](https://github.com/cernodile/GTMusicSim) naming:

| Pattern | Example |
|---------|---------|
| `{instrument}_{index}.wav` | `piano_1.wav`, `piano_3.wav` |
| Flat variant | `piano_0.wav`, `piano_2.wav` |
| Drums (7 hits) | `drum_1.wav` … `drum_6.wav` |

### Supported instrument stems

- `piano`, `bass`, `drum`, `sax`, `flute`
- `spanish_guitar`, `violin`, `lyre`, `electric_guitar`, `mexican_trumpet`
- `spooky`, `festive`

### Pitch index tables (from GTMusicSim)

**Natural notes:** indices `1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 18, 20, 22, 24`  
**Flat notes:** indices `0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23`  
**Sharp notes:** indices `2, 4, 6, 7, 9, 11, 13, 14, 16, 18, 19, 21, 23, 25`

Each index maps to a pitch lane (B at top → c at bottom). Sharps are their own chromatic files (F♯ is `piano_7.wav`, not the G sample). E♯ and B♯ reuse F and C.

## Where to get the files

GTMusicSim does **not** ship audio. The original tool expects WAVs extracted from a Growtopia game install, copied into a `notes/` folder.

If no samples are found, Music World falls back to **Tone.js synthesizers** automatically.

The app also accepts `.ogg` and `.mp3` with the same stems (`piano_1.ogg`, etc.).

## Quick test

Add a single file to verify loading works:

```
public/notes/piano_1.wav
```

Play the demo song — if samples are detected, piano notes use the WAV instead of the synth.

## Legal note

Growtopia audio assets are owned by Ubisoft. Only use files you are permitted to use. **Do not commit or redistribute copyrighted samples.** Public GitHub Pages builds omit these files.
