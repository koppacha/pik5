import Head from "next/head"
import Link from "next/link"
import dynamic from "next/dynamic"
import useSWR from "swr"
import {useSession} from "next-auth/react"
import {useCallback, useEffect, useMemo, useState} from "react"
import Button from "@mui/material/Button"
import {postTricks, tricksApi, tricksFetcher} from "../../../lib/tricks"
import RecordForm from "../../../components/modal/RecordForm"
import TricksHud from "../../../components/tricks/TricksHud"
import Record from "../../../components/record/Record"

const TricksGame = dynamic(() => import("../../../components/tricks/TricksGame"), {
    ssr: false,
})

const fieldDetailCardWidth = 295
const fieldDetailGap = 28
const fieldDetailModalWidth = 560
const fieldDetailDefaultTop = 150

export default function TricksPage() {
    const {data: session, status} = useSession()
    const userId = session?.user?.userId
    const [message, setMessage] = useState("")
    const [busy, setBusy] = useState(false)
    const [selectedField, setSelectedField] = useState(null)
    const [postingCard, setPostingCard] = useState(null)
    const [postOpen, setPostOpen] = useState(false)
    const [fieldSorting, setFieldSorting] = useState(false)
    const [sortTick, setSortTick] = useState(0)
    const stateKey = useMemo(() => tricksApi.state(userId), [userId])
    const selectedCard = selectedField?.card || selectedField
    const fieldAnchor = selectedField?.anchor
    const fieldSide = selectedField?.side || "right"
    const {data: state, error, mutate, isLoading} = useSWR(stateKey, tricksFetcher, {
        refreshInterval: fieldSorting ? 0 : 1000,
        revalidateOnFocus: true,
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
    const canJoin = status === "authenticated" && !me && state?.tournament?.available
    const runAction = useCallback(async (action) => {
        if (!userId) {
            setMessage("参加・ドローにはログインが必要です")
            return
        }
        setBusy(true)
        setMessage("")
        try {
            await action()
            await mutate()
        } catch (e) {
            setMessage(e.message || "操作に失敗しました")
        } finally {
            setBusy(false)
        }
    }, [mutate, userId])

    const join = () => runAction(() => postTricks(tricksApi.join, userId))
    const draw = useCallback(() => runAction(() => postTricks(tricksApi.draw, userId)), [runAction, userId])
    const take = useCallback((card) => runAction(async () => {
        if (!card?.id) return
        await postTricks(tricksApi.take(card.id), userId)
    }), [runAction, userId])
    const handlePosted = async ({stageId}) => {
        await postTricks(tricksApi.recordPosted, userId, {stage_id: stageId})
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
        if (!state?.tournament?.available) return undefined

        const id = setInterval(async () => {
            if (fieldSorting) return
            setSortTick(Date.now())
            try {
                const result = await postTricks(tricksApi.collectExpired, userId)
                if (result?.collected > 0) {
                    await mutate()
                }
            } catch {
                // ポーリング処理なので、画面操作を阻害しない。
            }
        }, 5000)

        return () => clearInterval(id)
    }, [fieldSorting, mutate, state?.tournament?.available, userId])

    useEffect(() => {
        if (!selectedCard || !state?.field) return
        const fresh = state.field.find((card) => card.id === selectedCard.id)
        if (!fresh || (fresh.limit_at && new Date(fresh.limit_at).getTime() <= Date.now())) {
            setSelectedField(null)
        }
    }, [selectedCard, state?.field])

    return (
        <>
            <Head>
                <title>第19回期間限定ランキング - ピクチャレ大会</title>
            </Head>
            <div
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
                    sortTick={sortTick}
                    onDraw={draw}
                    onTake={take}
                    onSelectField={setSelectedField}
                    onFieldSortingChange={setFieldSorting}
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
                <TricksHud state={state} dimmed={Boolean(selectedCard) && !postOpen} />
                <div
                    style={{
                        position: "absolute",
                        left: 330,
                        top: 72,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        zIndex: 2,
                        opacity: selectedCard && !postOpen ? 0.35 : 1,
                    }}
                >
                    {!me && (
                        <button
                            type="button"
                            onClick={join}
                            disabled={!canJoin || busy}
                            style={{
                                border: "1px solid #6edb9a",
                                background: canJoin ? "#1f7a43" : "#253044",
                                color: "#fff",
                                padding: "10px 16px",
                                cursor: canJoin && !busy ? "pointer" : "not-allowed",
                            }}
                        >
                            参加
                        </button>
                    )}
                    <div style={{fontSize: 14, color: "#d8e0ef"}}>
                        {me ? `DP ${me.draw_points} / H ${me.card_count}` : "未参加"}
                    </div>
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
                                disabled={!selectedCard?.stage_id}
                            >
                                投稿
                            </Button>
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
                <style jsx global>{`
                    @keyframes tricksFieldPanelOpenRight {
                        0% { transform: scaleX(0); opacity: 0.5; }
                        42% { transform: scaleX(1); opacity: 1; }
                        100% { transform: scaleX(1); opacity: 1; }
                    }
                    .tricks-field-detail-panel {
                        background: #ffffff;
                        border: 1px solid #d1d5db;
                        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
                        color: #111827;
                        overflow: hidden;
                        animation: tricksFieldPanelOpenRight 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
                    }
                `}</style>
            </div>
        </>
    )
}

TricksPage.disableLayout = true
