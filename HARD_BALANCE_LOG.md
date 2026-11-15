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
- Combinations of a turn-order rule and a Domination rule.

## GPT v0.4.1 follow-up audit (ba1c69e): pass for playtesting

- **R1 (low):** Help states the new cone tie-break in a resumed legacy save. Fix: say it applies to new Paper games, and show a one-line notice for legacy saves.
- **R2 (low):** a v0.3.6 Easy save re-exported by v0.3.9 shows Unknown. Fix: recover the unique −1 endpoint for pre-tie saves.
- **R3 (medium):** an evaluator label collision. The player-bot agent fixed it in `tune.cjs` on its branch (6104ce5); merge that.
- **Documentation:** the safest input is the original export; intermediate re-exports can lose their origin.
- **Wording:** "won 30% versus 25% in this sample."

## Jobs and results

(PC prefix `ba`, which sorts before `pb_`.)
