# Neural-network placement player: design and result

## Result (15 Nov 2026): paused; small real headroom over tuned v3

The player was built as below (`nn/features.js`, `nn/nnplayer.js`, `nn/driver.js`, `nn/train.py`) and
trained on 8,704 samples against v0.4.1 rivals (v3 making every later choice, 2 playouts per candidate).
It never beat v3: on held-back samples its picks scored 0.693 utility against v3's 0.695.

A headroom check then asked whether any player could beat v3 this way. At sampled Planning decisions
(App and −1..+2 under v0.4.1, 2–5 rivals), each of v3's top 4 spaces was played out 16 times on the same
re-dealt futures (`--nn-data --raw --k 4 --m 16`; analysis `nn/headroom.py`, averaged over 50 half-splits).

**Correction.** At 01:25 I stopped the work on the first 180 decisions (sandbox, seeds 349500–349900),
which showed no gain. The PC's run of 468 more decisions (`pb_n4_data`, seed 349000) does show one, and the
pooled 648 decisions clear the bar I had set (gain above 0.01 with the 95% range excluding zero):

| Per decision, win probability | First 180 | PC 468 | Pooled 648 |
|---|---|---|---|
| Best of 4 chosen on 8 playouts, scored on the other 8 | −0.002 (95% ±0.013) | +0.018 (±0.010) | **+0.013 (±0.008)** |
| Same, choosing on win + margin/100 | −0.003 (±0.013) | +0.020 (±0.010) | +0.014 (±0.008) |
| v3's 2nd choice minus its 1st | | | −0.007 (±0.009) |
| v3's 4th choice minus its 1st | | | −0.020 (±0.012) |
| Perfect chooser among the 4 (rough empirical-Bayes estimate) | | | +0.020 |

- v3's ordering is right on average, but in some positions a lower-ranked space is better, and 8 playouts
  per space are enough to find a useful share of them: about 1.3 points of win probability per decision.
- The 2-playout net found none of it. Labels with about 8 playouts per space should, at 4 times the cost
  per sample.
- The rules changed in v0.5.0 (rivals plan first) and the reference player is now v4, so any new attempt
  needs new data against v0.5.0 rivals with v4. Paused; whether to reopen is the director's call.

## Reopened (15 Nov 2026, 18:30): test player on v0.5.4+, reference pb5

The user reopened the network as a *test player* (assignment 10 in `COORDINATION.md`). Base and reference: **pb5**
(`tuned_weights_pb5.json`), which beats v4 against v0.5.4 paper rivals at every level (`bm50`/`bm51` against
`bm40`/`bm41`: +0.8 to +6.5 points).

**Step 0, headroom gate on v0.5.4 — passed.** Jobs `pb_h1`–`pb_h3` (`--nn-data --k 4 --m 16 --rate .03 --raw`,
seeds 550000/551000/552000): 1,263 Planning decisions over App and Easy–Expert with 2–5 rivals, 1,408 games,
0 errors, 0 stalls. Choosing the best of pb5's top 4 spaces on 8 playouts and scoring it on the other 8
(50 splits):

| Per decision | Win probability | Utility (win + margin/100) |
|---|---|---|
| Realisable gain, choosing on wins | **+0.0154 (95% +0.010 to +0.021)** | |
| Realisable gain, choosing on win + margin/100 | +0.0168 (±0.0060) | +0.0307 (±0.0094) |
| pb5's 2nd / 3rd / 4th choice minus its pick | −0.001 / −0.004 / −0.010 | |
| Perfect chooser among the 4 (rough empirical-Bayes) | +0.019 | +0.036 |

By table (choosing on wins): App +0.018 (±0.016), Easy +0.007 (±0.006), Standard +0.008 (±0.011), Hard +0.026
(±0.015), Expert +0.019 (±0.013); by rivals 2 / 3 / 4 / 5: +0.017 / +0.014 / +0.015 / +0.018. The headroom is
largest at Hard and Expert. All candidates were identical in every future in 11% of decisions.

**Step 1 (started 19:45):** features v2 (the level block now separates −2..+3 and scaled Easy; v1 lumped Easy,
Standard and Hard together). Labels: pb5's top 4 spaces, 8 playouts each on shared re-dealt futures, kept raw
(`pb_q*`, seeds 5601xx onwards, v0.5.5 rules on the PC).

**Step 1 result (16 Nov, 01:10): the net does not learn.** Residual MLP (1,322 features, 256-256, pairwise loss,
last layer zero-initialised), trained on the GPU with a train/validation/test split by decision:

| Job | Training data | Test gain over pb5, points of win rate per decision |
|---|---|---|
| `pb_t0a_train` | `pb_q01`–`q07`, 4,839 decisions | −0.14 (SE 0.33) |
| `pb_t0b_train` | `pb_q01`–`q10`, 7,003 decisions | −0.37 (SE 0.39) |
| `pb_t0c`–`t0e` | smaller, more regularised nets | never beat pb5 on validation (kept epoch 0) |

It memorises training pairs (98%) and orders held-back pairs at chance (50–52%). A boosted-tree switch rule on
simple candidate features (space, rank, value gap, level, rivals, turn) found nothing either (cross-validated
correlation 0.02).

**Bug found and fixed (45591f9).** `nnSlotScores` scored the candidates outside `asTuned`, so pb5's utility hook
(the lone-tundra feature) was off: the "top candidate" was not pb5's real pick in 11% of decisions, and the stored
base values differed from the ones the net is added to in play. Both the 19:38 gate and `pb_q01`–`q12` carry it.
With the fix the top candidate equals pb5's placement in 332 of 332 decisions, and a game replayed through the data
loop matches pb5 exactly.

**Corrected gate (16 Nov, 02:25) — passed again.** Jobs `pb_q13_data`, `pb_q14_data`, `pb_q15_gate`
(`results/pb_g1`–`pb_g3`; k 4, m 16, raw; seeds 571000/572000/573000; v0.5.6 rules): 1,152 decisions, 0 errors,
0 stalls.

| Per decision, win probability | All | Easy | Standard | Hard | Expert | App |
|---|---|---|---|---|---|---|
| Realisable gain (choose on 8, score on 8) | **+0.0139 (±0.0052)** | +0.002 (±0.004) | +0.031 (±0.016) | +0.007 (±0.011) | +0.019 (±0.012) | +0.011 (±0.013) |
| Perfect chooser among the 4 (rough) | +0.017 | +0.002 | +0.034 | +0.011 | +0.022 | +0.015 |

By rivals 2 / 3 / 4 / 5: +0.012 / +0.018 / +0.013 / +0.012. Per job: +0.013, +0.011, +0.019. pb5's 2nd / 3rd /
4th choices score −0.006 / −0.003 / −0.006 against its pick. The bug barely moved the gate (+0.0154 before), so the
headroom is real; the net cannot find which decisions it lives in.

**Next: the search player itself** (`--search K:M` in `--evaluate`, 45591f9). At each of its Planning placements
it plays pb5's top K spaces out M times on shared re-dealt futures and takes the most wins (then margin);
everything else is pb5. The paired reference column runs through the same loop (`--search 1:1` replays pb5 game
for game). Pilot on 530000, paired with pb5, Hard and Expert first: `pb_s*_search`.

## Search-player pilot (16 Nov, 02:23–06:45): much stronger than pb5, at paper levels and at App

`--search 4:8` (pb5's top 4 spaces, 8 shared re-dealt futures each, at every Planning placement), 60 paired
tables per cell on seed 530000, v0.5.6 rules, 0 errors, 0 stalls. Syntax:

    bench --evaluate --weights results/pb_d.ckpt.json --policies tuned,dominance,majority,expansion --search 4:8 --per-cell 60 --seed 530000 --modes 0 --bots 3

| Cell | Job | pb5 | Search | Paired gain (95%) | Search only / pb5 only | Best fixed | Minutes |
|---|---|---|---|---|---|---|---|
| Hard, 3 rivals | `pb_s1_search` | 51.7% | 81.7% | **+30.0 (+13 to +47)** | 25 / 7 | Domination 10.0%* | 12.5 |
| Hard, 4 rivals | `pb_s2_search` | 26.7% | 73.3% | **+46.7 (+32 to +62)** | 31 / 3 | expansion 10.0% | 10 |
| App, 3 rivals | `pb_s3_search` | 31.7% | 78.3% | **+46.7 (+32 to +62)** | 31 / 3 | Domination 23.3% | 85 |
| Expert, 3 rivals | sandbox† | 33.3% | 81.7% | **+48.3 (+33 to +63)** | 32 / 3 | Domination 10.0% | 56 (sandbox) |

\* `pb_s1` ran pb5 only; the fixed columns for that cell were run in the cloud sandbox, whose pb5 column matches
`pb_s1` win for win (31 of 60). † Same command and seeds as the PC cell, run in the cloud sandbox while the PC was busy.

Pooled over the paper cells (Hard 3, Hard 4, Expert 3; 180 tables): pb5 37.2% → search 78.9%, **+41.7 points**.

**Does it peek?** No. Each playout starts from a copy of the real position and re-deals everything the player can't
see: the rival card decks, the engine's shuffles, the unseen Dominance cards (Ice Age stays at the bottom), the
face-down terrain tiles and the element-bag and Symbiotic draws (`nnResample`). `--search 1:1` replays pb5 game for
game, so the reference column is pb5. The strength comes from playing each placement out against an exact model of
the rivals' rules, which no fixed weighting can do; the per-decision headroom (+0.014) adds up over the roughly
25 placements of a game.

**Balance reading (not X35: App has only 3 rivals so far).** Log-odds edges over the best fixed policy:

| | Hard 3 | Expert 3 | Hard 4 | App 3 |
|---|---|---|---|---|
| pb5 | 2.26 | 1.50 | 1.19 | 0.42 |
| Search | 3.69 | 3.69 | 3.21 | 2.47 |

Paper minus App at 3 rivals on the same tables: Hard search +1.22 (pb5 +1.84), Expert search +1.22 (pb5 +1.08),
each about ±1.3 (60-table cells, and the best fixed policy won only 6 of 60 at Hard 3 and Expert 3). The search
player gains about as much at App as at the paper levels (+46.7 against +30 to +48), so it does not widen the
paper-vs-App gap. No flag. The balance agent's `br01`–`br04` (App 3/4/5, Hard 5, same seeds) fill in the
4- and 5-rival cells; `br01` duplicates `pb_s3`.

**Cost.** About 12 minutes per 60 tables at paper levels on the PC, but about 85 minutes at App (the app rivals' own
AI runs inside every playout). A full standing block (360 tables a cell) is not practical; a smaller block (60–120
tables per cell, paper levels at 3–5 rivals plus App at 3–5 rivals over a day) is.

**What this means for the net.** The headroom is real and large once it compounds over a whole game, but a residual
on pb5's features could not find which decisions carry it from 7,000 labelled decisions. The search player is the
stronger test player now; distilling it would need far more labels per decision (or a value net trained on its
games), which is a bigger project than tonight.

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
