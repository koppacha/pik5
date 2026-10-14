const replayTimestampFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
})

export function formatReplayTimestamp(value) {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return "----/--/-- --:--:--"
    const parts = replayTimestampFormatter.formatToParts(date)
    const get = (type) => parts.find((part) => part.type === type)?.value
    return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`
}

export async function fetchReplay(url, signal) {
    const response = await fetch(url, {signal})
    const body = await response.json()
    if (!response.ok) throw new Error(body?.data?.message || body?.message || "リプレイを読み込めませんでした")
    return body?.data ?? body
}

export function replayEventLabel(event) {
    return ({start: "大会開始", join: "参加", draw: "ドロー", take: "テイク", return_to_deck: "山札へ返却", record_posted: "記録投稿", record_updated: "記録更新", record_deleted: "記録削除", collect: "回収", player_extension: "延長", rule_changed: "裁定変更", ranking_reset: "ランキングリセット", ranking_reset_compensation: "補償", admin_score_corrected: "スコア修正", deck_replenished: "山札補充", event_ended: "大会終了", subsidy_paid: "定期給付", instant_subsidy_paid: "即時給付", balance_tax_collected: "保有ポイント還元", empty_field_floor_grant: "緊急給付"})[event] || "大会の更新"
}
