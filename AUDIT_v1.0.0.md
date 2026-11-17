# v1.0.0 pre-release audit

16 November 2026. Claude's own audit of v0.5.7 (main ecde044, build 7cf16470…) before the v1.0.0 release, at the user's request. It found nothing that changes the rules or the difficulty. v1.0.0 therefore changes names and wording only (see [CHANGELOG.md](CHANGELOG.md)).

## What was checked

| Area | How | Result |
| --- | --- | --- |
| v0.5.7 artifacts | Rebuilt the app from source; ran every test | Same SHA-256 as HANDOFF.md; 58 rules tests, the smoke check, six browser tests and the print checks all pass |
| Base game | `data.js`, `engine.js`, `forms.js`, `bot.js` and all 26 cards in `effects.js` read against the published rules and card clarifications (setup counts by player count, tile scoring, bonus points, the 12 actions and their order, Regression and Wasteland timing, Glaciation queue, Extinction, Survival, final scoring) | No rule defects |
| The Red Queen, four ways | The live branches of `source/paper/paper.js` (switches `flatMatch`, `cardList`, `faceNo`, `simpleAdapt`, `simpleSpec`, `simpleMig`, `simpleGlac`, `domBlock`) against the generated rulebook, the ten player aids and the 48 cards, row by row: six Planning steps, twelve target rows, twelve Execution rows, Migration, the Competition score, the card list and its skips, fourteen card choices, seven other decisions, terms and tie orders | Code and print agree. Two rows were ambiguous in print (below) |
| Tie orders | Tile ids (A1–G7) sort as board order; corners compare by number; Regression losses arrive in box order and Disease losses in the order added; removal takes the leftmost copy, Metamorphosis and Adaptation add at the right end | As printed |
| Instinct and Initiative | The engine advances its cursor before a card effect resolves, so Instinct's "not yet resolved" spaces are the later Domination spaces; Initiative excludes its own space | As printed |
| Stress test | `source/redqueen_fuzz.cjs` (new): complete guided games, 2–5 rivals × four levels, through the app's own start path, against a player who places at random, forfeits often and mixes both choosers. Default run 48 games (15,633 steps); audit run 640 more on seed block 500000 (218,431 steps) | 0 errors; `validateState` plus element, cube and pawn counts every step; every copy taken as a save would hold it equals the live state (314 and 4,336 copies); every game replayed from its seed without those reloads ends identically; no decision fell outside the printed rules; every placement named one of the six printed steps; every game ended with Ice Age, none stalled |
| Saves | Deck-only and full-game saves, local restore, export and import, cross-mode import, a malformed file | Pass; v0.5.7 saves open in v1.0.0 |
| How to play for older saves | Help text for saves from v0.3.6, v0.4.1, v0.5.2 (five-rival Easy) and v0.5.3 | Finding 8 |

## Findings

All are wording. None changes what a rival does.

1. **Pre-release wording.** The app footer and HANDOFF.md still described the project as unfinished. The footer now reads "Unofficial solo companion"; HANDOFF.md describes the finished project.
2. **Stale page description.** It still said "Two card-driven rivals". Fixed (two to five).
3. **How to play carried version history** ("from v0.5.3…", "started in v0.5.0 or later…"). It now states the current rules; a save from an older version still gets its own notice.
4. **Leftover labels in guided games.** The drawn card was headed "Reverse face" and the button "Draw a bot card". Now "<Animal> · card N" and "Draw a rival card".
5. **Aquatic (print).** "The tile where they make it first" could be read to include a tile where the rival is already first. The code gives such a tile no credit, as Evolution's row already says. Rulebook and aid now say "move it into first place (a tile where it is already first does not count)".
6. **Instinct (print).** "If none is open, an open space that already resolved" left out Glaciation spaces 2–4, which the code allows (the pawn waits there). Rulebook and aid now say "any other open space, by the same steps".
7. **Mode names** (the user's request): "printed rivals" and "cards only" read too alike. Now **The Red Queen · guided** and **The Red Queen · deck only**.
8. **Notice for games saved by older versions.** With the version history gone from How to play, the notice must name every rule such a game keeps. It did not mention the food-chain-only rival tie of v0.4.0–v0.4.1 games, and nothing covered five-rival Easy games from v0.5.0–v0.5.2, which keep −2 pawns for each rival. One notice now lists each kept rule (level and Planning order, flat Easy, the tie rule), with tests for each kind of save. Display only; those games always played by their own rules.

## Observation, not changed

When a rival's Domination pawn resolves and the rival would earn VP on no unscored tile, the rule (and the code) still scores the highest-value occupied tile, which gives other animals VP and possibly a card. With the reference test player, 36 games a cell: 2 rivals Standard 17 of 925 rival Domination pawns, Hard 9 of 921; 4 rivals Standard 48 of 1,053, Hard 30 of 1,020. The player gains roughly 1–3 VP a game from it. Actions are never mandatory in the base game, so forfeiting would be legal, but it would be a rule change and would need a re-measure. It is part of the measured difficulty and is left as it is.

Also noted, low: the player's Initiative form does not offer the Initiative space itself for the relocated pawn. The published rules say "any vacant eyeball space" without addressing that case; the move would have no effect that turn.

## v1.0.0 is behaviour-neutral

- `paper.js`, `bot.js`, `effects.js`, `forms.js` and `decks.js` are byte-identical to v0.5.7; `engine.js` differs by one comment and `data.js` by the version string.
- 27 games played on both source trees with the same seeds and inputs (24 new games across both rival systems, 2–5 rivals and all levels, plus three saved v0.5.7 games played on to the end) end in identical states once the version field is set aside.
- The 60-game smoke check equals `BASELINE_RESULTS.json`, unchanged.
- The difficulty table, X35 and best against best therefore stand as measured for v0.5.4–v0.5.7. Nothing was re-measured on the PC.

## Not covered

- The Red Queen has still not been played at a real table.
- The GMT rulebook PDF itself could not be fetched from the audit environment; the base-game check used a published transcription of the rules and card clarifications.
- `source/paper/verify-printables.py` (GPT's verifier) needs PyMuPDF, which the audit environment lacks, so it was not run. `check_print_fit.py` (no clipped text; PDFs match the sources) was.
