import {createHmac} from "crypto"

const MAX_TEST_SIGNATURE_AGE_SECONDS = 300

function signedIdentityHeaders(userId, role, kind = "session", testEventId = "") {
    const secret = process.env.TRICKS_INTERNAL_SECRET
    if (!secret || !userId) return {}

    const timestamp = String(Math.floor(Date.now() / 1000))
    const identity = String(userId)
    const identityRole = String(Math.max(0, Number(role) || 0))
    const identityKind = kind === "test" ? "test" : "session"
    const signature = createHmac("sha256", secret)
        .update(`${timestamp}\n${identity}\n${identityRole}\n${identityKind}\n${testEventId}`)
        .digest("hex")

    return {
        "x-tricks-user": identity,
        "x-tricks-role": identityRole,
        "x-tricks-identity-kind": identityKind,
        ...(testEventId ? {"x-tricks-test-event": String(testEventId)} : {}),
        "x-tricks-timestamp": timestamp,
        "x-tricks-signature": signature,
    }
}

export function tricksIdentityHeaders(userId, role = 0) {
    return signedIdentityHeaders(userId, role)
}

export function tricksTestIdentityHeaders(headers = {}) {
    const secret = process.env.TRICKS_TEST_SECRET || process.env.TRICKS_INTERNAL_SECRET
    const userId = String(headers["x-tricks-test-user"] || "")
    const eventId = String(headers["x-tricks-test-event"] || "")
    const timestamp = String(headers["x-tricks-test-timestamp"] || "")
    const signature = String(headers["x-tricks-test-signature"] || "")
    if (!secret || !userId || !/^\d+$/.test(eventId) || !/^\d+$/.test(timestamp) || !signature) return {}
    if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > MAX_TEST_SIGNATURE_AGE_SECONDS) return {}

    const expected = createHmac("sha256", secret)
        .update(`${timestamp}\n${userId}\n${eventId}`)
        .digest("hex")
    if (expected.length !== signature.length || !cryptoSafeEqual(expected, signature)) return {}

    return signedIdentityHeaders(userId, 10, "test", eventId)
}

function cryptoSafeEqual(left, right) {
    let difference = 0
    for (let index = 0; index < left.length; index += 1) {
        difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
    }
    return difference === 0
}
