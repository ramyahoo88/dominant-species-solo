"""Exercise the standalone companion with real Chromium controls and networking disabled."""
import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

KEY = "dominant-species-solo-v1"
ROWS = ["adaptation", "abundance", "wanderlust"]
ELEMENTS = ["meat", "sun", "seed", "water", "grub", "grass"]
CARDS = ["Aquatic", "Biodiversity", "Biomass", "Blight", "Catastrophe"]


def saved(page):
    return json.loads(page.evaluate("(key) => localStorage.getItem(key)", KEY))


def button(page, name):
    return page.get_by_role("button", name=name, exact=True)


def add_disk(page, row, element):
    return button(page, f"Add {element.title()} to {row.title()}")


def exercise(browser, uri):
    context = browser.new_context(
        viewport={"width": 390, "height": 850}, is_mobile=True, has_touch=True, offline=True,
        accept_downloads=True,
    )
    page = context.new_page()
    errors, network = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda req: network.append(req.url) if req.url.startswith(("http:", "https:")) else None)
    page.goto(uri)
    page.locator("form[data-form=start] button[type=submit]").click()
    expect(page.locator("#turn-focus")).to_have_text("Enter board draws")
    expect(page.locator("#version")).to_have_text("v0.3.1")
    expect(page.locator(".score-strip")).to_contain_text("45 in pool")
    page.locator('[name="card-0"]').select_option(CARDS[0])
    for element in ["water", "meat", "seed", "grass"]:
        add_disk(page, "adaptation", element).click()
    expect(add_disk(page, "adaptation", "grub")).to_be_disabled()
    button(page, "Remove Meat from Adaptation slot 2").click()
    add_disk(page, "adaptation", "sun").click()
    assert saved(page)["supply"]["supplyDraws"]["adaptation"] == ["water", "sun", "seed", "grass"]
    page.reload()
    expect(button(page, "Remove Sun from Adaptation slot 2")).to_be_visible()
    expect(page.locator('[name="card-0"]')).to_have_value(CARDS[0])
    button(page, "Game menu").click()
    with page.expect_download() as downloaded:
        button(page, "Export save").click()
    export = Path(downloaded.value.path()).read_bytes()
    assert json.loads(export)["supply"]["supplyDraws"]["adaptation"] == ["water", "sun", "seed", "grass"]
    page.locator("#import-file").set_input_files({"name": "save.json", "mimeType": "application/json", "buffer": export})
    expect(button(page, "Remove Sun from Adaptation slot 2")).to_be_visible()

    for row in ROWS[1:]:
        for element in ELEMENTS[:4]:
            add_disk(page, row, element).click()
    for i, terrain in enumerate(["sea", "wetland", "forest"]):
        page.locator(f'[name="stack-{i}"]').select_option(terrain)
    for i, card in enumerate(CARDS):
        page.locator(f'[name="card-{i}"]').select_option(card)
    button(page, "Begin Planning").click()
    assert saved(page)["game"]["boxes"]["adaptation"] == ["water", "sun", "seed", "grass"]
    before = saved(page)
    page.locator('[data-do="draw"]').click()
    first = page.locator(".current-card").inner_text()
    assert saved(page) == before
    page.reload()
    page.locator('[data-do="draw"]').click()
    assert page.locator(".current-card").inner_text() == first
    button(page, "Pawn placed · Continue").click()
    assert len(saved(page)["game"]["pawns"]) == 1
    button(page, "Undo").click()
    assert saved(page) == before
    assert page.evaluate("document.documentElement.scrollWidth === innerWidth")

    old = json.loads(export)
    old.pop("supply")
    old["game"]["version"] = "0.2.0"
    page.locator("#import-file").set_input_files({
        "name": "v0.2.0.json", "mimeType": "application/json", "buffer": json.dumps(old).encode(),
    })
    expect(page.locator("#turn-focus")).to_have_text("Enter board draws")
    assert saved(page)["game"]["version"] == "0.3.1"
    assert saved(page)["game"]["animals"]["amphibians"]["pool"] == 45
    assert not errors and not network, (errors, network)
    context.close()
    print(f"PASS Chromium {browser.version} at 390px · offline tap entry, middle-slot correction, reload, export/import, bot reveal, Undo and v0.2 import")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--html", type=Path, default=Path(__file__).resolve().parent.parent / "Dominant_Species_Solo.html")
    parser.add_argument("--chromium")
    parser.add_argument("--headless-shell", action="store_true")
    args = parser.parse_args()
    flags = ["--no-sandbox"]
    if args.headless_shell:
        flags.extend(["--no-zygote", "--single-process", "--disable-gpu", "--disable-dev-shm-usage"])
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium, args=flags)
        try:
            exercise(browser, args.html.resolve().as_uri())
        finally:
            browser.close()


if __name__ == "__main__":
    main()
