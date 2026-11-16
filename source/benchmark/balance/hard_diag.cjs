// Diagnostic: where does a player's edge come from against paper rivals (a level) vs App rivals?
// usage: node hard_diag.cjs <repoRoot> <mode: app|-1|0|1|2> <bots> <games> <seed> <policy> [weightsFile] [paperOptions,comma]
const path = require('node:path');
const fs = require('node:fs');
const [root, modeArg, botsArg, gamesArg, seedArg, policy, weightsFile, optArg] = process.argv.slice(2);
const {load, PLAYER_REFERENCE} = require(path.join(root, 'source/benchmark/load.cjs'));
const player = load(PLAYER_REFERENCE, ['player', 'tuned', 'nn/features', 'nn/nnplayer']);
const game = load('worktree', ['game', 'nn/driver']);
if (weightsFile && weightsFile !== '-') {
  const w = JSON.parse(fs.readFileSync(weightsFile, 'utf8').replace(/^﻿/, ''));
  player.get('setTuned')(w.best ?? w);
}
const options = Object.fromEntries((optArg || '').split(',').filter(Boolean).map(o => [o, true]));
const mode = modeArg === 'app' ? 'app' : Number(modeArg);
game.run('Object.assign(PAPER, ' + JSON.stringify(mode === 'app' ? {place: false, all: false, extraAP: 0} : {place: true, all: true, extraAP: mode, ...options}) + ')');
// Attribute VP by source.
game.run(`
  var __vp = {}, __claims = {}, __lastDom = null, __domIdx = {};
  const __runStep = runStep;
  runStep = function(s, step, choice) {
    if (step.kind === 'pawn' && step.row === 'domination') { __lastDom = step.actor; __domIdx[step.actor + ':' + step.index] = (__domIdx[step.actor + ':' + step.index] || 0) + 1; }
    if (step.kind === 'claim' && choice?.card) { const k = (step.actor === s.human ? 'human' : 'rival') + '<-' + (__lastDom === s.human ? 'humanDom' : 'rivalDom'); __claims[k] = (__claims[k] || 0) + 1;
      if (step.actor === s.human) __claims['card:' + choice.card] = (__claims['card:' + choice.card] || 0) + 1; }
    const src = step.kind === 'pawn' ? step.row : step.kind === 'effect' ? 'card:' + step.name : step.kind;
    const before = Object.fromEntries(s.ids.map(id => [id, s.animals[id].vp]));
    const r = __runStep(s, step, choice);
    for (const id of s.ids) { const d = s.animals[id].vp - before[id]; if (d) { __vp[id] ??= {}; __vp[id][src] = (__vp[id][src] || 0) + d; } }
    return r;
  };
`);const strategy = {place: player.get('playerPlacement'), choose: player.get('playerChoice')};
const play = game.get('playBenchmark');
const FOOD = game.get('FOOD');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r = rng(+seedArg);
const bots = +botsArg;
const agg = {games: 0, wins: 0, humanVP: 0, bestRivalVP: 0, src: {}, rivalSrc: {}, humanRows: {}, rivalReasons: {}, rivalRows: {}, initPos: 0, initTurns: 0, initFirst: 0,
  humanCards: 0, rivalCards: 0, humanDomPawns: 0, turns: 0, claims: {}, domIdx: {}, cardVP: {}};
for (let i = 0; i < +gamesArg; i++) {
  const order = [...FOOD];
  for (let k = order.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [order[k], order[m]] = [order[m], order[k]]; }
  const sc = {human: order[0], rivals: order.slice(1, bots + 1), seed: (+seedArg * 7919 + i) >>> 0, short: r() < .5, policy};
  game.run('__vp = {}; __claims = {}; __domIdx = {}; __lastDom = null;');
  // Watch Planning: the human's Initiative position each turn.
  const seen = new Set();
  const g = play(sc, {
    place: (s, actor, pol) => {
      if (!seen.has(s.turn)) { seen.add(s.turn); const p = s.initiative.indexOf(actor); agg.initPos += p / (s.initiative.length - 1); agg.initFirst += p === 0 ? 1 : 0; agg.initTurns++; }
      const slot = strategy.place(s, actor, pol);
      const row = slot.split('-')[0];
      agg.humanRows[row] = (agg.humanRows[row] || 0) + 1;
      return slot;
    },
    choose: (s, step, pol) => {
      const c = strategy.choose(s, step, pol);
      if (step.kind === 'claim' && c?.card) agg.humanCards++;
      return c;
    },
  }, true);
  for (const e of g.events) {
    if (e.actor !== sc.human && e.slot && e.reason) {
      const why = e.reason.replace(/^(?:Red Queen|Paper rule), /, '').replace(/: .*/, '').replace(/ \d+$/, '');
      agg.rivalReasons[why] = (agg.rivalReasons[why] || 0) + 1;
      const row = e.slot.split('-')[0];
      agg.rivalRows[row] = (agg.rivalRows[row] || 0) + 1;
    }
  }
  const vp = game.get('__vp');
  for (const [k, v] of Object.entries(game.get('__claims'))) agg.claims[k] = (agg.claims[k] || 0) + v;
  for (const [k, v] of Object.entries(game.get('__domIdx'))) { const [a, i] = k.split(':'); const kk = (a === sc.human ? 'human' : 'rival') + ':dom' + (+i + 1); agg.domIdx[kk] = (agg.domIdx[kk] || 0) + v; }
  for (const [k, v] of Object.entries(vp[sc.human] || {})) if (k.startsWith('card:')) agg.cardVP[k] = (agg.cardVP[k] || 0) + v;
  for (const id of [sc.human, ...sc.rivals]) { const got = Object.values(vp[id] || {}).reduce((a, b) => a + b, 0); const rest = g.seats[id].vp - got; if (rest) { vp[id] ??= {}; vp[id].final = rest; } }
  agg.games++; agg.wins += g.winner === sc.human ? 1 : 0; agg.turns += g.turns;
  agg.humanVP += g.seats[sc.human].vp;
  const best = sc.rivals.reduce((b, id) => g.seats[id].vp > g.seats[b].vp ? id : b, sc.rivals[0]);
  agg.bestRivalVP += g.seats[best].vp;
  for (const [k, v] of Object.entries(vp[sc.human] || {})) agg.src[k.startsWith('card:') ? 'cards' : k] = (agg.src[k.startsWith('card:') ? 'cards' : k] || 0) + v;
  for (const [k, v] of Object.entries(vp[best] || {})) agg.rivalSrc[k.startsWith('card:') ? 'cards' : k] = (agg.rivalSrc[k.startsWith('card:') ? 'cards' : k] || 0) + v;
}
const per = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / agg.games).toFixed(2)]));
console.log(JSON.stringify({mode: modeArg, bots, policy, games: agg.games, winPct: +(100 * agg.wins / agg.games).toFixed(1), turns: +(agg.turns / agg.games).toFixed(1),
  humanVP: +(agg.humanVP / agg.games).toFixed(1), bestRivalVP: +(agg.bestRivalVP / agg.games).toFixed(1),
  initPos: +(agg.initPos / agg.initTurns).toFixed(3), initFirstPct: +(100 * agg.initFirst / agg.initTurns).toFixed(1),
  humanSrc: per(agg.src), bestRivalSrc: per(agg.rivalSrc), humanRows: per(agg.humanRows), rivalRowsPerRival: Object.fromEntries(Object.entries(per(agg.rivalRows)).map(([k, v]) => [k, +(v / bots).toFixed(2)])),
  claims: per(agg.claims), domIdx: per(agg.domIdx), humanCardVP: Object.fromEntries(Object.entries(per(agg.cardVP)).slice(0, 10)),
  rivalReasonsPerRival: Object.fromEntries(Object.entries(per(agg.rivalReasons)).map(([k, v]) => [k, +(v / bots).toFixed(2)]))}, null, 1));
