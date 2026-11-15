"""Final evaluation: re-tuned player vs v3 vs the best fixed policy, paper levels vs App, same seed block.
usage: python3 final_eval.py PAPER_JSON APP_JSON"""
import json, math, sys

def load(p): return json.load(open(p, encoding='utf-8-sig'))
def logit(p):
    p = min(max(p / 100, 0.005), 0.995)
    return math.log(p / (1 - p))

FIXED = ['dominance', 'majority', 'expansion']
paper, app = load(sys.argv[1]), load(sys.argv[2])
A = {r['rivals']: r for r in app['table']}
def best_fixed(r): return max(r[k] for k in FIXED if k in r)
def edge(r, who): return logit(r[who]) - logit(best_fixed(r))

print('Pooled win % (paper levels and App):')
for lvl, v in list(paper['pooled'].items()) + [('App', app['pooled']['App'])]:
    if lvl == 'All': continue
    print('  %-9s ' % lvl + '  '.join('%s %.1f' % (k, v[k]['pct']) for k in v))
rows = {}
for r in paper['table']:
    rows.setdefault(r['rivalsAre'], {})[r['rivals']] = r
print('\nedgeX = edge over the best fixed policy at the paper level, minus the better App edge of (re-tuned, v3), same rival count:')
summary = {}
for lvl, byb in rows.items():
    xs = {}
    for b, r in sorted(byb.items()):
        a = A[b]
        app_ref = max(edge(a, 'tuned'), edge(a, 'v3'))
        xs[b] = (round(edge(r, 'tuned') - app_ref, 2), round(edge(r, 'v3') - app_ref, 2), best_fixed(r), r['tuned'], r['v3'])
    x35 = sum(xs[b][0] for b in (3, 4, 5) if b in xs) / 3
    summary[lvl] = x35
    print('  %-9s re-tuned edgeX by rivals %s | X35 %+.2f | (v3 edgeX %s)' % (lvl, {b: x[0] for b, x in xs.items()}, x35, {b: x[1] for b, x in xs.items()}))
    print('            best fixed / re-tuned / v3 win %:', {b: x[2:] for b, x in xs.items()})
print('\nApp edges (re-tuned, v3) by rivals:', {b: (round(edge(a, 'tuned'), 2), round(edge(a, 'v3'), 2)) for b, a in A.items()})
print('Re-tune recovery (re-tuned minus v3, pooled pp):', {lvl: round(v['tuned']['pct'] - v['v3']['pct'], 1) for lvl, v in paper['pooled'].items() if lvl != 'All' and 'v3' in v},
      'App:', round(app['pooled']['App']['tuned']['pct'] - app['pooled']['App']['v3']['pct'], 1))
abl = {lvl: {k: round(v[k]['pct'] - v['tuned']['pct'], 1) for k in v if k.startswith('no_')} for lvl, v in paper['pooled'].items() if lvl != 'All'}
print('Ablations of the re-tuned player (pp vs re-tuned):', abl)
