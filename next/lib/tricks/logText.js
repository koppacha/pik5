import {sec2time} from "../pik5"

function displayName(usersById, userId, fallback = "-") {
    if (!userId) return fallback
    return usersById[userId]?.name || userId
}

const logTimestampFormatter = new Intl.DateTimeFormat("ja-JP", {month: "numeric", day: "numeric", timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23"})

function logTimestamp(value) {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return "-/- --:--"

    const parts = logTimestampFormatter.formatToParts(date)
    const part = (type) => parts.find((value) => value.type === type)?.value
    return `${part("month")}/${part("day")} ${part("hour")}:${part("minute")}`
}

export function formatTricksLog(log, usersById) {
    if (typeof log === "string") return `-/- --:-- - ${log}`
    const user = displayName(usersById, log?.actor_name)
    const topUser = displayName(usersById, log?.top_user_id, "ホルダーなし")
    const title = log?.card_title || `カード#${log?.card_id || "-"}`
    const cardTitle = log?.rule_name ? `${title}（${log.rule_name}）` : title
    const rarity = Math.max(1, Number(log?.rarity || 1))
    let text = log?.message || log?.text || log?.event || "イベントが発生しました。"

    if (log?.event === "join") text = `${user}さんが参加しました。`
    if (log?.event === "take") text = `${user}さんが★${rarity} ${cardTitle}をテイクしました。`
    if (log?.event === "record_posted" || log?.event === "record_updated") {
        const score = log?.score == null ? "-" : log.score_type === "time" ? sec2time(Number(log.score)) : `${log.score}点`
        text = `${user}さんが${cardTitle}に投稿しました。（${score} / ${log?.rank ?? "-"}位）`
    }
    if (log?.event === "rule_changed") text = `${cardTitle}のルールが管理者裁定により変更されました。`
    if (log?.event === "ranking_reset") text = `${cardTitle}のランキングがリセットされました。`
    if (log?.event === "ranking_reset_compensation") text = `${displayName(usersById, log.affected_player_name)}さんにお詫びの5Pが配布されました。次の定期徴収は免除されます。`
    if (log?.event === "instant_subsidy_paid") text = `${user}さんに1Pが即時支給されました。`
    if (log?.event === "subsidy_paid") text = `${Number(log?.subsidy_recipient_count || 1)}人にドローポイントが給付されました。`
    if (log?.event === "player_extension") text = `${user}さんが${cardTitle}を15分延長しました。`
    if (log?.event === "empty_field_floor_grant") text = `循環再開のため合計${Number(log?.granted_points_total || 0)}Pが配布されました。`
    if (log?.event === "collect") {
        text = Number(log?.records_count || 0) === 0
            ? `${cardTitle}が除外されました。`
            : `${cardTitle}が${topUser}さんに回収され、ドローポイントが還元されました。`
    }

    return `${logTimestamp(log?.created_at)} - ${text}`
}
