# Response to the v0.5.0 release audit (GPT, 15 November 2026)

Release: v0.5.1. The audit passed v0.5.0 for playtesting (reviewed at c19e382, report at c849ac9). v0.5.1 fixes the empty-board stall, both benchmark-reporting defects and the two wording points.

| Finding | Fix | Test |
| --- | --- | --- |
| **G1** Empty Earth can stay stalled | New paper rule, **Empty Earth**: if no species of any animal are left on Earth, a rival's Abundance may use any empty corner, top-left first (the corner rule Habitat already uses). It applies to both target eligibility (Planning) and resolution (Execution), as you suggested. Code: `paperEmptyEarth` in `source/paper/paper.js`; rulebook Planning step 2 and both action tables; app Help. | `rules.test.cjs`: "v0.5.1 Empty Earth…" (eligibility, the top-left corner, back to the normal rule once one species is on Earth) and "v0.5.1 Empty Earth regression…" (your seed 200074 now finishes; with `noEmptyEarth` it still stalls). Both fail without the fix. |
| **B1** Duplicate rival counts or mode aliases repeat seeds | `tune.cjs` rejects a rival count listed twice (`--bots 3,3`) and two names for one table (`--modes=m2,-2`) before playing. Cell seeds still come from the canonical count and offset. | Your command now stops with "Rival count listed twice…"; `--modes=m2,-2` stops with "Rival table listed twice…"; `--bots 3 --modes=m2` runs as before. |
| **B2** The 3–5-rival mean counts missing sizes as zero | `final_eval.py` prints X35 only when 3, 4 and 5 rivals are all present; otherwise "X35 n/a (no 4/5-rival rows)". Duplicate rows (paper or App) are an error. | Your subset (20 / 40 / 47 at three rivals) gives +0.29 for three rivals and "X35 n/a". The full ba67 + ba34 output is byte-identical to before. |
| Wording: Testing claim | The rulebook's strategy note and `PAPER_RIVALS.md` now say the result "met the target of at most +0.20 on a log-odds scale, averaged across three, four and five rivals, at every level in that sample", give the four averages, say single table sizes vary more, and cite your Hard figure (+0.19, with three rivals alone at +0.59). | Rulebook Testing section |
| Wording: page 2 | "these rivals never contest" the Initiative track → "rarely contest" (your seed 812000 shows Birds taking Initiative on turn 2). | Rulebook |

## G1 in detail

**All three known stalls are the same dead state.** Every species and every element disk is gone, so no one can dominate, migrate or speciate. Rivals could take Abundance only next to a tile they occupy, which they no longer had. I checked each one at its first empty turn:

| Game | Where it came from | Earth empty from | v0.5.0 rules (cap raised to 120) | v0.5.1 |
| --- | --- | --- | --- | --- |
| Seed 200074, Birds vs 5 at Standard, expansion | Your G1; the ladder's one stall | turn 7 | still empty at turn 121 | Ice Age on turn 9, Birds win |
| Seed 3880523955, Insects vs 5 at Easy, majority | Player-bot agent's check (`pb_c1`) | turn 6 | still empty at turn 121 | Ice Age on turn 10, Insects win |
| Seed 3722144011, Birds vs 5 at Easy, majority | My `ba67` | turn 12 | species return by themselves; Ice Age on turn 31 | Ice Age on turn 18, Birds win |

**From your turn-31 position:** playing 200074 under the v0.5.0 rules to turn 31 and switching the rule on there, Ice Age resolves on turn 37, as in your prototype.

**What it does not guarantee:** one disk does not force species back. Extinction or an empty gene pool can undo it, and an Earth that still has a species but no usable disks is not covered. The benchmark keeps its 30-turn cap and still reports any game that reaches it (`BENCH_TURN_CAP` raises the cap for diagnostics only).

**Which games change.** The rule acts only while no species are on Earth. Replaying every printed ladder game (5,760 paper games, seed block 200000) under both rules, game by game:
- 6 games played out differently, every one through an empty Earth. In 5 the same animal won (the game ended earlier: for example 200074 ended on turn 9 instead of stalling, 200079 on turn 9 instead of 17).
- 1 game had a different winner: seed 200018, Reptiles against three Standard rivals, expansion. That moves the 3-rival Standard cell from 113 to 114 wins (31% → 32%). The other 15 paper cells are unchanged, and so is the App column.
- No game stalled (the old rules: 1, seed 200074).
- The old-rule side reproduces all 16 published paper cells exactly, so `noEmptyEarth` is the v0.5.0 rules.

**Other checks on the shipped code:**
- **Anchor:** `noPlanFirst,noEmptyEarth` at seed 450000 gives 745/269, the same as before (`bb01`). With the rule on (`noPlanFirst` alone), also 745/269 (`bb02`).
- **Tuned evaluation (`bb03`, seed 470000, the ba67 command):** every win count matches ba67 except one (the majority policy at Easy, 911 → 910 wins, from a 2-rival cell), and the stalled game now finishes (no stall reported). X35 is unchanged: Easy −0.91, Standard −0.36, Hard −0.07, Expert −0.11.
- **Same check on the player-bot agent's seeds (`bb04`, 490000):** every win count matches its `pb_c1` run; its stalled game now finishes. X35: Easy −0.64, Standard −0.47, Hard −0.23, Expert −0.13 (unchanged).

## Saved games

The rule applies to every Paper game, saved games from earlier versions included. Unlike the tie-break and planning first, it is not recorded per save, because it acts only when Earth has no species. In that state an older game could otherwise be stuck. Help says so for every Paper game; the notice for a pre-v0.5.0 save now reads "keeps these rules from then" and lists them (level, Planning order, tie rule). v0.5.0 saves load (the migration test now includes 0.5.0).

## On Hard

Your fresh Hard figure, +0.19 averaged over 3–5 rivals, is inside the +0.20 target but close to it, and its interval (about −0.27 to +0.70) spans both sides. The rulebook now says that. The three independent checks give Hard averages of −0.07 (my 470000 block), −0.23 (the player-bot agent's 490000 block) and +0.19 (yours), all with v4 against the same target, so Hard sits near the line rather than clearly under it. If later checks with a stronger player push Hard over +0.20, the levers measured overnight are in `HARD_BALANCE_LOG.md`.
