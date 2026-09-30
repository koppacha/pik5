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
import {postTricks, tricksApi, tricksFetcher, tricksOperationState, tricksStackBonus} from "../../../lib/tricks"
import RecordForm from "../../../components/modal/RecordForm"
import TricksCollectedResults from "../../../components/tricks/TricksCollectedResults"
import TricksDebugPanel from "../../../components/tricks/TricksDebugPanel"
import TricksFieldDetailPanel from "../../../components/tricks/TricksFieldDetailPanel"
import TricksHud from "../../../components/tricks/TricksHud"

const TricksGame = dynamic(() => import("../../../components/tricks/TricksLayeredGame"), {
    ssr: false,
})

const fieldDetailCardWidth = 295
const fieldDetailGap = 28
const fieldDetailModalWidth = 560
const fieldDetailDefaultTop = 150

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

function TricksGamePage({stagingMode = false}) {
    const {data: session, status} = useSession()
    const userId = session?.user?.userId || session?.user?.id
    const [message, setMessage] = useState("")
    const [busy, setBusy] = useState(false)
    const [selectedField, setSelectedField] = useState(null)
    const [postingCard, setPostingCard] = useState(null)
    const [postOpen, setPostOpen] = useState(false)
    const [handDetailOpen, setHandDetailOpen] = useState(false)
    const [debugOpen, setDebugOpen] = useState(false)
    const [howToOpen, setHowToOpen] = useState(false)
    const [fieldSorting, setFieldSorting] = useState(false)
    const [nowValue, setNowValue] = useState(Date.now())
    const clockInitializedRef = useRef(false)
    const debugMetricsRef = useRef({stateFetchCount: 0, stateChangeCount: 0})
    const collectingExpiredRef = useRef(false)
    const processedSubsidySlotRef = useRef(null)
    const subsidyRetryAtRef = useRef(0)
    const subsidyErrorMessageRef = useRef(null)
    const stateKey = tricksApi.state
    const selectedCard = selectedField?.card || selectedField
    const fieldAnchor = selectedField?.anchor
    const fieldSide = selectedField?.side || "right"
    const stateFetcher = useCallback(async (url) => {
        debugMetricsRef.current.stateFetchCount += 1
        return tricksFetcher(url)
    }, [])
    const {data: state, error, mutate, isLoading} = useSWR(stateKey, stateFetcher, {
        refreshInterval: fieldSorting ? 0 : 3000,
        revalidateOnFocus: true,
        keepPreviousData: true,
    })
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
    const {data: collectedAdminStats = []} = useSWR(
        eventEnded && isAdmin && state?.tournament?.event_id ? tricksApi.collectedAdminStats(state.tournament.event_id) : null,
        tricksFetcher,
        {revalidateOnFocus: false}
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
    const fieldPanelStyle = useMemo(() => {
        const anchor = fieldAnchor || {
            x: 24,
            y: fieldDetailDefaultTop,
            width: fieldDetailCardWidth,
            height: 0,
        }
        const left = fieldSide === "left"
            ? Math.max(24, anchor.x - fieldDetailGap - fieldDetailModalWidth)
            : anchor.x + anchor.width + fieldDetailGap
        const top = Math.max(116, Math.min(anchor.y, (typeof window !== "undefined" ? window.innerHeight : 900) - 360))

        return {
            left,
            top,
            transformOrigin: fieldSide === "left" ? "100% 50%" : "0 50%",
        }
    }, [fieldAnchor, fieldSide])

    const me = state?.me
    const authenticated = status === "authenticated" && Boolean(userId)
    const canJoin = authenticated && !me && state?.tournament?.available
    const runAction = useCallback(async (action, options = {}) => {
        if (!userId) {
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
    }, [mutate, mutateCollected, userId])

    const join = async () => {
        const result = await runAction(() => postTricks(tricksApi.join))
        if (result) setHowToOpen(true)
    }
    const draw = useCallback((beforeMutate) => runAction(
        () => postTricks(tricksApi.draw),
        {beforeMutate}
    ), [runAction])
    const returnToDeck = useCallback((card, beforeMutate) => {
        if (!card?.id) return false
        if (!window.confirm(`「${card.title || "このカード"}」を1P消費して山札に戻しますか？`)) {
            return false
        }

        return runAction(
            () => postTricks(tricksApi.returnToDeck(card.id)),
            {beforeMutate}
        )
    }, [runAction])
    const take = useCallback((card) => {
        if (!card?.id) return
        const bonus = Number(card.rarity) >= 2
            ? `\nスタックボーナス：+${tricksStackBonus(card.rarity, operation.handCount)}P`
            : ""
        if (!window.confirm(`「${card.title || "このカード"}」を場に出します。手札${operation.handCount}枚を使用しますか？${bonus}`)) {
            return false
        }

        return runAction(() => postTricks(tricksApi.take(card.id)))
    }, [operation.handCount, runAction])
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
    }, [mutateRankings, runAction])
    const runDebugOperation = useCallback((type, payload = {}) => {
        const urls = {
            freeze: tricksApi.debugTimeFreeze,
            set: tricksApi.debugTimeSet,
            advance: tricksApi.debugTimeAdvance,
            reset: tricksApi.debugTimeReset,
        }

        return runAction(() => postTricks(urls[type], payload), {collected: true})
    }, [runAction])
    const debugCollect = useCallback((card) => {
        return runAction(() => postTricks(tricksApi.debugCollect(card.id)), {collected: true})
    }, [runAction])
    const expiredFieldKey = useMemo(() => {
        return (state?.field || [])
            .filter((card) => card?.limit_at && new Date(card.limit_at).getTime() <= nowValue)
            .map((card) => card.id)
            .join(",")
    }, [nowValue, state?.field])
    const subsidySlotKey = Math.floor(nowValue / (30 * 60 * 1000))
    const cardDetailOpen = Boolean(selectedCard) && !postOpen
    const focusBackdropOpen = handDetailOpen || cardDetailOpen
    const accessGateOpen = Boolean(state) && !me && status !== "loading"
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

    useEffect(() => {
        if (!selectedCard || !state?.field) return
        const fresh = state.field.find((card) => card.id === selectedCard.id)
        if (!fresh || !fresh.limit_at || new Date(fresh.limit_at).getTime() <= nowValue) {
            setSelectedField(null)
        }
    }, [nowValue, selectedCard, state?.field])

    useEffect(() => {
        if (!me || !expiredFieldKey || collectingExpiredRef.current) return undefined
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
    }, [expiredFieldKey, me, mutate])

    useEffect(() => {
        if (!clockInitializedRef.current || !me || !operation.available || processedSubsidySlotRef.current === subsidySlotKey
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
                    subsidyErrorMessageRef.current = tricksErrorMessage(subsidyError, "ポイント給付の確認に失敗しました")
                    setMessage(subsidyErrorMessageRef.current)
                }
            })

        return () => {
            cancelled = true
        }
    }, [me, mutate, nowValue, operation.available, subsidySlotKey])

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
                <title>{stagingMode ? "トリックテイキング制 テスト大会" : "第19回期間限定ランキング"} - ピクチャレ大会</title>
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
                    background: "#0c1016",
                    color: "#fff",
                    overflow: "hidden",
                }}
            >
                <TricksGame
                    state={state}
                    selectedFieldId={selectedCard?.id}
                    usersById={usersById}
                    onDraw={draw}
                    onTake={take}
                    onReturnToDeck={returnToDeck}
                    onSelectField={setSelectedField}
                    onFieldSortingChange={setFieldSorting}
                    onHandSelectionChange={setHandDetailOpen}
                    onShowHowToPlay={() => setHowToOpen(true)}
                    operation={operation}
                    busy={busy}
                    nowValue={nowValue}
                />
                <TricksHud state={state} stagingMode={stagingMode} historicalHolderCounts={holderCatalog?.historical_counts || {}} usersById={usersById} currentUserId={userId} nowValue={nowValue} debugOpen={debugOpen} onToggleDebug={isDebugAdmin ? () => setDebugOpen((open) => !open) : undefined} />
                {eventEnded && <TricksCollectedResults cards={collected} usersById={usersById} adminStats={collectedAdminStats} isAdmin={isAdmin} />}
                {isDebugAdmin && <TricksDebugPanel open={debugOpen} onClose={() => setDebugOpen(false)} state={state} busy={busy} onOperation={runDebugOperation} />}
                <div
                    style={{
                        position: "absolute",
                        left: 24,
                        top: 122,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        zIndex: 2,
                        opacity: focusBackdropOpen ? 0.35 : 1,
                    }}
                >
                    {(message || error || isLoading) && (
                        <div style={{fontSize: 13, color: error ? "#ff8a8a" : "#ffcf6e"}}>
                            {isLoading ? "読み込み中..." : message || tricksErrorMessage(error)}
                        </div>
                    )}
                </div>
                {focusBackdropOpen && (
                    <div
                        data-tricks-focus-backdrop
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 25,
                            background: "rgba(3, 6, 12, 0.58)",
                            pointerEvents: "auto",
                        }}
                    />
                )}
                {selectedCard && !postOpen && (
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
                {selectedCard && !postOpen && (
                    <TricksFieldDetailPanel
                        className={`tricks-field-detail-panel-${fieldSide}`}
                        rankings={rankings}
                        usersById={usersById}
                        summary={
                            <>
                                スタック {selectedCard.stack_count ?? 0}
                                {" / "}支払い総額 {selectedCard.paid_points_total ?? 0}P
                                {" / "}参加者 {selectedCard.participant_count ?? 0}人
                                {" / "}あなたの投稿コスト {selectedCard.my_initial_post_cost ?? 0}P
                                {selectedCard.my_initial_payment_recorded ? "（支払記録済み）" : ""}
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
                            onClick={openPostModal}
                            disabled={busy || !selectedCard?.stage_id || !operation.available || !me}
                        >
                            投稿
                        </Button>
                        <Button
                            data-tricks-extend-button
                            variant="outlined"
                            onClick={() => extendCard(selectedCard)}
                            disabled={busy || !me || Number(me.draw_points) < 1 || !selectedCard.my_can_extend}
                        >
                            延長
                        </Button>
                        {isDebugAdmin && (
                            <Button
                                color="warning"
                                onClick={() => debugCollect(selectedCard)}
                                disabled={busy}
                            >
                                即時回収
                            </Button>
                        )}
                    </TricksFieldDetailPanel>
                )}
                {postingCard && postOpen && (
                    <RecordForm
                        info={{
                            stage_id: postingCard.stage_id,
                            stage_name: postingCard.stage_name || postingCard.title,
                            eng_stage_name: postingCard.eng_stage_name || postingCard.title,
                        }}
                        rule={1}
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
                                zIndex: 100,
                                background: "rgba(3, 6, 12, 0.62)",
                                pointerEvents: "auto",
                            }}
                        />
                        <div
                            data-tricks-access-message
                            style={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 110,
                                display: "grid",
                                placeItems: "center",
                                padding: 24,
                                pointerEvents: "none",
                            }}
                        >
                            <div style={{fontSize: "clamp(18px, 2.2vw, 30px)", fontWeight: 800, textAlign: "center", textShadow: "0 2px 8px #000"}}>
                                {authenticated ? (
                                    <>
                                        {stagingMode ? "トリックテイキング制 テスト大会" : "第19回期間限定ランキング"}に
                                        <button
                                            type="button"
                                            onClick={join}
                                            disabled={busy || !canJoin}
                                            style={{...accessActionStyle, color: "#8ef0b2"}}
                                        >
                                            参加する
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        このイベントに参加するには
                                        <Link href="/auth/login" style={{...accessActionStyle, color: "#8db4ff"}}>ログイン</Link>
                                        が必要です
                                    </>
                                )}
                                {message && authenticated && (
                                    <div role="alert" data-tricks-join-error style={{marginTop: 14, fontSize: 15, color: "#ff9c9c"}}>
                                        {message}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
                <Dialog open={howToOpen} onClose={() => setHowToOpen(false)}>
                    <Box style={{width: "min(720px, 90vw)"}}>
                        <DialogContent style={{fontSize: 15, lineHeight: 1.75}}>
                            <p>期間限定ランキングは、みんなが考えたルールをあなたが選んでみんなで遊ぶイベントです。</p>
                            <ol style={{paddingLeft: 24}}>
                                <li>まずはドローボタンを押してカードを３枚引きましょう。</li>
                                <li>引いたカードから面白そうなルールを選び、場に出しましょう。</li>
                                <li>カウントダウンが終わるまで、みんなでそのカードのルールをひたすらプレイ！（ポイントを使えば延長もできるよ）</li>
                                <li>終了したら、ランキングの順位に応じてドローポイントやランクポイントが還元されます。１位を獲ったらそのカードはあなたのもの！</li>
                                <li>他のみんなが出したカードも積極的にプレイしてポイントを稼ぎ、新たなカードを引いていこう！</li>
                                <li>最終的にランクポイントがもっとも多かった人が勝利となります。</li>
                            </ol>
                            <div style={{display: "flex", justifyContent: "flex-end", marginTop: 18}}>
                                <Button variant="contained" onClick={() => setHowToOpen(false)}>閉じる</Button>
                            </div>
                        </DialogContent>
                    </Box>
                </Dialog>
                <style jsx global>{`
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

export async function getServerSideProps({req, res}) {
    const {hasStagingAccess, stagingAccessEnabled, stagingAccessReady, STAGING_CLOSE_AT} = await import("../../../lib/tricks/stagingAccess")
    if (!stagingAccessEnabled()) return {props: {stagingGate: null}}
    res.setHeader("Cache-Control", "no-store")
    if (Date.now() >= STAGING_CLOSE_AT) return {notFound: true}

    return {props: {stagingGate: {
        allowed: hasStagingAccess(req),
        ready: stagingAccessReady(),
        closeAt: STAGING_CLOSE_AT,
    }}}
}

export default function TricksPage({stagingGate}) {
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

    if (!stagingGate) return <TricksGamePage />
    if (stagingGate.allowed) return <TricksGamePage stagingMode />

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
