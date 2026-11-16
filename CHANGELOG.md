# Release notes

## v0.5.6 · November 15, 2026 · The Red Queen, cards only; Ice Age decision fixes and card reminders for GPT's v0.5.5 re-audit; rulebook clarifications

- **The Red Queen · cards only (new, the user's request):** a third choice on the setup screen for players who want to run the printed rivals themselves without printing anything. The app shuffles each rival's eight-card deck and shows the card you draw, styled like the printed front (number, three actions with a reminder of when each has a target, weak actions in grey). It reshuffles a rival's discards when its deck runs out and says so, keeps a list of recent draws, and offers Undo. The rulebook and all ten player aids open inside the app, offline. Nothing on the board is tracked. The setup screen keeps the rival count, animals and level, which sets the pawn reminder. The game saves on the device under its own key, and Export and Import work; a cards-only save and a full-game save are never read as each other.
- **Ice Age decision (Tooth & Claw and the benchmark's tuned player; GPT's v0.5.5 re-audit):**
  - **F1, human Mammals:** the forecast assumed a human Mammals player would make the Extinction save with the most VP for Mammals. On GPT's save that is the Wetland cube (Mammals 18, Birds 19), but saving the Savannah cube wins 17–16, so Birds took a losing Ice Age. The forecast now assumes the save that best helps Mammals win: final place first, then lead over the best other animal, then Mammals' VP.
  - **F2, losing ties:** a rival took Ice Age on any projected tie, but ties go to the animal higher in the food chain. It now takes Ice Age only if it would finish first after the tie-break; on GPT's 18–18 save Birds take Fertile.
  - **Effect:** not re-measured on the PC (the user's call: the change is minor). It changes a decision only when a human plays Mammals and two Extinction saves lead to different winners, or when the projection is an exact tie. The 60-game smoke check is unchanged, and v0.5.5's matched runs showed the forecast itself rarely decides a game.
  - **Testing switch:** `--paper-options v055Forecast` restores the v0.5.5 decision (`oldForecast` still restores v0.5.4).
- **Card reminders (GPT's P3):** Migration now reads "a rescue, or 1 of 2+ species (no rank lost) to a new matched tile"; Abundance "a box element it uses; empty corner on its tile (exceptions: aid 1)", pointing to Barren Earth and Empty Earth on player aid 1. The card legend now reads "Under each action: when it has a target. Grey: a weak action, skipped. Planning steps 1–3 come first; if nothing fits, step 5." (it read "Small print: …"). A new build check (`source/paper/check_print_fit.py`) measures every card and aid sheet for cut-off text.
- **Rulebook and aids, clarified (NotebookLM's reading, checked by GPT; no change to play):** added elements are kept in the order gained, oldest on the left, with Metamorphosis replacements at the right end and the leftmost copy removed first; Block the leader only claims the Domination space, and the pawn then scores by the usual rule; the Speciation target reads "a disk matching the element of the space being checked is on Earth"; Migration's conditions are checked again before each move; Competition scores keep half-points exactly. The 26-card Dominance list is unchanged (there is no Forest Fire card in the base game).
- **Verifier:** GPT's patch to `source/paper/verify-printables.py` for the new file names, front and back pages and long-edge geometry.
- **Tests:** GPT's four v0.5.5 saves (human Mammals, losing tie, the Migration and Abundance placements), a constructed tie, cards-only draws, reshuffle, save round trip and the built-in rules' match with the printables; `source/browser_draw_test.py` runs the cards-only mode in Chromium at phone width, offline. 58 rules tests.
- Reproducible build: SHA-256 bd7afbb9… (full hash in `HANDOFF.md`); accepts v0.1–v0.5.5 saves.
- See [AUDIT_RESPONSE_v0.5.5.md](AUDIT_RESPONSE_v0.5.5.md).

## v0.5.5 · November 15, 2026 · The Red Queen and Tooth & Claw; Ice Age forecast fix; fixes for GPT's v0.5.4 comprehensive audit

- **Ice Age forecast (GPT A1, medium; app rivals and the benchmark's tuned player):** before taking Ice Age, a rival projects the final scores. The projection saved the first endangered Mammals tile in the order Mammals reached them, while the real Extinction step saves the one with the highest first-place value. On GPT's save Birds forecast a 16–12 win, took Ice Age and lost 16–18.
  - **Fix:** the projection now runs the real final reset on a copy: Ice Age points, Extinction with the save the Extinction step itself would make (the app's or the printed rivals' chooser; a human Mammals player is assumed to make its best legal save), Survival and final tile scoring. Actions still to come that turn stay outside the snapshot.
  - **Effect:** rare in play, and no measurable change to difficulty. Compared with v0.5.4 on the same games: in the difficulty ladder every game against The Red Queen is identical and 6 of 1,440 games against Tooth & Claw play out differently, with the same winners; the tuned test players' evaluations (about 86,000 games) change one win; on fresh setups 4 of 1,440 games against Tooth & Claw change and one changes winner (a rival now wins a game it lost). The difficulty table, X35 and best against best are unchanged, so nothing was retuned.
  - **Testing switch:** `--paper-options oldForecast` restores the v0.5.4 projection.
- **Names in the app:** the setup screen now offers **Tooth & Claw** (the app's own rivals) and **The Red Queen** (the printed rivals). The game header, the turn-1 text, the card panel, Help and every rival move label ("Red Queen: …") follow. Saved games are unaffected; the save format still records `paper`.
- **Printed rules (GPT P1, P2, low; wording only, no change to play):**
  - **Catastrophe:** only a tile with species on it can be chosen (tie: higher first-place value, then board order). Without it an empty tile ringed by opponents could look best.
  - **Hibernation:** returns 5 eliminated species, or all of them if fewer, and compares rank gains with that number.
- **Smoke baseline (GPT T1, low):** `BASELINE_RESULTS.json` had not been refreshed since v0.3.4. It is regenerated from this release, and `node source/smoke.cjs --check` now compares a run with it (ignoring the machine-dependent `maxTime`); `--write` refreshes it.
- **Tests:** GPT's three saves (losing Ice Age, empty-centre Catastrophe, Hibernation quantity), plus the forecast against the played-out result with a Hibernation-protected cube and a shared tundra, and a human Mammals player. 53 pass.
- **Rulebook, more professional:** a credit line (an unofficial solo variant for *Dominant Species*, designed by Chad Jensen, published by GMT Games) replaces the build note; the Testing section is gone (the measurements stay in `PAPER_RIVALS.md` and `HARD_BALANCE_LOG.md`); no file names or paths in the printed text; app-only remarks removed (Wanderlust's stack numbering, the No-face note). No change to any rule.
- **Cards redesigned:** each front shows the animal, its element and food-chain place, the number, the card name, the three actions in numbered circles with a one-line reminder of when each has a target, and a weak action after the first in grey (step 4 never takes it). Each species has its own back in its colour, with its name, element, food-chain place and power. Fronts and backs print double-sided (flip on the long edge); the rulebook adds a blank page if needed so fronts land on right-hand pages. Rulebook 20 pages (8 rules, 12 cards); card sheet 12 pages.
- **New name: The Red Queen** (the user's choice), subtitled "Solo rivals for *Dominant Species*", after the Red Queen hypothesis in biology. Rulebook title, card backs, player aids and file names change: `paper/The_Red_Queen_Rulebook.pdf`, `paper/The_Red_Queen_Cards.pdf`, `paper/The_Red_Queen_Player_Aids.pdf` (the `Paper_Rivals_*` files are gone). The code keeps the working name "paper" (files, options, the save field).
- Reproducible build: SHA-256 c29c1236… (full hash in `HANDOFF.md`); accepts v0.1–v0.5.4 saves.
- See [AUDIT_RESPONSE_v0.5.4.md](AUDIT_RESPONSE_v0.5.4.md) (comprehensive audit section).

## Printables update · November 15, 2026 · player aids, rulebook redesign with cut-out cards; fixes for GPT's v0.5.4 re-audit and printables audit (no app change)

- **Player aids (new):** `paper/Paper_Rivals_Player_Aids.pdf`, ten letter-size sheets: Planning, Execution, Dominance Cards, Setup with the other decisions, and one sheet per rival (its deck, the placement steps, its element, power and food-chain position). Generated by `printables.py` from `source/paper/AIDS.html`, the app's decks and data, and the difficulty offsets. The build fails if an aid drops a card, a list or a table row of the rulebook. The aids were checked line by line against the rulebook; the rulebook wins if they ever disagree.
- **Rulebook design:** the rulebook uses the aids' design (green section bands, boxed numbered steps), and its appendix now holds the cut-out cards themselves (six pages, the same as `paper/Paper_Rivals_Cards.pdf`) instead of tables. The Markdown copy keeps the tables. The rulebook PDF is 15 pages: 9 of rules and 6 of cards.
- **Wording (no change to play):**
  - **Mass Exodus (GPT's v0.5.4 re-audit, P2, low):** in GPT's wording, "Among occupied tiles with an adjacent tile on Earth, prefer one without its own species; then choose the one holding the most opposing species. Break ties by higher first-place value, then board order." The printed rule only covered tiles without the rival's species, so it could not be followed when the rival is on every tile. New test on a constructed position and on GPT's save.
  - **Aquatic (GPT's printables audit, P3):** it adds 4 species or all its gene pool holds if fewer, and the tile choice is counted with that number; a tile it does not match is taken only if it matches none. Both as the app plays it. Tests on a constructed position and on GPT's save.
- **Builder check (GPT's printables audit, T1):** each aid table is now checked on its own sheet, so dropping a row from one sheet can't hide behind the same label on another.
  - **Competition score:** the +6 applies only when the removed species is that opponent's last one there and that opponent is dominant there, as the app plays it.
- **Testing text:** GPT's fresh Hard estimate for v0.5.4 (−0.43, 95% −0.73 to −0.10) joins the earlier four.
- App build unchanged (SHA-256 4ed8110d…; still v0.5.4, so saves are unaffected). See [AUDIT_RESPONSE_v0.5.4.md](AUDIT_RESPONSE_v0.5.4.md).

## v0.5.4 · November 15, 2026 · Migration placement test, rival ties by most species, five card skips, wider Empty Earth; fixes for GPT's v0.5.3 re-audit

- **Migration placement (paper rules):** a rival now places on Migration only if Migration would let it move: a rescue, or a species from a tile where it has 2 or more (losing no rank there) to a matched tile it is not on yet.
  - **Why:** the old test only asked whether a matched neighbour existed. Rivals often placed there and then had no allowed move, so 24% of rival Migration pawns did nothing.
  - **Result:** wasted Migration pawns fell to 12% (measured with all four changes against v0.5.3).
  - **Saved games:** applies to every Paper game, saved ones included.
- **Rival ties (paper rules):** when only rivals tie for the most matches on a tile, the rival with the most species there is dominant; if still tied, the one higher in the food chain. Before, the food chain alone decided, which favoured Mammals.
  - **Result:** with all four changes against v0.5.3, Mammals' share of rival wins fell from 39% to 29% and Insects' rose from 9% to 20%; the other four sit at 16–27%.
  - **Saved games:** new games only (saved as `speciesTie`). Games started earlier keep the food-chain tie, and Help says which rule a saved game uses.
- **Card skips (paper rules):** a rival skips five cards when they would do nothing for it: Metamorphosis (no added element, or an empty bag), Disease (no opponent with more elements and at least one added), Niche Biomes (no opponent ahead on VP), Nocturnal (already first in Initiative) and Hibernation (no eliminated species). If every available card would be skipped, it takes the first anyway. "Taking a card" lists them.
  - **Result:** cards taken for no effect, with all four changes against v0.5.3: Disease 34% → 12%, Nocturnal 20% → 2%, Hibernation 8% → 3%, Metamorphosis 50% → 26%, Niche Biomes 31% → 23%. Most of what is left happens when every available card would be skipped.
  - **Saved games:** applies to every Paper game, saved ones included.
- **Empty Earth (paper rules):** now applies when no rival species are left on Earth, even if yours remain. Before, it applied only when no species of any animal were left.
  - **Why:** one five-rival Hard game in the tuned-player check stalled for 120 turns: only the player's species remained and no element disks were on Earth, so the rivals could not return. It now finishes on turn 11. v0.5.3 had the same gap.
  - **Which games change:** that game only. The 5,760 difficulty-table games replay identically with and without this change, and every other tuned-player result is unchanged.
  - **Saved games:** applies to every Paper game, saved ones included.
- **Opening instructions (GPT finding A1):** a scaled five-rival Easy game now tells you that each rival returns 1 pawn and you take 1 extra, and spells out the result (2 for each rival, 4 for you). The text follows the saved game's `scaledEasy` flag, so older Easy saves keep their old wording and counts.
- **Printed priorities (GPT finding P1, GPT's wording):** Wanderlust takes the leftmost box element it uses; Metamorphosis prefers its printed type, then Meat, Sun, Seed, Water, Grub, Grass; Immigrants discards the type whose second copy was added earliest; Aquatic uses Habitat's element priority; Catastrophe keeps the lower food-chain animal at equal lowest VP. The app already played these; only the text changed.
- **Levels:** the rulebook's level table now gives only each level's pawn count. The descriptions ("a little easier than an even game", "about as strong as the app's rivals" and so on) are gone; the measured table in Testing shows how each level plays.
- **Effect on the numbers** (same seeds as v0.5.3):
  - **Difficulty table:** rivals are stronger, mostly at Easy, Standard and Hard (pooled over table sizes: Easy −55, Standard −74, Hard −39, Expert −3 wins of 1,440). Easy 63/56/54/40%, Standard 34/28/18/20%, Hard 20/13/7/4%, Expert 15/8/2/2% from two to five rivals (app's rivals 20/15/9/8%). No game stalled.
  - **Tuned-player check** (X35, Easy / Standard / Hard / Expert): −0.82 / −0.50 / −0.32 / −0.19 on seeds 470000 and −0.78 / −0.52 / −0.25 / −0.42 on 490000; best against best with the other agent's player, −0.37 / −0.23 / −0.22 / −0.02 and −0.34 / −0.27 / −0.16 / −0.17. All within the +0.20 target.
- **Testing text:** GPT's fresh Hard estimate for v0.5.3 (−0.41, 95% −0.66 to −0.10) joins the earlier three; the stall note describes the new Empty Earth case. The rulebook is now 12 pages (was 11), because of the card skips and the new priorities.
- **Tests:** Migration placement matches the first move Migration would make; species ties; each card skip; the stalled seed (3880436785) finishes; GPT's scaled and legacy five-rival Easy saves show the right opening text in the browser; v0.5.3 saves load without `speciesTie`. Testing switches `oldMigTest`, `oldRivalTie`, `noCardSkip` and `oldEmptyEarth` restore the v0.5.3 rules; with all four, ladder cells replay v0.5.3 exactly.
- Reproducible build: SHA-256 4ed8110d… (full hash in `HANDOFF.md`); accepts v0.1–v0.5.3 saves.
- See [AUDIT_RESPONSE_v0.5.3.md](AUDIT_RESPONSE_v0.5.3.md).

## v0.5.3 · November 15, 2026 · Mammals' Extinction tie, printed tie order for every row, scaled Easy; fixes for GPT's v0.5.2 re-audit

- **Mammals' Extinction save (paper rules; GPT's v0.5.2 re-audit):** a Mammals rival now saves its endangered species on the tile with the highest first-place value, then in board order, as printed.
  - **Why:** paper mode handed this choice to the app's own rival, which kept the first equal tile in the order Mammals reached them. On GPT's seed 960021 it saved at C2 instead of B2; in GPT's tundra position it scored 1 Survival VP instead of 3.
  - **Saved games:** applies to every Paper game, saved ones included, like board order.
- **Printed tie order (GPT's wording):** Terms → Ties now covers tiles; corners and empty spots use board order after each row's own priorities, and each row now says what it compares: Abundance and Habitat (the highest first-place value of any touching tile), Depletion, Speciation (the sum of the matched tiles' values), Wanderlust (spot, stack and corner), Blight, Migration, Mass Exodus, Competition and Arachnids' free Competition, Fertile, Mammals' save, which space in a row, and element losses (Regression, Disease, Immigrants, Metamorphosis). The app already played these choices; only the text changed.
- **Scaled Easy (paper rules):** with five rivals, Easy is now −1 pawn for each rival and +1 for you (2 against your 4), instead of −2 for each rival (1 against your 3). Other table sizes and levels are unchanged.
  - **Why:** the base count with five rivals is 3, so Easy's −2 left each rival a single pawn. Five Easy rivals together placed fewer pawns a turn than four did, so Easy got easier as rivals were added (75% with five against 56% with four), and every strategy won equally often.
  - **Saved games:** pawn counts are saved, so five-rival Easy games started earlier keep theirs. The setup screen (level picker and pawn line), Help and rulebook state the rule.
- **Effect on the numbers** (same seeds as v0.5.2):
  - **Difficulty table:** the Extinction fix changes four cells by one win each, and two of them by a rounded point (Easy with 3 rivals 60% → 61%, Expert with 3 rivals 7% → 8%). Scaled Easy takes Easy with 5 rivals from 75% to 47%, so Easy is now 64/61/56/47% from two to five rivals, and strategy matters again there (card-chaser 57.5%, 69 of 120; majorities 44%, spreading out 40%). No game stalled.
  - **Tuned-player check** (X35, Easy / Standard / Hard / Expert): −0.78 / −0.40 / +0.03 / −0.11 on seeds 470000 and −0.59 / −0.43 / −0.24 / −0.08 on 490000; best against best with the other agent's player, −0.21 / −0.15 / +0.06 / 0.00 and −0.42 / −0.16 / −0.09 / +0.07. All within the +0.20 target.
- **Testing text:** GPT's fresh Hard estimate for v0.5.2 (−0.11, 95% −0.41 to +0.17) joins the earlier two. The stall note now reads "7,200 ladder games (5,760 against paper rivals and 1,440 against the app's)".
- **Rulebook layout:** long tables now break between rows with the header repeated, so the longer card table no longer leaves most of a page blank (still 11 pages).
- **Tests:** the Extinction choice on a constructed position and on GPT's two saves (B2; C3 with 3 Survival VP; v0.5.2 saves load); scaled Easy at every table size and level, the testing switch and older saves. `--paper-options oldExtinction` restores the v0.5.2 Extinction choice and `flatEasy` the flat −2 (testing only).
- Reproducible build: SHA-256 8a0a7d17… (full hash in `HANDOFF.md`); accepts v0.1–v0.5.2 saves.
- See [AUDIT_RESPONSE_v0.5.2.md](AUDIT_RESPONSE_v0.5.2.md).

## v0.5.2 · November 15, 2026 · Board order for every rival tie; fix for GPT's v0.5.1 re-audit

- **Board order (paper rules; GPT finding E1):** when a rival's choice still ties, it now takes the tile, corner or empty spot furthest left on the board, then the highest. This is stated once, under Terms → Ties, and every rule that said "top-left" now says "board order".
  - **Why:** the printed rule said "closest to the top-left", but the app broke ties between corners by the text of their coordinates, and the Empty Earth and Habitat fallbacks took the first corner in storage order. A player following the printed rules could place an element on a different corner from the app.
  - **Where it applies:** every corner tie (Abundance, Depletion, Speciation's disk, Wanderlust's element, Habitat), the Empty Earth and Habitat fallbacks, Aquatic's corner, Blight's kept disk and Migration's origin (which went by the order tiles were placed). Tiles already went by board order (A1, A2 … B1 …); that order is now the one rule for corners too.
  - **Saved games:** applies to every Paper game, saved ones included.
- **Effect on the numbers:** ties now go by board position from turn 1, so most test games play out differently from v0.5.1, but the results barely move.
  - **Difficulty table** (re-measured, same seeds): pooled over table sizes every level is slightly harder (Easy −0.3, Standard −1.4, Hard −1.6, Expert −1.5 points of 1,440 games). 13 of 16 printed cells change, by −7 to +4 points; the largest are Hard with 3 rivals (21% → 14%), Easy with 3 rivals (56% → 60%) and Expert with 2 rivals (16% → 12%). Hard still sits with the app's rivals (24/14/11/7% against 20/15/9/8%). No game stalled.
  - **Tuned-player check** (X35, Easy / Standard / Hard / Expert): −0.88 / −0.38 / +0.03 / −0.11 on seeds 470000 and −0.67 / −0.43 / −0.24 / −0.07 on 490000. All within the +0.20 target; Hard on 470000 is the closest.
- **Testing text:** the Hard claim now carries both independent estimates (+0.19 in the v0.5.0 audit; −0.51, 95% about −0.76 to −0.20, in the v0.5.1 re-audit).
- **Tests:** board order from coordinates (corner ties, Aquatic, Blight, Migration's origin, the testing switch); Empty Earth on GPT's turn-31 fixture (storage and board order differ there); the archived turn-31 position reaches Ice Age; v0.5.1 saves load. `--paper-options oldCornerOrder` restores the v0.5.1 order exactly (anchor 745/269).
- Reproducible build: SHA-256 62b145b0… (full hash in `HANDOFF.md`); accepts v0.1–v0.5.1 saves.
- See [AUDIT_RESPONSE_v0.5.1.md](AUDIT_RESPONSE_v0.5.1.md).

## v0.5.1 · November 15, 2026 · Empty Earth rule; fixes for GPT's v0.5.0 audit

- **Empty Earth (paper rules; GPT finding G1):** if no species of any animal are left on Earth, a rival's Abundance may use any empty corner (top-left first, as for Habitat), so species can return.
  - **Why:** with every species and every element disk gone, no one could dominate, migrate or speciate, and rivals could only take Abundance next to a tile they occupied. GPT's seed 200074 (Birds against five Standard rivals) sat on an empty Earth from turn 7 and was still empty at turn 121.
  - **Result:** all three known stalls (that game and the two in the tuned-player checks) now reach Ice Age, on turns 9, 10 and 18. Resumed from GPT's turn-31 position, the first game reaches Ice Age on turn 37, as in GPT's prototype.
  - **Which games change:** only games where Earth runs out of species. Replaying the 5,760 paper games of the difficulty table under both rules, 6 played out differently and 1 had a different winner. Re-running the tuned-player check on ba67's seeds, every win count matched except one, and the stalled game finished.
  - **Saved games:** the rule applies to every Paper game, saved ones included, because it acts only on an empty Earth. Help says so; the notice for older saves now lists "these rules from then" (level, Planning order, tie rule).
- **Benchmark reporting (GPT findings B1, B2):**
  - `tune.cjs` rejects a rival count listed twice (`--bots 3,3`) and two names for one table (`--modes m2,-2`) before playing.
  - `final_eval.py` prints the 3–5-rival mean (X35) only when all three sizes are present, and rejects duplicate rows.
- **Wording:**
  - The balance claim now says what was measured: the +0.20 log-odds target, averaged across three, four and five rivals, in that sample. It also gives GPT's Hard figure (+0.19, with three rivals alone at +0.59).
  - The rulebook says rivals "rarely" (not "never") contest the Initiative track.
- **Difficulty table:** re-measured with v0.5.1. Every cell is unchanged except 3 rivals at Standard, 31% → 32% (114 of 360 instead of 113). No test game stalled.
- **Tests:** two new rules tests (the Empty Earth choice; GPT's seed 200074 finishes, and stalls with the rule switched off); v0.5.0 saves load; the Help mentions the rule. The benchmark's stall cap can be raised for diagnostics (`BENCH_TURN_CAP`); `--paper-options noEmptyEarth` runs the v0.5.0 rules.
- Reproducible build: SHA-256 c90c42b6… (full hash in `HANDOFF.md`); accepts v0.1–v0.5.0 saves.
- See [AUDIT_RESPONSE_v0.5.0.md](AUDIT_RESPONSE_v0.5.0.md).

## v0.5.0 · November 15, 2026 · rivals plan first; new levels; fixes for the GPT v0.4.1 follow-up

- **Rivals plan first (paper rules):** at the start of each Planning, before anyone else places, each rival places one pawn, in Initiative order. Then Planning goes around the Initiative order as usual.
  - **Why:** a strong player who stayed first on the Initiative track got first pick of the action display every turn, and paper rivals never contested it.
    - Against 3–5 rivals, the self-tuned test player beat paper rivals much more easily than the app's rivals, at every level.
    - At the old Hard it led the card-chaser by 33 points, against 23 for App rivals (1,440 paired games each).
  - **Result:** the test player was re-tuned against the new rule (checkpoint v4) and measured on fresh seeds (1,440 games per level). In that sample, its lead over the best simple strategy was no larger than against the app's rivals at every level with 3–5 rivals. With 2 rivals its lead was smaller.
  - **What else was tried:** more than twenty candidate rules overnight, logged in `HARD_BALANCE_LOG.md`.
    - Holding the Initiative space against you halved the excess.
    - Domination-race, blocking and card rules did nothing or backfired.
- **Difficulty levels move down** (planning first makes the rivals stronger): **Easy −2, Standard −1, Hard 0, Expert +1** pawns per rival.
  - Hard matches the app's rivals for the strong test player (45% vs 46%) and is a little easier for a simple one.
  - The new difficulty table is in the rulebook and `PAPER_RIVALS.md`. One of 7,200 test games stalled.
- **Saved games:**
  - New Paper games record their level name and the planning rule.
  - v0.4.0–v0.4.1 games keep their old Planning order and level names; older games keep their rules.
  - "Start a new game" maps the level name to the new scale.
  - A game saved in the middle of the rivals' opening placements resumes with the right rival.
- **GPT v0.4.1 follow-ups:**
  - R1: Help says which rules apply to new games, and shows a notice for an older saved game.
  - R2: an Easy save re-exported by v0.3.7–v0.3.9 is recovered as Easy.
  - R3: evaluator labels are checked before any game is played (player-bot agent, merged).
  - See [AUDIT_RESPONSE_v0.4.1.md](AUDIT_RESPONSE_v0.4.1.md).
- **Tuner:**
  - Level names follow the new scale (−2 Easy … +1 Expert; `--paper-options noPlanFirst` runs the v0.4.x rules).
  - New `--bots` option.
  - v4 weights (`source/benchmark/tuned_weights_v4.json`).
- **Tests:**
  - 38 rules tests, including the opening placements, a save made mid-way through them, the legacy Planning order and level recovery.
  - The browser restart test covers 8 saves and Help.

## v0.4.1 · November 14, 2026 · fixes for the GPT v0.4.0 audit

- **Older paper saves keep their level:** a game saved in v0.3.6–v0.3.9 now shows its original level name, and "Start a new game" picks the same level on the current scale. If an old save's level can't be recovered, you choose one; the setup can no longer start at an unlisted difficulty.
- **Tuner:** uses the v0.4.0 level names (Easy −1 … Expert +2) and reports the pawn offset with each result (the player-bot agent's tuner, merged).
- **Rulebook:**
  - New setup step: place the starting cones with the paper rules.
  - The strategy note names the tuned checkpoint and both test samples.
  - The Fallback line no longer splits across pages.
- **App:** "App rivals" without "strongest"; the help explains the levels and the rival tie-break.
- **Tests:** a new rules test (36 in total) and `source/browser_restart_test.py`. See [AUDIT_RESPONSE_v0.4.0.md](AUDIT_RESPONSE_v0.4.0.md).

## v0.4.0 · November 14, 2026 · rival tie-break and new levels

- **Rival tie-break (paper rules):** when only rivals tie for the most matches on a tile, the rival higher in the food chain is dominant. If you tie with them, no one is dominant, as in the normal rules.
  - Why: flat matching made rivals tie constantly, leaving tiles undominated, and that handed the player cards, Ice Age points and board control.
  - It cuts the edge of the strongest player we could build (a self-tuned test player, re-tuned against the new rule) at Hard from about +51 points over the best simple strategy to +30, the same margin it gets against the app's rivals (+28). At Standard the margin is larger (+39), so strong players should choose Hard or Expert.
- **Difficulty levels move down one pawn**, because the rivals are now about one pawn stronger: Easy −1, Standard +0, Hard +1, Expert +2. Standard is about an even game with 2–4 rivals, Hard matches the app's rivals and Expert is tougher. New table in the rulebook and `PAPER_RIVALS.md`.
- **Saved games** started before v0.4.0 keep their rules and pawn counts, and show their original level name.
- **Testing:** the self-tuned test player is in `source/benchmark/tune.cjs` (opt-in; `--tune`, `--evaluate`, `--selftest`). Five more rules tests (35 in total).

## v0.3.9 · November 14, 2026 · fixes for the GPT v0.3.8 re-audit

- **Initiative, player form:** while a space is open you must choose where the pawn goes, as printed. Forfeiting the whole action is a separate button. On a full display you still move up and the pawn returns to you.
- **Printed rules now match the app**, which is what the difficulty table measured:
  - Migration: each tile either sends or receives during one action.
  - Evolution: the scoring formula is printed.
  - Immigrants: an unplaced pawn first, otherwise the last pawn on the action display.
- **Tests:** four new rules tests (30 in total), including both Initiative cases (an open space and the full 41-space display). The rivals' code is unchanged, so the v0.3.8 difficulty table still applies. See [AUDIT_RESPONSE_v0.3.8.md](AUDIT_RESPONSE_v0.3.8.md).

## v0.3.8 · November 14, 2026 · fixes for the GPT v0.3.7 re-audit

- **Initiative on a full action display:** the marker still advances and the pawn returns to its owner (it was forfeited). This applies to paper rivals, app rivals and the player form. While a space is open, the pawn must still move there, as printed.
- **Evolution:** the shared resolution rejects more than two opponents, a repeated opponent, or more replacements than the gene pool, whoever chooses. The benchmark's frozen player is capped the same way, so it no longer converts up to five opponents.
- **Paper rules now match the printed procedures:**
  - Rank counts every animal on a tile, even below the places that score, so Migration and arrivals no longer skip zero-VP tiles.
  - Competition picks the space with the most shared tiles, and its rank bonus follows the food chain.
  - Evolution only replaces species on tiles the rival matches, trying the next opponent if needed.
  - Depletion only plans a removal it can carry out.
  - Fertile names the whole award.
- **Printables:**
  - Clarified the Initiative, Evolution, Fertile, Depletion, Competition, Habitat, Birds' Migration and d8 wording.
  - Corrected the benchmark example and the Easy description.
  - Headings stay with their tables, and the card PDF is now 6 pages.
- **Tests:** eight new rules tests (each fails on v0.3.7). The full-display test now requires a full display with pawns left over, and the browser game test can play the 26-card deck. See [AUDIT_RESPONSE_v0.3.7.md](AUDIT_RESPONSE_v0.3.7.md).
- **Difficulty:** re-measured with these fixes. The paper rivals got stronger. The pawn counts stay the same, and the level descriptions changed: Easy is a little easier than an even game, Standard a little tougher (25/17/15/11% against an even 33/25/20/17%), Hard matches the app's rivals and Expert is tougher.

## v0.3.7 · November 14, 2026 · fixes for the GPT v0.3.6 audit

- **Migration:** a partial Migration (fewer moves than the allowance) can now be confirmed. In v0.3.6 the empty From picker blocked submission.
- **Evolution:** at most two opposing animals, one cube each, in the player form and for the app's rivals. Only 4–6 animal games were affected.
- **Glaciation and Ice Sheet:** remove every element surrounded by three tundra tiles anywhere on Earth, not only around the covered tile.
- **Player forms:** Aquatic requires its element and corner when one can be placed; on the final turn, Instinct offers only spaces that still run.
- **Paper rules:**
  - Every instruction names the positions, elements, corners, stacks, VP, moves, victims and pawn spaces involved.
  - Instinct can reserve a space for next turn.
  - Aquatic places its element whenever a sea or wetland corner is free.
  - Wasteland Planning and Execution agree: the rival protects an element it uses.
- **Printable rules in the repository:** `paper/Paper_Rivals_Rulebook.{md,html,pdf}` and `paper/Paper_Rivals_Cards.{html,pdf}`, generated by `source/paper/printables.py` from `source/paper/RULES.md` and the app's decks.
- **Paper levels shifted by one pawn:** Easy +0, Standard +1, Hard +2, Expert +3 (v0.3.6 was −1 to +2). The old table overstated the rivals because the benchmark player misread flat matching. Saved v0.3.6 paper games keep their pawn count.
- **Full action display:** if every action space is taken, Planning ends even when players still have pawns (reachable with extra pawns at 4–5 rivals). It used to crash the app rivals and the paper rivals.
- **Benchmark:** a rules adapter lets the pinned player read paper rivals with flat matching. The difficulty table was re-measured on fresh seeds (block 200000).
- **Tests:** four new rules tests, `source/browser_migration_test.py`, and `source/browser_game_test.py` (full games with 2–5 rivals, app or paper rules, through the controls). See [AUDIT_RESPONSE_v0.3.6.md](AUDIT_RESPONSE_v0.3.6.md).

## v0.3.6 · November 14, 2026

- **Paper rules in the app.** The setup screen has a Rival rules choice: App rivals (strongest) or Paper rules (as printed), with Easy, Standard, Hard and Expert (−1 to +2 pawns per rival). Paper games show which Planning step chose each space. App-rival games are unchanged: a 2-rival benchmark is game-for-game identical to v0.3.5. Imports preserve v0.3.5 saves.
- **One paper version.** The detailed paper rules were retired. The paper rules are now the former quick mode plus **Block the leader** (deny the leader's Domination), which curbs the card-chasing strategy. Card list skips pawn cards at 10 pawns. The rivals draw a card at every placement, as the app always did.
- **Difficulty** (seed block 190000): Standard is about an even game at every table size; Hard is close to the app's rivals; Expert is tougher. See [PAPER_RIVALS.md](PAPER_RIVALS.md).
- **Rulebook:** rewritten for the single version, with the audit's wording fixes (opponents in VP order, Evolution's two opponents, Barren Earth) and a printable card appendix.
- The test loader and benchmark load the paper rules the way the build ships them.

## v0.3.5 · November 14, 2026

- The app takes two to five rivals. Setup uses the base game's pawns and cubes for the player count (6/50, 5/45, 4/40, 3/35). With two rivals nothing changes: a 2-rival benchmark run is game-for-game identical to v0.3.4. Imports preserve v0.3.4 saves.
- With more opponents, the rivals' denial weight is shared: the leader keeps its weight and the others split the second weight.
- Benchmark: `--bots 2..5`; stalled games (turn 30+) are scored as they stand and counted as `stalledGames` instead of aborting the run. Tests on 3–5 bots (360 games per cell, seed 160000), scripted-player win rate (an even game is 25/20/17%): the app's rivals 12/9/9%; full paper at +0, +1, +2 pawns 47/41/39%, 28/29/19% and –/18/13%; quick paper at +0 and +1 30/27/25% and 19/21/16%.
- Paper quick mode gains five tested cuts: always the "no" face, simple Adaptation, full Speciation, Migration without rank checks, Glaciation without the tundra bonus (`--paper-options quick`). Across 3,240 games they made the rivals no weaker. Every cut weakened the full rules, so those are unchanged.
- Paper rivals gain a barren-Earth rule: when no animal dominates any tile (after turn 1), a rival places on Abundance first and may take any element. It prevents a rare six-animal stall where no one could take a card.

## Paper rivals · quick mode · November 14, 2026

- Added an optional quick mode for the paper rivals: flat element matching and a fixed card list. It plays about as tough as Expert at the normal 6 pawns (30% scripted-player wins on seed 150000, against 19% for the app's rivals).
- Quick-mode difficulty: 5 pawns easier (48%), 6 normal (30%), 7 hard (25%, close to the app's 19%).
- Added rules for two people plus one paper rival.
- `source/benchmark.cjs` takes `--paper-options`.

## Paper rivals · November 14, 2026

- Added table-playable rival rules for playing without the app: [Paper rivals](PAPER_RIVALS.md). Rules as code in `source/paper/paper.js`, deck tables from `source/paper/decktables.cjs`, and a `--paper N` option on `source/benchmark.cjs`.
- Difficulty is set with extra action pawns per rival: Standard 6, Hard 7, Expert 8. Against a fixed scripted player, Expert comes close to the app's rivals (24–30% player wins, against 22–23%).
- The app itself is unchanged.

## v0.3.4 · November 14, 2026 · merged by owner decision despite a narrowly failed guard

- Rivals now block. Every open space in Planning gets a small bonus for how much it would cost the leading opponent to lose it, counted only when that opponent has no equally good space left in the same row. Blocks went from almost none to about 3.2 per rival per game; each block is also a space the blocker can use, and 40% of them target the player.
- Guard (seed 110000, 540 games): scripted player wins 115 → 134 (+3.5 points, interval −0.9 to +7.9), just over the 3-point limit. The player's mean margin eased from −43.4 to −36.6 VP. No animal lost more than 6 of 180 rival wins. See [benchmark results](BENCHMARK_RESULTS.md).
- Imports preserve v0.3.3 saves.

## v0.3.3 · November 13, 2026 · merged by owner decision despite a failed guard

- Rival Planning now values Wanderlust with the same evaluator used to place the tile, instead of a flat 2.5 whenever a tile was on offer. Rivals play Wanderlust about 3–5 more times per game.
- Guard (seed 90000, 540 games): scripted player wins 131 → 113 (−3.3 points, interval −8.3 to +1.6), but the player's mean margin went from −27.9 to −42.3 VP. Birds rival wins fell 65 → 50 of 180, over the 13-win limit, so the change failed its guard. Mammals gained 18 wins and Reptiles 7. See [benchmark results](BENCHMARK_RESULTS.md).
- Imports preserve v0.3.2 saves.

## v0.3.2 · November 13, 2026

- Recalibrated five rival deck checks that were almost always true or almost always false, so both faces of those cards now get played. True rates (seed 6200): `ice` 99% → 38%, `contested` 98% → 66%, `cone` 96% → 64%, `front` 94% → 65%, `foothold` 5% → 31%. Updated the check descriptions shown on the Bot decks page.
- Card rows were not changed. Faces that were nearly dormant before are now played often, and their rows have not been tuned.
- Guard benchmark (seed 80000, 360 games): scripted player wins 90 → 79 (−3.1 points, interval −8.9 to +2.8). Birds rival wins fell 47 → 37 of 120, exactly at the acceptance limit. Larger Birds drops on two earlier blocks came from a first `foothold` definition that was discarded. See [benchmark results](BENCHMARK_RESULTS.md).
- Imports preserve v0.3.1 saves.

## v0.3.1 · November 13, 2026

- Rewrote the rows on several Insects and Amphibians rival card faces. Insects no longer lead with Glaciation or Wanderlust on their most-drawn faces and favor Domination, Migration and Adaptation; Amphibians lean less on Abundance and Glaciation. Card titles, checks and focuses are unchanged.
- Effect is small and uncertain. On the untouched confirmation block (seed 50000, 360 games) Insect rival wins went 35 → 36 of 120 and Amphibian 38 → 41; the scripted player's win rate changed by −0.8 points (95% interval −5.6 to +3.9). An earlier fresh block (seed 40000) showed about +8 points for each animal. See [benchmark results](BENCHMARK_RESULTS.md).
- Imports preserve v0.3.0 saves.

## v0.3.0 · November 13, 2026

- Added a repeatable benchmark with fixed player strategies, paired supplies, per-animal results, score margins, and forfeit causes.
- Rival planning now accounts for the same animal’s earlier Speciation placements and remaining display room for Adaptation. It can use a weak fallback placement to deny a useful action space to the leading rival.
- Wasteland forecasts now account for the one disk that can be removed. Duplicate disks of the same type still threaten matching tundra corners.
- Setup shows where all 50 cubes go. The six pawns and 45 starting gene-pool cubes were already correct under GMT's rules.
- Tap element colors to enter the physical draw. A correction preserves the other disks’ positions. Unfinished draw, tile and card entries survive reload and export/import.
- Imports preserve v0.1.0 and v0.2.0 game state, including unfinished engine steps.

Verification used Node.js 24 and offline Chromium with a 390 px touch viewport. The [benchmark results](BENCHMARK_RESULTS.md) distinguish rules checks, simulated results, and open physical playtesting.
