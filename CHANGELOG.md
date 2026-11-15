# Release notes

## v0.4.0 · November 14, 2026 · rival tie-break and new levels

- **Rival tie-break (paper rules):** when only rivals tie for the most matches on a tile, the rival higher in the food chain is dominant. If you tie with them, no one is dominant, as in the normal rules.
  - Why: flat matching made rivals tie constantly, leaving tiles undominated, and that handed the player cards, Ice Age points and board control.
  - It cuts the edge of the strongest player we could build (a self-tuned test player, re-tuned against the new rule) at Hard from about +51 points over the best simple strategy to +30, the same margin it gets against the app's rivals (+28). At Standard the margin is larger (+39), so strong players should choose Hard or Expert.
- **Difficulty levels move down one pawn**, because the rivals are now about one pawn stronger: Easy −1, Standard +0, Hard +1, Expert +2. Standard is about an even game with 2–4 rivals, Hard matches the app's rivals and Expert is tougher. New table in the rulebook and `PAPER_RIVALS.md`.
- **Saved games** started before v0.4.0 keep their rules and pawn counts, and show their original level name.
- **Testing:** the self-tuned test player is in `source/benchmark/tune.cjs` (opt-in; `--tune`, `--evaluate`, `--selftest`). Five more rules tests (35 in total).

## v0.3.9 · November 14, 2026 · fixes for the GPT v0.3.8 re-audit

- **Initiative, player form:** while a space is open you must choose where the pawn goes, as printed. Forfeiting the whole action is a separate button. On a full display you still move up and the pawn returns to you.
- **Printed rules now match the app**, which is what the difficulty table measured:
  - Migration: each tile either sends or receives during one action.
  - Evolution: the scoring formula is printed.
  - Immigrants: an unplaced pawn first, otherwise the last pawn on the action display.
- **Tests:** four new rules tests (30 in total), including both Initiative cases (an open space and the full 41-space display). The rivals' code is unchanged, so the v0.3.8 difficulty table still applies. See [AUDIT_RESPONSE_v0.3.8.md](AUDIT_RESPONSE_v0.3.8.md).

## v0.3.8 · November 14, 2026 · fixes for the GPT v0.3.7 re-audit

- **Initiative on a full action display:** the marker still advances and the pawn returns to its owner (it was forfeited). This applies to paper rivals, app rivals and the player form. While a space is open, the pawn must still move there, as printed.
- **Evolution:** the shared resolution rejects more than two opponents, a repeated opponent, or more replacements than the gene pool, whoever chooses. The benchmark's frozen player is capped the same way, so it no longer converts up to five opponents.
- **Paper rules now match the printed procedures:**
  - Rank counts every animal on a tile, even below the places that score, so Migration and arrivals no longer skip zero-VP tiles.
  - Competition picks the space with the most shared tiles, and its rank bonus follows the food chain.
  - Evolution only replaces species on tiles the rival matches, trying the next opponent if needed.
  - Depletion only plans a removal it can carry out.
  - Fertile names the whole award.
- **Printables:**
  - Clarified the Initiative, Evolution, Fertile, Depletion, Competition, Habitat, Birds' Migration and d8 wording.
  - Corrected the benchmark example and the Easy description.
  - Headings stay with their tables, and the card PDF is now 6 pages.
- **Tests:** eight new rules tests (each fails on v0.3.7). The full-display test now requires a full display with pawns left over, and the browser game test can play the 26-card deck. See [AUDIT_RESPONSE_v0.3.7.md](AUDIT_RESPONSE_v0.3.7.md).
- **Difficulty:** re-measured with these fixes. The paper rivals got stronger. The pawn counts stay the same, and the level descriptions changed: Easy is a little easier than an even game, Standard a little tougher (25/17/15/11% against an even 33/25/20/17%), Hard matches the app's rivals and Expert is tougher.

## v0.3.7 · November 14, 2026 · fixes for the GPT v0.3.6 audit

- **Migration:** a partial Migration (fewer moves than the allowance) can now be confirmed. In v0.3.6 the empty From picker blocked submission.
- **Evolution:** at most two opposing animals, one cube each, in the player form and for the app's rivals. Only 4–6 animal games were affected.
- **Glaciation and Ice Sheet:** remove every element surrounded by three tundra tiles anywhere on Earth, not only around the covered tile.
- **Player forms:** Aquatic requires its element and corner when one can be placed; on the final turn, Instinct offers only spaces that still run.
- **Paper rules:**
  - Every instruction names the positions, elements, corners, stacks, VP, moves, victims and pawn spaces involved.
  - Instinct can reserve a space for next turn.
  - Aquatic places its element whenever a sea or wetland corner is free.
  - Wasteland Planning and Execution agree: the rival protects an element it uses.
- **Printable rules in the repository:** `paper/Paper_Rivals_Rulebook.{md,html,pdf}` and `paper/Paper_Rivals_Cards.{html,pdf}`, generated by `source/paper/printables.py` from `source/paper/RULES.md` and the app's decks.
- **Paper levels shifted by one pawn:** Easy +0, Standard +1, Hard +2, Expert +3 (v0.3.6 was −1 to +2). The old table overstated the rivals because the benchmark player misread flat matching. Saved v0.3.6 paper games keep their pawn count.
- **Full action display:** if every action space is taken, Planning ends even when players still have pawns (reachable with extra pawns at 4–5 rivals). It used to crash the app rivals and the paper rivals.
- **Benchmark:** a rules adapter lets the pinned player read paper rivals with flat matching. The difficulty table was re-measured on fresh seeds (block 200000).
- **Tests:** four new rules tests, `source/browser_migration_test.py`, and `source/browser_game_test.py` (full games with 2–5 rivals, app or paper rules, through the controls). See [AUDIT_RESPONSE_v0.3.6.md](AUDIT_RESPONSE_v0.3.6.md).

## v0.3.6 · November 14, 2026

- **Paper rules in the app.** The setup screen has a Rival rules choice: App rivals (strongest) or Paper rules (as printed), with Easy, Standard, Hard and Expert (−1 to +2 pawns per rival). Paper games show which Planning step chose each space. App-rival games are unchanged: a 2-rival benchmark is game-for-game identical to v0.3.5. Imports preserve v0.3.5 saves.
- **One paper version.** The detailed paper rules were retired. The paper rules are now the former quick mode plus **Block the leader** (deny the leader's Domination), which curbs the card-chasing strategy. Card list skips pawn cards at 10 pawns. The rivals draw a card at every placement, as the app always did.
- **Difficulty** (seed block 190000): Standard is about an even game at every table size; Hard is close to the app's rivals; Expert is tougher. See [PAPER_RIVALS.md](PAPER_RIVALS.md).
- **Rulebook:** rewritten for the single version, with the audit's wording fixes (opponents in VP order, Evolution's two opponents, Barren Earth) and a printable card appendix.
- The test loader and benchmark load the paper rules the way the build ships them.

## v0.3.5 · November 14, 2026

- The app takes two to five rivals. Setup uses the base game's pawns and cubes for the player count (6/50, 5/45, 4/40, 3/35). With two rivals nothing changes: a 2-rival benchmark run is game-for-game identical to v0.3.4. Imports preserve v0.3.4 saves.
- With more opponents, the rivals' denial weight is shared: the leader keeps its weight and the others split the second weight.
- Benchmark: `--bots 2..5`; stalled games (turn 30+) are scored as they stand and counted as `stalledGames` instead of aborting the run. Tests on 3–5 bots (360 games per cell, seed 160000), scripted-player win rate (an even game is 25/20/17%): the app's rivals 12/9/9%; full paper at +0, +1, +2 pawns 47/41/39%, 28/29/19% and –/18/13%; quick paper at +0 and +1 30/27/25% and 19/21/16%.
- Paper quick mode gains five tested cuts: always the "no" face, simple Adaptation, full Speciation, Migration without rank checks, Glaciation without the tundra bonus (`--paper-options quick`). Across 3,240 games they made the rivals no weaker. Every cut weakened the full rules, so those are unchanged.
- Paper rivals gain a barren-Earth rule: when no animal dominates any tile (after turn 1), a rival places on Abundance first and may take any element. It prevents a rare six-animal stall where no one could take a card.

## Paper rivals · quick mode · November 14, 2026

- Added an optional quick mode for the paper rivals: flat element matching and a fixed card list. It plays about as tough as Expert at the normal 6 pawns (30% scripted-player wins on seed 150000, against 19% for the app's rivals).
- Quick-mode difficulty: 5 pawns easier (48%), 6 normal (30%), 7 hard (25%, close to the app's 19%).
- Added rules for two people plus one paper rival.
- `source/benchmark.cjs` takes `--paper-options`.

## Paper rivals · November 14, 2026

- Added table-playable rival rules for playing without the app: [Paper rivals](PAPER_RIVALS.md). Rules as code in `source/paper/paper.js`, deck tables from `source/paper/decktables.cjs`, and a `--paper N` option on `source/benchmark.cjs`.
- Difficulty is set with extra action pawns per rival: Standard 6, Hard 7, Expert 8. Against a fixed scripted player, Expert comes close to the app's rivals (24–30% player wins, against 22–23%).
- The app itself is unchanged.

## v0.3.4 · November 14, 2026 · merged by owner decision despite a narrowly failed guard

- Rivals now block. Every open space in Planning gets a small bonus for how much it would cost the leading opponent to lose it, counted only when that opponent has no equally good space left in the same row. Blocks went from almost none to about 3.2 per rival per game; each block is also a space the blocker can use, and 40% of them target the player.
- Guard (seed 110000, 540 games): scripted player wins 115 → 134 (+3.5 points, interval −0.9 to +7.9), just over the 3-point limit. The player's mean margin eased from −43.4 to −36.6 VP. No animal lost more than 6 of 180 rival wins. See [benchmark results](BENCHMARK_RESULTS.md).
- Imports preserve v0.3.3 saves.

## v0.3.3 · November 13, 2026 · merged by owner decision despite a failed guard

- Rival Planning now values Wanderlust with the same evaluator used to place the tile, instead of a flat 2.5 whenever a tile was on offer. Rivals play Wanderlust about 3–5 more times per game.
- Guard (seed 90000, 540 games): scripted player wins 131 → 113 (−3.3 points, interval −8.3 to +1.6), but the player's mean margin went from −27.9 to −42.3 VP. Birds rival wins fell 65 → 50 of 180, over the 13-win limit, so the change failed its guard. Mammals gained 18 wins and Reptiles 7. See [benchmark results](BENCHMARK_RESULTS.md).
- Imports preserve v0.3.2 saves.

## v0.3.2 · November 13, 2026

- Recalibrated five rival deck checks that were almost always true or almost always false, so both faces of those cards now get played. True rates (seed 6200): `ice` 99% → 38%, `contested` 98% → 66%, `cone` 96% → 64%, `front` 94% → 65%, `foothold` 5% → 31%. Updated the check descriptions shown on the Bot decks page.
- Card rows were not changed. Faces that were nearly dormant before are now played often, and their rows have not been tuned.
- Guard benchmark (seed 80000, 360 games): scripted player wins 90 → 79 (−3.1 points, interval −8.9 to +2.8). Birds rival wins fell 47 → 37 of 120, exactly at the acceptance limit. Larger Birds drops on two earlier blocks came from a first `foothold` definition that was discarded. See [benchmark results](BENCHMARK_RESULTS.md).
- Imports preserve v0.3.1 saves.

## v0.3.1 · November 13, 2026

- Rewrote the rows on several Insects and Amphibians rival card faces. Insects no longer lead with Glaciation or Wanderlust on their most-drawn faces and favor Domination, Migration and Adaptation; Amphibians lean less on Abundance and Glaciation. Card titles, checks and focuses are unchanged.
- Effect is small and uncertain. On the untouched confirmation block (seed 50000, 360 games) Insect rival wins went 35 → 36 of 120 and Amphibian 38 → 41; the scripted player's win rate changed by −0.8 points (95% interval −5.6 to +3.9). An earlier fresh block (seed 40000) showed about +8 points for each animal. See [benchmark results](BENCHMARK_RESULTS.md).
- Imports preserve v0.3.0 saves.

## v0.3.0 · November 13, 2026

- Added a repeatable benchmark with fixed player strategies, paired supplies, per-animal results, score margins, and forfeit causes.
- Rival planning now accounts for the same animal’s earlier Speciation placements and remaining display room for Adaptation. It can use a weak fallback placement to deny a useful action space to the leading rival.
- Wasteland forecasts now account for the one disk that can be removed. Duplicate disks of the same type still threaten matching tundra corners.
- Setup shows where all 50 cubes go. The six pawns and 45 starting gene-pool cubes were already correct under GMT's rules.
- Tap element colors to enter the physical draw. A correction preserves the other disks’ positions. Unfinished draw, tile and card entries survive reload and export/import.
- Imports preserve v0.1.0 and v0.2.0 game state, including unfinished engine steps.

Verification used Node.js 24 and offline Chromium with a 390 px touch viewport. The [benchmark results](BENCHMARK_RESULTS.md) distinguish rules checks, simulated results, and open physical playtesting.
