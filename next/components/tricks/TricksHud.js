import {useTheme} from "next-themes"
import Link from "next/link"
import Tooltip from "@mui/material/Tooltip"
import TricksCardBorder, {TricksCardBorderStyles} from "./TricksCardBorder"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {faHome, faCloudSun, faCloudMoon, faBookBookmark} from "@fortawesome/free-solid-svg-icons"
import {faDiscord} from "@fortawesome/free-brands-svg-icons"
import {useEffect, useMemo, useRef, useState} from "react"
import {
    buildTricksShakerSortSteps,
    formatNextSubsidyRemaining,
    formatTournamentRemaining,
    tricksTournamentCountdownAlert,
    shortenTricksText,
    syncTricksOrder,
    targetTricksPlayerOrder,
    tricksOperationState,
    tricksRarityColors,
} from "../../lib/tricks"

function playersByTooltipName(players, name) {
    return name && players?.find((player) => player.name === name)
}

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
    const title = log?.card_title || `カード#${log?.card_id || "-"}`
    const cardTitle = log?.rule_name ? `${title}（${log.rule_name}）` : title
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
            ? `${cardTitle}が除外されました。`
            : `${cardTitle}が${topUser}さんに回収され、ポイントが還元されました。`
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

export default function TricksHud({state, stagingMode = false, historicalHolderCounts = {}, usersById = {}, dimmed = false, currentUserId = "", nowValue = Date.now(), onToggleDebug, debugOpen = false, onSelectHolder}) {
    const players = useMemo(() => state?.players || [], [state?.players])
    const logs = useMemo(() => state?.logs || [], [state?.logs])
    const holderCardsByPlayer = useMemo(() => (state?.holder_cards || []).reduce((grouped, card) => {
        if (!grouped[card.player_name]) grouped[card.player_name] = []
        grouped[card.player_name].push(card)
        return grouped
    }, {}), [state?.holder_cards])
    const [clockReady, setClockReady] = useState(false)
    const [logOpen, setLogOpen] = useState(false)
    const {resolvedTheme, setTheme} = useTheme()
    const panelBackground = "color-mix(in srgb, var(--color-bg-base) 97%, transparent)"
    const playerBackground = "color-mix(in srgb, var(--color-bg-base) 97%, transparent)"
    const panelColor = "var(--color-text-base)"
    const [playerTooltip, setPlayerTooltip] = useState(null)
    const playerTooltipRef = useRef(null)
    const tooltipPlayer = playersByTooltipName(state?.players, playerTooltip?.name)
    useEffect(() => {
        if (!playerTooltip) return
        const closeOutside = (event) => {
            if (playerTooltipRef.current?.contains(event.target)) return
            if (event.target.closest?.("[data-tricks-player]")?.getAttribute("data-tricks-player") === playerTooltip.name) return
            setPlayerTooltip(null)
        }
        const close = () => setPlayerTooltip(null)
        document.addEventListener("pointerdown", closeOutside)
        window.addEventListener("resize", close)
        document.addEventListener("scroll", close, true)
        return () => {
            document.removeEventListener("pointerdown", closeOutside)
            window.removeEventListener("resize", close)
            document.removeEventListener("scroll", close, true)
        }
    }, [playerTooltip])

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
    const countdownAlert = tricksTournamentCountdownAlert(state?.tournament?.end_at, nowValue)
    const countdownColors = resolvedTheme === "dark"
        ? {legendary: "#fde047", "take-closing": "#fb923c", "take-closed": "#f87171"}
        : {legendary: "#a16207", "take-closing": "#c2410c", "take-closed": "#b91c1c"}
    const countdownColor = countdownAlert ? countdownColors[countdownAlert.phase] : undefined
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
                <div data-tricks-tournament-remaining data-tricks-countdown-phase={countdownAlert?.phase || "normal"} style={{color: countdownColor, fontWeight: countdownAlert ? 700 : 400}}>
                    <div>残り {remaining}</div>
                    {countdownAlert && <div data-tricks-countdown-alert style={{fontSize: 11, lineHeight: 1.3, marginTop: 2}}>{countdownAlert.text}</div>}
                </div>
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
                <span style={{fontWeight:'bold'}}>{stagingMode ? "トリックテイキング制 テスト大会" : "第19回期間限定ランキング"}</span>
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
                    color: "var(--color-text-base)",
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
                        border: "1px solid var(--color-border-base)",
                        borderRight: 0,
                        borderRadius: "8px 0 0 8px",
                        background: "var(--color-bg-base)",
                        color: "var(--color-text-base)",
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
                        border: "1px solid var(--color-border-base)",
                        background: "var(--color-bg-base)",
                        padding: "8px 10px",
                        fontSize: 12,
                        lineHeight: 1.45,
                    }}
                >
                    {visibleLogs.length === 0 && (
                        <div style={{color: "var(--color-text-sub)"}}>ログはまだありません</div>
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
                    color: "var(--color-text-base)",
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
                        <div style={{padding: "6px 0", color: "var(--color-text-sub)", fontSize: 12}}>参加者はまだいません</div>
                    )}
                    <div style={{display: "flex", gap: 8, minWidth: "max-content"}}>
                        {infoCard}
                        {orderedPlayers.map((player, index) => {
                            const isMe = currentUserId && player.name === currentUserId
                            const screenName = usersById[player.name]?.name || player.name

                            return (
                                <div
                                    key={player.name || index}
                                    style={{width: 154, flex: "0 0 154px"}}
                                >
                                <div
                                    className="tricks-player-info"
                                    data-tricks-player={player.name}
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={playerTooltip?.name === player.name}
                                    onClick={(event) => {
                                        const bounds = event.currentTarget.getBoundingClientRect()
                                        setPlayerTooltip((current) => current?.name === player.name ? null : {name: player.name, left: bounds.left, top: bounds.bottom + 4})
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault()
                                            event.currentTarget.click()
                                        }
                                    }}
                                    style={{
                                        cursor: "pointer",
                                        width: "100%",
                                        boxSizing: "border-box",
                                        padding: "7px 10px",
                                        borderRadius: 10,
                                        border: isMe ? "1px solid rgba(255, 255, 255, 0.92)" : "1px solid rgba(148, 163, 184, 0.25)",
                                        background: playerBackground,
                                        color: panelColor,
                                        boxShadow: isMe ? "0 0 12px rgba(255, 255, 255, 0.18)" : "none",
                                        transition: "background 160ms ease, color 160ms ease, border-color 160ms ease",
                                    }}
                                >
                                        <div style={{display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11}}>
                                            <span>#{index + 1}</span>
                                            <span>
                                            <span>RP {player.total_rank_points ?? player.rank_points ?? 0}</span>
                                                <span> / </span>
                                                <span
                                                    data-tricks-subsidy-flag={player.subsidy_flag ? "active" : "inactive"}
                                                    data-tricks-balance-tax={player.balance_tax_eligible ? "active" : "inactive"}
                                                    style={{color: player.balance_tax_eligible ? "#279c59" : player.subsidy_flag ? "#d84b8c" : "inherit"}}
                                                >
                                                    <span
                                                        data-tricks-points-label
                                                        style={{textDecoration: player.subsidy_flag ? "underline" : "none"}}
                                                    >
                                                        DP
                                                    </span>
                                                    {" "}{player.draw_points}
                                                </span>
                                            </span>
                                        </div>
                                        <div style={{fontSize: 13, fontWeight: isMe ? 700 : 500, marginTop: 3}}>
                                            {shortenTricksText(screenName, 14)}
                                        </div>
                                        <div data-tricks-player-collected-count style={{fontSize: 11, marginTop: 2, opacity: isMe ? 0.94 : 0.78}}>
                                            ホルダー：{player.collected_card_count ?? 0}枚 (累計 {Number(historicalHolderCounts[player.name] || 0) + Number(player.collected_card_count || 0)}枚)
                                        </div>
                                        <div
                                            data-tricks-take-level
                                            style={{fontSize: 11, marginTop: 2, opacity: isMe ? 0.94 : 0.78}}
                                        >
                                            Lv.{player.take_level ?? 0}
                                        </div>
                                        <div style={{fontSize: 11, marginTop: 2, opacity: isMe ? 0.94 : 0.78}}>
                                            <span>手札 {player.card_count} / {player.hand_limit ?? (player.take_cost ?? 2) * 3}</span>
                                        </div>
                                        {player.next_take_at && new Date(player.next_take_at).getTime() > nowValue && (
                                            <div style={{fontSize: 10, marginTop: 2, color: "var(--color-text-base)"}}>
                                                次回テイク {new Date(player.next_take_at).toLocaleTimeString("ja-JP")}
                                            </div>
                                        )}
                                </div>
                                {Boolean(holderCardsByPlayer[player.name]?.length) && (
                                    <div data-tricks-mini-holder-cards style={{display: "flex", flexWrap: "wrap", gap: 2, width: "100%", boxSizing: "border-box", marginTop: 4, whiteSpace: "normal"}}>
                                        {holderCardsByPlayer[player.name].map((card) => (
                                            <Tooltip key={card.stage_id} title={`#${card.stage_id} ${card.title || ""}（${card.rule_name || ""}）`}>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    const bounds = event.currentTarget.getBoundingClientRect()
                                                    onSelectHolder?.({...card, anchor: {left: bounds.left, top: bounds.bottom + 4}})
                                                }}
                                                aria-label={`#${card.stage_id} ${card.title || ""}（${card.rule_name || ""}）`}
                                                style={{position: "relative", "--card-border": tricksRarityColors[Number(card.rarity)] || tricksRarityColors[1], padding: 0, cursor: "pointer", display: "inline-grid", placeItems: "center", width: 17, height: 23, border: `2px solid ${tricksRarityColors[Number(card.rarity)] || tricksRarityColors[1]}`, borderRadius: 2, background: "#fff", color: "#334155", fontSize: 10, fontWeight: 800, lineHeight: 1, textAlign: "center", boxSizing: "border-box"}}
                                            >
                                                <TricksCardBorder rarity={card.rarity} mini />
                                                {card.difficulty == null ? "-" : String(card.difficulty)}
                                            </button>
                                            </Tooltip>
                                        ))}
                                    </div>
                                )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
            {tooltipPlayer && (
                <div ref={playerTooltipRef} role="tooltip" data-tricks-player-tooltip style={{position: "fixed", left: playerTooltip.left, top: playerTooltip.top, zIndex: 410, padding: "7px 10px", borderRadius: 10, border: tooltipPlayer.name === currentUserId ? "1px solid rgba(255, 255, 255, 0.92)" : "1px solid rgba(148, 163, 184, 0.25)", background: playerBackground, color: panelColor, boxShadow: tooltipPlayer.name === currentUserId ? "0 0 12px rgba(255, 255, 255, 0.18)" : "none", fontSize: 12, lineHeight: 1.6}}>
                    <div>テイクコスト {tooltipPlayer.take_cost ?? 2}</div>
                    <div>次のレベルまであと {Math.max(0, (Number(tooltipPlayer.take_level ?? Math.floor(Math.sqrt(Number(tooltipPlayer.take_count || 0)))) + 1) ** 2 - Number(tooltipPlayer.take_count || 0))}テイク</div>
                    <div>手札の上限 {tooltipPlayer.hand_limit ?? (tooltipPlayer.take_cost ?? 2) * 3}枚</div>
                    {tooltipPlayer.subsidy_flag && <div data-tricks-tooltip-subsidy>次回のポイント給付対象です。</div>}
                    {tooltipPlayer.balance_tax_eligible && <div data-tricks-tooltip-tax>次回のポイント課税対象です。</div>}
                </div>
            )}
            <TricksCardBorderStyles />
        </>
    )
}
