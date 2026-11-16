// Neural-network player: board features from one animal's point of view (loaded into the player context,
// after player.js and tuned.js). Only what the player can see: the visible board, never decks or seeds.
// Seats: 0 is the player, 1..5 the opponents by VP (then food-chain rank), padded with zeros.
// Everything is scaled to roughly 0..1. Layout version NN_FEATURES_VERSION; NN_FEATURE_SIZE numbers.

const NN_FEATURES_VERSION = 2;   // 2 (15 Nov, v0.5.x levels): the table block encodes -2..+3 and scaled Easy
const NN_SEATS = 6;
const NN_TERRAIN = Object.keys(TERRAIN);
const NN_SLOTS = ALL_SLOTS;
const NN_SEAT_SIZE = 1 + FOOD.length + 5 + ELEMENT_IDS.length + 1;
const NN_TILE_SIZE = 1 + NN_TERRAIN.length + NN_SEATS + (NN_SEATS + 1) + 1 + NN_SEATS;
const NN_FEATURE_SIZE = NN_SEATS * NN_SEAT_SIZE + GRID.length * NN_TILE_SIZE + 2 * NN_SLOTS.length +
  elementRows.length * ELEMENT_IDS.length + DOMINANCE.length + 3 * (NN_TERRAIN.length + 1) + 4 + 4 + 8 + 6;

function nnSeats(s, actor) {
  const others = s.ids.filter(id => id !== actor).sort((a, b) => s.animals[b].vp - s.animals[a].vp || rank(a) - rank(b));
  return [actor, ...others];
}

function nnFeatures(s, actor) {
  const x = new Float32Array(NN_FEATURE_SIZE);
  let i = 0;
  const seats = nnSeats(s, actor);
  const seatOf = Object.fromEntries(seats.map((id, k) => [id, k]));
  // Animal displays.
  for (let k = 0; k < NN_SEATS; k++) {
    const id = seats[k];
    if (!id) { i += NN_SEAT_SIZE; continue; }
    const a = s.animals[id];
    x[i++] = 1;
    x[i + FOOD.indexOf(id)] = 1; i += FOOD.length;
    x[i++] = a.vp / 60; x[i++] = a.pool / 55; x[i++] = a.dead / 20; x[i++] = a.ap / 10; x[i++] = (a.remaining || 0) / 10;
    for (const el of ELEMENT_IDS) x[i++] = count(a.added, el) / 3;
    x[i++] = s.initiative.indexOf(id) / 5;
  }
  // Tiles: terrain, cubes, who dominates, scored this turn, element matches.
  for (const {id: tile} of GRID) {
    const t = s.tiles[tile];
    if (!t) { i += NN_TILE_SIZE; continue; }
    x[i++] = 1;
    x[i + NN_TERRAIN.indexOf(t.terrain)] = 1; i += NN_TERRAIN.length;
    for (let k = 0; k < NN_SEATS; k++) x[i++] = seats[k] ? (t.cubes[seats[k]] || 0) / 5 : 0;
    const owner = cone(s, tile);
    x[i + (owner ? seatOf[owner] : NN_SEATS)] = 1; i += NN_SEATS + 1;
    x[i++] = s.scored.includes(tile) ? 1 : 0;
    for (let k = 0; k < NN_SEATS; k++) x[i++] = seats[k] ? match(s, tile, seats[k]) / 6 : 0;
  }
  // Action display: the player's pawns, then opponents' pawns.
  for (const key of NN_SLOTS) x[i++] = s.pawns[key]?.actor === actor ? 1 : 0;
  for (const key of NN_SLOTS) x[i++] = s.pawns[key] && s.pawns[key].actor !== actor ? 1 : 0;
  // Element boxes.
  for (const row of elementRows) for (const el of ELEMENT_IDS) x[i++] = count(s.boxes[row] || [], el) / 4;
  // Dominance Cards on offer.
  for (const card of DOMINANCE) x[i++] = s.market.includes(card) ? 1 : 0;
  // Terrain stacks: face-up terrain and tiles left.
  for (let k = 0; k < 3; k++) {
    const stack = s.stacks[k];
    if (stack.face) x[i + NN_TERRAIN.indexOf(stack.face)] = 1;
    i += NN_TERRAIN.length;
    x[i++] = stack.left / 8;
  }
  // Game clock.
  x[i++] = tunedPhase(s); x[i++] = s.turn / 12; x[i++] = s.short ? 1 : 0; x[i++] = s.ending ? 1 : 0;
  // Table: number of rivals (2-5); App, or the paper rivals' extra pawns -2..+3 (v0.5.x: Easy -2 .. Expert +1);
  // whether five-rival Easy is scaled (v0.5.3+: rivals -1 each, the player +1). Version 1 clamped the level to 0..3,
  // so Easy, Standard and Hard looked alike.
  x[i + Math.max(0, Math.min(3, s.ids.length - 3))] = 1; i += 4;
  x[i + (s.paper ? 1 + Math.max(0, Math.min(5, (s.paper.extra || 0) + 2)) : 0)] = 1; i += 7;
  x[i++] = s.paper?.scaledEasy ? 1 : 0;
  // Planning context: pawns the player still holds, opponents' pawns left, display fill.
  x[i++] = (s.animals[actor].remaining || 0) / 6;
  x[i++] = sum(seats.slice(1).map(id => s.animals[id].remaining || 0)) / 20;
  x[i++] = Object.keys(s.pawns).length / NN_SLOTS.length;
  x[i++] = s.phase === 'planning' ? 1 : 0;
  x[i++] = s.phase === 'execution' ? 1 : 0;
  x[i++] = s.cursor / 50;
  if (i !== NN_FEATURE_SIZE) throw new Error('Feature layout mismatch: ' + i + ' of ' + NN_FEATURE_SIZE);
  return x;
}
