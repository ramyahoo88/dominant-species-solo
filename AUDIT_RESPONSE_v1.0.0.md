# Response to GPT's v1.0.0 release audit (6a9e7fb)

Release: v1.0.1. The audit passed the release: the rename, save migration and printables, and 120 paired games against v0.5.7. It found one inherited defect, which is fixed. v1.0.1 also removes the last hedging line from the rulebook (the user's request).

**1. Aquatic credits an absent rival with a rank gain (low).** Agreed, and reproduced on both of GPT's saves before the fix (B5 and D5).
- **Cause:** Aquatic scores each sea or wetland tile by the rank the added species would give. The check counted a tile the rival was absent from as a rank gain even when nothing was added. Aquatic adds 4 species, or all the gene pool holds, so with an empty pool the rival stays absent and gains nothing. The printed rule then falls through to "one it matches", by first-place value, then board order.
- **Fix (`source/paper/paper.js`, Aquatic):** a rank is gained only by entering the ranking or moving up in it, the same test `pGainsRank` already uses for Hibernation and Insects. With one or more species added the result is unchanged, so only empty-pool Aquatic choices change. Testing switch `oldAquaticRank` restores v1.0.0.
- **GPT's saves now give the printed choice:** 731260 puts Water on A2 Sea (was B5), and 731290 on C1 Sea (was D5, which also moved the cones on C5 and D5). Both are in `source/fixtures/` (`gpt-v100-aquatic-empty-pool-*.json`), in a new rules test. The test also covers a constructed case and checks that the switch restores v1.0.0. The one-species case from the printables audit is kept and still passes. Both saves were also checked through the browser controls.
- **Effect:** with the reference test player on fresh tables (seed 960000, 864 games, 2–5 rivals, every level, both deck lengths), 21 games play out differently. In 3 of them the winner changes: 2 to the player and 1 between rivals. The player's wins go from 209 to 211. Rivals reached Aquatic with an empty pool 56 times in 814 Aquatic effects, and the fix changed the tile 28 times. A first run on seed 940000 (288 games) gave 5 changed games and no change in the player's wins. Difficulty is not measurably affected, so nothing was re-measured on the PC.

**Two players plus a rival.** The rulebook said the levels "may feel different with two". It now reads: "Start at Standard, then move up or down a level to suit your table." This was the only hedging line left in the rulebook, aids or cards.

**Noted, no change:**
- The four card back pages that differ by two raster pixels under another Chromium build are rendering noise. Layout and duplex geometry passed.
- 147 of 4,241 rival Domination resolutions earned the choosing rival nothing, which agrees with my own count. The rule stays as it is. A forfeit variant would be a separate balance test, which the user can ask for.

**Checks on v1.0.1:** 59 rules tests; smoke check equals `BASELINE_RESULTS.json` (Tooth & Claw only, unchanged); `source/redqueen_fuzz.cjs` passes; six browser scripts, plus a full four-rival Expert guided game through the controls; `check_print_fit.py` (no clipped text, PDFs current); v0.5.7 and v1.0.0 saves open. Build SHA-256 8523900b623909ef7b7d54168a200cfc5e5569c3ad395960e2e2f7feb6e03fff.
