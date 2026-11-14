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
function paperPlacement(s, actor, cardIndex) {
  const card = cardIndex === null ? null : DECKS[actor][cardIndex];
  const positive = card ? checkCard(s,actor,card.check) : false;
  const face = card ? (positive ? card.yes : card.no) : null;
  const focus = face?.focus || 'majority';
  const open = ALL_SLOTS.filter(key => !s.pawns[key]);
  const pick = (rows, allowRepeat) => {
    for (const row of rows) {
      if (!allowRepeat && pawnCount(s,actor,row)) continue;
      const slots = open.map(splitSlot).filter(x => x.row === row && paperLegal(s,actor,row,x.index));
      if (!slots.length) continue;
      const best = slots.sort((a,b) => paperSlotScore(s,actor,row,b.index) - paperSlotScore(s,actor,row,a.index) || a.index - b.index)[0];
      return best.row + '-' + best.index;
    }
    return null;
  };
  const domFirst = !pawnCount(s,actor,'domination') && availableCards(s).length && paperDominated(s,actor).length ? pick(['domination'], false) : null;
  const slot = domFirst || pick(face ? face.rows : [], false) || pick(FALLBACK, false) || pick(FALLBACK, true) || open[0];
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
