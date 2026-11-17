function hydrateFields() {
  for (const input of main.querySelectorAll('.turn-form [name]')) {
    if (!(input.name in draft)) continue;
    if (input.type === 'checkbox') input.checked = !!draft[input.name];
    else if (input.tagName !== 'SELECT' || [...input.options].some(o=>o.value===draft[input.name])) input.value = draft[input.name];
  }
}
function capture(input) {
  if (!input.name || !input.form?.classList.contains('turn-form')) return;
  draft[input.name] = input.type === 'checkbox' ? input.checked : input.value;
  if (game?.phase === 'supply' && input.form.dataset.form === 'supply') save();
}
function clearDraft(prefixes) {
  for (const key of Object.keys(draft)) if (prefixes.some(prefix=>key.startsWith(prefix))) delete draft[key];
}
function updateForm(input) {
  const key=input.name;
  if (!game || game.phase !== 'execution' || !input.form?.classList.contains('turn-form')) return;
  const step=nextStep(game);
  const dynamic = ['tile','pick','corner','origin','destination','saveCube','mode'];
  if (!dynamic.includes(key)) return;
  if (key === 'origin') clearDraft(['destination','quantity']);
  if (key === 'corner' && step.row === 'speciation') clearDraft(['add-']);
  if (key === 'tile' && step.kind === 'effect') clearDraft(['corner','keep','victim-','mass-','n','type']);
  if ((key === 'tile' || key === 'pick') && step.row === 'wanderlust') clearDraft(['corner']);
  if (key === 'mode') clearDraft(['type','slot']);
  render(false);
  main.querySelector('.turn-form [name="' + key + '"]')?.focus({preventScroll:true});
}
main.addEventListener('input',event => capture(event.target));
main.addEventListener('change',event => {
  const input=event.target;
  if (input.form?.dataset.form === 'start') {
    const key=input.name;
    if (key === 'length') setup.short=input.value === 'short';
    if (key === 'rules' || key === 'extra') {
      if (key === 'rules') { setup.paper=input.value !== 'app'; setup.draw=input.value === 'draw'; }
      if (key === 'extra') setup.extra=Number(input.value);
      render(false);
      main.querySelector('input[name="'+key+'"][value="'+input.value+'"]')?.focus({preventScroll:true});
      return;
    }
    if (key === 'count') {
      const n=Number(input.value);
      while (setup.bots.length < n) setup.bots.push(FOOD.find(a => a !== setup.human && !setup.bots.includes(a)));
      setup.bots.length=n;
      render(false);
      main.querySelector('input[name="count"][value="'+n+'"]')?.focus({preventScroll:true});
    }
    if (seatKeys().includes(key)) {
      const old=seatGet(key), value=input.value;
      const other=seatKeys().find(k=>k!==key && seatGet(k)===value);
      if (other) seatSet(other,old);
      seatSet(key,value);
      render(false);
      main.querySelector('select[name="'+key+'"]')?.focus({preventScroll:true});
    }
    return;
  }
  capture(input);
  updateForm(input);
});
main.addEventListener('toggle',event => { if (event.target.classList.contains('log-panel')) logOpen=event.target.open; },true);
main.addEventListener('submit',event => {
  const form=event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  const values=new FormData(form);
  try {
    if (form.dataset.form === 'start') {
      if (setup.paper && !PAPER_LEVELS.some(([n]) => n === setup.extra)) throw new Error('Choose a difficulty level for The Red Queen.');
      if (setup.draw) {
        drawGame=newDrawGame(setup.human,[...setup.bots],setup.extra,randomSeed());
        undo=[]; notice=''; initialError='';
        save(); render(true);
        return;
      }
      game=newGame(setup.human,[...setup.bots],setup.short,randomSeed(),setup.paper ? {extra:setup.extra} : null);
      activeTile='D3'; reveal=null; preview=null; draft={}; undo=[]; notice=''; initialError='';
      save(); render(true);
    }
    if (form.dataset.form === 'supply') {
      const draws = Object.fromEntries(SUPPLY_ROWS.map(row=>[row,Array.from({length:4},(_,i)=>supplyEntries()[row]?.[i] ?? null)]));
      const stacks = game.stacks.map((x,i)=>x.face || values.get('stack-'+i) || null);
      const market = game.market.map((x,i)=>x || values.get('card-'+i) || null);
      edit(s=>enterSupply(s,{...draws,stacks,market}));
    }
    if (form.dataset.form === 'place') edit(s=>place(s,values.get('slot')));
    if (form.dataset.form === 'action') {
      const step=nextStep(game);
      const choice=makePlayerChoice(step,values);
      showChoicePreview(step,choice);
    }
  } catch(err) { fail(err.message); }
});
function coneDiffSummary(before, after) {
  const changes = [];
  for (const tile of terrainIds(after)) {
    const prev = before.tiles[tile] ? cone(before, tile) : null;
    const next = cone(after, tile);
    if (prev === next) continue;
    if (!prev && next) changes.push('Place ' + nameOf(next) + '’s Dominance cone on ' + tileLabel(after, tile) + '.');
    else if (prev && !next) changes.push('Remove ' + nameOf(prev) + '’s Dominance cone from ' + tileLabel(after, tile) + '.');
    else changes.push('Replace ' + nameOf(prev) + '’s Dominance cone with ' + nameOf(next) + '’s on ' + tileLabel(after, tile) + '.');
  }
  return changes.length ? ' ' + changes.join(' ') : '';
}
function showChoicePreview(step,decision) {
  const trial=copy(game);
  runStep(trial,nextStep(trial),copy(decision));
  if (step.kind === 'weather' || step.kind === 'extinction' || step.kind === 'regression' || step.kind === 'effect' && step.name === 'Ice Age') {
    decision.label = step.kind === 'extinction' ? trial.log.findLast(x=>x.title==='Extinction and Survival').body :
      step.kind === 'regression' ? 'Check which added elements need protection. Affected animals will resolve their losses in food-chain order.' :
        trial.log.at(-1)?.body || 'Continue.';
  } else if (step.kind === 'pawn' && step.row === 'domination' && !decision.pass) decision.label=describeScore(game,decision.tile);
  else if ((step.kind === 'pawn' && step.row === 'glaciation' || step.kind === 'effect' && step.name === 'Ice Sheet') && decision.tile) {
    decision.label=glaciation(copy(game),step.actor,decision.tile);
  }
  const end = decision.label || 'Follow the indicated action on your board.';
  const pawn = step.kind === 'pawn' && step.row !== 'initiative' ? 'Remove the pawn from ' + slotLabel(step.key) + '. ' : '';
  const card = step.kind === 'claim' ? ' Take it from the physical display.' : '';
  const cones = step.kind === 'extinction' && trial.phase === 'finished' ? '' : coneDiffSummary(game, trial);
  preview={...decision,label:pawn+end+card+cones};
  notice='';
  render(true,true);
}
function executionPreview() {
  const step=nextStep(game);
  showChoicePreview(step,botAction(game,step));
}
function addMove() {
  const from=draft.origin,to=draft.destination,n=Number(draft.quantity ?? 1);
  const moves=draft.moves || [];
  const step=nextStep(game);
  const budget=7-step.index-sum(moves.map(m=>m.n));
  const fromAvailable=game.tiles[from]?.cubes[step.actor]-sum(moves.filter(m=>m.from===from).map(m=>m.n));
  if (!from || !to || !legalNeighbors(game,from,step.actor).includes(to) || !num(n) || n < 1 || n > budget || n > fromAvailable) {
    fail('Choose a legal destination and a cube count within your movement limit.');
    return;
  }
  draft.moves=[...moves,{from,to,n}];
  clearDraft(['origin','destination','quantity']);
  notice=''; render(false);
  main.querySelector('select[name="origin"]')?.focus({preventScroll:true});
}
function editSupplyDisks(button) {
  const {row, element, index, do: action} = button.dataset;
  if (game.phase !== 'supply' || !SUPPLY_ROWS.includes(row)) return;
  const entries = draft.supplyDraws ??= {};
  const disks = entries[row] ??= [];
  if (action === 'remove-disk') disks[Number(index)] = null;
  else if (ELEMENT_IDS.includes(element) && count(Object.values(entries).flat(),element) < bagCount(game,element)) {
    const slot = [0,1,2,3].find(i => !disks[i]);
    if (slot !== undefined) disks[slot] = element;
  }
  notice = '';
  save();
  render(false);
  const same = main.querySelector('[data-row="' + row + '"][data-element="' + (element ?? '') + '"]:not(:disabled)');
  const next = main.querySelector('[data-row="' + row + '"][data-do="add-disk"]:not(:disabled)') ??
    main.querySelector('[data-row="' + row + '"][data-do="remove-disk"]');
  (same ?? next)?.focus({preventScroll:true});
}
function editDraw(fn) {
  const old=copy(drawGame);
  try {
    fn(drawGame);
    validateDraw(drawGame);
  } catch (err) {
    drawGame=old;
    fail(err.message);
    return;
  }
  undo.push(old);
  if (undo.length > 60) undo.shift();
  notice='';
  save();
  render(false);
}
function openModal(kind) {
  modalKind=kind;
  renderModal();
  if (!modal.open) modal.showModal();
  else modal.querySelector('[data-do="close"]')?.focus();
}
// A Red Queen game keeps the rules it began with (recorded in the save). How to play states the current rules, so a
// game saved by an older version lists every rule it keeps that differs (v1.0.0; before, the notice missed the
// food-chain-only tie of v0.4.x games and the flat Easy of five-rival games from v0.5.0–v0.5.2).
function legacyNotice() {
  const p = game?.paper;
  if (!p) return '';
  const kept = [];
  if (!p.planFirst) kept.push(esc(paperLevel(p.extra, p)) + ' (' + (p.extra < 0 ? '−' + -p.extra : '+' + p.extra) + ' pawn' + (Math.abs(p.extra) === 1 ? '' : 's') + ' per rival)',
    'the rivals place in normal Initiative order');
  const flatEasy = !!p.planFirst && p.extra === -2 && game.rivals.length === 5 && !p.scaledEasy;
  if (flatEasy) kept.push('Easy is −2 pawns for each rival, with no extra pawn for you');
  if (!p.rivalTie) kept.push('a tie between rivals leaves the tile with no dominant animal');
  else if (!p.speciesTie) kept.push('when only rivals tie for the most matches on a tile, the one higher in the food chain is dominant');
  if (!kept.length) return '';
  const since = !p.rivalTie ? 'v0.4.0' : !p.planFirst ? 'v0.5.0' : flatEasy ? 'v0.5.3' : 'v0.5.4';
  return '<p><b>This saved game</b> was started before ' + since + ' and keeps these rules from then, in place of the ones above: ' +
    (kept.length > 1 ? kept.slice(0,-1).join(', ') + ', and ' + kept.at(-1) : kept[0]) + '.</p>';
}
function renderModal() {
  const titles={help:'How to play',decks:'Rival decks',menu:'Game menu',new:'Start a new game?',rules:'Rules',aids:'Player aids'};
  let content='';
  const doc=modalKind === 'rules' || modalKind === 'aids';
  modal.classList.toggle('doc-modal',doc);
  if (doc) content='<iframe class="doc-frame" sandbox title="' + titles[modalKind] + '"></iframe>';
  // v0.5.7 (GPT's v0.5.6 re-audit): the header's references follow the mode. In deck-only play the app tracks no board, so
  // How to play starts with that mode and Rival decks shows the printed card faces.
  const queen = !!(game ? game.paper : drawGame || setup.paper);
  const cardsOnly = !game && (drawGame ? true : !!setup.draw);
  if (modalKind === 'help' && cardsOnly) content =
    '<p>You are playing <b>The Red Queen · deck only</b>: you run the rivals yourself, by the printed rules, on your physical copy of Chad Jensen’s original GMT game. The app keeps each rival’s deck; it does not track the board.</p>' +
    '<ol><li>Set up the base game for your player count, with the pawns the app shows for your level (the rulebook’s Setup and difficulty).</li>' +
    '<li>Each time a rival places a pawn in Planning, including the pawn it places before anyone else, tap <b>Draw</b> for that rival and follow Planning steps 1–6 with that card. Moving a pawn with Initiative or Instinct does not draw a card.</li>' +
    '<li>Resolve everything else yourself: <b>Rules</b> opens the full rulebook and <b>Player aids</b> the ten reference sheets, both inside the app.</li>' +
    '<li>When a rival’s deck runs out, the app reshuffles its discards and says so. <b>Undo</b> takes back the last draw. The decks are saved on this device; export a save before switching browsers or devices.</li></ol>' +
    '<p>To let the app run the rivals and track the board instead, start a new game and choose <b>The Red Queen · guided</b> or <b>Tooth &amp; Claw</b>.</p>' +
    '<p><a href="'+RULEBOOK+'" target="_blank" rel="noopener noreferrer">GMT rulebook</a> · <a href="'+PHOTO+'" target="_blank" rel="noopener noreferrer">Portage Glacier photo, USGS</a></p>';
  else if (modalKind === 'help') content =
    '<p>Use your physical copy of Chad Jensen’s original GMT game. Set up one animal for yourself and two to five rivals with the base game’s allotment for that player count (6 pawns and 50 cubes per animal with two rivals; 5 and 45 with three; 4 and 40 with four; 3 and 35 with five), including each VP marker. Use the standard starting map shown in the app.</p>' +
    '<ol><li>Enter the actual elements, tile stack faces and Dominance Cards when the app requests them. Keep the official cards and tiles at your table.</li>' +
    '<li>Place your own pawns. Reveal a card for each rival placement and mirror the indicated slot on your action display.</li>' +
    '<li>Apply each action to the physical board and confirm it here. The Earth map uses the starting wetland as north. Corner 1 points right, and corners 2–6 follow clockwise. The map shows a shared corner once.</li>' +
    '<li>Follow the app’s Extinction and Survival prompts. After Ice Age, complete the turn and compare the final scores.</li></ol>' +
    '<h3>Rival cards</h3><p>With <b>Tooth &amp; Claw</b>, the app\'s own rivals, each rival shuffles its own eight-card deck, checks one condition per placement and starts on the corresponding face. The action list guides the pawn placement. The rival can take another open space when it sees a stronger opportunity. Targets are chosen when the pawn resolves.</p><p>With <b>The Red Queen · guided</b>, the rivals follow the printed rulebook (The Red Queen: solo rivals for Dominant Species) exactly, and the app works out every decision and tracks the board: one fixed set of three actions on each card, simple counting rules, and a pawn adjustment for difficulty (' + PAPER_LEVELS.map(([n,name]) => name + ' ' + (n < 0 ? '−' + -n : n ? '+' + n : '0')).join(', ') + '; Easy with five rivals is −1 for each rival and +1 for you). The rivals plan first: at the start of each Planning, they place one pawn each before anyone else, in Initiative order. When only rivals tie for the most matches on a tile, the rival with the most species there is dominant, then the one higher in the food chain; a tie that includes you leaves the tile with no dominant animal. If no rival has any species left on Earth, a rival\'s Abundance may use any empty corner, so species can return. Use it to learn the printed rules, or to play them without printing anything.</p>' +
    '<p>With <b>The Red Queen · deck only</b>, you run the rivals yourself from the rulebook, without printing it or the cards. The app shuffles each rival’s eight-card deck, shows the card you draw (reshuffling a rival’s discards when its deck runs out), and keeps the rulebook and player aids a tap away. It does not track the board.</p>' +
    legacyNotice() +
    '<h3>Board tracking</h3><p>The companion checks cones automatically. When a protected Hibernation cube shares a tile with other cubes of the same animal, the app moves or removes the ordinary cubes first. Confirm each physical move to save it. Undo is available until you close or reload the page. Export a save before switching browsers or devices.</p>' +
    '<p><a href="'+RULEBOOK+'" target="_blank" rel="noopener noreferrer">GMT rulebook</a> · <a href="'+PHOTO+'" target="_blank" rel="noopener noreferrer">Portage Glacier photo, USGS</a></p>';
  if (modalKind === 'decks' && queen) content='<div class="deck-tabs" role="group" aria-label="Animal deck">' + FOOD.map(id=>button(nameOf(id),'deck-tab','sm',
    'data-animal="'+id+'" aria-pressed="'+(id===deckTab)+'"')).join('') + '</div><p class="actorline">' + badge(deckTab) + ANIMALS[deckTab].power + '</p>' +
    '<p class="muted">The Red Queen’s cards, as printed: each lists three actions, tried in order (Planning step 4).</p><div class="rq-grid rq-deck-grid">' +
    DECKS[deckTab].map((card,i)=>rqCard(deckTab,i)).join('') + '</div>';
  else if (modalKind === 'decks') content='<div class="deck-tabs" role="group" aria-label="Animal deck">' + FOOD.map(id=>button(nameOf(id),'deck-tab','sm',
    'data-animal="'+id+'" aria-pressed="'+(id===deckTab)+'"')).join('') + '</div><p class="actorline">' + badge(deckTab) + ANIMALS[deckTab].power + '</p>' +
    '<div class="deck-grid">' + DECKS[deckTab].map(card=>'<article class="deck-card"><h3>'+card.title+'</h3><p>'+CHECKS[card.check]+'?</p>' +
    '<details><summary>Yes · '+FOCUSES[card.yes.focus]+'</summary>'+cardRows(card.yes)+'</details>' +
    '<details><summary>No · '+FOCUSES[card.no.focus]+'</summary>'+cardRows(card.no)+'</details></article>').join('') + '</div>';
  if (modalKind === 'menu') content='<div class="stack-actions">' + button('Export save','export') + button('Import save','import') + button('Start a new game','new','subtle') + '</div>';
  if (modalKind === 'new') content='<p>This replaces the current game on this device. Export it first if you want to return to it.</p><div class="form-actions">' +
    button('Start new game','new-confirm','primary') + button('Export current save','export','subtle') + '</div>';
  modal.innerHTML='<div class="modal-header"><h2 id="modal-heading">'+titles[modalKind]+'</h2>' +
    button('Close','close','sm subtle','autofocus') + '</div><div class="modal-body">'+content+'</div>';
  if (doc) modal.querySelector('.doc-frame').srcdoc = modalKind === 'rules' ? RQ_RULES : RQ_AIDS;
}
function exportSave() {
  if (!game && !drawGame) return;
  const body=saveContents();
  const url=URL.createObjectURL(new Blob([body],{type:'application/json'}));
  const a=document.createElement('a');
  a.href=url; a.download=game ? 'Dominant_Species_Turn_'+game.turn+'.json' : 'The_Red_Queen_Deck_Only.json';
  document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importSave(file) {
  if (!file) return;
  try {
    if (file.size > 1_500_000) throw new Error('That file is too large for a companion save.');
    const parsed=JSON.parse(await file.text());
    if (parsed.format === DRAW_FORMAT) {
      const cards=validateDraw(parsed.draw);
      undo=[]; game=null; drawGame=cards; reveal=null; preview=null; draft={}; notice=''; initialError='';
      if (modal.open) modal.close();
      save(); render(true);
      return;
    }
    if (parsed.format !== SAVE_KEY) throw new Error('Choose a save exported by this companion.');
    const loaded=validateState(parsed.game);
    if (game) undo=[copy(game)]; else undo=[];
    drawGame=null; game=loaded; activeTile='D3'; reveal=null; preview=null; draft=readSupplyDraft(loaded,parsed.supply); notice=''; initialError='';
    if (modal.open) modal.close();
    save(); render(true);
  } catch (err) {
    if (modal.open) modal.close();
    fail(err instanceof SyntaxError ? 'This file does not contain a readable JSON save.' : err.message);
  }
}
document.getElementById('import-file').addEventListener('change',event => {
  const file=event.target.files[0];
  event.target.value='';
  void importSave(file);
});
document.addEventListener('click',event => {
  const btn=event.target.closest('button[data-do]');
  if (!btn || btn.disabled) return;
  try {
    switch (btn.dataset.do) {
      case 'decks': case 'help': case 'menu': case 'rules': case 'aids': openModal(btn.dataset.do); break;
      case 'rq-draw':
        if (drawGame && drawGame.rivals.includes(btn.dataset.animal)) {
          editDraw(s=>drawFor(s,btn.dataset.animal));
          main.querySelector('[data-do="rq-draw"][data-animal="'+btn.dataset.animal+'"]')?.focus({preventScroll:true});
        }
        break;
      case 'close': modal.close(); break;
      case 'deck-tab':
        deckTab=btn.dataset.animal; renderModal(); modal.querySelector('[data-animal="'+deckTab+'"]')?.focus(); break;
      case 'new': openModal('new'); break;
      case 'new-confirm':
        if (drawGame) setup={human:drawGame.human,bots:[...drawGame.rivals],short:setup.short,paper:true,draw:true,extra:drawGame.extra};
        // Keep the level by name on the current pawn scale. If an older save's level can't be recovered, the player chooses.
        else setup={human:game.human,bots:[...game.rivals],short:game.short,paper:!!game.paper,extra:game.paper ? paperExtraFor(paperLevel(game.paper.extra, game.paper)) : paperExtraFor('Standard')};
        game=null; drawGame=null; undo=[]; reveal=null; preview=null; draft={}; notice=''; initialError='';
        modal.close(); save(); render(false);
        main.focus();
        break;
      case 'export': exportSave(); break;
      case 'import': document.getElementById('import-file').click(); break;
      case 'tile':
        activeTile=btn.dataset.tile;
        render(false);
        main.querySelector('.hex[data-tile="'+activeTile+'"]')?.focus({preventScroll:true});
        break;
      case 'place':
        if (game.phase==='planning' && currentPlanner(game)?.actor===game.human && !reveal) edit(s=>place(s,btn.dataset.slot));
        break;
      case 'draw': {
        const actor=currentPlanner(game)?.actor;
        if (actor && isBot(game,actor)) {
          reveal={...botPlacement(copy(game)),actor}; notice=''; render(true,true);
        }
        break;
      }
      case 'next':
        if (reveal) edit(s=>botPlacement(s));
        break;
      case 'preview': executionPreview(); break;
      case 'cancel-preview': preview=null; notice=''; render(true,true); break;
      case 'apply':
        if (preview) edit(s=>runStep(s,nextStep(s),copy(preview)));
        break;
      case 'pass': {
        const step=nextStep(game);
        if (step.kind==='pawn' || step.kind==='insect' || step.kind==='spider') showChoicePreview(step,{...PASS});
        break;
      }
      case 'undo':
        if (!game && drawGame) {
          if (undo.length) { drawGame=undo.pop(); notice=''; save(); render(true,true); }
          break;
        }
        if (reveal || preview) { reveal=null; preview=null; render(true,true); }
        else if (undo.length) {
          game=undo.pop(); reveal=null; preview=null; draft={}; notice='';
          save(); render(true,true);
        }
        break;
      case 'add-move': addMove(); break;
      case 'add-disk': case 'remove-disk': editSupplyDisks(btn); break;
      case 'remove-move':
        draft.moves.splice(Number(btn.dataset.index),1); render(false); break;
    }
  } catch(err) { fail(err.message); }
});
document.getElementById('version').textContent='v'+VERSION;
restore();
if (game) save();
render();
