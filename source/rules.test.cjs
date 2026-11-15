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

verify('v0.1 through v0.5.3 save migration preserves inventory, pending choices, and random state', `
  for (const version of ['0.1.0','0.2.0','0.3.0','0.3.1','0.3.2','0.3.3','0.3.4','0.3.5','0.3.6','0.3.7','0.3.8','0.3.9','0.4.0','0.4.1','0.5.0','0.5.1','0.5.2','0.5.3']) {
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
  assert.deepEqual(s.paper, {extra:1, rivalTie:true, planFirst:true, speciesTie:true, level:'Expert'});
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

verify('v0.4.0 rival tie-break: rivals tied for most matches -> the higher in the food chain is dominant; a tie with you is not', `
  const s = newGame('mammals',['birds','insects'],true,7,{extra:1});
  assert.equal(s.paper.rivalTie, true, 'new paper games record the rule');
  for (const t of terrainIds(s)) for (const id of s.ids) s.tiles[t].cubes[id] = 0;
  for (const k of Object.keys(s.corners)) delete s.corners[k];
  VERTICES_OF.C4.slice(0,2).forEach(k => { s.corners[k] = 'grass'; });       // flat matching: Birds 2, Insects 2
  s.tiles.C4.cubes.birds = 1; s.tiles.C4.cubes.insects = 1;
  assert.equal(cone(s,'C4'), 'birds', 'Birds are higher in the food chain than Insects');
  s.tiles.C4.cubes.mammals = 3; s.animals.mammals.added = [];                // you are there but match nothing: still the rivals' tie
  assert.equal(match(s,'C4','mammals'), 0); assert.equal(cone(s,'C4'), 'birds');
  s.animals.mammals.added = ['grass'];                                         // you match both Grass disks: a three-way tie at 2
  assert.equal(match(s,'C4','mammals'), 2);
  assert.equal(cone(s,'C4'), null, 'a tie that includes you leaves no dominant animal');
  const old = newGame('mammals',['birds','insects'],true,7,{extra:1});
  delete old.paper.rivalTie;                                                   // a game started before v0.4.0
  for (const t of terrainIds(old)) for (const id of old.ids) old.tiles[t].cubes[id] = 0;
  for (const k of Object.keys(old.corners)) delete old.corners[k];
  VERTICES_OF.C4.slice(0,2).forEach(k => { old.corners[k] = 'grass'; });
  old.tiles.C4.cubes.birds = 1; old.tiles.C4.cubes.insects = 1;
  assert.equal(cone(old,'C4'), null, 'earlier saves keep the rule they started with');
  validateState(JSON.parse(JSON.stringify(newGame('mammals',['birds','insects'],true,7,{extra:1}))));   // the recorded rule passes save checks
`);

test('v0.4.0 rival tie-break: the benchmark player sees the same dominant animal', () => {
  const game = load('worktree', ['game']);
  const player = load(PLAYER_REFERENCE, ['player']);
  const state = game.run(`(() => { const s = newGame('mammals',['birds','insects'],true,7,{extra:1});
    for (const t of terrainIds(s)) for (const id of s.ids) s.tiles[t].cubes[id] = 0;
    for (const k of Object.keys(s.corners)) delete s.corners[k];
    VERTICES_OF.C4.slice(0,2).forEach(k => { s.corners[k] = 'grass'; });
    s.tiles.C4.cubes.birds = 1; s.tiles.C4.cubes.insects = 1; return JSON.stringify(s); })()`);
  assert.equal(game.get('cone')(JSON.parse(state), 'C4'), 'birds');
  assert.equal(player.get('cone')(JSON.parse(state), 'C4'), 'birds');
});

verify('v0.5.0 levels: Easy -2, Standard -1, Hard 0, Expert +1, recorded by name; v0.4.x games keep their level names', `
  assert.deepEqual(PAPER_LEVELS, [[-2,'Easy'],[-1,'Standard'],[0,'Hard'],[1,'Expert']]);
  const s = newGame('mammals',['birds','insects'],true,7,{extra:-1});
  assert.equal(s.paper.level, 'Standard'); assert.equal(paperLevel(s.paper.extra, s.paper), 'Standard');
  assert.equal(paperLevel(1, {extra:1}), 'Standard', 'a v0.3.x game at +1 was Standard');
  assert.equal(paperLevel(1, {extra:1, rivalTie:true}), 'Hard', 'a v0.4.x game at +1 was Hard');
  assert.equal(paperLevel(0, {extra:0, rivalTie:true, planFirst:true}), 'Hard');
  // A v0.4.1 save (tie-break, no planning first) records its name on load and restarts at that name on the new scale.
  const v041 = newGame('mammals',['birds','insects'],true,7,{extra:1});
  delete v041.paper.planFirst; delete v041.paper.speciesTie; delete v041.paper.level; v041.version = '0.4.1';
  validateState(v041);
  assert.equal(v041.paper.level, 'Hard'); assert.equal(paperExtraFor(v041.paper.level), 0);
  assert.equal(v041.paper.planFirst, undefined, 'the saved game keeps its Planning order');
  const easy = newGame('mammals',['birds','insects'],true,7,{extra:-2});
  for (const id of easy.rivals) assert.equal(easy.animals[id].ap, s.animals[id].ap - 1);
  validateState(JSON.parse(JSON.stringify(easy)));
`);

verify('GPT v0.4.0 audit F1: older paper saves keep their level name, and a restart maps it to the current scale', `
  const old = (version, extra, tie = false) => {
    const s = newGame('amphibians',['birds','arachnids'],true,949381806,{extra});
    delete s.paper.level; delete s.paper.planFirst; delete s.paper.speciesTie;
    if (!tie) delete s.paper.rivalTie;
    s.version = version;
    validateState(s);
    return s;
  };
  const e36 = old('0.3.6', -1);
  assert.equal(e36.paper.level, 'Easy'); assert.equal(paperLevel(e36.paper.extra, e36.paper), 'Easy'); assert.equal(paperExtraFor('Easy'), -2);
  const s36 = old('0.3.6', 0);
  assert.equal(paperLevel(s36.paper.extra, s36.paper), 'Standard'); assert.equal(paperExtraFor('Standard'), -1);
  const s39 = old('0.3.9', 1);
  assert.equal(paperLevel(s39.paper.extra, s39.paper), 'Standard');
  const x39 = old('0.3.9', 3);
  assert.equal(paperLevel(x39.paper.extra, x39.paper), 'Expert'); assert.equal(paperExtraFor('Expert'), 1);
  // Re-saved by v0.4.0 (version overwritten): +1 could be v0.3.6 Hard or v0.3.7+ Standard, so the player must choose.
  const amb = old('0.4.0', 1);
  assert.equal(amb.paper.level, null); assert.equal(paperLevel(amb.paper.extra, amb.paper), 'Unknown level'); assert.equal(paperExtraFor(paperLevel(amb.paper.extra, amb.paper)), null);
  assert.equal(old('0.4.0', -1).paper.level, 'Easy');
  // New games (tie-break) keep using the current scale and record no level.
  const now = newGame('amphibians',['birds','arachnids'],true,7,{extra:0});
  validateState(now); assert.equal(now.paper.level, 'Hard'); assert.equal(paperLevel(0, now.paper), 'Hard');
  // A save can't carry an unknown level name.
  const bad = old('0.3.9', 1); bad.paper.level = 'Legendary';
  assert.throws(() => validateState(bad));
  for (const s of [e36, s36, s39, x39, amb]) assert.equal(s.version, VERSION);
`);

verify('GPT v0.4.1 follow-up R2: an Easy save re-exported by v0.3.7-v0.3.9 is still recovered as Easy', `
  const old = (version, extra) => {
    const s = newGame('amphibians',['birds','arachnids'],true,949381806,{extra});
    delete s.paper.rivalTie; delete s.paper.planFirst; delete s.paper.speciesTie; delete s.paper.level;
    s.version = version;
    validateState(s);
    return s;
  };
  // -1 was only ever the v0.3.6 Easy setting, and +3 only the v0.3.7-v0.3.9 Expert setting, whoever saved the file last.
  for (const v of ['0.3.6','0.3.7','0.3.8','0.3.9','0.4.0']) assert.equal(old(v, -1).paper.level, 'Easy', v);
  for (const v of ['0.3.7','0.3.9','0.4.0']) assert.equal(old(v, 3).paper.level, 'Expert', v);
  assert.equal(paperExtraFor(old('0.3.9', -1).paper.level), -2);
  // The documented limit: a v0.3.6 Standard (0) re-saved by v0.3.9 is identical to a v0.3.9 Easy game.
  assert.equal(old('0.3.9', 0).paper.level, 'Easy');
  assert.equal(old('0.4.0', 0).paper.level, null);
`);

verify('v0.5.0 candidate: rivals plan first; the rule is in the save and survives a save made mid pre-round', `
  const human = 'insects', rivals = ['mammals','birds','reptiles'];
  const s = newGame(human, rivals, true, 11, {extra:0});
  assert.equal(s.paper.planFirst, true);
  const sup = makeSupplies(s, 11);
  enterSupply(s, nextSupply(s, sup, 11));
  assert.equal(s.initiative[0], human, 'the player starts first in Initiative here');
  const order = s.initiative.filter(id => rivals.includes(id));
  const seen = [];
  for (let i = 0; i < order.length; i++) {
    const p = currentPlanner(s);
    seen.push(p.actor);
    const copy = JSON.parse(JSON.stringify(s));
    validateState(copy);
    assert.equal(currentPlanner(copy).actor, p.actor, 'a save made mid pre-round resumes with the same rival');
    botPlacement(s);
  }
  assert.deepEqual(seen, order, 'each rival places one pawn first, in Initiative order');
  assert.equal(s.paper.pre, undefined);
  assert.equal(currentPlanner(s).actor, human, 'then Planning starts again from the top of the Initiative order');
  // A game saved before the rule keeps the earlier order: the player places first.
  const old = newGame(human, rivals, true, 11, {extra:0});
  delete old.paper.planFirst; delete old.paper.speciesTie;
  enterSupply(old, nextSupply(old, makeSupplies(old, 11), 11));
  assert.equal(currentPlanner(old).actor, human);
  // A bad opening-round list is rejected.
  const bad = JSON.parse(JSON.stringify(s)); bad.phase = 'planning'; bad.paper.pre = [human];
  assert.throws(() => validateState(bad));
  // A rival whose pawns are all on the display already (Instinct can park one) skips the opening round.
  const park = newGame(human, rivals, true, 11, {extra:-2});
  const sp = makeSupplies(park, 11);
  const first = park.initiative.find(id => rivals.includes(id));
  park.pawns['wanderlust-0'] = {actor:first, card:null, focus:null};
  enterSupply(park, nextSupply(park, sp, 11));
  assert.equal(park.animals[first].remaining, park.animals[first].ap - 1);
  if (park.animals[first].remaining === 0) assert.ok(!park.paper.pre.includes(first));
  const tight = newGame(human, ['mammals','birds','reptiles','amphibians','arachnids'], true, 12, {extra:-2, flatEasy:true});
  const r1 = tight.initiative.find(id => tight.rivals.includes(id));
  assert.equal(tight.animals[r1].ap, 1, 'five rivals at the old flat Easy have one pawn each');
  tight.pawns['wanderlust-0'] = {actor:r1, card:null, focus:null};
  enterSupply(tight, nextSupply(tight, makeSupplies(tight, 12), 12));
  assert.equal(tight.animals[r1].remaining, 0);
  assert.ok(!tight.paper.pre.includes(r1), 'a rival with no pawn to place is not in the opening round');
  assert.notEqual(currentPlanner(tight).actor, r1);
`);

// GPT v0.5.0 audit G1 and v0.5.1 re-audit E1. Fresh runtimes: switching paper rules on must not leak into the shared
// runtime above. Expected corners are computed from the "x,y" board coordinates, never from storage order.
const FIX = name => JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, 'fixtures', name), 'utf8')).game;
const boardFirst = keys => [...keys].sort((a, b) => { const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number); return ax - bx || ay - by; })[0];

test('v0.5.2 board order: a corner tie goes to the leftmost corner, then the uppermost (not storage or string order)', () => {
  const g = load('worktree', ['game']);
  g.get('globalThis').assert = assert;
  g.get('globalThis').boardFirst = boardFirst;
  g.run(`(() => {
    // String order would pick "-10,-4"; board order picks the left tip "-11,-3" (A1 corner 4), then "-10,-4" above "-10,-2".
    assert.equal(pBy([{tile:'-7,-3'},{tile:'-10,-4'},{tile:'-11,-3'},{tile:'-10,-2'}]).tile, '-11,-3');
    assert.equal(pBy([{tile:'-7,-3'},{tile:'-10,-2'},{tile:'-10,-4'}]).tile, '-10,-4');
    assert.equal(pBy(['B2','A3','A1']), 'A1', 'tiles: leftmost column, then top');
    const s = newGame('birds',['mammals','insects'],true,7,{extra:-1});
    // Aquatic's free corner on a tile: board order, not the clockwise storage order that starts at the right tip.
    for (const t of terrainIds(s)) {
      const free = VERTICES_OF[t].filter(k => !s.corners[k]);
      if (free.length) assert.equal(pFreeCorner(s,t), boardFirst(free), t);
    }
    // Blight: equal options on one tile fall to the kept disk in board order.
    assert.equal(pBy([{tile:'A1',keep:'-7,-3'},{tile:'A1',keep:'-11,-3'}]).keep, '-11,-3');
    // Migration: equal moves to one destination fall to the origin in board order (not the order tiles were placed).
    assert.equal(pBy([{tile:'C3',from:'D2'},{tile:'C3',from:'B3'},{tile:'C3',from:'C2'}]).from, 'B3');
    PAPER.oldCornerOrder = true;
    assert.equal(pBy([{tile:'-7,-3'},{tile:'-10,-4'},{tile:'-11,-3'}]).tile, '-10,-4', 'testing switch: the v0.5.1 string order');
    delete PAPER.oldCornerOrder;
  })()`);
});

verify('v0.5.3 scaled Easy: with five rivals each rival has 2 pawns and you have 4; other table sizes keep Easy at -2', `
  const five = ['mammals','birds','reptiles','amphibians','arachnids'];
  const s = newGame('insects', five, true, 21, {extra:-2});
  assert.deepEqual(five.map(id => s.animals[id].ap), [2,2,2,2,2]);
  assert.equal(s.animals.insects.ap, 4);
  assert.equal(s.paper.scaledEasy, true);
  assert.equal(s.paper.level, 'Easy');
  validateState(s);
  for (const [rivals, base] of [[five.slice(0,4), 4], [five.slice(0,3), 5], [five.slice(0,2), 6]]) {
    const g = newGame('insects', rivals, true, 21, {extra:-2});
    assert.ok(rivals.every(id => g.animals[id].ap === base - 2) && g.animals.insects.ap === base && !g.paper.scaledEasy, rivals.length + ' rivals');
  }
  for (const extra of [-1, 0, 1]) {
    const g = newGame('insects', five, true, 21, {extra});
    assert.ok(five.every(id => g.animals[id].ap === 3 + extra) && g.animals.insects.ap === 3 && !g.paper.scaledEasy, 'level ' + extra);
  }
  const flat = newGame('insects', five, true, 21, {extra:-2, flatEasy:true});
  assert.ok(five.every(id => flat.animals[id].ap === 1) && flat.animals.insects.ap === 3, 'testing switch: the flat -2');
  // A five-rival Easy game saved before v0.5.3 keeps its pawn counts.
  const old = JSON.parse(JSON.stringify(flat)); old.version = '0.5.2'; delete old.paper.scaledEasy;
  validateState(old);
  assert.ok(five.every(id => old.animals[id].ap === 1) && old.animals.insects.ap === 3);
`);

verify('v0.5.4 Migration placement: a rival takes Migration only when Execution allows a move (rescue, or a spare species to a new matched tile)', `
  Object.assign(PAPER, {place:true, all:true, extraAP:0});
  // Seed 1 start: Birds can only shuffle species between tiles they already hold, which Execution never allows.
  const s = newGame('insects',['mammals','birds','reptiles'],true,1,{extra:0});
  PAPER.oldMigTest = true; assert.ok(paperLegal(s,'birds','migration',0), 'the old test let Birds take Migration'); delete PAPER.oldMigTest;
  assert.equal(paperMigration(s,'birds',7).moves.length, 0, 'and Execution then moves nothing');
  assert.ok(!paperLegal(s,'birds','migration',0), 'the new test agrees with Execution');
  // Everywhere: the test is exactly "Execution would make a first move" (checked over several starts and every rival).
  for (let seed = 1; seed <= 12; seed++) {
    const g = newGame('insects',['mammals','birds','reptiles','amphibians'],seed % 2 === 0,seed,{extra:0});
    for (const a of g.rivals) assert.equal(paperLegal(g,a,'migration',0), paperMigration(g,a,1).moves.length > 0, seed + ' ' + a);
  }
`);

verify('v0.5.4 rival ties: when only rivals tie on matches, the most species wins, then the food chain; older saves keep the food chain alone', `
  Object.assign(PAPER, {place:true, all:true, extraAP:0});
  const s = newGame('birds',['mammals','insects'],true,7,{extra:0});
  assert.equal(s.paper.speciesTie, true);
  const t = terrainIds(s).find(t => VERTICES_OF[t].filter(k => s.corners[k]).length >= 2);
  for (const id of s.ids) s.tiles[t].cubes[id] = 0;
  s.tiles[t].cubes.mammals = 1; s.tiles[t].cubes.insects = 2;
  assert.equal(match(s,t,'mammals'), match(s,t,'insects'), 'fixture: equal flat matches');
  assert.equal(cone(s,t), 'insects', 'more species wins, though lower in the food chain');
  s.tiles[t].cubes.mammals = 2;
  assert.equal(cone(s,t), 'mammals', 'equal species: the food chain');
  s.tiles[t].cubes.mammals = 1;
  const old = JSON.parse(JSON.stringify(s)); delete old.paper.speciesTie;
  assert.equal(cone(old,t), 'mammals', 'a save without speciesTie keeps the food chain alone');
  const v053 = newGame('birds',['mammals','insects'],true,7,{extra:0}); delete v053.paper.speciesTie; v053.version = '0.5.3';
  validateState(v053); assert.equal(v053.paper.speciesTie, undefined, 'a v0.5.3 save loads and keeps its tie rule');
  // A tie that includes the player still leaves the tile with no dominant animal.
  s.tiles[t].cubes.birds = 2;
  if (match(s,t,'birds') === match(s,t,'insects')) assert.equal(cone(s,t), null);
  // Testing switch: new games without it.
  PAPER.oldRivalTie = true; assert.equal(newGame('birds',['mammals','insects'],true,7).paper?.speciesTie, undefined); delete PAPER.oldRivalTie;
  assert.equal(newGame('birds',['mammals','insects'],true,7,{extra:0, oldRivalTie:true}).paper.speciesTie, undefined);
`);

verify('v0.5.4 card skips: a rival skips Metamorphosis, Disease, Niche Biomes, Nocturnal and Hibernation when they would do nothing', `
  Object.assign(PAPER, {place:true, all:true, extraAP:0});
  const s = newGame('birds',['mammals','insects'],true,7,{extra:0});
  const a = 'mammals', claim = list => { s.market = [...list]; return paperClaim(s,a,null).card; };
  // Fresh game: no added elements, no eliminated species, nobody ahead on VP; Mammals may or may not lead Initiative.
  s.initiative = ['mammals','birds','insects'];
  assert.equal(claim(['Metamorphosis','Disease','Niche Biomes','Nocturnal','Hibernation','Fertile']), 'Fertile', 'all five idle: skipped');
  assert.equal(claim(['Metamorphosis','Disease','Niche Biomes','Nocturnal','Hibernation']), 'Metamorphosis', 'all idle and nothing else: the first on the list anyway');
  s.animals.mammals.added = ['meat'];
  assert.equal(claim(['Metamorphosis','Fertile']), 'Metamorphosis', 'an added element to swap');
  s.animals.mammals.added = [];
  s.animals.birds.added = ['seed'];
  assert.equal(claim(['Disease','Fertile']), 'Disease', 'Birds have more elements (2+1 against 2) and an added one');
  s.animals.mammals.added = ['meat'];
  assert.equal(claim(['Disease','Fertile']), 'Fertile', 'equal elements: Disease would hit no one');
  s.animals.mammals.added = []; s.animals.birds.added = [];
  // Niche Biomes is last but Ice Age on the list: with no one ahead it is idle and Ice Age (allowed when level) comes first.
  assert.equal(claim(['Niche Biomes','Ice Age']), 'Ice Age', 'nobody has more VP: Niche Biomes skipped');
  s.animals.insects.vp = 5;
  assert.equal(claim(['Niche Biomes','Ice Age']), 'Niche Biomes', 'an opponent has more VP (and Ice Age waits)');
  s.initiative = ['birds','mammals','insects'];
  assert.equal(claim(['Nocturnal','Fertile']), 'Nocturnal', 'not first on Initiative');
  s.animals.mammals.dead = 2;
  assert.equal(claim(['Hibernation','Fertile']), 'Hibernation', 'eliminated species to return');
  // Testing switch: the v0.5.3 list.
  s.animals.mammals.dead = 0; PAPER.noCardSkip = true;
  assert.equal(claim(['Hibernation','Fertile']), 'Hibernation'); delete PAPER.noCardSkip;
`);

test('v0.5.3 Mammals Extinction save: equal first-place values go to board order, not the order Mammals reached the tiles', () => {
  const g = load('worktree', ['game']);
  g.get('globalThis').assert = assert;
  g.run(`(() => {
    Object.assign(PAPER, {place:true, all:true, extraAP:-1});
    const s = newGame('birds',['mammals','insects'],true,7,{extra:-1});
    // Two Sea tiles with endangered Mammals: C4 is further left than E4, but Mammals reached E4 first.
    for (const t of ['C4','E4']) { s.tiles[t].terrain = 'sea'; for (const k of VERTICES_OF[t]) delete s.corners[k]; }
    const options = extinctionOptions(s,'mammals');
    assert.ok(options.indexOf('E4') < options.indexOf('C4'), 'fixture: E4 comes first in placement order');
    assert.equal(botAction(s,{kind:'extinction',actor:'mammals'}).saved, 'C4');
    // A higher first-place value still comes first: make E4 the only Sea.
    s.tiles.C4.terrain = 'wetland';
    assert.equal(botAction(s,{kind:'extinction',actor:'mammals'}).saved, 'E4');
    s.tiles.C4.terrain = 'sea';
    // Testing switches: the app's chooser (placement order), as in v0.5.2 and earlier.
    PAPER.oldExtinction = true;
    assert.equal(botAction(s,{kind:'extinction',actor:'mammals'}).saved, 'E4');
    delete PAPER.oldExtinction; PAPER.oldCornerOrder = true;
    assert.equal(botAction(s,{kind:'extinction',actor:'mammals'}).saved, 'E4');
    delete PAPER.oldCornerOrder;
    // No Mammals at the table: nothing to save.
    assert.equal(botAction(s,{kind:'extinction',actor:null}).saved, null);
  })()`);
});

test('v0.5.3 Mammals Extinction save on GPT\'s v0.5.2 positions: B2 over C2 (seed 960021), and C3 over D3 for 3 Survival VP', () => {
  const g = load('worktree', ['game']);
  Object.assign(g.get('globalThis'), {assert, played:FIX('gpt-v052-extinction-played.json'), tie:FIX('gpt-v052-extinction-tie.json')});
  g.run(`(() => {
    const check = (s, released, expected) => {
      validateState(s);
      assert.equal(s.version, VERSION, 'a v0.5.2 save loads');
      const step = nextStep(s);
      assert.equal(step.kind, 'extinction');
      PAPER.oldExtinction = true; assert.equal(botAction(s,step).saved, released, 'v0.5.2 choice'); delete PAPER.oldExtinction;
      const choice = botAction(s,step);
      assert.equal(choice.saved, expected);
      runStep(s,step,choice);
      validateState(s);
      return s;
    };
    // Seed 960021, turn 5 (Reptiles against five Paper Hard rivals): two endangered Sea tiles; B2 is further left.
    check(copy(played), 'C2', 'B2');
    // Two tundra tiles; one D3 Mammal is protected by Hibernation. Saving the C3 cube keeps Mammals on both tundra tiles.
    const before = tie.animals.mammals.vp;
    const s = check(copy(tie), 'D3', 'C3');
    assert.equal(s.animals.mammals.vp - before, 3, 'Survival: 3 VP');
    // The app's own rivals keep the app's chooser.
    const app = copy(tie); delete app.paper; delete app.paperRivals;
    assert.equal(botAction(app,nextStep(app)).saved, 'D3');
  })()`);
});

test('v0.5.1 Empty Earth: with no species on Earth a rival may take Abundance and seed any empty corner, in board order', () => {
  const g = load('worktree', ['game']);
  g.get('globalThis').assert = assert;
  g.get('globalThis').boardFirst = boardFirst;
  // GPT's re-audit fixture: seed 200074 at turn 31, no species or disks on Earth, Mammals to resolve Abundance.
  g.get('globalThis').FIXTURE = FIX('gpt-v050-empty-abundance.json');
  g.run(`(() => {
    const s = validateState(FIXTURE);
    const step = nextStep(s);
    assert.equal(step.actor, 'mammals');
    assert.ok(paperEmptyEarth(s));
    const vacant = activeCorners(s).filter(k => !s.corners[k]);
    const expected = boardFirst(vacant);
    assert.notEqual(expected, vacant[0], 'storage order and board order differ here');
    const choice = paperPawn(s, step);
    assert.equal(choice.corner, expected, 'leftmost empty corner, then uppermost');
    assert.match(choice.label, /Empty Earth/);
    // Habitat's fallback (it occupies no tile with an empty corner) uses the same order.
    assert.equal(paperEffect(s, {kind:'effect', name:'Habitat', actor:'mammals'}).corner, expected);
    // Once that corner is taken, the next rival Abundance takes the next empty corner in board order.
    runStep(s, step, choice);
    validateState(s);
    assert.ok(s.corners[expected], 'the element is on that corner');
    const next = nextStep(s);
    if (next.row === 'abundance' && next.actor !== s.human && paperEmptyEarth(s))
      assert.equal(paperPawn(s, next).corner, boardFirst(activeCorners(s).filter(k => !s.corners[k])));
  })()`);
  g.run(`(() => {
    const s = newGame('birds',['mammals','insects'],true,7,{extra:-1});
    s.turn = 5;
    for (const t of terrainIds(s)) for (const id of s.ids) { s.animals[id].pool += s.tiles[t].cubes[id]; s.tiles[t].cubes[id] = 0; }
    for (const k of Object.keys(s.corners)) delete s.corners[k];
    s.boxes.abundance = ['grub','water',null,null];
    validateState(JSON.parse(JSON.stringify(s)));
    const step = {row:'abundance', index:0, actor:'mammals', key:'abundance-0'};
    assert.ok(paperEmptyEarth(s) && paperBarren(s));
    assert.ok(paperLegal(s,'mammals','abundance',0), 'a rival with no species has a target on an empty Earth');
    const choice = paperPawn(s, step);
    assert.equal(choice.corner, boardFirst(activeCorners(s).filter(k => !s.corners[k])));
    assert.equal(choice.pick, 0, 'Mammals use neither element, so the leftmost');
    // One species anywhere on Earth: the normal rule (an empty corner of a tile the rival occupies) applies again.
    s.tiles[terrainIds(s)[0]].cubes.insects = 1;
    assert.ok(!paperEmptyEarth(s));
    assert.ok(!paperLegal(s,'mammals','abundance',0));
    assert.ok(paperPawn(s, step).pass);
    s.tiles[terrainIds(s)[0]].cubes.insects = 0;
    // Saved games from earlier versions get the rule too: v0.4.1-shaped (no planFirst, no level name) and pre-v0.4.0
    // (no tie-break), each loaded through validateState; and a v0.5.0 save.
    for (const strip of [['planFirst','speciesTie','level'], ['planFirst','speciesTie','level','rivalTie']]) {
      const old = JSON.parse(JSON.stringify(s));
      for (const k of strip) delete old.paper[k];
      old.version = strip.length === 2 ? '0.4.1' : '0.3.9';
      validateState(old);
      assert.ok(paperLegal(old,'mammals','abundance',0) && paperPawn(old, step).corner === choice.corner, 'saved ' + old.version + ' game');
    }
    for (const v of ['0.5.0', '0.5.1', '0.5.2', '0.5.3']) {
      const saved = JSON.parse(JSON.stringify(s)); saved.version = v;
      validateState(saved);
      assert.equal(saved.version, VERSION, 'a v' + v + ' Paper save loads');
    }
    // The testing switch restores the v0.5.0 rule.
    PAPER.noEmptyEarth = true;
    assert.ok(!paperLegal(s,'mammals','abundance',0));
    delete PAPER.noEmptyEarth;
  })()`);
});

test('v0.5.1 Empty Earth regression: the audited stall (seed 200074) finishes, and so does its turn-31 position', () => {
  const g = load('worktree', ['game']);
  const p = load(PLAYER_REFERENCE, ['player']);
  const strategy = {place: p.get('playerPlacement'), choose: p.get('playerChoice')};
  const sc = {human:'birds', rivals:['mammals','reptiles','amphibians','arachnids','insects'], seed:200074, short:true, policy:'expansion'};
  // With the v0.5.1 corner order the game follows the audited path: it stalls without Empty Earth and finishes with it.
  // (v0.5.4: the old Migration test, food-chain rival ties and card list too, so the path is the audited one.)
  g.run('Object.assign(PAPER, {place:true, all:true, extraAP:-1, oldCornerOrder:true, oldMigTest:true, oldRivalTie:true, noCardSkip:true})');
  const fixed = g.get('playBenchmark')(sc, strategy);
  assert.equal(fixed.stalled, undefined, 'reaches Ice Age within 30 turns');
  assert.ok(fixed.turns < 15, 'turn ' + fixed.turns);
  g.run('PAPER.noEmptyEarth = true');
  assert.equal(g.get('playBenchmark')(sc, strategy).stalled, true, 'without the rule this game stalls (the audited case)');
  // GPT's saved turn-31 position (no species, no disks) under the current rules: Ice Age is reached.
  g.run('delete PAPER.noEmptyEarth; delete PAPER.oldCornerOrder; delete PAPER.oldMigTest; delete PAPER.oldRivalTie; delete PAPER.noCardSkip');
  g.get('globalThis').FIXTURE = FIX('gpt-v050-stall-200074-turn31.json');
  g.get('globalThis').STRATEGY = strategy;
  const end = JSON.parse(g.run(`(() => {
    const s = validateState(FIXTURE), supply = {cards:[], stacks:[[],[],[]]};
    for (let n = 0; n < 6000 && s.phase !== 'finished' && s.turn <= 60; n++) {
      if (s.phase === 'supply') { enterSupply(s, nextSupply(s, supply, s.seed)); continue; }
      if (s.phase === 'planning') { const {actor} = currentPlanner(s); if (actor === s.human) place(s, STRATEGY.place(s, actor, 'expansion')); else botPlacement(s); continue; }
      const step = nextStep(s);
      const choice = step.kind === 'symbiosis' ? symbioticDraw(s, step, s.seed) : step.actor === s.human ? STRATEGY.choose(s, step, 'expansion') : botAction(s, step);
      runStep(s, step, copy(choice));
      validateState(s);
    }
    return JSON.stringify({phase: s.phase, turn: s.turn, iceAge: s.usedCards.includes('Ice Age')});
  })()`));
  assert.ok(end.phase === 'finished' && end.iceAge, JSON.stringify(end));
});
