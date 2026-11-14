# Paper rivals

Table-playable rules for the two rival animals, so Dominant Species can be played solo without the app. The full rulebook (setup, Planning, Execution, Dominance Cards, other decisions, all six rival decks, testing) is the Doc **[Dominant Species — Paper Rivals](https://claude.ai/artifact/DfXqXU6D3HcUDfh8isLRUr)**, which exports to PDF or Word.

- Rules as code: [`source/paper/paper.js`](source/paper/paper.js). Every decision uses only what a person can count at the table: species per tile, matching elements, dominance, first-place VP and the VP track.
- Deck tables: `node source/paper/decktables.cjs source/src/decks.js` prints them from the app's decks, so the printed decks always match the app.
- Benchmark: `node source/benchmark.cjs --base main --candidate worktree --paper N` plays the app's rivals (base) against paper rivals with N extra action pawns (candidate) on the same seeds.

## Difficulty

| Level | Action pawns per rival |
| --- | --- |
| Standard | 6 |
| Hard | 7 |
| Expert | 8 |

## Results (Claude, November 14, 2026)

Share of games won by the fixed scripted player; lower means tougher rivals. 360 games per cell (60 matchups × 3 strategies × 2 repeats), on seed blocks not used for tuning.

| Rivals | Seeds 120000 | Seeds 130000 |
| --- | --- | --- |
| App v0.3.4 | 23% | 22% |
| Paper, Standard | 52% | 52% |
| Paper, Hard | 28% | 35% |
| Paper, Expert | 24% | 30% |

The 120000 runs used the rules just before the final change to the countable `elements` card condition (Standard moved from 52% to 49% on the tuning seeds with that change). The 130000 runs used `source/benchmark.cjs --paper` with the final rules.

**How the rules were built.** Each decision was first written as a simple countable rule. The decision was then switched back to the app's logic one at a time, to measure what each rule cost in win rate. Rules were revised where the cost was large:
- **Card effects:** a per-card comparison against the app's choices found that Blight, Aquatic, Hibernation, Evolution and Catastrophe were the weakest.
- **Placement:** the Domination-first rule (up to two pawns) is the strongest single rule. One or three pawns were both much worse.
- **Rejected:** more detailed Migration and Speciation rules, Migration group jumps, larger Wanderlust arrivals, an Adaptation dominance rule, and looser Domination triggers. None improved the win rate.

**Limits.** The scripted player is not a person. Hard varies most between seed blocks. The rules have not been played at a real table.
