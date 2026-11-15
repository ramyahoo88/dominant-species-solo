# Headroom check for the network player: is there a real, findable difference among v3's top candidates?
#   python headroom.py data.jsonl [marginWeight=0.5]
# Input: `--nn-data --raw` output. Each sample holds k candidates (v3's top spaces; candidate 0 is v3's own
# pick) x m re-dealt futures, the same futures for every candidate. Each future is [win 0/1, margin].
# 1. Realisable gain: choose the best candidate on half the futures, score it on the other half (averaged over 50 splits).
# 2. Per-rank differences against v3's pick, and an empirical-Bayes estimate of what a perfect chooser
#    among the k candidates would gain (shrink each decision's difference by its noise, take the best).
import json, sys, random
rows = [json.loads(l) for l in open(sys.argv[1], encoding='utf-8-sig') if l.strip()]
rows = [r for r in rows if 'raw' in r]
mw = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
u = lambda w, mg: w + mw * max(-50, min(50, mg)) / 50
mean = lambda x: sum(x) / len(x)
var = lambda x: sum((v - mean(x)) ** 2 for v in x) / (len(x) - 1)
n = len(rows); k = len(rows[0]['raw']); m = len(rows[0]['raw'][0])
same = changed = 0; gains_u = []; gains_w = []; naive_u = []
random.seed(1)
SPLITS = 50   # average the split-half estimate over many random splits (still unbiased, less noisy)
for r in rows:
    raw = r['raw']
    if all(raw[c] == raw[0] for c in range(k)): same += 1
    gu = gw = ch = 0
    for _ in range(SPLITS):
        idx = list(range(m)); random.shuffle(idx); A, B = idx[:m // 2], idx[m // 2:]
        meanA = [sum(u(*raw[c][j]) for j in A) / len(A) for c in range(k)]
        best = max(range(k), key=lambda c: (meanA[c], -c))   # ties keep v3's pick
        ch += best != 0
        gu += sum(u(*raw[best][j]) - u(*raw[0][j]) for j in B) / len(B)
        gw += sum(raw[best][j][0] - raw[0][j][0] for j in B) / len(B)
    changed += ch / SPLITS; gains_u.append(gu / SPLITS); gains_w.append(gw / SPLITS)
    full = [sum(u(*raw[c][j]) for j in range(m)) / m for c in range(k)]
    naive_u.append(max(full) - full[0])
ci = lambda x: 1.96 * (var(x) / len(x)) ** .5
print('samples %d  candidates %d  futures %d  margin weight %.2f' % (n, k, m, mw))
print('all candidates identical in every future: %.1f%%' % (100 * same / n))
print('choice differs from v3 (on half A): %.1f%%' % (100 * changed / n))
print('realisable gain per decision, utility:  %+.4f (95%% +-%.4f)' % (mean(gains_u), ci(gains_u)))
print('realisable gain per decision, win prob: %+.4f (95%% +-%.4f)' % (mean(gains_w), ci(gains_w)))
print('naive best-of-k on all futures (biased upward): %+.4f' % mean(naive_u))
D = {c: [] for c in range(1, k)}; V = {c: [] for c in range(1, k)}
for r in rows:
    for c in range(1, k):
        diffs = [u(*r['raw'][c][j]) - u(*r['raw'][0][j]) for j in range(m)]
        D[c].append(mean(diffs)); V[c].append(var(diffs) / m)
stats = {}
for c in range(1, k):
    tau2 = max(0.0, var(D[c]) - mean(V[c])); stats[c] = (mean(D[c]), tau2)
    print('rank %d minus v3 pick: %+.4f (95%% +-%.4f)  true spread sd about %.3f' % (c + 1, mean(D[c]), ci(D[c]), tau2 ** .5))
oracle = []
for i in range(n):
    best = 0.0
    for c in range(1, k):
        md, tau2 = stats[c]; w = tau2 / (tau2 + V[c][i]) if tau2 + V[c][i] > 0 else 0
        best = max(best, md + w * (D[c][i] - md))
    oracle.append(best)
print('perfect chooser among the %d, empirical-Bayes estimate: %+.4f per decision' % (k, mean(oracle)))
