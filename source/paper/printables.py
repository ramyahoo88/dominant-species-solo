"""Build the Paper Rivals rulebook and printable cards from one source.

    python3 source/paper/printables.py            # Markdown + HTML
    python3 source/paper/printables.py --pdf      # also PDFs (needs Playwright + Chromium)

Inputs: source/paper/RULES.md (hand-written rules), source/src/decks.js (the rival decks, read through
Node so the cards always match the app), source/src/data.js (version) and source/paper/ladder.json
(measured difficulty). Outputs go to paper/ at the repository root.
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


def difficulty(ladder):
    return ("| Level | Each rival's pawns | Use it when |\n| --- | --- | --- |\n"
            "| Easy | Base count −1 | " + ladder["easy"] + " |\n"
            "| Standard | Base count | " + ladder["standard"] + " |\n"
            "| Hard | Base count +1 | " + ladder["hard"] + " |\n"
            "| Expert | Base count +2 | " + ladder["expert"] + " |\n\n"
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
        "tie-breaker, and dropping Domination first.",
        "**Stalls.** " + ladder["stalls"],
        "**Limits.** The scripted player is a fixed strategy, not a person, so expect a strong human to win more often at every level. "
        "These rules have not yet been played at a real table.",
        "The rules live in `source/paper/paper.js`. For example, `node source/benchmark.cjs --base <commit> --candidate <commit> --paper 1 --bots 3 "
        "--seed 200000 --repeats 2` repeats the Hard test against three rivals (360 games; pin both sides to the release commit).",
    ])


CSS = """
body{font:11pt/1.45 Georgia,serif;color:#1d2420;max-width:780px;margin:24px auto;padding:0 18px}
h1{font-size:24pt;margin:0 0 4px}h2{font-size:15pt;margin-top:22px;border-bottom:1px solid #c9d2c8;padding-bottom:3px}
h3{font-size:12pt;margin-top:16px}table{border-collapse:collapse;width:100%;margin:8px 0;font-size:9.5pt;page-break-inside:avoid}
th,td{border:1px solid #b7c1b6;padding:4px 6px;vertical-align:top;text-align:left}th{background:#eef1ea}
code{font-size:9pt;background:#f1f3ee;padding:0 3px}li{margin:2px 0}
@media print{body{margin:0;max-width:none}h2,h3{page-break-after:avoid;break-after:avoid}}
"""


def card_sheet(d, ver):
    pages = []
    for a in ANIMALS:
        cards = "".join(
            f"<div class='card' style='--bg:{COLORS[a]};--ink:{INKS[a]}'><div class='head'><b>{a.upper()}</b><span>{i + 1}</span></div>"
            f"<div class='name'>{html.escape(c['title'])}</div><ol>" + "".join(f"<li>{title(r)}</li>" for r in c['no']['rows']) +
            "</ol><div class='foot'>Paper Rivals · try in order</div></div>" for i, c in enumerate(d[a]))
        note = f"<p style='font-size:8pt;color:#666;margin:4px 0 0'>Generated from source/src/decks.js for app v{ver}.</p>" if a == ANIMALS[-1] else ""
        pages.append(f"<section class='page'><h2>{title(a)} — cut along the dashed lines</h2><div class='grid'>{cards}</div>{note}</section>")
    return ("<!doctype html><meta charset='utf-8'><title>Paper Rivals cards</title><style>"
            "@page{size:letter;margin:0.4in}body{font:11pt Georgia,serif;margin:0}"
            ".page{page-break-after:always}.page:last-child{page-break-after:auto}.page h2{font-size:10pt;font-weight:normal;margin:0 0 6px;color:#555}"
            ".grid{display:grid;grid-template-columns:repeat(2,3.5in);grid-auto-rows:2.4in;gap:0}"
            ".card{border:1px dashed #777;padding:10px 12px;box-sizing:border-box;display:flex;flex-direction:column}"
            ".head{display:flex;justify-content:space-between;background:var(--bg);color:var(--ink);padding:4px 8px;border-radius:4px;font-size:10pt}"
            ".head span{font-size:16pt;font-weight:bold;line-height:1}.name{font-size:13pt;margin:8px 0 2px}"
            "ol{margin:4px 0 0 20px;padding:0;font-size:13pt;line-height:1.5}.foot{margin-top:auto;font-size:7.5pt;color:#666}"
            f"</style><body>{''.join(pages)}</body>")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", action="store_true")
    args = ap.parse_args()
    d, ver = decks(), version()
    ladder = json.loads((SRC / "paper/ladder.json").read_text())
    md = (SRC / "paper/RULES.md").read_text()
    md = (md.replace("{{VERSION}}", ladder["rulebook"]).replace("{{APP}}", ver).replace("{{DIFFICULTY}}", difficulty(ladder))
          .replace("{{DECKS}}", deck_tables(d)).replace("{{TESTING}}", testing(ladder)).replace("{{APPENDIX}}", appendix(d)))
    assert "{{" not in md
    OUT.mkdir(exist_ok=True)
    (OUT / "Paper_Rivals_Rulebook.md").write_text(md, encoding="utf-8")
    body = markdown.markdown(md, extensions=["tables"])
    page = f"<!doctype html><meta charset='utf-8'><title>Dominant Species — Paper Rivals</title><style>{CSS}</style><body>{body}</body>"
    (OUT / "Paper_Rivals_Rulebook.html").write_text(page, encoding="utf-8")
    (OUT / "Paper_Rivals_Cards.html").write_text(card_sheet(d, ver), encoding="utf-8")
    if args.pdf:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            b = pw.chromium.launch(args=["--no-sandbox"])
            for name, fmt in [("Paper_Rivals_Rulebook", {"format": "Letter", "margin": {"top": "0.5in", "bottom": "0.5in", "left": "0.5in", "right": "0.5in"}}),
                              ("Paper_Rivals_Cards", {"format": "Letter", "prefer_css_page_size": True})]:
                p = b.new_page()
                p.goto((OUT / f"{name}.html").resolve().as_uri())
                p.pdf(path=str(OUT / f"{name}.pdf"), print_background=True, **fmt)
            b.close()
    print("Wrote", ", ".join(sorted(f.name for f in OUT.iterdir())))


if __name__ == "__main__":
    main()
