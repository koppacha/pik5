"""Read an event-only archive; print aggregate checks, never row contents."""
import collections
import json
import sys
from pathlib import Path

archive = json.loads(Path(sys.argv[1]).read_text())
tables = archive['tables']
logs = sorted(tables['limit_logs'], key=lambda row: row['id'])
players = {}
states = {row['id']: '_deck' for row in tables['trick_event_cards']}
parents = {}
hand_errors = 0
remaining_point_errors = 0

def obj(value):
    return json.loads(value) if isinstance(value, str) else (value or {})

for row in logs:
    event = row['event']
    ctx = obj(row['context'])
    actor = row['actor_name']
    cid = row['event_card_id']
    if event == 'join':
        for values in players.values():
            values['dp'] += 1
        snapshot = obj(row['player_snapshot'])
        players[actor] = {'dp': snapshot['draw_points'], 'rp': snapshot['rank_points'], 'take': snapshot['take_count']}
    elif event == 'collect':
        for key in ['distribution', 'taker_remainder']:
            distribution = ctx.get(key) or {}
            for user, points in distribution.items():
                players[user]['dp'] += points
        for ranking in ctx['rankings']:
            players[ranking['user_id']]['rp'] += ranking['rps']
    elif row['points_delta'] is not None:
        target = row['affected_player_name'] or actor
        if target in players:
            players[target]['dp'] += row['points_delta']
    if event == 'draw':
        if ctx.get('recycled_count'):
            for key, state in states.items():
                if state == '_trash':
                    states[key] = '_deck'
        states[cid] = actor
    elif event == 'take':
        ids = obj(row['stacked_card_ids'])
        actual_hand = {key for key, state in states.items() if state == actor}
        if actual_hand != set(ids) | {cid} or len(actual_hand) != row['hand_count']:
            hand_errors += 1
        states[cid] = '_field'
        players[actor]['take'] += 1
        for key in ids:
            states[key] = '_stack'
            parents[key] = cid
    elif event == 'return_to_deck':
        states[cid] = '_deck'
    elif event == 'collect':
        states[cid] = '_collected'
        for key, parent in parents.items():
            if parent == cid and states[key] == '_stack':
                states[key] = '_trash'
    if row['remaining_draw_points'] is not None:
        target = row['affected_player_name'] or actor
        if target in players and players[target]['dp'] != row['remaining_draw_points']:
            remaining_point_errors += 1

final_player_errors = {metric: sum(players.get(row['name'], {}).get(key) != row[metric] for row in tables['players'])
                       for metric, key in [('draw_points', 'dp'), ('rank_points', 'rp'), ('take_count', 'take')]}
records = {row['post_id']: row for row in tables['records']}
post_ids = {obj(row['context'])['record_id'] for row in logs if row['event'] in ['record_posted', 'record_updated']}
print(json.dumps({
    'log_count': len(logs),
    'log_event_types': dict(collections.Counter(row['event'] for row in logs)),
    'final_player_mismatches': final_player_errors,
    'final_card_state_mismatches': sum(states[row['id']] != row['state'] for row in tables['trick_event_cards']),
    'take_hand_mismatches': hand_errors,
    'remaining_draw_point_mismatches': remaining_point_errors,
    'post_log_record_ids': len(post_ids),
    'missing_post_records': len(post_ids - records.keys()),
    'late_updated_records': sum(row['updated_at'] > tables['trick_events'][0]['end_at'] for row in records.values()),
    'duplicate_timestamp_count': len(logs) - len({row['created_at'] for row in logs}),
    'note': 'Only logged event reductions are checked. Historical metadata, additions and atomic boundaries need separate validation.'
}, ensure_ascii=False, indent=2))
