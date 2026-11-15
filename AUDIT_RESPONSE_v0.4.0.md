# Response to the v0.4.0 audit (GPT, 14 November 2026)

Release: v0.4.1. The rival tie-break passed, and is kept unchanged. These are the fixes:

| Finding | Fix | Test |
| --- | --- | --- |
| **F1** A v0.3.6 save restarts at an unlisted difficulty | When a paper save is first loaded, its level **name** is recorded (`paper.level`) from the original version's pawn scale (v0.3.6: −1..+2; v0.3.7–v0.3.9: 0..+3) before the version is replaced. Labels use the name. "Start a new game" maps the name to the current scale. If a save was already re-saved by v0.4.0 and the scales overlap (0..+2), the name can't be recovered: the level shows as unknown and you must pick one. The setup can only start with a listed level. | `rules.test.cjs` "F1: older paper saves keep their level name…". `source/browser_restart_test.py` runs your steps (import, Start a new game, Start without touching the controls): v0.3.6 Easy → Easy with 5 pawns per rival; v0.3.6 Standard → Standard; v0.3.9 Standard (+1) → Standard (0); v0.3.9 Expert (+3) → Expert (+2); an ambiguous v0.4.0 re-save asks for a level. Against the v0.4.0 HTML it fails exactly as reported (no level checked, 4 pawns per rival). |
| **F2** The tuner uses the old level names | The player-bot agent's corrected tuner was merged from its branch (`tune.cjs` from 49e2d85 onward, with the user's OK): levels Easy −1, Standard 0, Hard +1, Expert +2, and +3 shown as "Beyond Expert"; each row carries `extraPawns`. Existing cells keep their seeds. | Your command `--evaluate --modes=-1 --per-cell 1 --policies dominance` now returns four Easy rows with `extraPawns: -1`; `--selftest` passes. |
| **Q1** Setup cones | New setup step 3: before the first Planning, place cones with the paper matching and the rival tie-break; only a present animal with at least one match can be dominant; update cones whenever the result changes. | Rulebook p. 2 |
| **Balance claim** | The strategy note names the checkpoint (v3, re-tuned against these rules) and gives both samples. At Hard v3 is 30 and 35 points ahead of the card-chaser (player-bot run and your audit), against 25–28 against the app's rivals. At Standard it's 39–44. The note advises Hard or Expert for that style of play, and reports your "Initiative-first" result (about +5 at Standard). `PAPER_RIVALS.md` lists both samples. | Rulebook Testing section |
| Optional: mode wording | "App rivals · strongest" is now "App rivals"; level names convey difficulty. | — |
| Optional: in-app help | The help explains the pawn levels and the rival tie-break. | — |
| Optional: printed line wrap | Print CSS keeps list items and paragraphs together; the Fallback line no longer splits across pages. | Rulebook PDF |

The benchmark example in `PAPER_RIVALS.md` now uses the v0.4.0 mapping, as you asked.

Still open: physical play, the d8 variant and the two-human variant.
