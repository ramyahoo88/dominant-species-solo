// Classify eligibility independently of the rival's evaluation or its reason for passing.
function hasPawnTarget(s, step) {
  const {actor, row, index} = step;
  switch (row) {
    case 'initiative':
      return ALL_SLOTS.some(key => key !== 'initiative-0' && !s.pawns[key]);
    case 'adaptation':
      return s.animals[actor].added.length + ANIMALS[actor].affinity < 6 && s.boxes.adaptation.some(Boolean);
    case 'regression':
      // The pawn already grants its protection when Regression is resolved.
      return true;
    case 'abundance':
      return s.boxes.abundance.some(Boolean) && activeCorners(s).some(key => !s.corners[key]);
    case 'wasteland':
      return s.boxes.wasteland.some(Boolean);
    case 'depletion':
      return placementTargets(s, row, index, actor).length > 0;
    case 'glaciation':
      return glazeTargets(s).length > 0;
    case 'speciation':
      return s.animals[actor].pool > 0 && placementTargets(s, row, index, actor).length > 0;
    case 'wanderlust':
      return s.stacks.some(stack => stack.face) && frontTiles(s).length > 0;
    case 'migration':
      return occupied(s, actor).some(tile => legalNeighbors(s, tile, actor).length > 0);
    case 'competition':
      return competitionChoices(s, actor, ['tundra', COMPETITION_EDGES[index], COMPETITION_EDGES[index + 1]]).length > 0;
    case 'domination':
      // Even an empty, as-yet-unscored tile may be selected.
      return terrainIds(s).some(tile => !s.scored.includes(tile));
    default:
      throw new Error('Missing legality check for ' + row);
  }
}
function pawnOutcome(s, step, choice) {
  const declined = choice.pass || (step.row === 'migration' && !choice.moves.length) ||
    (step.row === 'competition' && !choice.hits.length) ||
    (step.row === 'speciation' && !Object.values(choice.add).some(n => n > 0));
  if (!declined) return 'resolved';
  return hasPawnTarget(s, step) ? 'declined' : 'noTarget';
}
