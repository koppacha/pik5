export const tricksApi = {
    state: (userId) => `/api/server/tricks/state${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`,
    join: "/api/server/tricks/join",
    draw: "/api/server/tricks/draw",
    take: (deckId) => `/api/server/tricks/cards/${deckId}/take`,
    scores: (deckId) => `/api/server/tricks/cards/${deckId}/scores`,
    recordPosted: "/api/server/tricks/records/posted",
    collectExpired: "/api/server/tricks/maintenance/collect-expired",
}

export const tricksActions = {
    draw: "draw",
    take: "take",
    selectField: "selectField",
    cancel: "cancel",
}

export const tricksFetcher = async (url) => {
    const res = await fetch(url)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
        const message = body?.data?.message || body?.message || "API request failed"
        throw new Error(message)
    }

    return body?.data ?? body
}

export const postTricks = async (url, userId, payload = {}) => {
    const res = await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({userId, ...payload}),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
        const message = body?.data?.message || body?.message || "API request failed"
        throw new Error(message)
    }

    return body?.data ?? body
}

export const formatRemaining = (endAt, nowValue = Date.now()) => {
    if (!endAt) return "--:--:--"
    const diff = Math.max(0, new Date(endAt).getTime() - nowValue)
    const totalSeconds = Math.floor(diff / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return [hours, minutes, seconds]
        .map((v) => String(v).padStart(2, "0"))
        .join(":")
}

export const isTricksCardLimitExpired = (card, nowValue = Date.now()) => {
    return Boolean(card?.limit_at) && new Date(card.limit_at).getTime() <= nowValue
}

export const cardLimitLabel = (card, nowValue = Date.now()) => {
    if (!card?.limit_at) return "初回投稿待ち"
    return formatRemaining(card.limit_at, nowValue)
}

export const shortenTricksText = (value, max) => {
    const text = String(value || "")
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export const orderTricksHand = (hand = [], order = []) => {
    const ids = hand.map((card) => card.id)
    const nextOrder = [
        ...order.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !order.includes(id)),
    ]
    const ordered = [...hand].sort((a, b) => nextOrder.indexOf(a.id) - nextOrder.indexOf(b.id))

    return {hand: ordered, order: nextOrder}
}

export const orderTricksField = (field = [], nowValue = Date.now()) => {
    return [...field].sort((a, b) => {
        const aTime = a?.limit_at ? new Date(a.limit_at).getTime() : Number.MAX_SAFE_INTEGER
        const bTime = b?.limit_at ? new Date(b.limit_at).getTime() : Number.MAX_SAFE_INTEGER
        if (aTime !== bTime) return aTime - bTime
        return Number(a?.id || 0) - Number(b?.id || 0)
    }).map((card) => ({
        ...card,
        limit_expired: isTricksCardLimitExpired(card, nowValue),
        limit_label: cardLimitLabel(card, nowValue),
    }))
}

export const normalizeTricksState = (state, options = {}) => {
    const nowValue = options.nowValue || Date.now()
    const orderedHand = orderTricksHand(state?.hand || [], options.handOrder || [])

    return {
        tournament: state?.tournament || {},
        players: state?.players || [],
        field: orderTricksField(state?.field || [], nowValue),
        hand: orderedHand.hand,
        handOrder: orderedHand.order,
        deckCount: state?.deck_count ?? 0,
        logs: state?.logs || [],
        me: state?.me || null,
    }
}
