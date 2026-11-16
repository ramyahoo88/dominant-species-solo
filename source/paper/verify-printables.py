"""Verify the rulebook, cut-out cards and all player aids against their sources.

python3 source/paper/verify-printables.py [REPO] --output-dir DIR --rebuild
Requires PyMuPDF; rebuilding also needs the producer's markdown dependency.
--rebuild-pdfs additionally needs Playwright/Chromium. PDF metadata is ignored.

This verifies publication fidelity, card identity/order and generated data. It
does not prove that hand-written prose implements the JavaScript rules.
"""
import argparse
from collections import Counter
from html.parser import HTMLParser
import hashlib
import json
import os
from pathlib import Path
import re
import runpy
import subprocess
import sys
import unicodedata

import fitz


def normal(text):
    # CSS uppercases headings; PDF line wrapping and ligatures are cosmetic.
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text).casefold())


class Node:
    def __init__(self, tag, attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def text(self):
        return "".join(c.text() if isinstance(c, Node) else c for c in self.children)

    def all(self, tag=None, cls=None):
        for child in self.children:
            if isinstance(child, Node):
                if (tag is None or child.tag == tag) and (cls is None or cls in child.attrs.get("class", "").split()):
                    yield child
                yield from child.all(tag, cls)


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self.current = self.root
        self.feed(text)
        self.body = next(self.root.all("body"))

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in {"meta", "br", "hr", "img", "link", "input", "wbr"}:
            self.current = node

    def handle_endtag(self, tag):
        node = self.current
        while node.parent is not None:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent

    def handle_data(self, data):
        self.current.children.append(data)


def marker_text(node, book=False):
    """Add only the list markers actually printed by Chromium's CSS."""
    markers = []
    for ol in node.all("ol"):
        count = len([c for c in ol.children if isinstance(c, Node) and c.tag == "li"])
        suffix = "" if book and ol.parent.tag == "body" else "."
        markers.extend(str(i) + suffix for i in range(1, count + 1))
    return "".join(markers)


def text_fidelity(node, pdf_text, label, book=False):
    expected = normal(node.text() + marker_text(node, book))
    actual = normal(pdf_text)
    # CSS-positioned step numbers are extracted after their text; columns also
    # change extraction order. Preserve every character, and additionally check
    # complete rows, paragraphs and leaf list items in their original order.
    missing, extra = Counter(expected) - Counter(actual), Counter(actual) - Counter(expected)
    assert not missing and not extra, f"{label}: missing {dict(missing)}, extra {dict(extra)}"
    blocks = []
    for b in node.all():
        if b.tag not in {"p", "h1", "h2", "h3", "h4", "tr", "li"}:
            continue
        if b.tag == "li" and any(b.all("li")):
            continue
        value = normal(b.text())
        if value:
            assert value in actual, f"{label}: missing/reordered block: {b.text()[:160]}"
            blocks.append(value)
    return {"characters": len(expected), "orderedBlocks": len(blocks)}


def strip_continuation_headers(doc, body):
    # A repeated header is removable only at a page start and only when the
    # PDF has more copies than the source. Do not assume a fixed page count.
    headers = [normal(h.text()) for h in body.all("thead")]
    expected = Counter(headers)
    texts = [p.get_text() for p in doc]
    excess = {h: normal("".join(texts)).count(h) - n for h, n in expected.items()}
    removed = []
    for i, text in enumerate(texts):
        for h in expected:
            if i == 0 or excess[h] <= 0 or not normal(text).startswith(h):
                continue
            end = 0
            while len(normal(text[:end])) < len(h):
                end += 1
            assert normal(text[:end]) == h
            removed.append({"page": i + 1, "header": text[:end].strip()})
            texts[i] = text[end:]
            excess[h] -= 1
            break
    return "\n".join(texts), removed


def card_faces(doc, start, decks, animals, label):
    checked = []
    for i, animal in enumerate(animals):
        page = doc[start + i]
        assert page.rect.width == 612 and page.rect.height == 792, f"{label}: not Letter"
        assert normal(animal + " cards") in normal(page.get_textbox(fitz.Rect(0, 0, 612, 45)))
        # Discover the dashed cut lines, not the former table appendix or a
        # hard-coded heading offset. The physical cards remain 3.5 x 2.4 in.
        lines = [d["rect"] for d in page.get_drawings()
                 if abs(d["rect"].width - 252) < .1 and 0 < d["rect"].height <= 1]
        xs = sorted({round(r.x0, 2) for r in lines})
        ys = sorted({round(r.y0, 2) for r in lines})
        assert len(xs) == 2 and len(ys) == 8, f"{label} {animal}: missing cut lines"
        tops = ys[::2]
        for slot, card in enumerate(decks[animal]):
            x, y = xs[slot % 2], tops[slot // 2]
            rect = fitz.Rect(x, y, x + 252, y + 172.5)
            expected = animal + str(slot + 1) + card["title"] + "".join(
                f"{n}. {row.title()}" for n, row in enumerate(card["no"]["rows"], 1)
            ) + "Paper Rivals · try the actions in order"
            assert normal(page.get_textbox(rect)) == normal(expected), f"{label} {animal} card {slot + 1}"
            checked.append({"page": start + i + 1, "animal": animal, "card": slot + 1,
                            "title": card["title"], "actions": card["no"]["rows"]})
    return checked


def verify(repo, output, rebuild=False, rebuild_pdfs=False):
    paper = repo / "paper"
    code = """const fs=require('node:fs'),vm=require('node:vm');
    let c=vm.createContext({});
    for(const f of ['data','decks']) vm.runInContext(fs.readFileSync(process.argv[1]+'/source/src/'+f+'.js','utf8'),c);
    console.log(vm.runInContext('JSON.stringify({version:VERSION,decks:DECKS,animals:ANIMALS,setup:SETUP_BY_PLAYERS,terrain:TERRAIN})',c));"""
    data = json.loads(subprocess.check_output(["node", "-e", code, str(repo)]))
    animals, decks = list(data["animals"]), data["decks"]
    names = ["Rulebook", "Cards", "Player_Aids"]
    docs = {n: fitz.open(paper / f"Paper_Rivals_{n}.pdf") for n in names}
    htmls = {n: Document((paper / f"Paper_Rivals_{n}.html").read_text()).body for n in names}
    cards, book, aids = (docs[n] for n in ["Cards", "Rulebook", "Player_Aids"])
    appendix = [i for i, p in enumerate(book) if normal(p.get_text()).startswith(normal(animals[0] + " cards · cut along"))]
    assert len(appendix) == 1, "Cannot uniquely locate the first appendix card page"
    start = appendix[0]
    assert len(cards) == len(animals) and len(book) - start == len(animals), "Expected one standalone and appendix card page per animal"
    standalone_faces = card_faces(cards, 0, decks, animals, "standalone")
    appendix_faces = card_faces(book, start, decks, animals, "appendix")
    appendix_pixels = []
    for i in range(len(animals)):
        assert normal(cards[i].get_text()) == normal(book[start + i].get_text()), "Appendix card page differs"
        appendix_pixels.append(cards[i].get_pixmap().samples == book[start + i].get_pixmap().samples)
    note = f"Generated from source/src/decks.js for app v{data['version']}."
    assert note in cards[-1].get_text() and note in book[-1].get_text()
    ruletext, headers = strip_continuation_headers(book, htmls["Rulebook"])
    fidelity = {"rulebook": text_fidelity(htmls["Rulebook"], ruletext, "rulebook", book=True),
                "cards": text_fidelity(htmls["Cards"], "\n".join(p.get_text() for p in cards), "cards")}
    aid_pages = list(htmls["Player_Aids"].all(cls="page"))
    assert len(aid_pages) == len(aids) == 4 + len(animals), "Expected four references plus one aid per rival"
    for i, (node, page) in enumerate(zip(aid_pages, aids)):
        assert f"Player aid {i + 1} of {len(aids)} · app v{data['version']}" in page.get_text()
        fidelity[f"aid{i + 1}"] = text_fidelity(node, page.get_text(), f"aid {i + 1}")
    # Check each table separately: a Planning row must not conceal a missing
    # Execution row with the same name (the producer's global search can).
    rules = (repo / "source/paper/RULES.md").read_text()
    table_checks = []
    for aid_index, heading in [(0, "| Action | Has a target when |"),
                               (1, "| Action | What the rival does |"),
                               (2, "| Card | The rival chooses |")]:
        block = rules.split(heading, 1)[1].split("\n\n", 1)[0]
        expected = [normal(line.split("|")[1]) for line in block.splitlines()
                    if line.startswith("| ") and not line.startswith("| ---")]
        table = next(aid_pages[aid_index].all("table"))
        actual = [normal(next(row.all("td")).text()) for row in table.all("tr") if any(row.all("td"))]
        assert actual == expected, f"Aid {aid_index + 1} table rows: {actual} vs {expected}"
        table_checks.append({"aid": aid_index + 1, "rows": len(actual)})
    paper_code = (repo / "source/paper/paper.js").read_text()
    arrays = {name: re.findall(r"'([^']+)'", re.search(r"const " + name + r" = \[([^;]+)\];", paper_code).group(1))
              for name in ["PAPER_CARD_ORDER", "PAPER_FALLBACK", "PAPER_WEAK"]}
    order = next(aid_pages[2].all("ol"))
    card_order = [re.sub(r"\s+[A-G]$", "", li.text().strip()) for li in order.all("li")]
    assert card_order == arrays["PAPER_CARD_ORDER"], "Aid Dominance Card order differs from app"
    for index in [0, *range(4, len(aid_pages))]:
        text = normal(aid_pages[index].text())
        assert normal(" · ".join(arrays["PAPER_FALLBACK"])) in text
        assert normal(", ".join(arrays["PAPER_WEAK"])) in text
    # Each of the six deck tables must agree with DECKS, independently of the
    # generator and independently of the 96 PDF card faces checked above.
    aid_decks = []
    for i, animal in enumerate(animals):
        table = next(aid_pages[i + 4].all("table"))
        rows = list(table.all("tr"))[1:]
        assert len(rows) == len(decks[animal]) == 8
        for slot, (row, card) in enumerate(zip(rows, decks[animal])):
            expected = str(slot + 1) + card["title"] + " → ".join(r.title() for r in card["no"]["rows"])
            assert normal(row.text()) == normal(expected), f"aid {animal} card {slot + 1}"
            assert normal(expected) in normal(ruletext), f"rulebook deck table: {animal} card {slot + 1}"
            aid_decks.append({"animal": animal, "card": slot + 1})
        glance = list(aid_pages[i + 4].all("table"))[1]
        assert normal(data["animals"][animal]["el"]) in normal(glance.text())
        assert normal(str(data["animals"][animal]["affinity"]) + " + added elements") in normal(glance.text())
        above, below = animals[:i], animals[i + 1:]
        if below:
            food_text = "Wins food-chain ties against " + ", ".join(a.title() for a in below) + ". "
            food_text += "Loses them to " + ", ".join(a.title() for a in above) + "." if above else "Loses none."
        else:
            food_text = "Loses every food-chain tie."
        assert normal(food_text) in normal(glance.text()), f"Aid {animal} food chain"
    pawn_rows = list(next(aid_pages[3].all("table")).all("tr"))[1:]
    ladder = json.loads((repo / "source/paper/ladder.json").read_text())
    for row, (players, (ap, cubes)) in zip(pawn_rows, data["setup"].items()):
        values = [normal(c.text()) for c in row.children if isinstance(c, Node) and c.tag == "td"]
        rivals = int(players) - 1
        expected = [str(rivals), f"{ap}/{cubes}"] + [str(ap - 1) + "*" if level == "easy" and rivals == 5
                   else str(ap + ladder["offsets"][level]) for level in ["easy", "standard", "hard", "expert"]]
        assert values == expected, f"Aid setup counts: {values} vs {expected}"
    assert len(pawn_rows) == len(data["setup"])
    for terrain, info in data["terrain"].items():
        assert normal(terrain + str(info["vp"][0])) in normal(aid_pages[1].text())
    report = {"appVersion": data["version"], "rulebookPages": len(book), "rulesPages": start,
              "appendixStartPage": start + 1, "cardSheetPages": len(cards), "aidPages": len(aids),
              "standaloneCardsChecked": standalone_faces, "appendixCardsChecked": appendix_faces,
              "aidDeckRowsChecked": aid_decks, "textFidelity": fidelity,
              "separateAidTablesChecked": table_checks, "appPriorityListsChecked": list(arrays),
              "continuationHeadersRemoved": headers, "appendixStandalonePixelEquality": appendix_pixels,
              "pdfSha256": {n: hashlib.sha256((paper / f"Paper_Rivals_{n}.pdf").read_bytes()).hexdigest() for n in names},
              "scope": "Publication fidelity and generated data; manual rule-to-app review is still required."}
    if rebuild or rebuild_pdfs:
        target = output / "print-rebuild"
        target.mkdir(parents=True, exist_ok=True)
        producer = runpy.run_path(str(repo / "source/paper/printables.py"))["main"]
        producer.__globals__["OUT"] = target
        old_argv = sys.argv
        try:
            sys.argv = ["printables.py"]
            producer()
        finally:
            sys.argv = old_argv
        files = ["Paper_Rivals_Rulebook.md"] + [f"Paper_Rivals_{n}.html" for n in names]
        report["regeneratedTextMatches"] = {f: (target / f).read_bytes() == (paper / f).read_bytes() for f in files}
        assert all(report["regeneratedTextMatches"].values()), "Generated text drift"
        if rebuild_pdfs:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as pw:
                options = {"args": ["--no-sandbox"]}
                if os.environ.get("DS_AUDIT_CHROMIUM"):
                    options["executable_path"] = os.environ["DS_AUDIT_CHROMIUM"]
                browser = pw.chromium.launch(**options)
                for name in names:
                    page = browser.new_page()
                    page.goto((target / f"Paper_Rivals_{name}.html").as_uri())
                    page.pdf(path=str(target / f"Paper_Rivals_{name}.pdf"), print_background=True,
                             format="Letter", prefer_css_page_size=True)
                    page.close()
                browser.close()
            checks = {}
            for name in names:
                regenerated = fitz.open(target / f"Paper_Rivals_{name}.pdf")
                original = docs[name]
                assert len(regenerated) == len(original), f"{name} rebuild pagination differs"
                checks[name] = [{"text": normal(a.get_text()) == normal(b.get_text()),
                                 "pixels": a.get_pixmap().samples == b.get_pixmap().samples}
                                for a, b in zip(original, regenerated)]
                assert all(p["text"] for p in checks[name]), f"{name} rebuilt PDF text differs"
            report["regeneratedPDFs"] = checks
    output.mkdir(parents=True, exist_ok=True)
    (output / "print-observations.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"PASS: {start} rules pages + {len(animals)} card appendix pages; "
          f"{len(standalone_faces) + len(appendix_faces)} card faces; "
          f"{len(aids)} aid sheets and {len(aid_decks)} aid deck rows.")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    default = Path(__file__).resolve().parents[2]
    parser.add_argument("repo", nargs="?", type=Path, default=default)
    parser.add_argument("--output-dir", type=Path, default=Path.cwd())
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--rebuild-pdfs", action="store_true")
    args = parser.parse_args()
    verify(args.repo.resolve(), args.output_dir.resolve(), args.rebuild, args.rebuild_pdfs)


if __name__ == "__main__":
    main()
