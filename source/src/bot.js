const PASS = {pass:true, label:'Forfeit this action.'};
const FALLBACK = ['domination','speciation','adaptation','abundance','competition','wanderlust','migration','glaciation','regression','wasteland','depletion','initiative'];

function context(s, actor, focus = 'majority') {
  const order = standings(s).filter(id => id !== actor);
  const other = order[0], third = order[1];
  const gap = s.animals[other].vp - s.animals[third].vp;
  return {
    actor, focus,
    rival: {[other]:.52 + Math.min(.21, gap / 100), [third]:.48 - Math.min(.21, gap / 100)},
    cardWeight:focus === 'dominance' ? 3.2 : s.market.some(Boolean) ? 2.1 : 1.25,
    vpWeight:focus === 'majority' ? .85 : .55,
    endWeight:s.ending || s.market.includes('Ice Age') ? 1.2 : .75,
  };
}
function utility(s, tile, ctx) {
  const t = s.tiles[tile];
  if (!t) return 0;
  const vals = tileScores(s,tile);
  const owner = cone(s,tile);
  let result = 0;
  for (const id of s.ids) {
    const n = t.cubes[id];
    if (!n) continue;
    const own = id === ctx.actor;
    const matching = match(s,tile,id);
    const stability = matching > 0 || s.animals[id].ward[tile];
    const reach = own && ctx.focus === 'reach' ? 1.25 : .6;
    const depth = own && ctx.focus === 'growth' ? .4 : .25;
    const vp = (vals.find(([a]) => a === id)?.[1] || 0) * ctx.vpWeight;
    const tundra = t.terrain === 'tundra' ? (ctx.focus === 'survival' ? 2.1 : 1) * (1 + Math.min(3,n) * .6) : 0;
    const presence = stability ? reach + depth * Math.min(5,n) + vp * ctx.endWeight + tundra : -.47 * n;
    const preservation = stability && own && ctx.focus === 'conserve' ? .44 * Math.min(n,6) : 0;
    const dominance = owner === id ? ctx.cardWeight : 0;
    result += (own ? 1 : -ctx.rival[id]) * (presence + preservation + dominance);
  }
  return result;
}
function delta(s, ids, ctx, change, revert) {
  const before = sum(ids.map(id => utility(s,id,ctx)));
  change();
  const gain = sum(ids.map(id => utility(s,id,ctx))) - before;
  revert();
  return gain;
}
function cornerGain(s, key, type, ctx) {
  const was = s.corners[key];
  return delta(s, CORNER_TILES[key], ctx, () => {
    if (type) s.corners[key] = type; else delete s.corners[key];
  }, () => {
    if (was) s.corners[key] = was; else delete s.corners[key];
  });
}
function changeCubes(s, tile, actor, n, ctx) {
  const cubes = s.tiles[tile].cubes;
  return delta(s,[tile],ctx,() => { cubes[actor] += n; },() => { cubes[actor] -= n; });
}
function changeElements(s, actor, additions, ctx) {
  const before = s.animals[actor].added;
  return delta(s,occupied(s,actor),ctx,() => { s.animals[actor].added = additions; },() => { s.animals[actor].added = before; });
}
function choiceBest(choices) {
  return choices.reduce((best, c) => !best || c.value > best.value + 1e-8 ? c : best,null);
}
function indexed(values) {
  const seen = new Set();
  return values.flatMap((type,pick) => {
    if (!type || seen.has(type)) return [];
    seen.add(type);
    return [{type,pick}];
  });
}
function placementTargets(s, row, index, actor) {
  if (row === 'competition') return competitionChoices(s,actor,['tundra',COMPETITION_EDGES[index],COMPETITION_EDGES[index+1]]);
  if (row === 'speciation') return Object.keys(s.corners).filter(key => s.corners[key] === ELEMENT_IDS[index]);
  if (row === 'depletion') return Object.keys(s.corners).filter(key => s.boxes.depletion.includes(s.corners[key]));
  if (row === 'domination') return terrainIds(s).filter(id => !s.scored.includes(id) && s.ids.some(a => s.tiles[id].cubes[a]));
  return [];
}
function chooseSpeciation(s, key, ctx) {
  let available = s.animals[ctx.actor].pool;
  const candidates = CORNER_TILES[key].filter(id => s.tiles[id]).map(tile => {
    const options = Array.from({length:TERRAIN[s.tiles[tile].terrain].cap},(_,i) => {
      const n = i + 1;
      return {n,value:changeCubes(s,tile,ctx.actor,n,ctx) - n * .20};
    });
    return {tile,options,value:choiceBest(options).value};
  }).sort((a,b) => b.value - a.value);
  const add = {};
  let value = 0;
  for (const t of candidates) {
    const best = choiceBest(t.options.filter(o => o.n <= available));
    if (best?.value > 0) { add[t.tile] = best.n; available -= best.n; value += best.value; }
  }
  return {corner:key,add,value,label:addLabel(s,add)};
}
function addLabel(s, add) {
  const list = Object.entries(add).filter(([,n]) => n).map(([tile,n]) => n + ' cube' + (n === 1 ? '' : 's') + ' to ' + tileLabel(s,tile));
  return list.length ? 'Add ' + list.join(', ') + '.' : 'No cubes are added.';
}
function moveLabel(s, moves) {
  return moves.length ? moves.map(m => 'Move ' + m.n + ' from ' + tileLabel(s,m.from) + ' to ' + tileLabel(s,m.to)).join('; ') + '.' : 'Keep the cubes where they are.';
}
function migrationPlan(s, ctx, limit, destination = null) {
  const actor = ctx.actor, moves = [];
  let value = 0;
  const origins = occupied(s,actor);
  const legal = Object.fromEntries(origins.map(from => [from, destination ? legalNeighbors(s,from,actor,1).filter(t => t === destination) : legalNeighbors(s,from,actor)]));
  const available = Object.fromEntries(origins.map(id => [id,s.tiles[id].cubes[actor]]));
  // Trial moves only mutate cube counts. Received cubes cannot move again.
  while (limit > 0) {
    let best = null;
    for (const from of origins) {
      for (const to of legal[from]) {
        if (!match(s,to,actor)) continue;
        for (let n = 1; n <= Math.min(limit,available[from]); n++) {
          const gain = delta(s,[from,to],ctx,() => { s.tiles[from].cubes[actor]-=n; s.tiles[to].cubes[actor]+=n; },
            () => { s.tiles[from].cubes[actor]+=n; s.tiles[to].cubes[actor]-=n; });
          if (gain > .04 && (!best || gain > best.value + 1e-8)) best = {from,to,n,value:gain};
        }
      }
    }
    if (!best) break;
    const {from,to,n} = best;
    value += best.value;
    limit -= n;
    available[from] -= n;
    s.tiles[from].cubes[actor] -= n;
    s.tiles[to].cubes[actor] += n;
    const prior = moves.find(m => m.from === from && m.to === to);
    if (prior) prior.n += n; else moves.push({from,to,n});
  }
  for (const {from,to,n} of moves) { s.tiles[from].cubes[actor]+=n; s.tiles[to].cubes[actor]-=n; }
  return {moves,value,label:moveLabel(s,moves)};
}
function hitValue(s, tile, victim, ctx) {
  const gain = changeCubes(s,tile,victim,-1,ctx);
  return gain + (ctx.focus === 'pressure' ? .62 : .39) * ctx.rival[victim];
}
function hitLabel(s, hits) {
  return hits.length ? hits.map(h => 'Remove one ' + nameOf(h.victim) + ' cube at ' + tileLabel(s,h.tile)).join('; ') + '.' : 'Forfeit Competition.';
}
function pickHits(s, actor, types, ctx, one = false) {
  const legal = competitionChoices(s,actor,types).map(h => ({...h, value:hitValue(s,h.tile,h.victim,ctx)}));
  const hits = (one ? [choiceBest(legal)] : types.map(type => choiceBest(legal.filter(h => s.tiles[h.tile].terrain === type))))
    .filter(h => h?.value > 0);
  return {hits,value:sum(hits.map(h => h.value)),label:hitLabel(s,hits)};
}
function glaciationChoice(s, actor, focus) {
  const ctx = context(s,actor,focus);
  return choiceBest(glazeTargets(s).map(tile => {
    const trial = {...s,tiles:{...s.tiles,[tile]:{...s.tiles[tile],cubes:{...s.tiles[tile].cubes}}},corners:{...s.corners},
      animals:Object.fromEntries(s.ids.map(id => [id,{...s.animals[id],ward:{...s.animals[id].ward}}]))};
    const near = unique([tile, ...NEIGHBORS[tile]]);
    const label = glaciation(trial,actor,tile);
    const hold = survival(trial);
    let value = sum(near.map(id => utility(trial,id,ctx) - utility(s,id,ctx))) + trial.animals[actor].vp - s.animals[actor].vp;
    if (hold) value += hold.vp * (hold.actor === actor ? .35 : -.24);
    return {tile,value,label};
  }));
}
function wanderChoice(s, ctx) {
  const actor = ctx.actor;
  const draws = indexed(s.boxes.wanderlust);
  const options = [];
  for (const tile of frontTiles(s)) {
    const neighbors = NEIGHBORS[tile].filter(id => s.tiles[id]);
    const self = neighbors.some(id => s.tiles[id].cubes[actor]);
    const others = s.ids.filter(id => id !== actor && neighbors.some(t => s.tiles[t].cubes[id]));
    for (let stack = 0; stack < s.stacks.length; stack++) {
      const terrain = s.stacks[stack].face;
      if (!terrain) continue;
      const vp = bonus(neighbors.length);
      const placements = [{type:null,pick:null,corner:null}];
      for (const corner of VERTICES_OF[tile].filter(key => !s.corners[key])) for (const el of draws) placements.push({...el,corner});
      s.tiles[tile] = {terrain,cubes:Object.fromEntries(s.ids.map(id => [id,0]))};
      const local = placements.map(({type,pick,corner}) => {
        const spread = type ? .42 * cornerGain(s,corner,type,ctx) : 0;
        if (type) s.corners[corner] = type;
        const affinity = self ? match(s,tile,actor) : 0;
        const rivalAffinity = Math.max(0,...others.map(id => match(s,tile,id)));
        const payoff = (affinity ? 1.35 + (affinity > rivalAffinity ? 1.45 : 0) : 0) + (affinity ? .17 * TERRAIN[terrain].vp[0] : 0);
        if (type) delete s.corners[corner];
        const value = vp * .77 + payoff + spread - (rivalAffinity && !affinity ? .9 : 0);
        const label = 'Place ' + terrainName(terrain) + ' from stack ' + (stack + 1) + ' at ' + tile +
          (type ? '. Add ' + elementName(type) + ' at corner ' + cornerIndex(tile,corner) : '') + '. +' + vp + ' VP.';
        return {stack,tile,pick,corner,value,label};
      });
      delete s.tiles[tile];
      options.push(choiceBest(local));
    }
  }
  return choiceBest(options);
}
function sacrificeElement(s, actor, options, amount) {
  const ctx = context(s,actor,'conserve');
  const current = s.animals[actor].added;
  const choices = [];
  function combine(start, selected) {
    if (selected.length === amount) {
      const left = [...current];
      for (const type of selected) left.splice(left.indexOf(type),1);
      choices.push({elements:selected,value:changeElements(s,actor,left,ctx),label:'Remove ' + selected.map(elementName).join(' and ') + ' from the animal display.'});
      return;
    }
    for (let i = start; i < options.length; i++) combine(i+1,[...selected,options[i]]);
  }
  combine(0,[]);
  return choiceBest(choices);
}
function choosePawnTarget(s, step, quick = false) {
  const {row,index,actor} = step;
  const ctx = context(s,actor,step.focus || 'majority');
  const max = choiceBest;
  let best = null;
  switch (row) {
    case 'initiative': {
      const slot = planPlacement(s,actor,null,step.focus,true);
      return slot ? {slot:slot.slot,value:1.5 + (s.initiative[0] !== actor ? .9 : 0),label:'Advance one place in Initiative if possible. Move this pawn to ' + slotLabel(slot.slot) + '.'} : PASS;
    }
    case 'adaptation':
      if (s.animals[actor].added.length + ANIMALS[actor].affinity < 6) {
        best = max(indexed(s.boxes.adaptation).map(({pick,type}) => {
          const nearby = terrainIds(s).filter(id => VERTICES_OF[id].some(c => s.corners[c] === type) && !match(s,id,actor)).length;
          const regresses = s.boxes.regression.includes(type) ? .75 : 0;
          const value = changeElements(s,actor,[...s.animals[actor].added,type],ctx) + Math.min(2,nearby) * .45 + .31 - regresses;
          return {pick,value,label:'Add ' + elementName(type) + ' from Adaptation position ' + (pick + 1) + ' to the animal display.'};
        }));
      }
      break;
    case 'regression': {
      const threats = regressionDue(s,actor).threats.length;
      return {value:threats ? 1.6 + .6 * threats : 0,label:'Protect one added element from Regression.'};
    }
    case 'abundance':
      best = max(indexed(s.boxes.abundance).flatMap(({type,pick}) => activeCorners(s).filter(key => !s.corners[key]).map(corner => ({
        pick,corner,value:cornerGain(s,corner,type,ctx) + (type === ANIMALS[actor].el ? .08 : 0),
        label:'Place ' + elementName(type) + ' from Abundance position ' + (pick + 1) + ' at the corner shared by ' + cornerLabel(s,corner) + ' (corner ' + cornerIndex(CORNER_TILES[corner].find(id => s.tiles[id]),corner) + ' on ' + CORNER_TILES[corner].find(id => s.tiles[id]) + ').',
      }))));
      break;
    case 'wasteland': {
      const disks = wastelandDisks(s);
      best = max(s.boxes.wasteland.flatMap((type,pick) => type ? [{pick,value:count(s.boxes.wasteland,type) > 1 ? 0 : -sum(disks.filter(key => s.corners[key] === type).map(key => cornerGain(s,key,null,ctx))),
        label:'Remove one ' + elementName(type) + ' disk from the Wasteland box.'}] : []));
      break;
    }
    case 'depletion':
      best = max(placementTargets(s,row,index,actor).map(corner => ({
        corner,value:cornerGain(s,corner,null,ctx),label:'Remove ' + elementName(s.corners[corner]) + ' from the corner shared by ' + cornerLabel(s,corner) + ' (corner ' + cornerIndex(CORNER_TILES[corner].find(id => s.tiles[id]),corner) + ' on ' + CORNER_TILES[corner].find(id => s.tiles[id]) + ').',
      })));
      break;
    case 'glaciation': best = glaciationChoice(s,actor,step.focus); break;
    case 'speciation':
      if (s.animals[actor].pool) best = max(placementTargets(s,row,index,actor).map(key => chooseSpeciation(s,key,ctx)));
      break;
    case 'wanderlust': best = wanderChoice(s,ctx); break;
    case 'migration': {
      if (quick) {
        const reach = occupied(s,actor).some(from => legalNeighbors(s,from,actor).some(to => match(s,to,actor) && (!s.tiles[to].cubes[actor] || !match(s,from,actor))));
        return {value:reach ? 2.3 : occupied(s,actor).length ? 1.05 : 0};
      }
      best = migrationPlan(s,ctx,7-index);
      break;
    }
    case 'competition': best = pickHits(s,actor,['tundra',COMPETITION_EDGES[index],COMPETITION_EDGES[index+1]],ctx); break;
    case 'domination': {
      const values = availableCards(s).length ? Object.fromEntries(s.ids.map(id => [id,Math.max(0,...availableCards(s).map(card => cardValue(s,id,card,null,quick)))])) : {};
      best = max(placementTargets(s,row,index,actor).map(tile => {
        const owner = cone(s,tile);
        let value = sum(tileScores(s,tile).map(([id,vp]) => (id === actor ? 1 : -ctx.rival[id] * 1.32) * vp));
        if (owner) value += (owner === actor ? 1 : -ctx.rival[owner] * 1.30) * Math.min(6, values[owner] || 0);
        return {tile,value,label:quick ? '' : describeScore(s,tile)};
      }));
      break;
    }
  }
  return best?.value > .04 ? best : {...PASS,value:0};
}
function checkCard(s, actor, test) {
  const land = occupied(s,actor);
  const contested = land.filter(tile => s.ids.some(id => id !== actor && s.tiles[tile].cubes[id]));
  const ctx = context(s,actor,'dominance');
  switch (test) {
    case 'foothold': return land.some(tile => !match(s,tile,actor));
    case 'close': return contested.some(tile => {
      const t = s.tiles[tile];
      const before = tileVP(s,tile,actor);
      t.cubes[actor]++;
      const higher = tileVP(s,tile,actor) > before;
      t.cubes[actor]--;
      return higher;
    });
    case 'cone': return availableCards(s).length > 0 && land.some(tile => !s.scored.includes(tile) && cone(s,tile) === actor);
    case 'front': return s.stacks.some(stack => stack.face && TERRAIN[stack.face].vp[0] >= 5) && frontTiles(s).some(t => NEIGHBORS[t].some(id => land.includes(id)));
    case 'ice': return land.some(tile => [tile,...NEIGHBORS[tile]].some(id => s.tiles[id]?.terrain === 'tundra'));
    case 'contested': return contested.length > 0;
    case 'elements': return indexed(s.boxes.adaptation).some(({type}) => changeElements(s,actor,[...s.animals[actor].added,type],ctx) > .75) ||
      indexed(s.boxes.abundance).some(({type}) => type === ANIMALS[actor].el);
    case 'supply': return s.animals[actor].pool >= 6;
    case 'removal': return placementTargets(s,'depletion',0,actor).some(key => s.ids.some(id => id !== actor && CORNER_TILES[key].some(tile =>
      s.tiles[tile]?.cubes[id] && match(s,tile,id) > 0 && match(s,tile,id) === (Number(ANIMALS[id].el === s.corners[key]) * ANIMALS[id].affinity + count(s.animals[id].added,s.corners[key])))));
    case 'regression': return regressionDue(s,actor).drops > 0;
    case 'late': return s.ending || s.market.includes('Ice Age') || s.usedCards.length >= (s.short ? 16 : 20);
    case 'breadth': return land.length >= 4;
    case 'invasion': return land.some(from => legalNeighbors(s,from,actor).some(tile =>
      !s.tiles[tile].cubes[actor] && s.ids.some(id => id !== actor && s.tiles[tile].cubes[id]) &&
      match(s,tile,actor) > Math.max(...s.ids.filter(id => id !== actor && s.tiles[tile].cubes[id]).map(id => match(s,tile,id)))));
    default: return false;
  }
}
function fastValue(s, actor, row, index, focus, cache) {
  const key = ['competition','speciation','glaciation'].includes(row) ? row + index : row;
  if (cache.has(key)) return cache.get(key);
  const land = occupied(s,actor);
  let value;
  if (row === 'initiative') value = s.initiative[0] === actor ? .64 : 2.0;
  else if (row === 'wanderlust') value = s.stacks.some(a => a.face) && frontTiles(s).length ? 2.5 : 0;
  else if (row === 'glaciation') value = Math.max(0,glaciationChoice(s,actor,focus)?.value || 0) / (1 + index * 1.22);
  else if (row === 'regression') value = regressionDue(s,actor).drops ? 3.1 : 0;
  else if (row === 'abundance') value = indexed(s.boxes.abundance).length && activeCorners(s).some(k => !s.corners[k]) ? (land.length ? 1.7 : .9) : 0;
  else value = choosePawnTarget(s,{row,index,actor,focus},true).value || 0;
  cache.set(key,value);
  return value;
}
function dominanceSetup(s, actor) {
  const planned = Object.entries(s.pawns).filter(([,pawn]) => pawn.actor === actor).map(([key]) => splitSlot(key));
  const adaptation = s.animals[actor].added.length + ANIMALS[actor].affinity < 6 ?
    indexed(s.boxes.adaptation).map(({type}) => [...s.animals[actor].added,type]) : [];
  const migration = new Set(occupied(s,actor).flatMap(from => legalNeighbors(s,from,actor)));
  const speciation = new Set(Object.entries(s.corners).filter(([,type]) =>
    planned.some(slot => slot.row === 'speciation' && ELEMENT_IDS[slot.index] === type)).flatMap(([key]) => CORNER_TILES[key]));
  const options = new Map();
  for (const tile of terrainIds(s)) {
    if (s.scored.includes(tile) || cone(s,tile) === actor) continue;
    const other = Math.max(0,...s.ids.filter(id => id !== actor && s.tiles[tile].cubes[id]).map(id => match(s,tile,id)));
    const presence = s.tiles[tile].cubes[actor] > 0;
    if (presence && adaptation.some(elements => match(s,tile,actor,elements) > other)) options.set('adaptation',tile);
    if (!presence && match(s,tile,actor) > other) {
      if (migration.has(tile)) options.set('migration',tile);
      if (s.animals[actor].pool && speciation.has(tile)) options.set('speciation',tile);
    }
  }
  const committed = [...options].find(([row]) => planned.some(slot => slot.row === row));
  return {options,committed,hasDomination:planned.some(slot => slot.row === 'domination')};
}
function planPlacement(s, actor, cardIndex, override, duringExecution = false) {
  const card = cardIndex === null ? null : DECKS[actor][cardIndex];
  const positive = card ? checkCard(s,actor,card.check) : false;
  const face = card ? (positive ? card.yes : card.no) : null;
  const otherFace = card ? (positive ? card.no : card.yes) : null;
  const focus = override || face?.focus || 'majority';
  const open = ALL_SLOTS.filter(key => !s.pawns[key] && (!duringExecution || key !== 'initiative-0'));
  const cache = new Map();
  const setup = s.market.some(Boolean) && !duringExecution ? dominanceSetup(s,actor) : null;
  const slots = open.map(key => {
    const {row,index} = splitSlot(key);
    const n = pawnCount(s,actor,row);
    const priority = face?.rows.indexOf(row) ?? -1;
    const alternate = otherFace?.rows.includes(row);
    let opportunity = fastValue(s,actor,row,index,focus,cache);
    if (row === 'domination' && !opportunity && s.market.some(Boolean) && ['migration','speciation','adaptation','abundance','competition'].some(r => pawnCount(s,actor,r))) opportunity = 1.35;
    if (row === 'migration' && !opportunity && pawnCount(s,actor,'speciation')) opportunity = 1.25;
    let value = Math.min(8,opportunity) * .64 - n * (row === 'domination' ? 2.25 : 1.65) - index * .08;
    if (opportunity > .12) value += priority >= 0 ? 4.6 - priority * 1.10 : alternate ? 1.15 : .32 - FALLBACK.indexOf(row) * .018;
    else value -= 3;
    if (row === 'domination' && s.market.includes('Ice Age') && opportunity > 0) value += 1.05;
    if (row === 'domination' && index === 0 && opportunity > 0) value += .51;
    let followUp;
    if (row === 'domination' && setup?.committed && !setup.hasDomination) {
      const [earlier,tile] = setup.committed;
      followUp = 'Reserve scoring after ' + ROW_BY_ID[earlier].name + ' could open a Dominance Card at ' + tileLabel(s,tile) + '.';
    } else if (setup?.hasDomination && setup.options.has(row) && !n) {
      followUp = 'Set up the reserved Domination action at ' + tileLabel(s,setup.options.get(row)) + '.';
    }
    if (followUp && opportunity > .12) value += 1.25;
    return {slot:key,value, row, priority, focus, card:cardIndex, face:positive,
      reason:followUp && opportunity > .12 ? followUp : priority >= 0 && opportunity > .12 ? 'The ' + (positive ? 'primary' : 'reverse') + ' face favors ' + ROW_BY_ID[row].name + ' here.' :
        opportunity > .12 ? 'The current board favors this fallback.' : 'Place in an open space.'};
  });
  return choiceBest(slots);
}
function botPlacement(s) {
  const actor = currentPlanner(s).actor;
  const card = drawCard(s,actor);
  const choice = planPlacement(s,actor,card);
  if (!choice) throw new Error('There is no open space for this pawn.');
  place(s,choice.slot,choice);
  return choice;
}
function botAction(s, step) {
  const {actor,kind} = step;
  if (kind === 'pawn') return choosePawnTarget(s,step);
  if (kind === 'spider') return pickHits(s,actor,['tundra',...LARGE_TERRAIN],context(s,actor,'pressure'),true);
  if (kind === 'arrival') return migrationPlan(s,context(s,actor,step.focus || 'reach'),100,step.tile);
  if (kind === 'insect') {
    const ctx = context(s,actor,step.focus || 'reach');
    const result = choiceBest(terrainIds(s).map(tile => ({tile,value:changeCubes(s,tile,actor,1,ctx),label:addLabel(s,{[tile]:1})})));
    return result?.value > .04 ? result : PASS;
  }
  if (kind === 'loss') return sacrificeElement(s,actor,step.due.threats,step.due.drops);
  if (kind === 'extinction') {
    const saved = actor ? choiceBest(extinctionOptions(s,actor).map(tile => ({tile,value:TERRAIN[s.tiles[tile].terrain].vp[0] + (s.tiles[tile].terrain === 'tundra' ? 1 : 0)})))?.tile : null;
    return {saved};
  }
  if (kind === 'claim') return choiceBest(availableCards(s).map(card => ({card,value:cardValue(s,actor,card,step.tile),label:'Take ' + card + '.'})));
  if (kind === 'effect') return pickEffect(s,step);
  if (kind === 'immigrant') return chooseImmigrant(s,actor);
  return {label:'Continue.'};
}
