# Response to the v0.4.1 follow-up audit (GPT, 14 November 2026)

Release: v0.5.0. The audit passed v0.4.1 and left the Hard balance question open. v0.5.0 answers that question with a rule change (below) and fixes the three follow-ups.

| Finding | Fix | Test |
| --- | --- | --- |
| **R1** Help states the new cone tie-break in a resumed legacy game | Help now says the tie-break applies to Paper games started in v0.4.0 or later, and that rivals plan first in games started in v0.5.0 or later. A resumed older Paper game gets a one-line notice: its level and saved pawn offset, that rivals place in normal Initiative order, and, for games started before v0.4.0, that a tie between rivals leaves the tile with no dominant animal. | `source/browser_restart_test.py` opens Help on a v0.3.6 Standard save (notice with "Standard (+0 pawns per rival)"), a v0.4.1 Hard save (notice) and a new game (no notice). |
| **R2** A v0.3.6 Easy save re-exported by v0.3.9 asks for a level | Before v0.4.0, −1 existed only on the v0.3.6 scale (Easy) and +3 only on the v0.3.7–v0.3.9 scale (Expert). These two endpoints are now recovered first, whichever version saved the file last. | `rules.test.cjs` "R2: an Easy save re-exported by v0.3.7–v0.3.9…". It fails on v0.4.1 and passes now. The browser restart test adds your case (v0.3.9 save at −1 → Easy). |
| **R3** A comparison label can overwrite results | The player-bot agent's fix: `tune.cjs --evaluate` rejects duplicate labels and labels that are table fields before playing (49f243a, merged). | Your command now stops with an error naming the label. |
| Known limitation | `PAPER_RIVALS.md` now says that the original export is the safest input. An intermediate v0.3.7–v0.3.9 re-export of a v0.3.6 Standard game is identical to a native Easy game and is read as Easy. | — |
| Wording | The rulebook's strategy note was rewritten for v0.5.0 with the new measurements. Every figure is given as "in this sample" with its size. | Rulebook Testing section |

## The Hard question

Your interval for the Hard excess (−1.8 to +21.8) didn't settle it. A matched run did.

**The matched run (`v4_hardapp`).**
- Setup: seed 450000, 1,440 paired games per level, the re-tuned player v3 against the card-seeking policy.
- Result: v3 led by +33.1 points at Hard and +22.8 against App rivals, so Hard minus App was **+10.3** (about 6–15).
- On the log-odds scale, the excess wasn't Hard-specific. Paper rivals were more exploitable than App rivals at every level with 3–5 rivals; with 2 rivals they matched.
- The ablations put the excess in turn order and Domination play together. Paper rivals never contested the Initiative track, so a player who stayed first got first pick of the action display every turn.

**What was tried overnight.** Twenty-plus rule candidates on the same tables (log: `HARD_BALANCE_LOG.md`):
- Domination-timing and blocking rules did nothing.
- Card rules did nothing, and choosing the tile with the most VP over you backfired.
- Blocking the player on the Initiative track halved the excess.
- **Rivals plan first** removed it: at the start of each Planning, each rival places one pawn, in Initiative order, before anyone else.

**The check.**
1. The test player was re-tuned against the new rule (v4, 39 generations from v3).
2. It was evaluated on an untouched seed block (470000) against all three fixed policies, at paper levels and against App rivals on the same block.
3. In that sample (1,440 games per level), at every level with 3–5 rivals, its log-odds lead over the best fixed policy was no larger than its (or v3's) lead against App rivals: −0.37, −0.07, −0.11 and −0.22 at −1, 0, +1 and +2. Those are the old scale's offsets; the shipped levels are −2 to +1, and the shipped Easy (−2) was checked separately (see the log).
4. The re-tune gained more against App rivals (+4.2 points) than against paper rivals (−0.2 to +3.1), so it found no new paper-specific hole.
5. With 2 rivals a strong player's lead is now *smaller* than against App rivals. That is a cost of keeping one printed rule for every table size, not an exploit.

Rivals that plan first are stronger, so the levels moved down again. See the changelog and the rulebook's difficulty table.

Still open: physical play, the d8 variant and the two-human variant.
