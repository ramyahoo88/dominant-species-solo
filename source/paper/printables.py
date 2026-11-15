"""Build the Paper Rivals rulebook and printable cards from one source.

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
            "Cut out the cards on the next six pages along the dashed lines (the same sheets are in `paper/Paper_Rivals_Cards.pdf`). "
            "Each card shows its animal, its number (for a d8 instead of cards) and its three actions in order.\n\n" + CARDS_MARK + "\n")


def appendix(d):
    out = ["## Appendix: printable rival cards", "",
           "Print `paper/Paper_Rivals_Cards.pdf` (one animal per page, cut along the dashed lines), or cut these tables apart. "
           "Each card shows its animal, its number (for a d8 instead of cards) and its three actions in order.", ""]
    for a in ANIMALS:
        out += [f"### {title(a)} cards", "", "| Card | Card |", "| --- | --- |"]
        cells = [f"**{a.upper()} {i + 1}** · {c['title']} — " + " · ".join(f"{n + 1}. {title(r)}" for n, r in enumerate(c['no']['rows']))
                 for i, c in enumerate(d[a])]
        out += [f"| {cells[i]} | {cells[i + 1]} |" for i in range(0, 8, 2)] + [""]
    return "\n".join(out)


def ladder_table(ladder):
    rows = ["| Rivals (even game) | Easy | Standard | Hard | Expert | App's rivals |", "| --- | --- | --- | --- | --- | --- |"]
    for r in ladder["rows"]:
        rows.append(f"| {r['rivals']} ({r['even']}%) | " + " | ".join(f"{r[k]}%" for k in ["easy", "standard", "hard", "expert", "app"]) + " |")
    return "\n".join(rows)


def pawns(n):
    return "Base count" if n == 0 else f"Base count {'−' if n < 0 else '+'}{abs(n)}"


EASY_FIVE = " (with five rivals: −1 for each rival, and you take 1 extra pawn)"


def difficulty(ladder):
    off = ladder["offsets"]
    return ("| Level | Each rival's pawns |\n| --- | --- |\n"
            + "".join(f"| {name} | {pawns(off[key])}{EASY_FIVE if key == 'easy' else ''} |\n" for key, name in
                      [("easy", "Easy"), ("standard", "Standard"), ("hard", "Hard"), ("expert", "Expert")]) + "\n"
            "**Playing in the app instead:** the app can run these exact rules, so you don't need to print anything. "
            "On the setup screen choose **Paper rules** and a level. The app draws each rival's card, names the Planning step "
            "that chose each space, and spells out every change to make on the board.")


def testing(ladder):
    return "\n\n".join([
        "## Testing",
        "Every rule was built in the app's simulator and judged by win rate: how often a fixed scripted player beats the rivals. "
        "The player uses three strategies (tile majorities, Dominance Cards, expansion) and, since v0.3.7, reads the board with the "
        "rivals' flat matching. " + ladder["method"],
        ladder_table(ladder),
        ladder["strategy"],
        "**How the rules got here.** The first version scored every Dominance Card, checked each card's condition and counted element "
        "types and rank gains. Lighter rules played as well or better and take roughly 15 minutes less upkeep per rival per game, so that "
        "version was retired. Ideas that tested weaker and were left out: the card's Yes face, the leftmost space instead of the best, "
        "simpler Competition targets, one generic effect for every card, no Wanderlust element, a fixed card position, a center-out "
        "tie-breaker, and dropping Domination first. For v0.5.0, against a self-tuned test player: holding the Initiative space against you, "
        "climbing past you, racing or blocking you for the first Domination space, rival-favoured ties with you, scoring the tile that gains "
        "the most over you, and taking VP cards first. Rivals planning first beat them all.",
        "**Stalls.** " + ladder["stalls"],
        "**Limits.** The scripted player is a fixed strategy, not a person, so expect a strong human to win more often at every level. "
        "These rules have not yet been played at a real table.",
        "The rules live in `source/paper/paper.js`. For example, `node source/benchmark.cjs --base <commit> --candidate <commit> --paper="
        + str(ladder["offsets"]["hard"]) + " --bots 3 --seed 200000 --repeats 2` repeats the Hard test against three rivals (360 games; pin both "
        "sides to the release commit).",
    ])


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
.cardpage h4{width:7in;font:bold 9pt Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#fff;background:#2f4a3a;padding:2px 6px;margin:0 0 6px}
.grid{display:grid;grid-template-columns:repeat(2,3.5in);grid-auto-rows:2.4in;gap:0}
.card{border:1px dashed #777;padding:10px 12px;display:flex;flex-direction:column;font-family:Georgia,serif}
.card .head{display:flex;justify-content:space-between;align-items:center;background:var(--bg);color:var(--ink);padding:4px 8px;border-radius:4px;border:1px solid #777;font:bold 10pt Helvetica,Arial,sans-serif;letter-spacing:.05em}
.card .head span{font-size:16pt;line-height:1}.card .name{font-size:13pt;margin:8px 0 2px;color:#2f4a3a;font-weight:bold}
.card ol{list-style:decimal;margin:4px 0 0 20px;padding:0;font-size:13pt;line-height:1.5;border:0}.card ol li{border:0;padding:0;margin:0}.card ol li::before{content:none}
.card .foot{margin-top:auto;font:7.5pt Helvetica,Arial,sans-serif;color:#666;border-top:1px solid #9aa39a;padding-top:3px}
.cardnote{font:8pt Helvetica,Arial,sans-serif;color:#666;margin:4px 0 0}
"""



def card_pages(d, ver):
    pages = []
    for a in ANIMALS:
        cards = "".join(
            f"<div class='card' style='--bg:{COLORS[a]};--ink:{INKS[a]}'><div class='head'><b>{a.upper()}</b><span>{i + 1}</span></div>"
            f"<div class='name'>{html.escape(c['title'])}</div><ol>" + "".join(f"<li>{title(r)}</li>" for r in c['no']['rows']) +
            "</ol><div class='foot'>Paper Rivals · try the actions in order</div></div>" for i, c in enumerate(d[a]))
        note = f"<p class='cardnote'>Generated from source/src/decks.js for app v{ver}.</p>" if a == ANIMALS[-1] else ""
        pages.append(f"<section class='cardpage'><h4>{title(a)} cards · cut along the dashed lines</h4><div class='grid'>{cards}</div>{note}</section>")
    return "".join(pages)


def card_sheet(d, ver):
    return ("<!doctype html><meta charset='utf-8'><title>Paper Rivals cards</title><style>"
            "@page{size:letter;margin:0.4in}*{box-sizing:border-box}body{margin:0}"
            + CARD_CSS.replace(".cardpage{page:cards;page-break-before:always;break-before:page}",
                               ".cardpage{page-break-after:always}.cardpage:last-child{page-break-after:auto}") +
            f"</style><body>{card_pages(d, ver)}</body>")


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
<header><h1><b class="tag" style="background:{COLORS[a]};color:{INKS[a]}">{title(a)}</b> rival</h1><span>Player aid {n} of {total} · app v{ver}</span></header>
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
    for head, end in [("| Action | Has a target when |", "## Execution"), ("| Action | What the rival does |", "**Migration, one"),
                      ("| Card | The rival chooses |", "## Other decisions")]:
        for row in re.findall(r"^\| ([A-Z][A-Za-z ]+?) \|", rules[rules.index(head):rules.index(end)], re.M)[1:]:
            assert f"<td>{row}</td>" in aid, "aid row: " + row
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
        body = body.replace("{{AID %d}}" % i, f"Player aid {i} of {total} · app v{ver}")
    body = body.replace("{{PAWNS}}", rows).replace("{{VALUES}}", values).replace("{{VALUE_LIST}}", ", ".join(vals))
    assert "{{" not in body
    check_aids((SRC / "paper/RULES.md").read_text(), body)
    body += "".join(rival_aid(a, d, g, 5 + i, total, ver) for i, a in enumerate(ANIMALS))
    return ("<!doctype html><meta charset='utf-8'><title>Dominant Species — Paper Rivals player aids</title><style>"
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", action="store_true")
    args = ap.parse_args()
    d, ver, g = decks(), version(), game_data()
    ladder = json.loads((SRC / "paper/ladder.json").read_text())
    md = (SRC / "paper/RULES.md").read_text()
    md = (md.replace("{{VERSION}}", ladder["rulebook"]).replace("{{APP}}", ver).replace("{{DIFFICULTY}}", difficulty(ladder))
          .replace("{{DECKS}}", deck_tables(d)).replace("{{TESTING}}", testing(ladder)))
    assert "{{" not in md.replace("{{APPENDIX}}", "")
    OUT.mkdir(exist_ok=True)
    (OUT / "Paper_Rivals_Rulebook.md").write_text(md.replace("{{APPENDIX}}", appendix(d)), encoding="utf-8")
    body = markdown.markdown(md.replace("{{APPENDIX}}", appendix_html()), extensions=["tables"])
    body = body.replace(f"<p>{CARDS_MARK}</p>", card_pages(d, ver))
    assert CARDS_MARK not in body
    page = f"<!doctype html><meta charset='utf-8'><title>Dominant Species — Paper Rivals</title><style>{CSS}{CARD_CSS}</style><body>{body}</body>"
    (OUT / "Paper_Rivals_Rulebook.html").write_text(page, encoding="utf-8")
    (OUT / "Paper_Rivals_Cards.html").write_text(card_sheet(d, ver), encoding="utf-8")
    (OUT / "Paper_Rivals_Player_Aids.html").write_text(aids(d, g, ladder, ver), encoding="utf-8")
    if args.pdf:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            b = pw.chromium.launch(args=["--no-sandbox"])
            for name in ["Paper_Rivals_Rulebook", "Paper_Rivals_Cards", "Paper_Rivals_Player_Aids"]:
                p = b.new_page()
                p.goto((OUT / f"{name}.html").resolve().as_uri())
                p.pdf(path=str(OUT / f"{name}.pdf"), print_background=True, format="Letter", prefer_css_page_size=True)
            b.close()
    print("Wrote", ", ".join(sorted(f.name for f in OUT.iterdir())))


if __name__ == "__main__":
    main()
