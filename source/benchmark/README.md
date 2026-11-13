# Paired rival benchmark

Run from the repository root with Node.js 22 or newer and Git. It needs no packages and makes no network requests once the historical commits are available locally.

```sh
node source/benchmark.cjs
node source/benchmark.cjs --base 3a7e6d0 --candidate worktree --seed 12000
node source/benchmark.cjs --base 3a7e6d0 --candidate worktree --seed 12000 \
  --human insects --rivals reptiles,birds --policy expansion --trace
node --test source/rules.test.cjs
```

The default compares v0.1.0 with v0.2.0 across 60 animal assignments and three fixed player policies. Both rivals use the version under test. A pinned v0.2.0 runtime handles the more complex simulated player execution choices, with separate Planning and Domination heuristics. The player code only receives the visible board. It has no access to upcoming physical draws or hidden rival card queues. For full details and results, see [BENCHMARK_RESULTS.md](../../BENCHMARK_RESULTS.md).

Specify `--length short` or `--length full` for one deck size. The default splits the 60 setups equally between them. Use `--repeats N` to add independent seeds for each matchup, `--detail` for every final score and row count, and `--trace` for each pawn placement and resolution. Use `--workers 1` on a single-core machine. Worker count does not affect outcomes or output order.

Each setup pre-shuffles the physical Dominance deck and three eight-tile terrain stacks. The initial sea is under the tundra. The remaining tile mix is six sea tiles and three of each other large terrain type. Each turn draws from its actual remaining element inventory using a turn-specific random stream. Versions share opening supplies and seeds. Later draws may differ because the games use different numbers or colors of tiles, cards and disks. Short and full decks follow the setup in the [GMT rulebook, pp. 4 and 19](https://www.gmtgames.com/living_rules/DS3_Rulebook-web_FINAL.pdf). The [Western University copy inventory](https://archive.fims.uwo.ca/specialcollections/items/show/130) lists the terrain counts.

A pawn is counted once at execution. A declined action had a legal way to proceed at that point, even if the move would have been harmful or scored nothing. An action with no target could not proceed at that point, for example when the gene pool was empty. Queued Glaciation pawns count if they reach Execution. A separate count records explicitly selected denial placements. VP ties follow the game’s food chain tiebreaker. The interval is a normal approximation from paired human-win differences, clustered by shared physical setup across the three policies.

The harness validates state every step, preserves a trace on request, and stops on an invalid or nonterminating game. It uses the app’s model and effect resolutions. The results compare versions against the stated scripts. Small-board assertions check selected rules separately, and physical play is still needed to assess human difficulty and balance.
