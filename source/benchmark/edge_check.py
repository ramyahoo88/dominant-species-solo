# usage: python3 edge_check.py PAPER_JSON APP_JSON [APP_JSON ...]  (several App files are merged, e.g. halves split by --bots)
# Assignment 7 analysis: merge the App halves, then per level and rival count: each player's logit edge over the
# best fixed policy, the same at App, the difference (edgeX), with an approximate 95% range (delta method,
# unpaired, so conservative). X35 = mean edgeX over 3-5 rivals.
import json, math, sys
load = lambda p: json.load(open(p, encoding='utf-8-sig'))
paper = load(sys.argv[1]); apps = [load(p) for p in sys.argv[2:]]
app = {'table': [r for a in apps for r in a['table']], 'pooled': {'App': {}}}
for a in apps:
    for k, v in a['pooled']['App'].items():
        t = app['pooled']['App'].setdefault(k, {'games': 0, 'wins': 0})
        t['games'] += v['games']; t['wins'] += v['wins']
for v in app['pooled']['App'].values(): v['pct'] = round(100 * v['wins'] / v['games'], 1)
app['pooled']['All'] = app['pooled']['App']
json.dump(app, open('app_merged.json', 'w'))  # merged App file, for final_eval.py
N = paper['perCell']
FIXED = ['dominance', 'majority', 'expansion']; PLAYERS = [p for p in ['tuned', 'v3', 'simple'] if p in paper['table'][0]]
def lg(p): p = min(max(p / 100, .5 / N), 1 - .5 / N); return math.log(p / (1 - p))
def var(p): p = min(max(p / 100, .5 / N), 1 - .5 / N); return 1 / (N * p * (1 - p))
def edge(r, who):
    bf = max(FIXED, key=lambda k: r[k]); return lg(r[who]) - lg(r[bf]), var(r[who]) + var(r[bf])
A = {r['rivals']: r for r in app['table']}
print('Pooled win %:')
for lvl, v in list(paper['pooled'].items()) + [('App', app['pooled']['App'])]:
    if lvl != 'All': print('  %-9s' % lvl, '  '.join('%s %.1f' % (k, v[k]['pct']) for k in v))
print('\nApp edge over best fixed (logit) by rivals:')
for p in PLAYERS: print('  %-7s' % p, {b: round(edge(A[b], p)[0], 2) for b in sorted(A)})
print('\nedgeX = paper edge minus the same player\'s App edge, same rival count (95% +-):')
rows = {}
for r in paper['table']: rows.setdefault(r['rivalsAre'], {})[r['rivals']] = r
flags = []
for lvl, byb in rows.items():
    for p in PLAYERS:
        cells = {}
        for b, r in sorted(byb.items()):
            e, v = edge(r, p); ea, va = edge(A[b], p); cells[b] = (e - ea, v + va)
        x35 = sum(cells[b][0] for b in (3, 4, 5)) / 3; s35 = math.sqrt(sum(cells[b][1] for b in (3, 4, 5))) / 3
        print('  %-9s %-7s %s | X35 %+.2f (+-%.2f)' % (lvl, p, '  '.join('%d: %+.2f(+-%.2f)' % (b, x, 1.96 * math.sqrt(v)) for b, (x, v) in cells.items()), x35, 1.96 * s35))
        if p in ('tuned', 'v3') and x35 > 0.2: flags.append((lvl, p, round(x35, 2)))
print('\nFLAGS (X35 > +0.2):', flags or 'none')
