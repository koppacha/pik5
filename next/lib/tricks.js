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
// Tricks APIのJSONレスポンスを取得し、失敗時はメッセージ付きで例外化する。
export const tricksFetcher = async (url) => {
    const res = await fetch(url)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
        const message = body?.data?.message || body?.message || "API request failed"
        throw new Error(message)
    }

    return body?.data ?? body
}
// Tricks APIへJSONのPOSTを送り、失敗時はメッセージ付きで例外化する。
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
// プレイヤーをランクポイント降順、同点時は名前順で比較する。
export const compareTricksPlayers = (a, b) => {
    const rankDiff = Number(b?.rank_points || 0) - Number(a?.rank_points || 0)
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
