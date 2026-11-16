"""Regression (GPT v0.4.0 audit F1, v0.4.1 follow-ups R1/R2): restarting from an older paper save keeps the level by name,
the setup can only start with a listed level, and Help marks the older tie rule in a resumed legacy game. Usage: python3 source/browser_restart_test.py Dominant_Species_Solo.html"""
import json, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
HTML = Path(sys.argv[1]).resolve().as_uri()
KEY = "dominant-species-solo-v1"
ROOT = Path(__file__).resolve().parent.parent

def old_save(version, extra, tie=False):
    keep = "" if tie else "delete s.paper.rivalTie;"
    js = f"""const {{load}} = require('{ROOT}/source/benchmark/load.cjs'); const r = load('worktree', ['game']);
      process.stdout.write(r.run(`(() => {{ const s = newGame('amphibians',['birds','arachnids'],true,949381806,{{extra:{extra}}});
      {keep} delete s.paper.planFirst; delete s.paper.speciesTie; delete s.paper.level; s.version = '{version}'; return JSON.stringify(s); }})()`));"""
    return json.loads(subprocess.check_output(["node", "-e", js]))

def run(version, extra, expect_extra, tie=False):
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--no-sandbox"]); p = b.new_page(viewport={"width":390,"height":850}); errs=[]
        p.on("pageerror", lambda e: errs.append(str(e)))
        p.goto(HTML)
        p.evaluate("([k,v]) => localStorage.setItem(k, v)", [KEY, json.dumps({"format": KEY, "game": old_save(version, extra, tie)})])
        p.reload()
        p.locator('[data-do="menu"]').first.click()                       # Game menu -> Start a new game -> confirm
        p.locator('[data-do="new"]').first.click()
        p.locator('[data-do="new-confirm"]').first.click()
        checked = p.evaluate("() => document.querySelector('input[name=extra]:checked')?.value ?? null")
        p.locator("form[data-form=start] button[type=submit]").click()
        g = json.loads(p.evaluate("k => localStorage.getItem(k)", KEY) or "{}").get("game")
        result = {"save": f"v{version} extra {extra}", "radio": checked, "started": bool(g), "rival_ap": g and {r: g["animals"][r]["ap"] for r in g["rivals"]},
                  "notice": "Choose a difficulty level" in p.locator("body").inner_text(), "errors": errs}
        if expect_extra is None:
            assert checked is None and not g and result["notice"], result     # must ask for a level
            p.locator('input[name=extra][value="-1"]').check(); p.locator("form[data-form=start] button[type=submit]").click()
            g = json.loads(p.evaluate("k => localStorage.getItem(k)", KEY))["game"]
            assert g["paper"]["extra"] == -1 and g["paper"]["level"] == "Standard" and g["paper"]["planFirst"], g["paper"]
        else:
            assert checked == str(expect_extra) and g and g["paper"]["extra"] == expect_extra, result
        assert not errs, errs
        b.close()
        return result

def help_text(save):
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--no-sandbox"]); p = b.new_page(viewport={"width":390,"height":850}); errs=[]
        p.on("pageerror", lambda e: errs.append(str(e)))
        p.goto(HTML)
        if save: p.evaluate("([k,v]) => localStorage.setItem(k, v)", [KEY, json.dumps({"format": KEY, "game": save})]); p.reload()
        p.locator('[data-do="help"]').first.click()
        text = p.locator("#modal").inner_text()
        assert not errs, errs
        b.close()
        return text

# Levels by name on the v0.5.0 scale: Easy -2, Standard -1, Hard 0, Expert +1.
for case in [("0.3.6", -1, -2), ("0.3.6", 0, -1), ("0.3.9", 1, -1), ("0.3.9", 3, 1), ("0.4.0", 1, None), ("0.3.9", -1, -2),
             ("0.4.1", 1, 0, True), ("0.4.1", -1, -2, True)]:
    print("PASS", run(*case))
# R1: a legacy save's Help names its level and the old tie result; a new game's Help has no such notice.
legacy = help_text(old_save("0.3.6", 0))
assert "This saved game was started before v0.4.0" in legacy and "Standard (+0 pawns per rival)" in legacy and "In Red Queen games started in v0.4.0 or later" in legacy, legacy
v04 = help_text(old_save("0.4.1", 1, True))
assert "This saved game was started before v0.5.0" in v04 and "Hard (+1 pawn per rival)" in v04, v04
fresh = help_text(None)
assert "This saved game" not in fresh and "In Red Queen games started in v0.4.0 or later" in fresh and "place one pawn each before anyone else" in fresh and "any empty corner" in fresh and "any empty corner" in legacy, fresh
print("PASS Help notice for a legacy Paper save")

# Restart from an App-rivals game, then switch to Paper rules: Standard (-1) is preselected, not the old 0 (now Hard).
def app_restart():
    js = f"""const {{load}} = require('{ROOT}/source/benchmark/load.cjs'); const r = load('worktree', ['game']);
      process.stdout.write(r.run(`JSON.stringify(newGame('amphibians',['birds','arachnids'],true,5))`));"""
    save = json.loads(subprocess.check_output(["node", "-e", js]))
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--no-sandbox"]); p = b.new_page(viewport={"width":390,"height":850}); errs=[]
        p.on("pageerror", lambda e: errs.append(str(e)))
        p.goto(HTML)
        p.evaluate("([k,v]) => localStorage.setItem(k, v)", [KEY, json.dumps({"format": KEY, "game": save})]); p.reload()
        p.locator('[data-do="menu"]').first.click(); p.locator('[data-do="new"]').first.click(); p.locator('[data-do="new-confirm"]').first.click()
        p.locator('input[name=rules][value="paper"]').check()
        checked = p.evaluate("() => document.querySelector('input[name=extra]:checked')?.value ?? null")
        assert checked == "-1" and not errs, (checked, errs)
        b.close()
app_restart()
print("PASS App game restarted as Paper preselects Standard")
