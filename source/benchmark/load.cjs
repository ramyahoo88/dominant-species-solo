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
  for (const name of modules) {
    const path = 'source/src/' + name + '.js';
    const code = ref === 'worktree' ? readFileSync(join(root, path), 'utf8') : git('show', ref + ':' + path);
    vm.runInContext(code, context, {filename: ref + '/' + path});
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
