# Dominant Species — Solo Companion

An unofficial, offline solo companion for Chad Jensen's *Dominant Species* (GMT Games). One human plays an animal against two card-driven bot rivals; the physical box supplies the board, tiles, elements and Dominance Cards, and the app tells you exactly what the rivals do.

This is an independent fan project, not affiliated with or endorsed by GMT Games.

## Play

Open `Dominant_Species_Solo.html` in any modern browser (desktop or Android). It is fully self-contained and works offline.

## Build

The HTML is generated from `source/`:

```sh
python3 source/build.py                       # writes source/dist/Dominant_Species_Solo.html
python3 source/build.py --output Dominant_Species_Solo.html
```

Python standard library only.

## Smoke test

```sh
node source/smoke.cjs
```

Runs seeded games across all 60 matchups and prints the counts recorded in `BASELINE_RESULTS.json`.

## Layout

| Path | Purpose |
| --- | --- |
| `Dominant_Species_Solo.html` | Built, playable app |
| `source/src/` | App modules (`data`, `decks`, `engine`, `bot`, `effects`, `ui`, `forms`, `controls`), HTML template, CSS |
| `source/build.py` | Bundler that inlines CSS, JS, fonts and the hero image |
| `source/smoke.cjs` | Seeded engine smoke check |
| `BASELINE_RESULTS.json` | Smoke-test baseline for the current build |
| `HANDOFF.md` | Design requirements and handoff notes |

## History

- **v0.1.0** — first playable build (ChatGPT).
- **v0.2.0** — continued by Gemini.

## Licenses

Fonts: DM Sans and Instrument Serif, SIL Open Font License (`source/*-OFL.txt`).
