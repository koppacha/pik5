import Head from "next/head"
import dynamic from "next/dynamic"
import useSWR from "swr"
import {useSession} from "next-auth/react"
import {useCallback, useEffect, useMemo, useState} from "react"
import Dialog from "@mui/material/Dialog"
import DialogActions from "@mui/material/DialogActions"
import DialogContent from "@mui/material/DialogContent"
import DialogTitle from "@mui/material/DialogTitle"
import Button from "@mui/material/Button"
import {postTricks, tricksApi, tricksFetcher} from "../../../lib/tricks"
import RecordForm from "../../../components/modal/RecordForm"
import TricksHud from "../../../components/tricks/TricksHud"

const TricksGame = dynamic(() => import("../../../components/tricks/TricksGame"), {
    ssr: false,
})

const fieldDetailCardWidth = 295
const fieldDetailGap = 28
const fieldDetailModalWidth = 560
const fieldDetailTotalWidth = fieldDetailCardWidth + fieldDetailGap + fieldDetailModalWidth

export default function TricksPage() {
    const {data: session, status} = useSession()
    const userId = session?.user?.userId
    const [message, setMessage] = useState("")
    const [busy, setBusy] = useState(false)
    const [selectedField, setSelectedField] = useState(null)
    const [postOpen, setPostOpen] = useState(false)
    const stateKey = useMemo(() => tricksApi.state(userId), [userId])
    const {data: state, error, mutate, isLoading} = useSWR(stateKey, tricksFetcher, {
        refreshInterval: 1000,
        revalidateOnFocus: true,
    })
    const {
        data: rankings,
        mutate: mutateRankings
    } = useSWR(selectedField?.id ? tricksApi.scores(selectedField.id) : null, tricksFetcher, {
        refreshInterval: selectedField?.id ? 3000 : 0,
        revalidateOnFocus: true,
    })

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
        await Promise.all([mutate(), mutateRankings()])
    }
    const closeFieldDetail = useCallback(() => {
        setPostOpen(false)
        setSelectedField(null)
    }, [])

    useEffect(() => {
        if (!state?.tournament?.available) return undefined

        const id = setInterval(async () => {
            try {
                await postTricks(tricksApi.collectExpired, userId)
                await mutate()
            } catch {
                // ポーリング処理なので、画面操作を阻害しない。
            }
        }, 1000)

        return () => clearInterval(id)
    }, [mutate, state?.tournament?.available, userId])

    useEffect(() => {
        if (!selectedField || !state?.field) return
        const fresh = state.field.find((card) => card.id === selectedField.id)
        if (!fresh || (fresh.limit_at && new Date(fresh.limit_at).getTime() <= Date.now())) {
            setSelectedField(null)
        }
    }, [selectedField, state?.field])

    return (
        <>
            <Head>
                <title>第19回期間限定ランキング - トリックテイキング制</title>
            </Head>
            <div
                style={{
                    position: "relative",
                    width: "100vw",
                    height: "calc(100vh - 64px)",
                    minHeight: 1040,
                    marginLeft: "calc(50% - 50vw)",
                    marginRight: "calc(50% - 50vw)",
                    background: "#0c1016",
                    color: "#fff",
                    overflow: "hidden",
                }}
            >
                <TricksGame
                    state={state}
                    selectedFieldId={selectedField?.id}
                    onDraw={draw}
                    onTake={take}
                    onSelectField={setSelectedField}
                />
                <TricksHud state={state} />
                <div
                    style={{
                        position: "absolute",
                        left: 330,
                        top: 72,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        zIndex: 2,
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
                {selectedField && !postOpen && (
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
                            position: "fixed",
                            inset: 0,
                            zIndex: 1290,
                            background: "transparent",
                            pointerEvents: "auto",
                        }}
                    />
                )}
                <Dialog
                    open={Boolean(selectedField)}
                    onClose={closeFieldDetail}
                    hideBackdrop
                    PaperProps={{
                        style: {
                            width: fieldDetailModalWidth,
                            maxWidth: fieldDetailModalWidth,
                            margin: 0,
                            position: "fixed",
                            left: `calc(50vw - ${fieldDetailTotalWidth / 2}px + ${fieldDetailCardWidth + fieldDetailGap}px)`,
                            top: 214,
                        },
                    }}
                    sx={{
                        pointerEvents: "none",
                        "& .MuiDialog-container": {
                            pointerEvents: "none",
                            alignItems: "flex-start",
                            justifyContent: "flex-start",
                        },
                        "& .MuiPaper-root": {
                            pointerEvents: "auto",
                        },
                    }}
                >
                    <DialogTitle>
                        {selectedField?.title || "ミニランキング"}
                    </DialogTitle>
                    <DialogContent>
                        {selectedField && (
                            <>
                                {!rankings && <div style={{color: "#4b5563"}}>読み込み中...</div>}
                                {rankings && rankings.length === 0 && (
                                    <div style={{color: "#4b5563"}}>投稿はまだありません</div>
                                )}
                                {rankings && rankings.length > 0 && (
                                    <table style={{width: "100%", borderCollapse: "collapse", color: "#111827"}}>
                                        <thead>
                                        <tr>
                                            <th style={{textAlign: "left", borderBottom: "1px solid #d1d5db", padding: 8}}>順位</th>
                                            <th style={{textAlign: "left", borderBottom: "1px solid #d1d5db", padding: 8}}>ユーザー</th>
                                            <th style={{textAlign: "right", borderBottom: "1px solid #d1d5db", padding: 8}}>スコア</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {rankings.map((row) => (
                                            <tr key={`${row.rank}-${row.user_id}`}>
                                                <td style={{padding: 8, borderBottom: "1px solid #e5e7eb"}}>{row.rank}</td>
                                                <td style={{padding: 8, borderBottom: "1px solid #e5e7eb"}}>{row.user_id}</td>
                                                <td style={{padding: 8, borderBottom: "1px solid #e5e7eb", textAlign: "right"}}>{row.score}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                )}
                            </>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeFieldDetail}>閉じる</Button>
                        <Button
                            variant="contained"
                            onClick={() => setPostOpen(true)}
                            disabled={!selectedField || !me}
                        >
                            投稿
                        </Button>
                    </DialogActions>
                </Dialog>
                {selectedField && (
                    <RecordForm
                        info={{stage_id: selectedField.stage_id}}
                        rule={1}
                        mode="create"
                        open={postOpen}
                        setOpen={setPostOpen}
                        handleClose={() => setPostOpen(false)}
                        onPosted={handlePosted}
                    />
                )}
            </div>
        </>
    )
}
