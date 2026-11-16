"""Build The Red Queen (the paper rivals) rulebook, cards and player aids from one source.

    python3 source/paper/printables.py            # Markdown + HTML
    python3 source/paper/printables.py --pdf      # also PDFs (needs Playwright + Chromium)

Inputs: source/paper/RULES.md (hand-written rules), source/paper/AIDS.html (player aid sheets 1-4, condensed
from RULES.md by hand), source/src/decks.js (the rival decks, read through Node so the cards always match the
app), source/src/data.js (version, animals, elements, tile values, setup counts) and source/paper/ladder.json
(measured difficulty). Outputs go to paper/ at the repository root: the rulebook (with the cut-out cards in its
appendix), the card sheet on its own, and the player aids (four reference sheets and one sheet per rival).
"""
import argparse, html, json, re, subprocess
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "source"
OUT = ROOT / "paper"
ANIMALS = ["mammals", "reptiles", "birds", "amphibians", "arachnids", "insects"]
COLORS = {"mammals": "#eee7d8", "reptiles": "#3d4c4b", "birds": "#ead174", "amphibians": "#8ec7db", "arachnids": "#db9b91", "insects": "#a5c2a0"}
INKS = {"mammals": "#40372c", "reptiles": "#ffffff", "birds": "#302713", "amphibians": "#173746", "arachnids": "#40231f", "insects": "#25382a"}


def decks():
    code = ("const fs=require('fs'),vm=require('vm');const c=vm.createContext({});"
            "vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.D=DECKS;',c);"
            "process.stdout.write(JSON.stringify(c.D));")
    return json.loads(subprocess.check_output(["node", "-e", code, str(SRC / "src/decks.js")]))


def game_data():
    code = ("const fs=require('fs'),vm=require('vm');const c=vm.createContext({});"
            "vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.D={animals:ANIMALS,elements:ELEMENTS,terrain:TERRAIN,setup:SETUP_BY_PLAYERS};',c);"
            "process.stdout.write(JSON.stringify(c.D));")
    return json.loads(subprocess.check_output(["node", "-e", code, str(SRC / "src/data.js")]))


def version():
    return re.search(r"VERSION = '([^']+)'", (SRC / "src/data.js").read_text()).group(1)


def title(row):
    return row[0].upper() + row[1:]


def deck_tables(d):
    out = []
    for a in ANIMALS:
        out.append(f"### {title(a)}\n\n| # | Card | Actions, in order |\n| --- | --- | --- |")
        for i, c in enumerate(d[a]):
            out.append(f"| {i + 1} | {c['title']} | {' → '.join(title(r) for r in c['no']['rows'])} |")
        out.append("")
    return "\n".join(out)


CARDS_MARK = "CARD-PAGES-GO-HERE"


def appendix_html():
    return ("## Appendix: printable rival cards\n\n"
            "Each rival has a sheet of fronts followed by a sheet of backs. Print them double-sided, flipping on the long edge, so every back "
            "lines up with its front, then cut along the lines. Each front shows the card's number (for a d8 instead of cards), its three actions "
            "in order and when each has a target. A weak action after the first is shown in grey: step 4 never takes it. "
            "Each back shows the rival in its own colour, with its element, food-chain place and power.\n\n" + CARDS_MARK + "\n")


def appendix(d):
    out = ["## Appendix: printable rival cards", "",
           "The printed rulebook has full cards, with fronts and backs, to print double-sided and cut out. "
           "Here each card shows its animal, its number (for a d8 instead of cards) and its three actions in order.", ""]
    for a in ANIMALS:
        out += [f"### {title(a)} cards", "", "| Card | Card |", "| --- | --- |"]
        cells = [f"**{a.upper()} {i + 1}** · {c['title']} — " + " · ".join(f"{n + 1}. {title(r)}" for n, r in enumerate(c['no']['rows']))
                 for i, c in enumerate(d[a])]
        out += [f"| {cells[i]} | {cells[i + 1]} |" for i in range(0, 8, 2)] + [""]
    return "\n".join(out)


def pawns(n):
    return "Base count" if n == 0 else f"Base count {'−' if n < 0 else '+'}{abs(n)}"


EASY_FIVE = " (with five rivals: −1 for each rival, and you take 1 extra pawn)"


def difficulty(ladder):
    off = ladder["offsets"]
    return ("| Level | Each rival's pawns |\n| --- | --- |\n"
            + "".join(f"| {name} | {pawns(off[key])}{EASY_FIVE if key == 'easy' else ''} |\n" for key, name in
                      [("easy", "Easy"), ("standard", "Standard"), ("hard", "Hard"), ("expert", "Expert")]) + "\n"
            "**Playing with the companion app:** the app can run these exact rules, so you don't need to print anything. "
            "On the setup screen choose **The Red Queen** and a level. The app draws each rival's card, names the Planning step "
            "that chose each space, and spells out every change to make on the board. (The app's other option, Tooth & Claw, "
            "is a separate set of rivals with their own rules.)")


GREEN = "#2f4a3a"

# One design for the rulebook, the player aids and the cards (Georgia text, green bands, boxed steps).
CSS = """
@page{size:letter;margin:0.55in}
@page cards{margin:0.4in}
*{box-sizing:border-box}
body{font:10.5pt/1.42 Georgia,serif;color:#1d1d1b;max-width:800px;margin:24px auto;padding:0 18px}
h1{font-size:22pt;color:#2f4a3a;margin:0 0 4px;border-bottom:3px solid #2f4a3a;padding-bottom:4px}
h1+p{font:8.5pt/1.4 Helvetica,Arial,sans-serif;color:#666}
h2{font:bold 11pt Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#fff;background:#2f4a3a;padding:3px 8px;margin:20px 0 8px}
h3{font:bold 10.5pt Helvetica,Arial,sans-serif;color:#2f4a3a;border-bottom:1px solid #9aa39a;padding-bottom:2px;margin:14px 0 6px}
p{margin:5px 0}
table{border-collapse:collapse;width:100%;margin:6px 0 8px;font-size:9.5pt}tr{page-break-inside:avoid;break-inside:avoid}thead{display:table-header-group}
th,td{border:1px solid #9aa39a;padding:3px 6px;vertical-align:top;text-align:left}
th{background:#e8ede6;font:bold 8.5pt Helvetica,Arial,sans-serif}td:first-child{font-weight:bold}
code{font-size:8.5pt;background:#f1f3ee;padding:0 3px}ul{padding-left:20px}li{margin:2px 0}
body>ol{list-style:none;padding:0;counter-reset:step;margin:6px 0}
body>ol>li{counter-increment:step;position:relative;border:1px solid #9aa39a;border-radius:4px;padding:5px 8px 5px 34px;margin:0 0 4px}
body>ol>li::before{content:counter(step);position:absolute;left:10px;top:3px;font:bold 14pt Helvetica,Arial,sans-serif;color:#2f4a3a}
@media print{body{margin:0;max-width:none;padding:0}h2,h3{page-break-after:avoid;break-after:avoid}li,p{page-break-inside:avoid;break-inside:avoid}}
"""

CARD_CSS = """
.cardpage{page:cards;page-break-before:always;break-before:page}
.cardpage h4{width:7in;margin:0 auto 6px;font:bold 9pt Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#fff;background:#2f4a3a;padding:2px 6px}
.grid{display:grid;grid-template-columns:repeat(2,3.5in);grid-auto-rows:2.4in;width:7in;margin:0 auto}
.card{border:1px dashed #8a8a8a;padding:8px 10px;display:flex;flex-direction:column;font-family:Georgia,serif;overflow:hidden}
.card .head{display:flex;align-items:center;gap:8px;background:var(--bg);color:var(--ink);padding:3px 8px;border-radius:4px;border:1px solid rgba(0,0,0,.35)}
.card .who{font:bold 9.5pt Helvetica,Arial,sans-serif;letter-spacing:.08em}
.card .meta{font:7.5pt Helvetica,Arial,sans-serif;opacity:.85;flex:1}
.card .num{font:bold 17pt/1 Helvetica,Arial,sans-serif}
.card .name{font-size:12pt;font-weight:bold;color:#2f4a3a;margin:5px 0 3px}
.card ol.acts{list-style:none;margin:0;padding:0;counter-reset:act;border:0}
.card ol.acts li{counter-increment:act;position:relative;padding:1px 0 3px 24px;margin:0;border:0;border-bottom:1px solid #e1e5df}
.card ol.acts li:last-child{border-bottom:0}
.card ol.acts li::before{content:counter(act);position:absolute;left:0;top:2px;width:17px;height:17px;border-radius:50%;background:#2f4a3a;color:#fff;font:bold 9pt/17px Helvetica,Arial,sans-serif;text-align:center}
.card ol.acts b{display:block;font-size:11.5pt;line-height:1.2}
.card ol.acts small{display:block;font:7.4pt/1.25 Helvetica,Arial,sans-serif;color:#555}
.card ol.acts li.weak b,.card ol.acts li.weak small{color:#9a9a9a}.card ol.acts li.weak::before{background:#b9b9b9}
.card .foot{margin-top:auto;font:6.8pt/1.3 Helvetica,Arial,sans-serif;color:#666;border-top:1px solid #9aa39a;padding-top:3px}
.card.back{border:1px solid #c9c9c9;padding:7px}
.card.back .inner{flex:1;background:var(--bg);color:var(--ink);border-radius:8px;border:2px solid rgba(0,0,0,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10px;position:relative}
.card.back .inner::after{content:"";position:absolute;inset:5px;border:1px solid currentColor;border-radius:6px;opacity:.35}
.card.back .brand{font:bold 8pt Helvetica,Arial,sans-serif;letter-spacing:.3em;opacity:.8}
.card.back .animal{font:bold 26pt/1.1 Georgia,serif;margin:4px 0 2px;letter-spacing:.02em}
.card.back .line{font:8.5pt Helvetica,Arial,sans-serif;opacity:.9}
.card.back .power{font:italic 9pt/1.3 Georgia,serif;margin-top:8px;max-width:2.6in}
.card.back .game{position:absolute;bottom:10px;font:6.5pt Helvetica,Arial,sans-serif;letter-spacing:.12em;opacity:.7}
"""

# One line per action: when it has a target (the "Has a target when" table of RULES.md, shortened).
CARD_TARGET = {
    "initiative": "it is not first on the Initiative track",
    "adaptation": "the box has an element; its display has under 6",
    "regression": "an added type is in the Adaptation or Regression box",
    "abundance": "a box element it uses; an empty corner on its tile",
    "wasteland": "the box holds an element it uses",
    "depletion": "a disk on Earth of a box element it doesn't use",
    "glaciation": "a legal tile with opposing species and none of its own",
    "speciation": "gene pool not empty; a disk of that element on Earth",
    "wanderlust": "a face-up tile; an empty spot next to its tiles",
    "migration": "a rescue, or a spare species to a new matched tile",
    "competition": "shares a tile of these terrains or tundra with an opponent",
    "domination": "an unscored tile holds one of its species",
}
CHAIN = ["first in the food chain", "second in the food chain", "third in the food chain", "fourth in the food chain",
         "fifth in the food chain", "last in the food chain"]


def weak_actions():
    js = (SRC / "paper/paper.js").read_text()
    i = js.index("const PAPER_WEAK")
    return re.findall(r"'(\w+)'", js[i:js.index("]", i)])


def card_front(a, i, c, g, weak):
    el = g["elements"][g["animals"][a]["el"]]["name"]
    rows = []
    for n, r in enumerate(c["no"]["rows"]):
        dead = n > 0 and r in weak
        note = "Weak action after the first: step 4 skips it" if dead else (
            "always (Reptiles)" if r == "regression" and a == "reptiles" else CARD_TARGET[r])
        rows.append(f"<li class='{'weak' if dead else ''}'><b>{title(r)}</b><small>{note}</small></li>")
    return (f"<div class='card front' style='--bg:{COLORS[a]};--ink:{INKS[a]}'><div class='head'><span class='who'>{a.upper()}</span>"
            f"<span class='meta'>{el} · {CHAIN[ANIMALS.index(a)]}</span><span class='num'>{i + 1}</span></div>"
            f"<div class='name'>{html.escape(c['title'])}</div><ol class='acts'>{''.join(rows)}</ol>"
            "<div class='foot'>Small print: when the action has a target. Grey: a weak action, skipped. "
            "Steps 1–3 come before this card; if no action fits, step 5.</div></div>")


def card_back(a, g):
    el = g["elements"][g["animals"][a]["el"]]["name"]
    return (f"<div class='card back' style='--bg:{COLORS[a]};--ink:{INKS[a]}'><div class='inner'><div class='brand'>THE RED QUEEN</div>"
            f"<div class='animal'>{title(a)}</div><div class='line'>{el} · {CHAIN[ANIMALS.index(a)]}</div>"
            f"<div class='power'>{AID_POWER[a][0]}</div><div class='game'>DOMINANT SPECIES · SOLO RIVAL DECK</div></div></div>")


def card_pages(d, g):
    weak = weak_actions()
    pages = []
    for a in ANIMALS:
        fronts = [card_front(a, i, c, g, weak) for i, c in enumerate(d[a])]
        # Backs mirror the fronts left to right, so they line up when printed double-sided (flip on the long edge).
        backs = [card_back(a, g)] * len(fronts)
        mirrored = [backs[r * 2 + 1 - col] for r in range(len(backs) // 2) for col in range(2)]
        pages.append(f"<section class='cardpage'><h4>{title(a)} · card fronts</h4><div class='grid'>{''.join(fronts)}</div></section>")
        pages.append(f"<section class='cardpage'><h4>{title(a)} · card backs (print on the reverse)</h4><div class='grid'>{''.join(mirrored)}</div></section>")
    return "".join(pages)


def card_sheet(d, g):
    return ("<!doctype html><meta charset='utf-8'><title>The Red Queen — rival cards for Dominant Species</title><style>"
            "@page{size:letter;margin:0.4in}*{box-sizing:border-box}body{margin:0}"
            + CARD_CSS.replace(".cardpage{page:cards;page-break-before:always;break-before:page}",
                               ".cardpage{page-break-after:always}.cardpage:last-child{page-break-after:auto}") +
            f"</style><body>{card_pages(d, g)}</body>")


ELEMENT_ORDER = ["meat", "sun", "seed", "water", "grub", "grass"]
AID_SCORE = ("<table><tr><td>Start</td><td>the tile's first-place value</td></tr><tr><td>+ value again</td><td>that opponent ranks above "
             "the rival and no longer does afterwards (ties go to the food chain)</td></tr><tr><td>+ half value</td><td>it is that "
             "opponent's last species there</td></tr><tr><td>+ 6</td><td>removing that last species also ends the opponent's dominance</td></tr></table>")
AID_POWER = {
    "mammals": ("Saves one endangered species at Extinction.",
                "<p><b>Which one:</b> the endangered species on the tile with the highest first-place value (tie: board order).</p>"),
    "reptiles": ("Protects one added element for free during Regression.",
                 "<p><b>Placing on Regression:</b> for Reptiles the Regression row always has a target.</p><p><b>If it still must lose an "
                 "element:</b> the added element on the fewest corners of tiles it occupies (tie: the one further left in the Regression box).</p>"),
    "birds": ("Each migrating species may move up to two tiles, through existing terrain.",
              "<p><b>Migration:</b> every other Migration rule is unchanged (sheet 2): rescues first, then the higher first-place value, and "
              "each move must be a rescue or reach a tile it is not on yet.</p>"),
    "amphibians": ("Three printed Water.",
                   "<p><b>Matches:</b> count 3 plus its added elements (other rivals count 2), capped at the number of disks on the tile.</p>"),
    "arachnids": ("One free Competition on any one tile it shares, as in the normal rules.",
                  "<p><b>Which elimination:</b> the highest Competition score (tie: the opponent earlier in VP order, then board order).</p>"
                  "<p><b>Competition score</b> for removing one opposing species:</p>" + AID_SCORE),
    "insects": ("One free species at Speciation, as in the normal rules.",
                "<p><b>Where:</b> on a tile it matches: one where it gains a rank, then one it is already on, then by first-place value.</p>"),
}
AID_STEPS = """<ol class="small">
<li><b>Domination first:</b> a card is available and it dominates more unscored tiles than it has pawns on Domination (at most 2) → leftmost open Domination space.</li>
<li><b>Barren Earth</b> (after turn 1): no animal is dominant anywhere → an open Abundance space, unless it already has a pawn there. Empty Earth (no rival species on Earth): its Abundance may use any empty corner.</li>
<li><b>Block the leader:</b> a card is available, it has fewer than 2 pawns on Domination and the leader dominates an unscored tile → leftmost open Domination space (needs a target).</li>
<li><b>Its card:</b> the first of the card's three actions that is not a row where it already has a pawn, is not a weak action (unless first on the card), and has an open space with a target.</li>
<li><b>Fallback</b> (weak actions allowed): Domination · Wanderlust · Speciation · Adaptation · Competition · Migration · Abundance · Initiative · Regression · Depletion · Wasteland · Glaciation.</li>
<li><b>Last resort:</b> step 5 again, allowing rows where it already has a pawn; else the first open space.</li></ol>
<p class="small"><b>Weak actions:</b> Abundance, Glaciation, Wasteland, Depletion, Regression, Initiative. Targets and details: sheet 1.</p>"""


def aid_food(a):
    i = ANIMALS.index(a)
    above, below = [title(x) for x in ANIMALS[:i]], [title(x) for x in ANIMALS[i + 1:]]
    pos = ["1st (top)", "2nd", "3rd", "4th", "5th", "6th (bottom)"][i]
    text = f"<b>{pos}.</b> "
    if below:
        text += "Wins food-chain ties against " + ", ".join(below) + ". " + ("Loses them to " + ", ".join(above) + "." if above else "Loses none.")
    else:
        text += "Loses every food-chain tie."
    return text


def rival_aid(a, d, g, n, total, ver):
    info = g["animals"][a]
    el = g["elements"][info["el"]]["name"]
    rows = "".join(f"<tr><td style='text-align:center'>{i + 1}</td><td style='font-weight:normal'>{html.escape(c['title'])}</td>"
                   f"<td style='font-weight:normal'>{' → '.join(title(r) for r in c['no']['rows'])}</td></tr>" for i, c in enumerate(d[a]))
    power, detail = AID_POWER[a]
    return f"""<div class="page">
<header><h1><b class="tag" style="background:{COLORS[a]};color:{INKS[a]}">{title(a)}</b> rival</h1><span>The Red Queen · player aid {n} of {total} · version {ver}</span></header>
<div class="cols"><div style="flex:1.1">
<h2>Its deck</h2>
<p class="small">Draw one card each time it places a pawn (or roll a d8). Try the three actions in order (step 4).</p>
<table><tr><th>#</th><th>Card</th><th>Actions, in order</th></tr>{rows}</table>
<h2>Placing a pawn</h2>
<p class="small">Each Planning the rivals place 1 pawn each, in Initiative order, before you. Each placement: draw a card, then take the first step that gives a space.</p>
{AID_STEPS}
</div><div>
<h2>{title(a)} at a glance</h2>
<table>
<tr><td>Printed element</td><td>{el}</td></tr>
<tr><td>Matches</td><td>{info['affinity']} + added elements, capped at the disks on the tile</td></tr>
<tr><td>Food chain</td><td>{aid_food(a)}</td></tr>
</table>
<h2>Its power</h2>
<p><b>{power}</b></p>{detail}
<h2>Where its element matters</h2>
<ul>
<li><b>Adaptation:</b> takes {el} if the box offers it; otherwise the leftmost element.</li>
<li><b>Habitat, Aquatic:</b> takes {el} if the bag has it.</li>
<li><b>Metamorphosis:</b> among equally useful bag elements, prefers {el}.</li>
<li>Its <b>match count ignores element types</b>; it only <i>uses</i> the elements on its display (Abundance, Wasteland, Depletion, Wanderlust).</li>
</ul>
<h2>Dominance ties</h2>
<p>Only rivals tie for the most matches: the rival with the most species on the tile, then the one higher in the food chain. A tie that includes you: no one is dominant.</p>
</div></div></div>"""


def check_aids(rules, aid):
    """Fail the build if the hand-condensed aids lose a list or a row of RULES.md (they are checked line by line by hand)."""
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", aid)))
    order = re.search(r"takes the first available card in this list: ([^.]+)\.", rules).group(1).split(", ")
    block = aid[aid.index("Which card it takes"):aid.index("Skip the card if")]
    assert re.findall(r"<li>([A-Z][A-Za-z ]+?)(?: <span class=\"skip\">[A-G]</span>)?</li>", block) == order, "aid card order"
    for pattern in [r"Try this order with the same tests, except the weak-action test: ([^.]+)\.", r"weak action \(([^)]+)\)",
                    r"Cards with no choice for the taker \(([^)]+)\)"]:
        items = re.search(pattern, rules).group(1)
        assert items in text or " · ".join(items.split(", ")) in text, "aid list: " + items
    sheets = re.split(r'<div class="page">', aid)[1:]  # each table is checked on its own sheet (GPT printables audit, T1)
    for head, end, sheet in [("| Action | Has a target when |", "## Execution", 0), ("| Action | What the rival does |", "**Migration, one", 1),
                             ("| Card | The rival chooses |", "## Other decisions", 2)]:
        for row in re.findall(r"^\| ([A-Z][A-Za-z ]+?) \|", rules[rules.index(head):rules.index(end)], re.M)[1:]:
            assert f"<td>{row}</td>" in sheets[sheet], f"aid sheet {sheet + 1} row: " + row
    for row in ["Arachnids' free", "Insects' free", "Arriving", "Losing an element", "Mammals' save", "Hibernation-protected", "Immigrants"]:
        assert row in text, "aid decision: " + row


def aids(d, g, ladder, ver):
    total = 4 + len(ANIMALS)
    off = ladder["offsets"]
    levels = ["easy", "standard", "hard", "expert"]
    rows = "<tr><th>Rivals</th><th>Base pawns / cubes</th>" + "".join(f"<th>{title(k)}</th>" for k in levels) + "</tr>"
    for players in sorted(g["setup"], key=int):
        ap, cubes = g["setup"][players]
        rivals = int(players) - 1
        cells = []
        for k in levels:
            n = ap + off[k]
            star = k == "easy" and rivals == 5
            cells.append(f"{ap - 1}*" if star else str(n))
        rows += f"<tr><td>{rivals}</td><td>{ap} / {cubes}</td>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"
    terrain = sorted(g["terrain"].items(), key=lambda kv: -kv[1]["vp"][0])
    vals = [f"{title(t)} {v['vp'][0]}" for t, v in terrain]
    values = "<table class='small'>" + "".join("<tr>" + "".join(f"<td>{x}</td>" for x in vals[i:i + 4]) + "</tr>" for i in (0, 4)) + "</table>"
    body = (SRC / "paper/AIDS.html").read_text()
    body = body[body.index("-->") + 3:]
    for i in range(1, 5):
        body = body.replace("{{AID %d}}" % i, f"The Red Queen · player aid {i} of {total} · version {ver}")
    body = body.replace("{{PAWNS}}", rows).replace("{{VALUES}}", values).replace("{{VALUE_LIST}}", ", ".join(vals))
    assert "{{" not in body
    check_aids((SRC / "paper/RULES.md").read_text(), body)
    body += "".join(rival_aid(a, d, g, 5 + i, total, ver) for i, a in enumerate(ANIMALS))
    return ("<!doctype html><meta charset='utf-8'><title>The Red Queen — player aids</title><style>"
            + AIDS_STYLE + f"</style><body>{body}</body>")


AIDS_STYLE = """
@page{size:letter;margin:0.45in}
*{box-sizing:border-box}
body{font:10pt/1.34 Georgia,serif;margin:0;color:#1d1d1b}
.page{page-break-after:always;height:10.05in;overflow:hidden}
.page:last-child{page-break-after:auto}
@media screen{body{max-width:7.6in;margin:20px auto}.page{height:auto;margin-bottom:40px}}
header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2.5px solid #2f4a3a;padding-bottom:3px;margin-bottom:8px}
h1{font-size:15pt;margin:0;color:#2f4a3a}
h1 .tag{padding:1px 10px;border-radius:4px;border:1px solid #777}
header span{font:7.5pt Helvetica,Arial,sans-serif;color:#666}
h2{font:bold 9.5pt Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#fff;background:#2f4a3a;margin:9px 0 4px;padding:2px 6px}
h2:first-child{margin-top:0}
.cols{display:flex;gap:14px}.cols>div{flex:1;min-width:0}
table{border-collapse:collapse;width:100%}
td,th{border:1px solid #9aa39a;padding:2.5px 5px;vertical-align:top;text-align:left}
th{background:#e8ede6;font:bold 8.5pt Helvetica,Arial,sans-serif}
td:first-child{font-weight:bold}
ol,ul{margin:2px 0;padding-left:17px}li{margin:1.5px 0}
.step{display:flex;gap:7px;border:1px solid #9aa39a;border-radius:4px;padding:4px 7px;margin:0 0 3px}
.step b.n{font:bold 13pt Helvetica,Arial,sans-serif;color:#2f4a3a;min-width:15px}
.box{border:1px solid #9aa39a;background:#f4f6f1;border-radius:4px;padding:5px 8px;margin:4px 0}
.small{font-size:9pt}.skip{color:#8a3b1c;font-style:italic}
p{margin:3px 0}
"""


def duplex_cards(path):
    """Card fronts must start on a right-hand (odd) page so each back prints on the reverse of its front."""
    from pypdf import PdfReader, PdfWriter
    reader = PdfReader(str(path))
    first = next(i for i, page in enumerate(reader.pages) if "card fronts" in (page.extract_text() or "").lower())
    if first % 2 == 0:
        return
    writer = PdfWriter(clone_from=reader)
    writer.insert_blank_page(index=first)
    writer.write(str(path))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", action="store_true")
    args = ap.parse_args()
    d, ver, g = decks(), version(), game_data()
    ladder = json.loads((SRC / "paper/ladder.json").read_text())
    md = (SRC / "paper/RULES.md").read_text()
    import datetime
    date = datetime.date.fromisoformat(ladder["rulebook"])
    md = (md.replace("{{DATE}}", f"{date.day} {date:%B %Y}").replace("{{APP}}", ver).replace("{{DIFFICULTY}}", difficulty(ladder))
          .replace("{{DECKS}}", deck_tables(d)))
    md = re.sub(r"<!--.*?-->\n\n", "", md, flags=re.S)  # the source note is for editors, not the printed book
    assert "{{" not in md.replace("{{APPENDIX}}", "")
    OUT.mkdir(exist_ok=True)
    (OUT / "The_Red_Queen_Rulebook.md").write_text(md.replace("{{APPENDIX}}", appendix(d)), encoding="utf-8")
    body = markdown.markdown(md.replace("{{APPENDIX}}", appendix_html()), extensions=["tables"])
    body = body.replace(f"<p>{CARDS_MARK}</p>", card_pages(d, g))
    assert CARDS_MARK not in body
    page = f"<!doctype html><meta charset='utf-8'><title>The Red Queen — solo rivals for Dominant Species</title><style>{CSS}{CARD_CSS}</style><body>{body}</body>"
    (OUT / "The_Red_Queen_Rulebook.html").write_text(page, encoding="utf-8")
    (OUT / "The_Red_Queen_Cards.html").write_text(card_sheet(d, g), encoding="utf-8")
    (OUT / "The_Red_Queen_Player_Aids.html").write_text(aids(d, g, ladder, ver), encoding="utf-8")
    if args.pdf:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            b = pw.chromium.launch(args=["--no-sandbox"])
            for name in ["The_Red_Queen_Rulebook", "The_Red_Queen_Cards", "The_Red_Queen_Player_Aids"]:
                p = b.new_page()
                p.goto((OUT / f"{name}.html").resolve().as_uri())
                p.pdf(path=str(OUT / f"{name}.pdf"), print_background=True, format="Letter", prefer_css_page_size=True)
                if name == "The_Red_Queen_Rulebook":
                    duplex_cards(OUT / f"{name}.pdf")
            b.close()
    print("Wrote", ", ".join(sorted(f.name for f in OUT.iterdir())))


if __name__ == "__main__":
    main()
