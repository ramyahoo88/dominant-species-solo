# Response to the GPT v0.3.6 audit

The audit is `Dominant_Species_v0.3.6_Audit.pdf` (commit 67a6214, verdict HOLD). All eight findings were reproduced or confirmed by source, then fixed in v0.3.7. Every fix has a regression test. The printable materials it could not open are now in the repository.

| Finding | Fix | Regression |
|---|---|---|
| **A2** Partial Migration cannot be confirmed | The draft From/To pickers are optional (`forms.js` migrationForm); Add move still validates every move | `source/browser_migration_test.py` drives the real controls: add one move, then Confirm, and checks that it applies. It fails on v0.3.6 because `origin` is invalid |
| **A1** Evolution exceeds two opponents | The player form rejects more than two (`forms.js`); the app chooser takes `Math.min(2, pool)` (`effects.js`). The paper chooser was already capped | `rules.test.cjs` "GPT audit A1" (five opponents) |
| **P1** Paper previews omit choices | Every paper decision names its positions, elements, corners (with the tile and corner number), stacks, VP, moves, victims and pawn spaces (`paper.js`, `pAt`) | `rules.test.cjs` "GPT audit P1" (Abundance, Habitat), plus label samples in benchmark traces |
| **A3** Glaciation misses remote triple-tundra disks | `engine.js` glaciation scans every occupied corner and names remote corners by their tiles | `rules.test.cjs` "GPT audit A3" |
| **P2** Paper Instinct ignores next-turn spaces | It prefers a space that still runs this turn; otherwise it reserves one for next turn (except on the final turn) | `rules.test.cjs` "GPT audit P2–P4" |
| **P3** Paper Aquatic skips its element | If the bag has a disk and any sea or wetland tile has a free corner, only those tiles are candidates | same test |
| **P4** Wasteland tests contradict | Planning now asks the Execution question: does the box hold an element the rival uses? (answers **Q2**: protect displayed types). Rulebook target table updated | same test (both types agree) |
| **B1** Benchmark player ignores flat matching | `benchmark/load.cjs` adds a rules adapter: the pinned player keeps its strategy but uses flat matching (and so the rival's cones) for paper rivals. Checked on the audit's D4 fixture: match 2 and cone null, the same as the engine | The difficulty table was re-measured on fresh seed block 200000 (`source/paper/ladder.json`) |

**Also fixed while reproducing:**
- The player's Aquatic form now requires the element and corner when placement is possible.
- On the final turn, the player's Instinct form offers only spaces that still run.

**Printable materials (gap 1, Q1).**
- `source/paper/RULES.md` is the single source for the rules text.
- `python3 source/paper/printables.py --pdf` generates `paper/Paper_Rivals_Rulebook.{md,html,pdf}` and `paper/Paper_Rivals_Cards.{html,pdf}` (48 cards, one animal per page, dashed cut lines).
- Deck tables and cards are generated from `source/src/decks.js`, so they cannot drift from the app.
- The Claude Docs copy is now a mirror of these files.

**Questions.**
- **Q3:** the rulebook now says rivals never weigh rank gains when choosing a destination, but still avoid losing a rank where they leave. That matches `paperMigration`.
- **Q4:** the rulebook now states the "ordinary cubes first" convention for Hibernation-protected cubes.

**Optional items from the audit.**
- The log detail for cone changes (F8 in the v0.3.5 audit) is still open.
- Stalled games are reported separately as `stalledGames`.
- Not done: a release manifest, and a "Clear draft move" control.

**Still not verified.** No physical-table playtest, and no Android/iOS file handling.
