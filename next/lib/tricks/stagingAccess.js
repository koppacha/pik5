import {createHmac, timingSafeEqual} from "crypto"

export const STAGING_EVENT_ID = 261001
export const STAGING_CLOSE_AT = Date.parse("2026-10-06T22:00:00+09:00")
const COOKIE_NAME = "tricks_261001_access"

export function stagingAccessEnabled(eventId = Number(process.env.TRICKS_EVENT_ID)) {
    return Number(process.env.TRICKS_EVENT_ID) === STAGING_EVENT_ID && Number(eventId) === STAGING_EVENT_ID
}

export function stagingAccessReady() {
    return Boolean(process.env.TRICKS_TEST_EVENT_PASSWORD && process.env.NEXTAUTH_SECRET)
}

function expectedToken() {
    if (!stagingAccessReady()) return null
    return createHmac("sha256", process.env.NEXTAUTH_SECRET)
        .update(`${STAGING_EVENT_ID}:${STAGING_CLOSE_AT}:${process.env.TRICKS_TEST_EVENT_PASSWORD}`)
        .digest("hex")
}

export function validStagingPassword(value) {
    const actual = process.env.TRICKS_TEST_EVENT_PASSWORD
    if (!stagingAccessReady() || typeof value !== "string" || value.length > 256) return false
    const supplied = Buffer.from(value)
    const expected = Buffer.from(actual)
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function hasStagingAccess(req, now = Date.now(), eventId) {
    if (!stagingAccessEnabled(eventId)) return true
    if (now >= STAGING_CLOSE_AT) return false
    const token = expectedToken()
    const supplied = req.cookies?.[COOKIE_NAME]
    if (!token || typeof supplied !== "string" || supplied.length !== token.length) return false
    return timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
}

export function stagingAccessCookie() {
    const token = expectedToken()
    if (!token) return null
    const maxAge = Math.max(0, Math.floor((STAGING_CLOSE_AT - Date.now()) / 1000))
    return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
}
