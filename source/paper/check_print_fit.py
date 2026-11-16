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

# v0.5.7 (GPT's v0.5.6 re-audit): the PDFs must come from the current sources. `printables.py` without --pdf leaves the old
# PDFs in place, so check their text: the version, every card reminder and the legend, and every paragraph and list item
# of the rulebook's prose (tables are left to verify-printables.py, whose text extraction handles their columns).
import html as _html, re as _re, sys as _sys
from pypdf import PdfReader
_sys.path.insert(0, str(Path(__file__).resolve().parent))
import printables as P

def _flat(text):
    return _re.sub(r"\s+", "", _html.unescape(text)).replace("­", "")

def _pdf(name):
    return _flat(" ".join(page.extract_text() or "" for page in PdfReader(str(PAPER / name)).pages))

ver = P.version()
book, cards, aids = _pdf("The_Red_Queen_Rulebook.pdf"), _pdf("The_Red_Queen_Cards.pdf"), _pdf("The_Red_Queen_Player_Aids.pdf")
stale = []
if _flat(f"Version {ver}") not in book: stale.append(("rulebook", "version " + ver))
if _flat(f"version {ver}") not in aids: stale.append(("player aids", "version " + ver))
card_html = (PAPER / "The_Red_Queen_Cards.html").read_text(encoding="utf-8")
lines = [x for x in list(P.CARD_TARGET.values()) + [P.LEGEND] if _html.escape(x) in card_html or x in card_html]
for line in lines:
    for name, text in (("cards", cards), ("rulebook", book)):
        if _flat(line) not in text: stale.append((name, line))
source = (PAPER / "The_Red_Queen_Rulebook.html").read_text(encoding="utf-8")
source = source[:source.index("<h2>Appendix")]
blocks = [_re.sub(r"<[^>]+>", "", b) for b in _re.findall(r"<(?:p|li)>(.*?)</(?:p|li)>", source, _re.S)]
for block in blocks:
    if len(block) > 20 and _flat(block) not in book: stale.append(("rulebook", block[:70]))
for marker in ("Added elements:", "Keep half-points exactly; do not round."):
    if _flat(marker) not in aids: stale.append(("player aids", marker))
assert not stale, f"{len(stale)} stale PDF passages, e.g. {stale[:4]}; rerun python3 source/paper/printables.py --pdf"
print(f"PASS the three PDFs match the current sources: version {ver}, {len(lines)} card lines, {len(blocks)} rulebook passages")
