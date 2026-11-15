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
