const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const dir = path.join(__dirname,'src');
const sandbox = vm.createContext({console,assert,document:{getElementById:()=>({})}});
const files = ['data','decks','engine','bot','effects','ui'];
for (const name of files) vm.runInContext(fs.readFileSync(path.join(dir,name+'.js'),'utf8'),sandbox,{filename:name+'.js'});

vm.runInContext(`
function verifyBoard() {
  assert.equal(GRID.length,35);
  assert.equal(ALL_SLOTS.length,41);
  assert.equal(unique(GRID.map(t=>t.id)).length,35);
  assert.equal(Object.keys(CORNER_TILES).length,92);
  for(const tile of GRID) {
    for(const near of NEIGHBORS[tile.id]) {
      assert.ok(NEIGHBORS[near].includes(tile.id));
      assert.equal(VERTICES_OF[near].filter(key=>VERTICES_OF[tile.id].includes(key)).length,2);
    }
  }
  for (const id of FOOD) {
    const others=FOOD.filter(x=>x!==id);
    const s=newGame(id,others.slice(0,2),true,12345);
    validateState(s);
    assert.equal(DECKS[id].length,8);
    const home=Object.keys(INITIAL_CUBES[id]).find(tile=>INITIAL_CUBES[id][tile]===2);
    assert.equal(cone(s,home),id);
    for (const card of DECKS[id]) for (const face of [card.yes,card.no]) {
      assert.ok(CHECKS[card.check] && FOCUSES[face.focus]);
      assert.ok(face.rows.every(row=>ROW_BY_ID[row]));
    }
    const bot=others[0];
    assert.equal(unique(Array.from({length:8},()=>drawCard(s,bot))).length,8);
    assert.equal(unique(Array.from({length:8},()=>drawCard(s,bot))).length,8);
  }
  assert.equal(unique(Object.values(DECKS).flat().map(c=>c.title)).length,48);
  const s=newGame('amphibians',['arachnids','birds'],true,72);
  const t='D2';
  s.tiles[t].cubes={amphibians:4,arachnids:2,birds:1};
  s.animals.birds.added=['water','water','water','grass'];
  s.animals.amphibians.added=[];
  assert.deepEqual(tileScores(s,t),[['amphibians',8],['arachnids',4],['birds',2]]);
  assert.equal(cone(s,t),'birds');
}
const counts = {};
let totalSteps=0, games=0, maxTurns=0, maxTime=0, forfeit=0, botHits=0, deckDraws=0;
function scenario(human,rivals,seed) {
  const random={rng:(seed ^ 0xA341316C)>>>0};
  const short=seed%2===0;
  const s=newGame(human,rivals,short,seed);
  const cards=[...shuffle(random,DOMINANCE.filter(x=>x!=='Ice Age' && (!short||!SHORT_EXCLUDES.includes(x)))),'Ice Age'];
  const stacks=Array.from({length:3},()=>Array.from({length:8},()=>LARGE_TERRAIN[shuffle(random,LARGE_TERRAIN).indexOf('sea')]));
  const hDeck=shuffle(random,DECKS[human].map((_,i)=>i));
  let tick=0;
  let worst=0;
  const top = () => Date.now();
  for (let i=0;i<1400;i++) {
    validateState(s);
    if (s.phase==='finished') {
      assert.ok(s.usedCards.includes('Ice Age'));
      assert.equal(s.stacks.length,3);
      assert.equal(standings(s).length,3);
      totalSteps+=i; maxTurns=Math.max(maxTurns,s.turn); maxTime=Math.max(maxTime,worst); games++;
      return;
    }
    if (s.phase==='supply') {
      const bag=shuffle(random,ELEMENT_IDS.flatMap(type=>Array(bagCount(s,type)).fill(type)));
      const market=[...s.market];
      for(const index of nextCardSlots(s)) market[index]=cards.shift();
      enterSupply(s,{market,stacks:s.stacks.map((stack,i)=>stack.face || (stack.left ? stacks[i].shift() : null)),
        adaptation:bag.slice(0,4),abundance:bag.slice(4,8),wanderlust:bag.slice(8,12)});
      continue;
    }
    if(s.phase==='planning') {
      const actor=currentPlanner(s).actor;
      const start=top();
      if(isBot(s,actor)) { botPlacement(s); deckDraws++; }
      else {
        const card=hDeck[tick++%8];
        const planned=planPlacement(s,human,card);
        assert.ok(planned);
        place(s,planned.slot);
      }
      worst=Math.max(worst,top()-start);
      continue;
    }
    const step=nextStep(s);
    counts[step.row || step.name || step.kind]=(counts[step.row || step.name || step.kind]||0)+1;
    const start=top();
    let choice;
    if(step.kind==='symbiosis') {
      const bag=shuffle(random,ELEMENT_IDS.flatMap(type=>Array(bagCount(s,type)).fill(type)));
      choice={draws:Object.fromEntries(step.recipients.map((actor,index)=>[actor,bag[index]??null])),label:'Physical draws'};
    } else choice=botAction(s,step);
    if (step.kind==='spider' && choice.hits?.length) botHits++;
    if (choice.pass) forfeit++;
    runStep(s,step,choice);
    worst=Math.max(worst,top()-start);
  }
  throw new Error('Did not finish '+human+' vs '+rivals.join(' and ')+' · turn '+s.turn+' · '+s.phase);
}
verifyBoard();
let seed=100;
for (const human of FOOD) {
  const bots=FOOD.filter(id=>id!==human);
  for(let j=0;j<bots.length;j++) for(let k=j+1;k<bots.length;k++) scenario(human,[bots[j],bots[k]],seed++);
}
console.log(JSON.stringify({games,totalSteps,maxTurns,maxTime,forfeit,botHits,deckDraws,counts},null,2));
`,sandbox,{filename:'smoke-cases.js'});
