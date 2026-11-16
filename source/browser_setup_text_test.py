"""GPT v0.5.3 re-audit A1: the turn-1 setup instruction states the pawns the game uses, from the saved scaledEasy flag.
Usage: python3 source/browser_setup_text_test.py Dominant_Species_Solo.html"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = Path(sys.argv[1]).resolve().as_uri()
FIX = Path(__file__).resolve().parent / 'fixtures'
KEY = 'dominant-species-solo-v1'
CASES = [  # five-rival Easy at turn 1: a v0.5.3 save (scaled) and a v0.5.2 save (flat, kept)
    ('gpt-v053-new-five-easy.json', 'Each rival returns 1 action pawn and you take 1 extra: each rival has 2 and you have 4', (2, 4)),
    ('gpt-v053-legacy-v052-five-easy.json', 'Each rival returns 2 action pawns: each rival has 1 (', (1, 3)),
]
with sync_playwright() as pw:
    browser = pw.chromium.launch(args=['--no-sandbox'])
    for name, text, (rival_ap, my_ap) in CASES:
        page = browser.new_context(viewport={'width': 390, 'height': 850}, offline=True).new_page()
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(HTML)
        page.locator('#import-file').set_input_files(str(FIX / name))
        page.wait_for_function('k => JSON.parse(localStorage.getItem(k))?.game?.turn === 1', arg=KEY)
        instruction = page.locator('.instruction').first.inner_text()
        game = json.loads(page.evaluate('k => localStorage.getItem(k)', KEY))['game']
        assert text in instruction, (name, instruction)
        assert all(game['animals'][r]['ap'] == rival_ap for r in game['rivals']) and game['animals'][game['human']]['ap'] == my_ap, name
        assert not errors, errors
        page.close()
    browser.close()
print('PASS turn-1 setup text for scaled and legacy five-rival Easy saves')
