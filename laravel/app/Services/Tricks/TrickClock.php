<?php

namespace App\Services\Tricks;

use App\Models\TrickEvent;
use Carbon\CarbonImmutable;
use DomainException;

class TrickClock
{
    public function now(TrickEvent $event): CarbonImmutable
    {
        if (($event->debug || $event->test_mode) && $event->debug_now !== null) {
            return CarbonImmutable::instance($event->debug_now);
        }

        return CarbonImmutable::now();
    }

    public function set(TrickEvent $event, CarbonImmutable $now): TrickEvent
    {
        if (! $event->debug && ! $event->test_mode) {
            throw new DomainException('通常大会の時刻は変更できません');
        }
        if ($event->initialized_at !== null && $now->lessThan($this->now($event))) {
            throw new DomainException('大会処理開始後は時刻を巻き戻せません');
        }

        $event->debug_now = $now;
        $event->save();

        return $event->refresh();
    }

    public function freeze(TrickEvent $event): TrickEvent
    {
        if (! $event->debug && ! $event->test_mode) {
            throw new DomainException('通常大会の時刻は変更できません');
        }

        if ($event->debug_now === null) {
            $event->debug_now = CarbonImmutable::now();
            $event->save();
        }

        return $event->refresh();
    }

    public function reset(TrickEvent $event): TrickEvent
    {
        if (! $event->debug && ! $event->test_mode) {
            throw new DomainException('通常大会の時刻は変更できません');
        }

        $event->debug_now = null;
        $event->save();

        return $event->refresh();
    }
}
