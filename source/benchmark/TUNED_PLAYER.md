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

## Results

See the end of this file once the round-2 runs are evaluated.
