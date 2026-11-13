# Review of v0.2.0 (Claude, 2026-11-13)

Review of Gemini's v0.2.0 changes against GPT's v0.1.0, plus rules spot-checks.

## Verdict

v0.2.0 is a genuine improvement and worth keeping. It mostly cut wasted bot actions and fixed a Wanderlust form crash (`cornerLabel` called without the game state). However, the project's main way of evaluating the bots can't tell whether they got smarter.

300 seeded games per version (5 × the 60 smoke-test matchups):

| Metric | v0.1.0 | v0.2.0 |
| --- | --- | --- |
| Bot forfeits per game | 7.2 | 3.9 |
| …of which legal but declined | 5.0 | 2.2 |
| Domination forfeits (bots, 300 games) | 423 | 46 |
| Mean turns | 6.9 | 7.7 |
| Mean winning-bot VP | 148 | 171 |
| Reptiles win rate (per appearance) | 59% | 49% |
| Insects win rate (per appearance) | 25% | 17% |

v0.2.0 win rate by animal (expected ≈33%): Reptiles 49%, Birds 41%, Mammals 37%, Arachnids 31%, Amphibians 26%, Insects 17%.

Both versions rebuild byte-identically from `source/`, and the app loads at 390 px width with no console errors.

## Problems, most important first

1. **The test harness can't measure bot quality.** The human seat in `smoke.cjs` is played by the same bot logic, so every bot change also changes "you". A ~33% human-seat win rate only means all three seats are equal. The harness records step counts only: no results, no forfeit causes, and no small-board rules fixtures (the handoff asked for these; Gemini added none).
2. **Win rates by animal are badly lopsided** (Reptiles 49% vs Insects 17%). This more likely reflects the bot misjudging certain animals than real game balance.
3. **Rivals never block.** `planPlacement` never values a space for denying a rival. Nearly half of the remaining bot forfeits are pawns placed where they can do nothing (Speciation with an empty gene pool; Adaptation at the six-element limit). Many are forced late in planning, where a person would place to block. The handoff asks rivals to contest useful spaces.
4. **Bots overcommit to Speciation.** They plan a second Speciation pawn after the first will already have emptied the gene pool (`fastValue` ignores cubes committed by earlier pawns).
5. **Gene pool looks one cube short.** `newGame` starts each animal with `pool: 45` plus 4 on the board (49 total; setup screen shows "45 in pool"). Published setup tables give 50 cubes and 6 pawns per player at three players, i.e. 46 in the pool after setup. The app may report no cubes while the player still has one. Verify against the box rulebook; `threatScore` in `bot.js` also hard-codes 49.
6. **Smaller code issues**
   - `doomedWastelandCorners` assumes a Wasteland pawn saves every single-copy element type; it can only save one.
   - Gemini roughly doubled the number of hand-tuned weights with no measurement to tune them against.
   - `HANDOFF.md` and version notes were not updated; there is no changelog.

## Rules confirmed correct

- Speciation limits per terrain (4 / 3 / 2 / 1)
- Regression counted once per element type; printed elements never removed
- Wanderlust arrival in food-chain order, no cap
- No Survival award on a tie
- Eliminated species go to the box, except Glaciation returns them to the gene pool
- Game ends after the turn Ice Age is taken
- Starting placement for all six animals
- Six action pawns per animal at three players; six-element Adaptation limit

Dominance Card effects were not audited against the physical cards.

## Recommendations, in order

1. **Fix the harness first.** Lock the human seat to one fixed strategy and compare versions on paired seeds. Record win rate by animal, score margins, and forfeits split into "no legal option" vs "chose not to". Add small board fixtures for tricky rules.
2. **Fix the gene-pool count** if the rulebook confirms 50.
3. **Add blocking:** when no space is useful to the bot, pick the space most valuable to the leading rival.
4. **Track committed cubes:** discount extra Speciation pawns by cubes already promised to earlier ones.
5. **Investigate Insects and Amphibians** once the harness can show whether a change helps.
6. **Cut data entry:** each turn needs ~15 dropdown picks for element draws. Tap counters for the six element colours would be much faster on a phone.

## Sources

- [UltraBoardGames rules summary](https://ultraboardgames.com/dominant-species/game-rules.php)
- [RulesPal rulebook summary](https://rulespal.com/dominant-species/rulebook)
