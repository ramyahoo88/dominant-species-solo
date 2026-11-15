// Paper rival: decisions a person can make at the table by counting.
// Loaded after the app sources. PAPER.<kind> = true switches that decision to the paper rule.
var PAPER = typeof PAPER === 'object' ? PAPER : {};
// The paper rules (Nov 2026): flat matching, the card list, always the "no" face, simple Adaptation, full Speciation,
// Migration without rank checks, Glaciation without the tundra bonus, and blocking the leader's Domination.
// PAPER.full = true restores the earlier, detailed rules (kept only to reproduce old test results).
const PAPER_DEFAULTS = ['flatMatch','cardList','faceNo','simpleAdapt','simpleSpec','simpleMig','simpleGlac','domBlock'];
if (!PAPER.full) for (const k of PAPER_DEFAULTS) PAPER[k] = true;
var PAPER_FALLBACKS = PAPER_FALLBACKS || {};
// Paper rivals run when the benchmark asks for them (PAPER.place) or when a game was started with paper rules (s.paper).
function paperOn(s) { return !!(PAPER.place || s?.paper); }
function paperNote(kind) { PAPER_FALLBACKS[kind] = (PAPER_FALLBACKS[kind] || 0) + 1; }
function paperLegal(s, actor, row, index) {
  switch (row) {
    case 'initiative': return s.initiative[0] !== actor;
    case 'adaptation': return s.animals[actor].added.length + ANIMALS[actor].affinity < 6 && s.boxes.adaptation.some(Boolean);
    case 'regression': return s.animals[actor].added.some(type => s.boxes.adaptation.includes(type) || s.boxes.regression.includes(type)) || actor === 'reptiles';
    case 'abundance': return s.boxes.abundance.some(type => type && (paperBarren(s) || paperUses(s,actor,type))) && occupied(s,actor).some(t => VERTICES_OF[t].some(key => !s.corners[key]));
    case 'wasteland': return s.boxes.wasteland.some(type => type && paperUses(s,actor,type)); // as Execution: protect an element it uses
    case 'depletion': return pDepletionCorners(s,actor,index).length > 0; // same disks Execution may remove
    case 'glaciation': return glazeTargets(s).some(t => !s.tiles[t].cubes[actor] && s.ids.some(id => s.tiles[t].cubes[id]));
    case 'speciation': return s.animals[actor].pool > 0 && paperSpeciationTiles(s,actor,index).length > 0;
    case 'wanderlust': return s.stacks.some(stack => stack.face) && frontTiles(s).some(t => NEIGHBORS[t].some(id => s.tiles[id]?.cubes[actor]));
    case 'migration': return occupied(s,actor).some(tile => legalNeighbors(s,tile,actor).some(to => match(s,to,actor) > 0));
    case 'competition': return competitionChoices(s,actor,['tundra',COMPETITION_EDGES[index],COMPETITION_EDGES[index+1]]).length > 0;
    case 'domination': return terrainIds(s).some(tile => !s.scored.includes(tile) && s.tiles[tile].cubes[actor]);
  }
  return false;
}
function paperCheck(s, actor, test) { // the app's card conditions, with 'elements' made countable
  if (test !== 'elements') return checkCard(s,actor,test);
  const mine = occupied(s,actor);
  return indexed(s.boxes.adaptation).some(({type}) => !paperUses(s,actor,type) && mine.some(t => VERTICES_OF[t].some(k => s.corners[k] === type))) ||
    indexed(s.boxes.abundance).some(({type}) => type === ANIMALS[actor].el);
}
// Barren Earth: no animal dominates any tile, so no one can take a card. Rivals restore elements first.
function paperBarren(s) { return s.turn > 1 && !terrainIds(s).some(t => cone(s,t)); }
// Depletion: disks on Earth of a box element the rival does not use (Planning and Execution share this).
function pDepletionCorners(s, actor, index) { return placementTargets(s,'depletion',index,actor).filter(k => !paperUses(s,actor,s.corners[k])); }
function paperUses(s, actor, type) { return ANIMALS[actor].el === type || s.animals[actor].added.includes(type); }
function paperDominated(s, actor) { return terrainIds(s).filter(t => !s.scored.includes(t) && cone(s,t) === actor); }
function paperSpeciationTiles(s, actor, index) {
  const type = ELEMENT_IDS[index];
  return unique(Object.keys(s.corners).filter(key => s.corners[key] === type).flatMap(key => CORNER_TILES[key].filter(t => s.tiles[t])));
}
function paperSlotScore(s, actor, row, index) {
  if (row === 'speciation') return paperSpeciationTiles(s,actor,index).filter(t => match(s,t,actor) > 0).length;
  if (row === 'competition') return unique(competitionChoices(s,actor,['tundra',COMPETITION_EDGES[index],COMPETITION_EDGES[index+1]]).map(c => c.tile)).length;
  return -index; // leftmost open space
}
const PAPER_FALLBACK = ['domination','wanderlust','speciation','adaptation','competition','migration','abundance','initiative','regression','depletion','wasteland','glaciation'];
const PAPER_WEAK = ['abundance','glaciation','wasteland','depletion','regression','initiative'];
function paperPlacement(s, actor, cardIndex, openOverride = null) {
  const card = cardIndex === null ? null : DECKS[actor][cardIndex];
  const positive = card ? (PAPER.faceYes ? true : PAPER.faceNo ? false : paperCheck(s,actor,card.check)) : false;
  const face = card ? (positive ? card.yes : card.no) : null;
  const focus = face?.focus || 'majority';
  const open = openOverride || ALL_SLOTS.filter(key => !s.pawns[key]);
  const pick = (rows, allowRepeat, weakFirstOnly) => {
    for (const [i,row] of rows.entries()) {
      if (!allowRepeat && pawnCount(s,actor,row)) continue;
      if (weakFirstOnly && i > 0 && PAPER_WEAK.includes(row)) continue;
      const slots = open.map(splitSlot).filter(x => x.row === row && paperLegal(s,actor,row,x.index));
      if (!slots.length) continue;
      const best = slots.sort((a,b) => (PAPER.leftSlot ? 0 : paperSlotScore(s,actor,row,b.index) - paperSlotScore(s,actor,row,a.index)) || a.index - b.index)[0];
      return best.row + '-' + best.index;
    }
    return null;
  };
  const doms = pawnCount(s,actor,'domination'), dominated = paperDominated(s,actor).length;
  const domFirst = !PAPER.noDomFirst && availableCards(s).length && dominated > doms && doms < 2 ? pick(['domination'], true) : null;
  const barren = paperBarren(s) ? pick(['abundance']) : null;
  // Option: deny the leader's Domination. If the leader (highest-VP opponent) dominates enough unscored tiles while a card is available,
  // take a Domination space (at most 2) so the leader can't use it.
  const leader = pLeader(s,actor);
  const leaderDom = terrainIds(s).filter(t => !s.scored.includes(t) && cone(s,t) === leader).length;
  const blockMin = PAPER.domBlock2 ? 2 : 1;
  // Candidate (testing, off by default): blockHuman aims Block the leader at the player instead of the VP leader.
  const you = s.human && s.human !== actor && !s.paperRivals?.includes(s.human) ? s.human : null;
  const blockTarget = PAPER.blockHuman && you ? you : leader;
  const targetDom = blockTarget === leader ? leaderDom : terrainIds(s).filter(t => !s.scored.includes(t) && cone(s,t) === blockTarget).length;
  const block = (PAPER.domBlock || PAPER.domBlock2) && !domFirst && availableCards(s).length && doms < 2 && targetDom >= blockMin ? pick(['domination'], true) : null;
  // Candidates (testing, off by default) for turn order. initClimb: a rival that is not first in Initiative takes the open
  // Initiative space. holdYou: a rival ahead of you on the Initiative track takes it, so you can't climb past it.
  const initOpen = open.includes('initiative-0') && !pawnCount(s,actor,'initiative');
  const climb = PAPER.initClimb && initOpen && s.initiative[0] !== actor ? 'initiative-0' : null;
  const youAt = you ? s.initiative.indexOf(you) : -1, meAt = s.initiative.indexOf(actor);
  // Variants: holdYouDirect (only the rival directly ahead of you), holdYouVP (only when you have at least this rival's VP),
  // climbPast (the rival directly behind you takes it, to pass you).
  const holdWho = PAPER.holdYouDirect ? youAt === meAt + 1 : youAt > meAt;
  const hold = (PAPER.holdYou || PAPER.holdYouDirect || PAPER.holdYouVP) && initOpen && you && holdWho &&
    (!PAPER.holdYouVP || s.animals[you].vp >= s.animals[actor].vp) ? 'initiative-0' : null;
  const past = PAPER.climbPast && initOpen && you && meAt === youAt + 1 ? 'initiative-0' : null;
  // Candidate (testing, off by default): leadDom races you for Domination space 1 (it resolves first) when you dominate an
  // unscored tile and a card is available.
  const youDominate = you && terrainIds(s).some(t => !s.scored.includes(t) && cone(s,t) === you);
  const leadDom = PAPER.leadDom && open.includes('domination-0') && availableCards(s).length && youDominate ? 'domination-0' : null;
  // The same order as before; also record which Planning step chose the space, for the player.
  const steps = [['Lead Domination', () => leadDom], ['Hold Initiative', () => hold], ['Pass you on Initiative', () => past], ['Climb Initiative', () => PAPER.initClimbLate ? null : climb],
    ['Domination first', () => domFirst], ['Barren Earth', () => barren], ['Block the leader', () => block], ['Climb Initiative', () => PAPER.initClimbLate ? climb : null],
    ['Card action', () => pick(face ? face.rows : [], false, !PAPER.noWeak)], ['Fallback', () => pick(PAPER_FALLBACK, false)],
    ['Last resort', () => pick(PAPER_FALLBACK, true) || open[0]]];
  let slot = null, why = '';
  for (const [name, get] of steps) { slot = get(); if (slot) { why = name; break; } }
  const {row} = splitSlot(slot);
  if (why === 'Card action') why += ' ' + (face.rows.indexOf(row) + 1);
  return {slot,row,priority:face ? face.rows.indexOf(row) : -1,focus,card:cardIndex,face:positive,opportunity:1,reason:'Paper rule, ' + why + ': ' + ROW_BY_ID[row].name + '.'};
}
const _appBotPlacement = botPlacement;
botPlacement = function(s) {
  if (!paperOn(s)) return _appBotPlacement(s);
  const actor = currentPlanner(s).actor;
  const card = drawCard(s,actor);
  const choice = paperPlacement(s,actor,card);
  place(s,choice.slot,choice);
  return choice;
};

// ---------- Countable helpers ----------
function pTiles(s) { return terrainIds(s); }
function pFirstVP(s, tile) { return TERRAIN[s.tiles[tile].terrain].vp[0]; }
function pOrder(s, tile) { const c = s.tiles[tile].cubes; return s.ids.filter(a => c[a] > 0).sort((a,b) => c[b] - c[a] || rank(a) - rank(b)); }
function pRank(s, tile, id) { return pOrder(s,tile).indexOf(id); } // every animal present ranks, even below the VP cutoff; -1 if absent
function pLeader(s, actor) { // opponent highest on the VP track; ties to food chain
  return s.ids.filter(id => id !== actor).sort((a,b) => s.animals[b].vp - s.animals[a].vp || rank(a) - rank(b))[0];
}
function pOrderOpps(s, actor) { return s.ids.filter(id => id !== actor).sort((a,b) => s.animals[b].vp - s.animals[a].vp || rank(a) - rank(b)); }
function pBy(list, ...keys) { // sort descending by keys, then the tie-break order; return first
  return [...list].sort((a,b) => { for (const k of keys) { const d = k(b) - k(a); if (d) return d; }
    const A = String(a.tile ?? a), B = String(b.tile ?? b);
    return A.localeCompare(B); })[0];
}
function pTypes(s, actor) { return unique([ANIMALS[actor].el, ...s.animals[actor].added]); }
function pCornersNear(s, actor, type) { // corners of this type on tiles the animal occupies
  return occupied(s,actor).reduce((n,t) => n + VERTICES_OF[t].filter(k => s.corners[k] === type).length, 0);
}
function pGainsRank(s, tile, actor, n = 1) {
  const before = pRank(s,tile,actor);
  s.tiles[tile].cubes[actor] += n; const after = pRank(s,tile,actor); s.tiles[tile].cubes[actor] -= n;
  return before < 0 ? after >= 0 : after < before;
}
function pVacantMyCorners(s, actor) { // vacant corners touching my tiles, with count of my tiles touched
  return unique(occupied(s,actor).flatMap(t => VERTICES_OF[t].filter(k => !s.corners[k])))
    .map(k => ({corner:k, mine:CORNER_TILES[k].filter(t => s.tiles[t]?.cubes[actor]).length, vp:Math.max(...CORNER_TILES[k].filter(t => s.tiles[t]).map(t => pFirstVP(s,t)))}));
}
function pLabel(text) { return 'Paper rule: ' + text; }
// Full table instructions: every location, element, quantity and pawn the decision changes.
function pAt(s, key) { const t = CORNER_TILES[key].find(id => s.tiles[id]); return 'the corner shared by ' + cornerLabel(s,key) + ' (corner ' + cornerIndex(t,key) + ' on ' + t + ')'; }

// ---------- Actions ----------
function paperPawn(s, step) {
  const {row,index,actor} = step;
  const leader = pLeader(s,actor);
  switch (row) {
    case 'initiative': {
      const open = ALL_SLOTS.filter(k => !s.pawns[k] && k !== 'initiative-0' && EXECUTION.indexOf(k) > s.cursor);
      if (!open.length) return {slot:null,label:pLabel('advance one place on the Initiative track. No open space later this turn: the pawn returns to the rival.')};
      const plan = paperPlacement(s,actor,null,open);
      return {slot:plan.slot,label:pLabel('advance and move this pawn to ' + slotLabel(plan.slot) + '.')};
    }
    case 'adaptation': {
      if (s.animals[actor].added.length + ANIMALS[actor].affinity >= 6) return {...PASS};
      const picks = indexed(s.boxes.adaptation);
      if (!picks.length) return {...PASS};
      const best = pBy(picks.map(p => ({...p, tile:p.pick})), p => PAPER.simpleAdapt ? 0 : pCornersNear(s,actor,p.type), p => p.type === ANIMALS[actor].el ? 1 : 0, p => -p.pick);
      return {pick:best.pick,label:pLabel('take ' + elementName(best.type) + ' from Adaptation position ' + (best.pick + 1) + ' and add it to its display.')};
    }
    case 'regression': return {label:pLabel('protect an element.')};
    case 'abundance': {
      const picks = indexed(s.boxes.abundance);
      const corners = pVacantMyCorners(s,actor);
      if (!picks.length || !corners.length) return {...PASS};
      const mine = picks.filter(p => pTypes(s,actor).includes(p.type));
      const p = (mine.length ? mine : picks)[0];
      const c = pBy(corners.map(c => ({...c, tile:c.corner})), c => c.mine, c => c.vp);
      return {pick:p.pick,corner:c.corner,label:pLabel('take ' + elementName(p.type) + ' from Abundance position ' + (p.pick + 1) + ' and place it at ' + pAt(s,c.corner) + '.')};
    }
    case 'wasteland': {
      const picks = indexed(s.boxes.wasteland);
      if (!picks.length) return {...PASS};
      const mine = picks.filter(p => pTypes(s,actor).includes(p.type));
      if (!mine.length) return {...PASS};
      return {pick:mine[0].pick,label:pLabel('remove ' + elementName(mine[0].type) + ' from Wasteland position ' + (mine[0].pick + 1) + '.')};
    }
    case 'depletion': {
      const corners = pDepletionCorners(s,actor,index);
      if (!corners.length) return {...PASS};
      const c = pBy(corners.map(k => ({corner:k,tile:k})),
        c => CORNER_TILES[c.corner].filter(t => s.tiles[t] && cone(s,t) === leader).length,
        c => CORNER_TILES[c.corner].filter(t => s.tiles[t] && cone(s,t) && cone(s,t) !== actor).length);
      return {corner:c.corner,label:pLabel('remove ' + elementName(s.corners[c.corner]) + ' from ' + pAt(s,c.corner) + '.')};
    }
    case 'glaciation': {
      const t = paperGlaciationTile(s,actor);
      return t ? {tile:t,label:pLabel('cover ' + tileLabel(s,t) + ' with tundra.')} : {...PASS};
    }
    case 'speciation': return paperSpeciation(s,actor,index);
    case 'wanderlust': return paperWanderlust(s,actor);
    case 'migration': return paperMigration(s,actor,7 - index);
    case 'competition': return paperCompetition(s,actor,['tundra',COMPETITION_EDGES[index],COMPETITION_EDGES[index+1]],false);
    case 'domination': {
      const tiles = pTiles(s).filter(t => !s.scored.includes(t) && sum(Object.values(s.tiles[t].cubes)) > 0);
      if (!tiles.length) return {...PASS};
      const myVP = t => tileVP(s,t,actor);
      const mine = tiles.filter(t => cone(s,t) === actor);
      const safe = tiles.filter(t => !cone(s,t) || cone(s,t) === actor);
      const pool = mine.length && availableCards(s).length ? mine : safe.filter(t => myVP(t) > 0).length ? safe : tiles;
      // Candidate (testing, off by default): domNet. Rank tiles by the rival's VP minus your VP on that tile.
      const you = s.human && !s.paperRivals?.includes(s.human) ? s.human : null;
      const t = PAPER.domNet && you ? pBy(pool, t => myVP(t) - tileVP(s,t,you), myVP, t => pFirstVP(s,t)) : pBy(pool, myVP, t => pFirstVP(s,t));
      return {tile:t,label:describeScore(s,t)};
    }
  }
  paperNote('pawn:' + row); return choosePawnTarget(s,step);
}
function paperGlaciationTile(s, actor) {
  const targets = glazeTargets(s);
  if (!targets.length) return null;
  const opp = t => sum(s.ids.filter(id => id !== actor).map(id => s.tiles[t].cubes[id]));
  const clean = targets.filter(t => !s.tiles[t].cubes[actor]);
  const tundraNear = t => NEIGHBORS[t].filter(id => s.tiles[id]?.terrain === 'tundra').length;
  return pBy(clean.length ? clean : targets, t => opp(t) + (PAPER.simpleGlac ? 0 : bonus(tundraNear(t))), t => -s.tiles[t].cubes[actor], t => pFirstVP(s,t));
}
function paperSpeciation(s, actor, index) {
  let pool = s.animals[actor].pool;
  if (!pool) return {...PASS};
  const type = ELEMENT_IDS[index];
  const corners = Object.keys(s.corners).filter(k => s.corners[k] === type);
  const fit = k => CORNER_TILES[k].filter(t => s.tiles[t] && match(s,t,actor) > 0);
  const k = pBy(corners.map(k => ({corner:k,tile:k})), c => fit(c.corner).length, c => sum(fit(c.corner).map(t => pFirstVP(s,t))));
  if (!k || !fit(k.corner).length) return {...PASS};
  const add = {};
  for (const t of [...fit(k.corner)].sort((a,b) => pFirstVP(s,b) - pFirstVP(s,a) || a.localeCompare(b))) {
    const leading = pRank(s,t,actor) === 0 && s.ids.some(id => id !== actor && s.tiles[t].cubes[id]) ? false : pRank(s,t,actor) === 0;
    const n = Math.min(leading && !PAPER.simpleSpec ? 1 : TERRAIN[s.tiles[t].terrain].cap, pool);
    if (n > 0) { add[t] = n; pool -= n; }
  }
  return {corner:k.corner,add,label:pLabel('use the ' + elementName(type) + ' disk at ' + pAt(s,k.corner) + '. ' + addLabel(s,add))};
}
function paperWanderlust(s, actor) {
  const front = frontTiles(s).filter(t => NEIGHBORS[t].some(id => s.tiles[id]?.cubes[actor]));
  const stacks = s.stacks.map((st,i) => ({i,face:st.face})).filter(x => x.face);
  if (!front.length || !stacks.length) return {...PASS};
  const tile = pBy(front, t => NEIGHBORS[t].filter(id => s.tiles[id]).length, t => NEIGHBORS[t].filter(id => s.tiles[id]?.cubes[actor]).length);
  const st = [...stacks].sort((a,b) => TERRAIN[b.face].vp[0] - TERRAIN[a.face].vp[0] || a.i - b.i)[0];
  const draws = indexed(s.boxes.wanderlust);
  const mine = draws.filter(d => pTypes(s,actor).includes(d.type));
  const d = PAPER.simpleWander ? null : mine[0] || null;
  const corners = d ? VERTICES_OF[tile].filter(k => !s.corners[k]) : [];
  const corner = corners.length ? pBy(corners.map(k => ({tile:k,k})), c => CORNER_TILES[c.k].filter(t => s.tiles[t]?.cubes[actor]).length).k : null;
  const vp = bonus(NEIGHBORS[tile].filter(id => s.tiles[id]).length);
  return {stack:st.i,tile,pick:d && corner ? d.pick : null,corner:d && corner ? corner : null,label:pLabel('place the face-up ' + terrainName(st.face) + ' from stack ' + (st.i + 1) + ' at ' + tile +
    (d && corner ? ', and add ' + elementName(d.type) + ' from Wanderlust position ' + (d.pick + 1) + ' at corner ' + cornerIndex(tile,corner) + ' of ' + tile : '') + '. +' + vp + ' VP.')};
}
function pLosesRank(s, tile, actor) {
  const before = pRank(s,tile,actor);
  s.tiles[tile].cubes[actor]--; const after = pRank(s,tile,actor); s.tiles[tile].cubes[actor]++;
  return after < 0 || after > before;
}
function paperMigration(s, actor, limit, destination = null) {
  // One species at a time. Priorities: rescue from an unmatched tile; move to gain a rank (higher first-place VP first);
  // spread onto a matched tile you are not on. Never take a species from a tile if that costs you a rank there.
  const moves = []; let left = limit;
  const apply = (from,to) => { s.tiles[from].cubes[actor]--; s.tiles[to].cubes[actor]++; const m = moves.find(x => x.from === from && x.to === to); if (m) m.n++; else moves.push({from,to,n:1}); };
  while (left > 0) {
    const options = [];
    const received = new Set(moves.map(m => m.to)), sent = new Set(moves.map(m => m.from));
    for (const from of occupied(s,actor)) {
      if (received.has(from)) continue;
      const rescue = match(s,from,actor) === 0;
      if (!rescue && (s.tiles[from].cubes[actor] < 2 || pLosesRank(s,from,actor))) continue;
      const tos = destination ? (legalNeighbors(s,from,actor,1).includes(destination) ? [destination] : []) : legalNeighbors(s,from,actor);
      for (const to of tos) {
        if (!match(s,to,actor) || sent.has(to)) continue;
        const gain = !PAPER.simpleMig && pGainsRank(s,to,actor) ? 1 : 0;
        const fresh = s.tiles[to].cubes[actor] ? 0 : 1;
        if (!rescue && !gain && !fresh) continue;
        options.push({from,to,tile:to,rescue:rescue ? 1 : 0,gain,fresh,vp:pFirstVP(s,to),spare:s.tiles[from].cubes[actor]});
      }
    }
    if (!options.length) break;
    const o = pBy(options, o => o.rescue, o => o.gain, o => o.vp, o => o.fresh, o => o.spare);
    apply(o.from,o.to); left--;
  }
  for (const {from,to,n} of moves) { s.tiles[from].cubes[actor] += n; s.tiles[to].cubes[actor] -= n; }
  return {moves,label:pLabel(moves.length ? moveLabel(s,moves) : 'no move.')};
}
function paperHitScore(s, tile, victim, actor) {
  const vp = pFirstVP(s,tile);
  const theirs = s.tiles[tile].cubes[victim];
  let score = vp;
  if (PAPER.simpleHit) return score;
  if (pRank(s,tile,victim) < pRank(s,tile,actor)) {                                       // it ranks above you...
    s.tiles[tile].cubes[victim]--;
    const lost = pRank(s,tile,victim) < 0 || pRank(s,tile,victim) > pRank(s,tile,actor); // ...and loses that edge (food chain breaks ties)
    s.tiles[tile].cubes[victim]++;
    if (lost) score += vp;
  }
  if (theirs === 1) score += vp / 2;                                                       // they leave the tile
  if (cone(s,tile) === victim && theirs === 1) score += 6;                                // they lose dominance
  return score;
}
function paperCompetition(s, actor, types, one) {
  const legal = competitionChoices(s,actor,types);
  const order = pOrderOpps(s,actor);
  const pickOne = list => list.length ? [...list].sort((a,b) => paperHitScore(s,b.tile,b.victim,actor) - paperHitScore(s,a.tile,a.victim,actor) || order.indexOf(a.victim) - order.indexOf(b.victim) || a.tile.localeCompare(b.tile))[0] : null;
  const hits = one ? [pickOne(legal)].filter(Boolean) : types.map(type => pickOne(legal.filter(h => s.tiles[h.tile].terrain === type))).filter(Boolean);
  return {hits,label:pLabel(hits.length ? hitLabel(s,hits) : 'no target.')};
}

// ---------- Card pick ----------
const PAPER_CARD_ORDER = ['Omnivore','Intelligence','Parasitism','Evolution','Catastrophe','Ice Sheet','Aquatic','Mass Exodus','Habitat','Instinct','Blight',
  'Metamorphosis','Symbiotic','Nocturnal','Immigrants','Biomass','Disease','Fecundity','Predator','Hibernation','Cold Snap','Biodiversity','Ecodiversity','Fertile','Niche Biomes','Ice Age'];
function paperCardPoints(s, actor, card, tile) {
  const me = s.animals[actor];
  switch (card) {
    case 'Biodiversity': case 'Ecodiversity': case 'Fertile': return scoreCardPoints(s,actor,card,tile);
    case 'Niche Biomes': return pFirstVP(s,tile) * s.ids.filter(id => s.animals[id].vp > me.vp).length / 2;
    case 'Omnivore': return me.ap < 10 ? 6 : 0;
    case 'Intelligence': return me.ap < 10 ? 6 - 2 * s.ids.filter(id => rank(id) < rank(actor)).length : 0;
    case 'Parasitism': return me.ap < 10 ? 6 - 2 * s.ids.filter(id => rank(id) > rank(actor)).length : 0;
    case 'Evolution': return Math.min(2,me.pool) * 2;
    case 'Fecundity': return Math.min(occupied(s,actor).length, me.pool);
    case 'Predator': return occupied(s,actor).filter(t => s.ids.some(id => id !== actor && s.tiles[t].cubes[id])).length;
    case 'Hibernation': return Math.min(5,me.dead) * .8;
    case 'Cold Snap': return sum(pTiles(s).filter(t => s.tiles[t].terrain === 'tundra').map(t => s.ids.filter(id => id !== actor && s.tiles[t].cubes[id]).length));
    case 'Ice Age': { const top = Math.max(...s.ids.map(id => s.animals[id].vp)); return me.vp >= top ? 20 : -5; }
    case 'Metamorphosis': return me.added.length ? 2 : 0;
    case 'Aquatic': return me.pool ? 3 : 1;
    case 'Ice Sheet': return paperGlaciationTile(s,actor) ? 3 : 0;
    case 'Nocturnal': return s.initiative[0] === actor ? 0 : 1.5;
    default: return 2.5;
  }
}
function paperClaim(s, actor, tile) {
  const cards = availableCards(s);
  if (PAPER.cardList) { // a printed priority list, no scoring; Ice Age only when leading or tied on VP
    const top = Math.max(...s.ids.map(id => s.animals[id].vp));
    const pawnCards = ['Omnivore','Intelligence','Parasitism'];
    const ok = cards.filter(c => (c !== 'Ice Age' || s.animals[actor].vp >= top) && !(pawnCards.includes(c) && s.animals[actor].ap >= 10));
    // Candidate (testing, off by default): cardVP. Before the list, a VP card worth 5+ VP to the rival is taken (the most VP;
    // ties in list order). Counting: Biodiversity tiles shared, Ecodiversity matching disks, Fertile cubes on its fullest tile,
    // Niche Biomes first-place VP x animals ahead on VP.
    const vpCards = PAPER.cardVP ? ok.filter(c => ['Biodiversity','Ecodiversity','Fertile','Niche Biomes'].includes(c))
      .map(c => [c, scoreCardPoints(s,actor,c,tile)]).filter(([,v]) => v >= 5).sort((a,b) => b[1] - a[1] || PAPER_CARD_ORDER.indexOf(a[0]) - PAPER_CARD_ORDER.indexOf(b[0])) : [];
    if (vpCards.length) return {card:vpCards[0][0],label:pLabel('take ' + vpCards[0][0] + ' (' + vpCards[0][1] + ' VP).')};
    const pickd = [...(ok.length ? ok : cards)].sort((a,b) => PAPER_CARD_ORDER.indexOf(a) - PAPER_CARD_ORDER.indexOf(b))[0];
    return {card:pickd,label:pLabel('take ' + pickd + '.')};
  }
  const best = [...cards].sort((a,b) => paperCardPoints(s,actor,b,tile) - paperCardPoints(s,actor,a,tile) || PAPER_CARD_ORDER.indexOf(a) - PAPER_CARD_ORDER.indexOf(b))[0];
  return {card:best,label:pLabel('take ' + best + '.')};
}

// ---------- Card effects ----------
function paperHitOn(s, tile, actor, allowOwn) { // whose species to remove on a tile: leader first, own only if forced
  const opps = pOrderOpps(s,actor).filter(id => s.tiles[tile].cubes[id]);
  if (opps.length) return opps[0];
  return allowOwn && s.tiles[tile].cubes[actor] ? actor : null;
}
function paperEffect(s, step) {
  const {actor,name,tile:scoredTile} = step;
  const me = s.animals[actor];
  const land = pTiles(s);
  const leader = pLeader(s,actor);
  const bagTypes = elementOptions(s);
  const myType = () => bagTypes.includes(ANIMALS[actor].el) ? ANIMALS[actor].el : pTypes(s,actor).find(t => bagTypes.includes(t)) || bagTypes[0];
  switch (name) {
    case 'Biodiversity': case 'Ecodiversity': case 'Cold Snap': case 'Disease': case 'Ice Age': case 'Immigrants':
    case 'Intelligence': case 'Omnivore': case 'Parasitism': case 'Niche Biomes': case 'Nocturnal': case 'Symbiotic':
      return chooseEffect(s,step); // no choice for the chooser
    case 'Aquatic': {
      let wet = land.filter(t => ['sea','wetland'].includes(s.tiles[t].terrain));
      // The element is part of the card: if the bag has one and any sea or wetland tile has a free corner, choose among those tiles.
      const roomy = wet.filter(t => VERTICES_OF[t].some(k => !s.corners[k]));
      if (bagTypes.length && roomy.length) wet = roomy;
      if (!wet.length) return {skip:true,label:pLabel('no sea or wetland tile.')};
      const n = Math.min(4,me.pool);
      const type0 = bagTypes.length ? myType() : null;
      const score = t => { // first-place VP you would gain by adding n species there (with your element if a corner is free)
        const free = VERTICES_OF[t].find(k => !s.corners[k]);
        if (free && type0) s.corners[free] = type0;
        const ok = match(s,t,actor) > 0;
        const before = pRank(s,t,actor);
        s.tiles[t].cubes[actor] += n; const after = pRank(s,t,actor); s.tiles[t].cubes[actor] -= n;
        if (free && type0) delete s.corners[free];
        return ok ? (after === 0 && before !== 0 ? 2 : after < before || before < 0 ? 1 : 0) * pFirstVP(s,t) : -1;
      };
      const tile = PAPER.simpleCards ? pBy(wet, t => match(s,t,actor) > 0 ? 1 : 0, t => pFirstVP(s,t)) : pBy(wet, score, t => pFirstVP(s,t));
      const corner = bagTypes.length ? VERTICES_OF[tile].find(k => !s.corners[k]) || null : null;
      const type = corner ? type0 : null;
      return {tile,corner,type,n,label:pLabel('Aquatic at ' + tileLabel(s,tile) + ': ' + (type ? 'take ' + elementName(type) + ' from the bag and place it at corner ' + cornerIndex(tile,corner) + ' of ' + tile + '. ' : 'no element can be placed. ') + addLabel(s,{[tile]:n}))};
    }
    case 'Biomass': {
      const hits = land.filter(t => sum(Object.values(s.tiles[t].cubes)) > VERTICES_OF[t].filter(k => s.corners[k]).length)
        .map(t => ({tile:t,victim:paperHitOn(s,t,actor,true)})).filter(h => h.victim);
      return {hits,label:pLabel(hits.length ? hitLabel(s,hits) : 'no tile.')};
    }
    case 'Blight': {
      const tiles = land.filter(t => VERTICES_OF[t].filter(k => s.corners[k]).length > 1);
      if (!tiles.length) return {skip:true,label:pLabel('no tile.')};
      const options = tiles.flatMap(t => VERTICES_OF[t].filter(k => s.corners[k]).map(keep => ({tile:t,keep})));
      const swing = o => { // opposing species left with no match, minus twice your own
        const removed = VERTICES_OF[o.tile].filter(k => s.corners[k] && k !== o.keep).map(k => [k,s.corners[k]]);
        const around = unique(removed.flatMap(([k]) => CORNER_TILES[k])).filter(t => s.tiles[t]);
        const before = Object.fromEntries(around.map(t => [t,s.ids.map(id => match(s,t,id) > 0)]));
        for (const [k] of removed) delete s.corners[k];
        let v = 0;
        for (const t of around) s.ids.forEach((id,i) => { if (before[t][i] && !(match(s,t,id) > 0)) v += (id === actor ? -2 : 1) * s.tiles[t].cubes[id]; });
        for (const [k,type] of removed) s.corners[k] = type;
        return v;
      };
      const o = PAPER.simpleCards ? pBy(options, o => s.tiles[o.tile].cubes[leader] - 2 * s.tiles[o.tile].cubes[actor], o => pTypes(s,actor).includes(s.corners[o.keep]) ? 1 : 0, o => pFirstVP(s,o.tile))
        : pBy(options, swing, o => pFirstVP(s,o.tile));
      return {tile:o.tile,keep:o.keep,label:pLabel('Blight: on ' + tileLabel(s,o.tile) + ', keep ' + elementName(s.corners[o.keep]) + ' at corner ' + cornerIndex(o.tile,o.keep) + ' and remove the other disks.')};
    }
    case 'Catastrophe': {
      const tiles = land.filter(t => s.ids.some(id => s.tiles[t].cubes[id]));
      if (!tiles.length) return {skip:true,label:pLabel('no tile.')};
      const plan = t => {
        const here = s.ids.filter(id => s.tiles[t].cubes[id]);
        const keep = here.includes(actor) ? actor : [...here].sort((a,b) => s.animals[a].vp - s.animals[b].vp || rank(b) - rank(a))[0] || null;
        const hits = NEIGHBORS[t].filter(n => s.tiles[n]).map(n => ({tile:n,victim:paperHitOn(s,n,actor,true)})).filter(h => h.victim);
        const value = sum(s.ids.map(id => (id === actor ? -2 : 1) * (s.tiles[t].cubes[id] - (id === keep ? 1 : 0)))) + sum(hits.map(h => h.victim === actor ? -2 : 1));
        return {tile:t,keep,hits,value};
      };
      const best = pBy(tiles.map(plan), p => p.value, p => pFirstVP(s,p.tile));
      return {tile:best.tile,keep:best.keep,hits:best.hits,label:pLabel('Catastrophe: ' + (best.keep ? 'leave one ' + nameOf(best.keep) + ' cube at ' + tileLabel(s,best.tile) + ' and eliminate all other cubes there. ' : 'target ' + tileLabel(s,best.tile) + '. ') + (best.hits.length ? hitLabel(s,best.hits) : 'No adjacent eliminations.'))};
    }
    case 'Evolution': {
      const hits = [];
      for (const victim of pOrderOpps(s,actor)) {
        if (hits.length >= Math.min(2,me.pool)) break;
        const tiles = occupied(s,victim).filter(t => match(s,t,actor) > 0); // printed rule: only tiles it matches
        if (!tiles.length) continue;                                          // none: try the next opponent in VP order
        const score = t => { const b = pRank(s,t,actor); s.tiles[t].cubes[victim]--; s.tiles[t].cubes[actor]++; const a = pRank(s,t,actor); const dom = cone(s,t) === actor; s.tiles[t].cubes[victim]++; s.tiles[t].cubes[actor]--;
          return (match(s,t,actor) > 0 ? 1 : -5) * ((a === 0 && b !== 0 ? 2 : a < b || b < 0 ? 1 : 0) * pFirstVP(s,t) + (dom ? 3 : 0)); };
        const tile = PAPER.simpleCards ? pBy(tiles, t => match(s,t,actor) > 0 ? 1 : 0, t => pFirstVP(s,t)) : pBy(tiles, score, t => pFirstVP(s,t));
        hits.push({tile,victim}); s.tiles[tile].cubes[victim]--; s.tiles[tile].cubes[actor]++;
      }
      for (const h of hits) { s.tiles[h.tile].cubes[h.victim]++; s.tiles[h.tile].cubes[actor]--; }
      return {hits,label:pLabel(hits.length ? hits.map(h => 'replace one ' + nameOf(h.victim) + ' cube with its own cube at ' + tileLabel(s,h.tile)).join('; ') + '.' : 'replace no cubes.')};
    }
    case 'Fecundity': {
      const tiles = [...occupied(s,actor)].sort((a,b) => (match(s,b,actor) > 0) - (match(s,a,actor) > 0) || pFirstVP(s,b) - pFirstVP(s,a) || a.localeCompare(b)).slice(0,me.pool);
      const add = Object.fromEntries(tiles.map(t => [t,1]));
      return {add,label:pLabel(addLabel(s,add))};
    }
    case 'Fertile': {
      const tiles = occupied(s,actor);
      if (!tiles.length) return {skip:true,label:pLabel('no tile.')};
      const tile = pBy(tiles, t => sum(Object.values(s.tiles[t].cubes)));
      const all = sum(Object.values(s.tiles[tile].cubes));
      return {tile,label:pLabel('Fertile: ' + nameOf(actor) + ' gain ' + all + ' VP for all ' + all + ' species (every animal) at ' + tileLabel(s,tile) + '.')};
    }
    case 'Habitat': {
      if (!bagTypes.length) return {skip:true,label:pLabel('empty bag.')};
      const corners = pVacantMyCorners(s,actor);
      const any = activeCorners(s).filter(k => !s.corners[k]);
      if (!corners.length && !any.length) return {skip:true,label:pLabel('no vacant corner.')};
      const c = corners.length ? pBy(corners.map(c => ({...c,tile:c.corner})), c => c.mine, c => c.vp).corner : any[0];
      return {corner:c,type:myType(),label:pLabel('Habitat: take ' + elementName(myType()) + ' from the bag and place it at ' + pAt(s,c) + '.')};
    }
    case 'Hibernation': {
      const n = Math.min(5,me.dead);
      if (!n) return {tile:land[0],n:0,label:pLabel('nothing to return.')};
      const matched = land.filter(t => match(s,t,actor) > 0);
      const tile = PAPER.simpleCards ? pBy(matched.length ? matched : land, t => pFirstVP(s,t)) : pBy(matched.length ? matched : land, t => s.tiles[t].terrain === 'tundra' ? 1 : 0, t => s.tiles[t].cubes[actor] ? 0 : 1, t => pGainsRank(s,t,actor,n) ? 1 : 0, t => pFirstVP(s,t));
      return {tile,n,label:pLabel('Hibernation: return ' + n + ' eliminated cubes to ' + tileLabel(s,tile) + '. These cubes are safe from Extinction this turn.')};
    }
    case 'Ice Sheet': {
      const tile = paperGlaciationTile(s,actor);
      return tile ? {tile,label:pLabel('Ice Sheet: cover ' + tileLabel(s,tile) + ' with tundra.')} : {skip:true,label:pLabel('no target.')};
    }
    case 'Instinct': {
      if (me.ap <= pawnCount(s,actor)) return {slot:null,label:pLabel('no pawn.')};
      // GMT p.19: a pawn on a space already resolved waits for next turn. Prefer a space that still runs this turn;
      // otherwise reserve one for next turn, unless this is the final turn.
      const vacant = ALL_SLOTS.filter(k => !s.pawns[k]);
      const now = vacant.filter(k => EXECUTION.indexOf(k) >= s.cursor);
      const open = now.length ? now : s.ending ? [] : vacant;
      if (!open.length) return {slot:null,label:pLabel('no space.')};
      const slot = paperPlacement(s,actor,null,open).slot;
      return {slot,label:pLabel('Instinct: place an available pawn at ' + slotLabel(slot) + (EXECUTION.indexOf(slot) >= s.cursor ? '. It resolves this turn.' : '. It waits for next turn.'))};
    }
    case 'Mass Exodus': {
      const opp = t => sum(s.ids.filter(id => id !== actor).map(id => s.tiles[t].cubes[id]));
      const tiles = land.filter(t => NEIGHBORS[t].some(id => s.tiles[id]) && s.ids.some(id => s.tiles[t].cubes[id]));
      if (!tiles.length) return {skip:true,label:pLabel('no tile.')};
      const tile = pBy(tiles, t => s.tiles[t].cubes[actor] ? 0 : 1, opp, t => pFirstVP(s,t));
      const near = NEIGHBORS[tile].filter(t => s.tiles[t]);
      const moves = {};
      for (const id of s.ids) {
        const n = s.tiles[tile].cubes[id];
        if (!n) continue;
        const to = id === actor ? pBy(near, t => match(s,t,id), t => pFirstVP(s,t)) : pBy(near, t => -match(s,t,id), t => -pFirstVP(s,t));
        moves[id] = [{from:tile,to,n}];
      }
      return {tile,moves,label:pLabel('Mass Exodus from ' + tileLabel(s,tile) + ': ' + Object.entries(moves).map(([id,group]) => nameOf(id) + ' · ' + moveLabel(s,group)).join(' '))};
    }
    case 'Metamorphosis': {
      if (!me.added.length || !bagTypes.length) return {skip:true,label:pLabel('nothing to swap.')};
      const out = [...unique(me.added)].sort((a,b) => pCornersNear(s,actor,a) - pCornersNear(s,actor,b))[0];
      const type = [...bagTypes].sort((a,b) => pCornersNear(s,actor,b) - pCornersNear(s,actor,a) || (b === ANIMALS[actor].el) - (a === ANIMALS[actor].el))[0];
      return {out,type,label:pLabel('swap ' + elementName(out) + ' for ' + elementName(type) + '.')};
    }
    case 'Predator': {
      const hits = occupied(s,actor).map(t => ({tile:t,victim:paperHitOn(s,t,actor,false)})).filter(h => h.victim);
      return {hits,label:pLabel(hits.length ? hitLabel(s,hits) : 'no target.')};
    }
  }
  paperNote('effect:' + name); return chooseEffect(s,step);
}
function paperImmigrant(s, actor) {
  const me = s.animals[actor];
  const doubled = me.added.filter((t,i,a) => a.indexOf(t) !== i);
  if (doubled.length) return {mode:'element',type:doubled[0],label:pLabel('discard ' + elementName(doubled[0]) + '.')};
  const thin = occupied(s,actor).every(t => s.tiles[t].cubes[actor] <= 2);
  if (thin) return {mode:'cubes',label:pLabel('keep one species per tile.')};
  if (me.added.length) { const type = [...me.added].sort((a,b) => pCornersNear(s,actor,a) - pCornersNear(s,actor,b))[0]; return {mode:'element',type,label:pLabel('discard ' + elementName(type) + '.')}; }
  if (me.ap > 0) { const from = ALL_SLOTS.filter(k => s.pawns[k]?.actor === actor).at(-1); const slot = me.ap > pawnCount(s,actor) ? null : from; return {mode:'pawn',slot,label:pLabel('lose one action pawn' + (slot ? ' from ' + slotLabel(slot) : ' from the available supply') + '.')}; }
  return {mode:'cubes',label:pLabel('keep one species per tile.')};
}
function paperLoss(s, actor, options, amount) {
  const sorted = [...options].sort((a,b) => pCornersNear(s,actor,a) - pCornersNear(s,actor,b));
  const elements = sorted.slice(0,amount);
  return {elements,label:pLabel('remove ' + elements.map(elementName).join(' and ') + '.')};
}
const _appBotAction = botAction;
botAction = function(s, step) {
  const {actor,kind} = step;
  if (!paperOn(s) || PAPER[kind] === false) return _appBotAction(s,step);
  if (kind === 'regression' || kind === 'weather') return _appBotAction(s,step); // no decision to make
  switch (kind) {
    case 'pawn': return PAPER['pawn:' + step.row] === false ? _appBotAction(s,step) : paperPawn(s,step);
    case 'spider': return paperCompetition(s,actor,['tundra',...LARGE_TERRAIN],true);
    case 'arrival': {
      const moves = NEIGHBORS[step.tile].filter(t => s.tiles[t]?.cubes[actor] >= 2 && !pLosesRank(s,t,actor)).map(t => ({from:t,to:step.tile,n:1}));
      const arrive = match(s,step.tile,actor) > 0 ? moves : [];
      return {moves:arrive,label:pLabel(arrive.length ? 'arrival: ' + moveLabel(s,arrive) : 'arrival: keep the cubes where they are.')};
    }
    case 'insect': {
      const tiles = pTiles(s).filter(t => match(s,t,actor) > 0);
      if (!tiles.length || !s.animals[actor].pool) return {...PASS};
      const tile = pBy(tiles, t => pGainsRank(s,t,actor) ? 1 : 0, t => s.tiles[t].cubes[actor] ? 1 : 0, t => pFirstVP(s,t));
      return {tile,label:pLabel(addLabel(s,{[tile]:1}))};
    }
    case 'loss': return paperLoss(s,actor,step.due.threats,step.due.drops);
    case 'extinction': return _appBotAction(s,step); // already a table rule: save on the highest first-place tile
    case 'claim': return paperClaim(s,actor,step.tile);
    case 'effect': {
      if (PAPER['effect:' + step.name] === false) return _appBotAction(s,step);
      return paperEffect(s,step);
    }
    case 'immigrant': return paperImmigrant(s,actor);
  }
  paperNote('kind:' + kind); return _appBotAction(s,step);
};

// ---------- Difficulty: extra action pawns for paper rivals ----------
const _appNewGame = newGame;
newGame = function(human, rivals, short, seed, paper = null) {
  const s = _appNewGame(human, rivals, short, seed);
  if (!PAPER.place && !paper) return s;
  const extra = paper ? Number(paper.extra || 0) : Number(PAPER.extraAP || 0);
  for (const id of rivals) s.animals[id].ap += extra;
  s.paper = PAPER.flatMatch ? {extra} : {extra, detailed:true};
  // v0.4.0: rival ties go to the food chain. Recorded in the save, so games started earlier keep the rule they began with.
  if (PAPER.flatMatch && !PAPER.noRivalTie) s.paper.rivalTie = true;
  // Candidate (testing, off by default): tieToRival. A tie for the most matches that includes you goes to the highest rival in it.
  if (PAPER.tieToRival && s.paper.rivalTie) s.paper.tieToRival = true;
  s.paperRivals = [...rivals];
  return s;
};

// Candidate (testing, off by default): extraFirst. Rivals place their extra (difficulty) pawns before anyone else, at the
// start of Planning, in Initiative order; then Planning continues as usual from the top of the Initiative order.
const _appEnterSupply = enterSupply;
enterSupply = function(s, values) {
  _appEnterSupply(s, values);
  // rivalsFirst (testing): each rival's first pawn is placed this way too, at every level.
  const rounds = !s.paper || s.phase !== 'planning' ? 0 : (PAPER.extraFirst ? Math.max(0, s.paper.extra) : 0) + (PAPER.rivalsFirst ? 1 : 0);
  if (rounds) { s.paper.pre = rounds * s.paperRivals.length; s.paper.preTotal = s.paper.pre; }
};
const _appCurrentPlanner = currentPlanner;
currentPlanner = function(s) {
  if (!(s.paper?.pre > 0) || s.phase !== 'planning' || ALL_SLOTS.every(key => s.pawns[key])) return _appCurrentPlanner(s);
  const order = s.initiative.filter(id => s.paperRivals.includes(id));
  const done = s.paper.preTotal - s.paper.pre;
  const actor = order[done % order.length];
  return s.animals[actor].remaining > 0 ? {actor, index: s.initiative.indexOf(actor)} : _appCurrentPlanner(s);
};
const _appPlace = place;
place = function(s, key, bot = null) {
  const pre = s.paper?.pre > 0 && s.phase === 'planning';
  _appPlace(s, key, bot);
  if (!pre) return;
  if (--s.paper.pre > 0 && s.phase === 'planning') return;
  delete s.paper.pre; delete s.paper.preTotal;
  if (s.phase === 'planning') { s.planning = 0; if (!_appCurrentPlanner(s)) { s.phase = 'execution'; s.cursor = 0; } }
};

// ---------- Option: flat element matching for rivals ----------
// Rival tie-break (v0.4.0). Flat matching makes rivals tie often, and a tie leaves a tile with no dominant animal, which
// handed the player cards, Ice Age points and board control. When only paper rivals share the most matches on a tile,
// the rival higher in the food chain is dominant. A tie that includes the player still leaves the tile undominated.
const _appCone = cone;
cone = function(s, tile) {
  const owner = _appCone(s, tile);
  if (owner || !s.paper?.rivalTie || !s.paperRivals) return owner;
  const vals = s.ids.filter(id => s.tiles[tile]?.cubes[id]).map(id => [id, match(s,tile,id)]);
  const best = Math.max(0, ...vals.map(v => v[1]));
  if (!best) return null;
  const top = vals.filter(v => v[1] === best).map(v => v[0]);
  if (top.length < 2) return null;
  const rivalsIn = top.filter(id => s.paperRivals.includes(id));
  return rivalsIn.length === top.length || s.paper.tieToRival && rivalsIn.length ? rivalsIn.sort((a,b) => rank(a) - rank(b))[0] : null;
};
const _appMatch = match;
match = function(s, tile, actor, additions = s.animals[actor].added) {
  if (PAPER.flatMatch && s.paperRivals?.includes(actor)) return Math.min(ANIMALS[actor].affinity + additions.length, VERTICES_OF[tile].filter(k => s.corners[k]).length);
  return _appMatch(s,tile,actor,additions);
};
