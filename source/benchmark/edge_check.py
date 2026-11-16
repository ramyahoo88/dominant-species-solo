# usage: python3 edge_check.py PAPER_JSON APP_JSON [APP_JSON ...]  (several App files are merged, e.g. halves split by --bots)
# Per level and rival count: each tuned player's logit edge over the best fixed policy, the same at App, and the
# difference (edgeX), with an approximate 95% range (delta method, unpaired, so conservative). X35 = mean edgeX over
# 3-5 rivals, printed only when 3, 4 and 5 rivals are all present (as final_eval.py, GPT v0.5.0 audit B2).
# Best against best: the strongest paper edge of all tuned players minus the strongest App edge, same rival count
# (the director's measure from 15 Nov 07:25). Duplicate rows (the same level and rival count twice) are rejected.
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
seen = set()
for r in paper['table'] + app['table']:
    key = (r['rivalsAre'], r['rivals'])
    assert key not in seen, 'Duplicate row %s with %d rivals: each level and rival count once.' % key
    seen.add(key)
json.dump(app, open('app_merged.json', 'w'))  # merged App file, for final_eval.py
N = paper['perCell']
FIXED = ['dominance', 'majority', 'expansion']
FIELDS = {'rivals', 'rivalsAre', 'extraPawns', 'even', 'errors', 'stalled'}
PLAYERS = [k for k in paper['table'][0] if k not in FIELDS | set(FIXED) and not k.startswith('no_') and k != 'simple']
PLAYERS += ['simple'] if 'simple' in paper['table'][0] else []
TUNED = [p for p in PLAYERS if p != 'simple']
def lg(p): p = min(max(p / 100, .5 / N), 1 - .5 / N); return math.log(p / (1 - p))
def var(p): p = min(max(p / 100, .5 / N), 1 - .5 / N); return 1 / (N * p * (1 - p))
def edge(r, who):
    bf = max(FIXED, key=lambda k: r[k]); return lg(r[who]) - lg(r[bf]), var(r[who]) + var(r[bf])
A = {r['rivals']: r for r in app['table']}
def x35(cells):
    if not all(b in cells for b in (3, 4, 5)): return None, None
    return sum(cells[b][0] for b in (3, 4, 5)) / 3, math.sqrt(sum(cells[b][1] for b in (3, 4, 5))) / 3
fmt = lambda x, s: 'X35 n/a (needs 3, 4 and 5 rivals)' if x is None else 'X35 %+.2f (+-%.2f)' % (x, 1.96 * s)
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
            if b not in A: continue
            e, v = edge(r, p); ea, va = edge(A[b], p); cells[b] = (e - ea, v + va)
        print('  %-9s %-7s %s | %s' % (lvl, p, '  '.join('%d: %+.2f(+-%.2f)' % (b, x, 1.96 * math.sqrt(v)) for b, (x, v) in cells.items()), fmt(*x35(cells))))
print('\nBest against best: strongest paper edge of %s minus the strongest App edge of the same players:' % ', '.join(TUNED))
for lvl, byb in rows.items():
    cells = {}
    for b, r in sorted(byb.items()):
        if b not in A: continue
        pe = max((edge(r, p) for p in TUNED), key=lambda t: t[0]); ae = max((edge(A[b], p) for p in TUNED), key=lambda t: t[0])
        cells[b] = (pe[0] - ae[0], pe[1] + ae[1])
    x, s = x35(cells)
    print('  %-9s %s | %s' % (lvl, '  '.join('%d: %+.2f' % (b, c[0]) for b, c in cells.items()), fmt(x, s)))
    if x is not None and x > 0.2: flags.append((lvl, round(x, 2)))
print('\nFLAGS (best against best X35 > +0.2):', flags or 'none')
