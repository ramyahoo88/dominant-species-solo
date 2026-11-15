// Tunable test player (opt-in). Loaded only by the tuner (source/benchmark/tune.cjs); the published
// benchmark never loads it, so the fixed policies and every ladder number are unaffected.
// It mirrors playerPlacement/playerDomination in player.js with every hand-set constant turned into a weight.
// With DEFAULT_WEIGHTS it plays exactly like the fixed 'dominance' policy (checked by tune.cjs --selftest).

const TUNED_ROWS = ROWS.map(row => row.id);
const DEFAULT_WEIGHTS = {
  focus: 'dominance',
  row: Object.fromEntries(TUNED_ROWS.map(id => {
    const p = POLICIES.dominance.priority.indexOf(id);
    return [id, p < 0 ? 0 : 3.6 - p * .4];
  })),
  cardWeight: 6,      // Domination: value of taking a Dominance Card with the tile
  nonOwner: .7,       // Domination: share of that value lost when an opponent would take the card
  rivalWeight: .4,    // Domination: weight of opponents' points on the tile
  setup: 3,           // Domination: bonus once Adaptation/Migration/Speciation set it up
  domCommit: 2,       // Domination: penalty per pawn already there
  commit: 1.75,       // other rows: penalty per pawn already in the row
  indexPen: .09,      // penalty per space to the right
  cap: 8,             // cap on a row's estimated value
  oppMin: .04,        // below this value a row counts as worthless
  worthless: -1,      // value of a worthless row
  wander: 4,          // Wanderlust value
  initFirst: 1,       // Initiative when already first
  initOther: 3,       // Initiative otherwise
  regDue: 7,          // Regression when it saves an element
  regNot: -2,         // Regression otherwise
  glacLater: 3,       // penalty for a later Glaciation space (plus its index)
  instinct: .4,       // Instinct: weight of a space that has already run
};
var TUNED = DEFAULT_WEIGHTS;
POLICIES.tuned = {focus: DEFAULT_WEIGHTS.focus, priority: []};
function setTuned(weights) {
  TUNED = {...DEFAULT_WEIGHTS, ...weights, row: {...DEFAULT_WEIGHTS.row, ...weights.row}};
  POLICIES.tuned.focus = TUNED.focus;
}

function tunedDomination(s, actor, W, skip = 0) {
  const cards = availableCards(s);
  const choices = terrainIds(s).filter(id => !s.scored.includes(id)).map(tile => {
    const owner = cone(s, tile);
    let value = sum(tileScores(s, tile).map(([id, points]) => id === actor ? points : -W.rivalWeight * points));
    if (cards.length && owner) value += owner === actor ? W.cardWeight : -W.cardWeight * W.nonOwner;
    return {tile, value};
  }).sort((a, b) => b.value - a.value);
  return choices[skip] ?? {value: 0};
}

function tunedPlacement(state, actor, W, timing = null) {
  const s = visibleBoard(state);
  const policy = POLICIES.tuned;
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
    if (row === 'initiative') return {slot, value: s.initiative[0] === actor ? W.initFirst : W.initOther};
    if (row === 'regression') return {slot, value: regressionDue(s, actor).drops ? W.regDue : W.regNot};
    if (row === 'domination') {
      const target = tunedDomination(s, actor, W, earlier);
      const setup = committed.adaptation + committed.migration + committed.speciation > 0;
      return {slot, value: target.value + (setup && !committed.domination ? W.setup : 0) - W.domCommit * committed.domination};
    }
    if (row === 'adaptation' && (committed.adaptation >= capacity || earlier >= s.boxes.adaptation.filter(Boolean).length)) {
      return {slot, value: -19};
    }
    if (row === 'speciation' && !remainingCubes) return {slot, value: -19};
    if (row === 'wanderlust' && earlier >= s.stacks.filter(stack => stack.face).length) return {slot, value: -19};
    if (row === 'abundance' && earlier >= s.boxes.abundance.filter(Boolean).length) return {slot, value: -19};
    if (row === 'glaciation' && index > 0) return {slot, value: -W.glacLater - index};
    const cacheKey = ['speciation', 'competition'].includes(row) ? slot : row;
    if (!cache.has(cacheKey)) {
      const value = row === 'wanderlust' ? W.wander : (choosePawnTarget(s, step, true).value ?? 0);
      cache.set(cacheKey, value);
    }
    const opportunity = cache.get(cacheKey);
    const value = opportunity > W.oppMin ? Math.min(W.cap, opportunity) + W.row[row] - W.commit * committed[row] - W.indexPen * index : W.worthless;
    return {slot, value: timing === 'instinct' && EXECUTION.indexOf(slot) < s.cursor ? value * W.instinct : value};
  });
  return choiceBest(options).slot;
}

const fixedPlacement = playerPlacement, fixedDomination = playerDomination;
playerPlacement = (state, actor, profile, timing = null) =>
  profile === 'tuned' ? tunedPlacement(state, actor, TUNED, timing) : fixedPlacement(state, actor, profile, timing);
playerDomination = (s, actor, policy, skip = 0) =>
  policy === POLICIES.tuned ? tunedDomination(s, actor, TUNED, skip) : fixedDomination(s, actor, policy, skip);
