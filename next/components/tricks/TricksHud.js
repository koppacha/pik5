import {useEffect, useMemo, useRef, useState} from "react"
import {
    buildTricksShakerSortSteps,
    shortenTricksText,
    syncTricksOrder,
    targetTricksPlayerOrder,
} from "../../lib/tricks"

function logText(log) {
    if (typeof log === "string") return log
    return log?.message || log?.text || log?.event || JSON.stringify(log)
}

export default function TricksHud({state, dimmed = false, currentUserId = ""}) {
    const players = useMemo(() => state?.players || [], [state?.players])
    const logs = state?.logs || []
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
                style={{
                    position: "absolute",
                    right: 24,
                    bottom: 24,
                    width: 284,
                    maxHeight: 210,
                    zIndex: 2,
                    color: "#e6edf8",
                    pointerEvents: "auto",
                    opacity: dimmed ? 0.35 : 1,
                }}
            >
                <div style={{fontSize: 13, color: "#9aa8bd", marginBottom: 6}}>
                    ログ
                </div>
                <div
                    style={{
                        maxHeight: 178,
                        overflowY: "auto",
                        border: "1px solid rgba(154, 168, 189, 0.35)",
                        background: "rgba(13, 18, 28, 0.82)",
                        padding: "8px 10px",
                        fontSize: 12,
                        lineHeight: 1.45,
                    }}
                >
                    {logs.length === 0 && (
                        <div style={{color: "#718096"}}>ログはまだありません</div>
                    )}
                    {logs.slice(0, 100).map((log, index) => (
                        <div
                            key={log?.id || `${index}-${logText(log)}`}
                            style={{
                                padding: "3px 0",
                                borderBottom: index < logs.length - 1 ? "1px solid rgba(154, 168, 189, 0.12)" : "none",
                            }}
                        >
                            {shortenTricksText(logText(log), 72)}
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
                }}
            >
                <div
                    style={{
                        overflowX: "auto",
                        overflowY: "hidden",
                        padding: "8px 0 0",
                        whiteSpace: "nowrap",
                    }}
                >
                    {orderedPlayers.length === 0 && (
                        <div style={{padding: "6px 0", color: "#718096", fontSize: 12}}>参加者はまだいません</div>
                    )}
                    <div style={{display: "flex", gap: 8, minWidth: "max-content"}}>
                        {orderedPlayers.map((player, index) => {
                            const isMe = currentUserId && player.name === currentUserId

                            return (
                                <div
                                    key={player.name || index}
                                    style={{
                                        minWidth: 112,
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
                                        <span>RP {player.rank_points}</span>
                                    </div>
                                    <div style={{fontSize: 13, fontWeight: isMe ? 700 : 500, marginTop: 3}}>
                                        {shortenTricksText(player.name, 14)}
                                    </div>
                                    <div style={{fontSize: 11, marginTop: 2, opacity: isMe ? 0.94 : 0.78}}>
                                        DP {player.draw_points} / H {player.card_count}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </>
    )
}
