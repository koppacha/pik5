import {timeStageList} from "./const"

export const RECORD_POLL_INTERVAL_MS = 10000
export const RECORD_NOTIFY_COOLDOWN_MS = 60 * 1000
export const RECORD_USER_COOLDOWN_MS = 120 * 60 * 1000
export const RECORD_TOAST_DURATION_MS = 12000
export const RECORD_BROWSER_NOTIFICATION_ENABLED_KEY = "pik5_record_browser_notification_enabled"

export function isLocalNotificationDebugMode() {
    if (typeof window === "undefined") return false

    const host = window.location.hostname
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0"
}

export function getRecordUserName(record, usersById = {}) {
    return record?.user_name || usersById?.[record?.user_id]?.name || "名無し"
}

export function getRecordStageName(record, t) {
    return t?.stage?.[record?.stage_id] || `#${record?.stage_id ?? "?"}`
}

export function getRecordRuleName(record, t) {
    return t?.rule?.[record?.rule] || `ルール${record?.rule ?? "?"}`
}

export function getRecordConsoleName(record, t) {
    return t?.cnsl?.[record?.console] || `操作方法${record?.console ?? "?"}`
}

export function sec2timeValue(sec) {
    const total = Number(sec)
    if (!Number.isFinite(total)) return ""

    const hh = ~~(total / 3600)
    const mm = (`00${~~(~~(total / 60) % 60)}`).slice(-2)
    const ss = (`00${~~(total % 60)}`).slice(-2)
    return `${hh ? `${hh}:` : ""}${mm}:${ss}`
}

function score2time(score, stage) {
    const stageTimes = timeStageList.find((lists) => lists.stage === Number(stage))
    if (!stageTimes) return Number(score)
    return stageTimes.time - (Number(score) - stageTimes.score)
}

export function formatRecordScore({rule, score, stage, category, unit = "pts"} = {}) {
    if (!score) return ""

    if (category === "battle") {
        return `Rate ${Number(score).toLocaleString()}`
    }

    if ([11, 29, 35, 43, 46, 47, 91].includes(Number(rule)) || category === "speedrun") {
        const convertScore = Number(rule) === 11 ? score2time(score, stage) : Number(score)
        return sec2timeValue(convertScore)
    }

    const time = timeStageList.find(({stage: targetStage}) => targetStage === Number(stage))
    if (time && Number(rule) !== 10 && Number(rule) !== 25) {
        return sec2timeValue(time.time - Number(score))
    }

    return `${Number(score).toLocaleString()} ${unit}.`
}

export function buildNotificationPayload(records, t, usersById = {}) {
    if (!Array.isArray(records) || records.length === 0) return null

    const sortedRecords = [...records].sort((a, b) => Number(a.post_id) - Number(b.post_id))
    const latest = sortedRecords[sortedRecords.length - 1]
    const extraCount = sortedRecords.length - 1

    const userName = getRecordUserName(latest, usersById)
    const stageName = getRecordStageName(latest, t)
    const ruleName = getRecordRuleName(latest, t)
    const consoleName = getRecordConsoleName(latest, t)
    const rank = latest?.post_rank ?? "?"
    const rps = latest?.rps ?? "?"
    const scoreText = formatRecordScore({
        rule: latest?.rule,
        score: latest?.score,
        stage: latest?.stage_id,
        category: latest?.category,
    })

    const summary = extraCount > 0 ? `ほか${extraCount}件の新着記録があります。` : "新着記録が投稿されました。"
    const title = extraCount > 0 ? "新着記録をまとめて通知" : "新着記録"
    const lines = [
        summary,
        `${userName} さん`,
        `${stageName}（${ruleName}）`,
        `${scoreText}（${rank}位/${Number(rps).toLocaleString()})`,
    ]

    return {
        title,
        body: lines.join("\n"),
        lines,
        records: sortedRecords,
    }
}

export function readNotificationStorage(key, fallback) {
    if (typeof window === "undefined") return fallback

    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return fallback
        return JSON.parse(raw)
    } catch {
        return fallback
    }
}

export function writeNotificationStorage(key, value) {
    if (typeof window === "undefined") return

    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
        return
    }
}

export function isBrowserNotificationEnabled() {
    if (typeof window === "undefined") return false
    if (!("Notification" in window)) return false

    const storedEnabled = readNotificationStorage(RECORD_BROWSER_NOTIFICATION_ENABLED_KEY, null)
    if (storedEnabled === false) return false

    return window.Notification.permission === "granted"
}
