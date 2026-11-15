// Neural-network training data (loaded into the game context after game.js).
// nnContinue: the benchmark's game loop (playBenchmark in game.js) without its bookkeeping, so a game can be
// continued from any position. nnResample: re-deals what the player cannot see. nnSampleGame: plays one game and,
// at sampled Planning placements of the player, plays the top candidate spaces out to the end on shared re-dealt futures.

function nnRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function nnOutcome(s, human) {
  const [winner] = standings(s);
  return {win: winner === human ? 1 : 0, margin: s.animals[human].vp - Math.max(...s.rivals.map(id => s.animals[id].vp)), turns: s.turn};
}
// Play on from s to the end. onPlan(s) may return the player's space at a Planning placement (else the policy's).
function nnContinue(s, supply, seed, human, player, policy, onPlan = null) {
  for (let stepCount = 0; stepCount < 1800; stepCount++) {
    validateState(s);
    const stalled = s.turn > 30;
    if (s.phase === 'finished' || stalled) {
      if (!stalled && !s.usedCards.includes('Ice Age')) throw new Error('Finished without Ice Age.');
      return {...nnOutcome(s, human), ...(stalled ? {stalled: true} : {})};
    }
    if (s.phase === 'supply') { enterSupply(s, nextSupply(s, supply, seed)); continue; }
    if (s.phase === 'planning') {
      const {actor} = currentPlanner(s);
      if (actor === human) place(s, (onPlan && onPlan(s)) || player.place(s, actor, policy));
      else botPlacement(s);
      continue;
    }
    const step = nextStep(s);
    const choice = step.kind === 'symbiosis' ? symbioticDraw(s, step, seed) :
      step.actor === human ? player.choose(s, step, policy) : botAction(s, step);
    runStep(s, step, copy(choice));
  }
  throw new Error('Reached the step limit at turn ' + s.turn + ' in ' + s.phase + '.');
}
// Re-deal hidden information on s (a copy): rival card decks and the engine's shuffles, the unseen Dominance
// Cards (Ice Age stays at the bottom) and the face-down terrain tiles. Returns the new supply and a new seed
// for later element-bag and Symbiotic draws.
function nnResample(s, supply, rnd) {
  const mix = list => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  for (const d of Object.values(s.decks)) d.queue = mix(d.queue);
  s.rng = Math.floor(rnd() * 4294967296) >>> 0;
  const iceAge = supply.cards.includes('Ice Age') ? ['Ice Age'] : [];
  const tiles = mix(supply.stacks.flat());
  let k = 0;
  return {
    supply: {cards: [...mix(supply.cards.filter(card => card !== 'Ice Age')), ...iceAge], stacks: supply.stacks.map(stack => tiles.slice(k, k += stack.length))},
    seed: Math.floor(rnd() * 4294967296) >>> 0,
  };
}
// One game from scenario sc. Each Planning placement of the player is sampled with probability opts.rate: its top
// opts.k spaces (by the policy's own scores) are each played out on opts.m re-dealt futures, the same futures for
// every candidate. The game itself goes on with the policy's choice.
function nnSampleGame(sc, player, opts) {
  const s = newGame(sc.human, sc.rivals, sc.short, sc.seed);
  const supply = makeSupplies(s, sc.seed);
  const rnd = nnRandom(sc.seed ^ 0x5bd1e995);
  const samples = [];
  const onPlan = st => {
    if (rnd() >= opts.rate) return null;
    const scores = player.scores(st, sc.human, sc.policy);
    if (!scores || scores.length < 2) return null;
    const ranked = [...scores].sort((a, b) => b.value - a.value);
    const cands = ranked.slice(0, opts.k).map(c => ({...c, win: 0, margin: 0}));
    for (let m = 0; m < opts.m; m++) {
      const base = copy(st);
      const dealt = nnResample(base, supply, nnRandom(Math.floor(rnd() * 4294967296)));
      for (const c of cands) {
        const s2 = copy(base);
        place(s2, c.slot);
        const g = nnContinue(s2, copy(dealt.supply), dealt.seed, sc.human, player, sc.policy);
        c.win += g.win / opts.m;
        c.margin += g.margin / opts.m;
      }
    }
    samples.push({features: player.features(st, sc.human), turn: st.turn,
      cands: cands.map(c => [NN_SLOT_INDEX[c.slot], +c.tuned.toFixed(4), +c.residual.toFixed(4), +c.win.toFixed(4), +c.margin.toFixed(3)])});
    return null;
  };
  const game = nnContinue(s, supply, sc.seed, sc.human, player, sc.policy, onPlan);
  return {game, samples};
}
const NN_SLOT_INDEX = Object.fromEntries(ALL_SLOTS.map((key, i) => [key, i]));
