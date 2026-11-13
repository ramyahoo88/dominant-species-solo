const copy = value => JSON.parse(JSON.stringify(value));
const sum = values => values.reduce((total, value) => total + value, 0);
const count = (values, item) => values.filter(value => value === item).length;
const unique = values => [...new Set(values)];
const signed = n => n > 0 ? '+' + n : String(n);
const tileLabel = (s, id) => id + ' ' + (s.tiles[id] ? terrainName(s.tiles[id].terrain) : 'empty');
const cornerLabel = (s, key) => CORNER_TILES[key].filter(id => s.tiles[id]).map(id => tileLabel(s, id)).join(' / ');
const cornerIndex = (id, key) => VERTICES_OF[id].indexOf(key) + 1;
const isBot = (s, id) => id !== s.human;
const occupied = (s, id) => Object.keys(s.tiles).filter(tile => s.tiles[tile].cubes[id]);
const activeCorners = s => Object.keys(CORNER_TILES).filter(key => CORNER_TILES[key].some(id => s.tiles[id]));
const terrainIds = s => GRID.filter(tile => s.tiles[tile.id]).map(tile => tile.id);
const availableCards = s => s.market.filter(Boolean);
const earned = (s, id, amount) => { s.animals[id].vp = Math.max(0, s.animals[id].vp + amount); };
const pawnCount = (s, actor, row) => Object.entries(s.pawns).filter(([key, p]) => p.actor === actor && (!row || splitSlot(key).row === row)).length;

function shuffle(s, values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    s.rng = (s.rng + 0x6D2B79F5) >>> 0;
    let n = Math.imul(s.rng ^ (s.rng >>> 15), s.rng | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    const j = Math.floor((((n ^ (n >>> 14)) >>> 0) / 4294967296) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function newGame(human, rivals, short, seed) {
  const ids = [human, ...rivals].sort((a,b) => rank(a) - rank(b));
  const s = {
    version: VERSION, human, rivals, ids, short, seed, rng: seed, turn: 1,
    phase: 'supply', cursor: 0, planning: 0, initiative: [...ids].reverse(), ending: false,
    tiles: {}, corners: {}, pawns: {}, pending: [], scored: [],
    market: Array(5).fill(null), usedCards: [], stacks: Array.from({length:3}, () => ({left:8, face:null})),
    boxes: Object.fromEntries(elementRows.map(row => [row, []])),
    animals: {}, decks: {}, log: [],
  };
  for (const id of ids) {
    s.animals[id] = { added:[], pool:PLAYABLE_SPECIES - sum(Object.values(INITIAL_CUBES[id])), dead:0, vp:0, ap:STARTING_PAWNS, remaining:0, ward:{} };
    if (isBot(s, id)) s.decks[id] = { queue:shuffle(s, DECKS[id].map((_, i) => i)), discards:[] };
  }
  for (const [id, terrain] of Object.entries(INITIAL_TILES)) {
    s.tiles[id] = { terrain, cubes:Object.fromEntries(ids.map(a => [a, INITIAL_CUBES[a][id] || 0])) };
  }
  for (const [tile, corner, type] of INITIAL_CORNERS) s.corners[vertexKey(tile, corner)] = type;
  return s;
}
function drawCard(s, actor) {
  const d = s.decks[actor];
  if (!d.queue.length) {
    d.queue = shuffle(s, d.discards);
    d.discards = [];
  }
  const index = d.queue.shift();
  d.discards.push(index);
  return index;
}
function note(s, title, body = '', actor = null, card = null) {
  s.log.push({turn:s.turn, title, body, actor, card});
  if (s.log.length > 650) s.log.shift();
}
function match(s, tile, actor, additions = s.animals[actor].added) {
  const requirements = ANIMALS[actor];
  let n = 0;
  for (const key of VERTICES_OF[tile]) {
    const element = s.corners[key];
    if (!element) continue;
    if (element === requirements.el) n += requirements.affinity;
    n += count(additions, element);
  }
  return n;
}
function cone(s, tile) {
  let best = 0;
  let owner = null;
  for (const actor of s.ids) {
    if (!s.tiles[tile].cubes[actor]) continue;
    const value = match(s, tile, actor);
    if (value > best) { best = value; owner = actor; }
    else if (value === best) owner = null;
  }
  return owner;
}
function tileScores(s, id) {
  const t = s.tiles[id];
  return s.ids.filter(a => t.cubes[a]).sort((a,b) => t.cubes[b] - t.cubes[a] || rank(a) - rank(b))
    .map((actor, i) => [actor, TERRAIN[t.terrain].vp[i] || 0]).filter(([,vp]) => vp);
}
function tileVP(s, tile, id) { return tileScores(s, tile).find(([actor]) => actor === id)?.[1] || 0; }
function describeScore(s, tile) {
  const points = tileScores(s,tile).map(([id,vp]) => nameOf(id) + ' +' + vp + ' VP');
  const owner = cone(s,tile);
  return 'Score ' + tileLabel(s,tile) + '. ' + (points.join(', ') || 'No VP') + '. ' +
    (owner && availableCards(s).length ? nameOf(owner) + ' choose a Dominance Card.' : 'No Dominance Card is taken.');
}
function tundraCounts(s, id) {
  const list = occupied(s, id).filter(tile => s.tiles[tile].terrain === 'tundra');
  return [sum(list.map(tile => s.tiles[tile].cubes[id])), list.length];
}
function survival(s) {
  const positions = s.ids.map(id => [id, ...tundraCounts(s, id)]).sort((a,b) => b[1] - a[1]);
  return positions[0][1] > positions[1][1] ? {actor:positions[0][0], vp:bonus(positions[0][2])} : null;
}
function legalNeighbors(s, id, actor, distance = actor === 'birds' ? 2 : 1) {
  const near = NEIGHBORS[id].filter(t => s.tiles[t]);
  return unique(distance === 1 ? near : [...near, ...near.flatMap(t => NEIGHBORS[t])]).filter(t => t !== id && s.tiles[t]);
}
function addCube(s, tile, actor, amount, source = 'pool') {
  if (amount < 0 || amount > s.animals[actor][source]) throw new Error('Check the available cubes.');
  s.animals[actor][source] -= amount;
  s.tiles[tile].cubes[actor] += amount;
}
function removeCube(s, tile, actor, amount, dest = 'dead') {
  if (amount < 0 || amount > s.tiles[tile].cubes[actor]) throw new Error('Check the cubes on ' + tileLabel(s, tile) + '.');
  s.tiles[tile].cubes[actor] -= amount;
  s.animals[actor][dest] += amount;
  const ward = s.animals[actor].ward;
  if (ward[tile] > s.tiles[tile].cubes[actor]) ward[tile] = s.tiles[tile].cubes[actor];
}
function moveGroups(s, actor, moves) {
  const byOrigin = {};
  for (const {from, n} of moves) byOrigin[from] = (byOrigin[from] || 0) + n;
  for (const [tile, n] of Object.entries(byOrigin)) if (n > s.tiles[tile].cubes[actor]) throw new Error('Too many cubes are leaving ' + tileLabel(s, tile) + '.');
  const ward = s.animals[actor].ward;
  // Unprotected cubes move first. Keep Hibernation protection with the chosen cubes.
  const movableWard = {};
  for (const {from} of moves) movableWard[from] = s.tiles[from].cubes[actor] - (ward[from] || 0);
  const changes = {};
  for (const {from,to,n} of moves) {
    const regular = Math.min(movableWard[from], n);
    movableWard[from] -= regular;
    const carried = n - regular;
    changes[from] = (changes[from] || 0) - carried;
    changes[to] = (changes[to] || 0) + carried;
    s.tiles[from].cubes[actor] -= n;
    s.tiles[to].cubes[actor] += n;
  }
  for (const [tile, n] of Object.entries(changes)) {
    if (n) ward[tile] = (ward[tile] || 0) + n;
  }
}
function regressionDue(s, actor) {
  const threats = unique(s.boxes.regression.filter(Boolean)).filter(type => s.animals[actor].added.includes(type));
  const protects = pawnCount(s, actor, 'regression') + Number(actor === 'reptiles');
  return {threats, drops:Math.max(0, threats.length - protects)};
}
function glazeTargets(s) {
  if (Object.values(s.tiles).filter(t => t.terrain === 'tundra').length >= 12) return [];
  return terrainIds(s).filter(id => s.tiles[id].terrain !== 'tundra' && NEIGHBORS[id].some(t => s.tiles[t]?.terrain === 'tundra'));
}
function glaciation(s, actor, id) {
  const t = s.tiles[id];
  const n = NEIGHBORS[id].filter(h => s.tiles[h]?.terrain === 'tundra').length;
  t.terrain = 'tundra';
  for (const a of s.ids) removeCube(s, id, a, Math.max(0,t.cubes[a] - 1), 'pool');
  const gone = VERTICES_OF[id].filter(key => s.corners[key] && CORNER_TILES[key].filter(h => s.tiles[h]?.terrain === 'tundra').length === 3);
  const removed = gone.map(key => elementName(s.corners[key]) + ' at corner ' + cornerIndex(id,key));
  for (const key of gone) delete s.corners[key];
  earned(s, actor, bonus(n));
  return 'Cover ' + id + ' with tundra. Return all but one cube per animal to their gene pools. ' +
    (removed.length ? 'Remove ' + removed.join(', ') + ' of ' + id + '. ' : '') + '+' + bonus(n) + ' VP.';
}
function discardElement(s, actor, type) {
  const values = s.animals[actor].added;
  const index = values.indexOf(type);
  if (index < 0) throw new Error('That added element is unavailable.');
  values.splice(index, 1);
}
function bagCount(s, type) {
  return 20 - count(Object.values(s.corners), type) - sum(elementRows.map(row => count(s.boxes[row], type))) -
    sum(s.ids.map(id => count(s.animals[id].added, type)));
}
function nextCardSlots(s) {
  const options = DOMINANCE.filter(card => !s.market.includes(card) && !s.usedCards.includes(card) && (!s.short || !SHORT_EXCLUDES.includes(card)));
  const vacancies = s.market.map((card,i) => card ? -1 : i).filter(i => i >= 0);
  return vacancies.slice(0, options.length);
}
function enterSupply(s, values) {
  const boxes = ['adaptation','abundance','wanderlust'];
  const draws = boxes.flatMap(row => values[row] || []);
  const total = sum(ELEMENT_IDS.map(type => bagCount(s,type)));
  if (boxes.some(row => !Array.isArray(values[row]) || values[row].length !== 4) ||
      draws.some(type => type !== null && !ELEMENT_IDS.includes(type)) || draws.filter(Boolean).length !== Math.min(total,12)) {
    throw new Error('Enter the disks drawn from the physical bag. Leave a space empty only when the bag runs out.');
  }
  for (const row of boxes) s.boxes[row] = values[row];
  for (const type of ELEMENT_IDS) if (bagCount(s, type) < 0) throw new Error('Too many ' + elementName(type).toLowerCase() + ' disks. Check your draw.');
  for (let i = 0; i < 3; i++) if (s.stacks[i].left && !s.stacks[i].face) s.stacks[i].face = values.stacks[i];
  const cardSlots = nextCardSlots(s);
  const fresh = cardSlots.map(i => values.market[i]);
  const illegal = fresh.some(card => !DOMINANCE.includes(card) || s.market.includes(card) || s.usedCards.includes(card) || s.short && SHORT_EXCLUDES.includes(card));
  if (illegal || unique(fresh).length !== fresh.length) throw new Error('Enter a different eligible Dominance Card for each open space.');
  if (fresh.includes('Ice Age') && s.usedCards.length + availableCards(s).length + fresh.length !== (s.short ? 22 : 26)) throw new Error('Ice Age stays at the bottom of the physical deck.');
  if (s.stacks.some(stack => stack.left && !LARGE_TERRAIN.includes(stack.face))) throw new Error('Enter all face-up Wanderlust tiles.');
  for (const [j,i] of cardSlots.entries()) s.market[i] = fresh[j];
  s.phase = 'planning';
  s.planning = 0;
  for (const id of s.ids) s.animals[id].remaining = s.animals[id].ap - pawnCount(s, id);
  note(s, 'Planning begins', 'Initiative order · ' + s.initiative.map(nameOf).join(' → '));
}
function currentPlanner(s) {
  for (let offset = 0; offset < s.initiative.length; offset++) {
    const index = (s.planning + offset) % s.initiative.length;
    const actor = s.initiative[index];
    if (s.animals[actor].remaining > 0) return {actor,index};
  }
  return null;
}
function place(s, key, bot = null) {
  const active = currentPlanner(s);
  if (s.phase !== 'planning' || !active || !ALL_SLOTS.includes(key) || s.pawns[key]) throw new Error('Choose an open space on the action display.');
  const {actor,index} = active;
  const pawn = {actor, focus:bot?.focus ?? null, card:bot?.card ?? null};
  s.pawns[key] = pawn;
  s.animals[actor].remaining--;
  s.planning = (index + 1) % s.initiative.length;
  note(s, nameOf(actor) + ' placed a pawn', slotLabel(key) + (bot ? '. ' + bot.reason : ''), actor, bot?.card ?? null);
  if (!currentPlanner(s)) {
    s.phase = 'execution';
    s.cursor = 0;
    note(s, 'Execution begins', 'Resolve the action display from top to bottom.');
  }
}
const EXECUTION = ROWS.flatMap(row => {
  if (row.id === 'regression') return ['!regression', ...row.slots];
  if (row.id === 'wasteland') return [...row.slots, '!wasteland'];
  if (row.id === 'glaciation') return row.slots.slice(0,1);
  if (row.id === 'speciation') return [...row.slots, '!insects'];
  if (row.id === 'competition') return ['!arachnids', ...row.slots];
  return row.slots;
});
function nextStep(s) {
  if (s.phase !== 'execution') return null;
  if (s.pending.length) return {...s.pending[0], queued:true};
  for (let i = s.cursor; i < EXECUTION.length; i++) {
    const key = EXECUTION[i];
    const pawn = s.pawns[key];
    if (pawn) return {...pawn, key, ...splitSlot(key), position:i, kind:'pawn'};
    if (key === '!regression' && s.ids.some(id => regressionDue(s,id).drops)) return {kind:'regression', position:i};
    if (key === '!wasteland' && wastelandDisks(s).length) return {kind:'weather', position:i};
    if (key === '!insects' && s.ids.includes('insects') && s.animals.insects.pool > 0) return {kind:'insect', actor:'insects', focus:'reach', position:i};
    if (key === '!arachnids' && s.ids.includes('arachnids') && competitionChoices(s,'arachnids',LARGE_TERRAIN.concat('tundra')).length) {
      return {kind:'spider', actor:'arachnids', focus:'pressure', position:i};
    }
  }
  return {kind:'extinction', actor:s.ids.includes('mammals') ? 'mammals' : null};
}
function consume(s, step) {
  if (step.queued) s.pending.shift();
  if (step.position !== undefined) s.cursor = step.position + 1;
  if (step.key) delete s.pawns[step.key];
}
function wastelandDisks(s) {
  return Object.keys(s.corners).filter(key => s.boxes.wasteland.includes(s.corners[key]) && CORNER_TILES[key].some(tile => s.tiles[tile]?.terrain === 'tundra'));
}
function competitionChoices(s, actor, types) {
  return terrainIds(s).filter(tile => types.includes(s.tiles[tile].terrain) && s.tiles[tile].cubes[actor])
    .flatMap(tile => s.ids.filter(a => a !== actor && s.tiles[tile].cubes[a]).map(victim => ({tile,victim})));
}
function extinctionOptions(s, actor) {
  return occupied(s,actor).filter(tile => !match(s,tile,actor) && s.tiles[tile].cubes[actor] > (s.animals[actor].ward[tile] || 0));
}
function resolveExtinction(s, saved) {
  const losses = [];
  for (const id of s.ids) {
    for (const tile of extinctionOptions(s, id)) {
      const loss = Math.max(0,s.tiles[tile].cubes[id] - (s.animals[id].ward[tile] || 0) - Number(id === 'mammals' && tile === saved));
      removeCube(s,tile,id,loss);
      if (loss) losses.push(nameOf(id) + ' −' + loss + ' at ' + tileLabel(s,tile));
    }
    s.animals[id].ward = {};
  }
  const hold = survival(s);
  if (hold) earned(s, hold.actor, hold.vp);
  const summary = (losses.length ? losses.join('; ') + '. ' : 'No cubes lost. ') +
    (saved ? 'Mammals save one cube at ' + tileLabel(s,saved) + '. ' : '') +
    (hold ? nameOf(hold.actor) + ' gain ' + hold.vp + ' Survival VP.' : 'Survival awards no VP.');
  note(s, 'Extinction and Survival', summary);
  if (s.ending) {
    for (const tile of terrainIds(s)) for (const [id,vp] of tileScores(s,tile)) earned(s,id,vp);
    s.phase = 'finished';
    const winner = standings(s)[0];
    note(s, 'Final scoring', nameOf(winner) + ' win with ' + s.animals[winner].vp + ' VP.', winner);
    return;
  }
  for (let i = 1; i < 4; i++) {
    const here = 'glaciation-' + i, there = 'glaciation-' + (i - 1);
    if (s.pawns[here] && !s.pawns[there]) {
      s.pawns[there] = s.pawns[here];
      delete s.pawns[here];
    }
  }
  s.boxes.regression = s.boxes.adaptation.filter(Boolean);
  s.boxes.depletion = s.boxes.wasteland.filter(Boolean);
  s.boxes.wasteland = s.boxes.abundance.filter(Boolean);
  s.boxes.adaptation = [];
  s.boxes.abundance = [];
  s.boxes.wanderlust = [];
  s.turn++;
  s.scored = [];
  s.phase = 'supply';
}
const standings = s => [...s.ids].sort((a,b) => s.animals[b].vp - s.animals[a].vp || rank(a) - rank(b));
function frontTiles(s) { return GRID.filter(h => !s.tiles[h.id] && NEIGHBORS[h.id].some(id => s.tiles[id])).map(h => h.id); }
function scoreTile(s, id) { for (const [a,vp] of tileScores(s,id)) earned(s,a,vp); }

function resolvePawn(s, step, choice) {
  const {actor,row,index} = step;
  consume(s, step);
  const label = nameOf(actor) + ' · ' + ROW_BY_ID[row].name;
  const pass = choice?.pass;
  if (pass) { note(s,label,'Forfeit this action.',actor,step.card); return; }
  switch (row) {
    case 'initiative': {
      const at = s.initiative.indexOf(actor);
      if (at > 0) [s.initiative[at-1],s.initiative[at]] = [s.initiative[at],s.initiative[at-1]];
      s.pawns[choice.slot] = {actor, card:step.card, focus:step.focus};
      break;
    }
    case 'adaptation':
      s.animals[actor].added.push(s.boxes.adaptation[choice.pick]);
      s.boxes.adaptation[choice.pick] = null;
      break;
    case 'regression':
      break;
    case 'abundance':
      s.corners[choice.corner] = s.boxes.abundance[choice.pick];
      s.boxes.abundance[choice.pick] = null;
      break;
    case 'wasteland':
      s.boxes.wasteland[choice.pick] = null;
      break;
    case 'depletion':
      delete s.corners[choice.corner];
      break;
    case 'glaciation':
      choice.label = glaciation(s,actor,choice.tile);
      break;
    case 'speciation':
      for (const [tile,n] of Object.entries(choice.add)) addCube(s,tile,actor,n);
      break;
    case 'wanderlust': {
      const stack = s.stacks[choice.stack];
      const vp = bonus(NEIGHBORS[choice.tile].filter(id => s.tiles[id]).length);
      s.tiles[choice.tile] = {terrain:stack.face, cubes:Object.fromEntries(s.ids.map(id => [id,0]))};
      stack.face = null;
      stack.left--;
      if (choice.pick !== null && choice.pick !== undefined) {
        s.corners[choice.corner] = s.boxes.wanderlust[choice.pick];
        s.boxes.wanderlust[choice.pick] = null;
      }
      earned(s,actor,vp);
      s.pending.push(...s.ids.filter(id => NEIGHBORS[choice.tile].some(t => s.tiles[t]?.cubes[id]))
        .map(id => ({kind:'arrival', actor:id, tile:choice.tile, focus:id === actor ? step.focus : 'reach'})));
      break;
    }
    case 'migration':
      moveGroups(s,actor,choice.moves);
      break;
    case 'competition':
      for (const {tile,victim} of choice.hits) removeCube(s,tile,victim,1);
      break;
    case 'domination': {
      const cardOwner = cone(s,choice.tile);
      choice.label = describeScore(s,choice.tile);
      scoreTile(s,choice.tile);
      s.scored.push(choice.tile);
      if (cardOwner && availableCards(s).length) s.pending.push({kind:'claim', actor:cardOwner, tile:choice.tile, focus:step.actor === cardOwner ? step.focus : 'dominance'});
      break;
    }
    default: throw new Error('Unknown action row.');
  }
  note(s,label,choice.label,actor,step.card);
}
function runStep(s, step, choice) {
  if (step.kind === 'pawn') { resolvePawn(s,step,choice); return; }
  consume(s, step);
  const {actor,tile} = step;
  switch (step.kind) {
    case 'regression':
      for (const id of s.ids) {
        const {drops} = regressionDue(s,id);
        if (drops) s.pending.push({kind:'loss', actor:id, source:'Regression', due:regressionDue(s,id)});
      }
      break;
    case 'loss':
      for (const type of choice.elements) discardElement(s,actor,type);
      note(s,nameOf(actor) + ' · ' + step.source, choice.label, actor);
      break;
    case 'weather': {
      const disks = wastelandDisks(s);
      const names = disks.map(key => elementName(s.corners[key]) + ' at ' + cornerLabel(s,key));
      for (const key of disks) delete s.corners[key];
      note(s,'Wasteland loss','Remove ' + names.join('; ') + '.');
      break;
    }
    case 'insect':
      if (!choice.pass) addCube(s,choice.tile,actor,1);
      note(s,'Insects · Free Speciation',choice.label,actor);
      break;
    case 'spider':
      if (!choice.pass) for (const {tile:target,victim} of choice.hits) removeCube(s,target,victim,1);
      note(s,'Arachnids · Free Competition',choice.label,actor);
      break;
    case 'arrival':
      if (!choice.pass) moveGroups(s,actor,choice.moves);
      note(s,nameOf(actor) + ' · Wanderlust arrival',choice.label,actor);
      break;
    case 'claim':
      s.market[s.market.indexOf(choice.card)] = null;
      s.usedCards.push(choice.card);
      note(s,nameOf(actor) + ' took ' + choice.card, 'Dominant on ' + tileLabel(s,tile) + '. Use the physical card.', actor);
      s.pending.unshift({kind:'effect', actor, tile, name:choice.card, focus:step.focus});
      break;
    case 'effect':
      resolveEffect(s,step,choice);
      break;
    case 'symbiosis':
      for (const [id,type] of Object.entries(choice.draws)) if (type) s.animals[id].added.push(type);
      note(s,'Symbiotic · Element draws',choice.label,actor);
      break;
    case 'immigrant':
      immigrantChoice(s,actor,choice);
      note(s,nameOf(actor) + ' · Immigrants',choice.label,actor);
      break;
    case 'extinction':
      resolveExtinction(s,choice.saved);
      break;
    default: throw new Error('Unknown game step.');
  }
}
