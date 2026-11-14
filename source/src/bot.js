const PASS = {pass:true, label:'Forfeit this action.'};
const FALLBACK = ['domination','speciation','adaptation','abundance','competition','wanderlust','migration','glaciation','regression','wasteland','depletion','initiative'];

function threatScore(s, id) {
  const a = s.animals[id];
  return a.vp + (PLAYABLE_SPECIES - a.pool - a.dead) * 1.1 + a.added.length * 2.5 + (a.ap - STARTING_PAWNS) * 5;
}
function context(s, actor, focus = 'majority') {
  const order = s.ids.filter(id => id !== actor).sort((a,b) => threatScore(s,b) - threatScore(s,a) || rank(a) - rank(b));
  const other = order[0], third = order[1];
  const gap = Math.max(0, threatScore(s,other) - threatScore(s,third));
  return {
    actor, focus,
    rival: {[other]:.56 + Math.min(.26, gap / 65), [third]:.44 - Math.min(.22, gap / 65)},
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
  const scored = s.scored.includes(tile);
  const domFactor = scored ? (s.ending ? 0 : .42) : 1;
  const vpFactor = scored && !s.ending ? .55 : 1;
  let result = 0;
  for (const id of s.ids) {
    const n = t.cubes[id];
    if (!n) continue;
    const own = id === ctx.actor;
    const matching = match(s,tile,id);
    const stability = matching > 0 || s.animals[id].ward[tile];
    const reach = own && ctx.focus === 'reach' ? 1.25 : .6;
    const depth = own && ctx.focus === 'growth' ? .4 : .25;
    const vp = (vals.find(([a]) => a === id)?.[1] || 0) * ctx.vpWeight * vpFactor;
    const tundra = t.terrain === 'tundra' ? (ctx.focus === 'survival' ? 2.1 : 1) * (1 + Math.min(3,n) * .6) : 0;
    const presence = stability ? reach + depth * Math.min(5,n) + vp * ctx.endWeight + tundra : -.47 * n;
    const preservation = stability && own && ctx.focus === 'conserve' ? .44 * Math.min(n,6) : 0;
    const dominance = owner === id ? ctx.cardWeight * domFactor : 0;
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
  const corners = {...s.corners};
  if (type) corners[key] = type;
  else delete corners[key];
  const after = {...s,corners};
  return sum(CORNER_TILES[key].map(id => utility(after,id,ctx) - utility(s,id,ctx)));
}
function changeCubes(s, tile, actor, n, ctx) {
  const cubes = s.tiles[tile].cubes;
  return delta(s,[tile],ctx,() => { cubes[actor] += n; },() => { cubes[actor] -= n; });
}
function changeElements(s, actor, additions, ctx) {
  const before = s.animals[actor].added;
  return delta(s,occupied(s,actor),ctx,() => { s.animals[actor].added = additions; },() => { s.animals[actor].added = before; });
}
function wastelandRemoval(s, pick) {
  const type = s.boxes.wasteland[pick];
  const keepsType = type && count(s.boxes.wasteland,type) === 1;
  return wastelandDisks(s).filter(key => !keepsType || s.corners[key] !== type);
}
function withWastelandLosses(s, disks, fn) {
  if (!disks.length) return fn();
  const original = s.corners;
  s.corners = {...original};
  for (const key of disks) delete s.corners[key];
  try { return fn(); }
  finally { s.corners = original; }
}
function wastelandProtection(s, ctx) {
  const disks = wastelandDisks(s);
  if (!disks.length) return null;
  const tiles = unique(disks.flatMap(key => CORNER_TILES[key]));
  const candidates = s.boxes.wasteland.flatMap((type,pick) => type ? [{pick,type}] : []);
  const before = withWastelandLosses(s,disks,() => sum(tiles.map(id => utility(s,id,ctx))));
  return choiceBest(candidates.map(({pick,type}) => {
    const value = withWastelandLosses(s,wastelandRemoval(s,pick),() => sum(tiles.map(id => utility(s,id,ctx)))) - before;
    return {pick,value,label:'Remove one ' + elementName(type) + ' disk from the Wasteland box.'};
  }));
}
function doomedWastelandCorners(s) {
  if (s.phase === 'execution' && s.cursor > EXECUTION.indexOf('!wasteland')) return [];
  const pawn = s.pawns['wasteland-0'];
  const protection = pawn && wastelandProtection(s,context(s,pawn.actor,pawn.focus || 'majority'));
  return wastelandRemoval(s, protection?.value > .04 ? protection.pick : null);
}
function withPostWasteland(s, fn) {
  return withWastelandLosses(s,doomedWastelandCorners(s),fn);
}
function postRegressionGain(s, actor, type, ctx) {
  const added = [...s.animals[actor].added, type];
  const threats = unique(s.boxes.regression.filter(Boolean)).filter(t => added.includes(t));
  const protects = pawnCount(s, actor, 'regression') + Number(actor === 'reptiles');
  const drops = Math.max(0, threats.length - protects);
  const curDrops = regressionDue(s, actor).drops;
  if (drops <= curDrops && !(drops > 0 && s.boxes.regression.includes(type))) return changeElements(s, actor, added, ctx);
  return -1.2;
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
function chooseSpeciation(s, key, ctx, quick = false, available = s.animals[ctx.actor].pool) {
  const cost = quick ? .18 : (available > 10 ? .03 : .09);
  const candidates = CORNER_TILES[key].filter(id => s.tiles[id]).map(tile => {
    const options = Array.from({length:TERRAIN[s.tiles[tile].terrain].cap},(_,i) => {
      const n = i + 1;
      const base = changeCubes(s,tile,ctx.actor,n,ctx) - n * cost;
      const safe = match(s,tile,ctx.actor) > 0 ? .06 * n : 0;
      return {n,value:base + (quick ? 0 : safe)};
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
function speciationPlanValue(s, actor, slots, focus) {
  return withPostWasteland(s,() => {
    let available = s.animals[actor].pool;
    const cubesAdded = [];
    let value = 0;
    try {
      for (const slot of slots) {
        if (!available) break;
        const ctx = context(s,actor,s.pawns[slot]?.focus || focus);
        const {index} = splitSlot(slot);
        const best = choiceBest(placementTargets(s,'speciation',index,actor).map(key => chooseSpeciation(s,key,ctx,true,available)));
        if (!best) continue;
        for (const [id,n] of Object.entries(best.add)) {
          s.tiles[id].cubes[actor] += n;
          available -= n;
          cubesAdded.push([id,n]);
        }
        value += best.value;
      }
    } finally {
      for (const [id,n] of cubesAdded) s.tiles[id].cubes[actor] -= n;
    }
    return value;
  });
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
  const lastCube = s.tiles[tile].cubes[victim] === 1 && match(s,tile,victim) > 0 ? .35 * ctx.rival[victim] : 0;
  return gain + (ctx.focus === 'pressure' ? .62 : .39) * ctx.rival[victim] + lastCube;
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
          const gain = postRegressionGain(s,actor,type,ctx);
          const value = gain < -0.5 ? gain : gain + Math.min(2,nearby) * .45 + .31;
          return {pick,value,label:'Add ' + elementName(type) + ' from Adaptation position ' + (pick + 1) + ' to the animal display.'};
        }));
      }
      break;
    case 'regression': {
      const threats = regressionDue(s,actor).threats.length;
      return {value:threats ? 1.6 + .6 * threats : 0,label:'Protect one added element from Regression.'};
    }
    case 'abundance': {
      const plannedSpec = new Set(Object.keys(s.pawns).filter(k => s.pawns[k].actor === actor && splitSlot(k).row === 'speciation').map(k => ELEMENT_IDS[splitSlot(k).index]));
      best = max(indexed(s.boxes.abundance).flatMap(({type,pick}) => activeCorners(s).filter(key => !s.corners[key]).map(corner => {
        const specBonus = plannedSpec.has(type) && CORNER_TILES[corner].some(id => s.tiles[id] && match(s,id,actor)) ? .75 : 0;
        const ownMatch = type === ANIMALS[actor].el ? .12 : s.animals[actor].added.includes(type) ? .08 : 0;
        const cg = cornerGain(s,corner,type,ctx);
        const salvage = !quick && cg >= -1e-6 && ownMatch === 0 ? .05 : 0;
        return {
          pick,corner,value:cg + ownMatch + specBonus + salvage,
          label:'Place ' + elementName(type) + ' from Abundance position ' + (pick + 1) + ' at the corner shared by ' + cornerLabel(s,corner) + ' (corner ' + cornerIndex(CORNER_TILES[corner].find(id => s.tiles[id]),corner) + ' on ' + CORNER_TILES[corner].find(id => s.tiles[id]) + ').',
        };
      })));
      break;
    }
    case 'wasteland': {
      best = wastelandProtection(s,ctx);
      break;
    }
    case 'depletion': {
      const run = () => max(placementTargets(s,row,index,actor).map(corner => ({
        corner,value:cornerGain(s,corner,null,ctx),label:'Remove ' + elementName(s.corners[corner]) + ' from the corner shared by ' + cornerLabel(s,corner) + ' (corner ' + cornerIndex(CORNER_TILES[corner].find(id => s.tiles[id]),corner) + ' on ' + CORNER_TILES[corner].find(id => s.tiles[id]) + ').',
      })));
      best = quick ? withPostWasteland(s,run) : run();
      break;
    }
    case 'glaciation': best = glaciationChoice(s,actor,step.focus); break;
    case 'speciation':
      if (s.animals[actor].pool) {
        const run = () => max(placementTargets(s,row,index,actor).map(key => chooseSpeciation(s,key,ctx,quick)));
        best = quick ? withPostWasteland(s,run) : run();
      }
      break;
    case 'wanderlust': best = wanderChoice(s,ctx); break;
    case 'migration': {
      if (quick) {
        const run = () => {
          for (const from of occupied(s,actor)) {
            const avail = s.tiles[from].cubes[actor];
            for (const to of legalNeighbors(s,from,actor)) {
              if (!match(s,to,actor)) continue;
              for (const n of [1, Math.min(2, avail)]) {
                const gain = delta(s,[from,to],ctx,() => { s.tiles[from].cubes[actor]-=n; s.tiles[to].cubes[actor]+=n; },
                  () => { s.tiles[from].cubes[actor]+=n; s.tiles[to].cubes[actor]-=n; });
                if (gain > .06) return {value:Math.min(2.6, 1.0 + gain)};
              }
            }
          }
          return {value:0};
        };
        return withPostWasteland(s,run);
      }
      best = migrationPlan(s,ctx,7-index);
      break;
    }
    case 'competition': best = pickHits(s,actor,['tundra',COMPETITION_EDGES[index],COMPETITION_EDGES[index+1]],ctx); break;
    case 'domination': {
      const run = () => {
        const cards = availableCards(s);
        const values = cards.length ? Object.fromEntries(s.ids.map(id => [id,Math.max(0,...cards.map(card => cardValue(s,id,card,null,quick)))])) : {};
        const laterRivalDom = !quick && ROW_BY_ID.domination.slots.slice(index + 1).some(k => s.pawns[k] && s.pawns[k].actor !== actor);
        const scoredTiles = placementTargets(s,row,index,actor).map(tile => {
          const owner = cone(s,tile);
          const vpScale = (!quick && (owner === actor || laterRivalDom)) ? .85 : 1.32;
          let value = sum(tileScores(s,tile).map(([id,vp]) => (id === actor ? 1 : -ctx.rival[id] * vpScale) * vp));
          if (owner && cards.length) value += (owner === actor ? 1.15 : -ctx.rival[owner] * 1.30) * Math.min(6, values[owner] || 0);
          return {tile,value,label:quick ? '' : describeScore(s,tile)};
        }).sort((a,b) => b.value - a.value);
        if (quick && index > 0) {
          const earlierCount = ROW_BY_ID.domination.slots.slice(0,index).filter(k => s.pawns[k]).length;
          return scoredTiles[earlierCount] || null;
        }
        return scoredTiles[0] || null;
      };
      best = quick ? withPostWasteland(s,run) : run();
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
    case 'foothold': return land.filter(tile => match(s,tile,actor) <= 1).length >= 2;
    case 'close': return contested.some(tile => {
      const t = s.tiles[tile];
      const before = tileVP(s,tile,actor);
      t.cubes[actor]++;
      const higher = tileVP(s,tile,actor) > before;
      t.cubes[actor]--;
      return higher;
    });
    case 'cone': return availableCards(s).length > 0 && land.filter(tile => !s.scored.includes(tile) && cone(s,tile) === actor).length >= 3;
    case 'front': return s.stacks.some(stack => stack.face && TERRAIN[stack.face].vp[0] >= 8) && frontTiles(s).some(t => NEIGHBORS[t].some(id => land.includes(id)));
    case 'ice': {
      const tundra = id => sum(terrainIds(s).filter(tile => s.tiles[tile].terrain === 'tundra').map(tile => s.tiles[tile].cubes[id] || 0));
      const own = tundra(actor);
      return own > 0 && own >= Math.max(...s.ids.filter(id => id !== actor).map(tundra));
    }
    case 'contested': return contested.some(tile => TERRAIN[s.tiles[tile].terrain].vp[0] >= 6 && tileScores(s,tile).findIndex(([id]) => id === actor) > 0);
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
  const earlierInRow = ROW_BY_ID[row].slots.slice(0,index).filter(k => s.pawns[k]).length;
  if (row === 'initiative') return s.initiative[0] === actor ? 0 : 2.0;
  if (row === 'wanderlust') {
    const stacksAvail = s.stacks.filter(a => a.face).length;
    if (stacksAvail <= earlierInRow || !frontTiles(s).length) return 0;
    if (!cache.has('wanderlust')) cache.set('wanderlust', withPostWasteland(s,() => wanderChoice(s,context(s,actor,focus))?.value || 0));
    return Math.max(0,cache.get('wanderlust'));
  }
  if (row === 'glaciation') {
    const tundraLeft = 12 - Object.values(s.tiles).filter(t => t.terrain === 'tundra').length;
    const lateGame = s.ending || s.market.includes('Ice Age') || s.usedCards.length >= (s.short ? 17 : 21);
    if (tundraLeft <= earlierInRow || (index > 0 && lateGame) || !glazeTargets(s).length) return 0;
    return 1.85 / (1 + index * 1.22);
  }
  if (row === 'regression') return regressionDue(s,actor).drops > 0 ? 3.1 : 0;
  if (row === 'abundance') {
    if (s.boxes.abundance.filter(Boolean).length <= earlierInRow) return 0;
    if (!cache.has('abundance')) cache.set('abundance', choosePawnTarget(s,{row,index:0,actor,focus},true).value || 0);
    return cache.get('abundance');
  }
  if (row === 'adaptation') {
    if (s.boxes.adaptation.filter(Boolean).length <= earlierInRow) return 0;
    const earlierOwn = ROW_BY_ID.adaptation.slots.slice(0,index).filter(k => s.pawns[k]?.actor === actor).length;
    if (s.animals[actor].added.length + ANIMALS[actor].affinity + earlierOwn >= 6) return 0;
    if (!cache.has('adaptation')) cache.set('adaptation', choosePawnTarget(s,{row,index:0,actor,focus},true).value || 0);
    return cache.get('adaptation');
  }
  if (row === 'speciation') {
    if (!s.animals[actor].pool) return 0;
    const slots = ROW_BY_ID.speciation.slots;
    const own = slots.filter(key => s.pawns[key]?.actor === actor);
    if (own.length) {
      if (!cache.has('committedSpeciation')) cache.set('committedSpeciation',speciationPlanValue(s,actor,own,focus));
      const proposed = slots.filter((key,i) => i === index || own.includes(key));
      return Math.max(0,speciationPlanValue(s,actor,proposed,focus) - cache.get('committedSpeciation'));
    }
  }
  const key = ['competition','speciation','domination'].includes(row) ? row + index : row;
  if (cache.has(key)) return cache.get(key);
  const value = choosePawnTarget(s,{row,index,actor,focus},true).value || 0;
  cache.set(key,value);
  return value;
}
function blockRival(s, actor, slots) {
  const rival = s.ids.filter(id => id !== actor && s.animals[id].remaining > 0)
    .sort((a,b) => threatScore(s,b) - threatScore(s,a) || rank(a) - rank(b))[0];
  if (!rival) return null;
  const cache = new Map();
  const scored = slots.map(plan => {
    const {row,index} = splitSlot(plan.slot);
    return {plan,row,opportunity:fastValue(s,rival,row,index,'majority',cache)};
  });
  const best = choiceBest(scored.map(({plan,row,opportunity}) => {
    const substitute = Math.max(0,...scored.filter(other => other.plan !== plan && other.row === row).map(other => other.opportunity));
    return {plan,value:Math.min(5,opportunity) + Math.min(5,opportunity - substitute)};
  }));
  if (!best || best.value <= .12) return null;
  return {...best.plan,blockedRival:rival,reason:'Deny ' + nameOf(rival) + ' this useful ' + ROW_BY_ID[best.plan.row].name + ' space.'};
}
function dominanceSetup(s, actor) {
  return withPostWasteland(s, () => {
    const planned = Object.entries(s.pawns).filter(([,pawn]) => pawn.actor === actor).map(([key]) => splitSlot(key));
    const hasOpen = r => ROW_BY_ID[r].slots.some(k => !s.pawns[k]);
    const hasPlanned = r => planned.some(slot => slot.row === r);
    const canUse = r => hasPlanned(r) || (hasOpen(r) && s.animals[actor].remaining >= 1);
    const protects = pawnCount(s,actor,'regression') + Number(actor === 'reptiles');
    const curThreats = regressionDue(s,actor).threats.length;
    const adaptation = s.animals[actor].added.length + ANIMALS[actor].affinity < 6 && canUse('adaptation') ?
      indexed(s.boxes.adaptation).filter(({type}) => !s.boxes.regression.includes(type) || s.animals[actor].added.includes(type) || protects > curThreats)
        .map(({type}) => [...s.animals[actor].added,type]) : [];
    const migration = canUse('migration') ? new Set(occupied(s,actor).flatMap(from => legalNeighbors(s,from,actor))) : new Set();
    const specCorners = Object.entries(s.corners).filter(([,type]) =>
      planned.some(slot => slot.row === 'speciation' && ELEMENT_IDS[slot.index] === type) ||
      (s.animals[actor].remaining >= 2 && ROW_BY_ID.speciation.slots.some((k,idx) => !s.pawns[k] && ELEMENT_IDS[idx] === type))
    ).flatMap(([key]) => CORNER_TILES[key]);
    const speciation = new Set(specCorners);
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
    const committed = [...options].find(([row]) => hasPlanned(row));
    const openDomSlots = ROW_BY_ID.domination.slots.filter(k => !s.pawns[k]).length;
    return {options,committed,hasDomination:hasPlanned('domination'),openDomSlots};
  });
}
function planPlacement(s, actor, cardIndex, override, duringExecution = false) {
  if (duringExecution === 'instinct') {
    const focus = override || 'dominance';
    const open = ALL_SLOTS.filter(key => !s.pawns[key]).filter(key => {
      const {row} = splitSlot(key);
      const executesNow = EXECUTION.indexOf(key) >= s.cursor;
      if (s.ending && !executesNow) return false;
      if (row === 'domination' && !executesNow) return false;
      return true;
    });
    if (!open.length) return null;
    const cache = new Map();
    const slots = open.map(key => {
      const {row,index} = splitSlot(key);
      const executesNow = EXECUTION.indexOf(key) >= s.cursor;
      const n = pawnCount(s,actor,row);
      const opportunity = fastValue(s,actor,row,index,focus,cache);
      const effOpp = executesNow ? opportunity : opportunity * .35;
      let value = Math.min(8,effOpp) * .64 - n * (row === 'domination' ? 2.25 : 1.65) - index * .08;
      if (opportunity > .12) value += .32 - FALLBACK.indexOf(row) * .018 + (executesNow ? 2.2 : 0);
      else value -= 3;
      return {slot:key,value,row,priority:-1,focus,card:null,face:false,reason:'Place in an open space.'};
    });
    return choiceBest(slots);
  }
  const card = cardIndex === null ? null : DECKS[actor][cardIndex];
  const positive = card ? checkCard(s,actor,card.check) : false;
  const face = card ? (positive ? card.yes : card.no) : null;
  const otherFace = card ? (positive ? card.no : card.yes) : null;
  const focus = override || face?.focus || 'majority';
  const open = ALL_SLOTS.filter(key => !s.pawns[key] && (!duringExecution || key !== 'initiative-0'));
  const cache = new Map();
  const setup = s.market.some(Boolean) && !duringExecution ? dominanceSetup(s,actor) : null;
  const firstOption = setup?.options?.entries()?.next()?.value;
  const canReserveFirst = setup && !setup.hasDomination && !setup.committed && firstOption && s.animals[actor].remaining >= 2 &&
    (setup.openDomSlots <= 2 || face?.rows[0] === 'domination');
  const slots = open.map(key => {
    const {row,index} = splitSlot(key);
    const n = pawnCount(s,actor,row);
    const priority = face?.rows.indexOf(row) ?? -1;
    const alternate = otherFace?.rows.includes(row);
    let opportunity = fastValue(s,actor,row,index,focus,cache);
    if (row === 'domination' && !opportunity && s.market.some(Boolean) && (setup?.committed || canReserveFirst)) opportunity = 1.65;
    if (row === 'migration' && !opportunity && pawnCount(s,actor,'speciation') && setup?.options?.has('migration')) opportunity = 1.25;
    let value = Math.min(8,opportunity) * .64 - n * (row === 'domination' ? 2.25 : 1.65) - index * .08;
    if (opportunity > .12) value += priority >= 0 ? 4.6 - priority * 1.10 : alternate ? 1.15 : .32 - FALLBACK.indexOf(row) * .018;
    else value -= 3;
    if (row === 'domination' && s.market.includes('Ice Age') && opportunity > 0) value += 1.05;
    if (row === 'domination' && index === 0 && opportunity > 0) value += .51;
    let followUp;
    if (row === 'domination' && setup?.committed && !setup.hasDomination) {
      const [earlier,tile] = setup.committed;
      followUp = 'Reserve scoring after ' + ROW_BY_ID[earlier].name + ' could open a Dominance Card at ' + tileLabel(s,tile) + '.';
    } else if (row === 'domination' && canReserveFirst) {
      const [earlier,tile] = firstOption;
      followUp = 'Reserve scoring before ' + ROW_BY_ID[earlier].name + ' sets up a Dominance Card at ' + tileLabel(s,tile) + '.';
      if (setup.openDomSlots === 1) value += 5.8;
    } else if (setup?.hasDomination && setup.options.has(row) && !n) {
      followUp = 'Set up the reserved Domination action at ' + tileLabel(s,setup.options.get(row)) + '.';
      value += .65;
    }
    if (followUp && opportunity > .12) value += 1.25;
    return {slot:key,value, row, priority, focus, card:cardIndex, face:positive,opportunity,
      reason:followUp && opportunity > .12 ? followUp : priority >= 0 && opportunity > .12 ? 'The ' + (positive ? 'primary' : 'reverse') + ' face favors ' + ROW_BY_ID[row].name + ' here.' :
        opportunity > .12 ? 'The current board favors this fallback.' : 'Place in an open space.'};
  });
  const fallback = choiceBest(slots);
  if (!duringExecution && fallback && fallback.opportunity <= 1 && fallback.value < .25) {
    const denial = blockRival(s,actor,slots);
    if (denial && (fallback.opportunity <= .12 || denial.slot !== fallback.slot)) return denial;
  }
  return fallback;
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
