# Languages

Player-facing text (help, buttons, tooltips, convert instructions) lives in these JSON files so anyone can add a translation without touching code.

Launch ships **20** languages. Missing keys fall back to English.

| Code | Language |
| --- | --- |
| `en` | English |
| `ja` | Japanese |
| `zh` | Chinese |
| `es` | Spanish |
| `fr` | French |
| `de` | German |
| `pt` | Portuguese |
| `ko` | Korean |
| `it` | Italian |
| `ru` | Russian |
| `nl` | Dutch |
| `pl` | Polish |
| `tr` | Turkish |
| `vi` | Vietnamese |
| `th` | Thai |
| `ar` | Arabic (RTL) |
| `hi` | Hindi |
| `id` | Indonesian |
| `fil` | Filipino |
| `et` | Estonian |

## Add a language

1. Copy [`en.json`](en.json) to a new file named after the language code (`es.json`, `pt.json`, …).
2. Change `meta`:

```json
{
  "meta": {
    "code": "es",
    "name": "Spanish",
    "nativeName": "Español"
  }
}
```

`code` must match the file name (without `.json`).

3. Translate the **values** only. Leave keys like `"help.shortcut.space"` as they are.
4. Keep placeholders such as `{bpm}`, `{name}`, `{count}`, `{tag}`, and `{esc}` — the app fills those in. `{esc}` becomes an Esc keycap in help.
5. You do **not** have to finish every string. Missing keys fall back to English, so you can start with `intro` and `help` and fill in buttons later.
6. Open a pull request with the new file. After it is merged, the language appears in the in-app **Language** picker (intro, help, and toolbar).

## Tips

- Keyboard keycaps (`Space`, `Tab`, `Esc`) stay in English.
- Growtopia item names under `sheet.names` can stay English if that matches the game in your language.
- `npm run dev` then pick your language in **?** help to preview.

English (`en.json`) is the source of truth. If a key is added there, translate it in other files when you can.
