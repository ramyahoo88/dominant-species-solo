"""Train the neural-network placement player's correction net (PyTorch, GPU if available).

Run by source/benchmark/nn/gpu-runner.ps1 as:  train --data results/pb_nn_d1,results/pb_nn_d2 --out results/pb_nn_net1.json
Each data prefix is from `node source/benchmark.cjs --nn-data`: PREFIX.bin (float32 features, one row per sample),
PREFIX.jsonl (candidates [space, tuned value, net value, win rate, mean margin]) and PREFIX.meta.json.

The player scores an open space as  tuned value + net(board)[space].  Each sample compares the policy's top spaces,
each played out on the same re-dealt futures. Training is pairwise (RankNet): for two candidates whose playout
utility differs, the better one's score should be higher. Utility = win rate + margin_weight * clip(margin, +-50) / 50.
The last layer starts at zero, so an untrained net is the tuned player. Prints a JSON report; writes the net as JSON.
Samples are split train / validation (epoch selection, by default on the validation gain) / test (report only).
"""
import argparse, json, math, os, sys, time
import numpy as np
import torch
import torch.nn as nn


def parse():
    p = argparse.ArgumentParser()
    p.add_argument('--data', required=True, help='comma-separated data prefixes')
    p.add_argument('--out', required=True)
    p.add_argument('--hidden', default='256,256')
    p.add_argument('--epochs', type=int, default=40)
    p.add_argument('--lr', type=float, default=1e-3)
    p.add_argument('--wd', type=float, default=1e-4)
    p.add_argument('--l2out', type=float, default=1e-3, help='penalty on the size of the correction')
    p.add_argument('--margin-weight', type=float, default=0.5)
    p.add_argument('--min-gap', type=float, default=0.05, help='utility gap below which a pair is ignored')
    p.add_argument('--temp', type=float, default=1.0, help='score units per logit')
    p.add_argument('--val-frac', type=float, default=0.15, help='samples for early stopping / model selection')
    p.add_argument('--test-frac', type=float, default=0.15, help='samples held out of training AND selection, for the report')
    p.add_argument('--select', default='gain', choices=['gain', 'loss'], help='keep the epoch with the best validation gain (net pick minus tuned pick, utility) or loss')
    p.add_argument('--seed', type=int, default=1)
    return p.parse_args()


def load(prefixes):
    xs, cands, meta = [], [], None
    for prefix in prefixes:
        with open(prefix + '.meta.json', encoding='utf-8-sig') as f:
            m = json.load(f)
        if meta and (m['featureSize'] != meta['featureSize'] or m['slots'] != meta['slots']):
            sys.exit('Data sets have different layouts: ' + prefix)
        meta = m
        x = np.fromfile(prefix + '.bin', dtype=np.float32).reshape(-1, m['featureSize'])
        with open(prefix + '.jsonl', encoding='utf-8-sig') as f:
            rows = [json.loads(line) for line in f if line.strip()]
        if len(rows) != len(x):
            sys.exit('%s: %d feature rows but %d sample lines' % (prefix, len(x), len(rows)))
        xs.append(x)
        cands += [r['cands'] for r in rows]
    return np.concatenate(xs), cands, meta


def pairs_of(cands, margin_weight, min_gap):
    """Per sample: candidate spaces and tuned values (padded to K), and the pairs (better, worse, weight)."""
    K = max(len(c) for c in cands)
    n = len(cands)
    slot = np.zeros((n, K), dtype=np.int64)
    tuned = np.full((n, K), -1e4, dtype=np.float32)
    util = np.full((n, K), -1e4, dtype=np.float32)
    win = np.full((n, K), -1e4, dtype=np.float32)
    pi, pa, pb, pw = [], [], [], []
    for i, c in enumerate(cands):
        u = [w + margin_weight * max(-50.0, min(50.0, mg)) / 50.0 for (_, _, _, w, mg) in c]
        for k, (s, t, _, w, _) in enumerate(c):
            slot[i, k], tuned[i, k], util[i, k], win[i, k] = s, t, u[k], w
        for a in range(len(c)):
            for b in range(len(c)):
                gap = u[a] - u[b]
                if gap > min_gap:
                    pi.append(i); pa.append(a); pb.append(b); pw.append(min(1.0, gap))
    return slot, tuned, util, win, np.array(pi), np.array(pa), np.array(pb), np.array(pw, dtype=np.float32)


class Net(nn.Module):
    def __init__(self, n_in, hidden, n_out):
        super().__init__()
        sizes = [n_in] + hidden
        layers = []
        for a, b in zip(sizes, sizes[1:]):
            layers += [nn.Linear(a, b), nn.ReLU()]
        self.body = nn.Sequential(*layers)
        self.head = nn.Linear(sizes[-1], n_out)
        nn.init.zeros_(self.head.weight)
        nn.init.zeros_(self.head.bias)

    def forward(self, x):
        return self.head(self.body(x))


def main():
    a = parse()
    torch.manual_seed(a.seed)
    rng = np.random.default_rng(a.seed)
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    t0 = time.time()
    X, cands, meta = load(a.data.split(','))
    slot, tuned, util, win, pi, pa, pb, pw = pairs_of(cands, a.margin_weight, a.min_gap)
    n, F = X.shape
    n_out = len(meta['slots'])
    # Split by sample.
    order = rng.permutation(n)
    n_val, n_test = int(n * a.val_frac), int(n * a.test_frac)
    is_val = np.zeros(n, dtype=bool)
    is_val[order[:n_val]] = True
    is_test = np.zeros(n, dtype=bool)
    is_test[order[n_val:n_val + n_test]] = True
    is_train = ~is_val & ~is_test
    mean = X[is_train].mean(0)
    std = X[is_train].std(0)
    std[std < 1e-3] = 1.0
    Xt = torch.tensor((X - mean) / std, device=dev)
    slot_t, tuned_t = torch.tensor(slot, device=dev), torch.tensor(tuned, device=dev)
    train_pairs = np.where(is_train[pi])[0]
    val_pairs = np.where(is_val[pi])[0]
    test_pairs = np.where(is_test[pi])[0]
    P = {k: torch.tensor(v, device=dev) for k, v in dict(i=pi, a=pa, b=pb, w=pw).items()}

    net = Net(F, [int(h) for h in a.hidden.split(',')], n_out).to(dev)
    opt = torch.optim.AdamW(net.parameters(), lr=a.lr, weight_decay=a.wd)

    def scores(idx):
        r = net(Xt[idx])
        return tuned_t[idx] + torch.gather(r, 1, slot_t[idx]), torch.gather(r, 1, slot_t[idx])

    def pair_loss(sel):
        if len(sel) == 0:
            return torch.zeros((), device=dev), float('nan')
        i, ka, kb, w = P['i'][sel], P['a'][sel], P['b'][sel], P['w'][sel]
        s, r = scores(i)
        diff = (s.gather(1, ka[:, None]) - s.gather(1, kb[:, None]))[:, 0] / a.temp
        loss = (nn.functional.softplus(-diff) * w).sum() / w.sum()
        return loss + a.l2out * (r ** 2).mean(), (diff > 0).float().mean().item()

    def evaluate(mask):
        """Over samples in mask: mean utility and win rate of the space each scorer picks (tuned alone vs tuned + net),
        and the net's gain over the tuned pick with its standard error. Only meaningful on samples the net never saw."""
        idx = torch.tensor(np.where(mask)[0], device=dev)
        with torch.no_grad():
            s, _ = scores(idx)
        valid = torch.tensor(util[mask] > -1e3, device=dev)
        u = torch.tensor(util[mask], device=dev)
        wn = torch.tensor(win[mask], device=dev)
        pick_net = torch.where(valid, s, torch.full_like(s, -1e9)).argmax(1)
        pick_tuned = torch.where(valid, tuned_t[idx], torch.full_like(s, -1e9)).argmax(1)
        best = torch.where(valid, u, torch.full_like(u, -1e9)).max(1).values
        g = lambda m, pick: m.gather(1, pick[:, None])[:, 0]
        du, dw = g(u, pick_net) - g(u, pick_tuned), g(wn, pick_net) - g(wn, pick_tuned)
        se = lambda d: d.std().item() / math.sqrt(max(1, len(d)))
        return {'samples': int(mask.sum()), 'tunedPick': round(g(u, pick_tuned).mean().item(), 4), 'netPick': round(g(u, pick_net).mean().item(), 4),
                'bestPossible': round(best.mean().item(), 4), 'changedPicks': round((pick_net != pick_tuned).float().mean().item(), 3),
                'gain': round(du.mean().item(), 4), 'gainSE': round(se(du), 4), 'winGain': round(dw.mean().item(), 4), 'winGainSE': round(se(dw), 4)}

    history = []
    batch = 4096
    best_state, best_val, best_epoch = None, None, 0
    if a.select == 'gain':   # epoch 0 is the untrained net, i.e. the tuned player itself: a net must beat it to be kept
        best_state, best_val = {k: v.detach().clone() for k, v in net.state_dict().items()}, -evaluate(is_val)['gain']
    for epoch in range(a.epochs):
        net.train()
        perm = torch.tensor(rng.permutation(train_pairs), device=dev)
        for k in range(0, len(perm), batch):
            loss, _ = pair_loss(perm[k:k + batch])
            opt.zero_grad()
            loss.backward()
            opt.step()
        net.eval()
        with torch.no_grad():
            tl, ta = pair_loss(torch.tensor(train_pairs, device=dev))
            vl, va = pair_loss(torch.tensor(val_pairs, device=dev))
        ev = evaluate(is_val)
        row = {'epoch': epoch + 1, 'trainLoss': round(tl.item(), 4), 'trainPairAcc': round(ta, 3), 'valLoss': round(vl.item(), 4),
               'valPairAcc': round(va, 3), **{'val' + k[0].upper() + k[1:]: v for k, v in ev.items() if k != 'samples'}}
        history.append(row)
        print(json.dumps(row), file=sys.stderr, flush=True)
        crit = -ev['gain'] if a.select == 'gain' else vl.item()
        if best_val is None or crit < best_val:
            best_val, best_epoch = crit, epoch + 1
            best_state = {k: v.detach().clone() for k, v in net.state_dict().items()}
    net.load_state_dict(best_state)
    net.eval()

    layers = []
    for m in list(net.body) + [net.head]:
        if isinstance(m, nn.Linear):
            layers.append({'in': m.in_features, 'out': m.out_features,
                           'W': [round(v, 6) for v in m.weight.detach().cpu().numpy().reshape(-1).tolist()],
                           'b': [round(v, 6) for v in m.bias.detach().cpu().numpy().tolist()]})
    with torch.no_grad():
        tuned_only = {'pairAcc': round(float(((tuned[pi[val_pairs], pa[val_pairs]] - tuned[pi[val_pairs], pb[val_pairs]]) > 0).mean()), 3)}
    report = {'samples': n, 'validationSamples': n_val, 'testSamples': n_test, 'pairs': len(pi), 'validationPairs': len(val_pairs), 'device': dev,
              'gpu': torch.cuda.get_device_name(0) if dev == 'cuda' else None, 'seconds': round(time.time() - t0, 1),
              'args': vars(a), 'tunedOnlyVal': tuned_only, 'bestEpoch': best_epoch, 'select': a.select,
              'test': evaluate(is_test) if n_test else None, 'final': {**evaluate(is_val), 'train': evaluate(is_train)},
              'bestValCriterion': round(best_val, 4), 'history': history}
    net_json = {'featuresVersion': meta['featuresVersion'], 'featureSize': F, 'slots': meta['slots'],
                'mean': [round(float(v), 6) for v in mean], 'std': [round(float(v), 6) for v in std], 'layers': layers,
                'trainedOn': a.data, 'report': {k: v for k, v in report.items() if k != 'history'}}
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(net_json, f)
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
