import Head from "next/head"
import Link from "next/link"
import dynamic from "next/dynamic"
import useSWR from "swr"
import {useSession} from "next-auth/react"
import {useCallback, useEffect, useMemo, useRef, useState} from "react"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Dialog from "@mui/material/Dialog"
import DialogContent from "@mui/material/DialogContent"
import DialogTitle from "@mui/material/DialogTitle"
import DialogActions from "@mui/material/DialogActions"
import TextField from "@mui/material/TextField"
import {postTricks, createTricksApi, tricksFetcher, tricksOperationState, tricksStackBonus} from "../../../lib/tricks"
import RecordForm from "../../../components/modal/RecordForm"
import TricksCollectedResults from "../../../components/tricks/TricksCollectedResults"
import TricksDebugPanel from "../../../components/tricks/TricksDebugPanel"
import TricksFieldDetailPanel from "../../../components/tricks/TricksFieldDetailPanel"
import useTricksSpectator from "../../../components/tricks/useTricksSpectator"
import TricksSpectatorPanel from "../../../components/tricks/TricksSpectatorPanel"
import TricksAdminStats from "../../../components/tricks/TricksAdminStats"
import TricksHud from "../../../components/tricks/TricksHud"
import TricksManualContent from "../../../components/tricks/TricksManualContent"
import {fieldPanelPosition, fieldDetailModalWidth} from "../../../lib/tricks/fieldPanelPosition"

const TricksGame = dynamic(() => import("../../../components/tricks/TricksLayeredGame"), {
    ssr: false,
})


function stateContentSignature(state) {
    if (!state) return ""

    return JSON.stringify({
        tournament: {
            event_id: state.tournament?.event_id,
            state: state.tournament?.state,
            available: state.tournament?.available,
        },
        me: state.me,
        players: state.players,
        field: state.field,
        hand: state.hand,
        deck_count: state.deck_count,
        deck_difficulty_counts: state.deck_difficulty_counts,
        deck_series_counts: state.deck_series_counts,
        deck_creator_counts: state.deck_creator_counts,
        trash_count: state.trash_count,
        collected_count: state.collected_count,
        holder_cards: state.holder_cards,
        logs: state.logs,
    })
}

function tricksErrorMessage(error, fallback = "操作に失敗しました") {
    const code = Number(error?.status)
    const detail = error?.message || fallback

    return Number.isInteger(code) && code >= 400 ? `HTTP ${code}: ${detail}` : detail
}

function TricksGamePage({eventId, manualContent, stagingMode = false}) {
    const tricksApi = useMemo(() => createTricksApi(eventId), [eventId])
    const {data: session, status} = useSession()
    const userId = session?.user?.userId || session?.user?.id
    const [spectatorMode, setSpectatorMode] = useState(false)
    const [spectatorExitConfirm, setSpectatorExitConfirm] = useState(false)
    const [headerBottom, setHeaderBottom] = useState(174)
    const requestSpectatorExit = useCallback(() => setSpectatorExitConfirm(true), [])
    const [message, setMessage] = useState("")
    const [busy, setBusy] = useState(false)
    const [selectedField, setSelectedField] = useState(null)
    const [selectedHolder, setSelectedHolder] = useState(null)
    const [postingCard, setPostingCard] = useState(null)
    const [postOpen, setPostOpen] = useState(false)
    const [ruling, setRuling] = useState(null)
    const [rulingError, setRulingError] = useState("")
    const [debugOpen, setDebugOpen] = useState(false)
    const [howToOpen, setHowToOpen] = useState(false)
    const [knowledgeOpen, setKnowledgeOpen] = useState(false)
    const [fieldSorting, setFieldSorting] = useState(false)
    const [nowValue, setNowValue] = useState(Date.now())
    const clockInitializedRef = useRef(false)
    const debugMetricsRef = useRef({stateFetchCount: 0, stateChangeCount: 0})
    const collectingExpiredRef = useRef(false)
    const processedSubsidySlotRef = useRef(null)
    const subsidyRetryAtRef = useRef(0)
    const subsidyErrorMessageRef = useRef(null)
    const {data: holderRankings} = useSWR(selectedHolder?.id ? tricksApi.scores(selectedHolder.id) : null, tricksFetcher)
    const stateKey = tricksApi.state
    const selectedCardSnapshot = selectedField?.card || selectedField
    const fieldAnchor = selectedField?.anchor
    const fieldSide = selectedField?.side || "right"
    const stateFetcher = useCallback(async (url) => {
        debugMetricsRef.current.stateFetchCount += 1
        return tricksFetcher(url)
    }, [])
    const {data: state, error, mutate, isLoading} = useSWR(stateKey, stateFetcher, {
        refreshInterval: (latest) => latest?.tournament?.state === "ended" || fieldSorting ? 0 : 3000,
        revalidateOnFocus: true,
        keepPreviousData: true,
    })
    const selectedCard = state?.field?.find((card) => card.id === selectedCardSnapshot?.id) || selectedCardSnapshot
    const spectatorPresentation = useTricksSpectator(state, spectatorMode)
    useEffect(() => {
        if (!spectatorPresentation) return
        setSelectedField(null)
        setSelectedHolder(null)
    }, [spectatorPresentation])
    const {data: users = []} = useSWR("/api/users", tricksFetcher, {
        revalidateOnFocus: false,
    })
    const {data: holderCatalog} = useSWR(tricksApi.holders(), tricksFetcher, {
        refreshInterval: 30000,
        revalidateOnFocus: true,
    })
    const {
        data: rankings,
        mutate: mutateRankings
    } = useSWR(selectedCard?.id ? tricksApi.scores(selectedCard.id) : null, tricksFetcher, {
        refreshInterval: selectedCard?.id ? 3000 : 0,
        revalidateOnFocus: true,
    })
    const eventEnded = state?.tournament?.state === "ended"
    const {data: collected = [], mutate: mutateCollected} = useSWR(
        eventEnded && state?.tournament?.event_id ? tricksApi.collected(state.tournament.event_id) : null,
        tricksFetcher,
        {revalidateOnFocus: false}
    )
    const isAdmin = Number(session?.user?.role) === 10
    const [adminStatsOpen, setAdminStatsOpen] = useState(false)
    const closeAdminStats = useCallback(() => setAdminStatsOpen(false), [])
    useEffect(() => { setAdminStatsOpen(false) }, [isAdmin, state?.tournament?.event_id])
    const {data: collectedAdminStats} = useSWR(
        adminStatsOpen && isAdmin && state?.tournament?.event_id ? tricksApi.collectedAdminStats(state.tournament.event_id) : null,
        tricksFetcher,
        {revalidateOnFocus: true, refreshInterval: eventEnded ? 0 : 10000}
    )
    const operation = useMemo(() => tricksOperationState(state, {nowValue}), [nowValue, state])
    const isDebugAdmin = Boolean(
        (state?.tournament?.debug || state?.tournament?.test_mode)
        && Number(session?.user?.role) === 10
    )
    const debugObservability = Boolean(state?.tournament?.debug || state?.tournament?.test_mode)
    const usersById = useMemo(() => {
        return (users || []).reduce((acc, user) => {
            if (user?.userId) acc[user.userId] = user
            return acc
        }, {})
    }, [users])
    const fieldPanelStyle = useMemo(() => fieldPanelPosition(fieldAnchor, fieldSide,
        typeof window !== "undefined" ? window.innerHeight : 900), [fieldAnchor, fieldSide])

    const me = state?.me
    const tournamentTitle = state?.tournament?.title || "期間限定ランキング"
    const authenticated = status === "authenticated" && Boolean(userId)
    const canJoin = authenticated && !me && state?.tournament?.available
    const runAction = useCallback(async (action, options = {}) => {
        if (!userId || (spectatorMode && !options.joining)) {
            return false
        }
        setBusy(true)
        setMessage("")
        try {
            const result = await action()
            if (options.beforeMutate) {
                options.beforeMutate(result)
                await new Promise((resolve) => window.requestAnimationFrame(resolve))
            }
            await mutate()
            if (options.collected) await mutateCollected()
            return result ?? true
        } catch (e) {
            setMessage(tricksErrorMessage(e))
            return false
        } finally {
            setBusy(false)
        }
    }, [mutate, mutateCollected, spectatorMode, userId])

    const openRuling = (type) => {
        setRulingError("")
        setRuling({type, card: selectedCard, key: crypto.randomUUID(), values: {
            title: selectedCard.title || "",
            rule_name: selectedCard.rule_name || "",
            text: selectedCard.text || "",
            difficulty: selectedCard.difficulty || 1,
        }})
    }
    const submitRuling = async (event) => {
        event.preventDefault()
        if (busy || !ruling) return
        setRulingError("")
        const result = await runAction(async () => {
            try {
                return await postTricks(ruling.type === "reset"
                    ? tricksApi.resetRanking(ruling.card.id) : tricksApi.changeRule(ruling.card.id), {
                    ...(ruling.type === "rule" && ruling.values),
                    idempotency_key: ruling.key,
                })
            } catch (error) {
                setRulingError(tricksErrorMessage(error))
                throw error
            }
        })
        if (result) {
            await mutateRankings()
            setSelectedField(null)
            setRuling(null)
            setMessage(ruling.type === "reset"
                ? `${result.deleted}件の投稿を削除し、${result.compensated}人に5Pを配布しました`
                : "ルールを変更しました")
        }
    }

    const join = async () => {
        changeSpectatorMode(false)
        const result = await runAction(() => postTricks(tricksApi.join), {joining: true})
        if (result) setHowToOpen(true)
    }
    const draw = useCallback((beforeMutate) => runAction(
        () => postTricks(tricksApi.draw),
        {beforeMutate}
    ), [runAction, tricksApi])
    const returnToDeck = useCallback((card, beforeMutate) => {
        if (!card?.id) return false
        if (!window.confirm(`「${card.title || "このカード"}」を1P消費してデッキに戻しますか？`)) {
            return false
        }

        return runAction(
            () => postTricks(tricksApi.returnToDeck(card.id)),
            {beforeMutate}
        )
    }, [runAction, tricksApi])
    const take = useCallback((card, beforeMutate) => {
        if (!card?.id) return
        const bonus = Number(card.rarity) >= 2
            ? `\nトリックボーナス：+${tricksStackBonus(card.rarity, operation.handCount)}P`
            : ""
        if (!window.confirm(`「${card.title || "このカード"}」を場に出します。手札${operation.handCount}枚を使用しますか？${bonus}`)) {
            return false
        }

        return runAction(() => postTricks(tricksApi.take(card.id)), {beforeMutate})
    }, [operation.handCount, runAction, tricksApi])
    const extendCard = useCallback(async (card) => {
        if (!card?.id) return false
        if (!window.confirm("１点支払ってこのカードの期限を延長しますか？")) return false
        const idempotencyKey = window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : `extend-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const result = await runAction(() => postTricks(tricksApi.extend(card.id), {
            idempotency_key: idempotencyKey,
        }))
        if (result?.card) {
            setSelectedField((current) => current?.card
                ? {...current, card: {...current.card, ...result.card}}
                : {...card, ...result.card})
            await mutateRankings()
        }

        return result
    }, [mutateRankings, runAction, tricksApi])
    const runDebugOperation = useCallback((type, payload = {}) => {
        const urls = {
            freeze: tricksApi.debugTimeFreeze,
            set: tricksApi.debugTimeSet,
            advance: tricksApi.debugTimeAdvance,
            reset: tricksApi.debugTimeReset,
        }

        return runAction(() => postTricks(urls[type], payload), {collected: true})
    }, [runAction, tricksApi])
    const debugCollect = useCallback((card) => {
        return runAction(() => postTricks(tricksApi.debugCollect(card.id)), {collected: true})
    }, [runAction, tricksApi])
    const expiredFieldKey = useMemo(() => {
        return (state?.field || [])
            .filter((card) => card?.limit_at && new Date(card.limit_at).getTime() <= nowValue)
            .map((card) => card.id)
            .join(",")
    }, [nowValue, state?.field])
    const subsidySlotKey = Math.floor(nowValue / (30 * 60 * 1000))
    const accessGateOpen = !spectatorMode && Boolean(state) && !me && status !== "loading"
    const handlePosted = async () => {
        setPostOpen(false)
        setPostingCard(null)
        setSelectedField(null)
        await Promise.all([mutate(), mutateRankings()])
    }
    const closeFieldDetail = useCallback(() => {
        setPostOpen(false)
        setPostingCard(null)
        setSelectedField(null)
    }, [])
    const openPostModal = useCallback((event) => {
        event.preventDefault()
        event.stopPropagation()
        setPostingCard(selectedCard)
        setSelectedField(null)
        setPostOpen(true)
    }, [selectedCard])
    const closePostModal = useCallback(() => {
        setPostOpen(false)
        setPostingCard(null)
        setSelectedField(null)
    }, [])
    const setPostModalOpen = useCallback((open) => {
        setPostOpen(open)
        if (!open) {
            setPostingCard(null)
            setSelectedField(null)
        }
    }, [])

    const changeSpectatorMode = useCallback((enabled) => {
        setSpectatorMode(enabled)
        setSpectatorExitConfirm(false)
        closePostModal()
        setSelectedHolder(null)
        setHowToOpen(false)
        setDebugOpen(false)
    }, [closePostModal])

    useEffect(() => {
        if (!selectedCard || !state?.field) return
        const fresh = state.field.find((card) => card.id === selectedCard.id)
        if (!fresh || !fresh.limit_at || new Date(fresh.limit_at).getTime() <= nowValue) {
            setSelectedField(null)
        }
    }, [nowValue, selectedCard, state?.field])

    useEffect(() => {
        if (spectatorMode || !me || !expiredFieldKey || collectingExpiredRef.current) return undefined
        let cancelled = false
        collectingExpiredRef.current = true
        postTricks(tricksApi.collectExpired)
            .then(async () => {
                if (!cancelled) await mutate()
            })
            .catch((collectionError) => {
                if (!cancelled) setMessage(tricksErrorMessage(collectionError, "期限切れカードの回収に失敗しました"))
            })
            .finally(() => {
                collectingExpiredRef.current = false
            })

        return () => {
            cancelled = true
        }
    }, [expiredFieldKey, me, mutate, spectatorMode, tricksApi.collectExpired])

    useEffect(() => {
        if (spectatorMode || !clockInitializedRef.current || !me || !operation.available || processedSubsidySlotRef.current === subsidySlotKey
            || Date.now() < subsidyRetryAtRef.current) return undefined
        let cancelled = false
        processedSubsidySlotRef.current = subsidySlotKey
        postTricks(tricksApi.subsidy)
            .then(async () => {
                subsidyRetryAtRef.current = 0
                if (!cancelled) {
                    setMessage(currentMessage => currentMessage === subsidyErrorMessageRef.current ? "" : currentMessage)
                    subsidyErrorMessageRef.current = null
                    await mutate()
                }
            })
            .catch((subsidyError) => {
                if (processedSubsidySlotRef.current === subsidySlotKey) {
                    processedSubsidySlotRef.current = null
                }
                subsidyRetryAtRef.current = Date.now() + 30000
                if (!cancelled) {
                    subsidyErrorMessageRef.current = tricksErrorMessage(subsidyError, "ドローポイント給付の確認に失敗しました")
                    setMessage(subsidyErrorMessageRef.current)
                }
            })

        return () => {
            cancelled = true
        }
    }, [me, mutate, nowValue, operation.available, spectatorMode, subsidySlotKey, tricksApi.subsidy])

    useEffect(() => {
        const serverNow = state?.server_now || state?.tournament?.server_now
        if (!serverNow) return
        const serverTime = new Date(serverNow).getTime()
        if (!Number.isFinite(serverTime)) return

        setNowValue((current) => {
            const shouldReanchor = !clockInitializedRef.current
                || state?.debug_state?.frozen
                || Math.abs(serverTime - current) >= 5000
            clockInitializedRef.current = true

            return shouldReanchor ? serverTime : current
        })
    }, [state?.debug_state?.frozen, state?.server_now, state?.tournament?.server_now])

    useEffect(() => {
        if (state?.debug_state?.frozen) return undefined
        const timer = window.setInterval(() => {
            setNowValue((current) => current + 1000)
        }, 1000)

        return () => window.clearInterval(timer)
    }, [state?.debug_state?.frozen])

    const stateSignature = stateContentSignature(state)
    useEffect(() => {
        if (stateSignature) debugMetricsRef.current.stateChangeCount += 1
    }, [stateSignature])

    useEffect(() => {
        if (!debugObservability) {
            delete window.__TRICKS_DEBUG_SNAPSHOT__
            return undefined
        }
        window.__TRICKS_DEBUG_SNAPSHOT__ = () => {
            const render = window.__TRICKS_RENDER_METRICS__ || {}

            return {
                ...debugMetricsRef.current,
                ...render,
                domCards: document.querySelectorAll(".tricks-dom-card").length,
                domNodes: document.querySelectorAll("[data-tricks-root] *").length,
                canvasCount: document.querySelectorAll("[data-tricks-root] canvas").length,
            }
        }

        return () => {
            delete window.__TRICKS_DEBUG_SNAPSHOT__
        }
    }, [debugObservability])

    return (
        <>
            <Head>
                <title>{tournamentTitle} - ピクチャレ大会</title>
            </Head>
            <div
                data-tricks-root
                style={{
                    position: "relative",
                    width: "100vw",
                    height: "100vh",
                    minHeight: 540,
                    marginLeft: "calc(50% - 50vw)",
                    marginRight: "calc(50% - 50vw)",
                    background: '#0c1016 url("/img/limited_19_bg.jpg") center / min(100%, 2000px) auto repeat',
                    color: "var(--color-text-base)",
                    overflow: "clip",
                }}
            >
                <TricksGame
                    spectatorMode={spectatorMode}
                    headerBottom={headerBottom}
                    onExitSpectator={() => changeSpectatorMode(false)}
                    onRequestSpectatorExit={requestSpectatorExit}
                    state={state}
                    selectedFieldId={selectedCard?.id}
                    usersById={usersById}
                    onDraw={draw}
                    onTake={take}
                    onReturnToDeck={returnToDeck}
                    onSelectField={(selection) => {
                        if (!spectatorPresentation) setSelectedField(selection)
                    }}
                    onFieldSortingChange={setFieldSorting}
                    onShowHowToPlay={() => setHowToOpen(true)}
                    operation={operation}
                    busy={busy}
                    nowValue={nowValue}
                />
                <TricksHud onHeaderHeightChange={setHeaderBottom} onToggleAdminStats={isAdmin ? () => setAdminStatsOpen((open) => !open) : undefined} adminStatsOpen={adminStatsOpen} onShowKnowledge={() => setKnowledgeOpen(true)} spectatorMode={spectatorMode} highlightedPlayer={spectatorPresentation?.blinking ? spectatorPresentation.item.log.actor_name : ""} onToggleSpectator={() => changeSpectatorMode(!spectatorMode)}
                    accessAction={spectatorMode && !me && status !== "loading" && (
                        authenticated
                            ? <Button variant="contained" size="large" data-tricks-info-join onClick={join} disabled={busy || !canJoin} style={{padding: "14px 28px", fontSize: 18, minWidth: 200, color: "#fff"}}>参加する</Button>
                            : <Button component={Link} variant="contained" size="large" data-tricks-info-login href="/auth/login" style={{padding: "14px 28px", fontSize: 18, minWidth: 200, color: "#fff"}}>ログインして参加</Button>
                    )} onSelectHolder={(card) => {
                    if (spectatorPresentation) return
                    setSelectedField(null)
                    setSelectedHolder(card)
                }} state={state} stagingMode={stagingMode} historicalHolderCounts={holderCatalog?.historical_counts || {}} usersById={usersById} currentUserId={userId} nowValue={nowValue} debugOpen={debugOpen} onToggleDebug={isDebugAdmin ? () => setDebugOpen((open) => !open) : undefined} />
                {spectatorMode && spectatorPresentation && <TricksSpectatorPanel
                    key={spectatorPresentation.item.card.event_card_id}
                    presentation={spectatorPresentation} tricksApi={tricksApi} usersById={usersById}
                />}
                {eventEnded && <TricksCollectedResults cards={collected} usersById={usersById} />}
                {isAdmin && adminStatsOpen && <TricksAdminStats stats={collectedAdminStats} usersById={usersById} onClose={closeAdminStats} />}
                {isDebugAdmin && <TricksDebugPanel open={debugOpen} onClose={() => setDebugOpen(false)} state={state} busy={busy || spectatorMode} onOperation={runDebugOperation} />}
                <div
                    style={{
                        position: "absolute",
                        left: 24,
                        top: 122,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        zIndex: 2,
                    }}
                >
                    {(message || error || isLoading) && (
                        <div style={{fontSize: 13, color: error ? "#ff8a8a" : "#ffcf6e"}}>
                            {isLoading ? "読み込み中..." : message || tricksErrorMessage(error)}
                        </div>
                    )}
                </div>
                {selectedCard && !postOpen && !spectatorPresentation && (
                    <div
                        role="presentation"
                        onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            closeFieldDetail()
                        }}
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 45,
                            background: "transparent",
                            pointerEvents: "auto",
                        }}
                    />
                )}
                {selectedCard && !postOpen && !spectatorPresentation && (
                    <TricksFieldDetailPanel
                        className={`tricks-field-detail-panel-${fieldSide}`}
                        scoreType={selectedCard?.score_type}
                        rankings={rankings}
                        taker={selectedCard.taker}
                        takerRemainder={selectedCard.provisional_taker_remainder}
                        usersById={usersById}
                        summary={
                            <>
                                トリック {Number(selectedCard.stack_count || 0) + tricksStackBonus(selectedCard.rarity, selectedCard.stack_count)}
                                {tricksStackBonus(selectedCard.rarity, selectedCard.stack_count) > 0 && `（レア度ボーナス ${tricksStackBonus(selectedCard.rarity, selectedCard.stack_count)}）`}
                                {" / "}支払い総額 {selectedCard.paid_points_total ?? 0}P
                                {" / "}参加者 {selectedCard.participant_count ?? 0}人
                                {" / "}あなたの投稿コスト {selectedCard.my_initial_post_cost ?? 0}P

                            </>
                        }
                        onClose={closeFieldDetail}
                        style={{
                            position: "absolute",
                            zIndex: 50,
                            width: fieldDetailModalWidth,
                            left: fieldPanelStyle.left,
                            top: fieldPanelStyle.top,
                            transformOrigin: fieldPanelStyle.transformOrigin,
                            pointerEvents: "auto",
                        }}
                    >
                        <Button
                            data-tricks-post-button
                            variant="contained"
                            onClick={spectatorMode ? requestSpectatorExit : openPostModal}
                            disabled={busy || (!spectatorMode && (!selectedCard?.stage_id || !operation.available || !me))}
                        >
                            投稿
                        </Button>
                        <Button
                            data-tricks-extend-button
                            variant="outlined"
                            onClick={() => extendCard(selectedCard)}
                            disabled={spectatorMode || busy || !me || Number(me.draw_points) < 1 || !selectedCard.my_can_extend}
                        >
                            延長
                        </Button>
                        {isAdmin && (
                            <>
                                <Button onClick={() => openRuling("rule")} disabled={spectatorMode || busy || !operation.available}>ルール変更</Button>
                                <Button color="warning" onClick={() => openRuling("reset")} disabled={spectatorMode || busy || !operation.available}>リセット</Button>
                            </>
                        )}
                        {isDebugAdmin && (
                            <Button
                                color="warning"
                                onClick={() => debugCollect(selectedCard)}
                                disabled={spectatorMode || busy}
                            >
                                即時回収
                            </Button>
                        )}
                    </TricksFieldDetailPanel>
                )}
                {isAdmin && ruling && (
                    <Dialog open onClose={() => !busy && setRuling(null)} maxWidth="sm" fullWidth style={{zIndex: 1600}} PaperProps={{style: {backgroundColor: "#fff", color: "#111"}}}>
                        <form onSubmit={submitRuling}>
                            <DialogTitle>{ruling.type === "reset" ? "ランキングをリセットしますか？" : "ルール変更"}</DialogTitle>
                            <DialogContent style={{display: "flex", flexDirection: "column", gap: 16, paddingTop: 12}}>
                                <div>{ruling.card.title}</div>
                                {ruling.type === "reset" ? (
                                    <div>有効投稿をすべて削除します。支払い履歴と総還元ポイントは保持され、次の投稿も有料です。現在の参加者に5Pを配布し、次の給付・徴収タイミングの徴収を免除します。</div>
                                ) : [
                                    ["title", "ステージ名"], ["rule_name", "ルール名"], ["text", "ルール本文"], ["difficulty", "難易度（1〜5）"],
                                ].map(([key, label]) => (
                                    <TextField key={key} label={label} required value={ruling.values[key]} disabled={busy}
                                        multiline={key === "text"} minRows={key === "text" ? 5 : undefined}
                                        type={key === "difficulty" ? "number" : "text"}
                                        inputProps={key === "difficulty" ? {min: 1, max: 5} : {maxLength: key === "text" ? 10000 : 255}}
                                        onChange={(event) => setRuling({...ruling, values: {...ruling.values, [key]: event.target.value}})} />
                                ))}
                                {rulingError && <div role="alert">{rulingError}</div>}
                            </DialogContent>
                            <DialogActions>
                                <Button disabled={busy} onClick={() => setRuling(null)}>キャンセル</Button>
                                <Button type="submit" variant="contained" disabled={busy}>{ruling.type === "reset" ? "リセットする" : "変更を保存"}</Button>
                            </DialogActions>
                        </form>
                    </Dialog>
                )}
                {postingCard && postOpen && (
                    <RecordForm
                        info={{
                            stage_id: postingCard.stage_id,
                            tricks_event_id: state?.tournament?.event_id,
                            category_name: state?.tournament?.title,
                            score_type: postingCard.score_type || "points",
                            stage_name: postingCard.stage_name || postingCard.title,
                            eng_stage_name: postingCard.eng_stage_name || postingCard.title,
                        }}
                        rule={state?.tournament?.event_id}
                        mode="create"
                        open={postOpen}
                        setOpen={setPostModalOpen}
                        handleClose={closePostModal}
                        onPosted={handlePosted}
                    />
                )}
                {accessGateOpen && (
                    <>
                        <div
                            data-tricks-access-backdrop
                            aria-hidden="true"
                            style={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 35,
                                background: "rgba(3, 6, 12, 0.62)",
                                pointerEvents: "auto",
                            }}
                        />
                        <div
                            data-tricks-access-message
                            style={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 36,
                                display: "grid",
                                placeItems: "center",
                                padding: 24,
                                pointerEvents: "none",
                            }}
                        >
                            <div style={{background: "var(--color-bg-base)", color: "var(--color-text-base)", padding: 24, borderRadius: 10, fontSize: "clamp(18px, 2.2vw, 30px)", fontWeight: 800, textAlign: "center"}}>
                                <div>{authenticated ? `${tournamentTitle}に参加` : "このイベントへの参加にはログインが必要です"}</div>
                                <div style={{display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, marginTop: 12}}>
                                    {authenticated
                                        ? <button type="button" onClick={join} disabled={busy || !canJoin} style={{...accessActionStyle, color: "#8ef0b2"}}>参加する</button>
                                        : <Link href="/auth/login" style={{...accessActionStyle, color: "#8db4ff"}}>ログインする</Link>}
                                    <button type="button" data-tricks-start-spectating onClick={() => changeSpectatorMode(true)}
                                        style={{...accessActionStyle, color: "#8ef0b2"}}>観戦する</button>
                                </div>
                                {message && authenticated && (
                                    <div role="alert" data-tricks-join-error style={{marginTop: 14, fontSize: 15, color: "#ff9c9c"}}>
                                        {message}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
                {selectedHolder && (
                    <div data-tricks-holder-popup onClick={() => setSelectedHolder(null)} style={{position: "fixed", inset: 0, zIndex: 400, display: "grid", placeItems: "center", background: "transparent"}}>
                        <TricksFieldDetailPanel
                            scoreType={selectedHolder.score_type}
                            rankings={holderRankings}
                            usersById={usersById}
                            summary={`#${selectedHolder.stage_id} ${selectedHolder.title || ""}（${selectedHolder.rule_name || ""}）`}
                            onClose={() => setSelectedHolder(null)}
                            style={{position: "fixed", left: Math.max(16, Math.min(selectedHolder.anchor?.left ?? 16, (typeof window !== "undefined" ? window.innerWidth : 1024) - 576)), top: selectedHolder.anchor?.top ?? 150, width: "min(560px, calc(100vw - 32px))"}}
                        />
                    </div>
                )}
                <Dialog
                    open={howToOpen}
                    onClose={() => setHowToOpen(false)}
                    maxWidth={false}
                    PaperProps={{"aria-label": "遊び方", style: {width: "min(1200px, calc(100vw - 32px))", maxWidth: "calc(100vw - 32px)", height: "calc(100dvh - 32px)", maxHeight: "calc(100dvh - 32px)", margin: 16, background: "var(--color-bg-base)", backgroundImage: "none"}}}
                >
                    <DialogContent style={{display: "flex", flexDirection: "column", padding: 16, overflow: "hidden"}}>
                        <iframe
                            src="/limited/tricks/limited_19_manual.pdf#view=FitH"
                            title="第19回期間限定ランキング 遊び方"
                            style={{display: "block", width: "100%", flex: 1, minHeight: 0, border: 0, background: "#fff"}}
                        />
                        <div style={{display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16, marginTop: 12, flexShrink: 0}}>
                            <a href="/limited/tricks/limited_19_manual.pdf" target="_blank" rel="noopener noreferrer" style={{color: "var(--color-text-base)", fontSize: 14}}>PDFを別タブで開く</a>
                            <Button variant="contained" onClick={() => setHowToOpen(false)}>閉じる</Button>
                        </div>
                    </DialogContent>
                </Dialog>
                <Dialog open={spectatorExitConfirm} onClose={() => setSpectatorExitConfirm(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>観戦モードを終了しますか？</DialogTitle>
                    <DialogActions>
                        <Button onClick={() => setSpectatorExitConfirm(false)}>キャンセル</Button>
                        <Button variant="contained" onClick={() => changeSpectatorMode(false)}>終了する</Button>
                    </DialogActions>
                </Dialog>
                <Dialog open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} maxWidth="md" fullWidth
                    PaperProps={{style: {background: "var(--color-bg-base)", color: "var(--color-text-base)", backgroundImage: "none"}}}>
                    <DialogTitle>ユーザーマニュアル</DialogTitle>
                    <DialogContent><TricksManualContent content={manualContent} /></DialogContent>
                    <DialogActions><Button onClick={() => setKnowledgeOpen(false)}>閉じる</Button></DialogActions>
                </Dialog>
                <style jsx global>{`
                    [data-tricks-root] { color: var(--color-text-base); color-scheme: light; }
                    [data-theme="dark"] [data-tricks-root] { color-scheme: dark; }
                    [data-tricks-root] .MuiButton-root { color: var(--color-text-base); }
                    [data-tricks-root] .MuiButton-root.Mui-disabled { color: var(--color-muted-text); }
                    @keyframes tricksFieldPanelOpenRight {
                        0% { transform: scaleX(0); opacity: 0.5; }
                        42% { transform: scaleX(1); opacity: 1; }
                        100% { transform: scaleX(1); opacity: 1; }
                    }
                    .tricks-field-detail-panel {
                        background: var(--color-bg-base);
                        border: 1px solid var(--color-border-base);
                        border-radius: 14px;
                        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
                        color: var(--color-text-base);
                        overflow: hidden;
                        animation: tricksFieldPanelOpenRight 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
                    }
                    .tricks-field-detail-panel .record-container,
                    .tricks-field-detail-panel .record-container div,
                    .tricks-field-detail-panel .record-container span,
                    .tricks-field-detail-panel .record-container time,
                    .tricks-field-detail-panel .record-container svg {
                        color: var(--color-text-base);
                    }
                    .tricks-field-detail-panel .record-container a {
                        color: var(--color-text-base);
                        text-decoration-color: currentColor;
                    }
                    .tricks-field-detail-panel .record-container .compare-type {
                        color: var(--color-compare);
                    }
                    @media (max-width: 900px) {
                        .tricks-field-detail-panel {
                            left: 16px !important;
                            right: 16px !important;
                            top: 118px !important;
                            width: auto !important;
                        }
                    }
                `}</style>
            </div>
        </>
    )
}

export async function getServerSideProps({req, res, resolvedUrl}) {
    const {hasStagingAccess, stagingAccessEnabled, stagingAccessReady, STAGING_CLOSE_AT} = await import("../../../lib/tricks/stagingAccess")
    const params = new URL(resolvedUrl, "http://localhost").searchParams
    const bareIds = [...params.entries()].filter(([key, value]) => /^\d+$/.test(key) && value === "")
    const requested = params.get("event_id") || bareIds[0]?.[0]
    if (bareIds.length > 1 || (requested && (!/^\d+$/.test(requested) || Number(requested) < 1 || Number(requested) > 2147483647))) return {notFound: true}
    let eventId = requested ? Number(requested) : null
    try {
        const base = process.env.TRICKS_LARAVEL_API_BASE || "http://laravel:8000/api"
        const response = await fetch(`${base}/tricks/tournament${eventId ? `?event_id=${eventId}` : ""}`, {signal: AbortSignal.timeout(5000)})
        if (response.status === 404) return {notFound: true}
        if (response.ok) eventId = (await response.json()).event_id
    } catch {
        // 接続障害の詳細はクライアント側のstate APIエラーで表示する
    }
    res.setHeader("Cache-Control", "no-store")
    const {readFile} = await import("fs/promises")
    const manualContent = await readFile(`${process.cwd()}/pages/keyword/tricks-manual.md`, "utf8")
    const props = {eventId, manualContent, stagingGate: null}
    if (!stagingAccessEnabled(eventId) || Date.now() >= STAGING_CLOSE_AT) return {props}
    return {props: {...props, stagingGate: {
        allowed: hasStagingAccess(req, Date.now(), eventId),
        ready: stagingAccessReady(),
        closeAt: STAGING_CLOSE_AT,
    }}}
}

export default function TricksPage({eventId, manualContent, stagingGate}) {
    const [password, setPassword] = useState("")
    const [gateMessage, setGateMessage] = useState("")
    const [gateBusy, setGateBusy] = useState(false)

    useEffect(() => {
        if (!stagingGate) return undefined
        const delay = Math.max(0, stagingGate.closeAt - Date.now())
        const timer = window.setTimeout(() => window.location.reload(), delay)
        return () => window.clearTimeout(timer)
    }, [stagingGate])

    const unlock = async (event) => {
        event.preventDefault()
        setGateBusy(true)
        setGateMessage("")
        try {
            const response = await fetch("/api/tricks-access", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({password}),
            })
            const body = await response.json()
            if (!response.ok) throw new Error(body.message || "認証に失敗しました")
            window.location.reload()
        } catch (error) {
            setGateMessage(error.message)
            setGateBusy(false)
        }
    }

    if (!stagingGate) return <TricksGamePage key={eventId} eventId={eventId} manualContent={manualContent} />
    if (stagingGate.allowed) return <TricksGamePage key={eventId} eventId={eventId} manualContent={manualContent} stagingMode />

    return <>
        <Head><title>テスト大会</title></Head>
        <main style={{minHeight: "70vh", display: "grid", placeItems: "center"}}>
            <form onSubmit={unlock} style={{display: "grid", gap: 16, width: "min(360px, 90vw)"}}>
                <h1>テスト大会</h1>
                {stagingGate.ready ? <>
                    <label htmlFor="tricks-test-password">参加パスワード</label>
                    <input id="tricks-test-password" type="password" autoComplete="off" required value={password}
                           onChange={(event) => setPassword(event.target.value)} />
                    <Button type="submit" variant="contained" disabled={gateBusy}>大会へ進む</Button>
                </> : <p>大会の公開設定が未完了です。</p>}
                {gateMessage && <p role="alert">{gateMessage}</p>}
            </form>
        </main>
    </>
}

TricksPage.disableLayout = true

const accessActionStyle = {
    appearance: "none",
    border: 0,
    background: "transparent",
    padding: "0 0.22em",
    font: "inherit",
    fontWeight: 800,
    textDecoration: "underline",
    cursor: "pointer",
    pointerEvents: "auto",
}
