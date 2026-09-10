import {useEffect, useMemo, useRef, useState} from "react"
import {
    buildTricksShakerSortSteps,
    formatNextSubsidyRemaining,
    formatTournamentRemaining,
    shortenTricksText,
    syncTricksOrder,
    targetTricksPlayerOrder,
    tricksOperationState,
} from "../../lib/tricks"

const visibleLogEvents = new Set(["join", "take", "record_posted", "record_updated", "subsidy_paid", "collect"])

function displayName(usersById, userId, fallback = "-") {
    if (!userId) return fallback
    return usersById[userId]?.name || userId
}

function logTimestamp(value) {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return "--:--:--"

    return new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).format(date)
}

function logText(log, usersById) {
    if (typeof log === "string") return `--:--:-- - ${log}`
    const user = displayName(usersById, log?.actor_name)
    const topUser = displayName(usersById, log?.top_user_id, "ホルダーなし")
    const cardTitle = log?.card_title || `カード#${log?.card_id || "-"}`
    const rarity = Math.max(1, Number(log?.rarity || 1))
    let text = log?.message || log?.text || log?.event || "イベントが発生しました。"

    if (log?.event === "join") text = `${user}さんが参加しました。`
    if (log?.event === "take") text = `${user}さんが★${rarity} ${cardTitle}をテイクしました。`
    if (log?.event === "record_posted" || log?.event === "record_updated") {
        text = `${user}さんが${cardTitle}に投稿しました。（${log?.score ?? "-"}点 / ${log?.rank ?? "-"}位）`
    }
    if (log?.event === "subsidy_paid") text = `${Number(log?.subsidy_recipient_count || 1)}人にポイントが給付されました。`
    if (log?.event === "collect") {
        text = Number(log?.records_count || 0) === 0
            ? `${cardTitle}がトラッシュされました`
            : `${cardTitle}が${topUser}に回収され、ポイントが還元されました。`
    }

    return `${logTimestamp(log?.created_at)} - ${text}`
}

export default function TricksHud({state, usersById = {}, dimmed = false, currentUserId = "", nowValue = Date.now()}) {
    const players = useMemo(() => state?.players || [], [state?.players])
    const logs = useMemo(() => state?.logs || [], [state?.logs])
    const [clockReady, setClockReady] = useState(false)
    const [logOpen, setLogOpen] = useState(true)
    const [playerOrder, setPlayerOrder] = useState([])
    const sortTimerRef = useRef(null)
    const playersByName = useMemo(() => {
        return players.reduce((acc, player) => {
            if (player?.name) acc[player.name] = player
            return acc
        }, {})
    }, [players])
    const orderedPlayers = playerOrder
        .map((name) => playersByName[name])
        .filter(Boolean)
    const operation = useMemo(() => tricksOperationState(state, {nowValue}), [nowValue, state])
    const remaining = formatTournamentRemaining(state?.tournament?.end_at, nowValue)
    const nextSubsidyRemaining = clockReady ? formatNextSubsidyRemaining(nowValue) : "--:--"
    const visibleLogs = useMemo(() => {
        return logs.filter((log) => typeof log === "string" || visibleLogEvents.has(log?.event))
    }, [logs])
    const infoCard = (
        <div
            data-tricks-tournament-info
            style={{
                minWidth: 156,
                padding: "7px 10px",
                borderRadius: 10,
                border: "1px solid rgba(148, 163, 184, 0.25)",
                background: "rgba(148, 163, 184, 0.09)",
                color: "#9aa8bd",
            }}
        >
            <div style={{display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11}}>
                <span>大会情報</span>
                {(state?.tournament?.debug || state?.tournament?.test_mode) && <span style={{color: "#88f0b0"}}>DEBUG</span>}
            </div>
            <div style={{fontSize: 13, fontWeight: 500, marginTop: 3}}>
                場札上限 {operation.fieldCap}枚
            </div>
            <div style={{fontSize: 11, marginTop: 2, opacity: 0.78}}>
                テイク必要 {operation.requiredHand}枚
            </div>
            <div data-tricks-tournament-remaining style={{fontSize: 11, marginTop: 2, color: "#ffcf6e"}}>
                残り {remaining}
            </div>
            <div data-tricks-subsidy-remaining style={{fontSize: 11, marginTop: 2, color: "#e6edf8"}}>
                次回給付 {nextSubsidyRemaining}
            </div>
        </div>
    )

    useEffect(() => {
        setClockReady(true)
    }, [])

    useEffect(() => {
        setPlayerOrder((currentOrder) => {
            const syncedOrder = syncTricksOrder(currentOrder, players, "name")
            const targetOrder = targetTricksPlayerOrder(players, syncedOrder)
            if (syncedOrder.length === 0) return targetOrder
            if (targetOrder.every((name, index) => name === syncedOrder[index])) return syncedOrder

            const steps = buildTricksShakerSortSteps(syncedOrder, targetOrder)
            if (sortTimerRef.current) {
                clearInterval(sortTimerRef.current)
                sortTimerRef.current = null
            }
            if (steps.length === 0) return targetOrder

            let nextOrder = [...syncedOrder]
            sortTimerRef.current = setInterval(() => {
                const step = steps.shift()
                if (!step) {
                    clearInterval(sortTimerRef.current)
                    sortTimerRef.current = null
                    setPlayerOrder(targetOrder)
                    return
                }
                const [leftIndex, rightIndex] = step
                nextOrder = [...nextOrder]
                const tmp = nextOrder[leftIndex]
                nextOrder[leftIndex] = nextOrder[rightIndex]
                nextOrder[rightIndex] = tmp
                setPlayerOrder(nextOrder)
            }, 180)

            return syncedOrder
        })

        return undefined
    }, [players])

    useEffect(() => {
        return () => {
            if (sortTimerRef.current) clearInterval(sortTimerRef.current)
        }
    }, [])

    return (
        <>
            <div
                data-tricks-log-wrapper
                data-log-open={logOpen ? "true" : "false"}
                style={{
                    position: "fixed",
                    right: 24,
                    bottom: 235,
                    width: 444,
                    height: 178,
                    display: "flex",
                    alignItems: "stretch",
                    zIndex: 20,
                    color: "#e6edf8",
                    pointerEvents: "auto",
                    opacity: dimmed ? 0.35 : 1,
                    transform: logOpen ? "translateX(0)" : "translateX(400px)",
                    transition: "transform 240ms ease, opacity 160ms ease",
                }}
            >
                <button
                    type="button"
                    data-tricks-log-toggle
                    aria-expanded={logOpen}
                    aria-controls="tricks-log-region"
                    onClick={() => setLogOpen((open) => !open)}
                    style={{
                        width: 44,
                        flex: "0 0 44px",
                        border: "1px solid rgba(154, 168, 189, 0.45)",
                        borderRight: 0,
                        borderRadius: "8px 0 0 8px",
                        background: "rgba(21, 29, 43, 0.96)",
                        color: "#c7d2e6",
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "0.16em",
                        writingMode: "vertical-rl",
                        cursor: "pointer",
                    }}
                >
                    ログ
                </button>
                <div
                    id="tricks-log-region"
                    data-tricks-log-region
                    aria-hidden={!logOpen}
                    style={{
                        width: 400,
                        height: 178,
                        boxSizing: "border-box",
                        overflowY: "auto",
                        border: "1px solid rgba(154, 168, 189, 0.35)",
                        background: "rgba(13, 18, 28, 0.82)",
                        padding: "8px 10px",
                        fontSize: 12,
                        lineHeight: 1.45,
                    }}
                >
                    {visibleLogs.length === 0 && (
                        <div style={{color: "#718096"}}>ログはまだありません</div>
                    )}
                    {visibleLogs.slice(0, 100).map((log, index) => (
                        <div
                            key={log?.id || `${index}-${logText(log, usersById)}`}
                            data-tricks-log-entry={log?.id || index}
                            data-tricks-log-event={log?.event || "text"}
                            style={{
                                padding: "3px 0",
                                borderBottom: index < visibleLogs.length - 1 ? "1px solid rgba(154, 168, 189, 0.12)" : "none",
                                whiteSpace: "normal",
                                overflowWrap: "anywhere",
                            }}
                        >
                            {logText(log, usersById)}
                        </div>
                    ))}
                </div>
            </div>
            <div
                style={{
                    position: "absolute",
                    left: 320,
                    right: 24,
                    top: 0,
                    zIndex: 2,
                    color: "#e6edf8",
                    pointerEvents: "auto",
                    opacity: dimmed ? 0.35 : 1,
                    overflow: "hidden",
                }}
            >
                <div
                    data-tricks-header-scroll
                    style={{
                        width: "100%",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        overflowX: "auto",
                        overflowY: "hidden",
                        overscrollBehaviorX: "contain",
                        WebkitOverflowScrolling: "touch",
                        padding: "8px 0 0",
                        whiteSpace: "nowrap",
                    }}
                >
                    {orderedPlayers.length === 0 && (
                        <div style={{padding: "6px 0", color: "#718096", fontSize: 12}}>参加者はまだいません</div>
                    )}
                    <div style={{display: "flex", gap: 8, minWidth: "max-content"}}>
                        {infoCard}
                        {orderedPlayers.map((player, index) => {
                            const isMe = currentUserId && player.name === currentUserId
                            const screenName = usersById[player.name]?.name || player.name

                            return (
                                <div
                                    key={player.name || index}
                                    data-tricks-player={player.name}
                                    style={{
                                        minWidth: 132,
                                        padding: "7px 10px",
                                        borderRadius: 10,
                                        border: isMe ? "1px solid rgba(255, 255, 255, 0.92)" : "1px solid rgba(148, 163, 184, 0.25)",
                                        background: isMe ? "rgba(255, 255, 255, 0.16)" : "rgba(148, 163, 184, 0.09)",
                                        color: isMe ? "#ffffff" : "#9aa8bd",
                                        boxShadow: isMe ? "0 0 12px rgba(255, 255, 255, 0.18)" : "none",
                                        transition: "background 160ms ease, color 160ms ease, border-color 160ms ease",
                                    }}
                                >
                                        <div style={{display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11}}>
                                            <span>#{index + 1}</span>
                                            <span>R {player.total_rank_points ?? player.rank_points ?? 0}</span>
                                        </div>
                                        <div style={{fontSize: 13, fontWeight: isMe ? 700 : 500, marginTop: 3}}>
                                            {shortenTricksText(screenName, 14)}
                                        </div>
                                        <div style={{fontSize: 11, marginTop: 2, opacity: isMe ? 0.94 : 0.78}}>
                                            確定 {player.confirmed_rank_points ?? player.rank_points ?? 0}
                                            {" / "}
                                            暫定 {player.provisional_rank_points ?? 0}
                                        </div>
                                        <div style={{fontSize: 11, marginTop: 2, opacity: isMe ? 0.94 : 0.78}}>
                                            <span
                                                data-tricks-subsidy-flag={player.subsidy_flag ? "active" : "inactive"}
                                                style={{color: player.subsidy_flag ? "#d84b8c" : "inherit"}}
                                            >
                                                <span
                                                    data-tricks-points-label
                                                    style={{textDecoration: player.subsidy_flag ? "underline" : "none"}}
                                                >
                                                    P
                                                </span>
                                                {" "}{player.draw_points}
                                            </span>
                                            <span> / 手札 {player.card_count}</span>
                                        </div>
                                        {player.next_take_at && new Date(player.next_take_at).getTime() > nowValue && (
                                            <div style={{fontSize: 10, marginTop: 2, color: "#ffcf6e"}}>
                                                次回テイク {new Date(player.next_take_at).toLocaleTimeString("ja-JP")}
                                            </div>
                                        )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </>
    )
}
