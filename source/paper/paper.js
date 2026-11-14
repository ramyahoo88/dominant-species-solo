// Paper rival: decisions a person can make at the table by counting.
// Loaded after the app sources. PAPER.<kind> = true switches that decision to the paper rule.
var PAPER = typeof PAPER === 'object' ? PAPER : {};
var PAPER_FALLBACKS = PAPER_FALLBACKS || {};
function paperNote(kind) { PAPER_FALLBACKS[kind] = (PAPER_FALLBACKS[kind] || 0) + 1; }
function paperLegal(s, actor, row, index) {
  switch (row) {
    case 'initiative': return s.initiative[0] !== actor;
    case 'adaptation': return s.animals[actor].added.length + ANIMALS[actor].affinity < 6 && s.boxes.adaptation.some(Boolean);
    case 'regression': return s.animals[actor].added.some(type => s.boxes.adaptation.includes(type) || s.boxes.regression.includes(type)) || actor === 'reptiles';
    case 'abundance': return s.boxes.abundance.some(type => type && paperUses(s,actor,type)) && occupied(s,actor).some(t => VERTICES_OF[t].some(key => !s.corners[key]));
    case 'wasteland': return s.boxes.wasteland.some(type => type && !paperUses(s,actor,type));
    case 'depletion': return s.boxes.depletion.some(type => type && !paperUses(s,actor,type)) && placementTargets(s,row,index,actor).length > 0;
    case 'glaciation': return glazeTargets(s).some(t => !s.tiles[t].cubes[actor] && s.ids.some(id => s.tiles[t].cubes[id]));
    case 'speciation': return s.animals[actor].pool > 0 && paperSpeciationTiles(s,actor,index).length > 0;
    case 'wanderlust': return s.stacks.some(stack => stack.face) && frontTiles(s).some(t => NEIGHBORS[t].some(id => s.tiles[id]?.cubes[actor]));
    case 'migration': return occupied(s,actor).some(tile => legalNeighbors(s,tile,actor).some(to => match(s,to,actor) > 0));
    case 'competition': return competitionChoices(s,actor,['tundra',COMPETITION_EDGES[index],COMPETITION_EDGES[index+1]]).length > 0;
    case 'domination': return terrainIds(s).some(tile => !s.scored.includes(tile) && s.tiles[tile].cubes[actor]);
  }
  return false;
}
function paperUses(s, actor, type) { return ANIMALS[actor].el === type || s.animals[actor].added.includes(type); }
function paperDominated(s, actor) { return terrainIds(s).filter(t => !s.scored.includes(t) && cone(s,t) === actor); }
function paperSpeciationTiles(s, actor, index) {
  const type = ELEMENT_IDS[index];
  return unique(Object.keys(s.corners).filter(key => s.corners[key] === type).flatMap(key => CORNER_TILES[key].filter(t => s.tiles[t])));
}
function paperSlotScore(s, actor, row, index) {
  if (row === 'speciation') return paperSpeciationTiles(s,actor,index).filter(t => match(s,t,actor) > 0).length;
  if (row === 'competition') return competitionChoices(s,actor,['tundra',COMPETITION_EDGES[index],COMPETITION_EDGES[index+1]]).length;
  return -index; // leftmost open space
}
const PAPER_FALLBACK = ['domination','wanderlust','speciation','adaptation','competition','migration','abundance','initiative','regression','depletion','wasteland','glaciation'];
const PAPER_WEAK = ['abundance','glaciation','wasteland','depletion','regression','initiative'];
function paperPlacement(s, actor, cardIndex, openOverride = null) {
  const card = cardIndex === null ? null : DECKS[actor][cardIndex];
  const positive = card ? checkCard(s,actor,card.check) : false;
  const face = card ? (positive ? card.yes : card.no) : null;
  const focus = face?.focus || 'majority';
  const open = openOverride || ALL_SLOTS.filter(key => !s.pawns[key]);
  const pick = (rows, allowRepeat, weakFirstOnly) => {
    for (const [i,row] of rows.entries()) {
      if (!allowRepeat && pawnCount(s,actor,row)) continue;
      if (weakFirstOnly && i > 0 && PAPER_WEAK.includes(row)) continue;
      const slots = open.map(splitSlot).filter(x => x.row === row && paperLegal(s,actor,row,x.index));
      if (!slots.length) continue;
      const best = slots.sort((a,b) => paperSlotScore(s,actor,row,b.index) - paperSlotScore(s,actor,row,a.index) || a.index - b.index)[0];
      return best.row + '-' + best.index;
    }
    return null;
  };
  const doms = pawnCount(s,actor,'domination'), dominated = paperDominated(s,actor).length;
  const domFirst = availableCards(s).length && dominated > doms && doms < 2 ? pick(['domination'], true) : null;
  const slot = domFirst || pick(face ? face.rows : [], false, true) || pick(PAPER_FALLBACK, false) || pick(PAPER_FALLBACK, true) || open[0];
  const {row} = splitSlot(slot);
  return {slot,row,priority:face ? face.rows.indexOf(row) : -1,focus,card:cardIndex,face:positive,opportunity:1,reason:'Paper rule: ' + ROW_BY_ID[row].name + '.'};
}
const _appBotPlacement = botPlacement;
botPlacement = function(s) {
  if (!PAPER.place) return _appBotPlacement(s);
  const actor = currentPlanner(s).actor;
  const card = drawCard(s,actor);
  const choice = paperPlacement(s,actor,card);
  place(s,choice.slot,choice);
  return choice;
};

// ---------- Countable helpers ----------
function pTiles(s) { return terrainIds(s); }
function pFirstVP(s, tile) { return TERRAIN[s.tiles[tile].terrain].vp[0]; }
function pRank(s, tile, id) { return tileScores(s,tile).findIndex(([a]) => a === id); } // -1 if absent
function pLeader(s, actor) { // opponent highest on the VP track; ties to food chain
  return s.ids.filter(id => id !== actor).sort((a,b) => s.animals[b].vp - s.animals[a].vp || rank(a) - rank(b))[0];
}
function pOrderOpps(s, actor) { return s.ids.filter(id => id !== actor).sort((a,b) => s.animals[b].vp - s.animals[a].vp || rank(a) - rank(b)); }
function pBy(list, ...keys) { // sort descending by keys, then tile label ascending; return first
  return [...list].sort((a,b) => { for (const k of keys) { const d = k(b) - k(a); if (d) return d; } return String(a.tile ?? a).localeCompare(String(b.tile ?? b)); })[0];
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

// ---------- Actions ----------
function paperPawn(s, step) {
  const {row,index,actor} = step;
  const leader = pLeader(s,actor);
  switch (row) {
    case 'initiative': {
      const open = ALL_SLOTS.filter(k => !s.pawns[k] && k !== 'initiative-0' && EXECUTION.indexOf(k) > s.cursor);
      if (!open.length) return {...PASS};
      const plan = paperPlacement(s,actor,null,open);
      return {slot:plan.slot,label:pLabel('advance and move this pawn to ' + slotLabel(plan.slot) + '.')};
    }
    case 'adaptation': {
      if (s.animals[actor].added.length + ANIMALS[actor].affinity >= 6) return {...PASS};
      const picks = indexed(s.boxes.adaptation);
      if (!picks.length) return {...PASS};
      const best = pBy(picks.map(p => ({...p, tile:p.pick})), p => pCornersNear(s,actor,p.type), p => p.type === ANIMALS[actor].el ? 1 : 0, p => -p.pick);
      return {pick:best.pick,label:pLabel('add ' + elementName(best.type) + '.')};
    }
    case 'regression': return {label:pLabel('protect an element.')};
    case 'abundance': {
      const picks = indexed(s.boxes.abundance);
      const corners = pVacantMyCorners(s,actor);
      if (!picks.length || !corners.length) return {...PASS};
      const mine = picks.filter(p => pTypes(s,actor).includes(p.type));
      const p = (mine.length ? mine : picks)[0];
      const c = pBy(corners.map(c => ({...c, tile:c.corner})), c => c.mine, c => c.vp);
      return {pick:p.pick,corner:c.corner,label:pLabel('place ' + elementName(p.type) + '.')};
    }
    case 'wasteland': {
      const picks = indexed(s.boxes.wasteland);
      if (!picks.length) return {...PASS};
      const mine = picks.filter(p => pTypes(s,actor).includes(p.type));
      if (!mine.length) return {...PASS};
      return {pick:mine[0].pick,label:pLabel('remove ' + elementName(mine[0].type) + ' from Wasteland.')};
    }
    case 'depletion': {
      const corners = placementTargets(s,row,index,actor).filter(k => !pTypes(s,actor).includes(s.corners[k]));
      if (!corners.length) return {...PASS};
      const c = pBy(corners.map(k => ({corner:k,tile:k})),
        c => CORNER_TILES[c.corner].filter(t => s.tiles[t] && cone(s,t) === leader).length,
        c => CORNER_TILES[c.corner].filter(t => s.tiles[t] && cone(s,t) && cone(s,t) !== actor).length);
      return {corner:c.corner,label:pLabel('remove ' + elementName(s.corners[c.corner]) + '.')};
    }
    case 'glaciation': {
      const t = paperGlaciationTile(s,actor);
      return t ? {tile:t,label:pLabel('glaciate ' + t + '.')} : {...PASS};
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
      const t = pBy(pool, myVP, t => pFirstVP(s,t));
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
  return pBy(clean.length ? clean : targets, opp, t => -s.tiles[t].cubes[actor], t => pFirstVP(s,t));
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
    const n = Math.min(leading ? 1 : TERRAIN[s.tiles[t].terrain].cap, pool);
    if (n > 0) { add[t] = n; pool -= n; }
  }
  return {corner:k.corner,add,label:pLabel(addLabel(s,add))};
}
function paperWanderlust(s, actor) {
  const front = frontTiles(s).filter(t => NEIGHBORS[t].some(id => s.tiles[id]?.cubes[actor]));
  const stacks = s.stacks.map((st,i) => ({i,face:st.face})).filter(x => x.face);
  if (!front.length || !stacks.length) return {...PASS};
  const tile = pBy(front, t => NEIGHBORS[t].filter(id => s.tiles[id]).length, t => NEIGHBORS[t].filter(id => s.tiles[id]?.cubes[actor]).length);
  const st = [...stacks].sort((a,b) => TERRAIN[b.face].vp[0] - TERRAIN[a.face].vp[0] || a.i - b.i)[0];
  const draws = indexed(s.boxes.wanderlust);
  const mine = draws.filter(d => pTypes(s,actor).includes(d.type));
  const d = mine[0] || null;
  const corners = d ? VERTICES_OF[tile].filter(k => !s.corners[k]) : [];
  const corner = corners.length ? pBy(corners.map(k => ({tile:k,k})), c => CORNER_TILES[c.k].filter(t => s.tiles[t]?.cubes[actor]).length).k : null;
  return {stack:st.i,tile,pick:d && corner ? d.pick : null,corner:d && corner ? corner : null,label:pLabel('place ' + terrainName(st.face) + ' at ' + tile + '.')};
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
        const gain = pGainsRank(s,to,actor) ? 1 : 0;
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
  const mine = s.tiles[tile].cubes[actor], theirs = s.tiles[tile].cubes[victim];
  let score = vp;
  if (pRank(s,tile,victim) < pRank(s,tile,actor) && theirs - 1 <= mine) score += vp;       // you pass or tie them
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
      const wet = land.filter(t => ['sea','wetland'].includes(s.tiles[t].terrain));
      if (!wet.length) return {skip:true,label:pLabel('no sea or wetland tile.')};
      const tile = pBy(wet, t => VERTICES_OF[t].some(k => !s.corners[k]) && bagTypes.length ? 1 : 0, t => s.tiles[t].cubes[actor], t => pFirstVP(s,t));
      const corner = bagTypes.length ? VERTICES_OF[tile].find(k => !s.corners[k]) || null : null;
      const type = corner ? myType() : null;
      const n = Math.min(4,me.pool);
      return {tile,corner,type,n,label:pLabel('Aquatic at ' + tile + '.')};
    }
    case 'Biomass': {
      const hits = land.filter(t => sum(Object.values(s.tiles[t].cubes)) > VERTICES_OF[t].filter(k => s.corners[k]).length)
        .map(t => ({tile:t,victim:paperHitOn(s,t,actor,true)})).filter(h => h.victim);
      return {hits,label:pLabel(hits.length ? hitLabel(s,hits) : 'no tile.')};
    }
    case 'Blight': {
      const tiles = land.filter(t => VERTICES_OF[t].filter(k => s.corners[k]).length > 1);
      if (!tiles.length) return {skip:true,label:pLabel('no tile.')};
      const tile = pBy(tiles, t => cone(s,t) === leader ? 1 : 0, t => s.tiles[t].cubes[actor] ? 0 : 1, t => pFirstVP(s,t));
      const disks = VERTICES_OF[tile].filter(k => s.corners[k]);
      const keep = disks.find(k => pTypes(s,actor).includes(s.corners[k])) || disks[0];
      return {tile,keep,label:pLabel('Blight ' + tile + '.')};
    }
    case 'Catastrophe': {
      const opp = t => sum(s.ids.filter(id => id !== actor).map(id => s.tiles[t].cubes[id]));
      const tiles = land.filter(t => s.ids.some(id => s.tiles[t].cubes[id]));
      if (!tiles.length) return {skip:true,label:pLabel('no tile.')};
      const tile = pBy(tiles, t => opp(t) - s.tiles[t].cubes[actor] * 2, t => pFirstVP(s,t));
      const keep = s.tiles[tile].cubes[actor] ? actor : s.ids.find(id => s.tiles[tile].cubes[id]) || null;
      const hits = NEIGHBORS[tile].filter(t => s.tiles[t]).map(t => ({tile:t,victim:paperHitOn(s,t,actor,true)})).filter(h => h.victim);
      return {tile,keep,hits,label:pLabel('Catastrophe at ' + tile + '.')};
    }
    case 'Evolution': {
      const hits = [];
      for (const victim of pOrderOpps(s,actor).slice(0,Math.min(2,me.pool))) {
        const tiles = occupied(s,victim);
        if (!tiles.length) continue;
        const tile = pBy(tiles, t => s.tiles[t].cubes[actor] && pRank(s,t,victim) < pRank(s,t,actor) ? 1 : 0, t => match(s,t,actor) > 0 ? 1 : 0, t => pFirstVP(s,t));
        hits.push({tile,victim});
      }
      return {hits,label:pLabel(hits.length ? 'Evolution.' : 'Replace no cubes.')};
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
      return {tile,label:pLabel('Fertile at ' + tile + '.')};
    }
    case 'Habitat': {
      if (!bagTypes.length) return {skip:true,label:pLabel('empty bag.')};
      const corners = pVacantMyCorners(s,actor);
      const any = activeCorners(s).filter(k => !s.corners[k]);
      if (!corners.length && !any.length) return {skip:true,label:pLabel('no vacant corner.')};
      const c = corners.length ? pBy(corners.map(c => ({...c,tile:c.corner})), c => c.mine, c => c.vp).corner : any[0];
      return {corner:c,type:myType(),label:pLabel('Habitat.')};
    }
    case 'Hibernation': {
      const n = Math.min(5,me.dead);
      if (!n) return {tile:land[0],n:0,label:pLabel('nothing to return.')};
      const tile = pBy(land, t => match(s,t,actor) > 0 && s.tiles[t].cubes[actor] ? 1 : 0, t => match(s,t,actor), t => pFirstVP(s,t));
      return {tile,n,label:pLabel('Hibernation at ' + tile + '.')};
    }
    case 'Ice Sheet': {
      const tile = paperGlaciationTile(s,actor);
      return tile ? {tile,label:pLabel('Ice Sheet at ' + tile + '.')} : {skip:true,label:pLabel('no target.')};
    }
    case 'Instinct': {
      if (me.ap <= pawnCount(s,actor)) return {slot:null,label:pLabel('no pawn.')};
      const open = ALL_SLOTS.filter(k => !s.pawns[k] && EXECUTION.indexOf(k) >= s.cursor && !(s.ending && EXECUTION.indexOf(k) < s.cursor));
      if (!open.length) return {slot:null,label:pLabel('no space.')};
      return {slot:paperPlacement(s,actor,null,open).slot,label:pLabel('Instinct.')};
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
      return {tile,moves,label:pLabel('Mass Exodus from ' + tile + '.')};
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
  if (me.ap > 0) { const from = ALL_SLOTS.filter(k => s.pawns[k]?.actor === actor).at(-1); return {mode:'pawn',slot:me.ap > pawnCount(s,actor) ? null : from,label:pLabel('lose a pawn.')}; }
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
  if (PAPER[kind] === false || (!PAPER[kind] && !PAPER.all)) return _appBotAction(s,step);
  if (kind === 'regression' || kind === 'weather') return _appBotAction(s,step); // no decision to make
  switch (kind) {
    case 'pawn': return PAPER['pawn:' + step.row] === false ? _appBotAction(s,step) : paperPawn(s,step);
    case 'spider': return paperCompetition(s,actor,['tundra',...LARGE_TERRAIN],true);
    case 'arrival': {
      const moves = NEIGHBORS[step.tile].filter(t => s.tiles[t]?.cubes[actor] >= 2 && !pLosesRank(s,t,actor)).map(t => ({from:t,to:step.tile,n:1}));
      return {moves: match(s,step.tile,actor) > 0 ? moves : [],label:pLabel('arrival.')};
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
    case 'effect': return PAPER['effect:' + step.name] === false ? _appBotAction(s,step) : paperEffect(s,step);
    case 'immigrant': return paperImmigrant(s,actor);
  }
  paperNote('kind:' + kind); return _appBotAction(s,step);
};
