const {execFileSync} = require('node:child_process');
const {readFileSync} = require('node:fs');
const {join, resolve} = require('node:path');
const vm = require('node:vm');

const root = resolve(__dirname, '../..');
const modules = ['data', 'decks', 'engine', 'bot', 'effects', 'ui'];
// Pin only the helpers used for difficult player choices. Player Planning has its own policy.
const PLAYER_REFERENCE = '3a7e6d0263ee9ed99a48cd949d793ec916b15602';
const git = (...args) => execFileSync('git', ['-C', root, ...args], {encoding: 'utf8'});

function resolveVersion(ref) {
  return ref === 'worktree' ? ref : git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').trim();
}

function load(ref, extra = []) {
  const context = vm.createContext({document: {getElementById: () => ({})}});
  const read = path => ref === 'worktree' ? readFileSync(join(root, path), 'utf8') : git('show', ref + ':' + path);
  // From v0.3.6 the shipped app includes the paper rules (inactive unless a game turns them on); load them where the build does.
  const shipsPaper = read('source/build.py').includes('../paper/paper');
  for (const name of modules) {
    for (const path of ['source/src/' + name + '.js', ...(name === 'effects' && shipsPaper ? ['source/paper/paper.js'] : [])]) {
      vm.runInContext(read(path), context, {filename: ref + '/' + path});
    }
  }
  for (const name of ['legality', ...extra]) {
    vm.runInContext(readFileSync(join(__dirname, name + '.js'), 'utf8'), context, {filename: name + '.js'});
  }
  const runtime = {
    get: name => vm.runInContext(name, context),
    run: (code) => vm.runInContext(code, context),
  };
  if (extra.includes('player')) {
    // Instinct can add a pawn after the Instinct row has passed. Use the fixed
    // player's placement policy for that choice as well.
    runtime.run(`
      // The pinned helpers weigh exactly two opponents. With more, give the others an equal share of the second weight.
      const referenceContext = context;
      context = (s, actor, focus = 'majority') => {
        const ctx = referenceContext(s, actor, focus);
        if (s.ids.length > 3) {
          const order = s.ids.filter(id => id !== actor).sort((a,b) => threatScore(s,b) - threatScore(s,a) || rank(a) - rank(b));
          const lead = ctx.rival[order[0]], second = ctx.rival[order[1]];
          ctx.rival = {[order[0]]: lead, ...Object.fromEntries(order.slice(1).map(id => [id, second / (order.length - 1)]))};
        }
        return ctx;
      };
      // Rules adapter (GPT audit B1): the pinned player keeps its strategy but must see the rules of the game it plays.
      // Paper rivals use flat matching, which also decides dominance (cones) through match().
      const referenceMatch = match;
      match = (s, tile, actor, additions = s.animals[actor].added) =>
        s.paper && !s.paper.detailed && s.paperRivals?.includes(actor)
          ? Math.min(ANIMALS[actor].affinity + additions.length, VERTICES_OF[tile].filter(k => s.corners[k]).length)
          : referenceMatch(s, tile, actor, additions);
      const referenceAction = botAction;
      const referencePlan = planPlacement;
      planPlacement = (s, actor, card, focus, timing) => {
        if (timing !== 'instinct') return referencePlan(s, actor, card, focus, timing);
        return {slot: playerPlacement(s, actor, s.playerProfile, 'instinct')};
      };
    `);
  }
  return runtime;
}

module.exports = {load, resolveVersion, PLAYER_REFERENCE};
