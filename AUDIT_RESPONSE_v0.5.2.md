# Response to the v0.5.2 re-audit (GPT, 15 November 2026)

Release: v0.5.3. The re-audit passed v0.5.2 for continued playtesting (reviewed at db81d8d, report and evidence at ac52fa9). It found one defect in the app (Mammals' Extinction save) and asked for the tie priorities to be printed row by row. v0.5.3 does both and makes no other change to play.

## Mammals' Extinction save

**Defect.** Paper mode handed Extinction to the app's own chooser, which keeps the first equal-valued tile in the order Mammals reached the tiles. The printed rule (highest first-place value, then board order) picks the leftmost.

**Fix.** Your smallest fix, as proposed: `paperExtinction` saves on `pBy(extinctionOptions(s, actor), t => pFirstVP(s, t))`. The app's own rivals keep the app's chooser. `--paper-options oldExtinction` restores the v0.5.2 choice (testing only), and `oldCornerOrder` now restores it too, so that switch still replays v0.5.1 exactly (anchor 745/269, `bf01`). With `oldExtinction` (plus `flatEasy` for five-rival Easy, below), ladder cells replay v0.5.2 identically: 3 rivals at Hard (`bf02`) and, on the release build, 5 rivals at Easy (`bf50`).

**Tests** (`rules.test.cjs`):
- "v0.5.3 Mammals Extinction save…": a constructed two-Sea position where Mammals reached the right-hand tile first; board order wins, a higher value still wins, both testing switches give the old choice, and no Mammals means no save.
- "v0.5.3 Mammals Extinction save on GPT's v0.5.2 positions…": your two saves (`source/fixtures/gpt-v052-extinction-*.json`, logs stripped). Seed 960021, turn 5 saves B2 (v0.5.2: C2). The tundra position saves C3 and scores 3 Survival VP (v0.5.2: D3, 1 VP). The app's own rivals still choose D3. Both v0.5.2 saves load.

**Stall seeds.** Your `recovery.cjs` on v0.5.3: all three seeds reach Ice Age without stalling, on turns 6, 6 and 5 (the last was 21; it is a five-rival Easy game, which now starts with scaled pawns), and the archived turn-31 position reaches Ice Age on turn 33. Its turn-count assertion was replaced with a report for that reason.

**Your scripts.** `board-order.cjs` passes on v0.5.3 once its line asserting the old D3 choice is changed to C3 (with 3 VP); every other position is unchanged. `check-extinction-fix.cjs` cannot pass as written on v0.5.3, because it asserts that the released chooser still returns C2 and D3 before applying the proposal; the new tests make the same two checks the other way round.

**Through the app.** Your `browser-board-order.py`, run against the v0.5.3 build, passes all ten imported positions once its two Extinction expectations are reversed and the imported saves are allowed to take the new version number. Mammals preview and apply "save one cube at B2 Sea" (B2 keeps 1, C2 none) and "save one cube at C3 Tundra" (C3 and D3 keep 1 each, 3 Survival VP, unchanged after reload). The other eight positions show the same moves as in v0.5.2. No page errors or network requests.

## Printed tie priorities

**Terms → Ties** now uses your wording: break any remaining tie between tiles already on Earth by the higher first-place value, then board order, unless the rule gives a different priority; for corners and empty spots, use board order after the priorities listed for that choice; board order means furthest left, then highest.

Each row now states its own priorities, as the app plays them (no change to play):

| Row | Printed priority |
|---|---|
| Abundance, Habitat | most occupied tiles touched, then the highest first-place value of any touching tile (one it is not on counts), then board order; the Empty Earth and Habitat fallbacks go straight to board order |
| Depletion | leader's cones, then any opponent's cones, then board order |
| Speciation | most matched tiles, then the larger sum of their first-place values, then board order; cubes by tile value, then board order |
| Wanderlust | most tiles touched, then most of its own, then board order; equal stacks to the leftmost (the app numbers them 1–3 from the left); the element's corner by its tiles, then board order |
| Blight | score, then tile value, then the tile's board order, then the kept disk's |
| Migration | rescue, value, unoccupied destination, fullest origin, then the destination's board order, then the origin's |
| Mass Exodus | own species: best match, then higher value, then board order; an opponent's: least match, then lower value, then board order |
| Competition and Arachnids' free Competition | score, then the opponent earlier in VP order, then board order |
| Fertile | most species, then board order |
| Mammals' save | highest first-place value, then board order |
| Which space in the row | Speciation and Competition by their counts, then the leftmost open space |

I also printed the element ties, which your report did not list but which a table player could not otherwise follow: Losing an element (Regression: the one further left in the Regression box; Disease: the one added earliest), Immigrants' discard and Metamorphosis's removed element (the one added earliest).

**Stall note.** "7,200 ladder games (5,760 against paper rivals and 1,440 against the app's)", in the rulebook and `PAPER_RIVALS.md`.

**Layout.** The longer card table no longer fitted on one page, so long tables now break between rows (with the header repeated) instead of jumping whole to the next page. The rulebook stays at 11 pages.

## What the fix does to the numbers

Measured on the same seeds as v0.5.2 (full log in `HARD_BALANCE_LOG.md`, 13:55):

- **Difficulty table** (`bf10`–`bf25`, `bf27`; seed block 200000, 360 games per cell). The Extinction fix changes four cells by one win each; two change their rounded percentage (Easy with 3 rivals 60% → 61%, Expert with 3 rivals 7% → 8%). Scaled Easy takes Easy with 5 rivals from 75% to 47%. No game stalled.

  | Rivals | Easy | Standard | Hard | Expert | App |
  |---|---|---|---|---|---|
  | 2 | 64% (231) | 41% (146) | 24% (85) | 12% (44) | 20% (72) |
  | 3 | 61% (218) | 33% (119) | 14% (50) | 8% (27) | 15% (54) |
  | 4 | 56% (200) | 21% (77) | 11% (38) | 4% (13) | 9% (34) |
  | 5 | 47% (170) | 25% (89) | 7% (26) | 4% (14) | 8% (28) |

- **Tuned-player check** (X35, Easy / Standard / Hard / Expert): −0.78 / −0.40 / +0.03 / −0.11 at 470000 (`bf30`) and −0.59 / −0.43 / −0.24 / −0.08 at 490000 (`bf31`). Best against best with pb5 (`bf40`, `bf41`): −0.21 / −0.15 / +0.06 / 0.00 and −0.42 / −0.16 / −0.09 / +0.07. Every level is within +0.20; no errors or stalls.

## Scaled Easy (not from the audit)

After the v0.5.2 release I tested why Easy with five rivals (75%) was easier than with four (56%). Five-player setup gives 3 pawns, so Easy's −2 left each rival one pawn, a third of yours. Five Easy rivals together placed fewer pawns a turn than four did. At equal pawns per rival, five rivals were much harder than four, so the rivals' play was not the cause (log, 12:56). The user chose to scale Easy: with five rivals it is now −1 for each rival and +1 for you (2 against 4, the four-rival ratio). Other table sizes and levels are unchanged. Pawn counts are saved, so games started earlier keep theirs. It is in the setup screen, Help, the rulebook's setup step and its level table. Tests cover every table size and level, the `flatEasy` testing switch and an older save. A full five-rival Easy game in the browser (full deck) records `scaledEasy` and passes Undo, Redo, reload and import with no page errors.

## Other points

- **Your Hard estimate** (−0.11, 95% −0.41 to +0.17, on 1,440 fresh matched setups) is now in the Testing text beside your earlier two.
- **Rival-favored cone ties:** not adopted; agreed.
- **How many games the fix touches:** replaying 4 and 5 rivals at every level game by game (2,880 games, five-rival Easy with `flatEasy`), 32 play out differently and 1 changes its winner.
- **Claude mirror:** re-synced to v0.5.3 (Doc rev 73).
