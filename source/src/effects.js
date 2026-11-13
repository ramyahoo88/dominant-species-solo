function elementOptions(s) { return ELEMENT_IDS.filter(type => bagCount(s,type) > 0); }
function symbioticAnimals(s, actor) {
  const total = id => ANIMALS[id].affinity + s.animals[id].added.length;
  return s.ids.filter(id => (id === actor || total(id) < total(actor)) && total(id) < 6);
}
function icePoints(s) {
  const totals = Object.fromEntries(s.ids.map(id => [id,0]));
  for (const tile of terrainIds(s)) { const owner = cone(s,tile); if (owner) totals[owner]++; }
  return Object.fromEntries(s.ids.map(id => [id,bonus(totals[id])]));
}
function endEstimate(s, id) {
  let points = s.animals[id].vp + icePoints(s)[id];
  const trial = {...s,tiles:Object.fromEntries(terrainIds(s).map(tile => [tile,{...s.tiles[tile],cubes:{...s.tiles[tile].cubes}}]))};
  for (const actor of s.ids) {
    let saved = false;
    for (const tile of occupied(s,actor)) if (!match(s,tile,actor)) {
      const protection = s.animals[actor].ward[tile] || 0;
      const save = actor === 'mammals' && !saved && s.tiles[tile].cubes[actor] > protection;
      trial.tiles[tile].cubes[actor] = protection + Number(save);
      saved ||= save;
    }
  }
  const hold = survival(trial);
  if (hold?.actor === id) points += hold.vp;
  for (const tile of terrainIds(trial)) points += tileVP(trial,tile,id);
  return points;
}
function addPriority(s, actor, eligible, cap, total = s.animals[actor].pool, source = 'pool') {
  const ctx = context(s,actor,'growth');
  const choices = eligible.map(tile => {
    const upTo = Math.min(cap,total);
    const options = Array.from({length:upTo+1},(_,n) => ({n,value:changeCubes(s,tile,actor,n,ctx) - .09*n}));
    return {tile,options, best:choiceBest(options)};
  }).sort((a,b) => b.best.value - a.best.value);
  const add = {};
  let value = 0;
  for (const item of choices) {
    const best = choiceBest(item.options.filter(o => o.n <= total));
    if (!best.n) continue;
    add[item.tile] = best.n;
    total -= best.n;
    value += best.value;
  }
  const label = source === 'dead' ? addLabel(s,add).replace('Add ','Return ') : addLabel(s,add);
  return {add,value,label};
}
function scoreCardPoints(s, actor, card, scoredTile, fertileTile = null) {
  if (card === 'Biodiversity') return occupied(s,actor).filter(tile => s.ids.some(id => id !== actor && s.tiles[tile].cubes[id])).length;
  if (card === 'Ecodiversity') {
    const needs = [ANIMALS[actor].el,...s.animals[actor].added];
    return Object.values(s.corners).filter(type => needs.includes(type)).length;
  }
  if (card === 'Fertile') return fertileTile ? sum(Object.values(s.tiles[fertileTile].cubes)) : Math.max(0,...occupied(s,actor).map(tile => sum(Object.values(s.tiles[tile].cubes))));
  if (card === 'Niche Biomes') return (scoredTile ? TERRAIN[s.tiles[scoredTile].terrain].vp[0] : 5) * s.ids.filter(id => s.animals[id].vp > s.animals[actor].vp).length;
  return 0;
}
function elimination(s, tile, ids, ctx) {
  return choiceBest(ids.filter(id => s.tiles[tile].cubes[id]).map(victim => ({
    tile,victim,value:changeCubes(s,tile,victim,-1,ctx) + (victim === ctx.actor ? -.25 : .25 * ctx.rival[victim]),
  })));
}
function chooseMassExodus(s, actor, tile, ctx) {
  const moves = {};
  let value = 0;
  const nearby = legalNeighbors(s,tile,actor,1);
  const before = utility(s,tile,ctx) + sum(nearby.map(t => utility(s,t,ctx)));
  for (const id of s.ids) {
    const n = s.tiles[tile].cubes[id];
    if (!n) continue;
    const best = choiceBest(nearby.map(to => ({to,value:changeCubes(s,to,id,n,ctx)})));
    moves[id] = [{from:tile,to:best.to,n}];
    s.tiles[tile].cubes[id] -= n;
    s.tiles[best.to].cubes[id] += n;
  }
  value = utility(s,tile,ctx) + sum(nearby.map(t => utility(s,t,ctx))) - before;
  for (const [id,group] of Object.entries(moves)) for (const {from,to,n} of group) { s.tiles[from].cubes[id] += n; s.tiles[to].cubes[id] -= n; }
  return {tile,moves,value,label:Object.entries(moves).map(([id,group]) => nameOf(id) + ' · ' + moveLabel(s,group)).join(' ')};
}
function chooseImmigrant(s, actor) {
  const choices = [];
  const elements = s.animals[actor].added;
  const ctx = context(s,actor,'conserve');
  for (const type of unique(elements)) {
    const left = [...elements]; left.splice(left.indexOf(type),1);
    choices.push({mode:'element',type,value:changeElements(s,actor,left,ctx) - .28,label:'Discard one added ' + elementName(type) + ' from the animal display.'});
  }
  if (s.animals[actor].ap > 0) {
    const from = ALL_SLOTS.filter(key => s.pawns[key]?.actor === actor).at(-1);
    const slot = s.animals[actor].ap > pawnCount(s,actor) ? null : from;
    choices.push({mode:'pawn',slot,value:-3.1,label:'Lose one action pawn' + (slot ? ' from ' + slotLabel(slot) : ' from the available supply') + '.'});
  }
  const loss = sum(occupied(s,actor).map(tile => changeCubes(s,tile,actor,1 - s.tiles[tile].cubes[actor],ctx) - .12 * (s.tiles[tile].cubes[actor] - 1)));
  choices.push({mode:'cubes',value:loss,label:'On every occupied tile, eliminate all but one of this animal’s cubes.'});
  return choiceBest(choices);
}
function immigrantChoice(s, actor, choice) {
  if (choice.mode === 'element') discardElement(s,actor,choice.type);
  if (choice.mode === 'pawn') {
    s.animals[actor].ap--;
    if (choice.slot) delete s.pawns[choice.slot];
  }
  if (choice.mode === 'cubes') for (const tile of occupied(s,actor)) removeCube(s,tile,actor,s.tiles[tile].cubes[actor]-1);
}
function chooseEffect(s, step) {
  const {actor,name,tile:scoredTile} = step;
  const ctx = context(s,actor,step.focus || 'majority');
  const me = s.animals[actor];
  const others = s.ids.filter(id => id !== actor);
  const land = terrainIds(s);
  const types = ['Habitat','Aquatic','Metamorphosis'].includes(name) ? elementOptions(s) : [];
  let best;
  switch (name) {
    case 'Aquatic': {
      const wet = land.filter(tile => ['sea','wetland'].includes(s.tiles[tile].terrain));
      const withSpace = wet.filter(tile => VERTICES_OF[tile].some(key => !s.corners[key]));
      best = choiceBest((types.length && withSpace.length ? withSpace : wet).flatMap(tile => {
        const empty = VERTICES_OF[tile].filter(key => !s.corners[key]);
        const options = empty.length && types.length ? empty.flatMap(corner => types.map(type => ({corner,type}))) : [{corner:null,type:null}];
        return options.map(({corner,type}) => {
          const gain = type ? cornerGain(s,corner,type,ctx) : 0;
          if (type) s.corners[corner] = type;
          const growth = addPriority(s,actor,[tile],4);
          if (type) delete s.corners[corner];
          const label = (type ? 'Take ' + elementName(type) + ' from the bag and place it at corner ' + cornerIndex(tile,corner) + ' of ' + tileLabel(s,tile) + '. ' : '') + growth.label;
          return {tile,corner,type,n:growth.add[tile] || 0,value:gain + growth.value,label};
        });
      }));
      break;
    }
    case 'Biodiversity':
    case 'Ecodiversity': {
      const vp = scoreCardPoints(s,actor,name,scoredTile);
      return {value:vp,label:'Gain ' + vp + ' VP.'};
    }
    case 'Biomass': {
      const hits = land.filter(tile => sum(Object.values(s.tiles[tile].cubes)) > VERTICES_OF[tile].filter(key => s.corners[key]).length)
        .map(tile => elimination(s,tile,s.ids,ctx)).filter(Boolean);
      return {hits,value:sum(hits.map(hit => hit.value)),label:hits.length ? hitLabel(s,hits) : 'No tiles exceed their element count.'};
    }
    case 'Blight':
      best = choiceBest(land.flatMap(tile => {
        const disks = VERTICES_OF[tile].filter(key => s.corners[key]);
        return disks.length > 1 ? disks.map(keep => {
          const remove = disks.filter(key => key !== keep);
          const stored = remove.map(key => [key,s.corners[key]]);
          const value = delta(s,unique(disks.flatMap(key => CORNER_TILES[key])),ctx,
            () => { for (const key of remove) delete s.corners[key]; }, () => { for (const [key,type] of stored) s.corners[key] = type; });
          return {tile,keep,value,label:'On ' + tileLabel(s,tile) + ', keep ' + elementName(s.corners[keep]) + ' at corner ' + cornerIndex(tile,keep) + ' and remove the other disks.'};
        }) : [];
      }));
      break;
    case 'Catastrophe':
      best = choiceBest(land.flatMap(tile => {
        const onTile = s.ids.filter(id => s.tiles[tile].cubes[id]);
        const hasNearby = NEIGHBORS[tile].some(t => s.tiles[t] && s.ids.some(id => s.tiles[t].cubes[id]));
        const keepOptions = onTile.length ? onTile : hasNearby ? [null] : [];
        return keepOptions.map(keep => {
        const cubes = s.tiles[tile].cubes;
        const old = {...cubes};
        const center = delta(s,[tile],ctx,() => { for (const id of s.ids) cubes[id] = Number(id === keep); },
          () => { Object.assign(cubes,old); });
        const hits = NEIGHBORS[tile].filter(id => s.tiles[id]).map(id => elimination(s,id,s.ids,ctx)).filter(Boolean);
        return {tile,keep,hits,value:center + sum(hits.map(hit => hit.value)),
          label:(keep ? 'Leave one ' + nameOf(keep) + ' cube at ' + tileLabel(s,tile) + ' and eliminate all other cubes there. ' : 'Target ' + tileLabel(s,tile) + '. ') + (hits.length ? hitLabel(s,hits) : '')};
        });
      }));
      break;
    case 'Cold Snap': {
      const hits = land.filter(tile => s.tiles[tile].terrain === 'tundra').flatMap(tile => others.filter(id => s.tiles[tile].cubes[id]).map(victim => ({tile,victim,value:hitValue(s,tile,victim,ctx)})));
      return {hits,value:sum(hits.map(hit => hit.value)),label:hits.length ? hitLabel(s,hits) : 'No opposing cubes are on tundra.'};
    }
    case 'Disease': {
      const victims = s.ids.filter(id => s.animals[id].added.length && s.animals[id].added.length + ANIMALS[id].affinity > me.added.length + ANIMALS[actor].affinity);
      return {victims,value:1.7*victims.length,label:victims.length ? victims.map(nameOf).join(', ') + ' each choose one added element to lose.' : 'No animal must lose an element.'};
    }
    case 'Evolution': {
      const hits = others.map(victim => choiceBest(occupied(s,victim).map(tile => ({
        tile,victim,value:delta(s,[tile],ctx,() => { s.tiles[tile].cubes[actor]++; s.tiles[tile].cubes[victim]--; },
          () => { s.tiles[tile].cubes[actor]--; s.tiles[tile].cubes[victim]++; }),
      })))).filter(hit => hit && hit.value > 0).sort((a,b) => b.value-a.value).slice(0,me.pool);
      return {hits,value:sum(hits.map(hit => hit.value)),label:hits.length ? hits.map(h => 'Replace one ' + nameOf(h.victim) + ' cube with your cube at ' + tileLabel(s,h.tile)).join('; ') + '.' : 'Replace no cubes.'};
    }
    case 'Fecundity': return addPriority(s,actor,occupied(s,actor),1);
    case 'Fertile':
      best = choiceBest(occupied(s,actor).map(tile => { const vp = scoreCardPoints(s,actor,name,scoredTile,tile); return {tile,value:vp,label:'Gain ' + vp + ' VP for the cubes at ' + tileLabel(s,tile) + '.'}; }));
      break;
    case 'Habitat':
      best = choiceBest(activeCorners(s).filter(key => !s.corners[key]).flatMap(corner => types.map(type => ({
        corner,type,value:cornerGain(s,corner,type,ctx),
        label:'Take ' + elementName(type) + ' from the bag and place it at the corner shared by ' + cornerLabel(s,corner) + '.',
      }))));
      break;
    case 'Hibernation':
      best = choiceBest(land.map(tile => {
        const n = Math.min(5,me.dead);
        const ward = me.ward[tile] || 0;
        me.ward[tile] = ward + n;
        const value = changeCubes(s,tile,actor,n,ctx) + (n && !match(s,tile,actor) ? .30*n : 0);
        if (ward) me.ward[tile] = ward; else delete me.ward[tile];
        return {tile,n,value,label:n ? 'Return ' + n + ' eliminated cubes to ' + tileLabel(s,tile) + '. These cubes are safe from Extinction this turn.' : 'There are no eliminated cubes to return.'};
      }));
      break;
    case 'Ice Age': {
      const points = icePoints(s);
      return {value:0,label:s.ids.map(id => nameOf(id) + ' ' + signed(points[id]) + ' VP').join(' · ') + '. Finish this turn, then score every tile.'};
    }
    case 'Ice Sheet':
      best = glaciationChoice(s,actor,step.focus);
      break;
    case 'Immigrants':
      return {value:chooseImmigrant(s,actor).value * .65 - sum(others.map(id => chooseImmigrant(s,id).value * ctx.rival[id])),
        label:'Each animal chooses its loss in food-chain order.'};
    case 'Instinct': {
      const slot = me.ap > pawnCount(s,actor) ? planPlacement(s,actor,null,step.focus)?.slot : null;
      return {slot,value:slot ? 2.9 : 0,label:slot ? 'Place an available pawn at ' + slotLabel(slot) + '.' : 'No available action pawn or vacant space.'};
    }
    case 'Intelligence':
    case 'Omnivore':
    case 'Parasitism': {
      const recipients = s.ids.filter(id => s.animals[id].ap < 10 && (id === actor || (name === 'Intelligence' ? rank(id) < rank(actor) : name === 'Parasitism' && rank(id) > rank(actor))));
      return {recipients,value:sum(recipients.map(id => id === actor ? 6 : -5*ctx.rival[id])),
        label:recipients.length ? recipients.map(nameOf).join(', ') + ' each gain one action pawn.' : 'No action pawns are gained.'};
    }
    case 'Mass Exodus':
      best = choiceBest(land.filter(tile => NEIGHBORS[tile].some(id => s.tiles[id]) && s.ids.some(id => s.tiles[tile].cubes[id])).map(tile => chooseMassExodus(s,actor,tile,ctx)));
      break;
    case 'Metamorphosis':
      best = choiceBest(unique(me.added).flatMap(out => types.map(type => {
        const add = [...me.added]; add.splice(add.indexOf(out),1,type);
        return {out,type,value:changeElements(s,actor,add,ctx),label:'Swap one added ' + elementName(out) + ' for ' + elementName(type) + ' from the bag.'};
      })));
      break;
    case 'Niche Biomes': {
      const vp = TERRAIN[s.tiles[scoredTile].terrain].vp[0];
      const victims = others.filter(id => s.animals[id].vp > me.vp);
      return {victims,vp,value:sum(victims.map(id => Math.min(vp,s.animals[id].vp) * ctx.rival[id])),
        label:victims.length ? victims.map(nameOf).join(', ') + ' lose ' + vp + ' VP each.' : 'No rival has a higher score.'};
    }
    case 'Nocturnal':
      return {value:s.initiative[0] === actor ? 0 : 1.8,label:'Advance one space on the Initiative track if possible.'};
    case 'Predator': {
      const hits = occupied(s,actor).map(tile => elimination(s,tile,others,ctx)).filter(Boolean);
      return {hits,value:sum(hits.map(hit => hit.value)),label:hits.length ? hitLabel(s,hits) : 'No opposing cubes share a tile with this animal.'};
    }
    case 'Symbiotic':
      return {value:sum(symbioticAnimals(s,actor).map(id => id === actor ? 2.1 : -ctx.rival[id]*1.7)),
        label:'Draw one random element from the physical bag for ' + (symbioticAnimals(s,actor).map(nameOf).join(', ') || 'no animals') + '.'};
    default: throw new Error('Unrecognized Dominance Card.');
  }
  return best ?? {skip:true,value:0,label:'This card has no legal target.'};
}
function pickEffect(s,step) { return chooseEffect(s,step); }
function cardValue(s, actor, name, tile, quick = false) {
  if (name === 'Ice Age') {
    if (quick) return s.animals[actor].vp >= Math.max(...s.ids.map(id => s.animals[id].vp)) ? 5 : .6;
    const own = endEstimate(s,actor);
    const margin = own - Math.max(...s.ids.filter(id => id !== actor).map(id => endEstimate(s,id)));
    return margin >= 0 ? 7 + Math.min(5,margin*.25) : -Math.min(4,Math.abs(margin)*.35);
  }
  if (['Biodiversity','Ecodiversity','Fertile','Niche Biomes'].includes(name)) return scoreCardPoints(s,actor,name,tile);
  if (quick || !tile) {
    const land = occupied(s,actor);
    const contested = land.filter(h => s.ids.some(id => id !== actor && s.tiles[h].cubes[id])).length;
    const values = {
      Aquatic:s.animals[actor].pool > 0 ? 3.2 : 1, Biomass:1.3, Blight:2.2, Catastrophe:3.4,
      'Cold Snap':sum(s.ids.filter(id => id !== actor).map(id => tundraCounts(s,id)[1])) * .8,
      Disease:1.3, Evolution:s.animals[actor].pool ? 3.5 : 0, Fecundity:Math.min(4,land.length,s.animals[actor].pool),
      Habitat:2.6, Hibernation:Math.min(5,s.animals[actor].dead)*.85, 'Ice Sheet':glazeTargets(s).length ? 3.4 : 0,
      Immigrants:1.5, Instinct:2.4, Intelligence:rank(actor) < 2 ? 5 : 3, 'Mass Exodus':2.7,
      Metamorphosis:s.animals[actor].added.length ? 2.0 : 0, Nocturnal:s.initiative[0] === actor ? 0 : 1.6,
      Omnivore:s.animals[actor].ap < 10 ? 5.5 : 0, Parasitism:rank(actor) > 3 ? 5 : 3, Predator:contested*1.2, Symbiotic:2.0,
    };
    return values[name] ?? 0;
  }
  const value = chooseEffect(s,{name,actor,tile,focus:'majority'}).value;
  return Math.max(-6,Math.min(11,value));
}
function resolveEffect(s, step, choice) {
  const {actor,name,tile:scoredTile} = step;
  if (choice.skip) { note(s,name,choice.label,actor); return; }
  switch (name) {
    case 'Aquatic':
      if (choice.type) s.corners[choice.corner] = choice.type;
      if (choice.n) addCube(s,choice.tile,actor,choice.n);
      break;
    case 'Biodiversity':
    case 'Ecodiversity':
    case 'Fertile':
      earned(s,actor,scoreCardPoints(s,actor,name,scoredTile,choice.tile));
      break;
    case 'Biomass':
    case 'Cold Snap':
    case 'Predator':
      for (const h of choice.hits) removeCube(s,h.tile,h.victim,1);
      break;
    case 'Blight':
      for (const key of VERTICES_OF[choice.tile]) if (key !== choice.keep) delete s.corners[key];
      break;
    case 'Catastrophe':
      for (const id of s.ids) removeCube(s,choice.tile,id,s.tiles[choice.tile].cubes[id] - Number(id === choice.keep));
      for (const h of choice.hits) removeCube(s,h.tile,h.victim,1);
      break;
    case 'Disease':
      s.pending.unshift(...choice.victims.map(id => ({kind:'loss',actor:id,source:'Disease',due:{threats:unique(s.animals[id].added),drops:1}})));
      break;
    case 'Evolution':
      for (const h of choice.hits) { removeCube(s,h.tile,h.victim,1); addCube(s,h.tile,actor,1); }
      break;
    case 'Fecundity':
      for (const [tile,n] of Object.entries(choice.add)) addCube(s,tile,actor,n);
      break;
    case 'Habitat':
      s.corners[choice.corner] = choice.type;
      break;
    case 'Hibernation':
      if (choice.n) {
        addCube(s,choice.tile,actor,choice.n,'dead');
        const ward = s.animals[actor].ward;
        ward[choice.tile] = (ward[choice.tile] || 0) + choice.n;
      }
      break;
    case 'Ice Age':
      for (const [id,vp] of Object.entries(icePoints(s))) earned(s,id,vp);
      s.ending = true;
      break;
    case 'Ice Sheet':
      if (choice.tile) choice.label = glaciation(s,actor,choice.tile);
      break;
    case 'Immigrants':
      s.pending.unshift(...s.ids.map(id => ({kind:'immigrant',actor:id})));
      break;
    case 'Instinct':
      if (choice.slot) s.pawns[choice.slot] = {actor,card:null,focus:step.focus};
      break;
    case 'Intelligence':
    case 'Omnivore':
    case 'Parasitism':
      for (const id of choice.recipients) s.animals[id].ap++;
      break;
    case 'Mass Exodus':
      for (const [id,moves] of Object.entries(choice.moves)) moveGroups(s,id,moves);
      break;
    case 'Metamorphosis':
      discardElement(s,actor,choice.out);
      s.animals[actor].added.push(choice.type);
      break;
    case 'Niche Biomes':
      for (const id of choice.victims) earned(s,id,-choice.vp);
      break;
    case 'Nocturnal': {
      const at = s.initiative.indexOf(actor);
      if (at > 0) [s.initiative[at-1],s.initiative[at]] = [s.initiative[at],s.initiative[at-1]];
      break;
    }
    case 'Symbiotic': {
      const recipients = symbioticAnimals(s,actor);
      if (recipients.length && elementOptions(s).length) s.pending.unshift({kind:'symbiosis',actor,recipients});
      break;
    }
    default: throw new Error('Unrecognized Dominance Card.');
  }
  note(s,name,choice.label,actor);
}
