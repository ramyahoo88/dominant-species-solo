// Neural-network placement player (loaded into the player context after tuned.js and nn/features.js).
// Profile 'nn' plays exactly like 'tuned' except at its own Planning placements, where each open space scores
//   tuned value + net(board)[space]
// The net is a small ReLU MLP whose weights come from source/benchmark/nn/train.py (JSON). With no net loaded,
// or a net whose last layer is all zero, 'nn' is the tuned player.

var NN_NET = null;
POLICIES.nn = POLICIES.tuned;
function setNet(net) {
  if (!net) { NN_NET = null; return; }
  if (net.featureSize !== NN_FEATURE_SIZE || net.featuresVersion !== NN_FEATURES_VERSION) {
    throw new Error('Net expects ' + net.featureSize + ' features (layout ' + net.featuresVersion + '); this player has ' + NN_FEATURE_SIZE + ' (layout ' + NN_FEATURES_VERSION + ').');
  }
  if (net.slots.join() !== NN_SLOTS.join()) throw new Error('Net action spaces differ from this player.');
  NN_NET = {
    mean: Float32Array.from(net.mean), std: Float32Array.from(net.std),
    layers: net.layers.map(l => ({n: l.out, m: l.in, W: Float32Array.from(l.W), b: Float32Array.from(l.b)})),
  };
}
// Forward pass: standardise, then Linear+ReLU layers, last layer linear. W is row-major [out][in].
function nnForward(x) {
  let h = new Float32Array(x.length);
  for (let j = 0; j < x.length; j++) h[j] = (x[j] - NN_NET.mean[j]) / NN_NET.std[j];
  NN_NET.layers.forEach(({n, m, W, b}, k) => {
    const out = new Float32Array(n);
    for (let r = 0; r < n; r++) {
      let acc = b[r];
      const row = r * m;
      for (let c = 0; c < m; c++) acc += W[row + c] * h[c];
      out[r] = k < NN_NET.layers.length - 1 && acc < 0 ? 0 : acc;
    }
    h = out;
  });
  return h;
}
// Every open space with tuned value and the net's correction (Planning only).
function nnSlotScores(state, actor) {
  const options = tunedOptions(state, actor, TUNED, null);
  if (!options) return null;
  const residual = NN_NET ? nnForward(nnFeatures(visibleBoard(state), actor)) : null;
  return options.map(o => {
    const r = residual ? residual[NN_SLOTS.indexOf(o.slot)] : 0;
    return {slot: o.slot, tuned: o.value, residual: r, value: o.value + r};
  });
}

const tunedPlayerPlacement = playerPlacement, tunedPlayerChoice = playerChoice;
playerPlacement = (state, actor, profile, timing = null) => {
  if (profile !== 'nn') return tunedPlayerPlacement(state, actor, profile, timing);
  if (timing !== null || !NN_NET) return tunedPlayerPlacement(state, actor, 'tuned', timing);
  return asTuned(() => { const scores = nnSlotScores(state, actor); return scores ? choiceBest(scores).slot : null; });
};
playerChoice = (state, step, profile) => tunedPlayerChoice(state, step, profile === 'nn' ? 'tuned' : profile);
