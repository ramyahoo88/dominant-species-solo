"""Matched-difficulty excess: v3's win rate against paper rivals at the difficulty where the dominance player
wins as often as against App rivals, minus v3's win rate against App rivals.
usage: python3 matched.py APP_JSON CAND_JSON [CAND_JSON ...]   (results files, utf-8-sig)
APP_JSON must hold App rows (e.g. v4_hardapp.json); CAND_JSON rows for paper levels (Standard/Hard/Expert...)."""
import json, math, sys

def load(p):
    return json.load(open(p, encoding='utf-8-sig'))

def logit(p):
    p = min(max(p, 0.005), 0.995)
    return math.log(p / (1 - p))

def inv(x):
    return 1 / (1 + math.exp(-x))

def interp(points, x):
    """points: [(x, y)] in logit space, any order. Piecewise-linear interpolation, linear extrapolation at the ends."""
    pts = sorted(points)
    if len(pts) == 1:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1 or (x1, y1) == pts[-1]:
            if x < pts[0][0]:
                (x0, y0), (x1, y1) = pts[0], pts[1]
            return y0 + (y1 - y0) * (x - x0) / ((x1 - x0) or 1e-9)
    return pts[-1][1]

def report(app_file, cand_file, player='tuned', base='dominance'):
    app = {r['rivals']: r for r in load(app_file)['table'] if r['rivalsAre'] == 'App'}
    cand = load(cand_file)
    rows = [r for r in cand['table'] if r['rivalsAre'] != 'App']
    out = {'file': cand_file, 'byRivals': {}, 'levels': {}}
    for lvl, v in cand['pooled'].items():
        if lvl not in ('All', 'App'):
            out['levels'][lvl] = {k: v[k]['pct'] for k in v}
    ex = []
    for b in sorted({r['rivals'] for r in rows}):
        pts = [(logit(r[base] / 100), logit(r[player] / 100)) for r in rows if r['rivals'] == b]
        a = app.get(b)
        if not a:
            continue
        v3m = 100 * inv(interp(pts, logit(a[base] / 100)))
        out['byRivals'][b] = {'appDom': a[base], 'appV3': a[player], 'matchedV3': round(v3m, 1), 'excess': round(v3m - a[player], 1),
                              'levels': {r['rivalsAre']: (r[base], r[player]) for r in rows if r['rivals'] == b}}
        ex.append(v3m - a[player])
    out['meanExcess'] = round(sum(ex) / len(ex), 1) if ex else None
    return out

if __name__ == '__main__':
    app_file = sys.argv[1]
    for f in sys.argv[2:]:
        r = report(app_file, f)
        print('==', f.split('/')[-1], ' mean excess', r['meanExcess'])
        print('   levels (pooled %):', r['levels'])
        for b, x in r['byRivals'].items():
            print('   %d rivals: App dom %s v3 %s | matched v3 %s | excess %+.1f | %s' % (b, x['appDom'], x['appV3'], x['matchedV3'], x['excess'], x['levels']))
