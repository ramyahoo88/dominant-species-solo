# Neural-network placement player: design and result

## Result (15 Nov 2026): stopped, no realisable gain over tuned v3

The player was built as below (`nn/features.js`, `nn/nnplayer.js`, `nn/driver.js`, `nn/train.py`) and
trained on 8,704 samples against v0.4.1 rivals (v3 making every later choice, 2 playouts per candidate).
It never beat v3: on held-back samples its picks scored 0.693 utility against v3's 0.695.

A headroom check then asked whether any player could beat v3 this way. At 180 Planning decisions
(seeds 349500–349900, App and −1..+2, 2–5 rivals), each of v3's top 4 spaces was played out 16 times on
the same re-dealt futures (`--nn-data --raw --k 4 --m 16`; analysis `nn/headroom.py`):

| Measure (per decision) | Utility (win + margin/100) | Win probability |
|---|---|---|
| Best of 4 chosen on 8 playouts, scored on the other 8 | −0.010 (95% ±0.029) | −0.015 (±0.020) |
| v3's 2nd choice minus its 1st | −0.012 (±0.026) | −0.009 (±0.016) |
| v3's 4th choice minus its 1st | −0.049 (±0.035) | −0.032 (±0.023) |
| Best of 4 on all 16 playouts (biased upward by selection) | +0.096 | +0.056 |
| A perfect chooser among the 4 (rough empirical-Bayes estimate) | +0.035 | +0.017 |

- v3's ordering is right on average: every lower-ranked space does worse than its pick.
- The candidates do differ in some positions (a perfect chooser would gain up to about 2 points of win
  probability per decision), but 8 playouts per candidate cannot find those positions, and a net trained
  on 2-playout labels has far noisier evidence still.
- Finding the gain would need far more playouts per decision (a search player, too slow for benchmarks)
  or far more data. Both are poor value, and the paper rivals are about to change (`rivalsFirst`), which
  would make data against v0.4.1 rivals stale anyway. Tuned v3 stays the strong test player.

The original proposal follows.

## Proposal (14 Nov)

Step 2 of the player-bot plan: a placement player that learns from simulated games and is trained with
PyTorch on the job PC's GPU. This file is the proposal to approve before any of it is built.

### What it decides

Only Planning (where to put each action pawn), the decision where the tuned player gains most and where the
frozen reference helpers do not reach. Every execution choice (targets, cards, effects) stays with the tuned
player, so the comparison against tuned v2 measures placement alone.

### Model: a residual on the tuned player

    score(slot) = tunedValue(slot) + net(state)[slot]       illegal slots masked; play the best score

- `tunedValue` is tuned.js's own Planning value for each of the 41 action spaces.
- `net` is a small MLP: about 1,300 inputs, 2 hidden layers (512, 256), 41 outputs (one per action space).
  One forward pass per placement; about 0.8 million multiply-adds, so it runs in plain JavaScript.
- The last layer starts at zero, so the untrained net plays exactly like the tuned player (the same
  safety property as `--selftest`). Training can only move it away from tuned where the data says so.

Inputs, all from the player's point of view (opponents ordered by threat, so the seats are interchangeable):

| Block | Size |
|---|---|
| 35 tiles: terrain, cubes for self and up to 5 opponents, who dominates, scored this turn, element match per animal | about 800 |
| 41 action spaces: empty / self / opponent | 123 |
| Element boxes (Adaptation, Abundance, Regression, Wasteland, Depletion, Wanderlust) | 36 |
| 6 animal displays: VP, gene pool, pawns left, elements added, Initiative position, species | about 100 |
| Dominance Cards in the market, deck phase, turn, table (rivals, App or paper level) | about 40 |

### Training: rollout targets first, PPO only if needed

1. **Rollout targets (recommended start).** At sampled Planning decisions, take the tuned player's top 4
   spaces and play each one out 4 times to the end, with the current player making every later choice.
   The hidden future (unseen cards, element draws, terrain stacks) is re-drawn for each playout and shared
   across the 4 spaces, so the comparison is fair and low-noise and the target never peeks at the real game's
   future. The net learns which space wins more often than the tuned choice. Then repeat with the improved
   player (2 or 3 rounds).
2. **PPO fine-tuning (optional).** Ordinary self-improvement from whole games with a value baseline. It is
   cheaper per game but much noisier, because about 50 placements share one game result.

### Pipeline

| Piece | Where | Notes |
|---|---|---|
| Data generator | new `source/benchmark/nn_data.cjs`, run by a new `--nn-data` option | Float32 shards to `results/pb_nn_*.bin` plus an index file. Uses its own game loop (a copy of `playBenchmark`), so `game.js` is not touched. |
| Trainer | new `tools/pb_train_nn.py` | PyTorch with CUDA. Reads the shards and writes weights as JSON. |
| Player | new `source/benchmark/nnplayer.js`, policy `nn` in `--evaluate` | Loads the JSON and runs the MLP in JS. |

### What I need from you before building

- **A way to run Python jobs.** The runner accepts only `bench`, `git-pull` and `git-checkout`. Either add a
  `train <args>` job type to `tools/job-runner.ps1` (it would run `python tools/pb_train_nn.py <args>` in
  your conda environment), or run the trainer by hand.
- **The environment:** which conda environment has PyTorch with CUDA, and which GPU.
- **Queue time.** Rollouts cost about 8 simulated games per training sample. At the PC's roughly 23 games
  a second that is about 10,000 samples an hour, and the first round needs about 50,000 samples: about
  5 hours of runner time in 20-minute jobs. Training itself takes minutes. PPO would need about 1 to 2 hours
  per round, but the results are less certain.

### How success is measured

The same held-out `--evaluate` tables as tuned v2 (new seed block), pooled by level, with a paired
comparison against tuned v2 on identical tables. The aim is the cells where v2 is weakest: App rivals and
Hard/Expert paper rivals with 4–5 rivals.
