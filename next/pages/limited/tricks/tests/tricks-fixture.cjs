const {createHmac} = require("crypto")

function testIdentityHeaders(userId, eventId) {
    const secret = process.env.TRICKS_TEST_SECRET || process.env.TRICKS_INTERNAL_SECRET
    if (!secret) throw new Error("TRICKS_TEST_SECRETまたはTRICKS_INTERNAL_SECRETが必要です")
    const timestamp = String(Math.floor(Date.now() / 1000))
    const identity = String(userId)
    const targetEvent = String(eventId)
    const signature = createHmac("sha256", secret)
        .update(`${timestamp}\n${identity}\n${targetEvent}`)
        .digest("hex")

    return {
        "x-tricks-test-user": identity,
        "x-tricks-test-event": targetEvent,
        "x-tricks-test-timestamp": timestamp,
        "x-tricks-test-signature": signature,
    }
}

function sameOriginHeaders(baseURL) {
    return {
        origin: baseURL,
        referer: `${baseURL}/limited/tricks`,
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
    }
}

async function api(request, baseURL, eventId, userId, path, options = {}) {
    const headers = {
        ...sameOriginHeaders(baseURL),
        ...testIdentityHeaders(userId, eventId),
        ...(options.headers || {}),
    }
    const response = options.method === "GET"
        ? await request.get(path, {headers})
        : await request.post(path, {headers, data: options.data || {}})
    const body = await response.json().catch(() => ({}))
    if (!response.ok()) {
        throw new Error(`${options.method || "POST"} ${path}: ${response.status()} ${JSON.stringify(body)}`)
    }

    return body.data || body
}

async function createTricksFixture(request, baseURL, options = {}) {
    const eventId = options.eventId || 900000 + ((Date.now() + process.pid + Math.floor(Math.random() * 1000)) % 99999)
    const admin = `pw_admin_${eventId}`
    const players = options.players || [
        {name: `pw_a_${eventId}`, points: 20, hand_count: 3},
        {name: `pw_b_${eventId}`, points: 20, hand_count: 0},
    ]
    const result = await api(request, baseURL, eventId, admin, "/api/server/tricks/debug/fixtures", {
        data: {
            event_id: eventId,
            random_seed: options.randomSeed || eventId,
            debug_now: options.debugNow,
            start_at: options.startAt,
            end_at: options.endAt,
            players,
        },
    })

    return {
        eventId,
        admin,
        players: players.map((player) => typeof player === "string" ? player : player.name),
        result,
        headers: (userId) => ({...sameOriginHeaders(baseURL), ...testIdentityHeaders(userId, eventId)}),
        get: (userId, path) => api(request, baseURL, eventId, userId, path, {method: "GET"}),
        post: (userId, path, data = {}) => api(request, baseURL, eventId, userId, path, {data}),
        cleanup: () => api(
            request,
            baseURL,
            eventId,
            admin,
            `/api/server/tricks/debug/fixtures/${eventId}/teardown`,
        ),
    }
}

module.exports = {createTricksFixture, sameOriginHeaders, testIdentityHeaders}
