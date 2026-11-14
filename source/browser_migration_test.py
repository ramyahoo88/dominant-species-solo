"""Regression (GPT v0.3.6 audit A2): through the real controls, a partial Migration (one move added, then Confirm) must apply.
Usage: python3 source/browser_migration_test.py Dominant_Species_Solo.html"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
HTML = Path(sys.argv[1]).resolve().as_uri()
KEY = "dominant-species-solo-v1"
def saved(p): return json.loads(p.evaluate("k => localStorage.getItem(k)", KEY))
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--no-sandbox"]); p = b.new_page(viewport={"width":390,"height":850}); errs=[]
    p.on("pageerror", lambda e: errs.append(str(e)))
    p.goto(HTML); p.locator("form[data-form=start] button[type=submit]").click()
    import random; rnd = random.Random(3); result = None
    for step in range(1500):
        g = saved(p)["game"]
        if g["phase"] == "finished": break
        adds = p.locator('[data-do="add-disk"]:not([disabled])')
        if adds.count(): adds.nth(rnd.randrange(adds.count())).click(); continue
        sels = p.locator('form select'); done=False
        for i in range(sels.count()):
            s = sels.nth(i); nm = s.get_attribute("name") or ""
            if (nm.startswith("card-") or nm.startswith("stack-")) and not s.input_value():
                opts=[o for o in s.locator("option").evaluate_all("os=>os.map(o=>o.value)") if o]
                used={sels.nth(j).input_value() for j in range(sels.count()) if (sels.nth(j).get_attribute("name") or "").startswith(nm.split('-')[0])}
                pk=next((o for o in opts if o not in used),None)
                if pk: s.select_option(pk); done=True; break
        if done: continue
        def click(name):
            l=p.get_by_role("button",name=name,exact=True)
            if l.count() and l.first.is_visible(): l.first.click(); return True
        if click("Begin Planning"): continue
        if p.locator('[data-do="draw"]').count() and p.locator('[data-do="draw"]').is_visible(): p.locator('[data-do="draw"]').click(); continue
        if click("Pawn placed · Continue"): continue
        if p.locator('form[data-form="place"]').count():
            sel=p.locator('form[data-form="place"] select[name="slot"]')
            opts=[o for o in sel.locator("option").evaluate_all("os=>os.map(o=>o.value)") if o]
            sel.select_option(next((o for o in opts if o.startswith("migration")), opts[0]))
            p.locator('form[data-form="place"] button[type=submit]').click(); continue
        if click("Applied · Continue"): continue
        origin = p.locator('select[name="origin"]')
        if origin.count() and origin.is_visible():
            o=[x for x in origin.locator("option").evaluate_all("os=>os.map(o=>o.value)") if x]
            origin.select_option(o[0])
            dest=p.locator('select[name="destination"]')
            if dest.count():
                d=[x for x in dest.locator("option").evaluate_all("os=>os.map(o=>o.value)") if x]
                dest.select_option(d[0])
                p.get_by_role("button",name="Add move",exact=True).click()
                before=len(saved(p)["game"]["log"])
                p.locator('main form button[type=submit]').first.click()
                preview = p.locator('.result-box').inner_text() if p.locator('.result-box').count() else ''
                ap=p.get_by_role("button",name="Applied · Continue",exact=True)
                if ap.count() and ap.first.is_visible(): ap.first.click()
                after=saved(p)["game"]
                result={"preview": preview[:200], "confirmed": len(after["log"])>before, "last_log": after["log"][-1]["title"]+": "+after["log"][-1]["body"], "invalid": p.evaluate("[...document.querySelectorAll('main form :invalid')].map(e=>e.name)"), "notice": p.locator("#notice").inner_text() if p.locator("#notice").count() else "", "moves_in_draft": saved(p).get("draft",{}), "heading": p.locator("#turn-focus").inner_text()}
                break
        if click("Forfeit action"): continue
        sub=p.locator('main form button[type=submit]')
        if sub.count():
            fs=p.locator('main form select')
            for i in range(fs.count()):
                s=fs.nth(i)
                if s.is_visible() and not s.input_value():
                    opts=[o for o in s.locator("option").evaluate_all("os=>os.map(o=>o.value)") if o]
                    if opts: s.select_option(opts[0])
            sub.first.click(); continue
        prim=p.locator('main button.primary')
        if prim.count(): prim.first.click(); continue
        break
    assert result and result["confirmed"] and not result["invalid"] and not errs, (result, errs)
    print("PASS partial Migration confirms:", result["last_log"])
    b.close()
