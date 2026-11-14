// Print the rival decks as markdown tables for the paper rules: node source/paper/decktables.cjs source/src/decks.js
const fs=require('fs'),vm=require('vm');const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(process.argv[2],'utf8')+';this.D=DECKS;',ctx);
const NAME={initiative:'Initiative',adaptation:'Adaptation',regression:'Regression',abundance:'Abundance',wasteland:'Wasteland',depletion:'Depletion',glaciation:'Glaciation',speciation:'Speciation',wanderlust:'Wanderlust',migration:'Migration',competition:'Competition',domination:'Domination'};
const COND={foothold:'2+ of its tiles have at most 1 matching element',close:'1 more species would raise its VP on a shared tile',cone:'It dominates 3+ unscored tiles and a card is available',
front:'A face-up Sea or Wetland tile could go next to its tiles',ice:'It has species on tundra and leads or ties the tundra count',contested:'An opponent outranks it on a shared tile worth 6+ VP',
elements:'An Adaptation element it lacks is on a corner of its tiles, or Abundance holds its printed element',supply:'Its gene pool has 6+ species',removal:"A Depletion disk is an opponent's only matching element on a tile",
regression:'Regression will take an added element',late:'Ice Age is visible, or 20+ cards are gone (16+ short game)',breadth:'It occupies 4+ tiles',invasion:'A move could put it on an opponent-held tile where it would match the most'};
const A={mammals:'Mammals',reptiles:'Reptiles',birds:'Birds',amphibians:'Amphibians',arachnids:'Arachnids',insects:'Insects'};
let out='';
for(const [a,deck] of Object.entries(ctx.D)){ out+=`### ${A[a]}\n\n| # | Card | Condition | If yes | If no |\n| --- | --- | --- | --- | --- |\n`;
 deck.forEach((c,i)=>{ out+=`| ${i+1} | ${c.title} | ${COND[c.check]} | ${c.yes.rows.map(r=>NAME[r]).join(' → ')} | ${c.no.rows.map(r=>NAME[r]).join(' → ')} |\n`; }); out+='\n'; }
process.stdout.write(out);
