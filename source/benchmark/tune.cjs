#!/usr/bin/env node
// Self-tuning test player. Opt-in; the published benchmark never loads it.
//
//   node source/benchmark.cjs --tune [--train-seed 210000] [--validate-seed 220000] [--generations 40]
//        [--pairs 8] [--games 64] [--validate-games 400] [--focus dominance] [--weights FILE] [--out FILE]
//        [--features base,phase,cards,cubes,elements,denial | all] [--resume CHECKPOINT] [--train-modes=app,-1,0,1,2]
//   node source/benchmark.cjs --evaluate [--weights FILE] [--seed 230000] [--per-cell 90] [--modes app,1] [--policies tuned,dominance]
//        [--compare v1=FILE,...] [--ablate phase,cards,...] [--net NET.json for the 'nn' policy]
//   node source/benchmark.cjs --nn-data --weights FILE [--net NET.json] --seed S --out PREFIX [--k 4 --m 2 --rate .07 --minutes 17]
//   node source/benchmark.cjs --selftest
//
// --features picks the weight groups the tuner moves (default base = the v1 weights); the others stay as --weights
// gives them. --resume continues a checkpoint (its current weights, best, history and generation count), so a long
// run can be split into short jobs. --compare adds other weight files as columns, --ablate adds the tuned weights
// with one group reset to its defaults (off); both play the same tables, and the output pools wins by level.
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

// Rival tables: the app's rivals, or paper rivals with that many extra pawns. From v0.5.0 (rivals plan first) the levels
// are Easy -2, Standard -1, Hard 0, Expert +1; +2 and +3 are beyond Expert. v0.4.0-v0.4.1: Easy -1 .. Expert +2 (run those
// rules with --paper-options noPlanFirst). Before v0.4.0: Easy 0 .. Expert 3.
const MODES = ['app', -2, -1, 0, 1];                // default for tuning, data and evaluation
const ALL_MODES = ['app', 0, 1, 2, 3, -1, -2];      // evaluation cell order: earlier cells keep their seeds
const MODE_NAME = {app: 'App', '-2': 'Easy', '-1': 'Standard', 0: 'Hard', 1: 'Expert', 2: 'Beyond Expert (+2)', 3: 'Beyond Expert (+3)'};
// '--modes=app,-1,0' or 'app,m1,0' (m1 = -1, for job files).
const parseModes = list => list.split(',').filter(Boolean).map(m => m === 'app' ? 'app' : +m.replace(/^m/, '-'));
const BOTS = [2, 3, 4, 5];
// --bots 3,4 limits which rival counts run (cell seeds stay as with all four).
let RUN_BOTS = BOTS;
const EVEN = {2: 1 / 3, 3: 1 / 4, 4: 1 / 5, 5: 1 / 6};

// Tuned numbers and how far a typical step moves each one.
const SCALES = {cardWeight: 2, nonOwner: .3, rivalWeight: .2, setup: 1.5, domCommit: 1, commit: .75, indexPen: .1,
  cap: 3, oppMin: .1, worthless: 1, wander: 2, initFirst: 1.5, initOther: 1.5, regDue: 3, regNot: 2, glacLater: 2, instinct: .3,
  reserve: 2, specCost: .15, loneTundra: .5, elemPen: .5, denyDeplete: 1, denyComp: 1, denyGlac: .3};
const GROUP_SCALE = {row: 1, late: 1, card: 1.5};
const NONNEGATIVE = ['nonOwner', 'rivalWeight', 'instinct', 'indexPen', 'oppMin'];
// Row weights that tuned.js never reads (those rows are valued by their own weights).
const UNUSED_ROWS = ['initiative', 'regression', 'domination'];
const BASE_KEYS = ['cardWeight', 'nonOwner', 'rivalWeight', 'setup', 'domCommit', 'commit', 'indexPen', 'cap', 'oppMin',
  'worthless', 'wander', 'initFirst', 'initOther', 'regDue', 'regNot', 'glacLater', 'instinct'];
const GROUPS = {
  base: d => [...Object.keys(d.row).filter(r => !UNUSED_ROWS.includes(r)).map(r => 'row.' + r), ...BASE_KEYS],
  phase: d => Object.keys(d.late).map(r => 'late.' + r),
  cards: d => Object.keys(d.card).map(c => 'card.' + c),
  cubes: () => ['reserve', 'specCost', 'loneTundra'],
  elements: () => ['elemPen'],
  denial: () => ['denyDeplete', 'denyComp', 'denyGlac'],
};
// Ablation-only groups (--ablate): the two drivers the balance agent found (Initiative climbing, Domination stacking).
// They overlap 'base' and 'phase', so --features doesn't use them.
const ABLATIONS = {
  initiative: () => ['initFirst', 'initOther', 'late.initiative'],
  domination: () => ['cardWeight', 'nonOwner', 'rivalWeight', 'setup', 'domCommit', 'late.domination'],
};
const groupKeys = (defaults, list) => (list === 'all' ? Object.keys(GROUPS) : list.split(',').filter(Boolean)).flatMap(g => {
  assert(GROUPS[g], 'Unknown feature group ' + g + '; use ' + Object.keys(GROUPS).join(', ') + ' or all.');
  return GROUPS[g](defaults);
});
// A full weights object: defaults, overlaid by a weights file (or a tune report's best).
const complete = (defaults, w = {}) => ({...defaults, ...w, row: {...defaults.row, ...w.row}, late: {...defaults.late, ...w.late}, card: {...defaults.card, ...w.card}});
const getKey = (w, k) => { const i = k.indexOf('.'); return i < 0 ? w[k] : w[k.slice(0, i)][k.slice(i + 1)]; };
function setKey(w, k, v) { const i = k.indexOf('.'); if (i < 0) w[k] = v; else w[k.slice(0, i)][k.slice(i + 1)] = v; }

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
  const player = load(PLAYER_REFERENCE, ['player', 'tuned', 'nn/features', 'nn/nnplayer']);
  const game = load('worktree', ['game', 'nn/driver']);
  // Paper rule candidates under test (e.g. initLeader), applied to every paper game.
  const options = Object.fromEntries((workerData?.paperOptions || []).map(o => [o, true]));
  // 'full' restores the retired detailed paper rules (as benchmark.cjs does); 'realMatch' turns flat matching off.
  if (options.full) for (const k of game.get('PAPER_DEFAULTS')) options[k] = false;
  if (options.realMatch) options.flatMatch = false;
  const play = game.get('playBenchmark');
  const strategy = {place: player.get('playerPlacement'), choose: player.get('playerChoice')};
  const setTuned = player.get('setTuned');
  // Neural-network player ('nn' policy): the net from --net, read once per worker.
  if (workerData?.netFile) player.get('setNet')(JSON.parse(readFileSync(workerData.netFile, 'utf8').replace(/^\uFEFF/, '')));
  const visible = player.get('visibleBoard'), features = player.get('nnFeatures'), scores = player.get('nnSlotScores');
  const nnPlayer = {...strategy, scores, features: (s, actor) => features(visible(s), actor)};
  const sampleGame = game.get('nnSampleGame');
  parentPort.on('message', ({id, weights, scenarios, nn}) => {
    if (weights) setTuned(weights);
    const out = scenarios.map(sc => {
      game.run('Object.assign(PAPER, ' + JSON.stringify(sc.mode === 'app' ? {place: false, all: false, extraAP: 0} : {place: true, all: true, extraAP: sc.mode, ...options}) + ')');
      try {
        if (nn) {
          const {game: g, samples} = sampleGame(sc, nnPlayer, nn);
          return {win: g.win, margin: g.margin, stalled: !!g.stalled, samples: samples.map(x => ({...x, features: Array.from(x.features)}))};
        }
        const g = play(sc, strategy);
        return {win: g.winner === g.human ? 1 : 0, margin: g.humanMargin, stalled: !!g.stalled};
      } catch (error) {
        return {win: 0, margin: -100, error: String(error.message).slice(0, 200), scenario: sc};
      }
    });
    parentPort.postMessage({id, out});
  });
  parentPort.postMessage({ready: true, defaults: JSON.parse(JSON.stringify(player.get('DEFAULT_WEIGHTS'))), featureSize: player.get('NN_FEATURE_SIZE'), featuresVersion: player.get('NN_FEATURES_VERSION'), slots: [...player.get('ALL_SLOTS')]});
}

// ---------------------------------------------------------------- pool
async function makePool(n, paperOptions = [], netFile = null) {
  const workers = [];
  let defaults, featureSize, featuresVersion, slots;
  await Promise.all(Array.from({length: n}, () => new Promise((ok, fail) => {
    const w = new Worker(__filename, {workerData: {paperOptions, netFile}});
    w.once('error', fail);
    w.once('message', msg => { ({defaults, featureSize, featuresVersion, slots} = msg); ok(); });
    workers.push(w);
  })));
  let next = 0;
  const pending = new Map();
  for (const w of workers) w.on('message', ({id, out}) => { const p = pending.get(id); pending.delete(id); p(out); });
  const send = (w, weights, scenarios, nn) => new Promise(ok => { const id = next++; pending.set(id, ok); w.postMessage({id, weights, scenarios, nn}); });
  // Play every (weights, scenarios) job, spreading each job's games over all workers.
  async function run(jobs) {
    const tasks = [];
    jobs.forEach((job, j) => {
      const chunk = Math.ceil(job.scenarios.length / workers.length);
      for (let k = 0; k < workers.length; k++) {
        const part = job.scenarios.slice(k * chunk, (k + 1) * chunk);
        if (part.length) tasks.push({j, at: k * chunk, weights: job.weights, part, nn: job.nn});
      }
    });
    const results = jobs.map(job => Array(job.scenarios.length));
    let t = 0;
    await Promise.all(workers.map(async w => {
      while (t < tasks.length) {
        const task = tasks[t++];
        const out = await send(w, task.weights, task.part, task.nn);
        out.forEach((g, i) => { results[task.j][task.at + i] = g; });
      }
    }));
    return results;
  }
  return {run, defaults, featureSize, featuresVersion, slots, size: workers.length, close: () => workers.forEach(w => w.terminate())};
}

// ---------------------------------------------------------------- scenarios
function scenarios(seed, count, animals, cell = null, modes = MODES) {
  const r = rng(seed);
  const pick = list => list[Math.floor(r() * list.length)];
  return Array.from({length: count}, (_, i) => {
    const bots = cell ? cell.bots : pick(RUN_BOTS);
    const mode = cell ? cell.mode : pick(modes);
    const order = [...animals];
    for (let k = order.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [order[k], order[m]] = [order[m], order[k]]; }
    const policy = cell?.policy ?? 'tuned';
    return {human: order[0], rivals: order.slice(1, bots + 1), seed: (seed * 7919 + i) >>> 0, short: r() < .5, policy, mode, bots};
  });
}
// Fitness: wins above the even-game rate for that table, so 2-rival and 5-rival games count alike; margin breaks ties.
const fitness = (games, scs) => games.reduce((n, g, i) => n + g.win - EVEN[scs[i].bots] + .002 * Math.max(-50, Math.min(50, g.margin)), 0) / games.length;
const winRate = games => games.reduce((n, g) => n + g.win, 0) / games.length;

// ---------------------------------------------------------------- weights <-> vector
// The tuned keys as a vector in units of their scale, measured from the defaults. Keys outside the vector keep
// the values in `fixed` (the starting weights).
function codec(defaults, keys, fixed) {
  const scale = k => k.includes('.') ? GROUP_SCALE[k.slice(0, k.indexOf('.'))] : SCALES[k];
  const encode = w => keys.map(k => (getKey(w, k) - getKey(defaults, k)) / scale(k));
  const decode = (z, focus) => {
    const w = complete(defaults, JSON.parse(JSON.stringify(fixed)));
    w.focus = focus;
    keys.forEach((k, i) => {
      let v = getKey(defaults, k) + z[i] * scale(k);
      if (NONNEGATIVE.includes(k)) v = Math.max(0, v);
      setKey(w, k, +v.toFixed(3));
    });
    return w;
  };
  return {keys, encode, decode};
}

// ---------------------------------------------------------------- modes
async function tune(args, pool, animals) {
  const focus = args.focus;
  const read = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const resumed = args.resume ? read(args.resume) : null;
  const startFile = resumed ? resumed.current : args.weights ? read(args.weights) : null;
  const fixed = complete(pool.defaults, startFile ? (startFile.best ?? startFile) : {});
  const features = args.features || resumed?.features || 'base';
  const {keys, encode, decode} = codec(pool.defaults, groupKeys(pool.defaults, features), fixed);
  let z = encode(fixed);
  const origin = resumed?.startWeights ? complete(pool.defaults, resumed.startWeights) : fixed;
  const P = +args.pairs, G = +args.games, sigma = +args.sigma, lr = +args.lr;
  const trainModes = args['train-modes'] || resumed?.settings?.trainModes || (resumed ? 'app,0,1,2,3' : MODES.join(','));
  const modes = parseModes(trainModes);
  const valSet = scenarios(+args['validate-seed'], +args['validate-games'], animals, null, modes);
  const history = resumed ? resumed.history : [];
  const validate = async w => { const [g] = await pool.run([{weights: w, scenarios: valSet}]); return {fit: fitness(g, valSet), win: winRate(g), errors: g.filter(x => x.error).slice(0, 3)}; };
  const initial = resumed ? {fit: resumed.start.fit, win: resumed.start.win} : await validate(decode(z, focus));
  let best = resumed ? {gen: resumed.bestGen, weights: resumed.best, fit: resumed.bestValFit, win: resumed.bestValWin} : {gen: 0, weights: decode(z, focus), ...initial};
  const first = history.length ? history[history.length - 1].gen + 1 : 1;
  const settings = {features, trainModes, trainSeed: +args['train-seed'], validateSeed: +args['validate-seed'], validateGames: +args['validate-games'],
    pairs: P, games: G, sigma, lr, start: resumed?.settings?.start ?? args.weights ?? 'defaults'};
  const t0 = Date.now();
  // moved: tuned keys that have moved at least half a step (in scale units) from the starting weights, best weights.
  const report = () => {
    const from = encode(origin), to = encode(complete(pool.defaults, best.weights));
    return {focus, features, settings, start: {fit: +initial.fit.toFixed(4), win: +initial.win.toFixed(3)}, best: best.weights,
      bestGen: best.gen, bestValFit: +best.fit.toFixed(4), bestValWin: +best.win.toFixed(3), current: decode(z, focus),
      moved: Object.fromEntries(keys.map((k, i) => [k, +(to[i] - from[i]).toFixed(2)]).filter(([, d]) => Math.abs(d) >= .5)),
      startWeights: origin, history};
  };
  for (let gen = first; gen < first + +args.generations; gen++) {
    const scs = scenarios(+args['train-seed'] + gen, G, animals, null, modes);
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
    if (gen % +args['validate-every'] === 0 || gen === first + +args.generations - 1) {
      const v = await validate(decode(z, focus));
      Object.assign(row, {valFit: +v.fit.toFixed(4), valWin: +v.win.toFixed(3)});
      if (v.errors.length) row.valErrors = v.errors;
      if (v.fit > best.fit) best = {gen, weights: decode(z, focus), ...v};
    }
    history.push(row);
    if (args.out) writeFileSync(args.out, JSON.stringify(report(), null, 1));
    process.stderr.write(JSON.stringify(row) + '\n');
  }
  return report();
}

// Wins pooled over cells, with a Wilson 95% interval in percent.
function pool95(wins, games) {
  if (!games) return {games, wins, pct: 0, ci95: [0, 0]};
  const p = wins / games, z = 1.96, d = 1 + z * z / games;
  const mid = (p + z * z / (2 * games)) / d, half = z * Math.sqrt(p * (1 - p) / games + z * z / (4 * games * games)) / d;
  return {games, wins, pct: +(100 * p).toFixed(1), ci95: [+(100 * (mid - half)).toFixed(1), +(100 * (mid + half)).toFixed(1)]};
}
// Paired difference on the same tables (column minus the tuned column), with a 95% interval in points.
function paired(a, b) {
  const d = a.map((g, i) => b[i].win - g.win);
  const mean = d.reduce((n, x) => n + x, 0) / d.length;
  const sd = Math.sqrt(d.reduce((n, x) => n + (x - mean) ** 2, 0) / Math.max(1, d.length - 1));
  const half = 1.96 * sd / Math.sqrt(d.length);
  return {games: d.length, diffPP: +(100 * mean).toFixed(1), ci95: [+(100 * (mean - half)).toFixed(1), +(100 * (mean + half)).toFixed(1)],
    onlyTuned: d.filter(x => x < 0).length, onlyOther: d.filter(x => x > 0).length};
}

async function evaluate(args, pool, animals) {
  const read = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const file = args.weights ? read(args.weights) : {};
  const weights = file.best ?? (Object.keys(file).length ? file : pool.defaults);
  const policies = args.policies ? args.policies.split(',') : ['tuned', 'majority', 'dominance', 'expansion'];
  const modes = args.modes ? parseModes(args.modes) : MODES;
  // Extra tuned columns: other weight files (--compare label=file) and ablations (--ablate group: that group off).
  const columns = policies.map(p => ({label: p, policy: p, weights}));
  for (const spec of (args.compare || '').split(',').filter(Boolean)) {
    const [label, path] = spec.includes('=') ? spec.split('=') : ['compare', spec];
    const w = read(path);
    columns.push({label, policy: 'tuned', weights: w.best ?? w});
  }
  for (const group of (args.ablate || '').split(',').filter(Boolean)) {
    const w = complete(pool.defaults, JSON.parse(JSON.stringify(weights)));
    for (const k of ABLATIONS[group] ? ABLATIONS[group]() : groupKeys(pool.defaults, group)) setKey(w, k, getKey(pool.defaults, k));
    columns.push({label: 'no_' + group, policy: 'tuned', weights: w});
  }
  // Column labels key the table rows and the pooled results, so they must be unique and must not reuse a row field
  // (GPT v0.4.1 re-audit: a --compare named 'dominance' merged two samples; one named 'extraPawns' overwrote the pawns).
  const labels = columns.map(c => c.label);
  const ROW_FIELDS = ['rivals', 'rivalsAre', 'extraPawns', 'even', 'errors', 'stalled'];
  for (const [i, label] of labels.entries()) {
    assert(/^[A-Za-z][A-Za-z0-9_.-]*$/.test(label), 'Column label ' + JSON.stringify(label) + ' must start with a letter and use only letters, digits and _ . -');
    assert(!ROW_FIELDS.includes(label), 'Column label ' + JSON.stringify(label) + ' is a table field (' + ROW_FIELDS.join(', ') + '); choose another.');
    assert(labels.indexOf(label) === i, 'Column label ' + JSON.stringify(label) + ' is used twice; give each column its own label (--compare label=file).');
  }
  const table = [];
  const games = Object.fromEntries(columns.map(c => [c.label, {}]));
  // Each cell's seeds stay the same whichever cells run. Cells of the earlier five tables (App, 0..3) keep their
  // earlier seeds; -1 cells come after them, then -2 cells (v0.5.0).
  const cellSeed = (bots, mode) => {
    const b = BOTS.indexOf(bots), m = ALL_MODES.indexOf(mode);
    return +args.seed + (m < 5 ? b * 5 + m : m === 5 ? BOTS.length * 5 + b : BOTS.length * 6 + b);
  };
  for (const bots of RUN_BOTS) for (const mode of modes) {
    assert(ALL_MODES.includes(mode), 'Unknown rival table ' + mode + '; use app or -2..3.');
    const base = scenarios(cellSeed(bots, mode), +args['per-cell'], animals, {bots, mode});
    const jobs = columns.map(c => ({weights: c.weights, scenarios: base.map(s => ({...s, policy: c.policy}))}));
    const res = await pool.run(jobs);
    const row = {rivals: bots, rivalsAre: MODE_NAME[mode], extraPawns: mode === 'app' ? null : mode, even: Math.round(100 * EVEN[bots])};
    columns.forEach((c, i) => {
      row[c.label] = Math.round(100 * winRate(res[i]));
      (games[c.label][MODE_NAME[mode]] ??= []).push(...res[i]);
    });
    const errors = res.flat().filter(x => x.error);
    if (errors.length) row.errors = errors.slice(0, 2);
    const stalled = res.flat().filter(x => x.stalled).length;
    if (stalled) row.stalled = stalled;
    table.push(row);
    process.stderr.write(JSON.stringify(row) + '\n');
  }
  const mean = p => Math.round(table.reduce((n, r) => n + r[p], 0) / table.length);
  const levels = Object.keys(games[columns[0].label]);
  const all = label => levels.flatMap(l => games[label][l]);
  const wins = list => list.reduce((n, g) => n + g.win, 0);
  const pooled = Object.fromEntries([...levels, 'All'].map(l => [l, Object.fromEntries(columns.map(c => {
    const list = l === 'All' ? all(c.label) : games[c.label][l];
    return [c.label, pool95(wins(list), list.length)];
  }))]));
  const vsTuned = columns[0].label !== 'tuned' ? {} : Object.fromEntries(columns.slice(1).map(c => [c.label,
    Object.fromEntries([...levels, 'All'].map(l => [l, l === 'All' ? paired(all('tuned'), all(c.label)) : paired(games.tuned[l], games[c.label][l])]))]));
  const errors = columns.reduce((n, c) => n + all(c.label).filter(g => g.error).length, 0);
  return {weights, perCell: +args['per-cell'], seed: +args.seed, overall: Object.fromEntries(columns.map(c => [c.label, mean(c.label)])),
    pooled, vsTuned, errors, table};
}

// Training data for the neural-network player (source/benchmark/nn): random tables played by the 'nn' policy (the
// tuned player from --weights plus the --net correction, or the tuned player alone with no --net). Sampled Planning
// placements carry their top --k spaces played out on --m shared re-dealt futures. Writes OUT.bin (float32 features,
// one row per sample) and OUT.jsonl (candidates [space, tuned value, net value, win rate, mean margin] and the table).
// Stops starting new batches after --minutes, so a job stays short.
async function nnData(args, pool, animals) {
  const {appendFileSync, existsSync, unlinkSync} = require('node:fs');
  assert(args.out, 'Give --out PREFIX (for PREFIX.bin and PREFIX.jsonl).');
  for (const ext of ['.bin', '.jsonl']) if (existsSync(args.out + ext)) unlinkSync(args.out + ext);
  writeFileSync(args.out + '.meta.json', JSON.stringify({featureSize: pool.featureSize, featuresVersion: pool.featuresVersion, slots: pool.slots,
    weights: args.weights || 'defaults', net: args.net || null, k: +args.k, m: +args.m, rate: +args.rate, seed: +args.seed}));
  const read = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const file = args.weights ? read(args.weights) : {};
  const weights = complete(pool.defaults, file.best ?? file);
  const opts = {k: +args.k, m: +args.m, rate: +args.rate, raw: !!args.raw};
  // One game per task, so a free worker always takes the next game (games differ a lot in playout count).
  const batch = pool.size * 4, limit = Date.now() + 60000 * +args.minutes;
  let start = +args.seed, games = 0, wins = 0, samples = 0, errors = [], stalled = 0;
  const t0 = Date.now();
  while (Date.now() < limit && games < +args['max-games']) {
    const scs = scenarios(start++, batch, animals, null, parseModes(args['train-modes'] || MODES.join(','))).map(sc => ({...sc, policy: 'nn'}));
    const res = (await pool.run(scs.map(sc => ({weights, scenarios: [sc], nn: opts})))).map(r => r[0]);
    for (let i = 0; i < res.length; i++) {
      const g = res[i];
      games++;
      if (g.error) { errors.push(g.error); continue; }
      wins += g.win; stalled += g.stalled ? 1 : 0;
      for (const x of g.samples) {
        appendFileSync(args.out + '.bin', Buffer.from(Float32Array.from(x.features).buffer));
        appendFileSync(args.out + '.jsonl', JSON.stringify({cands: x.cands, turn: x.turn, mode: scs[i].mode, bots: scs[i].bots, human: scs[i].human, ...(x.raw ? {raw: x.raw} : {})}) + '\n');
        samples++;
      }
    }
    process.stderr.write(JSON.stringify({games, samples, winRate: +(wins / games).toFixed(3), seconds: Math.round((Date.now() - t0) / 1000)}) + '\n');
  }
  return {featureSize: pool.featureSize, games, samples, winRate: +(wins / Math.max(1, games)).toFixed(3), stalled, errors: errors.slice(0, 5),
    errorCount: errors.length, seeds: [+args.seed, start - 1], perBatch: batch, opts, net: args.net || null, weights: args.weights || 'defaults',
    seconds: Math.round((Date.now() - t0) / 1000)};
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
    tune: {type: 'boolean'}, evaluate: {type: 'boolean'}, selftest: {type: 'boolean'}, 'nn-data': {type: 'boolean'},
    net: {type: 'string'}, k: {type: 'string', default: '4'}, m: {type: 'string', default: '2'}, rate: {type: 'string', default: '.07'},
    minutes: {type: 'string', default: '17'}, 'train-modes': {type: 'string'}, raw: {type: 'boolean'}, 'max-games': {type: 'string', default: '1000000'},
    workers: {type: 'string', default: String(availableParallelism())},
    'train-seed': {type: 'string', default: '210000'}, 'validate-seed': {type: 'string', default: '220000'},
    seed: {type: 'string', default: '230000'}, 'per-cell': {type: 'string', default: '90'},
    generations: {type: 'string', default: '40'}, pairs: {type: 'string', default: '8'}, games: {type: 'string', default: '64'},
    'validate-games': {type: 'string', default: '400'}, 'validate-every': {type: 'string', default: '4'},
    sigma: {type: 'string', default: '.5'}, lr: {type: 'string', default: '.6'},
    focus: {type: 'string', default: 'dominance'}, weights: {type: 'string'}, out: {type: 'string'},
    modes: {type: 'string'}, policies: {type: 'string'}, 'paper-options': {type: 'string', default: ''},
    features: {type: 'string'}, resume: {type: 'string'}, compare: {type: 'string'}, ablate: {type: 'string'}, bots: {type: 'string'},
  }}).values;
  assert(['majority', 'dominance', 'reach'].includes(args.focus), 'Focus is majority, dominance or reach.');
  if (args.bots) { RUN_BOTS = args.bots.split(',').map(Number); assert(RUN_BOTS.length && RUN_BOTS.every(b => BOTS.includes(b)), 'Rival counts are 2, 3, 4 or 5.'); }
  const pool = await makePool(Math.max(1, Math.min(64, +args.workers)), args['paper-options'].split(',').filter(Boolean), args.net || null);
  const animals = [...load(PLAYER_REFERENCE, ['player']).get('FOOD')];
  try {
    const result = args.selftest ? await selftest(pool, animals) : args['nn-data'] ? await nnData(args, pool, animals) :
      args.evaluate ? await evaluate(args, pool, animals) : await tune(args, pool, animals);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally { pool.close(); }
}

if (isMainThread) module.exports = {main};
else worker();
