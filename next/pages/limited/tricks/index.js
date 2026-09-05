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
import {postTricks, tricksApi, tricksFetcher, tricksOperationState} from "../../../lib/tricks"
import RecordForm from "../../../components/modal/RecordForm"
import TricksCollectedResults from "../../../components/tricks/TricksCollectedResults"
import TricksDebugPanel from "../../../components/tricks/TricksDebugPanel"
import TricksHud from "../../../components/tricks/TricksHud"
import Record from "../../../components/record/Record"

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
        logs: state.logs,
    })
}

export default function TricksPage() {
    const {data: session, status} = useSession()
    const userId = session?.user?.userId || session?.user?.id
    const [message, setMessage] = useState("")
    const [busy, setBusy] = useState(false)
    const [selectedField, setSelectedField] = useState(null)
    const [postingCard, setPostingCard] = useState(null)
    const [postOpen, setPostOpen] = useState(false)
    const [loginRequiredOpen, setLoginRequiredOpen] = useState(false)
    const [fieldSorting, setFieldSorting] = useState(false)
    const [nowValue, setNowValue] = useState(Date.now())
    const clockInitializedRef = useRef(false)
    const debugMetricsRef = useRef({stateFetchCount: 0, stateChangeCount: 0})
    const collectingExpiredRef = useRef(false)
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
    const showLoginRequired = useCallback(() => {
        setLoginRequiredOpen(true)
    }, [])
    const closeLoginRequired = useCallback(() => {
        setLoginRequiredOpen(false)
    }, [])
    const runAction = useCallback(async (action, options = {}) => {
        if (!userId) {
            showLoginRequired()
            return false
        }
        setBusy(true)
        setMessage("")
        try {
            await action()
            await mutate()
            if (options.collected) await mutateCollected()
            return true
        } catch (e) {
            setMessage(e.message || "操作に失敗しました")
            return false
        } finally {
            setBusy(false)
        }
    }, [mutate, mutateCollected, showLoginRequired, userId])

    const join = () => runAction(() => postTricks(tricksApi.join))
    const draw = useCallback(() => runAction(() => postTricks(tricksApi.draw)), [runAction])
    const take = useCallback((card) => {
        if (!card?.id) return
        if (!window.confirm(`「${card.title || "このカード"}」を場に出します。手札${operation.handCount}枚を使用しますか？`)) {
            return false
        }

        return runAction(() => postTricks(tricksApi.take(card.id)))
    }, [operation.handCount, runAction])
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
        if (!expiredFieldKey || collectingExpiredRef.current) return undefined
        let cancelled = false
        collectingExpiredRef.current = true
        postTricks(tricksApi.collectExpired)
            .then(async () => {
                if (!cancelled) await mutate()
            })
            .catch((collectionError) => {
                if (!cancelled) setMessage(collectionError.message || "期限切れカードの回収に失敗しました")
            })
            .finally(() => {
                collectingExpiredRef.current = false
            })

        return () => {
            cancelled = true
        }
    }, [expiredFieldKey, mutate])

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
                <title>第19回期間限定ランキング - ピクチャレ大会</title>
            </Head>
            <div
                data-tricks-root
                style={{
                    position: "relative",
                    width: "100vw",
                    height: "100vh",
                    minHeight: 720,
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
                    onSelectField={setSelectedField}
                    onFieldSortingChange={setFieldSorting}
                    operation={operation}
                    busy={busy}
                    nowValue={nowValue}
                />
                <Link
                    href="/"
                    style={{
                        position: "absolute",
                        left: 24,
                        top: 14,
                        zIndex: 3,
                        color: "#9fb6d8",
                        fontSize: 13,
                        textDecoration: "none",
                    }}
                >
                    ホームに戻る
                </Link>
                <TricksHud state={state} usersById={usersById} dimmed={Boolean(selectedCard) && !postOpen} currentUserId={userId} nowValue={nowValue} />
                {eventEnded && <TricksCollectedResults cards={collected} usersById={usersById} />}
                {isDebugAdmin && <TricksDebugPanel state={state} busy={busy} onOperation={runDebugOperation} />}
                <div
                    style={{
                        position: "absolute",
                        left: 24,
                        top: 122,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        zIndex: 2,
                        opacity: selectedCard && !postOpen ? 0.35 : 1,
                    }}
                >
                    {authenticated && !me && (
                        <button
                            type="button"
                            onClick={join}
                            disabled={busy || !canJoin}
                            style={{
                                border: "1px solid #6edb9a",
                                background: canJoin ? "#1f7a43" : "#253044",
                                color: "#fff",
                                padding: "10px 16px",
                                cursor: !busy && canJoin ? "pointer" : "not-allowed",
                            }}
                        >
                            参加
                        </button>
                    )}
                    {!me && (
                        <div style={{fontSize: 14, color: "#d8e0ef"}}>
                            {status === "loading"
                                ? "参加状況を確認中"
                                : authenticated
                                    ? "未参加"
                                    : "ログインが必要です"}
                        </div>
                    )}
                    {(message || error || isLoading) && (
                        <div style={{fontSize: 13, color: error ? "#ff8a8a" : "#ffcf6e"}}>
                            {isLoading ? "読み込み中..." : message || error?.message}
                        </div>
                    )}
                </div>
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
                            zIndex: 20,
                            background: "transparent",
                            pointerEvents: "auto",
                        }}
                    />
                )}
                {selectedCard && !postOpen && (
                    <div
                        className={`tricks-field-detail-panel tricks-field-detail-panel-${fieldSide}`}
                        onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        onMouseUp={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        style={{
                            position: "absolute",
                            zIndex: 30,
                            width: fieldDetailModalWidth,
                            left: fieldPanelStyle.left,
                            top: fieldPanelStyle.top,
                            transformOrigin: fieldPanelStyle.transformOrigin,
                            pointerEvents: "auto",
                        }}
                    >
                        <div style={{padding: 22, minHeight: 180, maxHeight: 390, overflowY: "auto"}}>
                            <div style={{fontSize: 12, color: "#64748b", marginBottom: 10}}>
                                初投稿コスト {selectedCard.my_initial_post_cost ?? 0}P
                                {selectedCard.my_initial_payment_recorded ? "（支払記録済み）" : ""}
                                {" / "}参加者 {selectedCard.participant_count ?? 0}人
                                {" / "}支払総額 {selectedCard.paid_points_total ?? 0}P
                            </div>
                            {!rankings && <div style={{color: "#4b5563"}}>読み込み中...</div>}
                            {rankings && rankings.length === 0 && (
                                <div style={{color: "#4b5563"}}>投稿はまだありません</div>
                            )}
                            {rankings && rankings.length > 0 && (
                                <div style={{display: "grid", gap: 8}}>
                                    {rankings.map((row) => (
                                        <Record
                                            key={row.unique_id || row.post_id || `${row.post_rank}-${row.user_id}`}
                                            mini
                                            showMiniRps
                                            swapScoreRpsLabel
                                            data={{
                                                ...row,
                                                user_name: usersById[row.user_id]?.name || row.user_name || row.user_id,
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 18px 16px", borderTop: "1px solid #e5e7eb"}}>
                            <Button onClick={closeFieldDetail}>閉じる</Button>
                            <Button
                                variant="contained"
                                onClick={openPostModal}
                                disabled={busy || !selectedCard?.stage_id || !operation.available || !me}
                            >
                                投稿
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
                        </div>
                    </div>
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
                <Dialog open={loginRequiredOpen} onClose={closeLoginRequired}>
                    <Box style={{width: "min(600px, 86vw)"}}>
                        <DialogContent>
                            <Link href="/auth/login">イベントに参加するにはログインする必要があります</Link>
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

TricksPage.disableLayout = true
