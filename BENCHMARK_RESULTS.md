# Rival benchmark and rules follow-up

Run November 13, 2026. All trials used the standard three-player setup with one animal per seat. Each block used 60 different physical setups and three scripted player policies per setup. Half used the 22-card deck and half the 26-card deck. Rules references use GMT’s third-printing PDF, which GMT still links as its current rules.

| Comparison | Seeds | Player wins before | Player wins after | Player mean VP margin | Rival pawns with no legal target per game |
|---|---|---:|---:|---:|---:|
| Original comparison | 6200–6259 | 97/180 | 65/180 | +9.0 → -15.6 | 2.79 → 2.03 |
| Development block | 6200–6259 | 65/180 | 45/180 | -15.6 → -30.8 | 2.03 → 0.48 |
| Independent seed block | 12000–12059 | 58/180 | 48/180 | -18.2 → -26.0 | 1.94 → 0.66 |

The first row compares v0.1.0 with v0.2.0. The last two compare v0.2.0 with v0.3.0. The player margin is the player’s VP minus the stronger rival’s VP. A lower player win rate or margin indicates a tougher opponent under these policies. The paired change for v0.1 to v0.2 was −17.8 percentage points (approximate 95% interval −27.5 to −8.0). For v0.2 to v0.3 the development change was −11.1 points (−20.1 to −2.1). The independent block was −5.6 points (−14.8 to +3.7). The no-target reduction repeated in both blocks. The win-rate improvement on fresh seeds remains uncertain.

Across the two v0.3 comparison blocks, rival Speciation pawns with no legal target fell from **461 to 110**. Adaptation fell from **130 to 1**. The bots made 14 explicitly marked denial placements across 360 games. Declines with a legal option changed from 1.71 to 1.72 per game. These results apply to the bundled planning changes. They cannot establish the separate effect of denial.

## Animal results

Wins are counted by role in the 360 matched trials for each version. Each animal appeared 60 times as the player and 120 times as a rival. Food-chain tiebreaks count as wins. An equal win rate per animal is not a rule or a balance target.

| Animal | v0.2 fixed player | v0.2 rival | v0.3 fixed player | v0.3 rival |
|---|---:|---:|---:|---:|
| Mammals | 21/60 | 41/120 | 14/60 | 49/120 |
| Reptiles | 22/60 | 57/120 | 23/60 | 62/120 |
| Birds | 17/60 | 47/120 | 10/60 | 48/120 |
| Amphibians | 19/60 | 28/120 | 17/60 | 38/120 |
| Arachnids | 24/60 | 33/120 | 15/60 | 41/120 |
| Insects | 20/60 | 31/120 | 14/60 | 29/120 |

Reptiles remained the strongest rival in aggregate. Amphibian rival wins rose from 28/120 to 38/120, and Insect rival wins fell slightly from 31/120 to 29/120. The benchmark does not isolate a cause. Animal-specific weights remain an open experiment.

## Rules and verification

- GMT p. 4 allocates six pawns and 50 cubes per seat. One cube marks VP and four go to Earth. This leaves 45 in the pool, which agrees with both earlier builds. The setup text now explains the accounting. [GMT rulebook](https://www.gmtgames.com/living_rules/DS3_Rulebook-web_FINAL.pdf)
- GMT p. 12 permits one disk removed from the Wasteland box before weather removes the remaining matching types. The v0.2 forecast could protect every singleton type. The new test uses two singleton types and a duplicate. [GMT rulebook](https://www.gmtgames.com/living_rules/DS3_Rulebook-web_FINAL.pdf)
- The fixed-position tests cover setup, save migration, Regression, Wasteland, Glaciation, Speciation, scoring versus card ownership, the Planning forecasts, and finite physical supplies.
- The smoke harness completed all 60 matchups. It still uses rival logic for the player seat and draws simulated terrains with replacement. Use it for reachability and state validation.
- The 390 px Chromium run used the offline HTML and actual controls. It verified tap entry, replacing a disk in the middle of the row, reload, export/import, deterministic bot reveal, undo, and importing a v0.2 save.
- Physical play and Android hardware were unavailable. A full card-by-card rules audit is outside this comparison.

## Reproduction

```sh
node source/benchmark.cjs --seed 6200
node source/benchmark.cjs --base 3a7e6d0 --candidate worktree --seed 6200
node source/benchmark.cjs --base 3a7e6d0 --candidate worktree --seed 12000
node --test source/rules.test.cjs
node source/smoke.cjs
python3 source/browser_test.py
```

The raw report is available by redirecting the benchmark's JSON to a file. `--detail` adds game-level outcomes, and `--trace` adds choices for reproduction. See the [benchmark notes](source/benchmark/README.md) for the fixed policy, seed behavior, and classification.

## v0.3.1 · weak-animal deck rewrite (Claude, November 13, 2026)

**Diagnosis (seed 6200, development).** Swapping in the Reptiles' row lists lifted Insects and Amphibians as rivals by 12–20 points, while swapping only focuses or checks did little, so the rows were the lever. Card-face usage showed why some faces matter so much: several checks are nearly constant across all six decks, so each deck effectively plays about five of its sixteen faces.

| Check | True rate |
|---|---:|
| ice | 99% |
| contested | 98% |
| cone | 96% |
| front | 94% |
| elements | 82% |
| breadth | 79% |
| supply | 70% |
| close | 64% |
| invasion | 35% |
| removal | 27% |
| late | 18% |
| regression | 15% |
| foothold | 5% |

Each deck's `ice` card therefore always plays its Glaciation-leaning face. For Insects that face led with Wasteland → Glaciation about six times a game, and *First Colonist* led with Wanderlust about 5.6 times a game.

**Selection (seed 40000, 240 games per variant, rule fixed in advance: adopt only with a gain of about 8 points or more).** These runs used a harness filtered to games where the target animal is a rival.

| Insects rival win rate | |
|---|---:|
| v0.3.0 deck | 20% |
| Rewrite C (kept, theme-preserving) | 28% |
| Full Reptiles rows (rejected, only +4 over C) | 32% |

| Amphibians rival win rate | |
|---|---:|
| v0.3.0 deck | 31% |
| Rewrite D (kept) | 39% |

Both rewrites were chosen on this same block, so these gains are biased upward; the seed 50000 block below is the unbiased estimate.

**Confirmation (seed 50000, `--repeats 2`, `node source/benchmark.cjs --base feaaac0 --candidate worktree --seed 50000 --repeats 2`).**

| Metric | v0.3.0 | v0.3.1 |
|---|---:|---:|
| Scripted player wins | 100/360 | 97/360 |
| Player mean VP margin | −26.3 | −27.3 |
| Insects rival wins | 35/120 | 36/120 |
| Amphibians rival wins | 38/120 | 41/120 |
| Reptiles rival wins | 63/120 | 61/120 |
| Rival pawns with no legal target per game | 0.59 | 0.71 |

Paired change in player win rate: −0.8 points (approximate 95% interval −5.6 to +3.9).

**Reading.** Gains of 10–20 points on the development seeds shrank to roughly 0–8 points on fresh ones, and the full Reptiles rows fell from 41% to 32%. Best estimate: a few points for each animal, uncertain. Rewriting rows is a weaker lever than the development runs suggested, and win-rate differences measured on about 60 setups are unreliable below roughly ±8 points. Reptiles remain clearly the strongest rival.

**Next lever.** Recalibrate the nearly constant checks (`ice`, `contested`, `cone`, `front`, `foothold`) so both faces of each card actually get played. This affects all six decks.
