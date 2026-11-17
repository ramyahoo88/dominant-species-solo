"""The Red Queen, deck only (v0.5.6; named cards only before v1.0.0). Start, draw until a deck reshuffles, undo, reload, export and import, open the
built-in rules and player aids, and come back to setup. Phone width, offline, no page or console errors.
Usage: python3 source/browser_draw_test.py Dominant_Species_Solo.html"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

HTML = Path(sys.argv[1]).resolve().as_uri()
DRAW_KEY = 'dominant-species-red-queen-cards-v1'
FULL_KEY = 'dominant-species-solo-v1'


def stored(page, key=DRAW_KEY):
    raw = page.evaluate('k => localStorage.getItem(k)', key)
    return json.loads(raw) if raw else None


with sync_playwright() as pw:
    browser = pw.chromium.launch(args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 844}, offline=True, accept_downloads=True)
    page = context.new_page()
    errors, requests = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.on('request', lambda r: not r.url.startswith(('file:', 'data:', 'blob:', 'about:')) and requests.append(r.url))
    page.goto(HTML)

    # Setup: three rivals, deck only, Hard. The level choice stays; the Dominance deck length is not asked.
    # v1.0.0: the two Red Queen choices are named guided and deck only, each with a one-line hint.
    page.locator('input[name=count][value="3"]').check()
    expect(page.locator('form[data-form=start]')).to_contain_text('The Red Queen · guided')
    expect(page.locator('form[data-form=start]')).to_contain_text('The Red Queen · deck only')
    expect(page.locator('form[data-form=start]')).not_to_contain_text('printed rivals')
    expect(page.locator('form[data-form=start]')).not_to_contain_text('cards only')
    page.locator('input[name=rules][value=paper]').check()
    expect(page.locator('.setup-bottom .seat-hint')).to_contain_text('Guided: the app runs the rivals')
    page.locator('input[name=rules][value=draw]').check()
    expect(page.locator('.setup-bottom .seat-hint')).to_contain_text('Deck only: the app only shuffles and draws')
    expect(page.locator('input[name=length]')).to_have_count(0)
    page.locator('input[name=extra][value="0"]').check()
    page.locator('button[type=submit]').click()
    expect(page.locator('h1')).to_have_text('Rival decks')
    expect(page.locator('.eyebrow').first).to_contain_text('The Red Queen · deck only · Hard')
    expect(page.locator('.rq-intro')).to_contain_text('Each rival has 5 action pawns, you have 5')
    # The header's references follow the mode (GPT v0.5.6 re-audit): Red Queen card faces and deck-only help.
    page.locator('header [data-do=decks]').click()
    expect(page.locator('#modal-heading')).to_have_text('Rival decks')
    expect(page.locator('.modal-body .rq-card')).to_have_count(8)
    expect(page.locator('.modal-body details')).to_have_count(0)
    page.locator('[data-do=close]').click()
    page.locator('header [data-do=help]').click()
    expect(page.locator('.modal-body p').first).to_contain_text('The Red Queen · deck only')
    expect(page.locator('.modal-body')).not_to_contain_text('Enter the actual elements')
    page.locator('[data-do=close]').click()
    rivals = stored(page)['draw']['rivals']
    assert len(rivals) == 3 and stored(page, FULL_KEY) is None
    expect(page.locator('[data-do=rq-draw]')).to_have_count(3)
    expect(page.locator('.rq-card')).to_have_count(0)

    # Eight draws deal each card once; the ninth reshuffles.
    first = rivals[0]
    draw = page.locator(f'[data-do=rq-draw][data-animal={first}]')
    shown = []
    for i in range(8):
        draw.click()
        shown.append(page.locator('.rq-card .rq-num').first.inner_text())
        expect(page.locator('.rq-deck').first).to_contain_text(f'{7 - i} left · {i + 1} discarded')
    assert sorted(shown) == [str(n) for n in range(1, 9)], shown
    expect(page.locator('.rq-note')).to_have_count(0)
    draw.click()
    expect(page.locator('.rq-note')).to_contain_text('reshuffled')
    expect(page.locator('.rq-deck').first).to_contain_text('7 left · 1 discarded')
    card = page.locator('.rq-card').first
    expect(card.locator('.rq-acts li')).to_have_count(3)
    expect(card.locator('.rq-foot')).to_contain_text('Under each action: when it has a target.')
    assert page.evaluate('document.activeElement.dataset.animal') == first

    # Undo returns the deck exactly; the next draw is the same card again.
    before = stored(page)['draw']
    ninth = page.locator('.rq-card .rq-num').first.inner_text()
    page.locator('[data-do=undo]').click()
    expect(page.locator('.rq-deck').first).to_contain_text('0 left · 8 discarded')
    draw.click()
    assert page.locator('.rq-card .rq-num').first.inner_text() == ninth
    assert stored(page)['draw']['decks'] == before['decks']

    # The other rivals' decks are untouched; draw one each.
    for other in rivals[1:]:
        page.locator(f'[data-do=rq-draw][data-animal={other}]').click()
    expect(page.locator('.rq-card')).to_have_count(3)
    expect(page.locator('.rq-recent li')).to_have_count(11)

    # Reload keeps everything.
    saved = stored(page)
    page.reload()
    expect(page.locator('.rq-card')).to_have_count(3)
    assert stored(page) == saved

    # The built-in rules and player aids open offline, inside the app.
    page.locator('[data-do=rules]').click()
    frame = page.frame_locator('.doc-frame')
    expect(frame.locator('h1')).to_have_text('The Red Queen')
    expect(frame.locator('h2').filter(has_text='Planning: placing a pawn')).to_have_count(1)
    expect(frame.locator('h2').filter(has_text='Appendix')).to_have_count(0)
    page.locator('[data-do=close]').click()
    page.locator('[data-do=aids]').click()
    expect(frame.locator('header h1')).to_have_count(10)
    expect(frame.locator('header h1').first).to_contain_text('Planning')
    page.locator('[data-do=close]').click()

    # Export, start over, import: the same decks come back.
    page.locator('#menu').click()
    with page.expect_download() as downloaded:
        page.locator('.modal-body [data-do=export]').click()
    exported = json.loads(Path(downloaded.value.path()).read_text())
    assert exported['format'] == 'red-queen-cards-only-v1' and exported['draw']['decks'] == saved['draw']['decks']
    assert downloaded.value.suggested_filename == 'The_Red_Queen_Deck_Only.json'
    page.locator('.modal-body [data-do=new]').click()
    page.locator('[data-do=new-confirm]').click()
    expect(page.locator('input[name=rules][value=draw]')).to_be_checked()
    expect(page.locator('input[name=extra][value="0"]')).to_be_checked()
    assert stored(page) is None
    page.locator('#import-file').set_input_files(downloaded.value.path())
    expect(page.locator('.rq-card')).to_have_count(3)
    assert stored(page)['draw']['decks'] == saved['draw']['decks']

    # A full game still starts normally from setup afterwards, and the two saves never mix.
    page.locator('#menu').click()
    page.locator('.modal-body [data-do=new]').click()
    page.locator('[data-do=new-confirm]').click()
    page.locator('input[name=rules][value=paper]').check()
    expect(page.locator('input[name=length]')).to_have_count(2)
    page.locator('button[type=submit]').click()
    expect(page.locator('.game-top .eyebrow')).to_contain_text('The Red Queen, Hard')
    assert stored(page) is None and stored(page, FULL_KEY)['game']['paper']['level'] == 'Hard'

    assert not errors, errors
    assert not requests, requests
    context.close()
    browser.close()
print('PASS deck-only mode: setup, 8 draws then reshuffle, undo, reload, rules and aids, export/import, back to a full game; offline, no errors')
