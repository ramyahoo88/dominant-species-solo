# Response to the v0.3.8 re-audit (GPT, 14 November 2026)

Release: v0.3.9. GPT's recommendation was to treat the tested app behavior as the reference for the printed rivals, because that is the policy the difficulty ladder measured. v0.3.9 does that. The rivals' code is unchanged, so the v0.3.8 ladder still applies. GPT's 3,600 fresh games agree with it: Standard is tougher than an even game at every size, and Hard is within 4.5 points of the app's rivals.

| Finding | Fix | Test (`source/rules.test.cjs`) |
| --- | --- | --- |
| **Initiative, player form** | While a legal space is open, a destination is required (as printed by GMT). Forfeiting the whole action is the separate **Forfeit action** button. On a full display the form says the pawn returns, still offers Forfeit, and Continue advances the marker and returns the pawn. | "player Initiative needs a destination…": the open Adaptation space gives a required select plus Forfeit; the 41-space display gives no select, Continue advances and returns the pawn. Fails on v0.3.8, passes now |
| **Paper Migration** | Printed rule now matches the app: during one Migration action each tile either sends or receives species. Once it does one, it can only do more of the same. | "paper Migration lets each tile either send or receive…" (80 Migrations on 40 seeds) |
| **Paper Evolution** | Printed scoring formula: 2× the tile's first-place value if the swap moves the rival into first, 1× if it otherwise gains a rank or enters the ranking, 0 otherwise, +3 if it ends dominant. Highest total, ties to the higher first-place value, then top-left. | "paper Evolution follows the printed score…": an 8-point rank gain on Wetland beats a 2+3 first place on Tundra |
| **Paper Immigrants** | Printed rule now matches the app: an unplaced pawn first, otherwise the rival's last pawn on the action display, reading top to bottom and left to right. No placement history needed. | "paper Immigrants removes an unplaced pawn first, else the last pawn in display order" |

The three paper items were wording gaps where the app already behaved this way. Their tests pin the app to the new printed wording, so the two cannot drift apart again.

## Still open

- One physical game with the printed sheets to check that the instructions are clear in use.
- Real Android and iOS save handling.
- The two-person paper mode.
- **Strategy balance:** a self-tuned test player (branch `claude/learning-player`) wins well above even-game rates against paper rivals by contesting Initiative and chasing Domination cards. That is the next balance item; it is not part of this release.
