# Self-tuning test player

> **Note (15 Nov 2026, v0.5.0):** the results below were measured against v0.4.x paper rivals, on that release's level scale (Easy −1 … Expert +2). Since v0.5.0 the paper rivals plan first and the levels are Easy −2 … Expert +1. The overnight balance work, the re-tuned checkpoint v4 (`tuned_weights_v4.json`) and its held-out evaluation are in `HARD_BALANCE_LOG.md`.

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

## Release check for v0.4.0 (round 2b: v3, re-tuned against the rival tie-break)

**v3** (`tuned_weights_v3.json`) is v2 re-tuned against `rivalTie` with every feature group on. It ran 39
generations (train seeds 350001+, validation block 360000 with 400 tables of App and 0..+3) and keeps the best
validated generation, 24. Validation win rate went from 34.3% (v2) to 48.0%; generations 25–39 stayed at 43–47%.

**Held-out evaluation** under v0.4.0 on the PC, seed block 330000. Levels are Easy −1, Standard 0, Hard +1,
Expert +2, plus App. 90 tables per cell: n = 360 per level per column, 1,800 overall. All columns play the same
tables.

**Tie-break on (the v0.4.0 default).** Win %:

| Rivals | v3 | v2 | v1 | dominance | majority | expansion |
|---|---|---|---|---|---|---|
| App | 43.3 | 42.5 | 43.6 | 15.6 | 9.7 | 11.7 |
| Easy (−1) | 80.3 | 69.2 | 67.5 | 47.5 | 32.2 | 36.9 |
| Standard (0) | 64.2 | 52.2 | 48.1 | 25.6 | 11.9 | 15.6 |
| Hard (+1) | 47.8 | 41.9 | 39.2 | 17.8 | 8.3 | 10.6 |
| Expert (+2) | 39.7 | 28.9 | 28.6 | 13.9 | 6.4 | 8.1 |
| All | **55.1** | 46.9 | 45.4 | 24.1 | 13.7 | 16.6 |

v3 minus v2 (paired): **+8.1** [+5.3, +11.0] overall. By level: Easy +11.1, Standard +11.9, Expert +10.8,
Hard +5.8 [−0.7, +12.4], App +0.8. The re-tune gained against paper rivals only.

Gap over the best fixed strategy (dominance at every level), in points:

| Player | App | Easy | Standard | Hard | Expert | Hard minus App |
|---|---|---|---|---|---|---|
| v3 | +27.7 | +32.8 | +38.6 | +30.0 | +25.8 | **+2.3** |
| v2 | +26.9 | +21.7 | +26.6 | +24.1 | +15.0 | −2.8 |
| v1 | +28.0 | +20.0 | +22.5 | +21.4 | +14.7 | −6.6 |

The director's test (21:15) flags a Hard gap more than about 5 points above the same player's App gap. v3 comes
to +2.3 and v2 to −2.8, so **no new exploit**. The Standard gap is above the App gap: +10.9 for v3, against
−0.3 for v2.

What v3 leans on: ablations of v3 on the same tables, change in win % when the group is reset.

| Group off | All | App | Standard | Hard |
|---|---|---|---|---|
| initiative (initFirst, initOther, late.initiative) | **−10.3** [−12.9, −7.6] | −8.6 | −14.4 | −9.2 |
| domination (cardWeight, nonOwner, rivalWeight, setup, domCommit, late.domination) | **−6.6** [−9.3, −3.9] | −8.6 | −3.9 | −10.3 |
| cubes | −2.7 [−5.4, +0.1] | −6.1 | −1.4 | −1.1 |
| phase | −1.3 [−3.5, +0.8] | 0.0 | −1.7 | −4.7 |

The same two drivers as v1, Initiative climbing and Domination weights, still carry the edge.

**Tie-break off** (`noRivalTie`, the old rules), same tables:

| Rivals | v3 | v2 | v1 | dominance |
|---|---|---|---|---|
| App | 43.3 | 42.5 | 43.6 | 15.6 |
| Easy (−1) | 92.5 | 92.5 | 90.8 | 73.6 |
| Standard (0) | 88.1 | 85.6 | 86.4 | 45.0 |
| Hard (+1) | 80.0 | 78.6 | 71.4 | 28.9 |
| Expert (+2) | 68.3 | 62.2 | 57.2 | 20.8 |
| All | 74.4 | 72.3 | 69.9 | 36.8 |

Without the tie-break, v3's Hard gap is +51.1 against +27.7 at App (+23.4). With it, the Hard gap is +30.0
(+2.3 over App). So the tie-break brings the tuned player's Hard edge into line with the app's rivals.

**Consistency check:** with `noRivalTie`, v2 reproduces its v0.3.9 numbers on the same tables exactly. Tables with
0, +1 and +2 pawns give 85.6, 78.6 and 62.2, and App 42.5, the same as in round 2. So the cell seeds carried over,
and `noRivalTie` is the old rule set.

**Stalls:** 3 games hit the turn-30 cap, all with the tie-break off (4 rivals at Standard, 5 at Easy).
None did with it on, out of 18,000 games.

## v0.5.0 independent check (15 Nov 2026, assignment 7) and re-tune pb5

Shipped v0.5.0 code (main 759af34: rivals plan first; levels Easy −2, Standard −1, Hard 0, Expert +1), held-out
seed block 490000, 360 tables per cell (2–5 rivals), 0 errors. Jobs `pb_c1` (paper levels), `pb_c2`/`pb_c3`
(App, split by rival count). The simple human is re-fit by the same recipe as before: the dominance player plus
v4's three Initiative weights (`simple_human_v4_weights.json`).

Pooled win % (1,440 tables per row; `pb5` from `pb_e1`, on the same tables):

| | pb5 | v4 | v3 | simple human | dominance | majority | expansion |
|---|---|---|---|---|---|---|---|
| Easy | 93.5 | 88.6 | 87.5 | 79.0 | 79.7 | 62.6 | 56.8 |
| Standard | 70.4 | 64.7 | 61.5 | 46.5 | 42.2 | 24.9 | 25.6 |
| Hard | 45.8 | 42.6 | 39.9 | 23.8 | 21.2 | 11.3 | 12.0 |
| Expert | 29.1 | 29.7 | 25.3 | 12.3 | 12.2 | 6.9 | 6.0 |
| App | 41.6 | 48.2 | 42.5 | 24.9 | 18.4 | 10.8 | 11.5 |

The balance check (`balance/final_eval.py`, `edge_check.py`): a player's logit edge over the best fixed policy at
a paper level, minus the edge against App rivals at the same rival count; X35 is the mean over 3–5 rivals.
The line is +0.2. One run's X35 is about ±0.3 (95%); a single 5-rival cell about ±0.6.

| X35 | Easy | Standard | Hard | Expert |
|---|---|---|---|---|
| v4 (final_eval.py) | −0.64 | −0.47 | −0.23 | −0.13 |
| v4, pooled with the balance agent's 470000 run | −0.78 | −0.41 | −0.15 | −0.12 |
| pb5, against its own App edge | +0.12 | +0.06 | +0.07 | +0.02 |
| best paper edge of (v4, v3, pb5) minus best App edge of the three | −0.14 | −0.20 | −0.14 | −0.13 |

**pb5** is an independent re-tune: v3 re-tuned against v0.5.0 rivals on new seeds (train 510000, validate
520000), 39 generations, all feature groups, trained on App and the four shipped levels (v4 trained on App and
−1..+2, so it never saw Easy). Validation win rose from 0.525 to 0.588, best at the last generation.

- Against paper rivals it beats v4 by +4.9 (Easy), +5.7 (Standard) and +3.2 (Hard) points, level at Expert (−0.6);
  against App rivals it is 6.6 points weaker. The two tunes found different trade-offs between App and paper play.
- Measured against its own (weaker) App edge, pb5 is slightly above zero at every level, but no level reaches +0.2.
  The fair comparison is best against best: the strongest paper edge any of the three players found, minus the
  strongest App edge. That stays below zero at every level (−0.13 to −0.20), so there is no flag, but the margin
  is thinner than v4 alone suggests, mostly at Easy and Standard.
- Largest moves from v3: later Migration (+2.1) and Depletion (+2.0), Glaciation and Competition rows down (−2.1,
  −2.0), Predator and Aquatic cards up (+2.6, +1.9). Initiative weights rose (initFirst +0.8, initOther +1.3,
  late Initiative +1.3).

**Confirmation on the balance agent's 470000 tables** (`pb_e2`, pb5 merged into `ba67`/`ba34`): pb5 beats v4 by
+5.9 (Easy), +2.6, +1.5, +1.6 (Expert) points and is 4.0 behind at App. Pooled over both seed blocks
(2,880 tables per level): pb5 minus v4 is +5.4, +4.2, +2.4, +0.5 and −5.3 at App. Best against best, X35 pooled:
Easy −0.12, Standard −0.21, Hard −0.09, Expert −0.09 (pb5 against its own App edge: +0.05, −0.04, +0.05, −0.01).
No level with 3–5 rivals reaches +0.2. Hard and Expert sit about level with App; Easy and Standard a little below.
