# Response to the v0.5.1 re-audit (GPT, 15 November 2026)

Release: v0.5.2. The re-audit passed v0.5.1 for continued playtesting (reviewed at dec3a3b, report at 9202cf6) and confirmed one defect, E1. v0.5.2 fixes it, and fixes it everywhere the same cause applied, not only in the two places named.

## E1: "top-left" was not the order the app used

**Scope.** You traced Empty Earth and Habitat's fallback to storage order (`activeCorners`). The same mismatch was in every paper corner tie-break: `pBy` ends each tie on a string comparison, and corner keys are "x,y" coordinates, so ties between corners went by the text of the coordinates ("-10,-4" before "-11,-3"), not by board position. That reached ordinary Abundance, Depletion, Speciation's disk, Wanderlust's element corner and Habitat. Aquatic's corner and Blight's kept disk also took the first corner in storage order, and Migration broke ties between equal origins by the order tiles were placed (`occupied` follows insertion order). So I fixed the order once rather than in two fallbacks.

**One convention, stated in print.** The Ties entry in Terms now defines **board order**: the tile, corner or empty spot furthest left on the board, and of those the highest; for tiles this runs down the leftmost column, then the next column. That is the order tiles have always been broken in (ids A1, A2 … B1 …, which run by column, then top to bottom). Your proposal, uppermost then leftmost, would have given corners one order and tiles another, or changed every tile tie as well, so I used the tiles' order for corners. Your `empty-earth.cjs --assert-top-left` passes on v0.5.2 (no vacant corner strictly above and left of the choice) once line 129 is removed: that line asserts the v0.5.1 defect itself (that −10,−4 lies above and left of the choice), so it can only pass on the old code. Every rule that named "top-left" now says "board order": Empty Earth, Habitat's fallback, Evolution's tie, and Aquatic's corner (which named none before).

**Code.** `paper.js`: `pPlaceCmp` compares corner keys as numbers (x, then y) and everything else as before; `pBy` uses it, and then orders Blight's kept disk and Migration's origin; `pBoardOrder` orders the Empty Earth and Habitat fallback lists; `pFreeCorner` picks Aquatic's corner. `--paper-options oldCornerOrder` restores the v0.5.1 tie order exactly (testing only).

**Tests** (`rules.test.cjs`, expected corners computed by parsing the coordinates, never from storage order):
- "v0.5.2 board order…": string order would pick "-10,-4", board order picks "-11,-3"; tiles A1 before A3 before B2; Aquatic's free corner on every tile of a fresh board; Blight's kept disk; Migration's origin; the testing switch.
- "v0.5.1 Empty Earth…": your `v050-empty-abundance` fixture (copied to `source/fixtures/`, log stripped). Storage order and board order differ there; Mammals' Abundance and Habitat's fallback both take the board-order corner; after it is filled, the next rival Abundance takes the next one.
- "v0.5.1 Empty Earth regression…": with `oldCornerOrder`, seed 200074 still follows the audited path (stalls without Empty Earth, finishes with it); your archived turn-31 position reaches Ice Age under the v0.5.2 rules.
- Both new tests fail with the old order restored.

**Through the app:** your `browser-empty-earth.py`, run against the v0.5.2 build (version strings updated) with one added assertion that the placed corner is the board-order first vacant corner, passes for all three fixtures. Mammals now place Grub on A1 corner 4 (−11,−3), the left tip of A1; the v0.4.1 and v0.3.9 fixtures take C3 corner 4 (−5,−1). Preview, apply, Undo/Redo, reload and export/import are exact; no page errors or network requests.

**Recovery, rechecked:** under v0.5.2 the three recovery seeds no longer reach an empty Earth at all (most games take a different path, see below): 200074 ends on turn 6, 3880523955 on turn 6, 3722144011 on turn 21, all with Ice Age. Your archived turn-31 position reaches Ice Age (regression test). With `oldCornerOrder`, seed 200074 still stalls without Empty Earth and finishes with it.

## What the change does to the numbers

Board order decides many ordinary ties from turn 1, so most test games now play out differently from v0.5.1 even though the rules differ only in tie-breaks. Measured on the same seeds:

- **Anchor:** with `noPlanFirst,noEmptyEarth,oldCornerOrder` the v0.4.x anchor (seed 450000, v3 vs dominance at Hard) gives 745/269, as before (`bd01`), so the switch restores the old tie order exactly.
- **Difficulty table** (`bd10`–`bd25`, seed block 200000, 360 games per cell): most games take a different path from turn 1 (in a first board-order build, 346 of 360 games in the 3-rival Standard cell played out differently, yet wins went only from 114 to 117). Pooled over table sizes every level is slightly harder than v0.5.1: Easy −0.3, Standard −1.4, Hard −1.6, Expert −1.5 points (−4, −20, −23, −21 wins of 1,440). 13 of 16 printed cells change, by −7 to +4 points; the largest are Hard with 3 rivals (21% → 14%), Easy with 3 rivals (56% → 60%) and Expert with 2 rivals (16% → 12%). Hard still sits with the app's rivals (24/14/11/7% against 20/15/9/8%), so the level descriptions stand. No game stalled. The App column is unchanged (App rivals do not use these rules). Percentages are rounded half up; no cell is at an exact half.

  | Rivals | Easy | Standard | Hard | Expert | App |
  |---|---|---|---|---|---|
  | 2 | 64% (230) | 41% (146) | 24% (85) | 12% (44) | 20% (72) |
  | 3 | 60% (217) | 33% (119) | 14% (50) | 7% (26) | 15% (54) |
  | 4 | 56% (200) | 21% (77) | 11% (39) | 4% (13) | 9% (34) |
  | 5 | 75% (269) | 25% (89) | 7% (26) | 4% (14) | 8% (28) |

- **Tuned-player check** (`bd30`, `bd31`: v4 against the three fixed policies; App files unchanged, since App rivals do not use these rules): X35 Easy / Standard / Hard / Expert = −0.88 / −0.38 / +0.03 / −0.11 on 470000 (v0.5.1 gave −0.91 / −0.36 / −0.07 / −0.11) and −0.67 / −0.43 / −0.24 / −0.07 on 490000 (v0.5.1: −0.64 / −0.47 / −0.23 / −0.13). All within +0.20. Hard on 470000 is the closest; its 5-rival cell alone is +0.31. On Hard, v4 won 43.9% and 43.4% (v0.5.1: 44.8% and 42.6%). No errors or stalls.

## Other points

- **Hard and the target.** The Testing section now gives both independent estimates beside mine: your v0.5.0 audit's +0.19 and your v0.5.1 re-audit's −0.51 (95% about −0.76 to −0.20), with the sample each came from.
- **Saved games.** Board order applies to every Paper game, saved ones included, like Empty Earth: it changes which of several equal choices a rival takes, which the printed rule already specified. v0.5.1 saves load (migration test updated).
- **Your recommendations 2 and 3** (keep the uniqueness checks, exact counts beside rounded rates, capped games visible; tie the Testing claims to named samples): kept. `PAPER_RIVALS.md` now gives exact wins out of 360 beside each printed percentage.
- **Open wording point (not changed in v0.5.2).** Ties puts "the higher first-place value" before board order. Ordinary Abundance and Habitat do use the highest first-place value among the tiles a corner touches before board order. Depletion and Wanderlust's element corner go from their printed counts straight to board order, and Speciation's disk uses the sum of first-place values of the tiles it matches. For corners the printed step is ambiguous (a corner has no first-place value of its own). I'd settle it by naming the corner rule in each row rather than changing play; flag it if you read it differently.
