const POLICIES = {
  majority: {
    focus: 'majority',
    priority: ['domination', 'speciation', 'competition', 'adaptation', 'migration', 'abundance', 'wanderlust', 'glaciation'],
  },
  dominance: {
    focus: 'dominance',
    priority: ['domination', 'adaptation', 'migration', 'speciation', 'abundance', 'depletion', 'competition', 'wanderlust'],
  },
  expansion: {
    focus: 'reach',
    priority: ['wanderlust', 'speciation', 'glaciation', 'migration', 'domination', 'adaptation', 'abundance', 'competition'],
  },
};
const playerFocus = (policy, row) => policy.focus === 'reach' && row === 'glaciation' ? 'survival' : policy.focus;

function visibleBoard(state) {
  const {decks, seed, rng, log, ...visible} = state;
  return copy(visible);
}
function playerDomination(s, actor, policy, skip = 0) {
  const cards = availableCards(s);
  const focus = policy.focus;
  const cardWeight = focus === 'dominance' ? 6 : 3;
  const rivalWeight = focus === 'majority' ? .55 : .4;
  const choices = terrainIds(s).filter(id => !s.scored.includes(id)).map(tile => {
    const owner = cone(s, tile);
    let value = sum(tileScores(s, tile).map(([id, points]) => id === actor ? points : -rivalWeight * points));
    if (cards.length && owner) value += owner === actor ? cardWeight : -cardWeight * .7;
    return {tile, value};
  }).sort((a, b) => b.value - a.value);
  return choices[skip] ?? {value: 0};
}

function playerPlacement(state, actor, profile, timing = null) {
  const s = visibleBoard(state);
  const policy = POLICIES[profile];
  const open = ALL_SLOTS.filter(key => !s.pawns[key] && (timing !== 'initiative' || key !== 'initiative-0') &&
    (timing !== 'instinct' || !s.ending || EXECUTION.indexOf(key) >= s.cursor));
  if (!open.length) return null;
  const committed = Object.fromEntries(ROWS.map(({id}) => [id, pawnCount(s, actor, id)]));
  const capacity = 6 - ANIMALS[actor].affinity - s.animals[actor].added.length;
  const remainingCubes = Math.max(0, s.animals[actor].pool - 3 * committed.speciation);
  const cache = new Map();
  const options = open.map(slot => {
    const {row, index} = splitSlot(slot);
    const step = {actor, row, index, focus: playerFocus(policy, row)};
    const earlier = ROW_BY_ID[row].slots.slice(0, index).filter(key => s.pawns[key]).length;
    if (!hasPawnTarget(s, step)) return {slot, value: -20};
    if (row === 'initiative') return {slot, value: s.initiative[0] === actor ? 1 : 3};
    if (row === 'regression') return {slot, value: regressionDue(s, actor).drops ? 7 : -2};
    if (row === 'domination') {
      const target = playerDomination(s, actor, policy, earlier);
      const setup = profile === 'dominance' && committed.adaptation + committed.migration + committed.speciation > 0;
      return {slot, value: target.value + (setup && !committed.domination ? 3 : 0) - 2 * committed.domination};
    }
    if (row === 'adaptation' && (committed.adaptation >= capacity || earlier >= s.boxes.adaptation.filter(Boolean).length)) {
      return {slot, value: -19};
    }
    if (row === 'speciation' && !remainingCubes) return {slot, value: -19};
    if (row === 'wanderlust' && earlier >= s.stacks.filter(stack => stack.face).length) return {slot, value: -19};
    if (row === 'abundance' && earlier >= s.boxes.abundance.filter(Boolean).length) return {slot, value: -19};
    if (row === 'glaciation' && index > 0) return {slot, value: -3 - index};
    const cacheKey = ['speciation', 'competition'].includes(row) ? slot : row;
    if (!cache.has(cacheKey)) {
      const value = row === 'wanderlust' ? 4 : (choosePawnTarget(s, step, true).value ?? 0);
      cache.set(cacheKey, value);
    }
    const opportunity = cache.get(cacheKey);
    const preference = policy.priority.indexOf(row);
    const priority = preference < 0 ? 0 : 3.6 - preference * .4;
    const value = opportunity > .04 ? Math.min(8, opportunity) + priority - 1.75 * committed[row] - .09 * index : -1;
    return {slot, value: timing === 'instinct' && EXECUTION.indexOf(slot) < s.cursor ? value * .4 : value};
  });
  return choiceBest(options).slot;
}

function playerChoice(state, step, profile) {
  const s = visibleBoard(state);
  const policy = POLICIES[profile];
  const focus = playerFocus(policy, step.row);
  const actor = step.actor;
  if (step.kind === 'pawn' && step.row === 'initiative') {
    const slot = playerPlacement(state, actor, profile, 'initiative');
    return {slot, label: 'Move pawn to ' + slotLabel(slot) + '.'};
  }
  if (step.kind === 'pawn' && step.row === 'domination') {
    const target = playerDomination(s, actor, policy);
    return target.value > 0 ? {...target, label: describeScore(s, target.tile)} : PASS;
  }
  s.playerProfile = profile;
  return referenceAction(s, {...step, focus});
}
