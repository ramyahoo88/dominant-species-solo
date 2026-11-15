# Dominant Species — Solo Companion

An unofficial, offline solo companion for Chad Jensen's *Dominant Species* (GMT Games). One human plays an animal against two to five card-driven bot rivals; the physical box supplies the board, tiles, elements and Dominance Cards, and the app tells you exactly what the rivals do.

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

Runs seeded games across all 60 matchups and prints the counts recorded in `BASELINE_RESULTS.json`. The timing field varies by machine.

For targeted rules checks and a fixed-player comparison, run the following commands.

```sh
node --test source/rules.test.cjs
node source/benchmark.cjs --base 3a7e6d0 --candidate worktree
```

See [benchmark instructions](source/benchmark/README.md) and [results](BENCHMARK_RESULTS.md).

## Layout

| Path | Purpose |
| --- | --- |
| `Dominant_Species_Solo.html` | Built, playable app |
| `source/src/` | App modules (`data`, `decks`, `engine`, `bot`, `effects`, `ui`, `forms`, `controls`), HTML template, CSS |
| `source/build.py` | Bundler that inlines CSS, JS, fonts and the hero image |
| `source/smoke.cjs` | Seeded engine smoke check |
| `source/rules.test.cjs` | Small-board rules checks, planning regressions and save migration |
| `source/benchmark.cjs` | Paired bot comparison with fixed scripted player policies |
| `source/browser_test.py` | Offline Chromium verification of supply entry and save flows |
| `BASELINE_RESULTS.json` | Smoke-test baseline for the current build |
| `HANDOFF.md` | Design requirements and handoff notes |

## History

- **v0.1.0** — first playable build (ChatGPT).
- **v0.2.0** — Gemini’s rival planning and resolution revisions.
- **v0.3.0** — benchmark and rules fixtures, better forecasts for scarce cubes and display capacity, fallback denial, and tap entry for physical disks. See [release notes](CHANGELOG.md).
- **v0.3.1** — Insects and Amphibians rival deck rows rewritten (small, uncertain gain). See [benchmark results](BENCHMARK_RESULTS.md).
- **v0.3.2** — five near-constant rival deck checks recalibrated so both card faces get played. See [benchmark results](BENCHMARK_RESULTS.md).
- **v0.3.3** — rival Planning values Wanderlust with its real evaluator.
- **v0.3.4** — rivals block spaces the leading opponent needs.
- **Paper rivals** — rules for running the rivals at the table without the app. See [PAPER_RIVALS.md](PAPER_RIVALS.md).
- **v0.3.5** — two to five rivals, with the base game's pawns and cubes for each player count; seven-change quick mode for paper rivals.
- **v0.3.6** — the app can run the printed Paper Rivals rules (four levels); one paper version with Block the leader.
- **v0.5.0** — paper rivals plan first (they place one pawn each before you), which removes the strongest strategy's extra edge; levels Easy −2 … Expert +1; fixes from GPT's v0.4.1 follow-up.
- **v0.4.1** — fixes from GPT's v0.4.0 audit: older saves keep their difficulty level; tuner level names; rulebook setup and balance wording.
- **v0.4.0** — rival tie-break for the paper rules (closes half of the strongest strategy's edge); every level one pawn lower.
- **v0.3.9** — fixes from GPT's v0.3.8 re-audit: the printed rules match the app (Migration, Evolution, Immigrants), and the player's Initiative form follows GMT's relocation rule.
- **v0.3.8** — fixes from GPT's v0.3.7 re-audit: paper rules match the printed procedures, Initiative on a full display, Evolution limits everywhere; difficulty re-measured.
- **v0.3.7** — fixes from GPT's v0.3.6 audit; printable rulebook and cards in [`paper/`](paper/).

## Licenses

Fonts: DM Sans and Instrument Serif, SIL Open Font License (`source/*-OFL.txt`).
