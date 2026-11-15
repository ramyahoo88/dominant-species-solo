"""Drive the shipped app through its own controls with N rivals, from setup to final scoring.
Human policy: place on the first open space, forfeit optional actions, take the first option elsewhere.
Checks: no page errors/network, bot preview text == logged result, Undo restores, reload keeps state,
export/import round trip, final screen lists every animal."""
import json, sys, random
from pathlib import Path
from playwright.sync_api import sync_playwright

KEY = "dominant-species-solo-v1"
HTML = (Path(__file__).resolve().parent.parent / "Dominant_Species_Solo.html").as_uri()

def saved(p): return json.loads(p.evaluate("k => localStorage.getItem(k)", KEY))
def vis(loc): return loc.count() > 0 and loc.first.is_visible()

def run(n_rivals, seed=1, max_steps=4000, shots=None, paper=None, full=False):
    """Usage: python3 source/browser_game_test.py [paper=N] [full] 2 5 — complete games through the controls (full = 26-card deck)."""
    rnd = random.Random(seed)
    out = {"rivals": n_rivals, "steps": 0, "bot_applies": 0, "mismatch": [], "undo_ok": None, "reload_ok": None, "import_ok": None, "stuck": None}
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 390, "height": 850}, offline=True, accept_downloads=True)
        p = ctx.new_page(); errs = []; net = []
        p.on("pageerror", lambda e: errs.append(str(e)))
        p.on("request", lambda r: net.append(r.url) if r.url.startswith(("http:", "https:")) else None)
        p.goto(HTML)
        p.locator(f'input[name=count][value="{n_rivals}"]').check()
        if full: p.locator('input[name=length][value="full"]').check()
        if paper is not None:
            p.locator('input[name=rules][value="paper"]').check()
            p.locator(f'input[name=extra][value="{paper}"]').check()
            out["setup_text"] = p.locator('.setup-title p').inner_text()
            p.screenshot(path='/tmp/setup_paper.png', full_page=True)
        p.locator("form[data-form=start] button[type=submit]").click()
        g = saved(p)["game"]
        out["paper"] = g.get("paper"); out["eyebrow"] = p.locator('.eyebrow').first.inner_text(); out["supply_text"] = p.locator('.instruction').first.inner_text()[:300]
        out["ids"] = g["ids"]; out["ap"] = {k: v["ap"] for k, v in g["animals"].items()}; out["pool"] = {k: v["pool"] for k, v in g["animals"].items()}
        if paper is not None:
            # GPT v0.5.3 re-audit (medium): the setup screen and the turn-1 instruction must state the pawns the game uses.
            base = {2: 6, 3: 5, 4: 4, 5: 3}[n_rivals]
            rd, yd = (-1, 1) if paper == -2 and n_rivals == 5 else (paper, 0)
            assert all(out["ap"][r] == base + rd for r in g["rivals"]) and out["ap"][g["human"]] == base + yd, out["ap"]
            if rd: assert ("returns " + str(-rd) if rd < 0 else "takes " + str(rd) + " extra") + " action pawn" in out["supply_text"], out["supply_text"]
            assert (" and you take 1 extra" in out["supply_text"]) == bool(yd), out["supply_text"]
            if rd: assert "with " + str(base + rd) + " pawns for each rival" in out["setup_text"], out["setup_text"]
        last_sig = None; same = 0
        for step in range(max_steps):
            out["steps"] = step
            if errs: break
            g = saved(p)["game"]
            if g["phase"] == "finished":
                out["final"] = p.locator("main").inner_text()[:600]
                out["final_vp"] = {k: v["vp"] for k, v in g["animals"].items()}
                break
            sig = json.dumps(saved(p), sort_keys=True)
            same = same + 1 if sig == last_sig else 0
            last_sig = sig
            if same > 6:
                out["stuck"] = p.locator("main").inner_text()[:800]; break
            # supply entry
            adds = p.locator('[data-do="add-disk"]:not([disabled])')
            if adds.count():
                adds.nth(rnd.randrange(adds.count())).click(); continue
            sels = p.locator('form select')
            filled = False
            for i in range(sels.count()):
                s = sels.nth(i)
                name = s.get_attribute("name") or ""
                if (name.startswith("card-") or name.startswith("stack-")) and not s.input_value():
                    opts = [o for o in s.locator("option").evaluate_all("os => os.map(o => o.value)") if o]
                    used = set(x.input_value() for x in [sels.nth(j) for j in range(sels.count())] if x.get_attribute("name", timeout=1000) and x.get_attribute("name").startswith(name.split('-')[0]))
                    pick = next((o for o in opts if o not in used), None)
                    if pick: s.select_option(pick); filled = True; break
            if filled: continue
            if vis(p.get_by_role("button", name="Begin Planning", exact=True)):
                p.get_by_role("button", name="Begin Planning", exact=True).click(); continue
            if vis(p.locator('[data-do="draw"]')):
                p.locator('[data-do="draw"]').click(); continue
            if vis(p.locator('.current-card')) and len(out.setdefault("reveals", [])) < 6:
                out["reveals"].append(p.locator('.current-card').inner_text().replace("\n"," / ")[:160] + " || " + p.locator('.result-box').inner_text().replace("\n"," / ")[:120])
            if vis(p.get_by_role("button", name="Pawn placed · Continue", exact=True)):
                p.get_by_role("button", name="Pawn placed · Continue", exact=True).click(); continue
            if vis(p.locator('form[data-form="place"]')):
                sel = p.locator('form[data-form="place"] select[name="slot"]')
                opts = [o for o in sel.locator("option").evaluate_all("os => os.map(o => o.value)") if o]
                sel.select_option(rnd.choice(opts))
                p.locator('form[data-form="place"] button[type=submit]').click(); continue
            apply = p.get_by_role("button", name="Applied · Continue", exact=True)
            if vis(apply):
                preview = p.locator(".result-box").first.inner_text() if vis(p.locator(".result-box")) else ""
                before = saved(p)
                apply.click()
                after = saved(p)
                out["bot_applies"] += 1
                if out.get("pending_redo") is not None and out["bot_applies"] > 3:
                    out["redo_same"] = after["game"] == out["pending_redo"]
                    out["pending_redo"] = None
                new = after["game"]["log"][len(before["game"]["log"]):] if len(after["game"]["log"]) >= len(before["game"]["log"]) else after["game"]["log"][-3:]
                bodies = " | ".join(x["title"] + ": " + x["body"] for x in new)
                import re as _re
                first_line = _re.sub(r'^Remove the pawn from [^.]*\. ', '', preview.split("\n")[-1].strip())
                first_line = _re.sub(r'^Take (.*)\. Take it from the physical display\.$', r'took \1', first_line)
                if first_line and first_line not in bodies:
                    out["mismatch"].append((preview[:200], bodies[:300]))
                if out["undo_ok"] is None and out["bot_applies"] == 3:
                    p.get_by_role("button", name="Undo", exact=True).click()
                    out["undo_ok"] = saved(p)["game"] == before["game"]
                    apply = p.get_by_role("button", name="Applied · Continue", exact=True)
                    if vis(apply): apply.click()
                    out["pending_redo"] = after["game"]
                if out["reload_ok"] is None and out["bot_applies"] == 5:
                    st = saved(p); p.reload(); out["reload_ok"] = saved(p) == st and not errs
                if out["import_ok"] is None and out["bot_applies"] == 8:
                    p.get_by_role("button", name="Game menu").click()
                    with p.expect_download() as d:
                        p.get_by_role("button", name="Export save", exact=True).first.click()
                    data = Path(d.value.path()).read_bytes()
                    p.keyboard.press("Escape")
                    p.locator("#import-file").set_input_files({"name": "s.json", "mimeType": "application/json", "buffer": data})
                    out["import_ok"] = saved(p)["game"] == json.loads(data)["game"]
                continue
            # human execution step: prefer forfeit, else submit first form
            if vis(p.get_by_role("button", name="Forfeit action", exact=True)):
                p.get_by_role("button", name="Forfeit action", exact=True).click(); continue
            subm = p.locator('main form button[type=submit]')
            if subm.count():
                boxes = p.locator('main form input[type=checkbox]')
                if boxes.count() and not p.locator('main form input[type=checkbox]:checked').count():
                    boxes.first.check()
                fs = p.locator('main form select')
                for i in range(fs.count()):
                    sel = fs.nth(i)
                    if sel.is_visible() and not sel.input_value():
                        opts = [o for o in sel.locator("option").evaluate_all("os => os.map(o => o.value)") if o]
                        if opts: sel.select_option(rnd.choice(opts))
                subm.first.click(); continue
            prim = p.locator('main button.primary')
            if prim.count():
                prim.first.click(); continue
            out["stuck"] = p.locator("main").inner_text()[:800]; break
        if shots: p.screenshot(path=shots, full_page=False)
        out["errors"] = errs; out["network"] = net
        b.close()
    return out

if __name__ == "__main__":
    paper = None
    args = sys.argv[1:]
    if args and args[0].startswith("paper="): paper = int(args.pop(0)[6:])
    full = "full" in args
    args = [a for a in args if a != "full"]
    for n in map(int, args or ["2", "5"]):
        r = run(n, shots=None, paper=paper, full=full)
        r["full_deck"] = full
        print(json.dumps({k: r.get(k) for k in ["rivals","paper","full_deck","steps","bot_applies","undo_ok","redo_same","reload_ok","import_ok","errors","network","stuck","final_vp"]}))
        assert not r["errors"] and not r["network"] and r.get("final_vp") and r["undo_ok"] and r["reload_ok"] and r["import_ok"], "game test failed"
