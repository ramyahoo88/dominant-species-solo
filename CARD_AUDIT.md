# Dominance Card audit (Claude, November 13, 2026)

Each card's implementation in `source/src/effects.js` (bot choices and resolution) and `source/src/forms.js` (human entry) was compared against the rulebook's card clarifications, as reproduced by UltraBoardGames and board-game-rules.com. The remaining cards were then checked against the printed card text, from the card images in a Vassal module.

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

## Checked against the printed cards

The printed text of all 26 cards and the Survival card was read from the card images in the Vassal module *DominantSpecies v5.2* (provided by the owner). Every card the clarifications could not settle matches the app:

| Card | Printed card (paraphrased) | App |
|---|---|---|
| Aquatic | Chosen element onto a sea or wetland tile; up to 4 species from the gene pool onto that tile | Matches |
| Biomass | 1 species eliminated on each tile with more species than elements | Matches: species compared with element disks; the chooser picks the victim |
| Blight | Remove all but one element from a chosen tile | Matches: one disk is kept |
| Disease | Each animal with more elements than yours loses 1 element of its choice | Matches: disks counted; printed elements protected per the rulebook |
| Ecodiversity | 1 VP per element disk on earth matching an element type on your animal | Matches |
| Evolution | Up to two opposing animals; replace one species of each, anywhere, with yours | Matches: one per opponent |
| Hibernation | Up to 5 eliminated species onto any one tile; safe from Extinction this turn | Matches |
| Ice Age | Each animal scores bonus VP for the tiles it dominates; last turn | Matches |
| Immigrants | Each animal loses 1 element, or 1 AP, or all but one species per tile | Matches. The card does not say which pawn is lost; the human form lets you pick, and bots give up the last one placed. |
| Niche Biomes | Each animal with more VP than yours loses the first-place value of the tile just scored | Matches |
| Nocturnal | Move 1 space forward on the Initiative track | Matches |
| Symbiotic | Your animal and each animal with fewer elements gain 1 random element | Matches; the six-element display limit also applies |
| Survival | To the animal with the most species on tundra; bonus VP in Reset for tundra tiles occupied | Matches; no award on a tie, per the rulebook |

**Result:** all 26 Dominance Cards and the Survival card agree with the app. No code changes are needed.

## Sources

- [UltraBoardGames: Dominant Species cards](https://ultraboardgames.com/dominant-species/cards.php)
- [Board Game Rules: Dominant Species card clarifications](https://board-game-rules.com/boardgames/dominant-species/)
- [BGG: Immigrants option (c) with no change](https://boardgamegeek.com/thread/582176/immigrants-dominance-card-can-a-player-choose-c-if)
- [BGG: Catastrophe text](https://boardgamegeek.com/thread/834094/catastrophe)
- Vassal module *DominantSpecies v5.2*: card images (printed card text)
