#!/usr/bin/env node
// Self-tuning test player. Opt-in; the published benchmark never loads it.
//
//   node source/benchmark.cjs --tune [--train-seed 210000] [--validate-seed 220000] [--generations 40]
//        [--pairs 8] [--games 64] [--validate-games 400] [--focus dominance] [--weights FILE] [--out FILE]
//   node source/benchmark.cjs --evaluate [--weights FILE] [--seed 230000] [--per-cell 90]
//   node source/benchmark.cjs --selftest
//
// The player is source/benchmark/tuned.js: the fixed 'dominance' player with every constant as a weight.
// Each game is against a random table: the app's rivals, or paper rivals at Easy..Expert, with 2-5 rivals.
// --tune runs an evolution strategy (antithetic pairs on shared seeds), validates the centre on a separate
// seed block, keeps the best validated weights and checkpoints them to --out every generation.
// --evaluate plays the tuned player and the three fixed policies on the same held-out tables.
const assert = require('node:assert/strict');
const {availableParallelism} = require('node:os');
const {parseArgs} = require('node:util');
const {readFileSync, writeFileSync} = require('node:fs');
const {Worker, isMainThread, parentPort, workerData} = require('node:worker_threads');
const {load, PLAYER_REFERENCE} = require('./load.cjs');

const MODES = ['app', 0, 1, 2, 3];           // app rivals, or paper rivals with that many extra pawns
const MODE_NAME = {app: 'App', 0: 'Easy', 1: 'Standard', 2: 'Hard', 3: 'Expert'};
const BOTS = [2, 3, 4, 5];
const EVEN = {2: 1 / 3, 3: 1 / 4, 4: 1 / 5, 5: 1 / 6};

// Tuned numbers and how far a typical step moves each one.
const SCALES = {cardWeight: 2, nonOwner: .3, rivalWeight: .2, setup: 1.5, domCommit: 1, commit: .75, indexPen: .1,
  cap: 3, oppMin: .1, worthless: 1, wander: 2, initFirst: 1.5, initOther: 1.5, regDue: 3, regNot: 2, glacLater: 2, instinct: .3};
const ROW_SCALE = 1;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- worker
function worker() {
  const player = load(PLAYER_REFERENCE, ['player', 'tuned']);
  const game = load('worktree', ['game']);
  const play = game.get('playBenchmark');
  const strategy = {place: player.get('playerPlacement'), choose: player.get('playerChoice')};
  const setTuned = player.get('setTuned');
  parentPort.on('message', ({id, weights, scenarios}) => {
    if (weights) setTuned(weights);
    const out = scenarios.map(sc => {
      game.run('Object.assign(PAPER, ' + JSON.stringify(sc.mode === 'app' ? {place: false, all: false, extraAP: 0} : {place: true, all: true, extraAP: sc.mode}) + ')');
      try {
        const g = play(sc, strategy);
        return {win: g.winner === g.human ? 1 : 0, margin: g.humanMargin, stalled: !!g.stalled};
      } catch (error) {
        return {win: 0, margin: -100, error: String(error.message).slice(0, 200), scenario: sc};
      }
    });
    parentPort.postMessage({id, out});
  });
  parentPort.postMessage({ready: true, defaults: JSON.parse(JSON.stringify(player.get('DEFAULT_WEIGHTS')))});
}

// ---------------------------------------------------------------- pool
async function makePool(n) {
  const workers = [];
  let defaults;
  await Promise.all(Array.from({length: n}, () => new Promise((ok, fail) => {
    const w = new Worker(__filename);
    w.once('error', fail);
    w.once('message', msg => { defaults = msg.defaults; ok(); });
    workers.push(w);
  })));
  let next = 0;
  const pending = new Map();
  for (const w of workers) w.on('message', ({id, out}) => { const p = pending.get(id); pending.delete(id); p(out); });
  const send = (w, weights, scenarios) => new Promise(ok => { const id = next++; pending.set(id, ok); w.postMessage({id, weights, scenarios}); });
  // Play every (weights, scenarios) job, spreading each job's games over all workers.
  async function run(jobs) {
    const tasks = [];
    jobs.forEach((job, j) => {
      const chunk = Math.ceil(job.scenarios.length / workers.length);
      for (let k = 0; k < workers.length; k++) {
        const part = job.scenarios.slice(k * chunk, (k + 1) * chunk);
        if (part.length) tasks.push({j, weights: job.weights, part});
      }
    });
    const results = jobs.map(() => []);
    let t = 0;
    await Promise.all(workers.map(async w => {
      while (t < tasks.length) {
        const task = tasks[t++];
        results[task.j].push(...await send(w, task.weights, task.part));
      }
    }));
    return results;
  }
  return {run, defaults, close: () => workers.forEach(w => w.terminate())};
}

// ---------------------------------------------------------------- scenarios
function scenarios(seed, count, animals, cell = null) {
  const r = rng(seed);
  const pick = list => list[Math.floor(r() * list.length)];
  return Array.from({length: count}, (_, i) => {
    const bots = cell ? cell.bots : pick(BOTS);
    const mode = cell ? cell.mode : pick(MODES);
    const order = [...animals].sort(() => r() - .5);
    const policy = cell?.policy ?? 'tuned';
    return {human: order[0], rivals: order.slice(1, bots + 1), seed: (seed * 7919 + i) >>> 0, short: r() < .5, policy, mode, bots};
  });
}
// Fitness: wins above the even-game rate for that table, so 2-rival and 5-rival games count alike; margin breaks ties.
const fitness = (games, scs) => games.reduce((n, g, i) => n + g.win - EVEN[scs[i].bots] + .002 * Math.max(-50, Math.min(50, g.margin)), 0) / games.length;
const winRate = games => games.reduce((n, g) => n + g.win, 0) / games.length;

// ---------------------------------------------------------------- weights <-> vector
function codec(defaults) {
  const keys = [...Object.keys(defaults.row).map(r => 'row.' + r), ...Object.keys(SCALES)];
  const scale = k => k.startsWith('row.') ? ROW_SCALE : SCALES[k];
  const get = (w, k) => k.startsWith('row.') ? w.row[k.slice(4)] : w[k];
  const encode = w => keys.map(k => (get(w, k) - get(defaults, k)) / scale(k));
  const decode = (z, focus) => {
    const w = {...defaults, focus, row: {...defaults.row}};
    keys.forEach((k, i) => {
      let v = get(defaults, k) + z[i] * scale(k);
      if (['nonOwner', 'rivalWeight', 'instinct', 'indexPen', 'oppMin'].includes(k)) v = Math.max(0, v);
      if (k.startsWith('row.')) w.row[k.slice(4)] = +v.toFixed(3); else w[k] = +v.toFixed(3);
    });
    return w;
  };
  return {keys, encode, decode};
}

// ---------------------------------------------------------------- modes
async function tune(args, pool, animals) {
  const {keys, encode, decode} = codec(pool.defaults);
  const focus = args.focus;
  const start = args.weights ? JSON.parse(readFileSync(args.weights, 'utf8')) : null;
  let z = start ? encode({...pool.defaults, ...(start.best ?? start), row: {...pool.defaults.row, ...(start.best ?? start).row}}) : keys.map(() => 0);
  const P = +args.pairs, G = +args.games, sigma = +args.sigma, lr = +args.lr;
  const valSet = scenarios(+args['validate-seed'], +args['validate-games'], animals);
  const history = [];
  const validate = async w => { const [g] = await pool.run([{weights: w, scenarios: valSet}]); return {fit: fitness(g, valSet), win: winRate(g), errors: g.filter(x => x.error).slice(0, 3)}; };
  const initial = await validate(decode(z, focus));
  let best = {gen: 0, weights: decode(z, focus), ...initial};
  const t0 = Date.now();
  for (let gen = 1; gen <= +args.generations; gen++) {
    const scs = scenarios(+args['train-seed'] + gen, G, animals);
    const r = rng(+args['train-seed'] * 31 + gen);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    const eps = Array.from({length: P}, () => keys.map(gauss));
    const jobs = eps.flatMap(e => [+1, -1].map(sign => ({weights: decode(z.map((v, i) => v + sign * sigma * e[i]), focus), scenarios: scs})));
    const results = await pool.run(jobs);
    const f = results.map(g => fitness(g, scs));
    const sd = Math.sqrt(f.reduce((n, x) => n + (x - f.reduce((a, b) => a + b) / f.length) ** 2, 0) / f.length) || 1;
    const grad = keys.map((_, i) => eps.reduce((n, e, k) => n + (f[2 * k] - f[2 * k + 1]) * e[i], 0) / (2 * P * sigma * sd));
    z = z.map((v, i) => Math.max(-6, Math.min(6, v + lr * grad[i])));
    const row = {gen, popMeanWin: +(results.reduce((n, g) => n + winRate(g), 0) / results.length).toFixed(3), seconds: Math.round((Date.now() - t0) / 1000)};
    const errors = results.flat().filter(x => x.error);
    if (errors.length) row.errors = errors.slice(0, 3);
    if (gen % +args['validate-every'] === 0 || gen === +args.generations) {
      const v = await validate(decode(z, focus));
      Object.assign(row, {valFit: +v.fit.toFixed(4), valWin: +v.win.toFixed(3)});
      if (v.fit > best.fit) best = {gen, weights: decode(z, focus), ...v};
    }
    history.push(row);
    const report = {focus, start: {fit: +initial.fit.toFixed(4), win: +initial.win.toFixed(3)}, best: best.weights,
      bestGen: best.gen, bestValFit: +best.fit.toFixed(4), bestValWin: +best.win.toFixed(3), current: decode(z, focus), history};
    if (args.out) writeFileSync(args.out, JSON.stringify(report, null, 1));
    process.stderr.write(JSON.stringify(row) + '\n');
  }
  return {focus, start: {fit: initial.fit, win: initial.win}, best: best.weights, bestGen: best.gen, bestValFit: best.fit, bestValWin: best.win, current: decode(z, focus), history};
}

async function evaluate(args, pool, animals) {
  const file = args.weights ? JSON.parse(readFileSync(args.weights, 'utf8')) : {};
  const weights = file.best ?? (Object.keys(file).length ? file : pool.defaults);
  const policies = ['tuned', 'majority', 'dominance', 'expansion'];
  const table = [];
  let cellSeed = +args.seed;
  for (const bots of BOTS) for (const mode of MODES) {
    const base = scenarios(cellSeed++, +args['per-cell'], animals, {bots, mode});
    const jobs = policies.map(policy => ({weights, scenarios: base.map(s => ({...s, policy}))}));
    const res = await pool.run(jobs);
    const row = {rivals: bots, rivalsAre: MODE_NAME[mode], even: Math.round(100 * EVEN[bots])};
    policies.forEach((p, i) => { row[p] = Math.round(100 * winRate(res[i])); });
    const errors = res.flat().filter(x => x.error);
    if (errors.length) row.errors = errors.slice(0, 2);
    table.push(row);
    process.stderr.write(JSON.stringify(row) + '\n');
  }
  const mean = p => Math.round(table.reduce((n, r) => n + r[p], 0) / table.length);
  return {weights, perCell: +args['per-cell'], seed: +args.seed, overall: Object.fromEntries(policies.map(p => [p, mean(p)])), table};
}

async function selftest(pool, animals) {
  // With default weights the tuned player must play exactly like the fixed 'dominance' policy.
  const base = scenarios(4242, 24, animals);
  const [a, b] = await pool.run([
    {weights: pool.defaults, scenarios: base.map(s => ({...s, policy: 'tuned'}))},
    {weights: pool.defaults, scenarios: base.map(s => ({...s, policy: 'dominance'}))}]);
  const same = a.every((g, i) => g.win === b[i].win && g.margin === b[i].margin);
  return {selftest: same ? 'PASS' : 'FAIL', games: base.length, tunedWins: a.filter(g => g.win).length, dominanceWins: b.filter(g => g.win).length,
    errors: [...a, ...b].filter(g => g.error).slice(0, 3)};
}

async function main(argv) {
  const args = parseArgs({args: argv, options: {
    tune: {type: 'boolean'}, evaluate: {type: 'boolean'}, selftest: {type: 'boolean'},
    workers: {type: 'string', default: String(availableParallelism())},
    'train-seed': {type: 'string', default: '210000'}, 'validate-seed': {type: 'string', default: '220000'},
    seed: {type: 'string', default: '230000'}, 'per-cell': {type: 'string', default: '90'},
    generations: {type: 'string', default: '40'}, pairs: {type: 'string', default: '8'}, games: {type: 'string', default: '64'},
    'validate-games': {type: 'string', default: '400'}, 'validate-every': {type: 'string', default: '4'},
    sigma: {type: 'string', default: '.5'}, lr: {type: 'string', default: '.6'},
    focus: {type: 'string', default: 'dominance'}, weights: {type: 'string'}, out: {type: 'string'},
  }}).values;
  assert(['majority', 'dominance', 'reach'].includes(args.focus), 'Focus is majority, dominance or reach.');
  const pool = await makePool(Math.max(1, Math.min(64, +args.workers)));
  const animals = [...load(PLAYER_REFERENCE, ['player']).get('FOOD')];
  try {
    const result = args.selftest ? await selftest(pool, animals) : args.evaluate ? await evaluate(args, pool, animals) : await tune(args, pool, animals);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally { pool.close(); }
}

if (isMainThread) module.exports = {main};
else worker();
