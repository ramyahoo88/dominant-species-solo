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
  const cap = typeof BENCH_TURN_CAP === 'number' ? BENCH_TURN_CAP : 30; // diagnostics may raise the stall cap
  for (let stepCount = 0; stepCount < Math.max(1800, 60 * cap); stepCount++) {
    validateState(s);
    // A crowded table can strip Earth of elements so no one can dominate or take a card. Score such a stall as it stands.
    const stalled = s.turn > cap;
    if (s.phase === 'finished' || stalled) {
      if (!stalled && !s.usedCards.includes('Ice Age')) throw new Error('Finished without Ice Age.');
      const [winner, runnerUp] = standings(s);
      for (const id of s.ids) seats[id].vp = s.animals[id].vp;
      return {human, rivals, seed, short, policy, turns: s.turn, steps: stepCount, winner,
        winningMargin: seats[winner].vp - seats[runnerUp].vp,
        humanMargin: seats[human].vp - Math.max(...rivals.map(id => seats[id].vp)),
        openingSupply, seats, ...(stalled ? {stalled: true} : {}), ...(trace ? {events} : {})};
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
      // Card check (v0.5.4 work): which Planning step placed each paper rival's pawn, by the deck card it drew.
      const why = actor !== human && /^(?:Red Queen|Paper rule), ([^:]+):/.exec(placement.reason || '')?.[1];
      if (why && placement.card !== null && placement.card !== undefined) {
        const deck = seats[actor].deck ??= {};
        const tally = deck[placement.card + 1] ??= {};
        tally[why] = (tally[why] || 0) + 1;
      }
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
    // Card check: for each Dominance Card a seat takes, whether its effect changed the board and what it scored.
    const watch = actor && (step.kind === 'effect' || step.kind === 'claim');
    // A queued step is still first on the pending list until it runs; leave it out of the 'before' picture.
    const snap = (pending = s.pending) => JSON.stringify({...s, log: null, rng: null, pending});
    const before = watch ? snap(step.queued ? s.pending.slice(1) : s.pending) : null, vpBefore = watch ? s.animals[actor].vp : 0;
    runStep(s, step, copy(choice));
    if (watch) {
      const cards = seats[actor].cards ??= {};
      if (step.kind === 'claim' && choice.card) (cards[choice.card] ??= {taken:0, empty:0, vp:0}).taken++;
      if (step.kind === 'effect') {
        const rec = cards[step.name] ??= {taken:0, empty:0, vp:0};
        rec.used = (rec.used || 0) + 1;
        if (snap() === before) rec.empty++;
        rec.vp += s.animals[actor].vp - vpBefore;
      }
    }
  }
  throw new Error('Reached the step limit at turn ' + s.turn + ' in ' + s.phase + '.');
}
