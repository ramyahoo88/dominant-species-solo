#!/usr/bin/env node
const assert = require('node:assert/strict');
const {availableParallelism} = require('node:os');
const {parseArgs} = require('node:util');
const {Worker, isMainThread, parentPort, workerData} = require('node:worker_threads');
const {load, resolveVersion, PLAYER_REFERENCE} = require('./benchmark/load.cjs');

const OUTCOMES = ['resolved', 'declined', 'noTarget'];
const round = n => Number(n.toFixed(3));
const mean = values => values.reduce((sum, n) => sum + n, 0) / values.length;
const won = game => Number(game.winner === game.human);

function collect(games) {
  if (!games.length) return null;
  const animals = {};
  const byRow = {};
  let blocks = 0, ties = 0;
  for (const game of games) {
    if (game.winningMargin === 0) ties++;
    for (const [id, seat] of Object.entries(game.seats)) {
      const table = animals[id] ??= {human: {games: 0, wins: 0}, rival: {games: 0, wins: 0}};
      const side = id === game.human ? table.human : table.rival;
      side.games++;
      if (id === game.winner) side.wins++;
      if (id === game.human) continue;
      blocks += seat.blocks;
      for (const [row, counts] of Object.entries(seat.rows)) {
        const dest = byRow[row] ??= Object.fromEntries(OUTCOMES.map(key => [key, 0]));
        for (const key of OUTCOMES) dest[key] += counts[key];
      }
    }
  }
  const perGame = Object.fromEntries(OUTCOMES.map(key =>
    [key, round(Object.values(byRow).reduce((sum, counts) => sum + counts[key], 0) / games.length)]));
  return {
    games: games.length,
    humanWins: games.reduce((n, game) => n + won(game), 0),
    humanWinRate: round(mean(games.map(won))),
    winningVPTies: ties,
    meanHumanMargin: round(mean(games.map(game => game.humanMargin))),
    meanWinningMargin: round(mean(games.map(game => game.winningMargin))),
    meanTurns: round(mean(games.map(game => game.turns))),
    rivalPawnOutcomesPerGame: perGame,
    rivalDenialPlacements: blocks,
    rivalPawnOutcomesByRow: byRow,
    animals,
  };
}

function pairedComparison(a, b) {
  // Cluster by physical setup because all policies share that setup's seed.
  const clusters = new Map();
  const switches = {bothWin: 0, baselineOnly: 0, candidateOnly: 0, bothLose: 0};
  for (let i = 0; i < a.length; i++) {
    const left = a[i], right = b[i];
    for (const key of ['human', 'rivals', 'seed', 'short', 'policy', 'openingSupply']) assert.deepEqual(left[key], right[key]);
    const key = JSON.stringify([left.human, left.rivals, left.seed, left.short]);
    const differences = clusters.get(key) ?? [];
    differences.push(won(right) - won(left));
    clusters.set(key, differences);
    if (won(left)) switches[won(right) ? 'bothWin' : 'baselineOnly']++;
    else switches[won(right) ? 'candidateOnly' : 'bothLose']++;
  }
  const differences = [...clusters.values()].map(mean);
  const avg = mean(differences);
  let interval = null;
  if (differences.length > 1) {
    const variance = differences.reduce((n, d) => n + (d - avg) ** 2, 0) / (differences.length - 1);
    const width = 1.96 * Math.sqrt(variance / differences.length);
    interval = [round(Math.max(-100, 100 * (avg - width))), round(Math.min(100, 100 * (avg + width)))];
  }
  return {candidateHumanWinRateChangePP: round(100 * avg), approximate95PercentIntervalPP: interval,
    pairedSetups: differences.length, switches};
}

function worker() {
  const {refs, entries, trace} = workerData;
  const player = load(PLAYER_REFERENCE, ['player']);
  const strategy = {place: player.get('playerPlacement'), choose: player.get('playerChoice')};
  const runs = refs.map((ref, i) => {
    const runtime = load(ref, ['game']);
    if (i === 1 && workerData.paper !== null) {
      // Paper rivals: table-playable rules from source/paper/paper.js, with extra action pawns as the difficulty level.
      runtime.run('var PAPER = ' + JSON.stringify({place: true, all: true, extraAP: workerData.paper}) + ';');
      runtime.run(require('node:fs').readFileSync(require('node:path').join(__dirname, 'paper/paper.js'), 'utf8'));
    }
    return runtime.get('playBenchmark');
  });
  for (const {index, scenario} of entries) {
    try {
      parentPort.postMessage({index, games: runs.map(run => run(scenario, strategy, trace))});
    } catch (error) {
      throw new Error('Failed scenario ' + JSON.stringify(scenario) + '\n' + error.stack);
    }
  }
}

async function main() {
  const args = parseArgs({
    options: {
      base: {type: 'string', default: '75bc518'},
      candidate: {type: 'string', default: '3a7e6d0'},
      seed: {type: 'string', default: '6200'},
      repeats: {type: 'string', default: '1'},
      workers: {type: 'string', default: String(Math.min(4, availableParallelism()))},
      paper: {type: 'string'},
      policy: {type: 'string', multiple: true},
      length: {type: 'string', default: 'both'},
      human: {type: 'string'},
      rivals: {type: 'string'},
      trace: {type: 'boolean'},
      detail: {type: 'boolean'},
      help: {type: 'boolean'},
    },
  }).values;
  if (args.help) {
    process.stdout.write([
      'node source/benchmark.cjs [--base COMMIT] [--candidate COMMIT|worktree]',
      '  [--seed 6200] [--repeats 1] [--workers 4] [--paper EXTRA_PAWNS]',
      '  [--policy majority|dominance|expansion] [--length both|short|full]',
      '  [--human insects] [--rivals birds,reptiles] [--detail] [--trace]',
      'Each repeat runs every selected matchup and policy on one physical setup.',
    ].join('\n') + '\n');
    return;
  }
  const seed = Number(args.seed), repeats = Number(args.repeats), nWorkers = Number(args.workers);
  assert(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Use a uint32 seed.');
  assert(Number.isInteger(repeats) && repeats > 0 && repeats <= 1000, 'Use 1 to 1000 repeats.');
  assert(Number.isInteger(nWorkers) && nWorkers > 0 && nWorkers <= 64, 'Use 1 to 64 workers.');
  assert(['both', 'short', 'full'].includes(args.length), 'Choose both, short, or full.');
  const refs = [resolveVersion(args.base), resolveVersion(args.candidate)];
  const rules = load(PLAYER_REFERENCE, ['player']);
  const animals = [...rules.get('FOOD')], policies = args.policy ?? Object.keys(rules.get('POLICIES'));
  assert(policies.length && new Set(policies).size === policies.length && policies.every(id => Object.hasOwn(rules.get('POLICIES'), id)), 'Choose distinct known policies.');
  assert(!args.human || animals.includes(args.human), 'Choose a known human animal.');
  const selectedRivals = args.rivals?.split(',');
  assert(!selectedRivals || selectedRivals.length === 2 && new Set(selectedRivals).size === 2 && selectedRivals.every(id => animals.includes(id)),
    'Choose two distinct known rivals.');
  const entries = [];
  let offset = 0;
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (const human of animals) {
      const others = animals.filter(id => id !== human);
      for (const [j, first] of others.entries()) for (const second of others.slice(j + 1)) {
        const trialSeed = (seed + offset++) >>> 0;
        if (args.human && args.human !== human) continue;
        const rivals = [first, second];
        if (selectedRivals && !selectedRivals.every(id => rivals.includes(id))) continue;
        const short = args.length === 'both' ? (trialSeed + repeat) % 2 === 0 : args.length === 'short';
        for (const policy of policies) entries.push({index: entries.length, scenario: {human, rivals, seed: trialSeed, short, policy}});
      }
    }
  }
  assert(entries.length, 'No matchups match those filters.');
  const count = Math.min(nWorkers, entries.length);
  const parts = Array.from({length: count}, () => []);
  entries.forEach((entry, i) => parts[i % count].push(entry));
  const games = Array(entries.length);
  await Promise.all(parts.map(part => new Promise((ok, fail) => {
    const thread = new Worker(__filename, {workerData: {refs, entries: part, trace: args.trace, paper: args.paper === undefined ? null : Number(args.paper)}});
    thread.on('message', ({index, games: pair}) => { games[index] = pair; });
    thread.once('error', fail);
    thread.once('exit', code => code === 0 ? ok() : fail(new Error('Benchmark worker exited ' + code)));
  })));
  assert(games.filter(Boolean).length === entries.length, 'A worker did not report every matchup.');
  const left = games.map(pair => pair[0]), right = games.map(pair => pair[1]);
  const slice = (field, value) => [left, right].map(list => list.filter(game => game[field] === value));
  const summarize = (a, b) => a.length ? {base: collect(a), candidate: collect(b), paired: pairedComparison(a, b)} : null;
  const result = {
    referencePlayer: PLAYER_REFERENCE, baseRef: refs[0], candidateRef: refs[1], seed, repeats,
    ...summarize(left, right),
    byPolicy: Object.fromEntries(policies.map(policy => [policy, summarize(...slice('policy', policy))])),
    byLength: {short: summarize(...slice('short', true)), full: summarize(...slice('short', false))},
    ...(args.detail || args.trace ? {games} : {}),
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (isMainThread) main().catch(error => {console.error(error); process.exitCode = 1;});
else worker();
