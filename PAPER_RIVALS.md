# Paper rivals

Table-playable rules for the two rival animals, so Dominant Species can be played solo without the app. The full rulebook (setup, Planning, Execution, Dominance Cards, other decisions, all six rival decks, testing) is the Doc **[Dominant Species — Paper Rivals](https://claude.ai/artifact/DfXqXU6D3HcUDfh8isLRUr)**, which exports to PDF or Word.

- Rules as code: [`source/paper/paper.js`](source/paper/paper.js). Every decision uses only what a person can count at the table: species per tile, matching elements, dominance, first-place VP and the VP track.
- Deck tables: `node source/paper/decktables.cjs source/src/decks.js` prints them from the app's decks, so the printed decks always match the app.
- Benchmark: `node source/benchmark.cjs --base main --candidate worktree --paper N` plays the app's rivals (base) against paper rivals with N extra action pawns (candidate) on the same seeds.

## Quick mode and two-player games

- **Quick mode** (optional, 6 pawns) cuts the rivals' upkeep. It uses flat element matching (printed count plus added elements, capped by the disks on the tile) and a fixed card list instead of card scoring. On seed 150000 the scripted player won 30% (107/360), against 19% (70/360) against the app's rivals on the same seeds. On the tuning seeds it was 34%. Quick-mode difficulty is set by pawns: on seed 150000 the scripted player won 48% at 5 pawns (`--paper=-1`), 30% at 6 and 25% at 7 (`--paper 1`); 7 pawns is within noise of the app's rivals. Run it with `--paper 0 --paper-options flatMatch,cardList`.
- **Two players plus a rival:** the rules work unchanged with two people and one rival, because "leader" means whichever opponent leads on VP.
- **Rejected at 6 pawns** (seed 6200, 360 games each; Standard was 49%):
  - a fixed-position Dominance Card pick: 64%
  - one generic effect for every card: 82%
  - a center-out clockwise tie-breaker: 57%
  - the card list with real matching: 56%

## Three to five rivals

Use the base game's pawns and cubes for the player count, and add difficulty pawns on top (+0 Standard, +1 Hard, +2 Expert; quick mode −1/+0/+1). Results on seed block 160000, 360 games per cell; an even game is 25%, 20% and 17%:

| Rivals | App | Full +0 | Full +1 | Full +2 | Quick +0 | Quick +1 |
|---|---|---|---|---|---|---|
| 3 | 12% | 47% | 28% | – | 30% | 19% |
| 4 | 9% | 41% | 29% | 18% | 27% | 21% |
| 5 | 9% | 39% | 19% | 13% | 25% | 16% |

Quick mode now includes five cuts (always the "no" face, simple Adaptation, full Speciation, Migration without rank checks, Glaciation without the tundra bonus). Single-cut results on seed 6200 (quick base 34%): 31%, 33%, 32%, 35%, 36%. Combined across 2–5 rivals they average the same as the two-change version. Cuts that weakened the rivals and were dropped: "yes" face 39%, leftmost space 38%, simple Competition 38%, simple card effects 45%, no Wanderlust element 51%, no Domination-first 67%. Every cut weakened the full rules (52–91% against 49%).

## Difficulty

| Level | Action pawns per rival |
| --- | --- |
| Standard | 6 |
| Hard | 7 |
| Expert | 8 |

## Results (Claude, November 14, 2026)

Share of games won by the fixed scripted player; lower means tougher rivals. 360 games per cell (60 matchups × 3 strategies × 2 repeats), on seed blocks not used for tuning.

| Rivals | Seeds 120000 | Seeds 130000 | Seeds 140000 |
| --- | --- | --- | --- |
| App v0.3.4 | 23% | 22% | 22% |
| Paper, Standard | 52% | 52% | not run |
| Paper, Hard | 28% | 35% | 37% |
| Paper, Expert | 24% | 30% | 28% |

The 120000 runs used the rules just before the final change to the countable `elements` card condition (Standard moved from 52% to 49% on the tuning seeds with that change). The 130000 and 140000 runs used `source/benchmark.cjs --paper` with the final rules.

**How the rules were built.** Each decision was first written as a simple countable rule. The decision was then switched back to the app's logic one at a time, to measure what each rule cost in win rate. Rules were revised where the cost was large:
- **Card effects:** a per-card comparison against the app's choices found that Blight, Aquatic, Hibernation, Evolution and Catastrophe were the weakest.
- **Placement:** the Domination-first rule (up to two pawns) is the strongest single rule. One or three pawns were both much worse.
- **Rejected:** more detailed Migration and Speciation rules, Migration group jumps, larger Wanderlust arrivals, an Adaptation dominance rule, and looser Domination triggers. None improved the win rate.

**A shared priority test (tested, rejected).** One test was applied to every action and card choice, looking only at the tiles each option touched, with the existing rule breaking ties. It asked about first place gained, dominance gained, and first place or dominance taken from the leader. At 6 pawns on seed 6200 (360 games), it made the rivals weaker: the scripted player went from 49% to 57%. Adding the terms into one score gave 54%, and dropping the veto on losing first place gave 57%. Judging each choice only by the tiles it touches misses what the per-action rules already capture: species kept spread out for later scoring, cards and Survival.

**Limits.** The scripted player is not a person. Hard varies most between seed blocks. The rules have not been played at a real table.
