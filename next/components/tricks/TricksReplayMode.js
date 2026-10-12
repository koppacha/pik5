import dynamic from "next/dynamic"
import {useCallback, useEffect, useMemo, useRef, useState} from "react"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import TricksManualContent from "./TricksManualContent"
import Button from "@mui/material/Button"
import TricksHud from "./TricksHud"
import TricksFieldDetailPanel from "./TricksFieldDetailPanel"
import TricksReplaySeekBar from "./TricksReplaySeekBar"
import {fetchReplay, formatReplayTimestamp} from "../../lib/tricks/replay"
import {fieldPanelPosition, fieldDetailModalWidth} from "../../lib/tricks/fieldPanelPosition"
import {tricksOperationState} from "../../lib/tricks"

const TricksGame = dynamic(() => import("./TricksLayeredGame"), {ssr: false})

export default function TricksReplayMode({eventId, usersById = {}, manualContent, onExit}) {
    const [manifest, setManifest] = useState(null)
    const [snapshot, setSnapshot] = useState(null)
    const [busy, setBusy] = useState(true)
    const [error, setError] = useState("")
    const [selectedUser, setSelectedUser] = useState("")
    const [detail, setDetail] = useState(null)
    const [headerBottom, setHeaderBottom] = useState(174)
    const [rows, setRows] = useState(false)
    const [knowledgeOpen, setKnowledgeOpen] = useState(false)
    const requestRef = useRef(null)
    const sequenceRef = useRef(0)
    const targetRef = useRef("")
    const cacheRef = useRef(new Map())
    const batchesRef = useRef(new Map())
    const loadBatch = useCallback((mode, index) => {
        const start = Math.floor(index / 8) * 8
        const batchKey = `${mode}:${start}`
        if (cacheRef.current.has(batchKey)) return Promise.resolve()
        if (batchesRef.current.has(batchKey)) return batchesRef.current.get(batchKey).promise
        const controller = new AbortController()
        const promise = fetchReplay(`/api/server/tricks/replay/${eventId}/snapshots?mode=${mode}&start=${start}&count=8`, controller.signal)
            .then((result) => {
                if (controller.signal.aborted) return
                result.snapshots.forEach((value, offset) => cacheRef.current.set(`${mode}:${start + offset}`, value))
                while (cacheRef.current.size > 24) cacheRef.current.delete(cacheRef.current.keys().next().value)
            })
            .finally(() => { if (batchesRef.current.get(batchKey)?.controller === controller) batchesRef.current.delete(batchKey) })
        batchesRef.current.set(batchKey, {promise, controller})
        return promise
    }, [eventId])
    const stopPlayback = useCallback(() => {
        requestRef.current?.abort()
        batchesRef.current.forEach(({controller}) => controller.abort())
        batchesRef.current.clear()
        sequenceRef.current += 1
        targetRef.current = ""
        setBusy(false)
    }, [])
    const commit = useCallback(async (mode, index, playback = false) => {
        const key = `${mode}:${index}`
        if (targetRef.current === key) return true
        targetRef.current = key
        requestRef.current?.abort()
        const controller = new AbortController()
        requestRef.current = controller
        const sequence = ++sequenceRef.current
        setBusy(true)
        setError("")
        setDetail(null)
        try {
            if (playback && !cacheRef.current.has(key)) await loadBatch(mode, index)
            const next = playback ? cacheRef.current.get(key) : await fetchReplay(`/api/server/tricks/replay/${eventId}/snapshot?${mode}=${index}`, controller.signal)
            if (controller.signal.aborted || sequence !== sequenceRef.current) return
            if (!next) return false
            setSnapshot(next)
            if (playback && index % 8 >= 4 && index + 4 < (mode === "checkpoint" ? manifest.checkpoints.length : manifest.timeline.length)) loadBatch(mode, index + 4).catch(() => {})
            setSelectedUser((current) => next.players.some((player) => player.name === current) ? current : "")
            return true
        } catch (failure) {
            if (controller.signal.aborted || sequence !== sequenceRef.current) return
            targetRef.current = ""
            setError(failure.message)
            return false
        } finally {
            if (!controller.signal.aborted && sequence === sequenceRef.current) setBusy(false)
        }
    }, [eventId, loadBatch, manifest])
    const initialCommitRef = useRef(commit)
    initialCommitRef.current = commit
    useEffect(() => {
        const batches = batchesRef.current
        const cache = cacheRef.current
        const controller = new AbortController()
        fetchReplay(`/api/server/tricks/replay/${eventId}`, controller.signal)
            .then((next) => { if (!controller.signal.aborted) { setManifest(next); initialCommitRef.current("checkpoint", 0) } })
            .catch((failure) => { if (!controller.signal.aborted) { setError(failure.message); setBusy(false) } })
        return () => { controller.abort(); requestRef.current?.abort(); batches.forEach(({controller: batchController}) => batchController.abort()); batches.clear(); cache.clear(); sequenceRef.current += 1 }
    }, [eventId])
    const state = useMemo(() => snapshot && {...snapshot, hand: snapshot.hands_by_player[selectedUser] || []}, [snapshot, selectedUser])
    const nowValue = snapshot ? new Date(snapshot.snapshot_at).getTime() : null
    const operation = useMemo(() => ({...tricksOperationState(state, {nowValue}), available: false, canDraw: false, canTake: false, canReturnToDeck: false}), [state, nowValue])
    const selectUser = useCallback((name) => { setSelectedUser((current) => current === name ? "" : name); setDetail(null) }, [])
    const noOperation = useCallback(() => false, [])
    const openDetail = useCallback((selection) => {
        if (!selection) { setDetail(null); return }
        const source = selection.anchor || {}
        const anchor = {x: source.x ?? source.left ?? 24, y: source.y ?? source.top ?? headerBottom + 16, width: source.width ?? 17, height: source.height ?? 23}
        setDetail({...selection, anchor, side: selection.side || (anchor.x + anchor.width / 2 > window.innerWidth / 2 ? "left" : "right")})
    }, [headerBottom])
    const panelPosition = detail && (detail.kind === "holder"
        ? {left: Math.max(16, Math.min(detail.anchor.x, (typeof window === "undefined" ? 1024 : window.innerWidth) - 576)), top: detail.anchor.y, width: "min(560px, calc(100vw - 32px))"}
        : fieldPanelPosition(detail.anchor, detail.side, typeof window === "undefined" ? 900 : window.innerHeight))
    const detailRankings = detail && snapshot?.rankings_by_card[detail.card.id]
    return (
        <div data-tricks-root data-tricks-replay-root aria-busy={busy} style={{position: "relative", width: "100vw", height: "100vh", minHeight: 540, marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)", overflow: "clip", background: '#0c1016 url("/img/limited_19_bg.jpg") center / min(100%, 2000px) auto repeat', color: "var(--color-text-base)"}}>
            {state && <>
                <TricksGame state={state} replayMode headerBottom={headerBottom} replayBottomOffset={89} selectedFieldId={detail?.card?.id} usersById={usersById} operation={operation} nowValue={nowValue}
                    onDraw={noOperation} onTake={noOperation} onReturnToDeck={noOperation} onSelectField={openDetail} />
            </>}
                <TricksHud headerMessages={[busy && {key: "loading", text: "読み込み中..."}, error && {key: "error", text: error, error: true}].filter(Boolean)} state={state} replayMode bottomOffset={89} onToggleReplay={onExit} onSelectReplayUser={selectUser} onHeaderHeightChange={setHeaderBottom}
                    onShowKnowledge={() => setKnowledgeOpen(true)} spectatorMode={rows} onToggleSpectator={() => setRows((value) => !value)} usersById={usersById} historicalHolderCounts={snapshot?.historical_holder_counts || {}}
                    currentUserId={selectedUser} nowValue={nowValue} onSelectHolder={(card) => openDetail({card, anchor: card.anchor, kind: "holder"})} />

            {detail && <>
                <div onClick={() => setDetail(null)} style={{position: "fixed", inset: "0 0 89px", zIndex: 300}} />
                <TricksFieldDetailPanel evidenceImageBase="https://pik5.net/api/file/" rankings={detailRankings || []} scoreType={detail.card.score_type} usersById={usersById} summary={`#${detail.card.stage_id} ${detail.card.title} / ${formatReplayTimestamp(snapshot.snapshot_at)}`}
                    onClose={() => setDetail(null)} className={`tricks-replay-detail-panel tricks-field-detail-panel-${detail.side}`}
                    style={{position: "fixed", zIndex: 310, width: fieldDetailModalWidth, ...panelPosition, pointerEvents: "auto"}}>
                    <Button disabled>投稿</Button><Button disabled>延長</Button>
                </TricksFieldDetailPanel>
            </>}
            <Dialog open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} maxWidth="md" fullWidth><DialogTitle>ユーザーマニュアル</DialogTitle><DialogContent><TricksManualContent content={manualContent || ""} /></DialogContent><DialogActions><Button onClick={() => setKnowledgeOpen(false)}>閉じる</Button></DialogActions></Dialog>
            {manifest && <TricksReplaySeekBar manifest={manifest} snapshot={snapshot} busy={busy} onCommit={commit} onStop={stopPlayback} onPrepare={loadBatch} usersById={usersById} />}
            <style jsx global>{`[data-tricks-replay-root] .MuiButton-root.Mui-disabled {color: var(--color-muted-text)} [data-tricks-replay-root] .tricks-card-border > span, [data-tricks-replay-root] [data-tricks-player-blink], [data-tricks-replay-root] [data-tricks-stat-blink] {animation: none !important} [data-tricks-replay-root] .tricks-dom-card {transition: transform 240ms ease, filter 160ms ease} .tricks-replay-detail-panel > div:first-of-type {min-height: 0 !important; max-height: min(390px, calc(100vh - ${panelPosition?.top || 116}px - 165px)) !important} @media (max-width: 900px) { .tricks-replay-detail-panel {left:16px !important;right:16px !important;top:118px !important;width:auto !important} .tricks-replay-detail-panel > div:first-of-type {max-height:min(390px, calc(100vh - 283px)) !important} } @media (prefers-reduced-motion: reduce) { [data-tricks-replay-root] .tricks-dom-card, [data-tricks-replay-card] {transition:none !important} } @media (max-width: 600px) { [data-tricks-replay-seekbar] {padding-left: 8px !important; padding-right: 8px !important; gap: 8px !important} [data-tricks-replay-current-time] {display:none} }`}</style>
        </div>
    )
}
