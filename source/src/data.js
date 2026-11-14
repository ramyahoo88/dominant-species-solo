'use strict';

const VERSION = '0.3.0';
const SAVE_KEY = 'dominant-species-solo-v1';
// GMT rules p. 4: of the 50 gathered cubes, one marks VP.
const THREE_PLAYER_CUBES = 50;
const PLAYABLE_SPECIES = THREE_PLAYER_CUBES - 1;
const STARTING_PAWNS = 6;
const RULEBOOK = 'https://www.gmtgames.com/living_rules/DS3_Rulebook-web_FINAL.pdf';
const PHOTO = 'https://commons.wikimedia.org/wiki/File:Portage_Glacier_USGS.jpg';
const ANIMALS = {
  mammals: { name: 'Mammals', mark: 'Ma', el: 'meat', affinity: 2, color: '#eee7d8', ink: '#40372c', power: 'First in the food chain. Save one endangered cube at Extinction.' },
  reptiles: { name: 'Reptiles', mark: 'Re', el: 'sun', affinity: 2, color: '#3d4c4b', ink: '#ffffff', power: 'Protect one added element for free during Regression.' },
  birds: { name: 'Birds', mark: 'Bi', el: 'seed', affinity: 2, color: '#ead174', ink: '#302713', power: 'Migrate each cube up to two tiles through existing terrain.' },
  amphibians: { name: 'Amphibians', mark: 'Am', el: 'water', affinity: 3, color: '#8ec7db', ink: '#173746', power: 'Start with three printed water matches.' },
  arachnids: { name: 'Arachnids', mark: 'Ar', el: 'grub', affinity: 2, color: '#db9b91', ink: '#40231f', power: 'Compete first on any one eligible tile for free.' },
  insects: { name: 'Insects', mark: 'In', el: 'grass', affinity: 2, color: '#a5c2a0', ink: '#25382a', power: 'Place one free cube on any tile after Speciation.' },
};
const FOOD = Object.keys(ANIMALS);
const rank = id => FOOD.indexOf(id);
const nameOf = id => ANIMALS[id].name;
const ELEMENTS = {
  meat: { name: 'Meat', mark: 'M', color: '#ddc7a7' },
  sun: { name: 'Sun', mark: 'Su', color: '#e7a26e' },
  seed: { name: 'Seed', mark: 'Se', color: '#e8d480' },
  water: { name: 'Water', mark: 'W', color: '#9ec9e3' },
  grub: { name: 'Grub', mark: 'Gr', color: '#d8add1' },
  grass: { name: 'Grass', mark: 'Gs', color: '#a9c389' },
};
const ELEMENT_IDS = Object.keys(ELEMENTS);
const elementName = id => ELEMENTS[id].name;
const TERRAIN = {
  tundra: { name: 'Tundra', vp: [1], cap: 1, color: '#dce9e7' },
  mountain: { name: 'Mountain', vp: [3, 2], cap: 2, color: '#b6ab9e' },
  desert: { name: 'Desert', vp: [4, 2], cap: 2, color: '#dec29a' },
  forest: { name: 'Forest', vp: [5, 3, 2], cap: 3, color: '#a8bc97' },
  jungle: { name: 'Jungle', vp: [6, 3, 2], cap: 3, color: '#87aa92' },
  savannah: { name: 'Savannah', vp: [7, 4, 2], cap: 3, color: '#c7c696' },
  wetland: { name: 'Wetland', vp: [8, 4, 2, 1], cap: 4, color: '#9cc4bd' },
  sea: { name: 'Sea', vp: [9, 5, 3, 2], cap: 4, color: '#9dbacb' },
};
const terrainName = id => TERRAIN[id].name;
const LARGE_TERRAIN = Object.keys(TERRAIN).filter(id => id !== 'tundra');
const COMPETITION_EDGES = ['jungle', 'wetland', 'desert', 'forest', 'savannah', 'mountain', 'sea', 'jungle'];
const ROWS = [
  ['initiative', 'Initiative', 1], ['adaptation', 'Adaptation', 3],
  ['regression', 'Regression', 2], ['abundance', 'Abundance', 2],
  ['wasteland', 'Wasteland', 1], ['depletion', 'Depletion', 1],
  ['glaciation', 'Glaciation', 4], ['speciation', 'Speciation', 6],
  ['wanderlust', 'Wanderlust', 3], ['migration', 'Migration', 6],
  ['competition', 'Competition', 7], ['domination', 'Domination', 5],
].map(([id, name, count]) => ({ id, name, slots: Array.from({ length: count }, (_, index) => id + '-' + index) }));
const ROW_BY_ID = Object.fromEntries(ROWS.map(row => [row.id, row]));
const ALL_SLOTS = ROWS.flatMap(row => row.slots);
const splitSlot = key => {
  const [row, index] = key.split('-');
  return { row, index: Number(index) };
};
function slotLabel(key) {
  const { row, index } = splitSlot(key);
  if (row === 'speciation') return 'Speciation · ' + elementName(ELEMENT_IDS[index]);
  if (row === 'migration') return 'Migration · ' + (7 - index);
  if (row === 'competition') return 'Competition · ' + terrainName(COMPETITION_EDGES[index]) + ' / ' + terrainName(COMPETITION_EDGES[index + 1]) + ' / Tundra';
  return ROW_BY_ID[row].name + (ROW_BY_ID[row].slots.length === 1 ? '' : ' · space ' + (index + 1));
}
const elementRows = ['adaptation', 'regression', 'abundance', 'wasteland', 'depletion', 'wanderlust'];
const DOMINANCE = [
  'Aquatic', 'Biodiversity', 'Biomass', 'Blight', 'Catastrophe', 'Cold Snap',
  'Disease', 'Ecodiversity', 'Evolution', 'Fecundity', 'Fertile', 'Habitat',
  'Hibernation', 'Ice Age', 'Ice Sheet', 'Immigrants', 'Instinct', 'Intelligence',
  'Mass Exodus', 'Metamorphosis', 'Niche Biomes', 'Nocturnal', 'Omnivore', 'Parasitism', 'Predator', 'Symbiotic',
];
const SHORT_EXCLUDES = ['Immigrants', 'Intelligence', 'Omnivore', 'Parasitism'];

const GRID = [[0,3],[-1,3],[-2,3],[-2,2],[-3,2],[-3,1],[-3,0]].flatMap(([first, last], index) => {
  const q = index - 3;
  return Array.from({ length: last - first + 1 }, (_, offset) => {
    const r = first + offset;
    return { id: 'ABCDEFG'[index] + (offset + 1), q, r, x: 3 * q, y: 2 * r + q };
  });
});
const HEXES = Object.fromEntries(GRID.map(tile => [tile.id, tile]));
const VERTICES = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];
function vertexKey(id, corner) {
  const tile = HEXES[id];
  const [x, y] = VERTICES[corner];
  return (tile.x + x) + ',' + (tile.y + y);
}
const VERTICES_OF = Object.fromEntries(GRID.map(tile => [tile.id, VERTICES.map((_, i) => vertexKey(tile.id, i))]));
const CORNER_TILES = {};
for (const tile of GRID) {
  for (const corner of VERTICES_OF[tile.id]) (CORNER_TILES[corner] ??= []).push(tile.id);
}
const DIRECTIONS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const NEIGHBORS = Object.fromEntries(GRID.map(tile => [
  tile.id,
  DIRECTIONS.map(([q, r]) => GRID.find(h => h.q === tile.q + q && h.r === tile.r + r)?.id).filter(Boolean),
]));
const INITIAL_TILES = { D3:'tundra', D2:'wetland', E3:'savannah', E4:'desert', D4:'mountain', C4:'forest', C3:'jungle' };
const INITIAL_CORNERS = [
  ['D3',0,'grass'], ['D3',1,'sun'], ['D3',2,'meat'], ['D3',3,'seed'], ['D3',4,'grub'], ['D3',5,'water'],
  ['D2',0,'grass'], ['D2',3,'water'], ['E3',1,'sun'], ['E4',2,'meat'], ['C4',1,'seed'], ['C3',2,'grub'],
];
const INITIAL_CUBES = {
  mammals: {D4:2,E4:1,C4:1}, reptiles: {E4:2,E3:1,D4:1}, birds: {C4:2,D4:1,C3:1},
  amphibians: {D2:2,C3:1,E3:1}, arachnids: {C3:2,C4:1,D2:1}, insects: {E3:2,D2:1,E4:1},
};
const bonus = count => {
  const n = Math.min(count, 9);
  return n * (n + 1) / 2;
};
