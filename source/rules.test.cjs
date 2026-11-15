const assert = require('node:assert/strict');
const {test} = require('node:test');
const {load, PLAYER_REFERENCE} = require('./benchmark/load.cjs');
const runtime = load('worktree', ['game']);
const verify = (name, code) => test(name, () => {
  runtime.get('globalThis').assert = assert;
  runtime.run('(() => {' + code + '})()');
});

verify('GMT p. 4: six APs and 50 cubes include one VP marker and four starting species', `
  for (const human of FOOD) {
    const s = newGame(human, FOOD.filter(a => a !== human).slice(0, 2), false, 15);
    assert.equal(s.animals[human].pool, 45);
    assert.equal(s.animals[human].ap, 6);
    assert.equal(sum(occupied(s,human).map(id => s.tiles[id].cubes[human])), 4);
    validateState(s);
  }
`);

verify('v0.1 through v0.3.8 save migration preserves inventory, pending choices, and random state', `
  for (const version of ['0.1.0','0.2.0','0.3.0','0.3.1','0.3.2','0.3.3','0.3.4','0.3.5','0.3.6','0.3.7','0.3.8']) {
    const s = newGame('insects',['mammals','birds'],true,51);
    s.version = version;
    s.phase = 'execution';
    s.pending = [{kind:'arrival',actor:'insects',tile:'E3',focus:'reach'}];
    const before = JSON.stringify({...s, version:VERSION});
    validateState(s);
    assert.equal(JSON.stringify(s), before);
    s.animals.insects.pool++;
    assert.throws(() => validateState(s), /valid Dominant Species/);
  }
`);

verify('GMT pp. 9–11: a duplicate Regression type costs one added element and Reptiles prevent one loss', `
  const s = newGame('insects',['reptiles','birds'],false,8);
  s.animals.insects.added = ['water','water','meat'];
  s.animals.reptiles.added = ['water','meat'];
  s.boxes.regression = ['water','water','meat'];
  assert.equal(regressionDue(s,'insects').drops,2);
  assert.equal(regressionDue(s,'reptiles').drops,1);
  s.pawns['regression-0'] = {actor:'insects'};
  assert.equal(regressionDue(s,'insects').drops,1);
  s.animals.reptiles.added = [];
  assert.equal(regressionDue(s,'reptiles').drops,0);
`);

verify('GMT p. 12: a Wasteland pawn protects one singleton type, and no type with duplicate tokens', `
  const s = newGame('birds',['insects','reptiles'],false,18);
  s.boxes.wasteland = ['grass','sun','water','water'];
  s.pawns['wasteland-0'] = {actor:'insects', focus:'conserve'};
  s.tiles.D3.cubes.insects = 1;
  const old = JSON.stringify(s);
  const doomed = doomedWastelandCorners(s);
  const choice = choosePawnTarget(s,{row:'wasteland',index:0,actor:'insects',focus:'conserve'});
  assert.equal(choice.pick,0);
  assert.deepEqual(doomed.map(key=>s.corners[key]).sort(),['sun','water']);
  assert.deepEqual(wastelandRemoval(s,2).map(key=>s.corners[key]).sort(),['grass','sun','water']);
  assert.equal(JSON.stringify(s),old);
  s.phase = 'execution';
  s.cursor = EXECUTION.indexOf('!wasteland') + 1;
  assert.equal(doomedWastelandCorners(s).length,0);
`);

verify('GMT p. 13: Glaciation returns extra cubes to the pool and clears a three-tundra corner', `
  const s = newGame('insects',['birds','arachnids'],false,3);
  const corner = VERTICES_OF.D3.find(key => CORNER_TILES[key].length === 3 && s.corners[key]);
  const [target, frozen] = CORNER_TILES[corner].filter(id => id !== 'D3');
  s.tiles[frozen].terrain = 'tundra';
  s.tiles[target].cubes.insects = 3;
  const pool = s.animals.insects.pool;
  const dead = s.animals.insects.dead;
  glaciation(s,'insects',target);
  assert.equal(s.tiles[target].cubes.insects,1);
  assert.equal(s.animals.insects.pool,pool+2);
  assert.equal(s.animals.insects.dead,dead);
  assert.equal(s.corners[corner],undefined);
`);

verify('GMT p. 14: Speciation uses a single shared corner and never exceeds the remaining pool', `
  const s = newGame('insects',['birds','reptiles'],false,18);
  s.animals.insects.pool = 2;
  const corner = VERTICES_OF.D3[0];
  const result = chooseSpeciation(s,corner,context(s,'insects','growth'));
  assert.ok(sum(Object.values(result.add)) <= 2);
  assert.ok(Object.keys(result.add).every(id => CORNER_TILES[corner].includes(id) && result.add[id] <= TERRAIN[s.tiles[id].terrain].cap));
  assert.equal(s.animals.insects.pool,2);
`);

verify('Planning forecasts earlier Speciation spending and repeated Adaptation capacity without changing state', `
  const s = newGame('birds',['insects','reptiles'],false,18);
  s.phase = 'planning';
  s.animals.insects.pool = 1;
  s.animals.insects.added = ['meat','sun','seed'];
  s.pawns['speciation-0'] = {actor:'insects',focus:'growth'};
  s.pawns['adaptation-0'] = {actor:'insects',focus:'conserve'};
  s.boxes.adaptation = ['water','grass','meat','seed'];
  const old = JSON.stringify(s);
  assert.ok(speciationPlanValue(s,'insects',['speciation-0'],'growth') > 0);
  assert.equal(fastValue(s,'insects','speciation',5,'growth',new Map()),0);
  assert.equal(fastValue(s,'insects','adaptation',1,'growth',new Map()),0);
  assert.equal(JSON.stringify(s),old);
`);

verify('Planning denial only targets a rival who can still place a pawn', `
  const s = newGame('birds',['insects','reptiles'],false,20);
  s.phase = 'planning';
  s.animals.reptiles.vp = 20;
  s.animals.reptiles.remaining = 1;
  s.animals.birds.remaining = 1;
  assert.equal(denialTarget(s,'insects'),'reptiles');
  s.animals.reptiles.remaining = 0;
  assert.equal(denialTarget(s,'insects'),'birds');
  s.animals.birds.remaining = 0;
  assert.equal(denialTarget(s,'insects'),null);
  const plan = planPlacement(s,'insects',0);
  assert.equal(plan.blockedRival,undefined);
`);

verify('GMT pp. 12, 14–16: distinguish declines, zero-effect choices, and lack of targets', `
  const s = newGame('insects',['reptiles','birds'],false,22);
  s.boxes.wasteland = ['water','water'];
  assert.equal(pawnOutcome(s,{row:'wasteland',index:0,actor:'birds'},PASS),'declined');
  assert.equal(pawnOutcome(s,{row:'adaptation',index:0,actor:'birds'},PASS),'noTarget');
  assert.equal(pawnOutcome(s,{row:'speciation',index:0,actor:'birds'},{add:{}}),'declined');
  s.animals.birds.pool = 0;
  assert.equal(pawnOutcome(s,{row:'speciation',index:0,actor:'birds'},PASS),'noTarget');
  assert.equal(pawnOutcome(s,{row:'migration',index:0,actor:'birds'},{moves:[]}),'declined');
  assert.equal(pawnOutcome(s,{row:'domination',index:0,actor:'birds'},PASS),'declined');
`);

verify('GMT p. 16: tile VP tie and Dominance Card go to independently determined animals', `
  const s = newGame('amphibians',['reptiles','birds'],false,10);
  s.tiles.D2.cubes = {amphibians:4,reptiles:2,birds:2};
  s.animals.reptiles.added = ['water','water','water','water'];
  s.animals.birds.added = [];
  s.market[0] = 'Habitat';
  assert.deepEqual(tileScores(s,'D2'),[['amphibians',8],['reptiles',4],['birds',2]]);
  assert.equal(cone(s,'D2'),'reptiles');
  s.phase = 'execution';
  s.pawns['domination-0'] = {actor:'birds',focus:'majority'};
  s.cursor = EXECUTION.indexOf('domination-0');
  runStep(s,nextStep(s),{tile:'D2'});
  assert.equal(nextStep(s).actor,'reptiles');
  assert.equal(nextStep(s).kind,'claim');
  assert.equal(s.animals.amphibians.vp,8);
`);

verify('GMT pp. 4 and 19: seeded physical supplies use a finite inventory and Ice Age last', `
  for (const short of [true,false]) {
    const s = newGame('reptiles',['birds','insects'],short,4);
    const supply = makeSupplies(s,99);
    const terrain = supply.stacks.flat();
    assert.equal(supply.cards.length,short ? 22 : 26);
    assert.equal(supply.cards.at(-1),'Ice Age');
    assert.equal(new Set(supply.cards).size,supply.cards.length);
    assert.equal(terrain.length,24);
    assert.ok(LARGE_TERRAIN.every(id => count(terrain,id) === (id === 'sea' ? 6 : 3)));
    assert.equal(new Set(Object.keys(s.decks)).size,2);
  }
`);

test('fixed player policies use the visible board and ignore rival decks and RNG', () => {
  const frozen = load(PLAYER_REFERENCE, ['player']);
  const decision = frozen.run(`
    (() => {
      const s = newGame('reptiles',['birds','insects'],true,4);
      s.phase = 'planning';
      s.animals.reptiles.remaining = 6;
      s.boxes.abundance = ['seed','grub','water','grass'];
      s.boxes.adaptation = ['sun','meat','seed','grass'];
      s.market[0] = 'Biodiversity';
      s.stacks[0].face = 'sea';
      const before = Object.keys(POLICIES).map(id => playerPlacement(s,'reptiles',id));
      const s2 = {...s,decks:{},seed:19,rng:22222,log:[{unused:true}]};
      return JSON.stringify(before) === JSON.stringify(Object.keys(POLICIES).map(id => playerPlacement(s2,'reptiles',id)));
    })()
  `);
  assert.equal(decision, true);
});

verify('v0.3.6: paper-rules games add difficulty pawns, use the printed rules, and survive validation', `
  const app = newGame('insects',['birds','arachnids'],true,40);
  assert.equal(app.paper, undefined);
  const s = newGame('insects',['birds','arachnids','mammals'],true,40,{extra:1});
  assert.deepEqual(s.paper, {extra:1});
  for (const id of s.rivals) assert.equal(s.animals[id].ap, 6);
  assert.equal(s.animals.insects.ap, 5);
  validateState(JSON.parse(JSON.stringify(s)));
  const bad = JSON.parse(JSON.stringify(s)); bad.paper.extra = 9;
  assert.throws(() => validateState(bad));
  s.phase = 'planning'; s.planning = 0; s.cursor = 0;
  for (const id of s.ids) s.animals[id].remaining = s.animals[id].ap;
  const planner = currentPlanner(s);
  if (planner && planner.actor !== s.human) assert.match(botPlacement(s).reason, /^Paper rule, /);
`);

verify('GPT audit A1: Evolution replaces cubes of at most two opposing animals, even with five opponents', `
  const s = newGame('mammals',['reptiles','birds','amphibians','arachnids','insects'],true,314159);
  s.animals.mammals.pool = 20;
  const choice = chooseEffect(s,{kind:'effect',actor:'mammals',name:'Evolution',tile:null});
  assert.ok(choice.hits.length <= 2, 'app chooser took ' + choice.hits.length);
  assert.ok(new Set(choice.hits.map(h => h.victim)).size === choice.hits.length);
`);

verify('GPT audit A3: Glaciation removes every element surrounded by three tundra tiles, not only on the covered tile', `
  const s = newGame('mammals',['birds','insects'],true,314159);
  const key = Object.keys(CORNER_TILES).find(k => CORNER_TILES[k].length === 3 && CORNER_TILES[k].every(t => s.tiles[t]));
  for (const t of CORNER_TILES[key]) s.tiles[t].terrain = 'tundra';
  s.corners[key] = 'meat';
  const target = glazeTargets(s).find(t => !CORNER_TILES[key].includes(t) && !VERTICES_OF[t].includes(key));
  assert.ok(target, 'no remote target');
  const text = glaciation(s,'mammals',target);
  assert.equal(s.corners[key], undefined);
  assert.match(text, /corner shared by/);
`);

verify('GPT audit P2–P4: paper Instinct reserves next turn, Aquatic places its element, Wasteland tests agree', `
  const s = newGame('mammals',['birds','insects'],true,314159,{extra:0});
  s.phase = 'execution'; s.cursor = EXECUTION.length - 1; s.ending = false;
  s.pawns = {[EXECUTION.at(-1)]: {actor:'insects', card:null, focus:null}};
  const inst = botAction(s,{kind:'effect',actor:'birds',name:'Instinct',tile:null});
  assert.ok(inst.slot && EXECUTION.indexOf(inst.slot) < s.cursor, 'paper Instinct did not reserve a next-turn space');
  assert.match(inst.label, /waits for next turn/);
  s.ending = true;
  const last = botAction(s,{kind:'effect',actor:'birds',name:'Instinct',tile:null});
  if (last.slot) assert.ok(EXECUTION.indexOf(last.slot) >= s.cursor);
  s.ending = false;
  const sea = terrainIds(s).find(t => !['sea','wetland','tundra'].includes(s.tiles[t].terrain) && VERTICES_OF[t].some(k => !s.corners[k]));
  s.tiles[sea].terrain = 'sea';
  const wet = terrainIds(s).filter(t => s.tiles[t].terrain === 'wetland');
  const types = ['meat','sun','seed','water','grub','grass'];
  VERTICES_OF[wet[0]].forEach((k,i) => { s.corners[k] = types[i]; });
  const roomy = terrainIds(s).filter(t => ['sea','wetland'].includes(s.tiles[t].terrain) && VERTICES_OF[t].some(k => !s.corners[k]));
  const aq = botAction(s,{kind:'effect',actor:'birds',name:'Aquatic',tile:null});
  assert.ok(roomy.length && aq.type && aq.corner, 'Aquatic skipped its element'); assert.ok(roomy.includes(aq.tile));
  for (const type of ['seed','water']) {
    s.boxes.wasteland = [type];
    const legal = paperLegal(s,'birds','wasteland',0);
    const act = botAction(s,{kind:'pawn',actor:'birds',row:'wasteland',index:0});
    assert.equal(legal, act.pick !== undefined && !act.pass, 'Wasteland Planning and Execution disagree for ' + type);
  }
`);

verify('GPT audit P1: paper instructions name positions, elements and corners', `
  const s = newGame('mammals',['birds','insects'],true,314159,{extra:0});
  s.boxes.abundance = ['seed'];
  const ab = botAction(s,{kind:'pawn',actor:'birds',row:'abundance',index:0});
  if (!ab.pass) assert.match(ab.label, /Abundance position 1 .*corner shared by .*corner \\d on/);
  const hab = botAction(s,{kind:'effect',actor:'birds',name:'Habitat',tile:null});
  if (!hab.skip) assert.match(hab.label, /Habitat: take \\w+ from the bag and place it at the corner shared by/);
`);

verify('Re-audit E7 + full display: the 41st pawn ends Planning with pawns still unplaced (full deck)', `
  const s = newGame('mammals',['reptiles','birds','amphibians','arachnids','insects'],false,373041,{extra:3});
  s.phase = 'planning'; s.planning = 0;
  for (const id of s.ids) s.animals[id].remaining = s.animals[id].ap + 4; // more pawns than the 41 spaces
  let guard = 0;
  while (s.phase === 'planning' && guard++ < 200) {
    const {actor} = currentPlanner(s);
    if (actor === s.human) place(s, ALL_SLOTS.find(k => !s.pawns[k])); else botPlacement(s);
  }
  assert.equal(ALL_SLOTS.length, 41);
  assert.equal(s.phase, 'execution');
  assert.ok(ALL_SLOTS.every(k => s.pawns[k]), 'display not full');
  assert.ok(s.ids.some(id => s.animals[id].remaining > 0), 'no pawns left unplaced: the test did not reach the full-display case');
`);

verify('Re-audit E7: Initiative on a full display advances the marker and returns the pawn (paper and app rivals)', `
  for (const paper of [{extra:0}, undefined]) {
    const s = newGame('mammals',['birds','insects'],true,314159,paper);
    s.phase = 'execution'; s.cursor = 0;
    for (const k of ALL_SLOTS) s.pawns[k] = {actor:'mammals', card:null, focus:null};
    s.pawns['initiative-0'] = {actor:'insects', card:null, focus:null};
    s.initiative = ['birds','insects','mammals'];
    const step = {kind:'pawn', actor:'insects', row:'initiative', index:0, key:'initiative-0', focus:'majority'};
    const choice = botAction(s, step);
    assert.ok(!choice.pass, (paper ? 'paper' : 'app') + ' rival forfeited Initiative');
    assert.equal(choice.slot, null);
    assert.match(choice.label, /returns/);
    resolvePawn(s, step, choice);
    assert.deepEqual(s.initiative, ['insects','birds','mammals']);
  }
`);

verify('Re-audit E2: paper rank counts animals below the VP cutoff (Migration from a zero-VP rank)', `
  const s = newGame('mammals',['birds','insects'],true,314159,{extra:0});
  for (const t of terrainIds(s)) for (const id of s.ids) s.tiles[t].cubes[id] = 0;
  for (const k of Object.keys(s.corners)) delete s.corners[k];
  const shared = Object.keys(CORNER_TILES).find(k => CORNER_TILES[k].includes('D3') && CORNER_TILES[k].includes('D2'));
  s.corners[shared] = 'seed';                          // Birds match D3 Tundra and D2 Wetland
  s.tiles.D3.cubes.mammals = 3; s.tiles.D3.cubes.birds = 2;
  assert.equal(pRank(s,'D3','birds'), 1, 'Birds rank second on D3 even though Tundra pays only first place');
  assert.equal(pLosesRank(s,'D3','birds'), false);
  const go = paperMigration(s,'birds',1);
  assert.deepEqual(go.moves.map(m => m.from + '>' + m.to), ['D3>D2']);
  // Control: Birds 2 vs Mammals 1. Moving one leaves 1-1 and Mammals win the food-chain tie: Birds would lose first place.
  s.tiles.D3.cubes.mammals = 1;
  assert.equal(pLosesRank(s,'D3','birds'), true);
  assert.equal(paperMigration(s,'birds',1).moves.length, 0);
`);

verify('Re-audit E3: paper Competition counts shared tiles, and the rank bonus follows the food chain', `
  const s = newGame('mammals',['birds','insects','reptiles','amphibians'],true,314159,{extra:0});
  for (const t of terrainIds(s)) for (const id of s.ids) s.tiles[t].cubes[id] = 0;
  s.tiles.D2.cubes.birds = 1; for (const id of ['mammals','insects','reptiles']) s.tiles.D2.cubes[id] = 1;  // one crowded wetland
  for (let index = 0; index < 4; index++) {
    const choices = competitionChoices(s,'birds',['tundra',COMPETITION_EDGES[index],COMPETITION_EDGES[index+1]]);
    assert.equal(paperSlotScore(s,'birds','competition',index), unique(choices.map(c => c.tile)).length);
  }
  // C4 Forest: Mammals 3, Birds 2. Removing a Mammal gives 2-2; Mammals keep first by the food chain: no rank bonus.
  s.tiles.C4.cubes.mammals = 3; s.tiles.C4.cubes.birds = 2;
  const vp = TERRAIN[s.tiles.C4.terrain].vp[0];
  assert.equal(paperHitScore(s,'C4','mammals','birds'), vp);
  // Insects 3, Birds 2: removing an Insect gives 2-2 and Birds now rank above Insects: bonus.
  s.tiles.C4.cubes.mammals = 0; s.tiles.C4.cubes.insects = 3;
  assert.equal(paperHitScore(s,'C4','insects','birds'), 2 * vp);
`);

verify('Re-audit E4: paper Evolution only replaces species on tiles the rival matches', `
  const s = newGame('mammals',['birds','insects'],true,314159,{extra:0});
  for (const t of terrainIds(s)) for (const id of s.ids) s.tiles[t].cubes[id] = 0;
  for (const k of Object.keys(s.corners)) delete s.corners[k];
  s.corners[VERTICES_OF.E3[0]] = 'seed';               // E3 has a disk (Birds match it); E4 has none
  s.tiles.E4.cubes.mammals = 1; s.tiles.E3.cubes.insects = 1; s.tiles.E3.cubes.birds = 1;
  s.animals.mammals.vp = 20; s.animals.insects.vp = 5; s.animals.birds.pool = 10;
  const evo = botAction(s,{kind:'effect',actor:'birds',name:'Evolution',tile:null});
  assert.deepEqual(evo.hits, [{tile:'E3', victim:'insects'}]);
  s.corners[VERTICES_OF.E4.find(k => !s.corners[k])] = 'grass';  // control: now Birds match E4 too
  const both = botAction(s,{kind:'effect',actor:'birds',name:'Evolution',tile:null});
  assert.deepEqual(both.hits.map(h => h.victim).sort(), ['insects','mammals']);
`);

verify('Re-audit E5: paper Fertile names the whole award', `
  const s = newGame('mammals',['birds','insects'],true,314159,{extra:0});
  for (const t of terrainIds(s)) for (const id of s.ids) s.tiles[t].cubes[id] = 0;
  s.tiles.D2.cubes.birds = 1; s.tiles.D2.cubes.mammals = 5; s.tiles.D2.cubes.insects = 1;
  const f = botAction(s,{kind:'effect',actor:'birds',name:'Fertile',tile:null});
  assert.equal(f.tile, 'D2');
  assert.match(f.label, /Birds gain 7 VP for all 7 species/);
  assert.equal(scoreCardPoints(s,'birds','Fertile',null,'D2'), 7);
`);

verify('Re-audit E6: paper Depletion plans only a removal it can execute', `
  const s = newGame('mammals',['birds','insects'],true,314159,{extra:0});
  for (const k of Object.keys(s.corners)) delete s.corners[k];
  s.corners[VERTICES_OF.D3[0]] = 'seed';               // Birds use Seed; no Sun on Earth
  s.boxes.depletion = ['sun','seed']; s.animals.birds.added = [];
  const step = {kind:'pawn',actor:'birds',row:'depletion',index:0};
  assert.equal(paperLegal(s,'birds','depletion',0), false);
  assert.ok(botAction(s,step).pass);
  s.corners[VERTICES_OF.D3[1]] = 'sun';                // control: a Sun disk on Earth
  assert.equal(paperLegal(s,'birds','depletion',0), true);
  assert.equal(botAction(s,step).corner, VERTICES_OF.D3[1]);
`);

verify('Re-audit E1: every Evolution chooser and the shared resolution respect two opponents', `
  const s = newGame('mammals',['reptiles','birds','amphibians','arachnids','insects'],true,314159);
  s.animals.mammals.pool = 20; s.phase = 'execution';
  const victims = ['reptiles','birds','amphibians'].map(id => ({tile:occupied(s,id)[0], victim:id}));
  assert.throws(() => runStep(s,{kind:'effect',actor:'mammals',name:'Evolution',tile:null},{hits:victims}), /at most two different opponents/);
  const twice = [victims[0], victims[0]];
  assert.throws(() => runStep(s,{kind:'effect',actor:'mammals',name:'Evolution',tile:null},{hits:twice}), /at most two different opponents/);
`);

test('Re-audit E1: the frozen benchmark player is capped at two Evolution victims', () => {
  const player = load(PLAYER_REFERENCE, ['player']);
  const out = JSON.parse(player.run(`(() => {
    const s = newGame('mammals',['reptiles','birds','amphibians','arachnids','insects'],true,314159);
    s.animals.mammals.pool = 20; s.animals.mammals.added = ['sun','seed','water','grub'];
    const step = {kind:'effect',actor:'mammals',name:'Evolution',tile:null};
    return JSON.stringify({raw: botAction(s,step).hits.length, capped: playerChoice(s,step,'dominance').hits});
  })()`));
  assert.ok(out.raw > 2, 'fixture no longer exercises the cap (raw ' + out.raw + ')');
  assert.ok(out.capped.length <= 2);
  assert.equal(new Set(out.capped.map(h => h.victim)).size, out.capped.length);
});

test('Re-audit v0.3.8: player Initiative needs a destination while a space is open; forfeit is separate; a full display returns the pawn', () => {
  const r = load('worktree', ['game']);
  r.run(require('node:fs').readFileSync(require('node:path').join(__dirname, 'src/forms.js'), 'utf8'));
  r.get('globalThis').assert = assert;
  r.run(`(() => {
    game = newGame('mammals',['birds','insects'],true,314159);
    game.phase = 'execution'; game.cursor = 0;
    for (const k of ALL_SLOTS) game.pawns[k] = {actor:'birds', card:null, focus:null};
    game.pawns['initiative-0'] = {actor:'mammals', card:null, focus:null};
    game.initiative = ['birds','mammals','insects'];
    delete game.pawns['adaptation-1'];                             // one open space
    const step = {kind:'pawn', actor:'mammals', row:'initiative', index:0, key:'initiative-0'};
    const open = pawnForm(step);
    assert.match(open, /<select name="slot" required>/, 'destination must be required while a space is open');
    assert.match(open, /value="adaptation-1"/);
    assert.match(open, /Forfeit action/);
    const fd = o => ({get: k => o[k] ?? null});                   // FormData returns null for absent fields
    const chose = makePawnChoice(step, fd({slot:'adaptation-1'}));
    assert.equal(chose.slot, 'adaptation-1');
    game.pawns['adaptation-1'] = {actor:'birds', card:null, focus:null}; // all 41 spaces taken
    const full = pawnForm(step);
    assert.doesNotMatch(full, /<select name="slot"/);
    assert.match(full, /pawn returns to you/);
    assert.match(full, /Forfeit action/);
    const back = makePawnChoice(step, fd({}));
    assert.equal(back.slot, null); assert.ok(!back.pass);
    resolvePawn(game, step, back);
    assert.deepEqual(game.initiative, ['mammals','birds','insects']);
  })()`);
});

verify('Re-audit v0.3.8: paper Migration: a tile that received species does not send any (constructed case)', `
  const s = newGame('mammals',['insects','birds'],true,314159,{extra:0});
  for (const t of terrainIds(s)) for (const id of s.ids) s.tiles[t].cubes[id] = 0;
  for (const k of Object.keys(s.corners)) delete s.corners[k];
  s.tiles.B3 = {terrain:'forest', cubes:Object.fromEntries(s.ids.map(id => [id,0]))};   // a tile next to C3 but not D3
  s.corners[VERTICES_OF.C3.find(k => !CORNER_TILES[k].includes('D3'))] = 'grass';   // Insects match C3...
  s.corners[VERTICES_OF.B3.find(k => !CORNER_TILES[k].includes('C3'))] = 'grass';   // ...and B3, but not D3
  s.tiles.D3.cubes.insects = 1; s.tiles.C3.cubes.insects = 1;
  // Move 1 rescues D3 -> C3 (C3 now has 2). C3 received, so it may not then send one on to B3.
  const {moves} = paperMigration(s,'insects',2);
  assert.deepEqual(moves.map(m => m.from + '>' + m.to + ' x' + m.n), ['D3>C3 x1']);
  // Control: with 2 Insects already on C3 and nothing to rescue, C3 may send one to the new tile B3.
  s.tiles.D3.cubes.insects = 0; s.tiles.C3.cubes.insects = 2;
  assert.deepEqual(paperMigration(s,'insects',2).moves.map(m => m.from + '>' + m.to), ['C3>B3']);
`);

verify('Re-audit v0.3.8: paper Migration lets each tile either send or receive, never both', `
  for (let seed = 1; seed <= 40; seed++) {
    const s = newGame('mammals',['birds','insects'],seed % 2 === 0,seed,{extra:0});
    for (const actor of ['birds','insects']) {
      const {moves} = paperMigration(s, actor, 7);
      const from = new Set(moves.map(m => m.from)), to = new Set(moves.map(m => m.to));
      for (const t of from) assert.ok(!to.has(t), 'tile ' + t + ' both sent and received (seed ' + seed + ')');
    }
  }
`);

verify('Re-audit v0.3.8: paper Evolution follows the printed score (2x into first, 1x rank gain, +3 dominant)', `
  const s = newGame('mammals',['birds','insects'],true,314159,{extra:0});
  for (const t of terrainIds(s)) for (const id of s.ids) s.tiles[t].cubes[id] = 0;
  for (const k of Object.keys(s.corners)) delete s.corners[k];
  s.corners[VERTICES_OF.D3.find(k => !CORNER_TILES[k].includes('D2'))] = 'grass';
  s.corners[VERTICES_OF.D2.find(k => !CORNER_TILES[k].includes('D3'))] = 'grass';
  // D3 Tundra (1): Mammals 1 -> the swap makes Birds first and dominant: 2x1 + 3 = 5.
  // D2 Wetland (8): Mammals 3, Birds 1, Insects 2 -> Birds move from third to second: 1x8 = 8. The score prefers D2,
  // although "first place, else a rank gain" would pick D3.
  s.tiles.D3.cubes.mammals = 1;
  s.tiles.D2.cubes.mammals = 3; s.tiles.D2.cubes.birds = 1; s.tiles.D2.cubes.insects = 2;
  s.animals.mammals.vp = 30; s.animals.insects.vp = 0; s.animals.birds.pool = 1;   // one replacement: Mammals only
  const evo = botAction(s,{kind:'effect',actor:'birds',name:'Evolution',tile:null});
  assert.deepEqual(evo.hits, [{tile:'D2', victim:'mammals'}]);
`);

verify('Re-audit v0.3.8: paper Immigrants removes an unplaced pawn first, else the last pawn in display order', `
  const s = newGame('mammals',['birds','insects'],true,314159,{extra:0});
  s.animals.birds.added = []; for (const t of terrainIds(s)) s.tiles[t].cubes.birds = 0;
  s.tiles.D2.cubes.birds = 3;                                   // not thin, no added element: it must lose a pawn
  s.pawns = {}; s.pawns['domination-1'] = {actor:'birds',card:null,focus:null}; s.pawns['adaptation-0'] = {actor:'birds',card:null,focus:null};
  s.animals.birds.ap = 2;
  const all = paperImmigrant(s,'birds');
  assert.equal(all.mode, 'pawn'); assert.equal(all.slot, 'domination-1');
  s.animals.birds.ap = 3;
  assert.equal(paperImmigrant(s,'birds').slot, null);
`);

verify('Re-audit v0.3.9: paper Migration tie prefers a destination the rival does not occupy, then the fullest origin', `
  const s = newGame('mammals',['insects','birds'],true,314159,{extra:0});
  for (const t of terrainIds(s)) for (const id of s.ids) s.tiles[t].cubes[id] = 0;
  for (const k of Object.keys(s.corners)) delete s.corners[k];
  // C3 and C4 are both Forest and both next to D3. D3 has no disk, so Insects there are a rescue.
  s.tiles.C3.terrain = 'forest'; s.tiles.C4.terrain = 'forest';
  for (const t of ['C3','C4']) s.corners[VERTICES_OF[t].find(k => !CORNER_TILES[k].includes('D3'))] = 'grass';
  s.tiles.D3.cubes.insects = 1; s.tiles.C3.cubes.insects = 1;   // Insects already on C3 (earlier top-left), not on C4
  const {moves} = paperMigration(s,'insects',1);
  assert.deepEqual(moves.map(m => m.from + '>' + m.to), ['D3>C4'], 'equal value: the unoccupied destination wins');
  s.tiles.C3.cubes.insects = 0;                                  // control: neither occupied -> top-left tie-break picks C3
  assert.deepEqual(paperMigration(s,'insects',1).moves.map(m => m.from + '>' + m.to), ['D3>C3']);
`);
