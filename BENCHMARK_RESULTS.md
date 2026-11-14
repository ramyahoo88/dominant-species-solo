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

## v0.3.2 · check recalibration (Claude, November 13, 2026)

Five checks were nearly constant, mostly because of the starting layout: every starting tile borders the central tundra (`ice`), the starting placements overlap (`contested`), each animal starts dominating its home tile (`cone`), most large terrains clear 5 first-place VP (`front`), and zero matches is rare (`foothold`). Each was redefined to keep its card's meaning and land at roughly 25–75% true. Candidates were judged on true rate only; card rows were left unchanged.

| Check | Old definition | Old rate | New definition | New rate |
|---|---|---:|---|---:|
| `ice` | Cubes in or next to tundra | 99% | Species on tundra and leads or ties the tundra count | 38% |
| `contested` | Shares a tile with a rival | 98% | A rival outranks it on a shared tile worth 6+ VP | 66% |
| `cone` | Dominates an unscored tile, card available | 96% | Dominates 3+ unscored tiles, card available | 64% |
| `front` | Reachable face-up tile worth 5+ VP | 94% | Reachable face-up Sea or Wetland | 65% |
| `foothold` | An occupied tile has no match | 5% | Two or more occupied tiles have at most one match | 31% |

Rates are from seed 6200 (all six animals, 180 games).

**Guard 1 (seed 60000, `--repeats 2`).** Pre-set rule: the scripted player's win rate rises by no more than about 3 points, and no animal loses more than about 10 of 120 rival wins. The player rate passed (97 → 86 of 360, −3.1 points), but Birds failed (49 → 34 of 120, VP 178 → 167). A check on seed 70000 (Birds games, 180) showed 68 → 54, just under that block's pre-set "real" bar of 15, with Birds VP down again; treated as probably real. On seed 60000, restoring Birds' own checks one at a time recovered nothing. Restoring the old `foothold` for every animal recovered Birds to 40/120, so other animals' `foothold` faces caused the drop. The first new definition ("an occupied tile has at most one match", 52% true) was softened to the current one.

**Guard 2, confirmation (seed 80000, `--repeats 2`, `--base main`, i.e. v0.3.1).**

| Metric | v0.3.1 | v0.3.2 |
|---|---:|---:|
| Scripted player wins | 90/360 | 79/360 |
| Player mean VP margin | −30.3 | −34.3 |
| Rival pawns with no legal target per game | 0.80 | 0.66 |
| Mammals rival wins | 48 | 48 |
| Reptiles rival wins | 65 | 60 |
| Birds rival wins | 47 | 37 |
| Amphibians rival wins | 42 | 45 |
| Arachnids rival wins | 34 | 51 |
| Insects rival wins | 34 | 40 |

Paired change in player win rate: −3.1 points (approximate 95% interval −8.9 to +2.8). Passes the guard, with Birds exactly at the 10-win limit.

**Reading.** The rivals are slightly tougher, and roughly a third of each deck's faces that were dormant are now in play. With the shipped definitions, Birds dropped 47 → 37 on the confirmation block, exactly at the limit. The larger drops on seeds 60000 (49 → 34) and 70000 (68 → 54) were with the first, discarded `foothold` definition; on seed 60000 the shipped definition gave Birds 41/120 against 49 on `main`, but that block was used for development. Birds remain the likeliest weak rival. The spread between rivals narrowed on the confirmation block (strongest 65 → 60, weakest 34 → 37). The dormant faces were never tuned, so they are the first place to look.
