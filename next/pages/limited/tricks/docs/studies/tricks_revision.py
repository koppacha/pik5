import sys, types, json, random, statistics, hashlib
from pathlib import Path
from datetime import timedelta
from concurrent.futures import ProcessPoolExecutor

SOURCE = Path(__file__).resolve().parents[6] / 'lab/tricks_rule_simulation.py'

def run(job):
    seed, scenario = job
    text = SOURCE.read_text()
    start = text.index('            if participant_order == 1 and (card.limit_at - self.now)')
    end = text.index('            card.limit_at += timedelta(minutes=extension_minutes)', start)
    text = text[:start] + '            extension_minutes = self.study_extension(card, participant_order)\n' + text[end:]
    mod = types.ModuleType('study_sim')
    sys.modules[mod.__name__] = mod
    exec(compile(text, str(SOURCE), 'exec'), mod.__dict__)

    class Study(mod.Simulation):
        def __init__(self):
            super().__init__(seed, Path('/tmp/tricks-revision-output'), True, False, True, 'all_field_first_endgame_free')
            self.prev_at = self.start_at
            self.prev_counts = (0, 200, 0, 0, False, set())
            self.area = dict(field=0., empty_active=0., blocked=0., no_available=0., active=0.)
            self.peak_locked = 0
            self.peak_unavailable = 0
            self.peak_retired = 0
            self.recycle = 0
            self.shortage_draws = 0
            self.late_count = 0
            self.min_available = 200

        def _required_take_hand(self):
            if scenario == 'first3' and getattr(self, 'evaluating_player', None) is not None and self.evaluating_player.last_take_at is None:
                return 3
            return 3 + (len(self.field) if scenario == 'old' else len(self.field)//2)

        def _legal_actions(self, player):
            self.evaluating_player = player
            return super()._legal_actions(player)

        def _can_take(self, player):
            previous = getattr(self, 'evaluating_player', None)
            self.evaluating_player = player
            try:
                return super()._can_take(player)
            finally:
                self.evaluating_player = previous

        def _take(self, player, cid, trigger='decision'):
            self.evaluating_player = player
            return super()._take(player, cid, trigger)

        def _handle_take_close_attempts(self):
            if scenario != 'first3': return super()._handle_take_close_attempts()
            players = [p for p in self.players.values() if p.joined]
            self.rng.shuffle(players)
            for player in players:
                self.evaluating_player = player
                if not self._can_take(player): continue
                cid = self._select_take_card(player)
                if cid is not None and self._feasible_new_field_posters(self.cards[cid], self.end_at) > 0:
                    self._take(player, cid, trigger='take_close_attempt')


        def _take_block_reason(self, player):
            reason = super()._take_block_reason(player)
            if scenario == 'first3' and player.last_take_at is None and len(player.hand) >= 3 and reason == 'insufficient_hand':
                if self.now >= self.end_at - mod.TAKE_CLOSE_BEFORE_END: return 'take_closed'
                if len(self.field) >= self._field_cap(): return 'field_cap'
                return None
            return reason

        def _handle_subsidy(self):

            for p in self.players.values():
                if not p.joined: continue
                due = p.subsidy_flag_slot_at is not None and p.subsidy_flag_slot_at <= self.now
                eligible = not self.field and (p.points < self.participant_count() if scenario == 'old' else p.points + len(p.hand) < 8)
                if (due or eligible) and p.last_subsidy_paid_slot_at != self.now:
                    p.points += 1
                    self.subsidy_payments += 1
                    p.last_subsidy_paid_slot_at = self.now
                    if due: p.subsidy_flag_slot_at = None
            self._record('subsidy_study', None, {})

        def study_extension(self, card, order):
            enabled = scenario in ('extension', 'exploit', 'first3')
            if order == 1:
                if enabled and (card.limit_at-self.now).total_seconds() < 45*60:
                    card.late_first_extension = True
                    self.late_count += 1
                    return 45
                return 0
            return max(5, (50 if card.late_first_extension else 70)-5*order)

        def _choose_action(self, player):
            action = super()._choose_action(player)
            if scenario in ('exploit', 'wait_control') and action['type'] == 'initial_post':
                card = self.cards[action['card_id']]
                if not card.posted_players:
                    duration = max(action['duration'], int((card.limit_at-self.now).total_seconds()//60)-44)
                    if self.now + timedelta(minutes=duration) < card.limit_at and player.is_active_during(self.now,self.now+timedelta(minutes=duration)):
                        # Waiting is not additional practice: store actual play separately.
                        self.wait_play = getattr(self, 'wait_play', {})
                        self.wait_play[(player.name, card.id)] = action['duration']
                        action = {**action, 'duration':duration}
            return action

        def _complete_initial_post(self, name, card, duration):
            duration = getattr(self,'wait_play',{}).pop((name,card),duration)
            return super()._complete_initial_post(name,card,duration)

        def _draw(self, player):
            if player.points > 0 and not self.deck and not self.trash: self.shortage_draws += 1
            if not self.deck and self.trash: self.recycle += 1
            return super()._draw(player)

        def _record(self, kind, actor, details):
            # Last post-mutation state describes interval up to this mutation.
            if hasattr(self, 'prev_counts'):
                minutes = (self.now-self.prev_at).total_seconds()/60
                f,d,tr,locked,active,blocked = self.prev_counts
                # Integrate activity at all session boundaries, not just decision events.
                bounds = {self.prev_at,self.now}
                for p in self.players.values():
                    for a,b in p.active_sessions:
                        if self.prev_at<a<self.now: bounds.add(a)
                        if self.prev_at<b<self.now: bounds.add(b)
                ordered = sorted(bounds)
                for a,b in zip(ordered,ordered[1:]):
                    mid=a+(b-a)/2
                    alive=[p for p in self.players.values() if p.joined and p.is_active(mid)]
                    dt=(b-a).total_seconds()/60
                    if alive:
                        self.area['active'] += dt
                        self.area['empty_active'] += dt*(f==0)
                        self.area['blocked'] += dt*(d+tr==0 and any(p.name in blocked for p in alive))
                self.area['field'] += f*minutes
                self.area['no_available'] += minutes*(d+tr==0)
                locked=sum(len(p.hand) for p in self.players.values())+sum(self.cards[c].stack_count for c in self.field)
                self.peak_locked=max(self.peak_locked,locked)
                self.peak_retired=max(self.peak_retired,len(self.collected))
                self.peak_unavailable=max(self.peak_unavailable,200-len(self.deck)-len(self.trash))
                self.min_available=min(self.min_available,len(self.deck)+len(self.trash))
                self.prev_counts=(len(self.field),len(self.deck),len(self.trash),locked,False,{p.name for p in self.players.values() if p.joined and p.points>0})
                self.prev_at=self.now
            return super()._record(kind,actor,details)

    s=Study(); summary=s.run()
    cards=[c for c in s.cards.values() if c.taken_at]
    return dict(seed=seed, scenario=scenario, takes=len(cards), stack=statistics.mean(c.stack_count for c in cards),
                field=s.area['field']/2880, empty_pct=100*s.area['empty_active']/max(1,s.area['active']),
                no_available_minutes=s.area['no_available'], blocked_pct=100*s.area['blocked']/max(1,s.area['active']),
                peak_locked=s.peak_locked, peak_unavailable=s.peak_unavailable, retired=s.peak_retired,
                min_available=s.min_available, shortage=s.shortage_draws, recycled=s.recycle,
                late=s.late_count, first_takers=sum(bool(p.take_times) for p in s.players.values()),
                first_take_hour=statistics.mean((p.take_times[0]-p.join_at).total_seconds()/3600 for p in s.players.values() if p.take_times),
                participants=statistics.mean(len(c.posted_players) for c in cards),
                posts=sum(p.actions.get('initial_post',0) for p in s.players.values()),
                points=sum(p.points for p in s.players.values()), traps=sum(p.actions.get('trap_return',0) for p in s.players.values()), ambushes=sum(p.actions.get('trap_attempt',0) for p in s.players.values()), errors=summary['invariant_errors'])

if __name__=='__main__':
    scenarios=['old','new','extension','wait_control','exploit','first3']
    with ProcessPoolExecutor(max_workers=4) as pool:
        rows=list(pool.map(run,[(seed,sc) for seed in range(275000,275100) for sc in scenarios]))
    result={'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'rows':rows,'means':{}}
    for sc in scenarios:
        group=[r for r in rows if r['scenario']==sc]
        result['means'][sc]={k:statistics.mean(r[k] for r in group) for k in group[0] if k not in ('seed','scenario','errors')}
        result['means'][sc]['runs_unavailable']=sum(r['min_available']==0 for r in group)
        result['means'][sc]['max_locked']=max(r['peak_locked'] for r in group)
        result['means'][sc]['max_unavailable']=max(r['peak_unavailable'] for r in group)
    print(json.dumps(result,ensure_ascii=False))
