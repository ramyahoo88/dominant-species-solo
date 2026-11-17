// Stress test for The Red Queen (guided): complete games through the app's own start path, with a player who places
// at random, forfeits often and mixes both rival systems' choosers, so the rivals meet boards a careful player never makes.
// v1.0.0 pre-release audit. Every step: validateState plus element, cube and pawn counts. About one step in fifty the game
// continues from a JSON copy (what a save holds), which must equal the live state; every game is then replayed from its
// seed without those reloads and must end identically. No rival decision may fall outside the printed rules
// (PAPER_FALLBACKS stays empty) and every placement must name one of the six printed Planning steps.
// usage: node source/redqueen_fuzz.cjs [gamesPerCell=3] [seedBase=9000]   (cells: 2-5 rivals x Easy..Expert)
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..'); const PER = Number(process.argv[2] || 3); const BASE = Number(process.argv[3] || 9000);
const ctx = vm.createContext({console, document:{getElementById:()=>({})}});
for (const f of ['src/data','src/decks','src/engine','src/bot','src/effects','paper/paper','src/ui'])
  vm.runInContext(fs.readFileSync(path.join(root,'source',f+'.js'),'utf8'), ctx, {filename:f+'.js'});
vm.runInContext(`
const R = seed => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
const DRAW_TERRAIN = LARGE_TERRAIN.flatMap(t => Array(t === 'sea' ? 6 : 3).fill(t));
function shuf(r, a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
const stats = {games:0, steps:0, turns:[], roundtrips:0, rtFail:0, errors:[], fallbacks:{}, zeroDom:0, domPawns:0, giveaway:0, finishedNoIceAge:0, stalled:0, humanWins:0, illegalSkips:0, rows:{}, passes:{}, cards:{}, emptyEarth:0, fullDisplay:0, preRounds:0};
function inv(s, where) {
  validateState(s);
  // extra invariants
  for (const id of s.ids) {
    const a = s.animals[id];
    if (a.ap < 0 || a.remaining < 0 || a.pool < 0 || a.dead < 0) throw new Error('negative counter ' + id + ' ' + where);
    if (pawnCount(s,id) + (s.phase === 'planning' ? a.remaining : 0) > a.ap) throw new Error('pawns exceed ap ' + id + ' ' + where);
  }
  for (const k of Object.keys(s.corners)) if (!CORNER_TILES[k].some(t => s.tiles[t])) throw new Error('floating disk ' + where);
  const total = ELEMENT_IDS.map(t => bagCount(s,t) + Object.values(s.corners).filter(x => x === t).length + s.ids.reduce((n,id) => n + s.animals[id].added.filter(x => x === t).length, 0) + elementRows.reduce((n,row) => n + s.boxes[row].filter(x => x === t).length, 0));
  if (new Set(total).size !== 1 || total[0] !== 20) throw new Error('element count ' + JSON.stringify(total) + ' ' + where);
}
function play(human, rivals, short, seed, extra, mode, reload = true) {
  const r = R(seed * 7919 + 13);
  let s = newGame(human, rivals, short, seed, {extra});
  const cards = [...shuf(r, DOMINANCE.filter(c => c !== 'Ice Age' && (!short || !SHORT_EXCLUDES.includes(c)))), 'Ice Age'];
  const large = shuf(r, DRAW_TERRAIN); const stacks = [0,1,2].map(i => large.slice(8*i, 8*i+8));
  let steps = 0; const trace = [];
  for (; steps < 6000; steps++) {
    inv(s, 'turn ' + s.turn + ' ' + s.phase + ' step ' + steps);
    if (s.phase === 'finished') break;
    if (s.turn > 40) { stats.stalled++; break; }
    // save -> restore: continue from a JSON copy (what localStorage/export would hold); must behave identically
    if (r() < 0.02 && reload) { const t = JSON.parse(JSON.stringify(s)); validateState(t); if (JSON.stringify(t) !== JSON.stringify(s)) stats.rtFail++; s = t; stats.roundtrips++; }
    if (s.phase === 'supply') {
      const bag = shuf(r, ELEMENT_IDS.flatMap(t => Array(bagCount(s,t)).fill(t)));
      const market = [...s.market]; for (const i of nextCardSlots(s)) market[i] = cards.shift();
      const v = {market, stacks:s.stacks.map((st,i) => st.face || (st.left ? stacks[i].shift() : null))};
      for (const row of ['adaptation','abundance','wanderlust']) v[row] = Array.from({length:4}, () => bag.shift() ?? null);
      enterSupply(s, v);
      if (s.paper?.pre) stats.preRounds++;
      if (paperEmptyEarth(s)) stats.emptyEarth++;
      continue;
    }
    if (s.phase === 'planning') {
      const {actor} = currentPlanner(s);
      if (actor === human) {
        const open = ALL_SLOTS.filter(k => !s.pawns[k]);
        let slot;
        if (mode === 'random' || r() < 0.3) slot = open[Math.floor(r() * open.length)];
        else slot = paperPlacement(s, actor, Math.floor(r()*8)).slot;
        place(s, slot);
      } else {
        const c = botPlacement(s);
        const row = splitSlot(c.slot).row;
        (stats.rows[row] ??= 0); stats.rows[row]++;
        if (!/^Red Queen, (Domination first|Barren Earth|Block the leader|Card action [123]|Fallback|Last resort): /.test(c.reason)) throw new Error('reason ' + c.reason);
      }
      if (s.phase === 'execution' && s.ids.some(id => s.animals[id].remaining > 0)) stats.fullDisplay++;
      continue;
    }
    const step = nextStep(s);
    let choice;
    if (step.kind === 'symbiosis') {
      const bag = shuf(r, ELEMENT_IDS.flatMap(t => Array(bagCount(s,t)).fill(t)));
      choice = {draws:Object.fromEntries(step.recipients.map((a,i) => [a, bag[i] ?? null])), label:'draws'};
    } else if (step.actor === human && step.kind === 'pawn' && (mode === 'random' ? r() < 0.5 : r() < 0.15)) choice = {...PASS};
    else if (step.actor === human && r() < 0.5) { try { choice = _appBotAction(s, step); } catch (e) { choice = botAction(s, step); } }
    else choice = botAction(s, step);
    if (step.actor && step.actor !== human && step.kind !== 'symbiosis') {
      if (step.kind === 'pawn') { if (choice.pass) { (stats.passes[step.row] ??= 0); stats.passes[step.row]++; }
        if (step.row === 'domination' && choice.tile) { stats.domPawns++; const mine = tileScores(s, choice.tile).find(([id]) => id === step.actor)?.[1] || 0; if (!mine) { stats.zeroDom++; if (tileScores(s,choice.tile).length) stats.giveaway++; } } }
      if (step.kind === 'claim' && choice.card) { (stats.cards[choice.card] ??= 0); stats.cards[choice.card]++; }
      if (!/^Red Queen: /.test(choice.label || '') && !['regression','weather','extinction'].includes(step.kind) && !(step.kind === 'effect' && ['Biodiversity','Ecodiversity','Cold Snap','Disease','Ice Age','Immigrants','Intelligence','Omnivore','Parasitism','Niche Biomes','Nocturnal','Symbiotic'].includes(step.name)) && !(step.kind === 'pawn' && (choice.pass || step.row === 'domination')))
        throw new Error('non Red Queen label for ' + step.kind + ' ' + (step.row || step.name || '') + ': ' + choice.label);
    }
    runStep(s, step, JSON.parse(JSON.stringify(choice)));
  }
  if (steps >= 6000) throw new Error('step limit');
  if (s.phase === 'finished') { if (!s.usedCards.includes('Ice Age')) stats.finishedNoIceAge++; if (standings(s)[0] === human) stats.humanWins++; }
  stats.games++; stats.steps += steps; stats.turns.push(s.turn);
  return s;
}
function runAll(PER, BASE) {
  let n = 0;
  for (const count of [2,3,4,5]) for (const extra of [-2,-1,0,1]) for (let g = 0; g < PER; g++) {
    const seed = BASE + n++;
    const order = shuf(R(seed), FOOD); const human = order[0], rivals = order.slice(1, 1 + count);
    const short = g % 2 === 0, mode = g % 3 === 0 ? 'random' : 'mixed';
    try {
      const a = play(human, rivals, short, seed, extra, mode);
      // The same seed and inputs, this time without the reloads: the game must end in the same state.
      { const keep = JSON.stringify(stats); const b = play(human, rivals, short, seed, extra, mode, false);
        const errors = stats.errors; Object.assign(stats, JSON.parse(keep)); stats.errors = errors; stats.replays = (stats.replays || 0) + 1;
        if (JSON.stringify(a) !== JSON.stringify(b)) stats.errors.push('a game with reloads and its replay without them differ, seed ' + seed); }
    } catch (e) { stats.errors.push(count + ' rivals extra ' + extra + ' seed ' + seed + ' ' + mode + ': ' + e.message.split('\\n')[0]); }
  }
  stats.fallbacks = PAPER_FALLBACKS;
  stats.turns = {min:Math.min(...stats.turns), max:Math.max(...stats.turns), mean:+(stats.turns.reduce((a,b)=>a+b,0)/stats.turns.length).toFixed(1)};
  return stats;
}
globalThis.RUN = runAll;
`, ctx, {filename:'fuzz.js'});
const out = vm.runInContext('RUN(' + PER + ',' + BASE + ')', ctx);
const r = JSON.parse(JSON.stringify(out));
console.log(JSON.stringify({games: r.games, steps: r.steps, turns: r.turns, saveRoundTrips: r.roundtrips, roundTripFailures: r.rtFail, errors: r.errors,
  replaysWithoutReloads: r.replays, fallbacks: r.fallbacks, finishedWithoutIceAge: r.finishedNoIceAge, stalled: r.stalled, rivalPlacements: r.rows, rivalForfeits: r.passes,
  dominationPawns: r.domPawns, dominationForNoOwnVP: r.zeroDom}, null, 1));
assert.deepEqual(r.errors, [], 'errors');
assert.equal(r.rtFail, 0, 'a save-and-reload copy differed');
assert.equal(r.replays, r.games, 'every game is replayed');
assert.deepEqual(r.fallbacks, {}, 'a rival decision fell outside the printed rules');
assert.equal(r.finishedNoIceAge, 0);
console.error('PASS ' + r.games + ' Red Queen games, ' + r.steps + ' steps, ' + r.roundtrips + ' save round trips, ' + r.replays + ' replays without reloads.');
