# Response to the v0.3.7 re-audit (GPT, 14 November 2026)

Release: v0.3.8. Every finding has a regression test in `source/rules.test.cjs`, and each new test was run against the v0.3.7 code first: all eight failed there and pass now. The only test that passes on both, the full-display one, is expected to: v0.3.7 already handled that case, and the test now proves the case is reached.

| Finding | Fix | Test |
| --- | --- | --- |
| **E1** Benchmark still breaks Evolution | `benchmark/load.cjs`: the frozen player keeps its ranking but is capped at two distinct opponents, one cube each, no more than its gene pool. `effects.js`: the shared Evolution resolution now rejects more than two opponents, a repeated opponent, the actor itself, a tile without that opponent, or more replacements than the gene pool. Every chooser goes through it. | "Re-audit E1: every Evolution chooser…" (three victims and a repeated victim are rejected); "Re-audit E1: the frozen benchmark player is capped…" (the uncapped frozen choice takes more than two; the capped one takes at most two distinct) |
| **E2** Rank disappears below the VP cutoff | `paper.js` `pRank` ranks every animal with a species on the tile (count, then food chain); VP stays in `tileScores`. The printed definition says so explicitly. | D3 Tundra, Mammals 3, Birds 2: Birds rank second, keep that rank after moving one and move D3→D2. Control: Birds 2, Mammals 1: moving one loses first place, so there is no move |
| **E3** Competition counts opponents, not tiles | The space choice counts unique shared tiles. The rank bonus applies only if the opponent ranked above the rival and no longer does after the hit, using the full order with food-chain ties. | Slot score equals unique tiles for every space; Mammals 3 vs Birds 2 scores the first-place value only (2–2, Mammals keep first); Insects 3 vs Birds 2 scores double |
| **E4** Paper Evolution on unmatched tiles | Only tiles the rival matches. An opponent with none is skipped and the next in VP order is tried (printed). | Mammals on E4 (no disks) are skipped and only the Insect on E3 is replaced. Control: with a disk on E4 both are replaced |
| **E5** Fertile preview omits the award | The instruction names the total: "Birds gain 7 VP for all 7 species (every animal) at D2 Wetland." The rulebook says it counts every animal's species. | Label matches; the engine award is 7 |
| **E6** Depletion can plan a move it cannot execute | One predicate (`pDepletionCorners`) for Planning and Execution: a disk on Earth of a box element the rival does not use. Printed row reworded to match. | Sun and Seed in the box, Birds use Seed, no Sun on Earth: not legal, and Execution passes. Control: a Sun disk is legal and gets removed |
| **E7** Initiative on a full display | **Ruling, following the GMT Initiative action: the marker always advances, and moving the pawn is optional.** With no open space the marker still advances and the pawn returns to its owner. Applied to paper rivals, app rivals and the player form (which now also lets you advance without moving the pawn). The benchmark player already advanced. Printed in the Initiative row. | Paper and app rivals on a full display advance from second to first, return the pawn, and do not forfeit |
| Full-display test too weak | The unit test uses a full deck, five rivals and more pawns than the 41 spaces, and asserts that the display is full **and** pawns remain. `browser_game_test.py` takes `full` for 26-card games. | Full-deck Expert browser games at 4 and 5 rivals finish |

## Printables

- **Benchmark example (p. 9):** now `--paper 2 --bots 3 --seed 200000 --repeats 2` with both sides pinned to the release commit (360 games).
- **Easy:** "The best starting level for learning; you win more often than in an even game."
- **Layout:** headings stay with their tables; the card PDF is 6 pages, with the generator note on the last sheet.
- **Clarified:**
  - Birds migrate up to two tiles through existing terrain.
  - Habitat's element fallback and corner tie-breaks.
  - The d8 option repeats numbers and was not part of the difficulty tests.

## Difficulty

E1 and the paper fixes both change play, so the ladder was re-measured on seed block 200000 (360 games per cell) with v0.3.8. The fixes made paper rivals stronger. The pawn counts are unchanged, and the descriptions now match the measurements:

| Rivals (even) | Easy +0 | Standard +1 | Hard +2 | Expert +3 | App |
|---|---|---|---|---|---|
| 2 (33%) | 46% | 25% | 19% | 17% | 20% |
| 3 (25%) | 33% | 17% | 9% | 10% | 15% |
| 4 (20%) | 26% | 15% | 11% | 7% | 9% |
| 5 (17%) | 26% | 11% | 8% | 4% | 8% |

There were no stalls. The app column barely moved (only 4–5 animal games could hit the Evolution cap). See `source/paper/ladder.json` and `PAPER_RIVALS.md`.

## Still open

- Physical tabletop play.
- Real Android and iOS save handling.
- The two-person paper mode.
- Exhaustive interactions between scarce components.
