const hiddenRuleIds = [10, 21, 22, 41, 42, 43]

export const getPickupVideoRuleName = (record, t) => {
    if (typeof record?.event_rule_name === 'string') return record.event_rule_name
    if (hiddenRuleIds.includes(Number(record?.rule))) return ''
    return t.stage?.[record?.stage_id + '-' + record?.rule] || t.rule?.[record?.rule] || ''
}

export const getPickupVideoStageName = (record, t) => {
    if (record?.event_origin_stage_id != null) {
        return t.stage?.[record.event_origin_stage_id] || record.event_stage_name || record.event_origin_stage_id
    }
    return t.stage?.[record?.stage_id] || record?.stage_id || ''
}
