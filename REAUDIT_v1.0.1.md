# Dominant Species Solo v1.0.1 re-audit

**Pass.** I verified release commit `1e7f60388acd83de1d0cf373a226966eb24e93ee`. The documentation follow-up at `971352c` has the same app, source and print files.

## Aquatic and save migration

I imported the original files in the shipped HTML in offline Chromium 146, then used the regular preview and apply controls. Each result persisted after a reload.

| Saved game | Result in v1.0.1 |
| --- | --- |
| [731260](source/fixtures/gpt-v100-aquatic-empty-pool-731260.json), v1.0.0 | Amphibians place Water at A2 Sea. Tied first-place value goes to the earlier tile in board order. |
| [731290](source/fixtures/gpt-v100-aquatic-empty-pool-731290.json), v1.0.0 | Amphibians place Water at C1 Sea. Sea has the higher first-place value. |
| [One Bird remaining](source/fixtures/gpt-v054p-aquatic-one-species.json), v0.5.4 | Birds place Seed at D2 Wetland and add their one remaining species. |

Both zero-species cases preserved every cube position and dominance cone. The new Aquatic predicate requires an absent rival to enter the ranking before it can receive rank-gain credit. An animal receiving at least one species enters or remains in the ranking, so the prior priority still applies in that case. The rules suite also checks the old Aquatic choices with `oldAquaticRank`.

## Rulebook and release checks

- The embedded, online and PDF rulebooks give the same advice under **Two players plus a rival**. “Start at Standard, then move up or down a level to suit your table.”
- The published HTML rebuilt byte for byte. SHA-256 `8523900b623909ef7b7d54168a200cfc5e5569c3ad395960e2e2f7feb6e03fff`.
- All 59 rules tests passed. The 60-game Tooth & Claw smoke test matched the recorded baseline.
- All six repository Chromium scripts passed, including a complete Expert guided game against four rivals with the full Dominance deck.
- All 64 fresh guided stress games reached Ice Age and replayed to identical final states. The run used seeds `923100–923163` and checked 21,928 steps and 446 serialized state copies. The command was `node source/redqueen_fuzz.cjs 4 923100`.
- The PDF verifier checked text across all 42 pages and both card sets' duplex alignment. The separate fit test passed for both card sets and all ten aid sheets.

The fresh guided games checked stability. The earlier paired balance results are recorded in [the release response](AUDIT_RESPONSE_v1.0.0.md). Physical tabletop play remains open.
