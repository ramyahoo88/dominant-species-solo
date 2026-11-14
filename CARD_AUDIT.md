# Dominance Card audit (Claude, November 13, 2026)

Each card's implementation in `source/src/effects.js` (bot choices and resolution) and `source/src/forms.js` (human entry) was compared against the rulebook's card clarifications, as reproduced by UltraBoardGames and board-game-rules.com. The printed card texts are not available online, so cards whose exact numbers or targets appear only on the card are listed separately, with what the app currently assumes.

The deck has 26 cards, matching the rulebook. No code was changed.

## Consistent with the rulebook clarifications

| Card | App behavior | Matches |
|---|---|---|
| Biodiversity | 1 VP per occupied tile with any opposing species | 1 VP per tile, not per opposing species |
| Catastrophe | Chosen tile keeps one species of the chooser's choice; one species removed on each adjacent tile, own if alone | Chooser picks; adjacent removal mandatory |
| Cold Snap | Each other animal loses one species on each tundra tile | Exact |
| Fecundity | +1 species per occupied tile; the player picks tiles if the pool is short | Exact |
| Fertile | 1 VP per species, of any animal, on one chosen occupied tile | Exact |
| Habitat | Element chosen from the bag onto a vacant corner | Chosen, not drawn |
| Ice Sheet | Normal Glaciation | Exact |
| Immigrants | Each animal, in food-chain order, loses an added element, an action pawn, or all but one species per tile; the element option is unavailable with only printed elements; the third option is allowed even when nothing changes | Exact (third option per BGG ruling) |
| Instinct | Available pawn onto any vacant space; runs this turn if not yet reached | Exact |
| Intelligence | Chooser plus every animal above it in the food chain gain a pawn | Exact |
| Parasitism | Chooser plus every animal below it in the food chain gain a pawn | Exact |
| Omnivore | Chooser gains a pawn | Exact |
| Mass Exodus | All species leave the tile for adjacent tiles; the human form allows splitting | Exact. Bots never split, a legal simplification. |
| Metamorphosis | Swap one added element for one chosen from the bag | Exact |
| Predator | One opposing species per occupied tile; never own; a different opponent may be picked per tile | Exact |
| Ice Age (end sequence) | Finish the turn, Extinction, Survival, skip Reseed, score every tile | Exact |

## Not verifiable without the printed card

| Card | What the app assumes | To check on the card |
|---|---|---|
| Aquatic | One chosen element on a vacant corner of a sea or wetland tile, then **up to 4** species onto **that same tile** | Species count; whether the species may go on a different sea or wetland tile |
| Biomass | A tile is overcrowded when its species outnumber its element disks; **one** species is eliminated per overcrowded tile | The overcrowding test and how many are eliminated |
| Blight | A tile with 2+ disks keeps **one disk**; the rest are removed | One disk, or one element type? |
| Disease | Every animal with more elements than yours (printed + added, counted as disks) loses one added element | Disks or element types? |
| Ecodiversity | 1 VP per element disk on earth whose type is on your display | The scoring rule (the clarification only says Sun counts once) |
| Evolution | Replace up to **one species of each opponent**, anywhere, from your gene pool | Total count; whether two can come from the same opponent |
| Hibernation | Up to **5** eliminated species onto **one tile**, safe from Extinction this turn | Count, which tiles, Extinction protection |
| Ice Age (VP) | Every animal earns bonus VP (1, 3, 6, 10 …) for the tiles it dominates | The VP rule |
| Immigrants (pawn) | If all pawns are on the board, the most recently placed one is removed | Where the lost pawn comes from |
| Niche Biomes | Every animal with more VP than yours loses the scored tile's first-place value | Who loses VP and how much |
| Nocturnal | Move up one space on the Initiative track | One space, or to the front? |
| Symbiotic | You and each animal with fewer total elements draw one random element (display cap 6) | Recipients and the cap |

## Sources

- [UltraBoardGames: Dominant Species cards](https://ultraboardgames.com/dominant-species/cards.php)
- [Board Game Rules: Dominant Species card clarifications](https://board-game-rules.com/boardgames/dominant-species/)
- [BGG: Immigrants option (c) with no change](https://boardgamegeek.com/thread/582176/immigrants-dominance-card-can-a-player-choose-c-if)
- [BGG: Catastrophe text](https://boardgamegeek.com/thread/834094/catastrophe)
