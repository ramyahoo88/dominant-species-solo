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


def card_rectangles(page, side, label):
    """Read actual cut boundaries from Chromium's PDF paths in points."""
    drawings = page.get_drawings()
    if side == "front":
        # Dashed horizontal borders are emitted as groups of filled paths.
        lines = [d["rect"] for d in drawings if d["type"] == "f" and
                 abs(d["rect"].width - 252) < .1 and 0 < d["rect"].height <= 1]
        columns = sorted({line.x0 for line in lines})
        assert len(lines) == 16 and len(columns) == 2, f"{label}: expected 16 front cut edges"
        rectangles = []
        for x in columns:
            column = sorted((line for line in lines if line.x0 == x), key=lambda line: line.y0)
            assert len(column) == 8, f"{label}: missing cut edges in one column"
            rectangles.extend(fitz.Rect(top.x0, top.y0, top.x1, bottom.y1)
                              for top, bottom in zip(column[::2], column[1::2]))
    else:
        # The solid back borders are stroked about their centerlines.
        rectangles = []
        for drawing in drawings:
            rect = drawing["rect"]
            if drawing["type"] == "s" and abs(rect.width - 251.25) < .1:
                inset = drawing["width"] / 2
                rectangles.append(rect + (-inset, -inset, inset, inset))
    assert len(rectangles) == 8, f"{label}: expected eight {side} cut rectangles"
    for rect in rectangles:
        assert abs(rect.width - 252) <= .6 and abs(rect.height - 172.8) <= .6, f"{label}: card size"
        assert page.rect.contains(rect), f"{label}: card extends outside the page"
    return sorted(rectangles, key=lambda rect: (rect.y0, rect.x0))


def child_text(node, cls):
    return next(node.all(cls=cls)).text()


def check_card_text(page, rect, node, rows, label):
    actual = normal(page.get_textbox(rect))
    # Card step numbers are CSS counters, extracted separately from the HTML
    # text. Check every character and the order of each action's label and note.
    expected = normal(node.text() + ("123" if rows else ""))
    assert Counter(actual) == Counter(expected), f"{label}: text missing or changed"
    for cls in (("head", "name", "foot") if rows else ("brand", "animal", "line", "power", "game")):
        if cls == "head":
            # PDF extraction puts the number before the element and food chain.
            for part in ("who", "meta", "num"):
                assert normal(child_text(node, part)) in actual, f"{label}: {part}"
        else:
            assert normal(child_text(node, cls)) in actual, f"{label}: {cls}"
    previous_end = 0
    for position, row in enumerate(rows, 1):
        phrase = normal(row.text() + str(position))
        start = actual.find(phrase, previous_end)
        assert start >= 0, f"{label}: card action {position} missing or out of order"
        previous_end = start + len(phrase)


def card_spans(page, rect):
    return [span for block in page.get_text("dict", clip=rect)["blocks"] if "lines" in block
            for line in block["lines"] for span in line["spans"]]


def card_faces(doc, start, body, data, weak_actions, label):
    layouts = list(body.all("section", "cardpage"))
    animals, decks = data["animals"], data["decks"]
    assert len(layouts) == 2 * len(animals), f"{label}: missing HTML card pages"
    css = next(body.parent.all("style")).text()
    tint = re.search(r"\bli\.weak b[^{}]*\{[^}]*\bcolor:\s*#([0-9a-fA-F]{6})\b", css)
    assert tint, f"{label}: missing weak action ink"
    weak_ink = int(tint.group(1), 16)
    fronts, backs, duplex = [], [], []
    chain = ("first", "second", "third", "fourth", "fifth", "last")
    for i, (animal, animal_data) in enumerate(animals.items()):
        element = data["elements"][animal_data["el"]]["name"]
        identity = normal(f"{element} · {chain[i]} in the food chain")
        name = animal_data["name"]
        front_page, back_page = doc[start + 2 * i], doc[start + 2 * i + 1]
        for page, side in [(front_page, "fronts"), (back_page, "backs")]:
            heading = normal(page.get_textbox(fitz.Rect(0, 0, 612, 45)))
            assert heading.startswith(normal(f"{name} · card {side}")), f"{label}: unexpected page {page.number + 1}"
        front_rects = card_rectangles(front_page, "front", f"{label} {name}")
        back_rects = card_rectangles(back_page, "back", f"{label} {name}")
        front_nodes = list(layouts[2 * i].all("div", "front"))
        back_nodes = list(layouts[2 * i + 1].all("div", "back"))
        assert len(front_nodes) == len(back_nodes) == len(decks[animal]) == 8, f"{label} {name}: missing cards"
        worst = 0
        for slot, (front_rect, front_node, card) in enumerate(zip(front_rects, front_nodes, decks[animal])):
            front_label = f"{label} {name} front {slot + 1}"
            assert normal(child_text(front_node, "who")) == normal(name), front_label
            assert normal(child_text(front_node, "meta")) == identity, front_label
            assert child_text(front_node, "num") == str(slot + 1), front_label
            assert child_text(front_node, "name") == card["title"], front_label
            rows = list(front_node.all("li"))
            actions = [next(row.all("b")).text().casefold() for row in rows]
            assert actions == card["no"]["rows"], front_label
            spans = card_spans(front_page, front_rect)
            for j, (row, action) in enumerate(zip(rows, actions)):
                is_weak = j > 0 and action in weak_actions
                assert ("weak" in row.attrs["class"].split()) == is_weak, f"{front_label}: weak marker"
                colors = [span["color"] for span in spans if normal(span["text"]) == action]
                assert len(colors) == 1 and (colors[0] == weak_ink) == is_weak, f"{front_label}: printed weak marker"
            check_card_text(front_page, front_rect, front_node, rows, front_label)
            fronts.append({"page": front_page.number + 1, "animal": animal, "card": slot + 1,
                           "title": card["title"], "actions": actions})

            opposite = slot ^ 1  # long-edge flip mirrors columns, preserving rows
            back_rect = back_rects[opposite]
            back_node = back_nodes[opposite]
            back_label = f"{label} {name} back for front {slot + 1}"
            assert normal(child_text(back_node, "animal")) == normal(name), back_label
            assert normal(child_text(back_node, "line")) == identity, back_label
            assert normal(child_text(back_node, "brand")) == normal("The Red Queen"), back_label
            assert child_text(back_node, "power").strip(), f"{back_label}: missing power"
            check_card_text(back_page, back_rect, back_node, [], back_label)
            mirror = fitz.Rect(612 - front_rect.x1, front_rect.y0, 612 - front_rect.x0, front_rect.y1)
            error = max(abs(a - b) for a, b in zip(mirror, back_rect))
            assert error <= .75, f"{back_label}: long-edge duplex misalignment ({error:.2f} pt)"
            worst = max(worst, error)
            backs.append({"page": back_page.number + 1, "animal": animal, "forFront": slot + 1,
                          "power": child_text(back_node, "power")})
        duplex.append({"animal": animal, "frontPage": front_page.number + 1,
                       "backPage": back_page.number + 1, "maxErrorPt": round(worst, 3)})
    return fronts, backs, duplex


def verify(repo, output, rebuild=False, rebuild_pdfs=False):
    paper = repo / "paper"
    code = """const fs=require('node:fs'),vm=require('node:vm');
    let c=vm.createContext({});
    for(const f of ['data','decks']) vm.runInContext(fs.readFileSync(process.argv[1]+'/source/src/'+f+'.js','utf8'),c);
    console.log(vm.runInContext('JSON.stringify({version:VERSION,decks:DECKS,animals:ANIMALS,elements:ELEMENTS,setup:SETUP_BY_PLAYERS,terrain:TERRAIN})',c));"""
    data = json.loads(subprocess.check_output(["node", "-e", code, str(repo)]))
    animals, decks = list(data["animals"]), data["decks"]
    names = ["Rulebook", "Cards", "Player_Aids"]
    docs = {n: fitz.open(paper / f"The_Red_Queen_{n}.pdf") for n in names}
    htmls = {n: Document((paper / f"The_Red_Queen_{n}.html").read_text()).body for n in names}
    for name, doc in docs.items():
        assert all(p.rect.width == 612 and p.rect.height == 792 for p in doc), f"{name}: expected US Letter"
    cards, book, aids = (docs[n] for n in ["Cards", "Rulebook", "Player_Aids"])
    appendix = [i for i, p in enumerate(book) if normal(p.get_text()).startswith(normal(animals[0] + " · card fronts"))]
    assert len(appendix) == 1, "Cannot uniquely locate the first appendix card page"
    start = appendix[0]
    assert start % 2 == 0, "Rulebook's first card front must be an odd-numbered page for duplex printing"
    card_pages = 2 * len(animals)
    assert len(cards) == card_pages and len(book) - start == card_pages, "Expected a front and back page for each animal"
    paper_code = (repo / "source/paper/paper.js").read_text()
    arrays = {name: re.findall(r"'([^']+)'", re.search(r"const " + name + r" = \[([^;]+)\];", paper_code).group(1))
              for name in ["PAPER_CARD_ORDER", "PAPER_FALLBACK", "PAPER_WEAK"]}
    standalone_faces, standalone_backs, standalone_duplex = card_faces(
        cards, 0, htmls["Cards"], data, arrays["PAPER_WEAK"], "standalone")
    appendix_faces, appendix_backs, appendix_duplex = card_faces(
        book, start, htmls["Rulebook"], data, arrays["PAPER_WEAK"], "appendix")
    appendix_pixels = []
    for i in range(card_pages):
        assert normal(cards[i].get_text()) == normal(book[start + i].get_text()), f"Appendix card page {i + 1} text differs"
        appendix_pixels.append(cards[i].get_pixmap().samples == book[start + i].get_pixmap().samples)
    rules_body = htmls["Rulebook"]
    rules_body.children = [node for node in rules_body.children
                           if not isinstance(node, Node) or "cardpage" not in node.attrs.get("class", "").split()]
    assert all(normal(h.text()) != "testing" for h in rules_body.all("h2")), "Rulebook still contains a Testing section"
    ruletext, headers = strip_continuation_headers(book[:start], rules_body)
    fidelity = {"rulebook": text_fidelity(rules_body, ruletext, "rulebook", book=True)}
    aid_pages = list(htmls["Player_Aids"].all(cls="page"))
    assert len(aid_pages) == len(aids) == 4 + len(animals), "Expected four references plus one aid per rival"
    for i, (node, page) in enumerate(zip(aid_pages, aids)):
        footer = f"The Red Queen · player aid {i + 1} of {len(aids)} · version {data['version']}"
        assert normal(footer) in normal(page.get_text()), f"Aid {i + 1}: wrong release footer"
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
              "standaloneBacksChecked": standalone_backs, "appendixBacksChecked": appendix_backs,
              "longEdgeDuplex": {"standalone": standalone_duplex, "appendix": appendix_duplex},
              "aidDeckRowsChecked": aid_decks, "textFidelity": fidelity,
              "separateAidTablesChecked": table_checks, "appPriorityListsChecked": list(arrays),
              "continuationHeadersRemoved": headers, "appendixStandalonePixelEquality": appendix_pixels,
              "pdfSha256": {n: hashlib.sha256((paper / f"The_Red_Queen_{n}.pdf").read_bytes()).hexdigest() for n in names},
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
        files = ["The_Red_Queen_Rulebook.md"] + [f"The_Red_Queen_{n}.html" for n in names]
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
                    page.goto((target / f"The_Red_Queen_{name}.html").as_uri())
                    page.pdf(path=str(target / f"The_Red_Queen_{name}.pdf"), print_background=True,
                             format="Letter", prefer_css_page_size=True)
                    page.close()
                browser.close()
            producer.__globals__["duplex_cards"](target / "The_Red_Queen_Rulebook.pdf")
            checks = {}
            for name in names:
                regenerated = fitz.open(target / f"The_Red_Queen_{name}.pdf")
                original = docs[name]
                assert len(regenerated) == len(original), f"{name} rebuild pagination differs"
                checks[name] = [{"text": normal(a.get_text()) == normal(b.get_text()),
                                 "pixels": a.get_pixmap().samples == b.get_pixmap().samples}
                                for a, b in zip(original, regenerated)]
                assert all(p["text"] for p in checks[name]), f"{name} rebuilt PDF text differs"
            report["regeneratedPDFs"] = checks
    output.mkdir(parents=True, exist_ok=True)
    (output / "print-observations.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"PASS: {start} rules pages + {card_pages} card appendix pages; "
          f"{len(standalone_faces) + len(appendix_faces)} fronts, "
          f"{len(standalone_backs) + len(appendix_backs)} backs and their duplex alignment; "
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
