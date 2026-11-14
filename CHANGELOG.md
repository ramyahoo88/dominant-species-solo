# Release notes

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
