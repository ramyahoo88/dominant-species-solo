# Dominant Species — Solo Companion

An unofficial, offline solo companion for Chad Jensen's *Dominant Species* (GMT Games). One human plays an animal against two to five card-driven rivals; the physical box supplies the board, tiles, elements and Dominance Cards, and the app tells you exactly what the rivals do.

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
node source/smoke.cjs --check
```

Runs seeded games across all 60 matchups, prints the counts and checks them against `BASELINE_RESULTS.json` (the timing field `maxTime` varies by machine and is ignored). After a change that is meant to alter play, refresh the baseline with `node source/smoke.cjs --write`.

For targeted rules checks and a fixed-player comparison, run the following commands.

```sh
node --test source/rules.test.cjs
node source/redqueen_fuzz.cjs                  # 48 complete Red Queen games against an erratic player (about 10 seconds)
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
| `source/browser_draw_test.py` | Offline Chromium check of The Red Queen's deck-only mode |
| `source/redqueen_fuzz.cjs` | Stress test: complete Red Queen games against an erratic player, with state checks every step |
| `source/paper/check_print_fit.py` | Fails if any printed card or player-aid sheet would cut off text |
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
- **v1.0.0** — first full release. The two Red Queen choices are renamed **guided** (the app runs the rivals and tracks the board) and **deck only** (the app draws the cards; you run the rivals); playtest wording removed; two rulebook rows clarified. No change to play. See [the pre-release audit](AUDIT_v1.0.0.md).
- **v0.5.7** — fresh PDFs and a check that catches stale ones; in cards-only play, How to play and Rival decks follow the mode (GPT's v0.5.6 re-audit).
- **v0.5.6** — The Red Queen · cards only: the app draws each rival's cards and shows the rulebook and player aids, and you run the rivals yourself; Ice Age decision fixes and fuller card reminders for GPT's v0.5.5 re-audit; rulebook clarifications.
- **v0.5.5** — the app names its two rival systems: Tooth & Claw (the app's own) and The Red Queen (the printed rules); a correct Ice Age forecast; printed Catastrophe and Hibernation details; a professional rulebook with card fronts and species backs; fixes for GPT's v0.5.4 comprehensive audit.
- **Printables update** (no app change) — player aids (four reference sheets and one per rival), the rulebook in the aids' design with the cut-out cards in its appendix, and the Mass Exodus fallback from GPT's v0.5.4 re-audit.
- **v0.5.4** — paper rivals place on Migration only when they can move, break rival-only ties by most species, skip five cards that would do nothing, and reseed Earth when no rival species are left; fixes for GPT's v0.5.3 re-audit.
- **v0.5.3** — Mammals' Extinction save follows the printed tie order; every rulebook row prints its own tie priorities; scaled Easy with five rivals (−1 for each rival, +1 for you); fixes for GPT's v0.5.2 re-audit.
- **v0.5.2** — one board order (furthest left, then highest) for every paper-rival tie, so the app picks the same corner as the printed rules; fix for GPT's v0.5.1 re-audit.
- **v0.5.1** — Empty Earth rule for paper rivals (a rival's Abundance can reseed an Earth with no species, so the rare six-animal stall recovers); benchmark reporting fixes and balance wording from GPT's v0.5.0 audit.
- **v0.5.0** — paper rivals plan first (they place one pawn each before you), which removes the strongest strategy's extra edge; levels Easy −2 … Expert +1; fixes from GPT's v0.4.1 follow-up.
- **v0.4.1** — fixes from GPT's v0.4.0 audit: older saves keep their difficulty level; tuner level names; rulebook setup and balance wording.
- **v0.4.0** — rival tie-break for the paper rules (closes half of the strongest strategy's edge); every level one pawn lower.
- **v0.3.9** — fixes from GPT's v0.3.8 re-audit: the printed rules match the app (Migration, Evolution, Immigrants), and the player's Initiative form follows GMT's relocation rule.
- **v0.3.8** — fixes from GPT's v0.3.7 re-audit: paper rules match the printed procedures, Initiative on a full display, Evolution limits everywhere; difficulty re-measured.
- **v0.3.7** — fixes from GPT's v0.3.6 audit; printable rulebook and cards in [`paper/`](paper/).

## Licenses

Fonts: DM Sans and Instrument Serif, SIL Open Font License (`source/*-OFL.txt`).
