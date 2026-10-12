import {memo, useEffect, useMemo, useRef, useState} from "react"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {faPlay, faPause, faBackwardStep, faForwardStep} from "@fortawesome/free-solid-svg-icons"
import {formatTricksLog} from "../../lib/tricks/logText"
import {formatReplayTimestamp, replayEventLabel} from "../../lib/tricks/replay"

export default memo(function TricksReplaySeekBar({manifest, snapshot, busy, onCommit, onStop, onPrepare, usersById}) {
    const [mode, setMode] = useState("checkpoint")
    const [playing, setPlaying] = useState(false)
    const [speed, setSpeed] = useState("1")
    const playbackRef = useRef(0)
    const [draft, setDraft] = useState(0)
    const draftRef = useRef(0)
    const draggingRef = useRef(false)
    const steps = mode === "checkpoint" ? manifest.checkpoints : manifest.timeline
    const actualIndex = useMemo(() => Math.max(0, steps.findLastIndex((step) => step.cursor <= (snapshot?.log_cursor ?? 0) && step.at <= (snapshot?.snapshot_at || manifest.start_at))), [steps, snapshot?.log_cursor, snapshot?.snapshot_at, manifest.start_at])
    useEffect(() => {
        if (draggingRef.current) return
        draftRef.current = actualIndex
        setDraft(actualIndex)
    }, [actualIndex, mode])
    const pause = () => {
        playbackRef.current += 1
        setPlaying(false)
        onStop()
    }
    useEffect(() => {
        if (!playing) return
        onPrepare(mode, actualIndex + 1).catch(() => {})
        const generation = ++playbackRef.current
        let timer
        let index = actualIndex
        let deadline = performance.now() + 1000 / Number(speed)
        const tick = async () => {
            if (generation !== playbackRef.current) return
            if (index >= steps.length - 1) { setPlaying(false); return }
            const succeeded = await onCommit(mode, index + 1, true)
            if (generation !== playbackRef.current) return
            if (!succeeded) { setPlaying(false); return }
            index += 1
            draftRef.current = index
            setDraft(index)
            if (index >= steps.length - 1) { setPlaying(false); return }
            deadline = Math.max(deadline + 1000 / Number(speed), performance.now() + 1000 / Number(speed))
            timer = setTimeout(tick, Math.max(0, deadline - performance.now()))
        }
        timer = setTimeout(tick, 1000 / Number(speed))
        return () => { playbackRef.current += 1; clearTimeout(timer) }
        // The loop owns its cursor; incoming snapshots must not restart its timer.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing, speed, mode, onCommit, onPrepare, steps])
    const changeDraft = (event) => {
        draftRef.current = Number(event.target.value)
        setDraft(draftRef.current)
    }
    const commit = () => {
        draggingRef.current = false
        onCommit(mode, draftRef.current)
    }
    const moveFrame = (direction) => {
        pause()
        draggingRef.current = false
        const index = Math.max(0, Math.min(steps.length - 1, actualIndex + direction))
        draftRef.current = index
        setDraft(index)
        onCommit(mode, index)
    }
    const changeMode = (event) => {
        pause()
        const nextMode = event.target.value
        const nextSteps = nextMode === "checkpoint" ? manifest.checkpoints : manifest.timeline
        const nextIndex = Math.max(0, nextSteps.findLastIndex((step) => step.cursor <= (snapshot?.log_cursor ?? 0) && step.at <= (snapshot?.snapshot_at || manifest.start_at)))
        draggingRef.current = false
        draftRef.current = nextIndex
        setMode(nextMode)
        setDraft(nextIndex)
        onCommit(nextMode, nextIndex)
    }
    const step = steps[draft] || steps[0]
    const logText = mode === "frame" && formatTricksLog(step.log || {event: step.event, created_at: step.at, message: replayEventLabel(step.event)}, usersById)
    return (
        <section data-tricks-replay-seekbar aria-label="リプレイ時点の選択" style={{position: "fixed", bottom: 5, left: 5, right: 5, zIndex: 420, height: 84, boxSizing: "border-box", padding: "7px 24px", background: "color-mix(in srgb, var(--color-bg-base) 90%, transparent)", border: "1px solid var(--color-border-base)", borderRadius: 12, display: "flex", gap: 20, alignItems: "center"}}>
            <label style={{fontSize: 12, flex: "0 0 auto"}}>粒度<br />
                <select aria-label="リプレイ粒度" value={mode} onChange={changeMode} style={{color: "inherit", background: "var(--color-bg-base)", height: 28}}>
                    <option value="checkpoint">15分</option><option value="frame">ログ単位</option>
                </select>
            </label>
            <label style={{fontSize: 12, flex: "0 0 auto"}}>再生速度<br />
                <select aria-label="リプレイ再生速度" value={speed} onChange={(event) => { if (playing) onStop(); setSpeed(event.target.value) }} style={{color: "inherit", background: "var(--color-bg-base)", height: 28}}>
                    <option value="1">x1</option><option value="2">x2</option><option value="4">x4</option>
                </select>
            </label>
            <div style={{position: "relative", flex: 1, minWidth: 0, paddingTop: 25}}>
                <output role="tooltip" data-tricks-replay-time style={{position: "absolute", top: 0, left: `clamp(85px, ${draft / Math.max(1, steps.length - 1) * 100}%, calc(100% - 85px))`, transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 12, fontVariantNumeric: "tabular-nums", padding: "2px 6px", border: "1px solid var(--color-border-base)", borderRadius: 4}}>{formatReplayTimestamp(step.at)}</output>
                <input type="range" aria-label="リプレイ時点" aria-valuetext={formatReplayTimestamp(step.at)} min={0} max={steps.length - 1} value={draft}
                    onPointerDown={(event) => { pause(); draggingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId) }}
                    onChange={changeDraft} onPointerUp={commit}
                    onPointerCancel={() => { draggingRef.current = false; draftRef.current = actualIndex; setDraft(actualIndex) }}
                    onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) { pause(); draggingRef.current = true } }}
                    onKeyUp={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) commit() }}
                    style={{width: "100%", margin: 0, touchAction: "none"}} />
                <div style={{fontSize: 10, color: "var(--color-text-sub)", display: "flex", justifyContent: "space-between", gap: 8}}>
                    <span data-tricks-replay-log title={logText || undefined} style={{flex: 1, minWidth: 0, whiteSpace: "nowrap", overflowX: "auto"}}>{logText}</span>
                    <span data-tricks-replay-current-time>{formatReplayTimestamp(snapshot?.snapshot_at)}</span>
                </div>
            </div>
            <div data-tricks-replay-controls style={{display: "flex", flex: "0 0 auto", gap: 4, alignItems: "center"}}>
                <button type="button" aria-label="前のコマ" title="前のコマ" disabled={!snapshot || busy || actualIndex === 0} onClick={() => moveFrame(-1)} style={{border: 0, padding: 8, background: "transparent", color: "inherit", cursor: "pointer"}}>
                    <FontAwesomeIcon icon={faBackwardStep} />
                </button>
                <button type="button" aria-label={playing ? "リプレイを一時停止" : "リプレイを再生"} disabled={!snapshot || (!playing && actualIndex >= steps.length - 1)} onClick={() => playing ? pause() : setPlaying(true)} style={{border: 0, padding: 8, background: "transparent", color: "inherit", cursor: "pointer"}}>
                    <FontAwesomeIcon icon={playing ? faPause : faPlay} />
                </button>
                <button type="button" aria-label="次のコマ" title="次のコマ" disabled={!snapshot || busy || actualIndex >= steps.length - 1} onClick={() => moveFrame(1)} style={{border: 0, padding: 8, background: "transparent", color: "inherit", cursor: "pointer"}}>
                    <FontAwesomeIcon icon={faForwardStep} />
                </button>
            </div>
            <style jsx>{`button:disabled {opacity: 0.35; cursor: default !important}`}</style>
        </section>
    )
})
