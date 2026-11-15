# Hard balance round — overnight log (14–15 Nov 2026)

**Mandate (user, 22:59 local, 14 Nov):** full control of testing and design/rule/card changes for about 8 hours (until about 07:00 local, 13:00Z). The player-bot's network data jobs may be paused. If the next tests don't solve it, keep brainstorming and testing. Report in the morning.

**Branch:** `claude/hard-balance`, from main ba1c69e (v0.4.1 plus GPT's v0.4.1 follow-up audit PDF).

## The problem

`v4_hardapp` (seed 450000, 1,440 paired games per level, v3 vs dominance):

| Level | v3 | dominance | gap |
|---|---|---|---|
| App | 40.7 | 17.8 | +22.8 (19.7–26.0) |
| Hard +1 | 51.7 | 18.7 | +33.1 (30.0–36.1) |

Hard minus App **+10.3** (about 6–15). Dominance finds Hard and App equal, so this is a like-for-like comparison.

`v5_hardabl` (same tables), cost of removing each part of v3, App / Hard:
- Initiative weights: −5.6 / −11.9
- Domination weights: −1.1 / −8.0
- Simple human (dominance plus v3's Initiative only): 21.6 / 24.7 (vs dominance 17.8 / 18.7)

So the excess comes from the combination of turn order and Domination play.

Local diagnosis, 4 rivals, Hard: v3 is first in Initiative on 54% of turns. Paper rivals almost never take Initiative (0.4 per game each). App rivals value climbing (opportunity 2.0 when not first) and deny the threat's best space.

Also: in Planning the extra difficulty pawn is placed last, after everyone else has run out (round-robin by `remaining`), so it mostly takes leftovers.

## The bar

1. **Matched-difficulty test.** At the paper level where dominance wins about as often as against App rivals, v3's gap over dominance is within about 5 points of App's.
   - Don't read the gap alone: a level that just gets harder shrinks it on its own.
   - Read v3 at matched dominance, and run 0/+1/+2.
2. **Anchor.** With switches off, Hard at seed 450000 must reproduce 745/1440 (v3) and 269/1440 (dominance).
3. **Confirm.** Confirm any finalist on a fresh seed block, then re-tune the player against it (recipe from `pb_b1–b3`, about 80 minutes) and re-check.
4. **Ladder.** Easy < Standard < Hard < Expert still holds for dominance and v3.
5. **Printability.** At most a line or two of printed rules.

## Candidates (PAPER flags in `paper.js`, off by default)

- `extraFirst`: rivals place their difficulty pawns before anyone else, at the start of Planning, in Initiative order.
- `initClimb`: a rival that isn't first in Initiative takes the open Initiative space, as its first Planning step.
- `holdYou`: a rival ahead of you on the Initiative track takes the open Initiative space, so you can't climb past it. Re-test under v0.4.1; the old verdicts predate the tie-break and v3.
- `leadDom`: race for Domination space 1 when you dominate an unscored tile and a card is available.
- `blockHuman`: Block the leader aims at you rather than the VP leader.
- `tieToRival` (added 23:30): a tie for the most matches that includes you goes to the highest rival in it. This targets the Domination channel directly and adds no pawns; it could replace the extra pawn as a difficulty step.
- Combinations of a turn-order rule and a Domination rule.

**Constraint:** paper rivals are run by hand at the table, so each rule must be executable from the printed rulebook and cards.

## Diagnosis notes (local, seed 452000, 300 games, Hard, 3 rivals)

| | v3 | dominance |
|---|---|---|
| Win % | 56.7 | 16.7 |
| First in Initiative (turns) | 58% | 16% |
| Domination pawns per game | 5.3 (space 1: 2.6) | 1.4 (space 1: 0.6) |
| Cards via its own Domination | 4.9 | 1.2 |
| Wanderlust VP | 24 | 5 |

- v3 climbs to first, grabs Domination space 1 (it resolves first) and claims cards.
- At Hard the extra rival pawn is placed last, onto leftovers (Fallback starts with Domination). So rivals take more Domination 3–5, Migration and Competition, and games are shorter (5.7 turns vs 6.8 at App, 4 rivals).

## GPT v0.4.1 follow-up audit (ba1c69e): pass for playtesting

- **R1 (low):** Help states the new cone tie-break in a resumed legacy save. Fix: say it applies to new Paper games, and show a one-line notice for legacy saves.
- **R2 (low):** a v0.3.6 Easy save re-exported by v0.3.9 shows Unknown. Fix: recover the unique −1 endpoint for pre-tie saves.
- **R3 (medium):** an evaluator label collision. The player-bot agent fixed it in `tune.cjs` on its branch (6104ce5); merge that.
- **Documentation:** the safest input is the original export; intermediate re-exports can lose their origin.
- **Wording:** "won 30% versus 25% in this sample."

## Jobs and results

(PC prefix `ba`, which sorts before `pb_`.) All are v3 and dominance at Standard, Hard and Expert, 2–5 rivals, 360 games per cell, seed 450000. App rows come from `v4_hardapp`. Analysis: `matched.py` (v3 at the paper difficulty where dominance matches App, minus v3 against App).

- **ba01_anchor** (no switches). Hard must equal v4's Hard rows.
- ba02 extraFirst · ba03 initClimb · ba04 holdYou · ba05 leadDom · ba06 blockHuman · ba07 initClimb+leadDom · ba08 holdYou+leadDom
- ba09 tieToRival · ba10 extraFirst+leadDom · ba11 tieToRival+initClimb

Also done on this branch: GPT's R1 (Help notice for legacy saves) and R2 (−1/+3 recovered; rules test 37, mutation-checked). R3 is the worker's `tune.cjs` 6104ce5, already taken here.

### Results, batch 1 (23:25–23:50)

The anchor reproduces v4 exactly (Hard 745/1440 v3, 269/1440 dominance).

**Metric change.**
- The excess is not Hard-specific. At matched difficulty, paper rivals are more exploitable than App rivals at *every* level, with 3–5 rivals; with 2 rivals there's no excess.
- The main metric is now **edgeX**: v3's log-odds edge over dominance (logit v3 − logit dominance) at a paper level, minus the same edge against App rivals at the same rival count. The edge is roughly constant across difficulty, so it needs no interpolation.
- Target about ≤ +0.2 (≈ 5 points near 30–50%).
- `matchedExcess` (pp, interpolated) is shown too, but it's unreliable when App's difficulty lies outside the paper levels.

| Run | Std v3/dom | Hard v3/dom | Exp v3/dom | edgeX Std/Hard/Exp (3–5 rivals) |
|---|---|---|---|---|
| ba01 anchor | 65.8/28.1 | 51.7/18.7 | 44.0/12.4 | +0.75 / +0.72 / +0.93 |
| ba02 extraFirst | (=) | 27.3/10.6 | 11.0/6.5 | – / +0.39 / −0.20 (much harder; floor effects) |
| ba03 initClimb | 59.4/31.3 | 45.4/19.7 | 37.8/16.0 | +0.33 / +0.42 / +0.63 (2 rivals −0.4 to −0.8) |
| ba04 holdYou | 62.5/32.6 | 49.5/24.5 | 38.1/18.5 | +0.36 / +0.24 / +0.28 (2 rivals −0.3 to −0.8) |
| ba05 leadDom | 66.2/27.9 | 51.1/18.8 | 44.0/11.6 | +0.78 / +0.73 / +1.05 (no effect) |
| ba06 blockHuman | 68.1/28.5 | 52.2/18.8 | 44.1/11.6 | +0.80 / +0.75 / +1.15 (no effect) |

**Reading.**
- Domination-side Planning rules do nothing on their own: rivals place after a player who is first.
- Turn-order rules cut the excess by half or more. They also make the game easier for the dominance player (rivals spend pawns), so the levels would need re-measuring.
- Batch 2: holdYou variants (Direct, VP), climbPast, holdYou + tieToRival, holdYou + extraFirst; also an App baseline at seed 460000 for confirmation.

### Results, batch 2 (to 00:05)

**Summary metric.**
- **X35** = mean edgeX over Standard/Hard/Expert and 3–5 rivals. **X2** = the same at 2 rivals.
- Noise is about ±0.08 between candidates (1σ), plus a common App offset of about ±0.10.

| Run | X35 | X2 | Std v3/dom | Hard v3/dom | Exp v3/dom |
|---|---|---|---|---|---|
| ba01 anchor | +0.80 | 0.00 | 65.8/28.1 | 51.7/18.7 | 44.0/12.4 |
| ba02 extraFirst | +0.31 | −0.55 | = | 27.3/10.6 | 11.0/6.5 |
| ba03 initClimb | +0.46 | −0.61 | 59.4/31.3 | 45.4/19.7 | 37.8/16.0 |
| **ba04 holdYou** | **+0.29** | −0.47 | 62.5/32.6 | 49.5/24.5 | 38.1/18.5 |
| ba05 leadDom | +0.85 | +0.02 | 66.2/27.9 | 51.1/18.8 | 44.0/11.6 |
| ba06 blockHuman | +0.90 | +0.07 | 68.1/28.5 | 52.2/18.8 | 44.1/11.6 |
| ba07 initClimb+leadDom | +0.33 | −0.58 | 58.6/31.6 | 44.4/20.6 | 37.1/15.8 |
| ba08 holdYou+leadDom | +0.40 | −0.44 | 61.3/31.7 | 48.3/22.2 | 39.9/17.4 |
| ba09 tieToRival | +0.58 | +0.12 | 59.5/25.5 | 47.5/15.6 | 39.8/12.0 |
| ba10 extraFirst+leadDom | +0.24 | −0.55 | 66.2/27.9 | 27.4/10.3 | 10.9/6.5 |
| ba11 tieToRival+initClimb | +0.43 | −0.50 | 54.0/26.4 | 41.3/16.6 | 34.1/12.6 |
| ba12 holdYouDirect | +0.34 | −0.54 | 62.8/35.9 | 51.5/24.1 | 40.8/18.8 |
| ba13 climbPast | +0.42 | −0.49 | 55.4/27.2 | 39.6/16.9 | 30.5/11.7 |
| ba14 holdYouVP | +0.54 | −0.28 | 62.8/31.8 | 49.9/21.2 | 41.3/14.9 |
| ba15 holdYou+tieToRival | +0.55 | −0.61 | 58.6/27.4 | 46.5/19.7 | 37.6/15.8 |

**Local checks under holdYou (Hard, 3 rivals, 200 games):**
- With the player as Insects (first at the start) or Mammals (last at the start): v3 wins 64.5% vs 42.5%, and dominance 30.5% vs 12%.
- The log-odds edge is similar (1.42 vs 1.69), so the seat matters for everyone and it isn't a strategy hole.

**Plan (00:05).**
1. Confirm holdYou on fresh seeds: ba23 anchor at 460000, ba24 holdYou at 460000, ba17 App at 460000.
2. Re-tune from v3 against holdYou: ba25–27 (`results/ba_hy.ckpt.json`; train seed 370000, validate 380000).
3. Still queued: ba16 holdYou+extraFirst, ba18 holdYou ablations, ba19 App ablations, ba20 cardVP, ba21 holdYou+cardVP, ba22 holdYou+initClimb.

### 00:30 — Second App seed and Domination diagnosis

**App baseline at seed 460000 (ba17).**
- Edges by rival count: 1.24 / 1.06 / 0.84 / 1.00 (seed 450000: 1.58 / 1.08 / 0.92 / 1.20).
- Summaries now use App pooled over both seeds (`app_pooled.json`). On that basis:
  - anchor X35 = +0.85;
  - holdYou = +0.35;
  - holdYou + extraFirst = +0.09 (with floor effects).

**Ablations under holdYou (ba18), v3 win %, Std / Hard / Exp:**
- v3: 62.5 / 49.5 / 38.1
- no_initiative: 62.4 / 49.1 / 37.9 (Initiative is neutralised)
- **no_domination: 56.4 / 40.3 / 29.8 (−6 to −9; at App it was −1.1)**
- no_cards: 58.7 / 44.7 / 35.0
- no_cubes: 56.7 / 47.2 / 37.0

**Local diagnosis, v3, 3 rivals, seed 454000:**

| | App | Paper Hard + holdYou |
|---|---|---|
| v3's Domination pawns per game | 12.2 | 4.9 |
| VP from its own Domination | 70.7 | 34.7 |
| VP fed to v3 by rivals' Domination | **9.6** | **21.3** |
| Cards v3 claims | 11.1 | 4.6 |

- Paper rivals choose the tile to score by their own VP only. So they often score tiles where you collect a lot (second place on big tiles).
- **New candidate `domNet`:** a rival scores the tile with the most (its VP − your VP). Locally, with holdYou, the VP fed to v3 drops from 21.3 to 10.2 (App's level).
- Queued: ba29x1 domNet, ba29x2 holdYou + domNet. These run before the re-tune; the re-tune's candidate is chosen from them.

### 00:55 — Batch 3 and a new leading candidate: `rivalsFirst`

X35 / X2 against the pooled App baseline.

| Run | X35 | X2 | Easy v3/dom | Std v3/dom | Hard v3/dom | Exp v3/dom |
|---|---|---|---|---|---|---|
| ba20 cardVP | +0.69 | −0.05 | | 68.5/35.2 | 55.6/21.9 | 44.2/16.9 |
| ba21 holdYou+cardVP | +0.35 | −0.50 | | 64.8/36.2 | 50.8/29.1 | 41.3/20.6 |
| ba22 holdYou+initClimb | +0.38 | −0.39 | | 61.1/32.2 | 47.3/23.5 | 36.8/17.2 |
| ba23 anchor, seed 460000 | +0.95 | +0.16 | | 66.5/29.0 | 53.3/18.3 | 40.3/12.4 |
| ba24 holdYou, seed 460000 | +0.45 | −0.33 | | 60.9/33.1 | 48.0/23.3 | 38.3/16.8 |
| **ba28 rivalsFirst** | (see below) | −0.34 | 61.1/40.8 | 41.6/21.0 | 27.3/10.6 | |
| ba29 holdYou+rivalsFirst | | −0.43 | 56.2/40.0 | 41.2/20.2 | 26.7/12.1 | |
| ba29x1 domNet | +1.33 | +0.18 | | 56.5/20.6 | 42.4/12.6 | 36.7/7.9 |

**domNet backfires.** It hurts the simple player much more than v3.

**rivalsFirst: edgeX by rival count (2/3/4/5):**
- Easy (−1): −0.87 / −0.05 / −0.10 / −0.04
- Standard (0): −0.37 / +0.11 / +0.15 / −0.05
- Hard (+1): −0.32 / +0.21 / +0.64 / +0.48. Floor effects: dominance at 4–5 rivals is 4% and 3%.

**What it means.**
- With rivalsFirst, Standard is about as hard as App rivals (dominance 21.0% vs App 19.3%; v3 41.6% vs App about 41%).
- At 3–5 rivals the excess is gone at Easy and Standard. A strong player's edge matches the one against App rivals.
- holdYou adds nothing on top. rivalsFirst alone is one rule, so it's preferred.
- At +1 it is identical to extraFirst (same placement order), which is a consistency check.
- **Level step is bigger:** dominance 40.8 → 21.0 → 10.6 from −1 to +1. Likely new mapping: Easy −2, Standard −1, Hard 0, Expert +1. It needs a ladder that includes −2 (benchmark.cjs, scripted player).

**Queue changes (00:55).**
- ba30–32 were retargeted to **re-tune against rivalsFirst**. The file names still say `hy`; the checkpoint is `results/ba_rf.ckpt.json`.
- Added ba29y1: rivalsFirst at seed 460000 (confirmation).

### 01:00 — Checklist (advisor) before any release

1. **Judge only the re-tuned player** (`ba_rf.ckpt.json`). v3 is mis-tuned for the new Planning order.
2. **Final evaluation on an untouched seed block (470000):**
   - all fixed policies (dominance, majority, expansion);
   - the edge over the *best* fixed policy per cell;
   - App cells for both the re-tuned player and v3, on the same block (ba34);
   - recovery: how much the re-tune gains over v3 under rivalsFirst;
   - its paper edge minus the *better* of its and v3's App edges;
   - its ablations (Initiative, Domination).
   - **Pass:** within about 0.2 at the shipped levels, at 3–5 rivals.
3. **Re-anchor:** Hard at 450000 with no switches must give 745/269 after all the `paper.js` edits (ba29y2).
4. **2 rivals:** X2 is −0.3 to −0.9 with rivalsFirst (baseline +0.18). Decide explicitly: all tables, or rivalsFirst only with 3+ rivals.
5. **+1 at 4–5 rivals:** dominance wins only 3–4%, so the edge there can't be read. Run it with four times the games, or say so.
6. **Saves:**
   - record the rule in the save (`s.paper.planFirst`, like `rivalTie`), not only in the global switch;
   - a v0.4.1 game must keep its old Planning order;
   - a save made mid pre-round must survive export, reload and validation.
7. **Level names:**
   - new offsets make v0.4.0–v0.4.1 saves legacy too. They carry `rivalTie`, so `paperLevel` and the R1 notice must not read them on the new scale (F1 again);
   - write the level name into every new save from now on.
8. **Worker:** told not to collect data against v0.4.1 rivals (COORDINATION, 01:00).
9. **Cut-off:** if nothing has passed a re-tune by about 04:00, don't start a release; leave the branch and the report.

### 01:20 — Confirmations; release shape

- **Re-anchor (ba29y2):** Hard at 450000 still gives 745/269 after all the edits.
- **rivalsFirst on fresh seed 460000 (ba29y1):** Easy 60.7/44.9, Standard 39.7/20.0, Hard 27.4/12.0.
  - edgeX at 3/4/5 rivals: Easy −0.55/−0.23/−0.21; Standard +0.09/+0.23/+0.12; Hard +0.16/+0.50/−0.24.
  - 2 rivals: −0.84/−0.58/−0.51.
  - **Confirms** that the excess is gone at Easy and Standard.
- **Decision on 2 rivals:** the rule applies at every table size.
  - One printed rule with no rival-count condition is simpler at the table.
  - The cost: at 2 rivals a strong player's edge is somewhat smaller than against App rivals (about 6 points at Standard). That's no exploit.
  - The alternative (rivalsFirst only with 3+ rivals) keeps 2-rival play as in v0.4.1 but needs level offsets per rival count.
- **Re-tune stage 1 (ba30, 13 generations):** validation win 0.388 → 0.405. A small gain, so no big new hole so far.
- **Release shape:** `paper.js` now has only the rule. It is on by default (benchmark too); `noPlanFirst` turns it off.
  - The screened candidates remain on this branch at commit f104c5b.
  - **Not yet on the PC:** the PC keeps the research `paper.js` until the ladder jobs finish.

### 01:35 — Re-tune in progress; app and rulebook drafted

**Re-tune (ba30–31, 25 of 39 generations):** validation win 0.388 at the start, 0.38–0.405 since. The tuner is finding very little against rivalsFirst so far.

**Branch status (not released):**
- `paper.js` has only the rule (`s.paper.planFirst`, on by default; `noPlanFirst` turns it off).
- App, VERSION 0.5.0:
  - provisional scale Easy −2 / Standard −1 / Hard 0 / Expert +1;
  - level names are recorded in new saves;
  - v0.4.x saves keep their name and old Planning order;
  - Help describes the rule and both legacy cases.
- Tests:
  - 38 rules tests, including the mid pre-round save and the legacy Planning order;
  - `browser_restart_test.py`: 8 save cases plus Help;
  - `browser_test.py`;
  - `browser_game_test.py` paper=−1 with 2, 3 and 5 rivals: full games, Undo, reload and import pass, no stalls.
- Rulebook draft:
  - the "Rivals plan first" paragraph;
  - the overview line;
  - a data-driven difficulty table (`ladder.json` `offsets`).

**Queue:**
- ba32 re-tune stage 3;
- ba33/34 final evaluation at seed 470000;
- ba35–54 ladder;
- ba55 +1 at 4–5 rivals with 4× games (seed 480000).

### 02:15 — RESULT: the re-tuned player passes on fresh seeds

**Re-tune (ba30–32):**
- 39 generations from v3 against rivalsFirst; `ba_rf.ckpt.json`, best at generation 27.
- Validation win went from 0.34 to 0.425; that is the best of 13 checks, so some winner's curse is expected.

**Final evaluation, seed block 470000 (never used before).**
- Paper levels come from ba33, App from ba34.
- Level names below are the tuner's **old-scale** labels: Easy = −1, Standard = 0, Hard = +1, Expert = +2.

| Level | re-tuned | v3 | dominance | majority | expansion |
|---|---|---|---|---|---|
| −1 | 66.1 | 63.0 | 44.4 | 25.0 | 26.1 |
| 0 | 44.8 | 41.9 | 22.9 | 11.5 | 9.6 |
| +1 | 28.5 | 26.9 | 11.6 | 5.1 | 6.4 |
| +2 | 19.7 | 19.9 | 8.3 | 5.1 | 4.7 |
| App | 45.7 | 41.5 | 17.5 | 10.7 | 11.0 |

**Measures:**
- **Re-tune recovery** (re-tuned minus v3): −1 +3.1, 0 +2.9, +1 +1.6, +2 −0.2; **App +4.2**. The re-tune gained *more* against App rivals than against paper rivals, so it found no new paper hole.
- **edgeX of the re-tuned player** (edge over the best fixed policy, minus the better App edge of re-tuned and v3, same rival count):

  | Level | 2 rivals | 3 | 4 | 5 | X35 |
  |---|---|---|---|---|---|
  | −1 | −1.06 | −0.26 | −0.52 | −0.34 | **−0.37** |
  | 0 | −1.02 | −0.23 | −0.20 | +0.21 | **−0.07** |
  | +1 | −0.68 | −0.08 | −0.15 | −0.11 | **−0.11** |
  | +2 | −0.55 | −0.45 | −0.97 | +0.77 | **−0.22** (floor: best fixed 1–9%) |

- **Pass at every level (X35 ≤ +0.2).** Before tonight the same measure was +0.85 to +0.95 for v3.
- **Ablations of the re-tuned player** (pp; −1/0/+1/+2):
  - Initiative: −4.9 / −7.9 / −4.2 / −2.5 (against App, v3's was −5.6);
  - Domination: −1.2 / −5.2 / −1.9 / −1.6 (against App, −1.1).
  - Nothing it leans on stands out the way Initiative + Domination did (−11.9 / −8.0 at old Hard).
- **2 rivals:** a strong player's edge is smaller than against App rivals (−0.55 to −1.06). That is accepted (see 01:20).

**Decision: ship rivalsFirst as v0.5.0**, once the ladder (ba35–54) fixes the level offsets.

### 02:40 — +1 at 4–5 rivals with 4× games (ba55, seed 480000); ladder

**ba55** (1,440 games per cell):

| Rivals | re-tuned | v3 | best fixed | edgeX |
|---|---|---|---|---|
| 4 | 21% | 18% | 7% | −0.15 |
| 5 | 13% | 10% | 4% | −0.11 |

Checklist item 5 is resolved: there is no excess at +1 with 4–5 rivals.

**Scripted-player ladder** (benchmark.cjs, seed 200000, rivalsFirst; App from the same jobs). Win %:

| Rivals | −2 | −1 | 0 | +1 | +2 | App |
|---|---|---|---|---|---|---|
| 2 | 66 | 42 | 26 | 16 | 10 | 20 |
| 3 | 56 | 31 | 21 | 8 | 6 | 15 |

- The 4–5 rival cells first ran with too few games (`--repeats 2` gives only 180 and 36 games there). They are being re-run with repeats 4 and 20 (ba56–65), as for the v0.4.0 ladder.
- The player-bot's `pb_n4` headroom check ran in a gap in my queue (02:27), which is allowed. It delays the reruns by about 16 minutes.

**Level mapping: Easy −2, Standard −1, Hard 0, Expert +1.**
- Hard (0) matches the app's rivals for the strong player: v4 wins 44.8% vs 45.7% against App rivals at seed 470000.
- For simpler players Hard is a little easier than App rivals (scripted 26/21 vs 20/15 at 2/3 rivals).
- Standard (−1) is a little easier than an even game with 2–3 rivals.
- Expert (+1) is tougher than App rivals.
- **Tuner labels changed to match:** −2 Easy … +1 Expert; −2 cells get new seeds and older cells keep theirs.

### 03:20 — Release checks on the shipped code (advisor's blocking list)

1. **Errors and stalls:** no errors in ba28, ba29y1, ba33, ba34, ba55 or ba67. One stalled game in ba67 (5 rivals, Easy) and one in the ladder (ba62, 5 rivals, Standard). The ladder stall is in the rulebook; both are in PAPER_RIVALS.md.
2. **Shipped `paper.js` benchmarked:**
   - **ba66** (`noPlanFirst`, Hard at 450000): 745/269, the same as v4_hardapp.
   - **ba67** (default rules, seed 470000, levels −2..+1): the −1/0/+1 cells reproduce ba33 exactly. The one exception is 5 rivals at −1 (re-tuned 57% vs 56%), which comes from the opening-round change for a rival with no pawn to place.
3. **Shipped Easy (−2) evaluated (ba67).** X35 on the shipped scale:
   - Easy −0.91 (ceiling: the best fixed policy wins 76–81%);
   - Standard −0.36;
   - Hard −0.07;
   - Expert −0.11.
   - **Every shipped level passes.**
4. **Restart default:** an App game restarted as Paper now preselects Standard (−1), not 0, with a browser test that fails without the fix.
5. **Opening round:** it is now an explicit list of rivals with a pawn to place. A rival whose pawns are all on the display (Easy at 5 rivals with an Instinct-parked pawn) skips it, and the rule text says so. There is a rules test for it, and ba68 re-ran the 5-rival Easy ladder cell.

**Non-blocking items done:**
- results worded "in that sample";
- a `TUNED_PLAYER.md` note;
- the save-migration test includes 0.4.1;
- the player's code doesn't read `currentPlanner` or `s.planning` (grep), so the re-tune isn't blind to the order;
- `final_eval.py` notes that labels changed (compare by `extraPawns`).

### 03:35 — v0.5.0 released to main (759af34); follow-ups

- **Released:** main 759af34, build fe36f6c6. The online rulebook mirror is updated (rev 40). COORDINATION is updated, and the worker is assigned the independent held-out check (assignment 7).
- **ba68** (shipped code, 5 rivals, Easy ladder cell): 74.7%, against 74.4% for the research code. The table now shows 75%.
- **Queued ba69:** 2 rivals with `noPlanFirst` (v4/v3/fixed, seed 470000). It gives the numbers for the open choice of applying the rule only with 3+ rivals.

### 03:30 — 2 rivals without planning first (ba69, seed 470000)

Old-scale offsets (−1/0/+1/+2), with App edges from ba34:

| Offset | best fixed | v4 | edgeX |
|---|---|---|---|
| −1 | 70% | 89% | −0.50 |
| 0 | 49% | 84% | −0.05 |
| +1 | 35% | 77% | +0.08 |
| +2 | 23% | 66% | +0.12 |

- So with 2 rivals the v0.4.x Planning order matches App rivals' skill response.
- With planning first (shipped), 2-rival edgeX is −0.68 to −1.06: strong play is under-rewarded. For example, at shipped Standard v4 wins 78% and the best fixed policy 64%.

**Option B for the user (not built on main):** planning first only with 3+ rivals.
- 2-rival games would play as v0.4.1.
- The cost: 2-rival levels need their own offsets (the v0.4.1 scale, Easy −1 … Expert +2), and the rule and difficulty table get a rival-count condition.

### 04:50 — Independent check by the player-bot agent: PASS

**Setup:** seed 490000, shipped code (byte-identical to main), jobs `pb_c1`–`c3`, 360 per cell. I re-ran `final_eval.py` on its files and the numbers match.

**X35 by level** (Easy / Standard / Hard / Expert):

| Run | Easy | Standard | Hard | Expert |
|---|---|---|---|---|
| Independent (490000) | −0.64 | −0.47 | −0.23 | −0.13 |
| Pooled with mine (470000) | −0.78 | −0.41 | −0.15 | −0.12 |

- No level with 3–5 rivals is above +0.2. The highest pooled cell is Hard with 5 rivals, at +0.10.
- The worker's re-fit simple human also stays below App's edge at every level.
- v4 beats v3 on these fresh seeds by +1 to +4 points at the paper levels and +5.7 at App.
- One stall in 34,560 games, again at 5 rivals Easy: the known crowded-table case.

**Correction from the worker on the neural-network player:** the full headroom data (648 decisions) shows a small real gain over v3's placements, +0.013 win probability per decision (±0.008). Reopening it would need new data against v0.5.0 rivals; this is left for the user.

### 07:20 — User decision: keep A; win table

**The user keeps A:** rivals plan first at every table size. Option B (3+ rivals only) is closed.

**Win % by level and rival count** (shipped v0.5.0 code; seeds 470000 and 490000 pooled, about 720 games per cell, roughly ±3–4 points):
- *Strong* = the better of the two tuned test players in that cell (v4 or the worker's pb5).
- *Simple* = always going for Domination (the best of the three fixed policies in every cell).

| Rivals are | 2 rivals | 3 rivals | 4 rivals | 5 rivals |
|---|---|---|---|---|
| Fair share | 33 | 25 | 20 | 17 |
| App rivals | 69 / 30 | 47 / 18 | 39 / 13 | 34 / 12 |
| Easy | 94 / 83 | 94 / 80 | 91 / 77 | 94 / 78 |
| Standard | 82 / 63 | 75 / 46 | 64 / 34 | 59 / 31 |
| Hard | 69 / 43 | 52 / 23 | 39 / 16 | 27 / 8 |
| Expert | 52 / 25 | 35 / 13 | 22 / 7 | 15 / 4 |

Sources: `ba67`, `ba34`, `pb_c1`–`c3`, `pb_e1`, `pb_e2`.

### 09:05 — v0.5.1: fixes for GPT's v0.5.0 audit

- **G1, empty-board stall:** new paper rule, Empty Earth. With no species on Earth, a rival's Abundance may use any empty corner (top-left first). All three known stalls (200074; 3880523955 in `pb_c1`; 3722144011 in `ba67`) had no species and no disks, and now reach Ice Age on turns 9, 10 and 18.
- **No other change to the measurements:**
  - ladder replay of all 5,760 paper games under both rules (`bb02b_*`, `--detail`, `noEmptyEarth` for the old side): 6 games differ, all through an empty Earth, 1 with a different winner. 3 rivals at Standard is now 32% (114/360); the old side reproduces all 16 published cells;
  - anchor 745/269 with and without the rule (`bb01`, `bb02`);
  - tuned evaluations on 470000 and 490000 (`bb03`, `bb04`): every win count matches except one majority win at Easy; X35 unchanged.
- **B1/B2:** `tune.cjs` rejects repeated rival counts and mode aliases; `final_eval.py` prints X35 only with 3, 4 and 5 present.
- Details: `AUDIT_RESPONSE_v0.5.0.md`.

### 12:15 — v0.5.2: board order (GPT's v0.5.1 re-audit, E1)

- **Defect:** printed ties say "top-left", but the app broke corner ties by the text of the "x,y" keys, the Empty Earth and Habitat fallbacks took storage order, and Migration broke equal origins by tile placement order.
- **Fix:** one board order, furthest left then highest, for corners and origins as for tiles. It is in `pBy`, the two fallbacks, Aquatic's corner, Blight's kept disk and Migration's origin. `oldCornerOrder` restores v0.5.1 (anchor 745/269, `bd01`).
- **Ladder** (`bd10`–`bd25`): most games change path. Pooled, every level is slightly harder (Easy −0.3, Standard −1.4, Hard −1.6, Expert −1.5 points). 13 of 16 cells move, by −7 to +4. No stalls.
- **X35** (`bd30`/`bd31`), Easy / Standard / Hard / Expert:
  - 470000: −0.88 / −0.38 / +0.03 / −0.11;
  - 490000: −0.67 / −0.43 / −0.24 / −0.07.
  - All inside +0.20. Hard at 470000 is the closest; its 5-rival cell alone is +0.31.
- **GPT's fresh v0.5.1 Hard:** −0.51 (−0.76 to −0.20).

### 12:10 — v0.5.2 best-against-best check (pb5 added)

- The player-bot agent's re-tuned player (pb5) was run on v0.5.2 with the same seed blocks (`bd40` 470000, `bd41` 490000, paper levels; its App rows from `pb_e2`/`pb_e1`, since App rivals are unchanged).
- **Best against best** = the strongest paper edge of v4, v3 and pb5, minus the strongest App edge of the three. X35, Easy / Standard / Hard / Expert:
  - 470000: −0.20 / −0.15 / +0.06 / 0.00;
  - 490000: −0.03 / −0.17 / −0.09 / +0.10.
- **No level is above +0.20.** Single cells vary more: Hard with 5 rivals at 470000 is +0.31, and Easy with 5 rivals at 490000 is +0.94 (Easy sits near the ceiling, at 93% for pb5, where log-odds are noisy).
- pb5's pooled paper win %, Easy / Standard / Hard / Expert: 92.5 / 69.6 / 45.1 / 29.4 at 470000 and 93.0 / 71.8 / 47.7 / 29.0 at 490000.

### 12:25 — Test: ties that include you go to the rivals (not adopted; the user's call)

- **Rule tested:** if you tie a rival for the most matches on a tile, the highest rival in the tie is dominant (today no one is). Test-only switch `PAPER.tieToRival`, on branch `claude/tie-test` (1578c17), not on main.
- **Runs:** `bd50` (470000) and `bd51` (490000), the `bd30`/`bd31` commands with the switch on, so the same seeds and v0.5.2 rules otherwise.
- **Win %, pooled over both blocks** (2,880 games per level), v0.5.2 → with the rule:

  | Level | Tuned v4 | Card-chaser | Majority | Expansion |
  |---|---|---|---|---|
  | Easy | 87.4 → 85.0 | 78.8 → 75.2 | 61.8 → 58.5 | 55.2 → 52.3 |
  | Standard | 64.8 → 60.6 | 42.9 → 38.8 | 23.4 → 22.4 | 24.1 → 21.5 |
  | Hard | 43.6 → 41.1 | 21.5 → 19.9 | 10.3 → 10.1 | 10.1 → 9.3 |
  | Expert | 27.6 → 28.7 | 10.5 → 11.5 | 5.2 → 5.6 | 5.3 → 6.1 |

- **Reading:** 2–4 points harder at Easy and Standard, about 2 at Hard, nothing at Expert (the small rise there is noise). A level step is 15–25 points, so this is a fraction of a level.
- **Effect on strong play:** it does not widen the strong player's edge. X35 Easy / Standard / Hard / Expert is −0.70 / −0.45 / −0.17 / −0.05 at 470000 and −0.86 / −0.42 / −0.43 / −0.36 at 490000.
- **Stalls:** one game hit the 30-turn cap (5 rivals, Hard, 490000).

### 12:56 — Test: why 5 rivals is easier than 4 at Easy (diagnosis only; no rule change)

- **Question:** the v0.5.2 ladder has Easy at 56% with 4 rivals but 75% with 5, and Standard at 21% against 25%.
- **Runs:** `be01`–`be08`, the ladder commands for 4 and 5 rivals at every level with `--detail` (seed 200000, 360 games a cell). The win counts match the published ladder exactly.
- **Per game, paper rivals (pawn actions and VP are per turn and per game means):**

  | Level | Rivals | Win % | Turns | Your pawns / turn | Pawns / rival / turn | Your VP | Best rival VP | Your share of all VP |
  |---|---|---|---|---|---|---|---|---|
  | Easy | 4 | 55.6 | 5.9 | 4.25 | 2.41 | 148 | 122 | 30% |
  | Easy | 5 | 74.7 | 6.3 | 3.24 | 1.32 | 129 | 83 | 34% |
  | Standard | 4 | 21.4 | 5.8 | 4.21 | 3.45 | 114 | 151 | 20% |
  | Standard | 5 | 24.7 | 5.9 | 3.19 | 2.34 | 92 | 122 | 18% |
  | Hard | 4 | 10.8 | 5.9 | 4.22 | 4.54 | 105 | 160 | 17% |
  | Hard | 5 | 7.2 | 5.8 | 3.19 | 3.39 | 79 | 135 | 14% |
  | Expert | 4 | 3.6 | 5.7 | 4.21 | 5.54 | 93 | 157 | 15% |
  | Expert | 5 | 3.9 | 5.7 | 3.17 | 4.42 | 70 | 136 | 12% |
  | App | 4 | 9.4 | 7.4 | 4.20 | 4.34 | 108 | 153 | 18% |
  | App | 5 | 7.8 | 8.0 | 3.14 | 3.26 | 86 | 133 | 14% |

- **Cause: the level is a flat pawn change on a base that shrinks with the table.** Setup gives each animal 4 pawns with 4 rivals and 3 with 5. Easy's −2 leaves a rival 2 pawns (half of yours) with 4 rivals but 1 (a third of yours) with 5. Five Easy rivals place about 6.6 pawns a turn between them, fewer than four Easy rivals (9.6).
- **Not game length:** 6.3 turns against 5.9.
- **Not rival behaviour:** at the same pawns per rival, 5 rivals is much harder than 4: 2 pawns each, 56% (4 rivals, Easy) against 25% (5, Standard); 3 each, 21% (4, Standard) against 7% (5, Hard). Indexed by rival pawns ÷ your pawns, the 5-rival cells sit at or below the 4-rival line (at 2/3, about 33% interpolated for 4 rivals against 25% for 5).
- **Standard's 21 against 25** is about 1.3 standard errors, so within noise; the same cause in a milder form (rivals at 3/4 of your pawns with 4 rivals, 2/3 with 5).
- **Easy with 5 rivals stops rewarding play:** card-chaser 76%, expansion 72%, majority 77%. With 4 rivals the card-chaser leads, 70% against 48–49%. It is also the cell where pb5 reached 93% (log above).
- **Blocking:** more blocking would not fix this cell, since one-pawn rivals have little to block with. Earlier blocking variants (`ba06` blockHuman: no effect; `ba04` holdYou: dropped for rivals planning first) were tested at Hard before planning-first. The `blocks` column counts only the app bot's denial placements, so it is zero for paper rivals by construction.
- **Options for the user:** leave it (the printed table already shows 75%), or make Easy scale with the table, for example with 5 rivals Easy = rivals −1 and you +1 pawn (2 against 4, the 4-rival ratio). A change would need a branch test, then the ladder row, the printables and the app's level; it would ship after GPT's v0.5.2 audit.
