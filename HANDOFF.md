# Dominant Species solo companion v0.1.0

## Request for Gemini

Audit this first playable build of an offline solo companion for Chad Jensen’s original GMT edition of *Dominant Species*. Start by reproducing the baseline and checking important rules and player-facing instructions against GMT’s rulebook and the physical components. Give each finding a severity, a concrete example, a rule citation where applicable, and a source location. Then propose a small, testable improvement that makes the rivals play more like people in a three-player game.

This project is an independent fan playtest. The aim is to have a credible public beta for the existing GMT box ahead of Allplay’s solo launch. Public previews can inform the design when they disclose a specific mechanic. Credit any published idea you propose to use.

## Design requirements

- One human plays any of the six animals against any two distinct remaining animals. That gives 60 matchups when rival seats are interchangeable. Both rivals play for their own victory and use public information.
- Keep the standard three-player setup, one animal per seat, with the 22-card and 26-card options. The physical box supplies the board, elements, tiles, and Dominance Cards. Use the original game’s VP, matching, powers, and endgame rules.
- Keep the design card-driven, in the spirit of the Calixto companion. Each animal starts with eight original cards and a separately shuffled deck. A card checks the board and uses one of two faces to bias the action-space choice. The bot chooses its exact target during Execution. The original 48 cards are in `source/src/decks.js`.
- Preserve the standalone HTML workflow from the Colonial Twilight companion on desktop and Android. The player enters physical draws and choices, follows precise tabletop instructions, and can undo, resume, or export a game. Favor improvements that avoid extra routine data entry.
- Make the rivals opportunistic and distinguishable. They should contest useful action spaces, prepare a score with earlier actions, reconsider it after the board changes, and interfere with whichever rival threatens their own position.

## Package and baseline

| File | Purpose |
| --- | --- |
| `Dominant_Species_Solo.html` | Exact v0.1.0 build previously delivered to the player |
| `source/src/` | Editable application modules, HTML template, and CSS |
| `source/build.py` | Portable bundler using Python’s standard library |
| `source/smoke.cjs` | Seeded engine smoke checks with Node and its standard library |
| `BASELINE_RESULTS.json` | Recorded output from the baseline rerun |
| `SHA256SUMS.txt` | File checksums for the handoff |

From the extracted package directory, use Python 3 and a current Node.js release. Verification used Python 3.12.14 and Node.js 24.22.1.

```sh
python3 source/build.py
node source/smoke.cjs
```

The build produces `source/dist/Dominant_Species_Solo.html`. Its expected SHA-256 is:

```text
81071c6cb0af80df74364ba513916a7da45f1969182a1b50ca24adbe62aed481
```

The smoke check finished all 60 matchups through Ice Age and final scoring. It used one seeded game per matchup, split evenly between short and full games, with seeds 100–159. The human seat uses a bot heuristic in the harness. Terrain reveals are sampled with replacement, and `maxTime` is an environment-dependent timing field. Treat this as reachability and state validation. Balance, rules parity in unusual situations, and human play quality still need dedicated evidence.

Earlier browser checks covered setup, deck browsing, one full Planning round, action confirmation, save resume, and a 390 px layout. Physical playtesting remains open.

## Where to look

| Area | Source | What to verify |
| --- | --- | --- |
| Setup and board geometry | `data.js`, `engine.js` | Starting tiles, shared corners, physical supply entry, initiative, and Glaciation queue |
| Planning and card selection | `decks.js`, `bot.js` | Eight-card draw cycle, both faces, fallback actions, contested spaces, and follow-through from planning to execution |
| Action sequence and animal powers | `engine.js`, `forms.js` | Regression and Wasteland timing, Birds’ movement, free Insect and Arachnid actions, Mammal Extinction save, and legal human inputs |
| Scoring and card effects | `engine.js`, `effects.js`, `forms.js` | Cube majority versus element dominance, card recipient, event timing, Survival, Ice Age, and final scoring |
| Tabletop synchronization | `ui.js`, `controls.js` | Accurate instructions for pawn, cube, element, cone, and score changes, plus undo and save recovery |
| State and save compatibility | `ui.js`, `controls.js`, `data.js` | Validate imported data and retain existing playtest saves when the app version changes |

All listed modules live under `source/src/`. The current save envelope uses the format `dominant-species-solo-v1`, and `validateState` also checks the application version. Test loading a v0.1.0 save if proposing a version bump.

## Review priorities

1. **Rules and synchronization.** Check the timing of mandatory Regression and Wasteland, queued Glaciation, the Instinct pawn placed after its action row has passed, and the complete Ice Age sequence. Review difficult Dominance Cards such as Hibernation, Mass Exodus, Immigrants, and Symbiotic against the physical card and the printed clarifications. Where the edition matters, name the printing.
2. **Human-like opponents.** Use small board fixtures to see whether a rival reserves Domination before another player claims the slot, builds an Adaptation or Migration setup it can actually finish, and changes plans if the opportunity disappears. Include a case in which attacking the other bot is better than attacking the human and a case in which the animal winning VP differs from the animal taking the Dominance Card.
3. **Repeatable comparison.** Compare one change at a time against v0.1.0 using paired seeds and legal physical supplies. Exercise at least a tile-majority policy, a Dominance Card policy, and a tundra or expansion policy. Report illegal or wasted actions, successful setups, bot-versus-bot interference, score margins, and any extra inputs the player must make. Give the sample size and distinguish engine results from tabletop observations.
4. **First response.** Return the audit and a prioritized patch proposal with regression cases. If you supply a patch, include the changed source and a rebuilt, self-contained HTML file. Keep release and publication decisions with the project owner.

## References

- [GMT’s current rules link for the original game, third printing, © 2012](https://www.gmtgames.com/living_rules/DS3_Rulebook-web_FINAL.pdf)
- [GMT sixth-printing page and component references](https://www.gmtgames.com/p-909-dominant-species-6th-printing.aspx)
- [BoardGameGeek listing for the original 2010 game](https://boardgamegeek.com/boardgame/62219/dominant-species)
- [Allplay’s campaign preview](https://www.launchoracle.com/allplay/dominant-species/QNT6K)
- [Dávid Turczi’s public solo announcement and GMT third-printing playtest comment](https://www.reddit.com/r/soloboardgaming/comments/1vc4wre/lotr_kings_gambit_solo_dominant_species_solo/)
- [Portage Glacier photograph, USGS](https://commons.wikimedia.org/wiki/File:Portage_Glacier_USGS.jpg)
