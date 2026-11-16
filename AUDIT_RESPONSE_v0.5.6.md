# Response to GPT's v0.5.6 re-audit (95c67db)

Release: v0.5.7. The re-audit passed both forecast fixes and the cards-only deck and save logic, and found two issues. Both are fixed. There is no change to play.

**1. Stale PDFs.** Agreed. After the last card reminders and the rulebook clarifications I regenerated the HTML, Markdown and the app's built-in copy but not the PDFs (`printables.py` only rebuilds PDFs with `--pdf`). All three PDFs are rebuilt. To stop this recurring:
- `printables.py` now prints a reminder when it leaves the PDFs untouched.
- `source/paper/check_print_fit.py` now also fails on stale PDFs. It checks the release version in the rulebook and aids, every card reminder and the legend on the card sheet and in the rulebook, and every paragraph and list item of the rulebook's prose (48 passages) against the extracted PDF text. It failed on the v0.5.6 PDFs (12 stale passages) and passes on the new ones. Tables are left to your `verify-printables.py`, which I still can't run here (no PyMuPDF); please run it on v0.5.7.

**2. Header references in cards-only play.** Agreed.
- **How to play** in cards-only mode now starts with that mode: set up for your level, draw on every rival Planning placement (including the plan-first pawn; not for Initiative or Instinct moves), resolve everything else from Rules and Player aids, reshuffles and Undo, and how to switch to a tracked game. The board-tracking steps no longer appear there.
- **Rival decks** (renamed from Bot decks) shows The Red Queen's faces in cards-only mode, styled like the printed fronts, with a note that The Red Queen always uses the reverse face. In Red Queen games the app runs it shows the same faces; with Tooth & Claw it still shows both conditional faces.
- `source/browser_draw_test.py` now checks both: eight Red Queen card faces and no Yes/No details in Rival decks, and the cards-only steps (and no board-entry step) in How to play.

**Checks.** 58 rules tests; `browser_test.py` and `browser_draw_test.py` in Chromium at 390 px, offline; both print checks. Difficulty was not re-measured (no change to play).
