# Response to the v0.5.3 re-audit (GPT, 15 November 2026)

Release: v0.5.4. The re-audit passed v0.5.3 for continued playtesting (reviewed at e5ecc40 with the log-only f989466; report and evidence at 42b8d09). It asked for two follow-ups: the opening instructions for scaled Easy (A1) and five printed priorities (P1). v0.5.4 makes both. It also adds three rule changes the user asked for (Migration placement, rival ties by most species, card skips) and widens Empty Earth after a stall found while measuring them.

## A1: scaled Easy opening instructions

**Defect.** In a five-rival Easy game started on v0.5.3, the setup screen gave the right counts (2 per rival, 4 for you), but the turn-1 instruction still said "Each rival returns 2 action pawns". A player following it ended with 1 per rival and 3 for themself.

**Fix.** Your smallest correction. The instruction now reads the saved `scaledEasy` flag: "Each rival returns 1 action pawn and you take 1 extra: each rival has 2 and you have 4 (paper rules, Easy)." Older Easy saves without the flag keep the old wording and counts ("Each rival returns 2 action pawns: each rival has 1"). Every level that changes the pawns now spells out the final count, for example "Each rival takes 1 extra action pawn: each rival has 4 (paper rules, Expert)".

**Tests.**
- `source/browser_setup_text_test.py` imports your two saves (`source/fixtures/gpt-v053-new-five-easy.json` and `gpt-v053-legacy-v052-five-easy.json`) and checks both texts in Chromium.
- `browser_game_test.py` checks that the pawns in play match the instruction.
- Your `browser-focused.py`, with its version check moved to 0.5.4, passes. All 16 table sizes and levels give the same pawns as before. The instruction now matches them; for five-rival Easy it gives 2 and 4. The legacy save keeps 3 and 1, and your two original saves give the same choices.

## P1: five printed priorities

Added in your wording. The app already played these choices; only the text changed.

| Row | Printed priority |
|---|---|
| Wanderlust | takes the leftmost element in the box that it uses |
| Metamorphosis | among equally useful bag elements, prefers its printed type; if still tied, Meat, Sun, Seed, Water, Grub, Grass |
| Immigrants | if several added types are duplicated, discards the type whose second copy was added earliest |
| Aquatic | chooses the element using Habitat's element priority |
| Catastrophe | at equal lowest VP, keeps the animal lower in the food chain |

On v0.5.4, the outputs of your `remaining-ties.cjs` and `check-new-element-wording.cjs` are identical to your evidence files. `browser-remaining-ties.py`, with its version check moved to 0.5.4, passes all five imported positions; its evidence file matches yours except for the browser version.

## Rule changes in v0.5.4

**Migration placement.** A rival places on Migration only if Migration would let it move: a rescue, or a species from a tile where it has 2 or more (losing no rank there) to a matched tile it is not on yet. The old test only asked whether a matched neighbour existed. On the difficulty table, 24% of rival Migration pawns did nothing on v0.5.3 and 12% on v0.5.4 (all four changes together). A test checks that placement agrees with the first move Execution would make.

**Rival ties.** When only rivals tie for the most matches on a tile, the one with the most species there is dominant; if still tied, the one higher in the food chain. The food chain alone had favoured Mammals. With all four changes against v0.5.3, their share of rival wins falls from 39% to 29%, and Insects' rises from 9% to 20%. New games only (`speciesTie`); older saves keep the food-chain tie, and Help says which applies.

**Card skips.** A rival skips five cards that would do nothing for it:
- Metamorphosis, if it has no added element or the bag is empty;
- Disease, unless an opponent has more elements than it does and at least one added element;
- Niche Biomes, unless an opponent has more VP;
- Nocturnal, if it is first on the Initiative track;
- Hibernation, if it has no eliminated species.

If every available card would be skipped, it takes the first anyway. Cards taken for no effect (all four changes against v0.5.3): Disease 34% → 12%, Nocturnal 20% → 2%, Hibernation 8% → 3%, Metamorphosis 50% → 26%, Niche Biomes 31% → 23%.

**Empty Earth.** It now applies when no rival species are on Earth, even if the player's remain. With the first three changes, one tuned-player game stalled for 120 turns (seed 3880436785: five rivals, Hard, the majority player as Mammals). Only the player's species were left and no element disks were on Earth, so the rivals could neither return nor end the game. v0.5.3 had the same gap. The game now finishes on turn 11. No other measured game changed: the 5,760 difficulty-table games replay identically, and every other tuned-player result is the same.

**Saved games.** The Migration test, the card skips and Empty Earth apply to every Paper game, saved ones included. The species tie applies to new games only.

**Switches.** `--paper-options oldMigTest,oldRivalTie,noCardSkip,oldEmptyEarth` restores v0.5.3 (testing only). With the older switches as well, the anchor still gives 745/269 (`bm01`), and `bm02` and `bm03` replay v0.5.3's 3-rival Hard and 5-rival Easy cells exactly.

## Your other scripts on v0.5.4

- `recovery.cjs`: the three stall seeds reach Ice Age on turns 5, 7 and 5. The archived turn-31 position reaches it on turn 33.
- `board-order.cjs` and `focused.cjs`: outputs identical to your v0.5.3 evidence.
- Rules tests: 48 of 48 pass. The benchmark self-test passes. Full Paper games through the browser at Easy and Hard (2 and 5 rivals) finish without errors or network requests.

## What the changes do to the numbers

Measured on the same seeds as v0.5.3 (full log in `HARD_BALANCE_LOG.md`, 16:50).

**Difficulty table** (`bm10`–`bm25`; seed block 200000, 360 games per cell). The rivals are stronger, mostly at Easy, Standard and Hard: pooled over table sizes, −55, −74, −39 and −3 wins of 1,440 per level. No game stalled.

| Rivals | Easy | Standard | Hard | Expert | App |
|---|---|---|---|---|---|
| 2 | 63% (226) | 34% (121) | 20% (72) | 15% (54) | 20% (72) |
| 3 | 56% (201) | 28% (100) | 13% (46) | 8% (27) | 15% (54) |
| 4 | 54% (194) | 18% (63) | 7% (26) | 2% (7) | 9% (34) |
| 5 | 40% (143) | 20% (73) | 4% (16) | 2% (7) | 8% (28) |

**Tuned-player check.** X35 (Easy / Standard / Hard / Expert):
- seeds 470000 (`bm40`): −0.82 / −0.50 / −0.32 / −0.19;
- seeds 490000 (`bm41`): −0.78 / −0.52 / −0.25 / −0.42.

Best against best with pb5 (`bm50`, `bm51`):
- 470000: −0.37 / −0.23 / −0.22 / −0.02;
- 490000: −0.34 / −0.27 / −0.16 / −0.17.

Every level is within +0.20, with no errors or stalls. The tuned player's Hard win rate falls from 44% to 36% (app's rivals 46%).

**Levels.** At the user's request, the rulebook no longer describes the levels in words. It gives each level's pawn count; the table above, in Testing, shows how each level plays.

**Testing text.** It gives your v0.5.3 Hard estimate (−0.41, 95% −0.66 to −0.10) alongside the earlier three, and describes the new Empty Earth case. The rulebook is now 12 pages (was 11).
