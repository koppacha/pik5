import {useTheme} from "next-themes"
import Link from "next/link"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {faHome, faCloudSun, faCloudMoon, faBookBookmark} from "@fortawesome/free-solid-svg-icons"
import {faDiscord} from "@fortawesome/free-brands-svg-icons"
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

const visibleLogEvents = new Set(["join", "take", "record_posted", "record_updated", "player_extension", "empty_field_floor_grant", "subsidy_paid", "collect"])

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
    if (log?.event === "player_extension") text = `${user}さんが${cardTitle}を15分延長しました。`
    if (log?.event === "empty_field_floor_grant") text = `循環再開のため合計${Number(log?.granted_points_total || 0)}Pが配布されました。`
    if (log?.event === "collect") {
        text = Number(log?.records_count || 0) === 0
            ? `${cardTitle}がトラッシュされました`
            : `${cardTitle}が${topUser}に回収され、ポイントが還元されました。`
    }

    return `${logTimestamp(log?.created_at)} - ${text}`
}

function LiveClock() {
    const [time, setTime] = useState("")
    useEffect(() => {
        const update = () => setTime(new Intl.DateTimeFormat("ja-JP", {
            year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "Asia/Tokyo",
        }).format(new Date()))
        update()
        const timer = setInterval(update, 1000)
        return () => clearInterval(timer)
    }, [])
    return <time className="tricks-live-clock" style={{fontVariantNumeric: "tabular-nums"}}>{time || "----/--/-- --:--:--"}</time>
}

export default function TricksHud({state, usersById = {}, dimmed = false, currentUserId = "", nowValue = Date.now(), onToggleDebug, debugOpen = false}) {
    const players = useMemo(() => state?.players || [], [state?.players])
    const logs = useMemo(() => state?.logs || [], [state?.logs])
    const [clockReady, setClockReady] = useState(false)
    const [logOpen, setLogOpen] = useState(false)
    const {resolvedTheme, setTheme} = useTheme()
    const panelBackground = "color-mix(in srgb, var(--color-bg-base) 90%, transparent)"
    const panelColor = "var(--color-text-base)"
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
    const hasSubsidyRecipient = players.some((player) => player?.subsidy_flag)
    const visibleLogs = useMemo(() => {
        return logs.filter((log) => typeof log === "string" || visibleLogEvents.has(log?.event))
    }, [logs])
    const infoCard = (
        <div
            className="tricks-tournament-info"
            data-tricks-tournament-info
            style={{
                minWidth: 272,
                padding: "7px 10px",
                borderRadius: 10,
                border: "1px solid rgba(148, 163, 184, 0.25)",
                background: panelBackground,
                color: panelColor,
            }}
        >
            <div style={{display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11}}>
                <span>大会情報</span>
                {(state?.tournament?.debug || state?.tournament?.test_mode) && <button type="button" onClick={onToggleDebug} disabled={!onToggleDebug} aria-expanded={debugOpen} style={{color: "#279c59", background: "transparent", border: 0, cursor: onToggleDebug ? "pointer" : "default"}}>DEBUG</button>}
            </div>
            <div style={{display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 12, rowGap: 2, marginTop: 3, fontSize: 11}}>
                <div style={{fontSize: 13, fontWeight: 500}}>場札上限 {operation.fieldCap}枚</div>
                <div data-tricks-tournament-remaining>残り {remaining}</div>
                <div data-tricks-collected-count style={{opacity: 0.78}}>回収カード総数 {state?.collected_count ?? 0}枚</div>
                <div data-tricks-deck-count>山札 {state?.deck_count ?? 0}枚</div>
                <div data-tricks-trash-count>捨て札 {state?.trash_count ?? 0}枚</div>
                {Number(state?.tournament?.pot_points || 0) > 0 && <div data-tricks-pot>Pot {state.tournament.pot_points}P</div>}
                {hasSubsidyRecipient && <div data-tricks-subsidy-remaining style={{color: panelColor}}>次回給付 {nextSubsidyRemaining}</div>}
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
            <nav className="tricks-top-bar" aria-label="イベントナビゲーション" style={{
                position: "fixed", top: 0, left: '40px', zIndex: 40, display: "flex", alignItems: "center", gap: 12, width: "max-content", maxWidth: "100vw", boxSizing: "border-box", overflowX: "auto", whiteSpace: "nowrap", padding: "3px 18px", borderRadius: "0 0 18px 18px", background: "#3c3c3c", color: "#fff", fontSize: 13, lineHeight: "22px"
            }}>
                <span style={{fontWeight:'bold'}}>第19回期間限定ランキング</span>
                <span style={{fontSize:'0.85em'}}>トリックテイキング制×スタンダード</span>
                <LiveClock />
                <Link href="/" aria-label="ホーム" style={{color: "inherit"}}><FontAwesomeIcon icon={faHome} /></Link>
                <a href="https://discord.gg/rQEBJQa" aria-label="Discord" style={{color: "inherit"}}><FontAwesomeIcon icon={faDiscord} /></a>
                <button type="button" aria-label="テーマ変更" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} style={{border: 0, background: "transparent", color: "inherit", cursor: "pointer"}}><FontAwesomeIcon icon={clockReady && resolvedTheme === "dark" ? faCloudSun : faCloudMoon} /></button>
                <a href="#knowledge" aria-label="ナレッジ" style={{color: "inherit"}}><FontAwesomeIcon icon={faBookBookmark} /></a>
            </nav>
            <div
                className="tricks-log-window"
                data-tricks-log-wrapper
                data-log-open={logOpen ? "true" : "false"}
                style={{
                    position: "fixed",
                    right: 0,
                    top: 180,
                    width: "min(444px, 100vw)",
                    height: 178,
                    display: "flex",
                    alignItems: "stretch",
                    zIndex: 40,
                    color: "#e6edf8",
                    pointerEvents: "auto",
                    opacity: dimmed ? 0.35 : 1,
                    transform: logOpen ? "translateX(0)" : "translateX(calc(100% - 44px))",
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
                    className="tricks-log-body"
                    id="tricks-log-region"
                    data-tricks-log-region
                    aria-hidden={!logOpen}
                    style={{
                        width: 400,
                        minWidth: 0,
                        visibility: logOpen ? "visible" : "hidden",
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
                className="tricks-player-header"
                style={{
                    position: "fixed",
                    left: 24,
                    right: 24,
                    top: 30,
                    zIndex: 40,
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
                                    className="tricks-player-info"
                                    key={player.name || index}
                                    data-tricks-player={player.name}
                                    style={{
                                        minWidth: 132,
                                        padding: "7px 10px",
                                        borderRadius: 10,
                                        border: isMe ? "1px solid rgba(255, 255, 255, 0.92)" : "1px solid rgba(148, 163, 184, 0.25)",
                                        background: panelBackground,
                                        color: panelColor,
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
                                        <div data-tricks-player-collected-count style={{fontSize: 11, marginTop: 2, opacity: isMe ? 0.94 : 0.78}}>
                                            回収カード {player.collected_card_count ?? 0}枚
                                        </div>
                                        <div
                                            data-tricks-take-level
                                            style={{fontSize: 11, marginTop: 2, opacity: isMe ? 0.94 : 0.78}}
                                        >
                                            Lv.{player.take_level ?? 0} / テイクコスト {player.take_cost ?? 2}
                                        </div>
                                        <div style={{fontSize: 11, marginTop: 2, opacity: isMe ? 0.94 : 0.78}}>
                                            <span
                                                data-tricks-subsidy-flag={player.subsidy_flag ? "active" : "inactive"}
                                                data-tricks-balance-tax={player.balance_tax_eligible ? "active" : "inactive"}
                                                style={{color: player.balance_tax_eligible ? "#279c59" : player.subsidy_flag ? "#d84b8c" : "inherit"}}
                                            >
                                                <span
                                                    data-tricks-points-label
                                                    style={{textDecoration: player.subsidy_flag ? "underline" : "none"}}
                                                >
                                                    P
                                                </span>
                                                {" "}{player.draw_points}
                                            </span>
                                            <span> / 手札 {player.card_count} / {player.hand_limit ?? (player.take_cost ?? 2) * 3}</span>
                                        </div>
                                        {player.next_take_at && new Date(player.next_take_at).getTime() > nowValue && (
                                            <div style={{fontSize: 10, marginTop: 2, color: "var(--color-text-base)"}}>
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
