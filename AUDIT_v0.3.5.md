# Independent audit: v0.3.5 and Paper Rivals

Audited November 14, 2026, by Claude. Scope: the app at `main` b14f720 (v0.3.5), the Paper Rivals rulebook (Docs artifact, rev 16) and `source/paper/paper.js`.

**Verdict: the app is fit to release. The paper rules need four text fixes (F2, F4, F5, F6) and one balance decision (F1) before the rulebook goes out as final.** I found no confirmed defect in the app.

## 1. Release verification

| Check | Result |
|---|---|
| Rebuild from a clean clone (`python3 source/build.py --output /tmp/audit_build.html`), then a byte compare | Identical. SHA-256 `02caf94b…92efda5` for both files |
| GitHub `main` | b14f720, the same commit as the user's PC |
| Version | `VERSION = '0.3.5'`; UI label v0.3.5; migration list accepts 0.1.0–0.3.4 |
| `node source/rules.test.cjs` | 12/12 pass |
| `node source/smoke.cjs` | Exit 0; `BASELINE_RESULTS.json` unchanged |
| `python3 source/browser_test.py` | Pass (Chromium, 390 px, offline) |

## 2. What should happen (sources)

- **Base game:** player count changes only action pawns and cubes: 7/55 for 2 players, 6/50 for 3, 5/45 for 4, 4/40 for 5 and 3/35 for 6. Only the animals in play get starting species, and unused displays go back in the box (GMT rulebook as summarized by ultraboardgames, rulespal and lehi-innovation; the GMT living-rules PDF could not be fetched from this session). I found no separate errata for the base game. The 26 Dominance Cards were checked against the printed cards in the Vassal module in `CARD_AUDIT.md`; this pass did not repeat that.
- **Agreed variants:** the Paper Rivals rulebook (Standard, Hard and Expert by extra pawns; quick mode with seven changes; barren Earth; 2–5 rivals) and the app's own bot decks.

## 3. What I tested directly

- **App through its controls** (Playwright, Chromium, 390 px, offline). Driver: `audit_ui.py`. Policy: random legal spaces, forfeit optional actions, first option elsewhere.
  - Complete games, setup to final scoring: 2 rivals (250 bot steps), 3 rivals (297) and 5 rivals (292).
  - The 4-rival game reached turn 8 (267 bot steps). It stopped at a checkbox my driver can't tick, not an app fault.
  - Every bot preview was compared with the log entry it produced. Undo then re-apply gave an identical state. Reload kept the state, and an export/import round trip kept it. There were no page errors and no network requests.
- **Engine assertions** (`/tmp/probe.cjs`, reproduced in §6): six-animal setup, 4-animal setup, ranks on a tile with 6 animals, a Survival tie, save validation and v0.3.4 migration. All pass.
- **Rulebook against code:**
  - All 48 deck rows (both faces) match `source/src/decks.js`, through `decktables.cjs`.
  - All 13 card conditions match `checkCard`, with the paper `elements` override.
  - The Planning steps, target table, Execution table, Competition score, card score table, card tie order and card-effect table were traced line by line against `paper.js`.
- **Bot information:** `bot.js` and `effects.js` never read other decks, deck order or the RNG. Rivals use only public board state and their own drawn card.
- **Simulations:** 360 games per cell, run on the user's PC through the job runner, comparing matched seeds across three player strategies.
  - Fresh blocks 170000 and 180000.
  - Development blocks 6200, 150000 and 160000.

## 4. Findings (most important first)

### F1 · Balance · Paper rivals are beaten by card-chasing play. Confirmed.
- **Player impact:** a player who focuses on Domination and Dominance Cards beats paper rivals about twice as often as a player using other strategies. That makes the rulebook's difficulty levels misleading for that style of play.
- **Expected:** no single strategy should clearly prevail. Against the app's rivals the same strategy wins 30% (36/120), about an even 3-player game.
- **Observed** (2 rivals, base pawns, seed 170000; player wins out of 120 per strategy):

| Rivals | Majority | Dominance | Expansion |
|---|---|---|---|
| App | 24 | 36 | 22 |
| Full paper | 56 | **80** | 71 |
| Quick paper | 24 | **74** | 27 |

  The pattern repeats on blocks 6200, 150000 and 160000 (3 rivals: 61/120 against 22 and 25).
- **Reproduce:**
  ```
  node source/benchmark.cjs --base worktree --candidate worktree --seed 170000 --repeats 2 --paper 0 --paper-options quick
  ```
  Read `byPolicy.dominance.candidate.humanWins`.
- **Source:** `source/paper/paper.js` `paperPlacement`. The paper rival defends Domination only through its own Domination-first step (line ~60). Unlike the app since v0.3.4, it never blocks the leader.
- **Smallest fix (tested; option `domBlock` on branch `claude/balance`):** after Domination-first, if a card is available, the rival has fewer than 2 Domination pawns, and the leader dominates at least 1 unscored tile, the rival takes the leftmost open Domination space.

  | Test | Quick | Quick + block |
  |---|---|---|
  | Seed 6200, total | 124 | 116 |
  | Seed 170000, total | 125 | 105 |
  | Seed 180000 (fresh), total | 113 | **85** |
  | Seed 180000, dominance strategy | 65/120 | **47/120** |
  | 4 rivals, seed 160000, total | 92 | **74** |
  | 4 rivals, dominance strategy | 43/120 | **34/120** |

  The block makes quick rivals tougher for every strategy, so quick-mode difficulty labels move by about one step. **It does not help the full rules** (6200: 176 → 205; 170000: 207 → 204), so do not add it there.
- **Status:** the full rules have no tested fix. Card-chasing remains strong against them.

### F2 · Rulebook accuracy · Quick mode's "no weaker" claims are overstated. Confirmed.
- **Text:** the Quick mode intro says no cut "made the rivals measurably weaker". Testing says the seven-change version "made the rivals no weaker at any table size".
- **Observed:**
  - Seed 150000, 2 rivals: the two-change version won 107/360 (30%), the seven-change version 134/360 (37%).
  - On those seeds the dominance strategy went from 54 to 72 of 120.
  - 3 rivals: 26% → 30%.
  - 4–5 rivals: equal or stronger.
  - Averaged over all five comparisons it is equal.
- **Fix:** say "no weaker on average across 2–5 rivals; on some seeds about 4–7 points weaker with 2–3 rivals, mostly against a card-chasing player."

### F3 · Balance · At 4–5 rivals, expansion play beats the full rules at +0 and +1. Confirmed.
- **Observed** (5 rivals, seed 160000; an even game is 17% = 20/120): expansion wins 62/120 at +0, 36/120 at +1 and 21/120 at +2.
- **Rulebook text:** "most players will want Hard (+1) with three or more rivals."
- **Fix:** recommend Expert (+2) for the full rules with four or five rivals.

### F4 · Rulebook wording · Text still assumes two rivals. Confirmed.
- **Overview:** "These rules run the two rival animals."
- **Terms:** "Leader: the opponent (you or the other rival)."
- **Biomass and Predator:** "…else the other opponent."
- **Evolution:** says "For each opponent, leader first", but the code (`paper.js` Evolution, `pOrderOpps(s,actor).slice(0, Math.min(2, me.pool))`) takes only the **two** highest-VP opponents.
- **Player impact:** with 3–5 rivals, a player can't tell which opponent comes after the leader.
- **Fix:** define "opponents in VP order (ties to the food chain)" once under Terms, and use it in those rows. Change Evolution to "the two highest opponents in VP order".

### F5 · Rulebook and code disagree · Barren-Earth Abundance. Confirmed.
- **Text:** "…it places on Abundance first if a space is open."
- **Code:** `pick(['abundance'])` runs with `allowRepeat = false`, so a rival that already has an Abundance pawn this turn skips the rule.
- **Fix:** add "and it has no pawn on Abundance yet" to the text. That matches the tested code.

### F6 · Stale documentation · `HANDOFF.md`. Confirmed.
- It still calls v0.3.4 the current build and says saves through v0.3.3 import.
- **Fix:** update both to v0.3.5, and note that the app takes 2–5 rivals.

### F7 · Rulebook accuracy · Standard varies more than the Testing table shows. Observation.
- On fresh seed 170000, Standard (full rules, +0) lost 207/360 (58%), against the 49–52% printed.
- **Fix:** give the range "49–58%".

### F8 · Optional usability · The log is less detailed than the previews.
- After Wasteland, Depletion and Ice Sheet, the preview lists cone changes (for example, "Place Reptiles's Dominance cone on D2 Wetland"). The log entry leaves them out.
- The Regression check step ("Check which added elements need protection…") writes no log entry.
- No state difference.

### F9 · Optional, test tooling · Negative pawn levels.
- `--paper -1` fails with an argument error; `--paper=-1` works.
- **Fix:** mention the `=` form in `--help`.

### Observations, not confirmed as problems
- **Player animal against paper rivals.** At 60 games per animal, the uncertainty is about ±12 points.
  - Arachnids won 78% (47/60) against the full rules, where the other animals won 43–60% (seed 170000).
  - Insects won 30% at 5 rivals in quick +1, where the other animals won 7–15%.
  - Recheck both on another block before acting.
- **v0.3.4-labeled saves with 3 rivals.** The checker accepts one. v0.3.4 could not create such a save, so this is harmless.
- **App rivals by strategy.** Over 2–5 rivals the player wins 8–36 of 120 games per strategy. Dominance is the highest but stays near an even game. The app shows no prevailing strategy.

### Ambiguous rulings (questions, not defects)
- **Quick-mode Migration.** Without the rank check, every non-rescue move must reach a new tile, so "then the highest-VP tile, then a tile the rival is not on yet" reduces to rescues first, then new tiles by VP. Consider writing it that way.
- **Card list and the 10-pawn cap.** A rival at 10 pawns can still take Omnivore under quick mode's card list and gain nothing. The full rules score it 0. Decide whether the card list should skip pawn cards at 10.

## 5. Recommended fixes, in priority order
1. **F1:** add the Domination block to quick mode and re-measure the quick-mode difficulty labels. Decide whether quick mode, now both lighter and stronger than the full rules, should become the recommended default.
2. **F3:** recommend Expert (+2) for the full rules with four or five rivals.
3. **F2, F4, F5:** wording fixes in the rulebook.
4. **F6, F7:** update the documentation.
5. **F8, F9:** optional.

## 6. Reproduction aids
- **Engine assertions:** load the app through `source/benchmark/load.cjs` (`load('worktree')`), then:
  - `newGame('insects', ['mammals','reptiles','birds','amphibians','arachnids'], true, 12345)` gives `ap = 3` and `pool = 34 − starting cubes` for every animal, with initiative in reverse food-chain order.
  - Put 2 cubes per animal on a sea tile: `tileScores` returns at most 4 places, in food-chain order.
  - Give two animals 2 cubes each on tundra and no one else any: `survival(s) === null`.
  - Raise one animal's pool by 15: `validateState` throws.
- **Strategy splits:** read the `byPolicy` blocks of any benchmark JSON; the commands are in F1 and F3.
- **UI driver:** `audit_ui.py` (kept outside the repo) runs `python3 audit_ui.py 2 3 5`.

## 7. Coverage gaps
- Nobody has played the paper rules at a real table. The simulated player uses three fixed strategies, not a person, and is not adaptive.
- The 4-rival UI run stopped at turn 8. The 4-rival engine path is covered by 1,440 simulated games.
- The GMT living-rules PDF was not readable from this session, so player-count rules come from secondary summaries that agree with each other.
- I didn't recheck the printed card text in this pass (see `CARD_AUDIT.md`).
