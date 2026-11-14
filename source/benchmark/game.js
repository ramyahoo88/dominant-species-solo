const DRAW_TERRAIN = LARGE_TERRAIN.flatMap(terrain => Array(terrain === 'sea' ? 6 : 3).fill(terrain));
const DRAW_ROWS = ['adaptation', 'abundance', 'wanderlust'];
const hashSeed = (seed, channel) => (seed ^ Math.imul(channel, 0x9e3779b1)) >>> 0;
const randomFor = (seed, channel) => ({rng: hashSeed(seed, channel)});
function makeSupplies(s, seed) {
  const cards = [...shuffle(randomFor(seed, 1), DOMINANCE.filter(card => card !== 'Ice Age' &&
    (!s.short || !SHORT_EXCLUDES.includes(card)))), 'Ice Age'];
  const large = shuffle(randomFor(seed, 2), DRAW_TERRAIN);
  const stacks = Array.from({length: 3}, (_, index) => large.slice(8 * index, 8 * (index + 1)));
  return {cards, stacks};
}
function nextSupply(s, supply, seed) {
  const bag = shuffle(randomFor(seed, 4 * s.turn + 1),
    ELEMENT_IDS.flatMap(type => Array(bagCount(s, type)).fill(type)));
  const market = [...s.market];
  for (const i of nextCardSlots(s)) market[i] = supply.cards.shift();
  const values = {market, stacks: s.stacks.map((stack, i) => stack.face || (stack.left ? supply.stacks[i].shift() : null))};
  for (const row of DRAW_ROWS) values[row] = Array.from({length: 4}, () => bag.shift() ?? null);
  return values;
}
function symbioticDraw(s, step, seed) {
  const bag = shuffle(randomFor(seed, 4 * s.turn + 2),
    ELEMENT_IDS.flatMap(type => Array(bagCount(s, type)).fill(type)));
  return {draws: Object.fromEntries(step.recipients.map((actor, index) => [actor, bag[index] ?? null])), label: 'Physical draws'};
}
function playBenchmark({human, rivals, seed, short, policy}, player, trace = false) {
  const s = newGame(human, rivals, short, seed);
  const supply = makeSupplies(s, seed);
  const seats = Object.fromEntries(s.ids.map(id => [id, {rows: {}, blocks: 0, optionalDeclines: 0}]));
  const events = [];
  let openingSupply;
  for (let stepCount = 0; stepCount < 1800; stepCount++) {
    validateState(s);
    if (s.phase === 'finished') {
      if (!s.usedCards.includes('Ice Age')) throw new Error('Finished without Ice Age.');
      const [winner, runnerUp] = standings(s);
      for (const id of s.ids) seats[id].vp = s.animals[id].vp;
      return {human, rivals, seed, short, policy, turns: s.turn, steps: stepCount, winner,
        winningMargin: seats[winner].vp - seats[runnerUp].vp,
        humanMargin: seats[human].vp - Math.max(...rivals.map(id => seats[id].vp)),
        openingSupply, seats, ...(trace ? {events} : {})};
    }
    if (s.phase === 'supply') {
      const values = nextSupply(s, supply, seed);
      if (s.turn === 1) openingSupply = JSON.stringify(values);
      enterSupply(s, values);
      continue;
    }
    if (s.phase === 'planning') {
      const {actor} = currentPlanner(s);
      const placement = actor === human ? {slot: player.place(s, actor, policy)} : botPlacement(s);
      if (actor === human) place(s, placement.slot);
      if (placement.blockedRival) seats[actor].blocks++;
      if (trace) events.push({turn: s.turn, actor, slot: placement.slot, reason: placement.reason});
      continue;
    }
    const step = nextStep(s);
    const actor = step.actor;
    const choice = step.kind === 'symbiosis' ? symbioticDraw(s, step, seed) :
      actor === human ? player.choose(s, step, policy) : botAction(s, step);
    if (step.kind === 'pawn') {
      const outcome = pawnOutcome(s, step, choice);
      const counts = seats[actor].rows[step.row] ??= {resolved: 0, declined: 0, noTarget: 0};
      counts[outcome]++;
      if (trace) events.push({turn: s.turn, actor, slot: step.key, outcome, choice: copy(choice)});
    } else if (actor && (choice.pass || step.kind === 'spider' && !choice.hits.length || step.kind === 'arrival' && !choice.moves.length)) {
      seats[actor].optionalDeclines++;
    }
    runStep(s, step, copy(choice));
  }
  throw new Error('Reached the step limit at turn ' + s.turn + ' in ' + s.phase + '.');
}
