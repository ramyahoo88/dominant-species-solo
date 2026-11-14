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

verify('v0.1 through v0.3.3 save migration preserves inventory, pending choices, and random state', `
  for (const version of ['0.1.0','0.2.0','0.3.0','0.3.1','0.3.2','0.3.3']) {
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
