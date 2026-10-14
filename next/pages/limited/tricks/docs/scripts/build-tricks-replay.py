"""Build private, sanitized replay checkpoints from an event-only archive."""
import argparse
import copy
import datetime as dt
import gzip
import hashlib
import json
import math
from pathlib import Path

TZ = dt.timezone(dt.timedelta(hours=9))
DECK_KEYS = ['id', 'card_id', 'card_key', 'origin_stage_id', 'stage_id', 'title', 'rule_name', 'text', 'difficulty', 'creator', 'score_type', 'score_order', 'clone_source_deck_id']
CARD_KEYS = ['id', 'event_id', 'deck_id', 'state', 'difficulty', 'rarity', 'stack_count', 'taker', 'top_player', 'post_count', 'paid_points_total', 'limit_at', 'taken_at', 'collected_at', 'stack_parent_id', 'drawn_order', 'draw_count', 'returned_count', 'late_first_extension']
META_KEYS = ['post_id', 'unique_id', 'user_id', 'rule', 'console', 'difficulty', 'region', 'post_comment', 'img_url', 'video_url', 'created_at', 'updated_at', 'team']
LOG_KEYS = ['id', 'event', 'event_id', 'event_card_id', 'actor_name', 'affected_player_name', 'card_id', 'stage_id', 'from_state', 'to_state', 'points_delta', 'rank_points_delta', 'draw_points_delta', 'remaining_draw_points', 'remaining_deck_count', 'hand_count', 'rewards', 'records_count', 'top_user_id', 'top_score', 'previous_limit', 'new_limit', 'created_at']
PUBLIC_EVENTS = ['join', 'join_existing', 'take', 'record_posted', 'record_updated', 'record_deleted', 'rule_changed', 'ranking_reset', 'ranking_reset_compensation', 'limit_extended', 'player_extension', 'empty_field_floor_grant', 'collect', 'subsidy_paid', 'instant_subsidy_paid', 'event_ended']

def obj(value):
    return json.loads(value) if isinstance(value, str) else (value or {})

def time(value):
    value = dt.datetime.fromisoformat(value)
    return value.replace(tzinfo=TZ) if value.tzinfo is None else value

def iso(value):
    return (time(value) if isinstance(value, str) else value).astimezone(TZ).isoformat(timespec='seconds')

def pick(row, keys):
    return {key: row.get(key) for key in keys}

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
    if path.suffix == '.gz':
        path.write_bytes(gzip.compress(raw, mtime=0))
    else:
        path.write_bytes(raw)
    path.chmod(0o600)

class ReplayBuilder:
    def __init__(self, archive):
        self.tables = archive['tables']
        self.event = self.tables['trick_events'][0]
        if self.event['state'] != 'ended':
            raise ValueError('Only ended events can be built')
        self.start = time(self.event['start_at'])
        self.end = time(self.event['ended_at'] or self.event['end_at'])
        self.logs = sorted(self.tables['limit_logs'], key=lambda row: (time(row['created_at']), row['id']))
        self.records = {row['post_id']: row for row in self.tables['records']}
        self.scores = {}
        self.meta = {}
        for row in sorted(self.tables['records'], key=lambda row: (row['updated_at'], row['post_id'])):
            self.meta[str(row['unique_id'])] = pick(row, META_KEYS)
        for row in self.logs:
            if row['event'] == 'admin_score_corrected':
                ctx = obj(row['context'])
                record = self.records.get(ctx['record_id'])
                if record:
                    self.scores[str(record['unique_id'])] = int(ctx['corrected_score'])
        decks = {row['id']: pick(row, DECK_KEYS) for row in self.tables['decks']}
        # Earliest observed content and ruling before-values establish initial versions.
        seen = set()
        for row in self.logs:
            snapshot = obj(row['card_snapshot'])
            if snapshot and row['card_id'] not in seen:
                observed = snapshot.get('deck', {})
                decks[row['card_id']].update({key: observed[key] for key in DECK_KEYS if key in observed})
                seen.add(row['card_id'])
        for row in reversed(self.logs):
            if row['event'] == 'rule_changed':
                decks[row['card_id']].update(obj(row['context'])['before'])
        self.initial = {}
        self.additions = {}
        for row in self.tables['trick_event_cards']:
            deck = decks[row['deck_id']]
            value = dict.fromkeys(CARD_KEYS)
            value.update(id=row['id'], event_id=row['event_id'], deck_id=row['deck_id'], state='_deck', difficulty=deck['difficulty'], stack_count=0, post_count=0, paid_points_total=0, draw_count=0, returned_count=0, late_first_extension=False, deck=deck)
            born = self.start
            if deck.get('clone_source_deck_id'):
                created = time(row['created_at'])
                born = dt.datetime.fromtimestamp((int(created.timestamp()) // 900 + 1) * 900, TZ)
            if born <= self.start:
                self.initial[str(row['id'])] = value
            else:
                self.additions.setdefault(iso(born), {})[str(row['id'])] = value
        self.state = {'cards': copy.deepcopy(self.initial), 'players': {}, 'records': {}, 'holders': {}, 'rewards': {}, 'final_rankings': {}, 'pot_points': 0, 'draw_total': 0, 'take_total': 0, 'ended': False}
        self.public = []
        self.audit = {'take_hand_mismatches': 0, 'remaining_draw_point_mismatches': 0, 'score_corrections': len(self.scores), 'ruling_changes': sum(row['event'] == 'rule_changed' for row in self.logs)}

    def apply(self, row):
        st = self.state
        cards, players = st['cards'], st['players']
        event, actor = row['event'], row['actor_name']
        cid = str(row['event_card_id'])
        ctx = obj(row['context'])
        if event == 'join':
            for player in players.values():
                player['draw_points'] += 1
            p = obj(row['player_snapshot'])
            players[actor] = {**pick(p, ['name', 'draw_points', 'rank_points', 'take_count', 'created_at']), 'last_take_at': None}
        elif event == 'collect':
            for key in ['distribution', 'taker_remainder']:
                for user, points in (ctx.get(key) or {}).items():
                    players[user]['draw_points'] += points
            for ranking in ctx['rankings']:
                players[ranking['user_id']]['rank_points'] += ranking['rps']
            st['pot_points'] -= int(ctx.get('pot_points_used') or 0)
            st['holders'][cid] = ctx.get('holders', [])
            st['rewards'][cid] = sum((ctx.get('distribution') or {}).values()) + sum((ctx.get('taker_remainder') or {}).values())
            st['final_rankings'][cid] = [{**pick(r, ['post_id', 'unique_id', 'user_id', 'score', 'score_type', 'rank', 'post_rank', 'rps', 'provisional_reward_points', 'created_at']), 'score': self.scores.get(str(r.get('unique_id')), r['score'])} for r in ctx.get('final_rankings', [])]
        elif event == 'empty_field_floor_grant':
            for user, points in ctx['grants'].items():
                players[user]['draw_points'] += points
        elif row.get('points_delta') is not None:
            user = row['affected_player_name'] or actor
            if user in players:
                players[user]['draw_points'] += int(row['points_delta'])
        if event in ['balance_tax_collected', 'return_to_deck']:
            st['pot_points'] += -int(row['points_delta'])
        if event == 'draw':
            if ctx.get('recycled_count'):
                for card in cards.values():
                    if card['state'] == '_trash':
                        card.update(state='_deck', rarity=None, draw_count=0, stack_parent_id=None)
            if cid not in cards:
                raise ValueError('Draw before replenishment checkpoint')
            self.snapshot_card(row)
            st['draw_total'] += 1
        elif event == 'take':
            ids = obj(row['stacked_card_ids'])
            actual = {int(key) for key, card in cards.items() if card['state'] == actor}
            self.audit['take_hand_mismatches'] += actual != set(ids) | {int(cid)} or len(actual) != row['hand_count']
            self.snapshot_card(row)
            for key in ids:
                cards[str(key)].update(state='_stack', stack_parent_id=int(cid))
            players[actor]['take_count'] += 1
            players[actor]['last_take_at'] = cards[cid]['taken_at']
            st['take_total'] += 1
        elif event == 'return_to_deck':
            cards[cid].update(state='_deck', drawn_order=None, returned_count=int(cards[cid]['returned_count'] or 0) + 1)
        elif event == 'collect':
            cards[cid].update(state='_collected', collected_at=row['created_at'])
            for card in cards.values():
                if card['stack_parent_id'] == int(cid) and card['state'] == '_stack':
                    card.update(state='_trash', draw_count=0, rarity=None)
        elif event in ['record_posted', 'record_updated']:
            source = self.records.get(ctx['record_id'])
            if source is None:
                raise ValueError('Missing post version')
            for previous in st['records'].values():
                if previous['unique_id'] == source['unique_id']:
                    previous['active'] = False
            st['records'][str(source['post_id'])] = {**pick(source, ['post_id', 'unique_id', 'user_id', 'created_at']), 'event_card_id': int(cid), 'score': self.scores.get(str(source['unique_id']), int(ctx['score'])), 'active': True}
            cards[cid]['paid_points_total'] += max(0, -int(row.get('points_delta') or 0))
            cards[cid]['limit_at'] = row['new_limit']
            if ctx.get('participant_order') == 1 and ctx.get('extension_minutes') == 30:
                cards[cid]['late_first_extension'] = True
        elif event in ['player_extension', 'limit_extended']:
            cards[cid]['paid_points_total'] += max(0, -int(row.get('points_delta') or 0))
            cards[cid]['limit_at'] = row['new_limit']
        elif event == 'record_deleted':
            record = st['records'].get(str(ctx['record_id']))
            if record:
                record['active'] = False
        elif event == 'ranking_reset':
            for rid in ctx['record_ids']:
                if str(rid) in st['records']:
                    st['records'][str(rid)]['active'] = False
        elif event == 'rule_changed':
            cards[cid]['deck'].update(ctx['after'])
            cards[cid]['difficulty'] = cards[cid]['deck']['difficulty']
        elif event == 'event_ended':
            st['ended'] = True
        if row.get('remaining_draw_points') is not None:
            user = row['affected_player_name'] or actor
            if user in players:
                self.audit['remaining_draw_point_mismatches'] += players[user]['draw_points'] != row['remaining_draw_points']
        payload = pick(row, LOG_KEYS)
        if event in ['record_posted', 'record_updated']:
            source = self.records[ctx['record_id']]
            payload['score'] = self.scores.get(str(source['unique_id']), ctx['score'])
            deck = cards[cid]['deck']
            ascending = deck['score_type'] == 'time' and (deck.get('score_order') == 'asc' or (deck.get('score_order') != 'desc' and deck.get('stage_id') != 1356 and not 419 <= int(deck.get('origin_stage_id') or 0) <= 428))
            best = {}
            for record in st['records'].values():
                if record['active'] and record['event_card_id'] == int(cid):
                    user, score = record['user_id'], record['score']
                    if user not in best or (score < best[user] if ascending else score > best[user]):
                        best[user] = score
            actor_score = best.get(actor)
            payload['rank'] = 1 + sum((score < actor_score if ascending else score > actor_score) for score in best.values()) if actor_score is not None else None
        card = cards.get(cid)
        if card:
            payload.update(card_title=card['deck']['title'], rule_name=card['deck']['rule_name'], score_type=card['deck']['score_type'], rarity=card['rarity'])
        payload['subsidy_slot'] = ctx.get('slot') if event == 'subsidy_paid' else None
        payload['granted_points_total'] = ctx.get('total_points')
        if event in PUBLIC_EVENTS:
            self.public.append(payload)

    def snapshot_card(self, row):
        cid = str(row['event_card_id'])
        snapshot = obj(row['card_snapshot'])
        self.state['cards'][cid].update(pick(snapshot, CARD_KEYS))
        self.state['cards'][cid]['deck'].update({key: snapshot['deck'][key] for key in DECK_KEYS if key in snapshot['deck']})

    def build(self, directory):
        if (directory / 'manifest.json').exists():
            raise FileExistsError('Build into a new directory, then install atomically')
        frames = []
        checkpoints = []
        checkpoint_times = []
        at = self.start
        while at <= self.end:
            checkpoint_times.append(at)
            at += dt.timedelta(minutes=15)
        if checkpoint_times[-1] != self.end:
            checkpoint_times.append(self.end)
        steps = [(time(row['created_at']), row['id'], row) for row in self.logs]
        steps += [(time(at), -1, {'addition': values}) for at, values in self.additions.items()]
        steps.sort(key=lambda value: (value[0], value[1]))
        index = 0
        public = []
        for at in checkpoint_times:
            while index < len(steps) and steps[index][0] <= at:
                stamp, _, row = steps[index]
                before = copy.deepcopy(self.state)
                old_public = len(self.public)
                if 'addition' in row:
                    self.state['cards'].update(copy.deepcopy(row['addition']))
                    event, logid = 'deck_replenished', None
                else:
                    self.apply(row)
                    event, logid = row['event'], row['id']
                patch = {'maps': {}, 'values': {}}
                for key, value in self.state.items():
                    if isinstance(value, dict):
                        changes = {k: v for k, v in value.items() if before[key].get(k) != v}
                        if changes:
                            patch['maps'][key] = changes
                    elif before[key] != value:
                        patch['values'][key] = value
                frame = {'at': iso(stamp), 'log_id': logid, 'event': event, 'patch': copy.deepcopy(patch)}
                if len(self.public) > old_public:
                    public.append({'cursor': len(frames) + 1, 'log': self.public[-1]})
                frames.append(frame)
                index += 1
            name = f'checkpoint-{len(checkpoints):03d}.json.gz'
            write(directory / name, self.state)
            checkpoints.append({'at': iso(at), 'cursor': len(frames), 'file': name})
        if index != len(steps):
            raise ValueError('Logs beyond ended_at require a refreshed cutoff policy')
        final = self.state
        self.audit['final_card_state_mismatches'] = sum(final['cards'][str(card['id'])]['state'] != card['state'] for card in self.tables['trick_event_cards'])
        self.audit['final_player_mismatches'] = {key: sum(final['players'][player['name']][key] != player[key] for player in self.tables['players']) for key in ['draw_points', 'rank_points', 'take_count']}
        self.audit['final_pot_mismatch'] = final['pot_points'] != self.event['pot_points']
        self.audit['final_valid_post_count_mismatch'] = sum(record['active'] for record in final['records'].values()) != sum(int(row['flg']) < 2 for row in self.tables['records'])
        if self.audit['take_hand_mismatches'] or self.audit['remaining_draw_point_mismatches'] or self.audit['final_card_state_mismatches'] or any(self.audit['final_player_mismatches'].values()) or self.audit['final_pot_mismatch'] or self.audit['final_valid_post_count_mismatch']:
            raise ValueError(json.dumps(self.audit))
        write(directory / 'frames.json.gz', frames)
        write(directory / 'catalog.json.gz', {'metadata': self.meta, 'public_logs': public})
        manifest = {'version': 1, 'event_id': self.event['event_id'], 'title': self.event['title'], 'start_at': iso(self.start), 'end_at': iso(self.event['end_at']), 'ended_at': iso(self.end), 'published_at': iso(max(self.end, time('2026-10-11 20:00:00')) if self.event['event_id'] == 261009 else self.end), 'checkpoints': checkpoints, 'timeline': [{'at': iso(self.start), 'cursor': 0, 'log_id': None, 'event': 'start'}] + [{k: frame[k] for k in ['at', 'log_id', 'event']} | {'cursor': i + 1} for i, frame in enumerate(frames)], 'audit': self.audit, 'additions': [{'at': at, 'count': len(values)} for at, values in self.additions.items()]}
        write(directory / 'manifest.json', manifest)
        return manifest

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('archive', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    raw = args.archive.read_bytes()
    builder = ReplayBuilder(json.loads(raw))
    manifest = builder.build(args.output)
    print(json.dumps({'checkpoints': len(manifest['checkpoints']), 'frames': len(manifest['timeline']) - 1, 'audit': manifest['audit'], 'additions': manifest['additions'], 'source_sha256': hashlib.sha256(raw).hexdigest()}, ensure_ascii=False, indent=2))
