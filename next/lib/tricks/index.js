export const tricksRarityColors = {
    1: "var(--tricks-edge-common, #303030)",
    2: "var(--tricks-edge-uncommon, #111111)",
    3: "#1976d2",
    4: "#42bd59",
    5: "#ffd447",
}

export const tricksStackBonus = (rarity, stackCount) => {
    const groups = Math.floor(Math.max(0, Number(stackCount) || 0) / 3)
    switch (Number(rarity)) {
        case 2: return groups + 1
        case 3: return groups + 4
        case 4: return groups * 2 + 7
        case 5: return groups * 3 + 15
        default: return 0
    }
}

export const tricksApi = {
    state: "/api/server/tricks/state",
    collected: (eventId) => `/api/server/tricks/collected${eventId ? `?event_id=${eventId}` : ""}`,
    holders: (userId) => `/api/server/tricks/holders${userId ? `?user_id=${encodeURIComponent(userId)}` : ""}`,
    collectedAdminStats: (eventId) => `/api/server/tricks/collected/admin-stats${eventId ? `?event_id=${eventId}` : ""}`,
    join: "/api/server/tricks/join",
    draw: "/api/server/tricks/draw",
    take: (deckId) => `/api/server/tricks/cards/${deckId}/take`,
    returnToDeck: (deckId) => `/api/server/tricks/cards/${deckId}/return-to-deck`,
    extend: (deckId) => `/api/server/tricks/cards/${deckId}/extend`,
    scores: (deckId) => `/api/server/tricks/cards/${deckId}/scores`,
    debugCollect: (deckId) => `/api/server/tricks/cards/${deckId}/debug-collect`,
    collectExpired: "/api/server/tricks/maintenance/collect-expired",
    subsidy: "/api/server/tricks/maintenance/subsidy",
    debugTimeFreeze: "/api/server/tricks/debug/time/freeze",
    debugTimeSet: "/api/server/tricks/debug/time/set",
    debugTimeAdvance: "/api/server/tricks/debug/time/advance",
    debugTimeReset: "/api/server/tricks/debug/time/reset",
}

export const tricksActions = {
    draw: "draw",
    take: "take",
    returnToDeck: "returnToDeck",
    selectField: "selectField",
    cancel: "cancel",
}
// Tricks APIのJSONレスポンスを取得し、失敗時はメッセージ付きで例外化する。
export const tricksFetcher = async (url) => {
    const res = await fetch(url)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
        const message = body?.data?.message || body?.message || "API request failed"
        const error = new Error(message)
        error.status = res.status
        throw error
    }

    return body?.data ?? body
}
// Tricks APIへJSONのPOSTを送り、失敗時はメッセージ付きで例外化する。
export const postTricks = async (url, payload = {}) => {
    const res = await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
        const message = body?.data?.message || body?.message || "API request failed"
        const error = new Error(message)
        error.status = res.status
        throw error
    }

    return body?.data ?? body
}
// 指定時刻までの残り時間をHH:mm:ss形式で返す。
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
// 大会終了までの残り時間を、1時間を境に時分または分秒で返す。
export const formatTournamentRemaining = (endAt, nowValue = Date.now()) => {
    if (!endAt) return "--時間--分"
    const diff = Math.max(0, new Date(endAt).getTime() - nowValue)

    if (diff >= 60 * 60 * 1000) {
        const totalMinutes = Math.floor(diff / 60000)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60

        return `${String(hours).padStart(2, "0")}時間${String(minutes).padStart(2, "0")}分`
    }

    const totalSeconds = Math.floor(diff / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${String(minutes).padStart(2, "0")}分${String(seconds).padStart(2, "0")}秒`
}
export const tricksTournamentCountdownAlert = (endAt, nowValue = Date.now()) => {
    if (!endAt) return null
    const remainingMs = new Date(endAt).getTime() - nowValue
    if (!Number.isFinite(remainingMs) || remainingMs > 3 * 60 * 60 * 1000) return null
    if (remainingMs <= 60 * 60 * 1000) {
        return {phase: "take-closed", text: "まもなく大会終了します。テイクはできません"}
    }
    if (remainingMs <= 70 * 60 * 1000) {
        return {phase: "take-closing", text: "まもなくテイクできなくなります！"}
    }
    return {phase: "legendary", text: "レジェンダリー排出率10倍！"}
}
// JSTの毎時00分・30分に訪れる次回ポイント給付までをmm:ssで返す。
export const formatNextSubsidyRemaining = (nowValue = Date.now()) => {
    const slotMs = 30 * 60 * 1000
    const nextSlot = Math.floor(nowValue / slotMs) * slotMs + slotMs
    const totalSeconds = Math.max(0, Math.floor((nextSlot - nowValue) / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}
// 場札のリミット時刻が現在時刻を過ぎているかを判定する。
export const isTricksCardLimitExpired = (card, nowValue = Date.now()) => {
    return Boolean(card?.limit_at) && new Date(card.limit_at).getTime() <= nowValue
}
// 場札のリミット表示ラベルを返す。
export const cardLimitLabel = (card, nowValue = Date.now()) => {
    if (!card?.limit_at) return "初回投稿待ち"
    return formatRemaining(card.limit_at, nowValue)
}
// 日時文字列を比較可能なミリ秒へ変換する。
const parseTricksTime = (value) => {
    if (!value) return null
    const time = new Date(value).getTime()

    return Number.isFinite(time) ? time : null
}
// 場札をリミット残り分数とテイク時刻のルールで比較する。
export const compareTricksFieldCards = (a, b, nowValue = Date.now()) => {
    const aLimit = parseTricksTime(a?.limit_at)
    const bLimit = parseTricksTime(b?.limit_at)
    const aHasLimit = aLimit !== null
    const bHasLimit = bLimit !== null

    if (aHasLimit && !bHasLimit) return -1
    if (!aHasLimit && bHasLimit) return 1

    if (aHasLimit && bHasLimit) {
        const aMinutes = Math.floor(Math.max(0, aLimit - nowValue) / 60000)
        const bMinutes = Math.floor(Math.max(0, bLimit - nowValue) / 60000)
        if (aMinutes !== bMinutes) return aMinutes - bMinutes
    }

    if (!aHasLimit && !bHasLimit) {
        const aTaken = parseTricksTime(a?.taken_at) || 0
        const bTaken = parseTricksTime(b?.taken_at) || 0
        if (aTaken !== bTaken) return bTaken - aTaken
    }

    return 0
}
// プレイヤーを確定・暫定の合計ランクポイント降順、同点時は名前順で比較する。
export const compareTricksPlayers = (a, b) => {
    const aTotal = Number(a?.total_rank_points ?? a?.rank_points ?? 0)
    const bTotal = Number(b?.total_rank_points ?? b?.rank_points ?? 0)
    const rankDiff = bTotal - aTotal
    if (rankDiff !== 0) return rankDiff

    return String(a?.name || "").localeCompare(String(b?.name || ""))
}
// 現在のID順を最新プレイヤー一覧と同期する。
export const syncTricksOrder = (currentOrder = [], items = [], key = "id") => {
    const ids = items.map((item) => item?.[key]).filter((id) => id !== undefined && id !== null)

    return [
        ...currentOrder.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !currentOrder.includes(id)),
    ]
}
// 目標順への隣接交換手順をシェーカーソートで生成する。
export const buildTricksShakerSortSteps = (currentOrder = [], nextOrder = []) => {
    const rank = new Map(nextOrder.map((id, index) => [id, index]))
    const order = [...currentOrder]
    const steps = []
    let left = 0
    let right = order.length - 1
    let swapped = true

    while (swapped && steps.length < 240) {
        swapped = false
        for (let i = left; i < right; i += 1) {
            if ((rank.get(order[i]) ?? i) > (rank.get(order[i + 1]) ?? i + 1)) {
                const tmp = order[i]
                order[i] = order[i + 1]
                order[i + 1] = tmp
                steps.push([i, i + 1])
                swapped = true
            }
        }
        right -= 1
        for (let i = right; i > left; i -= 1) {
            if ((rank.get(order[i - 1]) ?? i - 1) > (rank.get(order[i]) ?? i)) {
                const tmp = order[i - 1]
                order[i - 1] = order[i]
                order[i] = tmp
                steps.push([i - 1, i])
                swapped = true
            }
        }
        left += 1
    }

    return steps
}
// プレイヤー一覧の目標表示順を算出する。
export const targetTricksPlayerOrder = (players = [], currentOrder = []) => {
    const playersByName = new Map(players.map((player) => [player.name, player]))
    const stableIndex = new Map(currentOrder.map((id, index) => [id, index]))

    return [...currentOrder].sort((aName, bName) => {
        const result = compareTricksPlayers(playersByName.get(aName), playersByName.get(bName))
        if (result !== 0) return result

        return (stableIndex.get(aName) ?? 0) - (stableIndex.get(bName) ?? 0)
    })
}
// 表示テキストを指定文字数へ短縮する。
export const shortenTricksText = (value, max) => {
    const text = String(value || "")
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
// 手札を保存済み順序に合わせて並べ替える。
export const orderTricksHand = (hand = [], order = []) => {
    const ids = hand.map((card) => card.id)
    const nextOrder = [
        ...order.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !order.includes(id)),
    ]
    const ordered = [...hand].sort((a, b) => nextOrder.indexOf(a.id) - nextOrder.indexOf(b.id))

    return {hand: ordered, order: nextOrder}
}
// 場札に期限切れ状態と表示ラベルを付与する。
export const orderTricksField = (field = [], nowValue = Date.now()) => {
    return [...field].map((card) => ({
        ...card,
        limit_expired: isTricksCardLimitExpired(card, nowValue),
        limit_label: cardLimitLabel(card, nowValue),
    }))
}
// APIレスポンスをPhaserとHUDが扱いやすい形へ正規化する。
export const normalizeTricksState = (state, options = {}) => {
    const nowValue = options.nowValue || Date.now()
    const orderedHand = orderTricksHand(state?.hand || [], options.handOrder || [])
    const activeField = (state?.field || []).filter((card) => !isTricksCardLimitExpired(card, nowValue))

    return {
        tournament: state?.tournament || {},
        players: state?.players || [],
        field: orderTricksField(activeField, nowValue),
        hand: orderedHand.hand,
        handOrder: orderedHand.order,
        deckCount: state?.deck_count ?? 0,
        deckDifficultyCounts: state?.deck_difficulty_counts ?? {},
        trashCount: state?.trash_count ?? 0,
        logs: state?.logs || [],
        me: state?.me || null,
    }
}

// 現在状態からドロー・テイクの可否とユーザー向け理由を算出する。
export const tricksOperationState = (state, options = {}) => {
    const nowValue = Number(options.nowValue || Date.now())
    const tournament = state?.tournament || {}
    const me = state?.me
    const fieldCount = (state?.field || []).filter((card) => !isTricksCardLimitExpired(card, nowValue)).length
    const handCount = state?.hand?.length || 0
    const playerCount = state?.players?.length || 0
    const requiredHand = Number(me?.take_cost ?? 2)
    const handLimit = Number(me?.hand_limit ?? requiredHand * 3)
    const fieldCap = Math.min(Math.max(1, playerCount - 1), 16)
    const endAt = tournament.end_at ? new Date(tournament.end_at).getTime() : 0
    const nextTakeAt = me?.next_take_at ? new Date(me.next_take_at).getTime() : 0
    const available = Boolean(tournament.available) && tournament.state !== "ended"

    let drawReason = ""
    if (me && !available) drawReason = "大会開催時間外です"
    else if (me && Number(me.draw_points) <= 0) drawReason = "ポイントが0P以下です"
    else if (me && handCount >= handLimit) drawReason = `手札上限 ${handLimit}枚に達しています`
    else if (Number(state?.deck_count || 0) <= 0) {
        drawReason = Number(state?.trash_count || 0) > 0
            ? "山札を補充しています"
            : "山札と捨て札が空です"
    }

    let takeReason = ""
    if (me && !available) takeReason = "大会開催時間外です"
    else if (endAt && nowValue >= endAt - 60 * 60 * 1000) takeReason = "大会終了1時間前以降はテイクできません"
    else if (nextTakeAt && nowValue < nextTakeAt) takeReason = `次回テイク可能 ${new Date(nextTakeAt).toLocaleTimeString("ja-JP")}`
    else if (fieldCount >= fieldCap) takeReason = `場札上限 ${fieldCap}枚に達しています`
    else if (handCount < requiredHand) takeReason = `手札が${requiredHand}枚必要です（現在${handCount}枚）`

    let returnReason = ""
    if (me && !available) returnReason = "大会開催時間外です"
    else if (me && Number(me.draw_points) <= 0) returnReason = "ポイントが0P以下です"

    return {
        available,
        canDraw: Boolean(me) && drawReason === "",
        drawReason,
        canTake: Boolean(me) && takeReason === "",
        takeReason,
        canReturnToDeck: Boolean(me) && returnReason === "",
        returnReason,
        requiredHand,
        handLimit,
        fieldCap,
        fieldCount,
        handCount,
        nextTakeAt: me?.next_take_at || null,
    }
}
