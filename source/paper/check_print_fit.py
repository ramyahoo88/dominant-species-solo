"""Nothing on a printed card or player aid may be cut off: every card (fronts and backs) and every aid sheet is checked
for content taller than its box, in print layout. Usage: python3 source/paper/check_print_fit.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright

PAPER = Path(__file__).resolve().parents[2] / "paper"
CHECKS = [("The_Red_Queen_Cards.html", ".card", 96), ("The_Red_Queen_Rulebook.html", ".card", 96),
          ("The_Red_Queen_Player_Aids.html", ".page", 10)]
JS = """sel => [...document.querySelectorAll(sel)].map((el, i) => {
  const inner = el.querySelector('.inner') || el;
  return {i, over: Math.max(el.scrollHeight - el.clientHeight, inner.scrollHeight - inner.clientHeight),
          text: (el.innerText || '').slice(0, 60).replace(/\\s+/g, ' ')};
}).filter(x => x.over > 1)"""
with sync_playwright() as pw:
    browser = pw.chromium.launch(args=["--no-sandbox"])
    page = browser.new_page()
    page.emulate_media(media="print")
    failures = []
    for name, sel, expected in CHECKS:
        page.goto((PAPER / name).as_uri())
        n = page.evaluate("s => document.querySelectorAll(s).length", sel)
        assert n == expected, (name, sel, n, expected)
        failures += [(name, x) for x in page.evaluate(JS, sel)]
    browser.close()
assert not failures, failures
print("PASS no clipped content: 96 cards (card sheet), 96 cards (rulebook), 10 aid sheets")
