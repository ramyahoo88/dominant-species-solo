const main = document.getElementById('main');
const modal = document.getElementById('modal');
const status = document.getElementById('save-status');
const num = n => Number.isInteger(n) && n >= 0;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option = (value, label = value) => '<option value="' + esc(value) + '">' + esc(label) + '</option>';
const button = (text, action, cls = '', attrs = '') => '<button type="button" class="button ' + cls + '" data-do="' + action + '" ' + attrs + '>' + text + '</button>';
const blank = option('', 'Choose…');
const enable = a => a ? '' : ' disabled';
const badge = (id, tiny = false) => '<span class="mark' + (tiny ? ' tiny' : '') + '" style="' + animalStyle(id) + '" aria-hidden="true">' + ANIMALS[id].mark + '</span>';
const animalStyle = id => '--chip:' + ANIMALS[id].color + ';--chip-ink:' + ANIMALS[id].ink;
const field = (label, input, wide = false) => '<label class="form-field' + (wide ? ' wide' : '') + '"><span class="field-title">' + esc(label) + '</span>' + input + '</label>';
function select(name, items, required = true, none = null) {
  return '<select name="' + name + '"' + (required ? ' required' : '') + '>' + (none !== null ? option('',none) : required ? blank : '') +
    items.map(item => Array.isArray(item) ? option(item[0],item[1]) : option(item)).join('') + '</select>';
}
function intInput(name, max, value = 0) {
  return '<input type="number" name="' + name + '" min="0" max="' + max + '" step="1" value="' + value + '" required>';
}
const submit = (text = 'Confirm action') => '<button class="button primary" type="submit">' + esc(text) + '</button>';
const form = (body, action, text, canPass = false) => '<form class="turn-form" data-form="' + action + '">' + body +
  '<div class="form-actions">' + submit(text) + (canPass ? button('Forfeit action','pass','subtle') : '') + '</div></form>';
const E = types => types.map(type => [type,elementName(type)]);
const T = ids => ids.map(id => [id,tileLabel(game,id)]);
const A = ids => ids.map(id => [id,nameOf(id)]);
const cardRows = face => '<div class="card-flow">' + face.rows.map(row => '<span>' + ROW_BY_ID[row].name + '</span>').join('') + '</div>';
let game = null;
let undo = [];
let setup = {human:'amphibians',bot1:'birds',bot2:'arachnids',short:true};
let activeTile = 'D3';
let reveal = null;
let preview = null;
let draft = {};
let deckTab = 'mammals';
let modalKind = '';
let notice = '';
let logOpen = false;
let initialError = '';
const randomSeed = () => (globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Math.floor(Math.random()*4294967296)) >>> 0;

function fail(message) {
  notice = String(message);
  const node = document.getElementById('notice');
  if (node) { node.textContent = notice; node.hidden = false; }
}
function save() {
  try {
    if (game) localStorage.setItem(SAVE_KEY, saveContents());
    else localStorage.removeItem(SAVE_KEY);
    status.textContent = game ? 'Saved on this device' : '';
  } catch {
    status.textContent = game ? 'Local saving unavailable. Use Export save.' : '';
  }
}
function saveContents() {
  const supply = game.phase === 'supply' ? draft : undefined;
  return JSON.stringify({format:SAVE_KEY,game,supply});
}
function readSupplyDraft(s, raw) {
  if (s.phase !== 'supply' || !raw || typeof raw !== 'object') return {};
  const restored = {supplyDraws:{}};
  const entered = Object.fromEntries(ELEMENT_IDS.map(type => [type,0]));
  for (const row of SUPPLY_ROWS) {
    const values = Array.isArray(raw.supplyDraws?.[row]) ? raw.supplyDraws[row].slice(0,4) : [];
    restored.supplyDraws[row] = values.map(type => {
      if (!ELEMENT_IDS.includes(type) || entered[type] >= bagCount(s,type)) return null;
      entered[type]++;
      return type;
    });
  }
  for (const [i,stack] of s.stacks.entries()) {
    if (!stack.face && stack.left && LARGE_TERRAIN.includes(raw['stack-'+i])) restored['stack-'+i] = raw['stack-'+i];
  }
  for (const i of nextCardSlots(s)) {
    if (DOMINANCE.includes(raw['card-'+i])) restored['card-'+i] = raw['card-'+i];
  }
  return restored;
}
function validateState(s) {
  function assert(ok) { if (!ok) throw new Error('This is not a valid Dominant Species companion save.'); }
  if (s && ['0.1.0', '0.2.0', '0.3.0', '0.3.1', '0.3.2'].includes(s.version)) s.version = VERSION;
  const keys = value => value && typeof value === 'object' ? Object.keys(value) : [];
  assert(s && s.version === VERSION && ['supply','planning','execution','finished'].includes(s.phase) &&
    num(s.turn) && s.turn > 0 && num(s.rng) && s.rng <= 0xffffffff && num(s.seed) && s.seed <= 0xffffffff);
  assert(Array.isArray(s.ids) && s.ids.length === 3 && unique(s.ids).length === 3 && s.ids.every(id => FOOD.includes(id)) &&
    s.ids.includes(s.human) && Array.isArray(s.rivals) && s.rivals.length === 2 && unique(s.rivals).length === 2 &&
    s.rivals.every(id => id !== s.human && s.ids.includes(id)) && typeof s.short === 'boolean');
  assert(Array.isArray(s.initiative) && s.initiative.length === 3 && unique(s.initiative).length === 3 && s.initiative.every(id => s.ids.includes(id)) &&
    num(s.cursor) && s.cursor <= EXECUTION.length && num(s.planning) && s.planning < 3 && typeof s.ending === 'boolean');
  assert(s.tiles && s.corners && s.pawns && s.animals && s.boxes && s.decks && terrainIds(s).length >= 7 && Object.keys(INITIAL_TILES).every(id => s.tiles[id]));
  assert(keys(s.tiles).every(id => Object.hasOwn(HEXES,id) && Object.hasOwn(TERRAIN,s.tiles[id]?.terrain) && s.ids.every(a => num(s.tiles[id].cubes?.[a])) &&
    keys(s.tiles[id].cubes).length === 3) && keys(s.corners).every(key => Object.hasOwn(CORNER_TILES,key) &&
    CORNER_TILES[key].some(id => s.tiles[id]) && ELEMENT_IDS.includes(s.corners[key])));
  assert(s.ids.every(id => {
    const a = s.animals[id];
    return a && num(a.vp) && num(a.ap) && a.ap <= 10 && num(a.remaining) && a.remaining <= 10 && num(a.pool) && num(a.dead) &&
      a.pool + a.dead + sum(occupied(s,id).map(t => s.tiles[t].cubes[id])) === PLAYABLE_SPECIES && Array.isArray(a.added) &&
      a.added.length + ANIMALS[id].affinity <= 6 && a.added.every(type => ELEMENT_IDS.includes(type)) && a.ward &&
      keys(a.ward).every(tile => s.tiles[tile] && num(a.ward[tile]) && a.ward[tile] <= s.tiles[tile].cubes[id]);
  }));
  assert(keys(s.pawns).every(key => {
    const pawn = s.pawns[key];
    return ALL_SLOTS.includes(key) && s.ids.includes(pawn?.actor) &&
      (pawn.card === null || isBot(s,pawn.actor) && num(pawn.card) && pawn.card < 8) &&
      (pawn.focus === null || Object.hasOwn(FOCUSES,pawn.focus));
  }) && s.ids.every(id => pawnCount(s,id) <= s.animals[id].ap));
  assert(s.rivals.every(id => {
    const d = s.decks[id];
    return d && Array.isArray(d.queue) && Array.isArray(d.discards) && d.queue.length + d.discards.length === 8 &&
      unique([...d.queue,...d.discards]).length === 8 && [...d.queue,...d.discards].every(n => num(n) && n < 8);
  }));
  assert(elementRows.every(row => Array.isArray(s.boxes[row]) && s.boxes[row].length <= 4 && s.boxes[row].every(el => el === null || ELEMENT_IDS.includes(el))) &&
    ELEMENT_IDS.every(type => bagCount(s,type) >= 0));
  assert(Array.isArray(s.stacks) && s.stacks.length === 3 && s.stacks.every(x => x && num(x.left) && x.left <= 8 &&
    (x.face === null || (x.left > 0 && LARGE_TERRAIN.includes(x.face)))) &&
    sum(s.stacks.map(x => x.left)) + terrainIds(s).length === 31);
  assert(Array.isArray(s.market) && s.market.length === 5 && s.market.every(card => card === null || DOMINANCE.includes(card)) &&
    Array.isArray(s.usedCards) && s.usedCards.every(card => DOMINANCE.includes(card)) &&
    unique([...s.market.filter(Boolean),...s.usedCards]).length === s.market.filter(Boolean).length+s.usedCards.length);
  assert(Array.isArray(s.scored) && unique(s.scored).length === s.scored.length && s.scored.every(id => Object.hasOwn(s.tiles,id)) &&
    Array.isArray(s.pending) && s.pending.every(x => validPending(s,x)) &&
    Array.isArray(s.log) && s.log.length <= 650 && s.log.every(x => x && typeof x.title === 'string' && typeof x.body === 'string' && num(x.turn) &&
      (x.actor === null || s.ids.includes(x.actor)) && (x.card === null || s.rivals.includes(x.actor) && num(x.card) && x.card < 8)));
  return s;
}
function validPending(s, step) {
  if (!step || !s.ids.includes(step.actor)) return false;
  if (step.kind === 'immigrant') return true;
  if (step.kind === 'arrival' || step.kind === 'claim') return Object.hasOwn(s.tiles,step.tile);
  if (step.kind === 'effect') return Object.hasOwn(s.tiles,step.tile) && s.usedCards.includes(step.name);
  if (step.kind === 'symbiosis') return Array.isArray(step.recipients) && unique(step.recipients).length === step.recipients.length &&
    step.recipients.every(id => s.ids.includes(id));
  if (step.kind !== 'loss') return false;
  const due = step.due;
  return ['Regression','Disease'].includes(step.source) && Array.isArray(due?.threats) && num(due.drops) && due.drops > 0 &&
    due.drops <= due.threats.length && due.threats.every(type => s.animals[step.actor].added.includes(type));
}
function restore() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const save = JSON.parse(raw);
      game = validateState(save.game);
      draft = readSupplyDraft(game,save.supply);
    }
    if (game) activeTile = game.tiles.D3 ? 'D3' : terrainIds(game)[0];
  } catch (err) {
    if (err.name !== 'SecurityError') initialError = 'The local save could not be opened. Import a previously exported save from the setup screen.';
  }
}
function edit(fn, options = {}) {
  const old = copy(game);
  const board = JSON.stringify(old);
  try {
    fn(game);
    validateState(game);
  } catch (err) {
    game = old;
    fail(err.message);
    return false;
  }
  if (JSON.stringify(game) !== board) {
    undo.push(old);
    if (undo.length > 60) undo.shift();
  }
  draft = {};
  reveal = null;
  preview = null;
  notice = '';
  save();
  render(options.focus !== false);
  return true;
}
function stepTitle(step) {
  if (step.kind === 'pawn') return ROW_BY_ID[step.row].name;
  return ({
    regression:'Regression', loss:step.source, weather:'Wasteland', insect:'Free Speciation', spider:'Free Competition',
    arrival:'Wanderlust arrival', claim:'Choose a Dominance Card', effect:step.name, symbiosis:'Symbiotic draws',
    immigrant:'Immigrants', extinction:'Extinction and Survival',
  })[step.kind];
}
function setupPage() {
  const seats = [['human','You'],['bot1','Rival one'],['bot2','Rival two']];
  const seat = ([key,label]) => {
    const id = setup[key];
    return '<div class="seat ' + key + '"><label><span class="seat-role">' + label + '</span><span class="seat-head">' + badge(id) +
      '<select name="' + key + '">' + FOOD.map(a => '<option value="' + a + '"' + (a === id ? ' selected' : '') + '>' + nameOf(a) + '</option>').join('') +
      '</select></span></label><p>' + ANIMALS[id].power + '</p></div>';
  };
  main.innerHTML = '<section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><p class="eyebrow">Tabletop solo companion</p>' +
    '<h1 id="hero-title">Dominant Species</h1><p>Take one animal into the Ice Age. Two card-driven rivals compete for the same world.</p></div></section>' +
    '<section class="panel setup-panel"><div class="setup-title"><h2>Set up your game</h2><p>Use the three-player setup in your GMT box.</p></div>' +
    '<div class="notice" role="alert" id="notice"' + (notice || initialError ? '' : ' hidden') + '>' + esc(notice || initialError) + '</div>' +
    '<form data-form="start"><div class="seats">' + seats.map(seat).join('') + '</div><p class="seat-hint">Choosing an animal already at the table swaps the two seats.</p><div class="setup-bottom">' +
    '<fieldset><legend>Dominance deck</legend><div class="segment">' +
    '<label><input name="length" type="radio" value="short"' + (setup.short ? ' checked' : '') + '> Short game · 22 cards</label>' +
    '<label><input name="length" type="radio" value="full"' + (!setup.short ? ' checked' : '') + '> Full game · 26 cards</label></div></fieldset>' +
    '<div class="form-actions">' + button('Import save','import','subtle') + submit('Start game') + '</div></div></form></section>';
}
function tinySlot(key) {
  const {row,index} = splitSlot(key);
  if (row === 'speciation') return ELEMENTS[ELEMENT_IDS[index]].mark;
  if (row === 'migration') return String(7-index);
  if (row === 'competition') return terrainName(COMPETITION_EDGES[index]).slice(0,3) + '/' + terrainName(COMPETITION_EDGES[index+1]).slice(0,3);
  return String(index+1);
}
function showActionDisplay() {
  const canPlace = game.phase === 'planning' && currentPlanner(game)?.actor === game.human && !reveal;
  const step = nextStep(game);
  const target = reveal?.slot || step?.key;
  const content = ROWS.map(row => {
    const slots = row.slots.map(key => {
      const pawn = game.pawns[key];
      const isHere = target === key;
      const full = slotLabel(key) + (pawn ? ' · ' + nameOf(pawn.actor) : ' · vacant');
      return '<button class="slot' + (pawn ? ' pawn' : '') + (isHere ? ' target' : '') +
        '" type="button" data-do="place" data-slot="' + key + '" aria-label="' + esc(full) + '" title="' + esc(full) + '"' +
        (pawn ? ' style="' + animalStyle(pawn.actor) + '"' : '') + enable(canPlace && !pawn) + '>' +
        (pawn ? ANIMALS[pawn.actor].mark + '<small>' + tinySlot(key) + '</small>' : tinySlot(key)) + '</button>';
    }).join('');
    return '<div class="action-row"><span class="row-name">' + row.name + '</span><div class="slots">' + slots + '</div></div>';
  }).join('');
  return '<section class="panel block" id="action-display"><div class="block-head"><h3>Action display</h3><small>' + (canPlace ? 'Choose any open space' : 'Read top to bottom') + '</small></div>' +
    '<div class="row-board">' + content + '</div>' +
    (game.phase !== 'supply' && game.phase !== 'finished' ? '<div class="row-status">' + elementRows.map(row => '<span title="' + ROW_BY_ID[row].name + '">' +
      ROW_BY_ID[row].name + ' · ' + (game.boxes[row].filter(Boolean).map(type => ELEMENTS[type].mark).join(' ') || '—') + '</span>').join('') + '</div>' : '') +
    '</section>';
}
function showEarth() {
  const pos = (x,y) => '--x:' + ((x+12)/24*100).toFixed(4) + '%;--y:' + ((y+7)/14*100).toFixed(4) + '%';
  const selected = game.tiles[activeTile];
  const hexes = GRID.map(hex => {
    const t = game.tiles[hex.id];
    const owner = t && game.phase !== 'finished' ? cone(game,hex.id) : null;
    const tokens = t ? game.ids.filter(a => t.cubes[a]).map(a => '<span class="hex-token' + (!match(game,hex.id,a) ? ' endangered' : '') +
      '" style="' + animalStyle(a) + '">' + ANIMALS[a].mark + ' ' + t.cubes[a] + '</span>').join('') : '';
    const full = tileLabel(game,hex.id) + (t ? ' · ' + game.ids.filter(a=>t.cubes[a]).map(a=>nameOf(a)+' '+t.cubes[a]).join(', ') : '') +
      (owner ? ' · ' + nameOf(owner) + ' dominant' : '');
    return '<button type="button" class="hex' + (t ? '' : ' empty') + '" style="' + pos(hex.x,hex.y) + (t ? ';--terrain:' + TERRAIN[t.terrain].color : '') +
      '" data-do="tile" data-tile="' + hex.id + '" aria-pressed="' + (hex.id === activeTile) + '" aria-label="' + esc(full) + '" title="' + esc(full) +
      '"><span class="hex-inner"><span class="hex-id">' + hex.id + '</span>' + (t ? '<span class="hex-terrain">' + terrainName(t.terrain) +
      '</span><span class="hex-tokens">' + tokens + '</span>' : '') + '</span>' +
      (owner ? '<span class="cone-marker" aria-hidden="true" style="' + animalStyle(owner) + '">' + ANIMALS[owner].mark + '</span>' : '') + '</button>';
  }).join('');
  const disks = Object.entries(game.corners).map(([key,type]) => {
    const [x,y] = key.split(',').map(Number);
    return '<span aria-hidden="true" class="element-dot" style="' + pos(x,y) + ';--chip:' + ELEMENTS[type].color + '">' + ELEMENTS[type].mark + '</span>';
  }).join('');
  let detail;
  if (!selected) detail = '<b>' + activeTile + '</b> · Vacant board space';
  else {
    const owner = cone(game,activeTile);
    const presence = game.ids.filter(a=>selected.cubes[a]).map(a=>nameOf(a) + ' ' + selected.cubes[a] + ' cube' + (selected.cubes[a] === 1 ? '' : 's') +
      ' / ' + match(game,activeTile,a) + ' matches').join(' · ');
    const els = VERTICES_OF[activeTile].flatMap((key,i) => game.corners[key] ? ['<span class="element-chip" style="--chip:' + ELEMENTS[game.corners[key]].color +
      '">' + (i+1) + ' ' + elementName(game.corners[key]) + '</span>'] : []).join('');
    detail = '<b>' + tileLabel(game,activeTile) + '</b> · ' + (owner && game.phase !== 'finished' ? nameOf(owner) + ' dominant' : 'No cone') +
      (game.scored.includes(activeTile) && game.phase !== 'finished' ? ' · Scored this turn' : '') + '<p>' + esc(presence || 'No cubes') + '</p><div class="element-list">' +
      (els || '<span>No elements</span>') + '</div>';
  }
  return '<section class="panel board-panel" id="earth-panel"><div class="block-head"><h3>Earth</h3><small>Tap a hex to inspect</small></div>' +
    '<div class="earth" aria-label="Earth map, north up">' + hexes + disks + '</div><div class="tile-detail" aria-live="polite">' + detail + '</div>' +
    '<div class="map-help"><span>▲ Dominance cone</span><span>Corner 1 is at the right tip. Count clockwise.</span></div></section>';
}
function showMarket() {
  const market = availableCards(game);
  const stacks = game.stacks.map((x,i) => 'Stack ' + (i+1) + ' · ' + (x.face ? terrainName(x.face) : x.left ? 'Face down' : 'Empty'));
  return '<section class="panel block"><div class="block-head"><h3>Dominance Cards</h3><small>' + game.usedCards.length + ' used</small></div><div class="market">' +
    (market.map(card => '<span' + (card === 'Ice Age' ? ' class="ice"' : '') + '>' + card + '</span>').join('') || '<small>No cards face up.</small>') +
    '</div><div class="row-status">' + stacks.map(s => '<span>' + s + '</span>').join('') + '</div></section>';
}
function showLog() {
  return '<details class="panel block log-panel"' + (logOpen ? ' open' : '') + '><summary>Turn log <small>(' + game.log.length + ')</small></summary>' +
    (game.log.length > 60 ? '<p class="lead">Most recent 60 entries</p>' : '') +
    '<ol class="log-list">' + ([...game.log].reverse().slice(0,60).map(entry => '<li><small>Turn ' + entry.turn +
    (entry.card !== null && entry.actor ? ' · ' + esc(DECKS[entry.actor][entry.card].title) : '') + '</small><b>' + esc(entry.title) +
    '</b><p>' + esc(entry.body) + '</p></li>').join('') || '<li>No moves yet.</li>') + '</ol></details>';
}
function showSupply() {
  const emptyCardSlots = nextCardSlots(game);
  const finalDraw = game.usedCards.length + availableCards(game).length + emptyCardSlots.length === (game.short ? 22 : 26);
  const eligible = DOMINANCE.filter(card => !game.market.includes(card) && !game.usedCards.includes(card) &&
    (!game.short || !SHORT_EXCLUDES.includes(card)) && (card !== 'Ice Age' || finalDraw));
  const cards = emptyCardSlots.map(i => field('Card space ' + (i+1),select('card-'+i,eligible))).join('');
  const draws = SUPPLY_ROWS.map(supplyRow).join('');
  const stackList = game.stacks.flatMap((x,i) => x.left && !x.face ?
    [field('Wanderlust stack ' + (i+1),select('stack-'+i,LARGE_TERRAIN.map(t=>[t,terrainName(t)])))] : []).join('');
  const instruction = game.turn === 1 ?
    'For each animal, set out six action pawns and 50 cubes. Use one cube to mark VP, put four on the map and leave 45 in the gene pool. Match the Earth map with Wetland at the top.' :
    'Slide the physical action display as usual. Refill the three draw rows, turn up any face-down tile stacks, and fill the open card spaces.';
  return '<div class="block-head"><h2 id="turn-focus" tabindex="-1">Enter board draws</h2><span class="phase-badge">' + (game.turn === 1 ? 'Setup' : 'Reseed') +
    '</span></div><p class="instruction">' + instruction + '</p>' +
    (game.turn === 1 ? '<p class="lead">' + (game.short ? 'For the 22-card game, set aside Immigrants, Intelligence, Omnivore and Parasitism. ' : '') +
      'Put Ice Age at the bottom of the deck.</p>' : '') +
    form('<p class="draw-instruction">Tap the element colors in the order you place the disks.</p>' + draws + (stackList ? '<div class="fields three">' + stackList + '</div>' : '') +
      (cards ? '<div class="fields two">' + cards + '</div>' : ''),'supply','Begin Planning');
}
const SUPPLY_ROWS = ['adaptation','abundance','wanderlust'];
const supplyEntries = () => draft.supplyDraws ?? {};
function supplyRow(row) {
  const label = ROW_BY_ID[row].name;
  const selected = supplyEntries()[row] ?? [];
  const entered = Object.values(supplyEntries()).flat();
  const filled = selected.filter(Boolean).length;
  return '<fieldset class="draw-field"><legend>' + label + ' draws <span>' + filled + ' / 4</span></legend>' +
    '<div class="draw-choices">' + ELEMENT_IDS.map(type =>
      button(elementName(type),'add-disk','disk-pick','data-row="' + row + '" data-element="' + type + '" style="--disk:' +
        ELEMENTS[type].color + '" aria-label="Add ' + elementName(type) + ' to ' + label + '"' +
        enable(filled < 4 && count(entered,type) < bagCount(game,type)))).join('') + '</div>' +
    '<div class="draw-order" aria-label="' + label + ' entered disks">' + Array.from({length:4},(_,i) => {
      const type = selected[i];
      if (!type) return '<span class="empty-disk" aria-hidden="true">–</span>';
      return button(ELEMENTS[type].mark,'remove-disk','disk-remove','data-row="' + row + '" data-index="' + i +
        '" style="--disk:' + ELEMENTS[type].color + '" aria-label="Remove ' + elementName(type) + ' from ' + label + ' slot ' + (i+1) + '"');
    }).join('') + '</div></fieldset>';
}
function drawPanel() {
  const planner = currentPlanner(game);
  if (reveal) {
    const card = DECKS[reveal.actor][reveal.card];
    const face = reveal.face ? card.yes : card.no;
    const left = game.decks[reveal.actor].queue.length || DECKS[reveal.actor].length;
    return '<div class="block-head"><h2 id="turn-focus" tabindex="-1">Place the pawn</h2><span class="phase-badge">Planning</span></div>' +
      '<p class="actorline">' + badge(reveal.actor,true) + nameOf(reveal.actor) + ' · ' + (left - 1) + ' left in deck</p>' +
      '<div class="current-card"><p class="eyebrow">' + (reveal.face ? 'Primary face' : 'Reverse face') + '</p><p class="display">' + card.title +
      '</p><p class="muted">' + CHECKS[card.check] + ' · ' + (reveal.face ? 'Yes' : 'No') + '</p>' + cardRows(face) + '</div>' +
      '<div class="result-box"><strong>' + slotLabel(reveal.slot) + '</strong><p>' + reveal.reason + '</p></div>' +
      button('Pawn placed · Continue','next','primary');
  }
  if (!planner) return '';
  const actor = planner.actor;
  const yours = actor === game.human;
  return '<div class="block-head"><h2 id="turn-focus" tabindex="-1">' + (yours ? 'Place your pawn' : 'Draw a bot card') + '</h2><span class="phase-badge">Planning</span></div>' +
    '<p class="actorline">' + badge(actor,true) + nameOf(actor) + ' · ' + game.animals[actor].remaining + ' pawns to place</p>' +
    '<p class="instruction">' + (yours ? 'Choose an open space, then place the matching pawn on your board.' :
      'Reveal the next card from this rival’s deck. The app will choose an open action space.') + '</p>' +
    (yours ? form(field('Your action space',select('slot',ALL_SLOTS.filter(key=>!game.pawns[key]).map(key=>[key,slotLabel(key)]))),'place','Place pawn') :
      button('Draw for ' + nameOf(actor),'draw','primary'));
}
function rowDescription(step) {
  const {row,index,kind,actor,tile} = step;
  if (kind === 'pawn') return ({
    initiative:'Move up one place if possible, then relocate this pawn to an open action space.',
    adaptation:'Choose an element from the Adaptation row.',
    regression:'This pawn protected one added element.',
    abundance:'Place an available element on an empty corner of Earth.',
    wasteland:'Remove a disk from the Wasteland box to protect its element type.',
    depletion:'Remove an eligible element disk from Earth.',
    glaciation:'Choose an eligible tile next to tundra.',
    speciation:'Choose a ' + (row === 'speciation' ? elementName(ELEMENT_IDS[index]).toLowerCase() : '') + ' corner and add cubes to its touching tiles.',
    wanderlust:'Choose a face-up tile, its location, and an optional element. Each animal then chooses whether to move into the new tile.',
    migration:'Move up to ' + (7-index) + ' cubes. ' + (actor === 'birds' ? 'Birds can travel up to two tiles.' : 'Each cube travels one tile.'),
    competition:'Remove one rival cube per eligible terrain type. Your animal must be present.',
    domination:'Score one tile. Its dominant animal chooses a card if one is available.',
  })[row];
  if (kind === 'arrival') return 'Move any number of adjacent cubes into ' + tileLabel(game,tile) + '.';
  if (kind === 'claim') return nameOf(actor) + ' claimed the cone on ' + tileLabel(game,tile) + '. Choose from the physical display.';
  if (kind === 'loss') return 'Choose ' + step.due.drops + ' added element' + (step.due.drops === 1 ? '' : 's') + ' to remove.';
  if (kind === 'effect') return 'Use the physical ' + step.name + ' card and apply its effect on the board.';
  if (kind === 'extinction') return 'Remove endangered cubes, then award Survival VP.';
  if (kind === 'weather') return 'Remove the affected elements from the corners of tundra tiles.';
  if (kind === 'immigrant') return 'Choose this animal’s penalty from the physical Immigrants card.';
  return '';
}
function showExecution() {
  const step = nextStep(game);
  const actor = step.actor;
  const you = actor === game.human;
  const humanForm = step.kind === 'symbiosis' || you && !['weather','regression'].includes(step.kind);
  const title = stepTitle(step);
  const label = actor ? nameOf(actor) + (you ? ' · You' : ' · Rival') : '';
  return '<div class="block-head"><h2 id="turn-focus" tabindex="-1">' + esc(title) + '</h2><span class="phase-badge">Execution</span></div>' +
    (label ? '<p class="actorline">' + badge(actor,true) + label + (step.key ? ' · ' + slotLabel(step.key) : '') +
      (step.card !== null && step.card !== undefined ? ' · ' + DECKS[actor][step.card].title : '') + '</p>' : '') +
    '<p class="instruction">' + esc(rowDescription(step)) + '</p>' +
    (preview ? '<div class="result-box"><strong>Apply on your board</strong><p>' + esc(preview.label) + '</p></div>' +
      button('Applied · Continue','apply','primary') + (humanForm ? ' ' + button('Change choice','cancel-preview','subtle') : '') :
      humanForm ? playerForm(step) : button(actor ? 'Show ' + nameOf(actor) + ' move' : 'Show changes','preview','primary'));
}
function showFinished() {
  const order = standings(game);
  return '<div class="block-head"><h2 id="turn-focus" tabindex="-1">' + nameOf(order[0]) + ' win</h2><span class="phase-badge">Final scoring</span></div>' +
    '<p class="instruction">Game ended on turn ' + game.turn + '. Remove the cones and set the physical VP markers to these totals.</p><ol>' +
    order.map(id=>'<li>' + nameOf(id) + (id === game.human ? ' (you)' : '') + ' · ' + game.animals[id].vp + ' VP</li>').join('') +
    '</ol>' + button('New game','new','primary') + ' ' + button('Export save','export','subtle');
}
function render(focus = false, noScroll = false) {
  document.getElementById('menu').hidden = !game;
  if (!game) { setupPage(); return; }
  const roundTitle = game.phase === 'finished' ? 'Game complete' : 'Turn ' + game.turn;
  const score = game.initiative.map(id => {
    const a = game.animals[id];
    return '<div class="score-box">' + badge(id) + '<div class="score-side"><strong>' + nameOf(id) + '</strong><small>' + (id === game.human ? 'You' : 'Rival') +
      ' · ' + a.pool + ' in pool</small></div><div class="score-vp"><b>' + a.vp + '</b>VP</div></div>';
  }).join('');
  const turn = game.phase === 'supply' ? showSupply() : reveal || game.phase === 'planning' ? drawPanel() : game.phase === 'execution' ? showExecution() : showFinished();
  main.innerHTML = '<div class="game-top"><div><p class="eyebrow">' + (game.short ? '22-card game' : '26-card game') +
    '</p><h1>' + roundTitle + '</h1></div><div class="toolrow">' + button('Undo','undo','sm subtle',enable(!!(undo.length || reveal || preview))) + '</div></div>' +
    '<div class="score-strip" aria-label="Scores in Initiative order">' + score + '</div><nav class="game-jump" aria-label="Jump to board section">' +
    '<a href="#turn-focus">Current step</a><a href="#action-display">Action display</a><a href="#earth-panel">Earth map</a></nav>' +
    '<div class="game-grid"><div class="column">' +
    '<section class="panel block" aria-label="Current turn"><div id="notice" class="notice" role="alert"' + (notice ? '' : ' hidden') + '>' +
    esc(notice) + '</div>' + turn + '</section>' + showActionDisplay() + showLog() + '</div><div class="column">' + showEarth() + showMarket() + '</div></div>';
  hydrateFields();
  if (focus) document.getElementById('turn-focus')?.focus({preventScroll:noScroll});
}
