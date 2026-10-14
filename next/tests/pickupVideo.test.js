import assert from 'node:assert/strict'
import {test} from 'node:test'
import {getPickupVideoRuleName, getPickupVideoStageName} from '../lib/pickupVideo'

const t = {stage: {201: 'こてしらべの洞窟', 1314: '旧カード名', '201-1': '通常個別ルール'}, rule: {1: '通常ルール', 261009: '第19回期間限定ランキング'}}

test('event video uses original stage and actual card rule rather than event category', () => {
    const card = {stage_id: 1314, rule: 261009, event_origin_stage_id: 201, event_stage_name: '元のDB名', event_rule_name: 'ピクミン禁止'}
    assert.equal(getPickupVideoStageName(card, t), 'こてしらべの洞窟')
    assert.equal(getPickupVideoRuleName(card, t), 'ピクミン禁止')
    assert.equal(getPickupVideoRuleName({...card, rule: 10}, t), 'ピクミン禁止')
    assert.equal(getPickupVideoRuleName({...card, event_rule_name: ''}, t), '')
    assert.equal(getPickupVideoStageName({...card, event_origin_stage_id: 999}, t), '元のDB名')
})

test('normal videos keep individual rule overrides and hidden rule behavior', () => {
    assert.equal(getPickupVideoStageName({stage_id: 201, rule: 1}, t), 'こてしらべの洞窟')
    assert.equal(getPickupVideoRuleName({stage_id: 201, rule: 1}, t), '通常個別ルール')
    assert.equal(getPickupVideoRuleName({stage_id: 301, rule: 1}, t), '通常ルール')
    for (const rule of [10, 21, 22, 41, 42, 43]) assert.equal(getPickupVideoRuleName({stage_id: 201, rule}, t), '')
})
