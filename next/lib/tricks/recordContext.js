import {tricksIdentityHeaders} from "./proxyAuth"
import {hasStagingAccess, stagingAccessEnabled, STAGING_CLOSE_AT} from "./stagingAccess"

const LARAVEL_API_BASE = process.env.TRICKS_LARAVEL_API_BASE || "http://laravel:8000/api"

async function readContext(path, userId, role) {
    const response = await fetch(`${LARAVEL_API_BASE}/tricks/${path}`, {
        headers: tricksIdentityHeaders(userId, role),
    })
    if (response.status === 404) return null
    if (!response.ok) {
        const error = new Error("record context lookup failed")
        error.status = response.status
        throw error
    }
    return response.json()
}

export async function findRecordForMutation(uniqueId, userId, role = 0) {
    if (!/^\d+$/.test(String(uniqueId))) return null
    return readContext(`record-context/${encodeURIComponent(uniqueId)}`, userId, role)
}

export async function findTricksStageEvent(stageId, eventId, userId, role = 0) {
    const stage = Number(stageId)
    if (!Number.isSafeInteger(stage) || stage < 1) return null
    const query = eventId ? `?event_id=${encodeURIComponent(eventId)}` : ""
    const context = await readContext(`stage-context/${stage}${query}`, userId, role)
    return context?.event_id ?? null
}

export function ensureRecordStagingAccess(req, res, eventId) {
    if (eventId && Date.now() < STAGING_CLOSE_AT && stagingAccessEnabled(eventId) && !hasStagingAccess(req, Date.now(), eventId)) {
        res.status(403).json({error: true, message: "大会パスワードが必要です"})
        return false
    }
    return true
}
