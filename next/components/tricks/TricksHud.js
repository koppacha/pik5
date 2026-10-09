import {useTheme} from "next-themes"
import Link from "next/link"
import {rankColor, sec2time} from "../../lib/pik5"
import Tooltip from "@mui/material/Tooltip"
import TricksCardBorder, {TricksCardBorderStyles} from "./TricksCardBorder"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {faHome, faCloudSun, faCloudMoon, faBookBookmark, faUsers, faChevronDown, faChevronUp, faExpand, faCompress} from "@fortawesome/free-solid-svg-icons"
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
    tricksPlayerRanks,
    tricksOperationState,
    tricksRarityColors,
} from "../../lib/tricks"

function playersByTooltipName(players, name) {
    return name && players?.find((player) => player.name === name)
}

const visibleLogEvents = new Set(["join", "take", "record_posted", "record_updated", "player_extension", "empty_field_floor_grant", "subsidy_paid", "instant_subsidy_paid", "rule_changed", "ranking_reset", "ranking_reset_compensation", "collect"])

function displayName(usersById, userId, fallback = "-") {
    if (!userId) return fallback
    return usersById[userId]?.name || userId
}

function logTimestamp(value) {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return "-/- --:--"

    const parts = new Intl.DateTimeFormat("ja-JP", {
        month: "numeric",
        day: "numeric",
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date)
    const part = (type) => parts.find((value) => value.type === type)?.value
    return `${part("month")}/${part("day")} ${part("hour")}:${part("minute")}`
}

function logText(log, usersById) {
    if (typeof log === "string") return `-/- --:-- - ${log}`
    const user = displayName(usersById, log?.actor_name)
    const topUser = displayName(usersById, log?.top_user_id, "ホルダーなし")
    const title = log?.card_title || `カード#${log?.card_id || "-"}`
    const cardTitle = log?.rule_name ? `${title}（${log.rule_name}）` : title
    const rarity = Math.max(1, Number(log?.rarity || 1))
    let text = log?.message || log?.text || log?.event || "イベントが発生しました。"

    if (log?.event === "join") text = `${user}さんが参加しました。`
    if (log?.event === "take") text = `${user}さんが★${rarity} ${cardTitle}をテイクしました。`
    if (log?.event === "record_posted" || log?.event === "record_updated") {
        const score = log?.score == null ? "-" : log.score_type === "time" ? sec2time(Number(log.score)) : `${log.score}点`
        text = `${user}さんが${cardTitle}に投稿しました。（${score} / ${log?.rank ?? "-"}位）`
    }
    if (log?.event === "rule_changed") text = `${cardTitle}のルールが管理者裁定により変更されました。`
    if (log?.event === "ranking_reset") text = `${cardTitle}のランキングがリセットされました。`
    if (log?.event === "ranking_reset_compensation") text = `${displayName(usersById, log.affected_player_name)}さんにお詫びの5Pが配布されました。次の定期徴収は免除されます。`
    if (log?.event === "instant_subsidy_paid") text = `${user}さんに1Pが即時支給されました。`
    if (log?.event === "subsidy_paid") text = `${Number(log?.subsidy_recipient_count || 1)}人にドローポイントが給付されました。`
    if (log?.event === "player_extension") text = `${user}さんが${cardTitle}を15分延長しました。`
    if (log?.event === "empty_field_floor_grant") text = `循環再開のため合計${Number(log?.granted_points_total || 0)}Pが配布されました。`
    if (log?.event === "collect") {
        text = Number(log?.records_count || 0) === 0
            ? `${cardTitle}が除外されました。`
            : `${cardTitle}が${topUser}さんに回収され、ドローポイントが還元されました。`
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

export default function TricksHud({onToggleAdminStats, adminStatsOpen = false, accessAction, spectatorMode = false, onToggleSpectator, onShowKnowledge, highlightedPlayer = "", state, stagingMode = false, historicalHolderCounts = {}, usersById = {}, dimmed = false, currentUserId = "", nowValue = Date.now(), onToggleDebug, debugOpen = false, onSelectHolder, onHeaderHeightChange}) {
    const players = useMemo(() => state?.players || [], [state?.players])
    const playerRanks = useMemo(() => tricksPlayerRanks(players), [players])
    const headerRef = useRef(null)
    useEffect(() => {
        const header = headerRef.current
        if (!header || !onHeaderHeightChange) return undefined
        const update = () => {
            const root = header.closest("[data-tricks-root]")
            const bottom = spectatorMode && root ? Math.ceil(header.getBoundingClientRect().bottom - root.getBoundingClientRect().top) : 174
            onHeaderHeightChange(bottom)
        }
        update()
        const observer = new ResizeObserver(update)
        observer.observe(header)
        return () => observer.disconnect()
    }, [onHeaderHeightChange, spectatorMode])
    const logs = useMemo(() => state?.logs || [], [state?.logs])
    const holderCardsByPlayer = useMemo(() => (state?.holder_cards || []).reduce((grouped, card) => {
        if (!grouped[card.player_name]) grouped[card.player_name] = []
        grouped[card.player_name].push(card)
        return grouped
    }, {}), [state?.holder_cards])
    const [clockReady, setClockReady] = useState(false)
    const [logOpen, setLogOpen] = useState(false)
    const logsVisible = spectatorMode || logOpen
    const [logBottom, setLogBottom] = useState(null)
    const [logHeight, setLogHeight] = useState(178)
    const [viewportHeight, setViewportHeight] = useState(178)
    const logWindowRef = useRef(null)
    const logResizeRef = useRef(null)
    const bottomDocked = logBottom ?? spectatorMode
    useEffect(() => setLogBottom(null), [spectatorMode])
    const defaultLogHeight = Math.min(178, viewportHeight)
    const visibleLogHeight = Math.max(defaultLogHeight, Math.min(logHeight, viewportHeight))
    useEffect(() => {
        const update = () => setViewportHeight(window.innerHeight)
        update()
        window.addEventListener("resize", update)
        return () => window.removeEventListener("resize", update)
    }, [])
    const startLogResize = (event, edge) => {
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        logResizeRef.current = {y: event.clientY, height: visibleLogHeight, edge, transition: logWindowRef.current.style.transition}
        logWindowRef.current.style.transition = "none"
    }
    const moveLogResize = (event) => {
        const drag = logResizeRef.current
        if (!drag) return
        const height = Math.max(defaultLogHeight, Math.min(viewportHeight, drag.height + (event.clientY - drag.y) * drag.edge))
        logWindowRef.current.style.height = `${height}px`
        logWindowRef.current.style.top = `${bottomDocked ? viewportHeight - height : Math.max(0, Math.min(180, viewportHeight - height))}px`
    }
    const finishLogResize = (event) => {
        if (!logResizeRef.current) return
        const height = logWindowRef.current.getBoundingClientRect().height
        const transition = logResizeRef.current.transition
        logResizeRef.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        logWindowRef.current.style.transition = transition
        setLogHeight(height)
    }
    const previousPlayersRef = useRef(new Map())
    const playerTimersRef = useRef(new Map())
    const [changedPlayerStats, setChangedPlayerStats] = useState(new Map())
    const previousEventRef = useRef(state?.tournament?.event_id)
    useEffect(() => {
        const timers = playerTimersRef.current
        if (previousEventRef.current !== state?.tournament?.event_id) {
            timers.forEach(({timer}) => window.clearTimeout(timer))
            timers.clear()
            previousPlayersRef.current.clear()
            setChangedPlayerStats(new Map())
            previousEventRef.current = state?.tournament?.event_id
        }
        const ranks = tricksPlayerRanks(players)
        const nextPlayers = new Map()
        const changes = []
        players.forEach((player) => {
            const values = {
                rp: Number(player.total_rank_points ?? player.rank_points ?? 0),
                dp: Number(player.draw_points ?? 0),
                hand: Number(player.card_count ?? 0),
                collected: Number(player.collected_card_count ?? 0),
                rank: ranks.get(player.name),
            }
            nextPlayers.set(player.name, values)
            const previous = previousPlayersRef.current.get(player.name)
            if (!previous) return
            Object.keys(values).forEach((key) => {
                if (previous[key] === values[key]) return
                const token = JSON.stringify([player.name, key])
                if (timers.has(token)) window.clearTimeout(timers.get(token).timer)
                changes.push([player.name, key])
                const timer = window.setTimeout(() => {
                    timers.delete(token)
                    setChangedPlayerStats((current) => {
                        if (!current.get(player.name)?.has(key)) return current
                        const next = new Map(current)
                        const keys = new Set(next.get(player.name))
                        keys.delete(key)
                        if (keys.size) next.set(player.name, keys)
                        else next.delete(player.name)
                        return next
                    })
                }, 1800)
                timers.set(token, {timer, name: player.name})
            })
        })
        timers.forEach(({timer, name}, token) => {
            if (nextPlayers.has(name)) return
            window.clearTimeout(timer)
            timers.delete(token)
        })
        setChangedPlayerStats((current) => {
            if (!changes.length && [...current.keys()].every((name) => nextPlayers.has(name))) return current
            const next = new Map([...current].filter(([name]) => nextPlayers.has(name)))
            changes.forEach(([name, key]) => next.set(name, new Set([...(next.get(name) || []), key])))
            return next
        })
        previousPlayersRef.current = nextPlayers
    }, [players, state?.tournament?.event_id])
    useEffect(() => {
        const timers = playerTimersRef.current
        return () => {
            timers.forEach(({timer}) => window.clearTimeout(timer))
            timers.clear()
        }
    }, [])
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
            role={onToggleAdminStats ? "button" : undefined}
            tabIndex={onToggleAdminStats ? 0 : undefined}
            aria-expanded={onToggleAdminStats ? adminStatsOpen : undefined}
            onClick={onToggleAdminStats}
            onKeyDown={(event) => {
                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault()
                    onToggleAdminStats?.()
                }
            }}
            style={{
                minWidth: 272,
                padding: "4px 10px",
                borderRadius: 10,
                border: "1px solid rgba(148, 163, 184, 0.25)",
                background: panelBackground,
                color: panelColor,
            }}
        >
            <div data-tricks-info-summary style={{display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2, textAlign: "center", fontSize: 11, lineHeight: 1.15}}>
                <div data-tricks-participant-count>
                    <div>参加者数</div><strong style={{fontSize: 14}}>{state?.tournament?.participant_count ?? players.length}人</strong><br/>
                    <span>（切り札上限：{operation.fieldCap}枚）</span>
                </div>
                <div>
                    <div>残り</div><strong style={{fontSize: 14}}>{remaining}</strong>
                    {countdownAlert && <div data-tricks-countdown-alert style={{fontSize: 11, lineHeight: 1.3, marginTop: 2}}>{countdownAlert.text}</div>}
                </div>
            </div>
            <div data-tricks-info-metrics style={{display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 3, marginTop: 4, fontSize: 11, lineHeight: 1.15, textAlign: "center"}}>
                {[
                    ["deck-count", "デッキ", state?.deck_count ?? 0, "枚"],
                    ["draw-total", "ドロー", state?.draw_total ?? 0, "回"],
                    ["post-total", "投稿", state?.post_total ?? 0, "回"],
                    ["collected-count", "回収", state?.collected_count ?? 0, "枚"],
                    ["trash-count", "捨て札", state?.trash_count ?? 0, "枚"],
                    ["take-total", "テイク", state?.take_total ?? 0, "回"],
                    ["points-total", "合計P", state?.points_total ?? 0, "P"],
                    ...(Number(state?.tournament?.pot_points || 0) > 0 ? [["pot", "ポット", state.tournament.pot_points, "P"]] : []),
                ].map(([key, label, value, unit]) => <div key={key} {...{[`data-tricks-${key}`]: true}} style={{padding: "2px 2px", border: "1px solid var(--color-border-base)", borderRadius: 4, background: panelBackground}}><div>{label}</div><strong style={{fontSize: 12}}>{value}{unit}</strong></div>)}
            </div>
            {hasSubsidyRecipient && <div data-tricks-subsidy-remaining style={{marginTop: 4, fontSize: 11, textAlign: "center", color: panelColor}}>次回給付 {nextSubsidyRemaining}</div>}
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
                position: "fixed", top: 0, left: '40px', zIndex: 40, display: "flex", alignItems: "center", gap: 12, width: "max-content", maxWidth: "calc(100vw - 40px)", boxSizing: "border-box", overflowX: "auto", whiteSpace: "nowrap", padding: "3px 18px", borderRadius: "0 0 18px 18px", background: "#3c3c3c", color: "#fff", fontSize: 13, lineHeight: "22px"
            }}>
                <span style={{fontWeight:'bold'}}>{state?.tournament?.title || (stagingMode ? "トリックテイキング制 テスト大会" : "第19回期間限定ランキング")}</span>
                <span style={{fontSize:'0.85em'}}>トリックテイキング制×スタンダード</span>
                <LiveClock />
                <Tooltip title="ホーム" enterDelay={0} enterNextDelay={0} leaveDelay={0} arrow><Link href="/" aria-label="ホーム" style={{color: "inherit"}}><FontAwesomeIcon icon={faHome} /></Link></Tooltip>
                <Tooltip title="Discord" enterDelay={0} enterNextDelay={0} leaveDelay={0} arrow><a href="https://discord.gg/rQEBJQa" aria-label="Discord" style={{color: "inherit"}}><FontAwesomeIcon icon={faDiscord} /></a></Tooltip>
                <Tooltip title="テーマ変更" enterDelay={0} enterNextDelay={0} leaveDelay={0} arrow><button type="button" aria-label="テーマ変更" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} style={{border: 0, background: "transparent", color: "inherit", cursor: "pointer"}}><FontAwesomeIcon icon={clockReady && resolvedTheme === "dark" ? faCloudSun : faCloudMoon} /></button></Tooltip>
                <Tooltip title="ナレッジ" enterDelay={0} enterNextDelay={0} leaveDelay={0} arrow><button type="button" onClick={onShowKnowledge} aria-label="ナレッジ" style={{border: 0, background: "transparent", color: "inherit", cursor: "pointer"}}><FontAwesomeIcon icon={faBookBookmark} /></button></Tooltip>
                <Tooltip title="観戦モード" enterDelay={0} enterNextDelay={0} leaveDelay={0} arrow><button type="button" aria-label="観戦モード" aria-pressed={spectatorMode}
                    data-tricks-spectator-toggle onClick={onToggleSpectator}
                    style={{border: 0, background: "transparent", color: spectatorMode ? "#8ef0b2" : "inherit", cursor: "pointer"}}><FontAwesomeIcon icon={faUsers} /></button></Tooltip>
                {(state?.tournament?.debug || state?.tournament?.test_mode) && <button type="button" data-tricks-debug-toggle onClick={onToggleDebug} disabled={!onToggleDebug} aria-expanded={debugOpen} style={{color: "#8ef0b2", background: "transparent", border: 0, cursor: onToggleDebug ? "pointer" : "default"}}>DEBUG</button>}
            </nav>
            {accessAction && <div data-tricks-info-access style={{position: "fixed", left: 20, bottom: 20, zIndex: 150}}>{accessAction}</div>}
            <div
                ref={logWindowRef}
                className="tricks-log-window"
                data-tricks-log-wrapper
                data-log-open={logsVisible ? "true" : "false"}
                style={{
                    position: "fixed",
                    right: 0,
                    top: bottomDocked ? viewportHeight - visibleLogHeight : Math.max(0, Math.min(180, viewportHeight - visibleLogHeight)),
                    bottom: undefined,
                    width: "min(444px, 100vw)",
                    height: visibleLogHeight,
                    display: "flex",
                    alignItems: "stretch",
                    zIndex: 45,
                    color: "var(--color-text-base)",
                    pointerEvents: "auto",
                    opacity: dimmed ? 0.35 : 1,
                    transform: logsVisible ? "translateX(0)" : "translateX(calc(100% - 44px))",
                    transition: "transform 240ms ease, opacity 160ms ease, top 240ms ease, bottom 240ms ease, height 240ms ease",
                }}
            >
                <div style={{width: 44, flex: "0 0 44px", display: "flex", flexDirection: "column", border: "1px solid var(--color-border-base)", borderRight: 0, borderRadius: "8px 0 0 8px", background: "var(--color-bg-base)", boxSizing: "border-box"}}>
                    <button type="button" data-tricks-log-toggle aria-expanded={logsVisible} aria-controls="tricks-log-region" onClick={() => setLogOpen((open) => !open)} disabled={spectatorMode}
                        style={{flex: 1, border: 0, background: "transparent", color: "inherit", fontSize: 13, fontWeight: 700, letterSpacing: "0.16em", writingMode: "vertical-rl", cursor: "pointer", width: "100%"}}>ログ</button>
                    {logsVisible && <>
                        <button type="button" data-tricks-log-expand aria-label={visibleLogHeight > defaultLogHeight ? "ログを元の高さに戻す" : "ログを最大化"} onClick={() => setLogHeight(visibleLogHeight > defaultLogHeight ? defaultLogHeight : viewportHeight)} style={{height: 32, border: 0, background: "transparent", color: "inherit", cursor: "pointer"}}><FontAwesomeIcon icon={visibleLogHeight > defaultLogHeight ? faCompress : faExpand} /></button>
                        <button type="button" data-tricks-log-dock aria-label={bottomDocked ? "ログを元の位置に戻す" : "ログを最下部に移動"} onClick={() => {
                            setLogBottom(!bottomDocked)
                            setLogOpen(true)
                        }} style={{height: 32, border: 0, background: "transparent", color: "inherit", cursor: "pointer"}}><FontAwesomeIcon icon={bottomDocked ? faChevronUp : faChevronDown} /></button>
                    </>}
                </div>
                {logsVisible && [ -1, 1 ].map((edge) => <div key={edge} data-tricks-log-resize={edge === -1 ? "top" : "bottom"} role="separator" aria-label="ログの高さを調整" aria-orientation="horizontal" aria-valuemin={defaultLogHeight} aria-valuemax={viewportHeight} aria-valuenow={visibleLogHeight} tabIndex={0}
                    onPointerDown={(event) => startLogResize(event, edge)} onPointerMove={moveLogResize} onPointerUp={finishLogResize} onPointerCancel={finishLogResize}
                    onKeyDown={(event) => { if (["ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); setLogHeight(Math.max(defaultLogHeight, Math.min(viewportHeight, visibleLogHeight + (event.key === "ArrowDown" ? 20 : -20) * edge))) } }}
                    style={{position: "absolute", left: 44, right: 0, [edge === -1 ? "top" : "bottom"]: -3, height: 7, cursor: "ns-resize", touchAction: "none", zIndex: 1}} />)}
                <div
                    className="tricks-log-body"
                    id="tricks-log-region"
                    data-tricks-log-region
                    aria-hidden={!logsVisible}
                    style={{
                        width: 400,
                        minWidth: 0,
                        visibility: logsVisible ? "visible" : "hidden",
                        height: "100%",
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
                    ref={headerRef}
                    data-tricks-header-scroll
                    style={{
                        width: "100%",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        overflowX: spectatorMode ? "visible" : "auto",
                        overflowY: spectatorMode ? "visible" : "hidden",
                        overscrollBehaviorX: "contain",
                        WebkitOverflowScrolling: "touch",
                        padding: "8px 0 0",
                        whiteSpace: "nowrap",
                    }}
                >
                    {orderedPlayers.length === 0 && (
                        <div style={{padding: "6px 0", color: "var(--color-text-sub)", fontSize: 12}}>参加者はまだいません</div>
                    )}
                    <div style={{display: "flex", flexWrap: spectatorMode ? "wrap" : "nowrap", alignItems: "flex-start", gap: 8, minWidth: spectatorMode ? 0 : "max-content"}}>
                        {infoCard}
                        {orderedPlayers.map((player, index) => {
                            const isMe = currentUserId && player.name === currentUserId
                            const screenName = usersById[player.name]?.name || player.name
                            const changes = changedPlayerStats.get(player.name)
                            const wholePlayerBlink = highlightedPlayer === player.name ? "post" : changes?.has("rank") ? "change" : undefined

                            return (
                                <div
                                    key={player.name || index}
                                    style={{width: 190, flex: "0 0 190px"}}
                                >
                                <div
                                    className="tricks-player-info"
                                    data-tricks-player-blink={wholePlayerBlink}
                                    data-tricks-player={player.name}
                                    data-tricks-player-rank={playerRanks.get(player.name)}
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
                                        border: `1px solid ${rankColor(playerRanks.get(player.name), 0, 1)}`,
                                        borderLeftWidth: 10,
                                        background: playerBackground,
                                        color: panelColor,
                                        transition: "background 160ms ease, color 160ms ease, border-color 160ms ease",
                                    }}
                                >
                                        <div style={{fontSize: 11}}>#{playerRanks.get(player.name)}</div>
                                        <div data-tricks-player-name-row style={{display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginTop: 3}}>
                                            <span data-tricks-player-screen-name title={screenName} style={{minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontSize: 13, fontWeight: isMe ? 700 : 500}}>{shortenTricksText(screenName, 14)}</span>
                                            <span data-tricks-take-level style={{flexShrink: 0, fontSize: 11}}>Lv.{player.take_level ?? 0}</span>
                                        </div>
                                        <div data-tricks-next-take style={{fontSize: 10, lineHeight: "14px", height: 14, marginTop: 2, color: "var(--color-text-base)"}}>
                                            {player.next_take_at && new Date(player.next_take_at).getTime() > nowValue && `次回テイク ${new Date(player.next_take_at).toLocaleTimeString("ja-JP")}`}
                                        </div>
                                        <div data-tricks-player-metrics style={{display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 3, marginTop: 6, textAlign: "center", fontSize: 11, lineHeight: 1.15}}>
                                            <div data-tricks-player-rank-points data-tricks-stat-blink={!wholePlayerBlink && changes?.has("rp") ? "rp" : undefined} style={{padding: "2px 1px", border: "1px solid var(--color-border-base)", borderRadius: 4, background: panelBackground}}><div>RP</div><strong style={{fontSize: 12}}>{player.total_rank_points ?? player.rank_points ?? 0}</strong></div>
                                            <div data-tricks-stat-blink={!wholePlayerBlink && changes?.has("dp") ? "dp" : undefined} data-tricks-subsidy-flag={player.subsidy_flag ? "active" : "inactive"} data-tricks-balance-tax={player.balance_tax_eligible ? "active" : "inactive"} style={{padding: "2px 1px", border: "1px solid var(--color-border-base)", borderRadius: 4, background: panelBackground, color: player.balance_tax_eligible ? "#279c59" : player.subsidy_flag ? "#d84b8c" : "inherit"}}>
                                                <div data-tricks-points-label style={{textDecoration: player.subsidy_flag ? "underline" : "none"}}>DP</div><strong style={{fontSize: 12}}>{player.draw_points ?? 0}</strong>
                                            </div>
                                            <div data-tricks-player-hand-count data-tricks-stat-blink={!wholePlayerBlink && changes?.has("hand") ? "hand" : undefined} style={{padding: "2px 1px", border: "1px solid var(--color-border-base)", borderRadius: 4, background: panelBackground}}><div>手札</div><strong style={{fontSize: 12}}>{player.card_count ?? 0}</strong></div>
                                            <div data-tricks-player-collected-count data-tricks-stat-blink={!wholePlayerBlink && changes?.has("collected") ? "collected" : undefined} style={{padding: "2px 1px", border: "1px solid var(--color-border-base)", borderRadius: 4, background: panelBackground}}><div>回収</div><strong style={{fontSize: 12}}>{player.collected_card_count ?? 0}</strong></div>
                                        </div>
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
                                                style={{position: "relative", "--card-border": tricksRarityColors[Number(card.rarity)] || tricksRarityColors[1], padding: 0, cursor: "pointer", display: "inline-grid", placeItems: "center", width: 17, height: 23, border: `3px solid ${tricksRarityColors[Number(card.rarity)] || tricksRarityColors[1]}`, borderRadius: 2, background: "#fff", color: "#707a8a", fontSize: 10, fontWeight: 500, lineHeight: 1, textAlign: "center", boxSizing: "border-box"}}
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
                <div ref={playerTooltipRef} role="tooltip" data-tricks-player-tooltip style={{position: "fixed", left: Math.max(8, Math.min(playerTooltip.left, window.innerWidth - 288)), top: playerTooltip.top, width: 280, maxWidth: "calc(100vw - 16px)", boxSizing: "border-box", zIndex: 410, padding: "7px 10px", borderRadius: 10, border: `1px solid ${rankColor(playerRanks.get(tooltipPlayer.name), 0, 1)}`, background: playerBackground, color: panelColor, fontSize: 12, lineHeight: 1.6}}>
                    <div>テイクコスト {tooltipPlayer.take_cost ?? 2}</div>
                    <div>次のレベルまであと {Math.max(0, (Number(tooltipPlayer.take_level ?? Math.floor(Math.sqrt(Number(tooltipPlayer.take_count || 0)))) + 1) ** 2 - Number(tooltipPlayer.take_count || 0))}テイク</div>
                    <div data-tricks-tooltip-lifetime-cards>累計所持カード：{Number(historicalHolderCounts[tooltipPlayer.name] || 0) + Number(tooltipPlayer.collected_card_count || 0)} 枚</div>
                    <div>手札の上限 {tooltipPlayer.hand_limit ?? (tooltipPlayer.take_cost ?? 2) * 3}枚</div>
                    <div data-tricks-tax-border>税金徴収ボーダー {Number(tooltipPlayer.balance_tax_threshold ?? (tooltipPlayer.take_cost ?? 2) * 5) + 1}DP以上</div>
                    {tooltipPlayer.subsidy_flag && <div data-tricks-tooltip-subsidy>次回のドローポイント給付対象です。</div>}
                    {tooltipPlayer.balance_tax_eligible && <div data-tricks-tooltip-tax>次回のドローポイント課税対象です。</div>}
                </div>
            )}
            <style jsx global>{`
                @keyframes tricksSpectatorBlink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .35; }
                }
                [data-tricks-player-blink="change"], [data-tricks-stat-blink] {
                    animation: tricksSpectatorBlink 333.333ms steps(2, end) infinite;
                }
                [data-tricks-player-blink="post"], .tricks-post-blink,
                [data-tricks-highlighted-post] .user-type,
                [data-tricks-highlighted-post] .score-type {
                    animation: tricksSpectatorBlink 666.667ms steps(2, end) infinite;
                }
            `}</style>
            <TricksCardBorderStyles />
        </>
    )
}
