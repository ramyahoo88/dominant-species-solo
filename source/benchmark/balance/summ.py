import sys, json
sys.path.insert(0,'/home/claude/diag'); import matched
R='/mnt/user-data/uploads/dominant-species-solo/results/'
def summ(f, app='app_pooled.json'):
    try: d=matched.load(R+f)
    except Exception: print('%-28s (not ready)' % f); return
    ed=matched.edges(R+app,R+f)
    lv={k:(v['tuned']['pct'],v['dominance']['pct']) for k,v in d['pooled'].items() if k not in('All',)}
    lvls=[k for k in ['Standard','Hard','Expert'] if k in ed]
    x35=sum(ed[k][b] for k in lvls for b in (3,4,5))/(3*len(lvls)); x2=sum(ed[k][2] for k in lvls)/len(lvls)
    print('%-26s X35 %+.2f X2 %+.2f | ' % (f.replace('.json',''), x35, x2) + ' | '.join('%s %.1f/%.1f (%+.2f)' % (k[:3], lv[k][0], lv[k][1], sum(ed[k][b] for b in (3,4,5))/3) for k in lvls))
if __name__=='__main__':
    for f in sys.argv[1:]: summ(f)
