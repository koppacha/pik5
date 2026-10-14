"""Check every generated checkpoint and explicit historical-policy boundaries."""
import argparse
import copy
import gzip
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=Path)
parser.add_argument('replay', type=Path)
a = parser.parse_args()
source = json.loads(a.archive.read_text())
manifest = json.loads((a.replay / 'manifest.json').read_text())
frames = json.loads(gzip.decompress((a.replay / 'frames.json.gz').read_bytes()))
read = lambda name: json.loads(gzip.decompress((a.replay / name).read_bytes()))
state = read(manifest['checkpoints'][0]['file'])
cursor = 0
for checkpoint in manifest['checkpoints']:
    while cursor < checkpoint['cursor']:
        patch = frames[cursor]['patch']
        for key, changes in patch['maps'].items():
            state[key].update(changes)
        state.update(patch['values'])
        cursor += 1
    assert state == read(checkpoint['file']), 'Checkpoint / patch mismatch'
assert cursor == len(frames)
add = next(cp for cp in manifest['checkpoints'] if cp['at'] == '2026-10-10T15:00:00+09:00')
prev = manifest['checkpoints'][manifest['checkpoints'].index(add)-1]
assert len(read(add['file'])['cards']) - len(read(prev['file'])['cards']) == 160
records = {r['post_id']:r for r in source['tables']['records']}
corrected = {}
for log in source['tables']['limit_logs']:
    if log['event'] == 'admin_score_corrected':
        ctx = json.loads(log['context'])
        corrected[records[ctx['record_id']]['unique_id']] = ctx['corrected_score']
state = read(manifest['checkpoints'][0]['file'])
ruling_checks = 0
corrected_checks = 0
payout_checks = 0
zero_payouts = 0
raw_logs = {r['id']:r for r in source['tables']['limit_logs']}
for frame in frames:
    if frame['log_id'] and raw_logs[frame['log_id']]['event'] == 'rule_changed':
        row = raw_logs[frame['log_id']]
        ctx = json.loads(row['context'])
        card = state['cards'][str(row['event_card_id'])]
        assert all(card['deck'][key] == value for key,value in ctx['before'].items())
    for key, changes in frame['patch']['maps'].items():
        state[key].update(copy.deepcopy(changes))
    state.update(frame['patch']['values'])
    if frame['event'] == 'collect':
        collection = raw_logs[frame['log_id']]
        context = json.loads(collection['context'])
        expected = sum((context.get('distribution') or {}).values()) + sum((context.get('taker_remainder') or {}).values())
        assert state['rewards'][str(collection['event_card_id'])] == expected, 'Historical collected payout mismatch'
        payout_checks += 1
        zero_payouts += expected == 0
    if frame['log_id'] and raw_logs[frame['log_id']]['event'] == 'rule_changed':
        assert all(state['cards'][str(row['event_card_id'])]['deck'][key] == value for key,value in ctx['after'].items())
        ruling_checks += 1
    if frame['event'] in ['record_posted','record_updated']:
        row = raw_logs[frame['log_id']]
        rid = json.loads(row['context'])['record_id']
        unique = records[rid]['unique_id']
        if unique in corrected:
            assert state['records'][str(rid)]['score'] == corrected[unique]
            corrected_checks += 1
serialized = json.dumps({'manifest':manifest,'frames':frames,'catalog':read('catalog.json.gz'),'state':state})
for key in ['user_ip','user_host','user_agent','request_id','password','token','cookie']:
    assert f'"{key}"' not in serialized
print(json.dumps({'verified_checkpoints':len(manifest['checkpoints']), 'verified_frames':len(frames), 'replenishment':160, 'ruling_boundaries':ruling_checks,'retroactive_score_checks':corrected_checks,'historical_payout_checks':payout_checks,'unposted_zero_payouts':zero_payouts,'private_columns_exported':False}))
