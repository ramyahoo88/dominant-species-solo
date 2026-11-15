# Self-tuning test player

The tuned player is the opponent used to look for strategies that beat the rivals. It is opt-in: plain
`node source/benchmark.cjs` runs never load it, so the published benchmark is unaffected.

- `tuned.js`: the fixed 'dominance' benchmark player with every hand-set constant turned into a weight.
- `tune.cjs`: the tuner, an evolution strategy with antithetic pairs on shared seeds. It validates on a
  separate seed block and keeps the best validated weights.
- `tuned_weights_v1.json`: the first tuned player (round 1).
- `tuned_weights_v2.json`: the round-2 player (see Results).

## Commands

    node source/benchmark.cjs --selftest
    node source/benchmark.cjs --tune --features all --weights source/benchmark/tuned_weights_v1.json \
         --generations 13 --pairs 12 --games 64 --lr .35 --validate-every 3 \
         --train-seed 310000 --validate-seed 320000 --out results/pb_a.ckpt.json
    node source/benchmark.cjs --tune --resume results/pb_a.ckpt.json --generations 13 ... --out results/pb_a.ckpt.json
    node source/benchmark.cjs --evaluate --weights results/pb_a.ckpt.json --compare v1=source/benchmark/tuned_weights_v1.json \
         --ablate phase,cards,cubes,elements,denial --seed 330000 --per-cell 90

- `--selftest`: with default weights the tuned player must play game-for-game like the fixed 'dominance' policy.
- `--features`: which weight groups the tuner moves: `base` (the v1 set, the default), `phase`, `cards`,
  `cubes`, `elements`, `denial`, or `all`. Groups it doesn't move keep the values from `--weights`.
- `--resume`: continues a checkpoint (its current weights, best, history and generation number), so a long
  run fits in jobs of about 20 minutes. Use the same seeds and settings as the first chunk.
- `--compare label=file`: adds other weight files as columns. `--ablate group`: adds the tuned weights with
  that group reset to its defaults (off). All columns play the same tables.
- The output still has `overall` and `table` as before. It now also has `pooled` (wins by level over all
  rival counts, with Wilson 95% intervals) and `vsTuned` (paired differences on identical tables).

## Round-2 features

Every new weight defaults to 0, which means off. The defaults still play like 'dominance', and a v1 weights
file plays game-for-game as before (checked on 40 mixed tables).

| Group | Weights | What it does |
|---|---|---|
| phase | `late[row]` (12) | Adds `phase x weight` to a row's Planning value. `phase` is the share of the Dominance deck revealed: 0 with the opening market, 1 once Ice Age is out. |
| cards | `card[name]` (26) | Adds a preference to the card's estimated value when the player picks a Dominance Card. The best preference on offer also adds to Domination targets the player would own. |
| cubes | `reserve` | Speciation Planning penalty as the gene pool would fall from 8 cubes to 0. |
| | `specCost` | Extra cost per cube placed by Speciation (a soft cap on cubes per action). |
| | `loneTundra` | Penalty for each of the player's lone cubes on tundra, in every board evaluation. |
| elements | `elemPen` | Adaptation Planning penalty per element already added. |
| denial | `denyDeplete` | Depletion: value per Dominance swing (an opponent loses a cone, or the player gains one), weighted by opponent threat. |
| | `denyComp` | Competition: the same, for a hit that removes an opponent's last cube on a tile. |
| | `denyGlac` | Glaciation: value per VP the glaciated tile would stop scoring for opponents. |

Where the features act:

- **Planning and Domination targets.** These are the player's own code in tuned.js.
- **Card choice.** Wrapped around the reference card value.
- **Depletion, Competition, Glaciation and Speciation targets.** While a feature's weight is non-zero,
  these use a copy of the frozen reference chooser (bot.js at the pinned commit) plus the feature's term.
- **`loneTundra`.** A term added to the reference board evaluation, only while the tuned player is deciding.

Round 1 tuned row weights for Initiative, Regression and Domination, but tuned.js never reads them; those
rows have their own weights. They are no longer in the tuning vector.

## Results (round 2, v0.3.9 rules)

**v2** (`tuned_weights_v2.json`) is a round-2 tune started from v1 with every feature group switched on. It ran
39 generations with 12 antithetic pairs on 64 tables each (train seeds 310001+, validation block 320000 with 400 tables),
and keeps the best validated generation, 39. Validation win rate went from 56.0% (v1) to 67.0% (v2). That figure is the
best of 15 validations, so it runs high.

**Held-out evaluation:** seed block 330000, never used in tuning: 90 tables per cell, 20 cells (2–5 rivals x App
and the four paper levels). All columns play the same tables. Win %, pooled over 2–5 rivals; n = 360 tables per
level per column, 1,800 overall. An even game is about 24% (33%, 25%, 20% and 17% for 2–5 rivals).

| Rivals | v2 | v1 | dominance | majority | expansion |
|---|---|---|---|---|---|
| App | 42.5 | 43.6 | 15.6 | 9.7 | 11.7 |
| Easy | 85.6 | 86.4 | 45.0 | 22.8 | 24.2 |
| Standard | 78.6 | 71.4 | 28.9 | 13.6 | 13.6 |
| Hard | 62.2 | 57.2 | 20.8 | 8.3 | 9.4 |
| Expert | 53.3 | 45.0 | 14.2 | 9.2 | 6.1 |
| All | **64.4** | 60.7 | 24.9 | 12.7 | 13.0 |

Paired v2 minus v1, in percentage points with 95% intervals:

| Overall | Standard | Expert | Hard | App | Easy |
|---|---|---|---|---|---|
| **+3.7** [+0.9, +6.6] | +7.2 [+1.2, +13.2] | +8.3 [+1.7, +15.0] | +5.0 [-2.0, +12.0] | -1.1 | -0.8 |

**Which features the tuner used.** Each ablation is v2 with one group reset to off, on the same tables. The
figures are the change in overall win %, in points.

| Group off | Change | Reading |
|---|---|---|
| cubes | **-3.9** [-6.6, -1.2]; Expert -10.3 [-16.5, -4.1] | Used. Lone tundra cube penalty 1.23 (the largest move among the new single weights), +0.13 per Speciation cube, reserve 0.97. |
| phase | **-2.8** [-5.2, -0.4] | Used. Late game it values Wanderlust (+1.2), Initiative (+0.8), Speciation (+0.7) and Domination (+0.5) more, and Wasteland (-1.4), Regression (-1.1), Abundance (-0.8) and Adaptation (-0.7) less. |
| cards | -1.4 [-3.6, +0.7] | Not significant. Avoids Ice Sheet (-3.9), Niche Biomes, Evolution and Aquatic; prefers Habitat, Intelligence and Symbiotic. |
| elements | +0.1 [-1.6, +1.7] | No effect (penalty 0.36 per element added). |
| denial | +0.7 [-0.9, +2.4] | No effect; the tuner left these near zero or slightly negative. |

Base weights that moved most from v1: Wasteland and Adaptation row weights up; Competition, Speciation and Migration
row weights down; rival points count again (rivalWeight 0 -> 0.30); a later Glaciation space is no longer penalised.

**With the candidate paper rule `rivalTie`** (paper levels only, same tables, n = 360 per level, 1,440 overall):

| Rivals | v2 | v1 | dominance | majority | expansion |
|---|---|---|---|---|---|
| Easy | 52.2 | 48.1 | 25.6 | 11.9 | 15.6 |
| Standard | 41.9 | 39.2 | 17.8 | 8.3 | 10.6 |
| Hard | 28.9 | 28.6 | 13.9 | 6.4 | 8.1 |
| Expert | 23.3 | 19.2 | 9.2 | 5.8 | 5.6 |
| All | **36.6** | 33.8 | 16.6 | 8.1 | 9.9 |

On the same paper tables v2 drops from 69.9% to 36.6%: the tie-break roughly halves the tuned player's win rate,
and the best fixed policy drops from 27.2% to 16.6%. v2 minus v1 under `rivalTie` is +2.8 [-0.3, +6.0]. A re-tune
against `rivalTie` (from v2) is running next.

One game in 18,000 stalled: it hit the harness's turn-30 cap, on a table with 4 Easy rivals. That cap is the
harness's known stall case, where no one can dominate any more, and is scored as it stands; it is not a new
impossible state.
