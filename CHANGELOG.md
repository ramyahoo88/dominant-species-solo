# Release notes

## v0.3.0 · November 13, 2026

- Added a repeatable benchmark with fixed player strategies, paired supplies, per-animal results, score margins, and forfeit causes.
- Rival planning now accounts for the same animal’s earlier Speciation placements and remaining display room for Adaptation. It can use a weak fallback placement to deny a useful action space to the leading rival.
- Wasteland forecasts now account for the one disk that can be removed. Duplicate disks of the same type still threaten matching tundra corners.
- Setup shows where all 50 cubes go. The six pawns and 45 starting gene-pool cubes were already correct under GMT's rules.
- Tap element colors to enter the physical draw. A correction preserves the other disks’ positions. Unfinished draw, tile and card entries survive reload and export/import.
- Imports preserve v0.1.0 and v0.2.0 game state, including unfinished engine steps.

Verification used Node.js 24 and offline Chromium with a 390 px touch viewport. The [benchmark results](BENCHMARK_RESULTS.md) distinguish rules checks, simulated results, and open physical playtesting.
