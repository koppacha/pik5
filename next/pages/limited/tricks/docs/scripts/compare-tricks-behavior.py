"""Repeated simulations vs anonymous observed counts and expenditures."""
import argparse
import collections
import importlib.util
import json
import hashlib
import gzip
import statistics
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
spec = importlib.util.spec_from_file_location('tricks_behavior', ROOT/'lab/tricks_rule_simulation.py')
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
spec.loader.exec_module(m)
NAMES = ['Ko','A','T','Ku']
CORE_METRICS = ['draw','take','initial_post','update','paid_extension','opening_post','initial_cost','update_cost']
METRICS = CORE_METRICS+['return_to_deck']
calibration = m.EMPIRICAL_CALIBRATION
observed = {}
for name in NAMES:
    p = calibration['profiles'][name]
    observed[name] = dict(draw=p['action_counts']['draw'], take=p['action_counts']['take'],
                          initial_post=p['action_counts']['record_posted'],update=p['action_counts']['record_updated'],
                          paid_extension=p['action_counts']['player_extension'],opening_post=p['action_counts']['opening_post'],
                          initial_cost=p['points_spent']['taker_initial'],update_cost=p['points_spent']['update'],return_to_deck=p['points_spent']['return'])


class MeasuredSimulation(m.Simulation):
    def __init__(self,*args,**kwargs):
        self.measured=collections.defaultdict(collections.Counter)
        super().__init__(*args,**kwargs)

    def _record(self,event,actor,details):
        if actor in self.players:
            name=self.players[actor].display_name
            if name in NAMES:
                if event in METRICS:
                    self.measured[name][event]+=1
                if event=='initial_post':
                    self.measured[name]['initial_cost']+=details['cost']
                    self.measured[name]['opening_post']+=details['participant_order']==1
                if event=='update':
                    self.measured[name]['update_cost']+=details['cost']
        super()._record(event,actor,details)


def run(seeds,historical=False,baseline_source=None):
    baseline = None
    if baseline_source:
        baseline=types.ModuleType('tricks_v1')
        baseline.__file__=str(ROOT/'lab/tricks_rule_simulation.py')
        sys.modules['tricks_v1']=baseline
        baseline_code=baseline_source.read_bytes()
        if baseline_source.suffix=='.gz':
            baseline_code=gzip.decompress(baseline_code)
        exec(compile(baseline_code,str(baseline_source),'exec'),baseline.__dict__)
    rows=[]
    for seed in seeds:
        kwargs={'historical_tournament':True} if historical else {}
        if baseline:
            kwargs['behavior_tuning']={}
        sim=MeasuredSimulation(seed,Path('/private/tmp/tricks-behavior-fit'),write_outputs=False,rule_version="v19",**kwargs)
        if baseline:
            for method in ['_choose_action','_legal_actions','_holder_challenge','_empirical_action_value','_extension_plan','_score_trial_duration','_run_score_trial']:
                setattr(sim,method,types.MethodType(getattr(baseline.Simulation,method),sim))
            sim._behavior_need=lambda _player,_action:0.0
        summary=sim.run()
        assert not summary['invariant_errors'],summary['invariant_errors']
        assert all(t['ok'] for key,ts in summary.items() if key.startswith('fixed_') for t in ts)
        rows.append(dict(seed=seed,collections=summary['collections'],players={name:{k:sim.measured[name][k] for k in METRICS} for name in NAMES}))
    comparison={}
    for name in NAMES:
        comparison[name]={}
        for k in METRICS:
            values=[r['players'][name][k] for r in rows]
            mean=statistics.mean(values)
            target=observed[name][k]
            # Small counts use an absolute tolerance; larger counts use 30%.
            tolerance=max(3,target*0.30)
            comparison[name][k]=dict(observed=target,mean=round(mean,3),median=statistics.median(values),
                                     min=min(values),max=max(values),relative_error=round((mean-target)/max(1,target),4),
                                     tolerance=tolerance,pass_=abs(mean-target)<=tolerance)
    error=statistics.mean(abs(p[k]['relative_error']) for p in comparison.values() for k in CORE_METRICS)
    failures=[f'{n}.{k}' for n,p in comparison.items() for k,v in p.items() if not v['pass_']]
    tuning_path=m.CALIBRATION_PATH.with_name('tricks-behavior-parameters-261009.json')
    return dict(mode='historical' if historical else 'G_participates',baseline_source_sha256=hashlib.sha256(baseline_code).hexdigest() if baseline_source else None,
                simulator_sha256=hashlib.sha256((ROOT/'lab/tricks_rule_simulation.py').read_bytes()).hexdigest(),
                parameters={} if baseline_source else json.loads(tuning_path.read_text()),
                seeds=list(seeds),mean_absolute_relative_error=round(error,4),failures=failures,comparison=comparison,runs=rows)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--seed',type=int,default=261100)
    p.add_argument('--runs',type=int,default=10)
    p.add_argument('--historical',action='store_true')
    p.add_argument('--baseline-source',type=Path)
    p.add_argument('--output',type=Path,required=True)
    args=p.parse_args()
    result=run(range(args.seed,args.seed+args.runs),args.historical,args.baseline_source)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'mode':result['mode'],'error':result['mean_absolute_relative_error'],'failures':result['failures'],
                      'means':{n:{k:v['mean'] for k,v in p.items()} for n,p in result['comparison'].items()}},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
