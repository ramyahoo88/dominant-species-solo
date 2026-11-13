function fields(content, columns = '') { return '<div class="fields ' + columns + '">' + content + '</div>'; }
function cornersFor(ids) { return ids.map(key => [key,cornerName(key)]); }
function cornerName(key) {
  const tile = CORNER_TILES[key].find(id => game.tiles[id]);
  return cornerLabel(game,key) + ' · ' + tile + ' corner ' + cornerIndex(tile,key);
}
function offer(row) {
  return indexed(game.boxes[row]).map(({type,pick}) => [String(pick),elementName(type) + ' · position ' + (pick+1)]);
}
function noChoice(text, canPass = false) {
  return '<p class="lead">' + esc(text) + '</p>' + form('','action','Continue',canPass);
}
function tilePick(name, ids, label = 'Tile', none = null) { return field(label,select(name,T(ids),none === null,none)); }
function remainingCorners(tile) { return VERTICES_OF[tile].filter(key => !game.corners[key]); }
function stepChoices(step) {
  const {row,index,actor} = step;
  if (row === 'initiative') return ALL_SLOTS.filter(key => !game.pawns[key] && key !== 'initiative-0');
  if (row === 'depletion' || row === 'speciation' || row === 'domination') return placementTargets(game,row,index,actor);
  if (row === 'glaciation') return glazeTargets(game);
  return [];
}
function playerForm(step) {
  const {actor,row,index,kind,tile} = step;
  if (kind === 'pawn') return pawnForm(step);
  if (kind === 'effect') return effectForm(step);
  if (kind === 'immigrant') return immigrantForm(step);
  if (kind === 'claim') return form(field('Take a card',select('claim',availableCards(game))),'action','Take card');
  if (kind === 'insect') return form(tilePick('tile',terrainIds(game)),'action','Add one cube',true);
  if (kind === 'spider') return hitForm(step,true);
  if (kind === 'arrival') {
    const destinations = NEIGHBORS[tile].filter(id => game.tiles[id]?.cubes[actor]);
    return form(fields(destinations.map(from=>field('From ' + tileLabel(game,from),intInput('from-'+from,game.tiles[from].cubes[actor]))).join(''),'two'),
      'action','Confirm arrival');
  }
  if (kind === 'loss') return form(lossFields(step.due.threats),'action','Remove selected elements');
  if (kind === 'extinction') {
    const tiles = actor ? extinctionOptions(game,actor) : [];
    if (!tiles.length) return form('','action','Review Extinction and Survival');
    return form(tilePick('saveCube',tiles,'Save one endangered Mammal cube','Save none'),'action','Review Extinction and Survival');
  }
  if (kind === 'symbiosis') {
    const choices = elementOptions(game);
    return form(fields(step.recipients.map(id => field(nameOf(id),select('sym-'+id,E(choices),false,'Bag empty or choose…'))).join(''),'two'),
      'action','Enter physical draws');
  }
  return noChoice('Continue with the next action.');
}
function pawnForm(step) {
  const {row,actor,index} = step;
  const targets = stepChoices(step);
  const mine = game.animals[actor];
  let body = '';
  switch (row) {
    case 'initiative':
      if (!targets.length) return noChoice('All other spaces are occupied.');
      body = field('Move the pawn to',select('slot',targets.map(key=>[key,slotLabel(key)])));
      break;
    case 'adaptation':
      if (!offer(row).length || mine.added.length + ANIMALS[actor].affinity >= 6) return noChoice('There is no available element or room for another.');
      body = field('Element',select('pick',offer(row)));
      break;
    case 'regression':
      return noChoice('Regression protection was applied when element losses were determined.');
    case 'abundance': {
      const corners = activeCorners(game).filter(key => !game.corners[key]);
      if (!offer(row).length || !corners.length) return noChoice('There is no element or vacant corner to use.');
      body = fields(field('Element',select('pick',offer(row))) + field('Vacant corner',select('corner',cornersFor(corners))));
      break;
    }
    case 'wasteland':
      if (!offer(row).length) return noChoice('The Wasteland box is empty.');
      body = field('Disk to take out of the box',select('pick',offer(row)));
      break;
    case 'depletion':
      if (!targets.length) return noChoice('There is no matching disk on Earth.');
      body = field('Remove from Earth',select('corner',targets.map(key => [key,elementName(game.corners[key]) + ' · ' + cornerName(key)])));
      break;
    case 'glaciation':
      if (!targets.length) return noChoice('There is no eligible tile or tundra remaining.');
      body = tilePick('tile',targets,'Cover with tundra');
      if (draft.tile) {
        const trial = copy(game);
        body += '<div class="result-box"><strong>Apply on your board</strong><p>' + esc(glaciation(trial,actor,draft.tile)) + '</p></div>';
      }
      break;
    case 'speciation': {
      if (!targets.length || !mine.pool) return noChoice('There is no eligible element or gene-pool cube.');
      body = field('Element corner',select('corner',cornersFor(targets)));
      if (draft.corner) {
        let rem = mine.pool;
        body += fields(CORNER_TILES[draft.corner].filter(id=>game.tiles[id]).map(id=>{
          const cap = Math.min(mine.pool,TERRAIN[game.tiles[id].terrain].cap);
          const def = Math.min(rem,cap);
          rem -= def;
          return field(tileLabel(game,id),intInput('add-'+id,cap,def));
        }).join(''),'three');
      }
      break;
    }
    case 'wanderlust': {
      const tiles = frontTiles(game);
      const stacks = game.stacks.flatMap((x,i)=>x.face ? [[String(i), 'Stack ' + (i+1) + ' · ' + terrainName(x.face)]] : []);
      if (!tiles.length || !stacks.length) return noChoice('There is no face-up tile or vacant space next to Earth.');
      body = fields(field('Face-up tile',select('stack',stacks)) + tilePick('tile',tiles,'Place the tile at'),'two');
      if (draft.tile) {
        const openCorners = remainingCorners(draft.tile);
        if (openCorners.length) {
          body += field('Optional element',select('pick',offer('wanderlust'),false,'Place no element'));
          if (draft.pick !== '' && draft.pick !== undefined) body += field('Corner',select('corner',
            openCorners.map(key=>[key,'Corner '+cornerIndex(draft.tile,key)+(CORNER_TILES[key].some(id=>game.tiles[id]) ? ' · ' + cornerLabel(game,key) : '')])));
        }
      }
      break;
    }
    case 'migration': return migrationForm(step);
    case 'competition': return hitForm(step);
    case 'domination': {
      const tiles = terrainIds(game).filter(id => !game.scored.includes(id));
      if (!tiles.length) return noChoice('Every tile has been scored this turn.');
      body = tilePick('tile',tiles,'Score a tile');
      if (draft.tile) {
        const t = draft.tile;
        const c = cone(game,t);
        const points = tileScores(game,t).map(([id,vp])=>nameOf(id)+' +' + vp + ' VP').join(' · ');
        body += '<div class="result-box"><strong>' + esc(points || 'No VP') + '</strong><p>' +
          (c && availableCards(game).length ? nameOf(c) + ' choose a Dominance Card.' : 'No Dominance Card is taken.') + '</p></div>';
      }
      break;
    }
  }
  return form(body,'action','Confirm ' + ROW_BY_ID[row].name,true);
}
function hitOptions(step, type) {
  const types = type ? [type] : [...LARGE_TERRAIN,'tundra'];
  return competitionChoices(game,step.actor,types).map(h=>[h.tile + ':' + h.victim,tileLabel(game,h.tile) + ' · ' + nameOf(h.victim)]);
}
function hitForm(step, free = false) {
  const groups = free ? [null] : ['tundra',COMPETITION_EDGES[step.index],COMPETITION_EDGES[step.index+1]];
  const boxes = groups.map(type => {
    const options = hitOptions(step,type);
    return options.length ? field(type ? terrainName(type) : 'Eligible tiles',select('hit-'+(type || 'any'),options,false,'Remove no cube')) : '';
  }).join('');
  if (!boxes) return noChoice('There is no eligible shared tile.');
  return form(fields(boxes),'action','Confirm Competition',true);
}
function lossFields(types) {
  return '<div class="choice-grid">' + types.map(type => '<label class="checked"><input type="checkbox" name="loss-'+type+'"> ' + elementName(type) + '</label>').join('') + '</div>';
}
function migrationForm(step) {
  const origins = occupied(game,step.actor).filter(id=>legalNeighbors(game,id,step.actor).length);
  if (!origins.length) return noChoice('There are no cubes with a legal move.');
  const moves = draft.moves || [];
  const remaining = 7 - step.index - sum(moves.map(m=>m.n));
  const canAdd = remaining > 0;
  const to = draft.origin ? legalNeighbors(game,draft.origin,step.actor) : [];
  const max = draft.origin ? Math.min(remaining,game.tiles[draft.origin].cubes[step.actor] - sum(moves.filter(m=>m.from === draft.origin).map(m=>m.n))) : remaining;
  const list = moves.map((m,i)=>'<div class="move-line"><span>' + esc(moveLabel(game,[m])) + '</span>' +
    button('Remove','remove-move','sm subtle','data-index="'+i+'" aria-label="Remove move ' + (i+1) + '"') + '</div>').join('');
  return form('<p class="lead">' + remaining + ' of ' + (7-step.index) + ' moves left.</p>' + list +
    (canAdd ? fields(tilePick('origin',origins.filter(id=>game.tiles[id].cubes[step.actor] > sum(moves.filter(m=>m.from===id).map(m=>m.n))),'From') +
      (to.length ? tilePick('destination',to,'To') + field('Cubes',intInput('quantity',max,1)) : ''),'three') +
      button('Add move','add-move','sm',enable(!!(draft.origin && draft.destination && max))) : ''),
      'action',moves.length ? 'Confirm Migration' : 'Finish Migration',true);
}
function immigrantForm(step) {
  const a = game.animals[step.actor];
  const modes = [['cubes','Keep at most one cube per tile']];
  if (a.added.length) modes.unshift(['element','Lose one added element']);
  if (a.ap) modes.unshift(['pawn','Lose one action pawn']);
  const slots = ALL_SLOTS.filter(key=>game.pawns[key]?.actor === step.actor);
  const body = field('Choose a penalty',select('mode',modes)) +
    (draft.mode === 'element' ? field('Added element',select('type',E(unique(a.added)))) : '') +
    (draft.mode === 'pawn' && slots.length ? field('Pawn',select('slot',slots.map(key=>[key,slotLabel(key)]),a.ap === slots.length,a.ap > slots.length ? 'From available pawns' : null)) : '');
  return form(fields(body),'action','Apply penalty');
}
function eligibleEffectTiles(step) {
  const {name,actor} = step;
  if (name === 'Aquatic') return terrainIds(game).filter(id=>['sea','wetland'].includes(game.tiles[id].terrain));
  if (name === 'Fertile') return occupied(game,actor);
  if (name === 'Ice Sheet') return glazeTargets(game);
  if (name === 'Blight') return terrainIds(game).filter(id=>VERTICES_OF[id].filter(key=>game.corners[key]).length>1);
  if (name === 'Mass Exodus') return terrainIds(game).filter(id=>game.ids.some(a=>game.tiles[id].cubes[a]) && NEIGHBORS[id].some(t=>game.tiles[t]));
  if (name === 'Catastrophe') return terrainIds(game).filter(id=>game.ids.some(a=>game.tiles[id].cubes[a] || NEIGHBORS[id].some(t=>game.tiles[t]?.cubes[a])));
  return terrainIds(game);
}
function effectForm(step) {
  const {name,actor} = step;
  const a = game.animals[actor];
  const auto = ['Biodiversity','Cold Snap','Disease','Ecodiversity','Ice Age','Immigrants','Intelligence','Niche Biomes','Nocturnal','Omnivore','Parasitism','Symbiotic'];
  if (auto.includes(name)) return form('<div class="result-box"><strong>Apply on your board</strong><p>' + esc(chooseEffect(game,step).label) +
    '</p></div>','action','Apply ' + name);
  const tile = draft.tile;
  let body = '';
  switch (name) {
    case 'Aquatic': {
      const eligible = eligibleEffectTiles(step);
      if (!eligible.length) return noChoice('Earth has no sea or wetland tile.');
      const vacant = eligible.filter(id=>remainingCorners(id).length);
      const types = elementOptions(game);
      const options = types.length && vacant.length ? vacant : eligible;
      body = tilePick('tile',options,'Sea or wetland tile');
      if (tile) body += fields((types.length && remainingCorners(tile).length ?
        field('Element from bag',select('type',E(types))) +
        field('Corner',select('corner',remainingCorners(tile).map(key=>[key,'Corner '+cornerIndex(tile,key)]))) : '') +
        field('Cubes to add',intInput('n',Math.min(4,a.pool))),'three');
      break;
    }
    case 'Biomass':
    case 'Predator': {
      const tiles = name === 'Biomass' ?
        terrainIds(game).filter(id=>sum(Object.values(game.tiles[id].cubes))>VERTICES_OF[id].filter(key=>game.corners[key]).length) :
        occupied(game,actor).filter(id=>game.ids.some(a=>a!==actor && game.tiles[id].cubes[a]));
      if (!tiles.length) return noChoice('There are no eligible cubes to remove.');
      body = fields(tiles.map(id=>field(tileLabel(game,id),select('victim-'+id,A(game.ids.filter(a=>game.tiles[id].cubes[a] && (name==='Biomass'||a!==actor)))))).join(''),'two');
      break;
    }
    case 'Blight':
    case 'Catastrophe':
    case 'Fertile':
    case 'Ice Sheet':
    case 'Mass Exodus': {
      const tiles = eligibleEffectTiles(step);
      if (!tiles.length) return noChoice('There is no eligible tile.');
      body = tilePick('tile',tiles);
      if (!tile) break;
      if (name === 'Blight') body += field('Keep this disk',select('keep',VERTICES_OF[tile].filter(key=>game.corners[key]).map(key=>[
        key,elementName(game.corners[key])+' · corner '+cornerIndex(tile,key)])));
      if (name === 'Catastrophe') {
        const nearby = NEIGHBORS[tile].filter(t=>game.tiles[t] && game.ids.some(id=>game.tiles[t].cubes[id]));
        const center = game.ids.filter(id=>game.tiles[tile].cubes[id]);
        body += (center.length ? field('Keep one cube belonging to',select('keep',A(center))) : '') +
          fields(nearby.map(id=>field('Remove one at ' + tileLabel(game,id),select('victim-'+id,A(game.ids.filter(a=>game.tiles[id].cubes[a]))))).join(''),'two');
      }
      if (name === 'Fertile') body += '<p class="lead">' + scoreCardPoints(game,actor,name,step.tile,tile) + ' VP.</p>';
      if (name === 'Ice Sheet') { const trial=copy(game); body += '<p class="lead">' + esc(glaciation(trial,actor,tile)) + '</p>'; }
      if (name === 'Mass Exodus') {
        body += game.ids.filter(id=>game.tiles[tile].cubes[id]).map(id=>'<fieldset><legend>' + nameOf(id) + ' · distribute ' + game.tiles[tile].cubes[id] +
          '</legend>' + fields(NEIGHBORS[tile].filter(to=>game.tiles[to]).map(to=>field(tileLabel(game,to),intInput('mass-'+id+'-'+to,game.tiles[tile].cubes[id]))).join(''),'three') + '</fieldset>').join('');
      }
      break;
    }
    case 'Evolution':
      if (!a.pool) return noChoice('The gene pool is empty.');
      body = fields(game.ids.filter(id=>id!==actor && occupied(game,id).length).map(id=>tilePick('evo-'+id,occupied(game,id),'Replace one ' + nameOf(id) + ' cube','Skip this animal')).join(''),'two');
      break;
    case 'Fecundity':
      if (!a.pool || !occupied(game,actor).length) return noChoice('There are no eligible tiles or cubes.');
      body = '<div class="choice-grid">' + occupied(game,actor).map((id,idx)=>'<label class="checked"><input type="checkbox" name="grow-'+id+'"'+(idx<a.pool?' checked':'')+'> ' + tileLabel(game,id) + '</label>').join('') + '</div>';
      break;
    case 'Habitat':
      if (!elementOptions(game).length || !activeCorners(game).some(key=>!game.corners[key])) return noChoice('There is no available disk or vacant corner.');
      body = fields(field('Element from the bag',select('type',E(elementOptions(game)))) +
        field('Vacant corner',select('corner',cornersFor(activeCorners(game).filter(key=>!game.corners[key])))));
      break;
    case 'Hibernation':
      if (!a.dead) return noChoice('There are no eliminated cubes to return.');
      body = fields(tilePick('tile',terrainIds(game)) + field('Eliminated cubes to return',intInput('n',Math.min(5,a.dead),Math.min(5,a.dead))),'two');
      break;
    case 'Instinct': {
      const slots = ALL_SLOTS.filter(key=>!game.pawns[key]);
      if (a.ap <= pawnCount(game,actor) || !slots.length) return noChoice('There is no available pawn or vacant space.');
      body = field('Place an available pawn',select('slot',slots.map(key=>[key,slotLabel(key) + (EXECUTION.indexOf(key) >= game.cursor ? ' · This turn' : ' · Next turn')])));
      break;
    }
    case 'Metamorphosis':
      if (!a.added.length || !elementOptions(game).length) return noChoice('There is no added element to exchange or disk in the bag.');
      body = fields(field('Remove from animal display',select('out',E(unique(a.added)))) + field('Take from bag',select('type',E(elementOptions(game)))),'two');
      break;
  }
  return form(body,'action','Apply ' + name);
}
function selectedNumber(data,key) {
  const raw = data.get(key);
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (!num(n)) throw new Error('Use a whole number of cubes.');
  return n;
}
function makePlayerChoice(step, data) {
  const {kind,actor,tile} = step;
  const val = key => data.get(key) || null;
  if (kind === 'pawn') return makePawnChoice(step,data);
  if (kind === 'effect') return makeEffectChoice(step,data);
  if (kind === 'claim') return {card:val('claim'),label:'Take ' + val('claim') + '.'};
  if (kind === 'insect') return {tile:val('tile'),label:addLabel(game,{[val('tile')]:1})};
  if (kind === 'spider') return makeHits(data);
  if (kind === 'arrival') {
    const moves = NEIGHBORS[tile].filter(from=>game.tiles[from]?.cubes[actor]).flatMap(from=>{
      const n = selectedNumber(data,'from-'+from);
      return n ? [{from,to:tile,n}] : [];
    });
    return {moves,label:moveLabel(game,moves)};
  }
  if (kind === 'loss') {
    const elements = step.due.threats.filter(type=>data.has('loss-'+type));
    if (elements.length !== step.due.drops) throw new Error('Select exactly ' + step.due.drops + ' added element' + (step.due.drops === 1 ? '.' : 's.'));
    return {elements,label:'Remove ' + elements.map(elementName).join(' and ') + ' from the animal display.'};
  }
  if (kind === 'extinction') return {saved:val('saveCube')};
  if (kind === 'symbiosis') {
    const draws = Object.fromEntries(step.recipients.map(id=>[id,val('sym-'+id)]));
    const required = Math.min(step.recipients.length,sum(ELEMENT_IDS.map(type=>bagCount(game,type))));
    if (Object.values(draws).filter(Boolean).length !== required) throw new Error('Enter the drawn element for each animal that could draw.');
    for (const type of ELEMENT_IDS) if (count(Object.values(draws),type)>bagCount(game,type)) throw new Error('That element count exceeds what is left in the bag.');
    return {draws,label:Object.entries(draws).map(([id,type])=>nameOf(id)+' · '+(type ? elementName(type) : 'no disk left')).join('; ') + '.'};
  }
  if (kind === 'immigrant') {
    const mode = val('mode'), type = val('type'), slot = val('slot');
    return {mode,type,slot,label:mode==='element' ? 'Discard one added '+elementName(type)+'.' : mode==='pawn' ?
      'Lose one pawn' + (slot ? ' from '+slotLabel(slot) : ' from the available supply') + '.' : 'Eliminate all but one cube on every occupied tile.'};
  }
  throw new Error('That action is unavailable.');
}
function makeHits(data) {
  const hits = [...data].flatMap(([key,val])=> {
    if (!key.startsWith('hit-') || !val) return [];
    const [tile,victim] = val.split(':');
    return [{tile,victim}];
  });
  return {hits,label:hitLabel(game,hits)};
}
function makePawnChoice(step,data) {
  const {row,actor} = step;
  const val = key => data.get(key) || null;
  const tile = val('tile'), corner = val('corner'), pick = selectedNumber(data,'pick');
  switch (row) {
    case 'initiative':
      return val('slot') ? {slot:val('slot'),label:'Move up in Initiative if possible. Move the pawn to ' + slotLabel(val('slot')) + '.'} : PASS;
    case 'adaptation':
      return pick === null ? PASS : {pick,label:'Add ' + elementName(game.boxes.adaptation[pick]) + ' to your animal display.'};
    case 'regression': return {label:'Return the Regression pawn.'};
    case 'abundance':
      return corner ? {corner,pick,label:'Place ' + elementName(game.boxes.abundance[pick]) + ' at ' + cornerName(corner) + '.'} : PASS;
    case 'wasteland':
      return pick === null ? PASS : {pick,label:'Remove one ' + elementName(game.boxes.wasteland[pick]) + ' disk from the Wasteland box.'};
    case 'depletion':
      return corner ? {corner,label:'Remove ' + elementName(game.corners[corner]) + ' at ' + cornerName(corner) + '.'} : PASS;
    case 'glaciation': return tile ? {tile} : PASS;
    case 'speciation': {
      if (!corner) return PASS;
      const add = Object.fromEntries(CORNER_TILES[corner].filter(id=>game.tiles[id]).map(id=>[id,selectedNumber(data,'add-'+id) || 0]));
      if (sum(Object.values(add)) > game.animals[actor].pool) throw new Error('The total exceeds your gene pool.');
      return {corner,add,label:addLabel(game,add)};
    }
    case 'wanderlust': {
      if (!tile) return PASS;
      const stack = selectedNumber(data,'stack');
      return {tile,stack,pick,corner,label:'Place ' + terrainName(game.stacks[stack].face) + ' at ' + tile +
        (pick !== null ? '. Add ' + elementName(game.boxes.wanderlust[pick]) + ' at corner ' + cornerIndex(tile,corner) : '') +
        '. +' + bonus(NEIGHBORS[tile].filter(id=>game.tiles[id]).length) + ' VP.'};
    }
    case 'migration': {
      if (draft.destination) throw new Error('Add or clear the pending move before confirming.');
      const moves = draft.moves || [];
      return {moves,label:moveLabel(game,moves)};
    }
    case 'competition': return makeHits(data);
    case 'domination': return tile ? {tile} : PASS;
  }
}
function makeEffectChoice(step,data) {
  const {name,actor} = step;
  const a = game.animals[actor];
  const val = key=>data.get(key) || null;
  const tile=val('tile'), type=val('type'), corner=val('corner'), keep=val('keep');
  const n=selectedNumber(data,'n') || 0;
  const hits=[...data].flatMap(([key,id])=>key.startsWith('victim-') && id ? [{tile:key.slice(7),victim:id}] : []);
  if (['Biodiversity','Cold Snap','Disease','Ecodiversity','Ice Age','Immigrants','Intelligence','Niche Biomes','Nocturnal','Omnivore','Parasitism','Symbiotic'].includes(name)) return chooseEffect(game,step);
  const skipped={skip:true,label:'This card has no legal target.'};
  if (name === 'Aquatic') return tile ? {tile,type,corner,n,label:(type ? 'Place '+elementName(type)+' at '+tile+' corner '+cornerIndex(tile,corner)+'. ' : '')+addLabel(game,{[tile]:n})} : skipped;
  if (name === 'Biomass' || name === 'Predator') return {hits,label:hits.length ? hitLabel(game,hits) : 'No eligible cubes.'};
  if (name === 'Blight') return tile ? {tile,keep,label:'Keep '+elementName(game.corners[keep])+' at '+tile+' corner '+cornerIndex(tile,keep)+'. Remove the other disks from that tile.'} : skipped;
  if (name === 'Catastrophe') return tile ? {tile,keep,hits,label:(keep ? 'Leave one '+nameOf(keep)+' cube at '+tileLabel(game,tile)+'. ' : '')+(hits.length ? hitLabel(game,hits) : '')} : skipped;
  if (name === 'Fertile') return tile ? {tile,label:'Gain '+scoreCardPoints(game,actor,name,step.tile,tile)+' VP.'} : skipped;
  if (name === 'Habitat') return type && corner ? {type,corner,label:'Place '+elementName(type)+' at '+cornerName(corner)+'.'} : skipped;
  if (name === 'Hibernation') return tile ? {tile,n,label:'Return '+n+' eliminated cubes at '+tileLabel(game,tile)+'.'} : skipped;
  if (name === 'Ice Sheet') return tile ? {tile} : skipped;
  if (name === 'Instinct') return val('slot') ? {slot:val('slot'),label:'Place an available pawn at '+slotLabel(val('slot'))+'.'} : skipped;
  if (name === 'Metamorphosis') return type && val('out') ? {out:val('out'),type,label:'Swap '+elementName(val('out'))+' for '+elementName(type)+'.'} : skipped;
  if (name === 'Fecundity') {
    const add=Object.fromEntries(occupied(game,actor).filter(id=>data.has('grow-'+id)).map(id=>[id,1]));
    if (Object.keys(add).length > a.pool) throw new Error('The total exceeds your gene pool.');
    return {add,label:addLabel(game,add)};
  }
  if (name === 'Evolution') {
    const targets=game.ids.flatMap(id=>val('evo-'+id) ? [{tile:val('evo-'+id),victim:id}] : []);
    if (targets.length > a.pool) throw new Error('You do not have enough gene-pool cubes to replace both.');
    return {hits:targets,label:targets.length ? targets.map(h=>'Replace one '+nameOf(h.victim)+' cube at '+tileLabel(game,h.tile)+'.').join(' ') : 'Replace no cubes.'};
  }
  if (name === 'Mass Exodus') {
    if (!tile) return skipped;
    const moves={};
    for (const id of game.ids.filter(id=>game.tiles[tile].cubes[id])) {
      moves[id]=NEIGHBORS[tile].filter(to=>game.tiles[to]).flatMap(to=>{
        const n=selectedNumber(data,'mass-'+id+'-'+to);
        return n ? [{from:tile,to,n}] : [];
      });
      if (sum(moves[id].map(m=>m.n)) !== game.tiles[tile].cubes[id]) throw new Error('Distribute every '+nameOf(id)+' cube on '+tileLabel(game,tile)+'.');
    }
    return {tile,moves,label:Object.entries(moves).map(([id,g])=>nameOf(id)+' · '+moveLabel(game,g)).join(' ')};
  }
  throw new Error('Unrecognized Dominance Card.');
}
