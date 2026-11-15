// Tunable test player (opt-in). Loaded only by the tuner (source/benchmark/tune.cjs); the published
// benchmark never loads it, so the fixed policies and every ladder number are unaffected.
// It mirrors playerPlacement/playerDomination in player.js with every hand-set constant turned into a weight.
// With DEFAULT_WEIGHTS it plays exactly like the fixed 'dominance' policy (checked by tune.cjs --selftest).
//
// Round 2 adds features that are all 0 (off) by default, so the defaults still play like 'dominance' and a v1
// weights file still plays exactly as before. They act only where the player decides (Planning, Domination
// targets, which Dominance Card to take) or, for the pawn actions they cover, replace the frozen reference
// chooser with a copy of it plus the feature's term. A copy is used only while that feature's weight is non-zero.

const TUNED_ROWS = ROWS.map(row => row.id);
const TUNED_CARDS = [...DOMINANCE];
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
  // ---- Round 2 (all 0 = off)
  // Turn phase: phase * late[row] is added to a row's Planning value. phase is the share of the Dominance deck
  // revealed so far: 0 on turn 1, 1 once Ice Age is out (or the game is ending). Early value = row weight as before.
  late: Object.fromEntries(TUNED_ROWS.map(id => [id, 0])),
  // Dominance Cards: preference added to the card's estimated value when the player chooses which card to take.
  // The best preference among the cards on offer also adds to a Domination target the player would own.
  card: Object.fromEntries(TUNED_CARDS.map(name => [name, 0])),
  reserve: 0,         // Speciation Planning penalty, scaled 0..1 as the gene pool would fall from 8 cubes to 0
  specCost: 0,        // Speciation: extra cost per cube placed (a soft cap on cubes per action)
  loneTundra: 0,      // penalty for each of the player's lone cubes on a tundra tile, in every board evaluation
  elemPen: 0,         // Adaptation Planning penalty per element the player has already added
  denyDeplete: 0,     // Depletion: value per Dominance swing (an opponent loses a cone or the player gains one)
  denyComp: 0,        // Competition: the same, for a hit that removes an opponent's last cube on a tile
  denyGlac: 0,        // Glaciation: value per VP the glaciated tile would stop scoring for opponents
};
var TUNED = DEFAULT_WEIGHTS;
POLICIES.tuned = {focus: DEFAULT_WEIGHTS.focus, priority: []};
function setTuned(weights) {
  TUNED = {...DEFAULT_WEIGHTS, ...weights, row: {...DEFAULT_WEIGHTS.row, ...weights.row},
    late: {...DEFAULT_WEIGHTS.late, ...weights.late}, card: {...DEFAULT_WEIGHTS.card, ...weights.card}};
  POLICIES.tuned.focus = TUNED.focus;
}

// ---------------------------------------------------------------- round-2 helpers
// Share of the Dominance deck revealed: 0 with the opening market, 1 once Ice Age is out.
function tunedPhase(s) {
  if (s.ending) return 1;
  const total = s.short ? 22 : 26;
  const drawn = s.usedCards.length + s.market.filter(Boolean).length;
  return Math.max(0, Math.min(1, (drawn - 5) / (total - 5)));
}
// Opponents count by threat, as the reference evaluation weighs them; an average opponent counts 1.
const opponentWeight = (s, ctx, id) => (ctx.rival[id] ?? 0) * (s.ids.length - 1);
// Dominance swing on the given tiles from a trial change: +1 per cone the player gains (-1 lost),
// +opponent weight per cone an opponent loses (- when one gains).
function coneSwing(s, tiles, ctx, change, revert) {
  const before = tiles.map(tile => cone(s, tile));
  change();
  const after = tiles.map(tile => cone(s, tile));
  revert();
  let value = 0;
  tiles.forEach((tile, i) => {
    const was = before[i], now = after[i];
    if (was === now) return;
    if (now === ctx.actor) value++;
    if (was === ctx.actor) value--;
    if (was && was !== ctx.actor) value += opponentWeight(s, ctx, was);
    if (now && now !== ctx.actor) value -= opponentWeight(s, ctx, now);
  });
  return value;
}
const cornerSites = (s, key) => CORNER_TILES[key].filter(id => s.tiles[id]);
const passIfSmall = best => best?.value > .04 ? best : {...PASS, value: 0};

// Copies of the reference choosers (bot.js at PLAYER_REFERENCE) with one added term each.
function tunedDepletion(s, step, quick, W) {
  const {actor, index} = step;
  const ctx = context(s, actor, step.focus || 'majority');
  const run = () => choiceBest(placementTargets(s, 'depletion', index, actor).map(corner => {
    const type = s.corners[corner];
    const swing = coneSwing(s, cornerSites(s, corner), ctx, () => { delete s.corners[corner]; }, () => { s.corners[corner] = type; });
    return {
      corner, value: cornerGain(s, corner, null, ctx) + W.denyDeplete * swing,
      label: 'Remove ' + elementName(s.corners[corner]) + ' from the corner shared by ' + cornerLabel(s, corner) + ' (corner ' + cornerIndex(CORNER_TILES[corner].find(id => s.tiles[id]), corner) + ' on ' + CORNER_TILES[corner].find(id => s.tiles[id]) + ').',
    };
  }));
  return passIfSmall(quick ? withPostWasteland(s, run) : run());
}
function tunedCompetition(s, step, W) {
  const {actor, index} = step;
  const ctx = context(s, actor, step.focus || 'majority');
  const types = ['tundra', COMPETITION_EDGES[index], COMPETITION_EDGES[index + 1]];
  const legal = competitionChoices(s, actor, types).map(h => {
    const cubes = s.tiles[h.tile].cubes;
    const swing = coneSwing(s, [h.tile], ctx, () => { cubes[h.victim]--; }, () => { cubes[h.victim]++; });
    return {...h, value: hitValue(s, h.tile, h.victim, ctx) + W.denyComp * swing};
  });
  const hits = types.map(type => choiceBest(legal.filter(h => s.tiles[h.tile].terrain === type))).filter(h => h?.value > 0);
  return passIfSmall({hits, value: sum(hits.map(h => h.value)), label: hitLabel(s, hits)});
}
function tunedGlaciation(s, step, W) {
  const actor = step.actor;
  const ctx = context(s, actor, step.focus);
  const scores = (board, tile) => Object.fromEntries(tileScores(board, tile));
  return passIfSmall(choiceBest(glazeTargets(s).map(tile => {
    const trial = {...s, tiles: {...s.tiles, [tile]: {...s.tiles[tile], cubes: {...s.tiles[tile].cubes}}}, corners: {...s.corners},
      animals: Object.fromEntries(s.ids.map(id => [id, {...s.animals[id], ward: {...s.animals[id].ward}}]))};
    const near = unique([tile, ...NEIGHBORS[tile]]);
    const before = scores(s, tile);
    const label = glaciation(trial, actor, tile);
    const hold = survival(trial);
    let value = sum(near.map(id => utility(trial, id, ctx) - utility(s, id, ctx))) + trial.animals[actor].vp - s.animals[actor].vp;
    if (hold) value += hold.vp * (hold.actor === actor ? .35 : -.24);
    const after = scores(trial, tile);
    const denied = sum(s.ids.filter(id => id !== actor).map(id => opponentWeight(s, ctx, id) * Math.max(0, (before[id] || 0) - (after[id] || 0))));
    return {tile, value: value + W.denyGlac * denied, label};
  })));
}
function tunedChooseSpeciation(s, key, ctx, quick, W) {
  let available = s.animals[ctx.actor].pool;
  const cost = (quick ? .18 : (available > 10 ? .03 : .09)) + W.specCost;
  const candidates = CORNER_TILES[key].filter(id => s.tiles[id]).map(tile => {
    const options = Array.from({length: TERRAIN[s.tiles[tile].terrain].cap}, (_, i) => {
      const n = i + 1;
      const base = changeCubes(s, tile, ctx.actor, n, ctx) - n * cost;
      const safe = match(s, tile, ctx.actor) > 0 ? .06 * n : 0;
      return {n, value: base + (quick ? 0 : safe)};
    });
    return {tile, options, value: choiceBest(options).value};
  }).sort((a, b) => b.value - a.value);
  const add = {};
  let value = 0;
  for (const t of candidates) {
    const best = choiceBest(t.options.filter(o => o.n <= available));
    if (best?.value > 0) { add[t.tile] = best.n; available -= best.n; value += best.value; }
  }
  return {corner: key, add, value, label: addLabel(s, add)};
}
function tunedSpeciation(s, step, quick, W) {
  const {actor, index} = step;
  if (!s.animals[actor].pool) return passIfSmall(null);
  const ctx = context(s, actor, step.focus || 'majority');
  const run = () => choiceBest(placementTargets(s, 'speciation', index, actor).map(key => tunedChooseSpeciation(s, key, ctx, quick, W)));
  return passIfSmall(quick ? withPostWasteland(s, run) : run());
}
// A pawn action's target: the reference chooser, or its copy while that row's feature is on.
function tunedTarget(s, step, quick, W) {
  switch (step.row) {
    case 'depletion': if (W.denyDeplete) return tunedDepletion(s, step, quick, W); break;
    case 'competition': if (W.denyComp) return tunedCompetition(s, step, W); break;
    case 'glaciation': if (W.denyGlac) return tunedGlaciation(s, step, W); break;
    case 'speciation': if (W.specCost) return tunedSpeciation(s, step, quick, W); break;
  }
  return choosePawnTarget(s, step, quick);
}

// Board evaluation: the reference utility, plus round-2 terms while the tuned player is deciding.
let TUNED_ACTIVE = false;
const referenceUtility = utility;
utility = (s, tile, ctx) => {
  const value = referenceUtility(s, tile, ctx);
  if (!TUNED_ACTIVE || !TUNED.loneTundra) return value;
  const t = s.tiles[tile];
  return t && t.terrain === 'tundra' && t.cubes[ctx.actor] === 1 ? value - TUNED.loneTundra : value;
};
function asTuned(fn) {
  const was = TUNED_ACTIVE;
  TUNED_ACTIVE = true;
  try { return fn(); } finally { TUNED_ACTIVE = was; }
}

// ---------------------------------------------------------------- decisions
function tunedDomination(s, actor, W, skip = 0) {
  const cards = availableCards(s);
  const preferred = cards.length ? Math.max(...cards.map(card => W.card[card] || 0)) : 0;
  const choices = terrainIds(s).filter(id => !s.scored.includes(id)).map(tile => {
    const owner = cone(s, tile);
    let value = sum(tileScores(s, tile).map(([id, points]) => id === actor ? points : -W.rivalWeight * points));
    if (cards.length && owner) value += owner === actor ? W.cardWeight + preferred : -W.cardWeight * W.nonOwner;
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
  const phase = tunedPhase(s);
  const late = row => phase * W.late[row];
  const cache = new Map();
  const options = open.map(slot => {
    const {row, index} = splitSlot(slot);
    const step = {actor, row, index, focus: playerFocus(policy, row)};
    const earlier = ROW_BY_ID[row].slots.slice(0, index).filter(key => s.pawns[key]).length;
    if (!hasPawnTarget(s, step)) return {slot, value: -20};
    if (row === 'initiative') return {slot, value: (s.initiative[0] === actor ? W.initFirst : W.initOther) + late(row)};
    if (row === 'regression') return {slot, value: (regressionDue(s, actor).drops ? W.regDue : W.regNot) + late(row)};
    if (row === 'domination') {
      const target = tunedDomination(s, actor, W, earlier);
      const setup = committed.adaptation + committed.migration + committed.speciation > 0;
      return {slot, value: target.value + (setup && !committed.domination ? W.setup : 0) - W.domCommit * committed.domination + late(row)};
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
      const value = row === 'wanderlust' ? W.wander : (tunedTarget(s, step, true, W).value ?? 0);
      cache.set(cacheKey, value);
    }
    const opportunity = cache.get(cacheKey);
    let value = opportunity > W.oppMin ? Math.min(W.cap, opportunity) + W.row[row] - W.commit * committed[row] - W.indexPen * index : W.worthless;
    if (opportunity > W.oppMin) {
      value += late(row);
      if (row === 'adaptation') value -= W.elemPen * s.animals[actor].added.length;
      if (row === 'speciation') value -= W.reserve * Math.max(0, 8 - Math.max(0, remainingCubes - 3)) / 8;
    }
    return {slot, value: timing === 'instinct' && EXECUTION.indexOf(slot) < s.cursor ? value * W.instinct : value};
  });
  return choiceBest(options).slot;
}

// Execution choices: the fixed player's (frozen reference helpers), except where a round-2 feature is on.
function tunedChoice(state, step, profile, W) {
  if (step.kind === 'claim' && TUNED_CARDS.some(card => W.card[card])) {
    const s = visibleBoard(state);
    s.playerProfile = profile;   // the Instinct card's value plans an extra placement with this profile
    return choiceBest(availableCards(s).map(card => ({card, value: cardValue(s, step.actor, card, step.tile) + (W.card[card] || 0), label: 'Take ' + card + '.'})));
  }
  if (step.kind === 'pawn' && (step.row === 'depletion' && W.denyDeplete || step.row === 'competition' && W.denyComp ||
      step.row === 'glaciation' && W.denyGlac || step.row === 'speciation' && W.specCost)) {
    const s = visibleBoard(state);
    s.playerProfile = profile;
    return tunedTarget(s, {...step, focus: playerFocus(POLICIES.tuned, step.row)}, false, W);
  }
  return fixedChoice(state, step, profile);
}

const fixedPlacement = playerPlacement, fixedDomination = playerDomination, fixedChoice = playerChoice;
playerPlacement = (state, actor, profile, timing = null) =>
  profile === 'tuned' ? asTuned(() => tunedPlacement(state, actor, TUNED, timing)) : fixedPlacement(state, actor, profile, timing);
playerDomination = (s, actor, policy, skip = 0) =>
  policy === POLICIES.tuned ? tunedDomination(s, actor, TUNED, skip) : fixedDomination(s, actor, policy, skip);
playerChoice = (state, step, profile) =>
  profile === 'tuned' ? asTuned(() => tunedChoice(state, step, profile, TUNED)) : fixedChoice(state, step, profile);
