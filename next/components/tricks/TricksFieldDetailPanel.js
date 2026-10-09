import {useEffect, useRef} from "react"
import Button from "@mui/material/Button"
import {sec2time} from "../../lib/pik5"
import Record from "../record/Record"

export default function TricksFieldDetailPanel({
    rankings,
    highlightedPost,
    usersById = {},
    summary,
    taker,
    scoreType = "points",
    takerRemainder = 0,
    onClose,
    children,
    style,
    className = "",
}) {
    const contentRef = useRef(null)
    useEffect(() => {
        if (!highlightedPost) return
        const content = contentRef.current
        const target = content?.querySelector("[data-tricks-highlighted-post]")
        if (!target) return
        const bounds = content.getBoundingClientRect()
        const targetBounds = target.getBoundingClientRect()
        if (targetBounds.top < bounds.top || targetBounds.bottom > bounds.bottom) {
            content.scrollTop += targetBounds.top - bounds.top - 16
        }
    }, [highlightedPost, rankings])
    return (
        <div
            className={`tricks-field-detail-panel ${className}`}
            onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
            }}
            onMouseUp={(event) => {
                event.preventDefault()
                event.stopPropagation()
            }}
            onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
            }}
            style={style}
        >
            <div ref={contentRef} style={{padding: 22, minHeight: 180, maxHeight: 390, overflowY: "auto"}}>
                <div style={{fontSize: 12, color: "var(--color-text-sub)", marginBottom: 10}}>{summary}</div>
                {highlightedPost && !rankings?.some((row) => row.user_id === highlightedPost.actor_name && Number(row.score) === Number(highlightedPost.score)) && (
                    <div key={highlightedPost.id} data-tricks-highlighted-post={highlightedPost.id} style={{marginBottom: 10}}>
                        <span className="tricks-post-blink">{usersById[highlightedPost.actor_name]?.name || highlightedPost.actor_name}</span>
                        {" / "}<span className="tricks-post-blink">{scoreType === "time" ? sec2time(Number(highlightedPost.score)) : `${highlightedPost.score ?? "-"}点`}</span>
                    </div>
                )}
                {Number(takerRemainder) > 0 && <div data-tricks-taker-remainder style={{marginBottom: 10, color: "var(--color-text-base)"}}>テイカー端数還元：{usersById[taker]?.name || taker} / {takerRemainder}P（順位配分とは別枠）</div>}
                {!rankings && <div style={{color: "var(--color-text-base)"}}>読み込み中...</div>}
                {rankings && rankings.length === 0 && <div style={{color: "var(--color-text-base)"}}>投稿はまだありません</div>}
                {rankings && rankings.length > 0 && (
                    <div style={{display: "grid", gap: 8}}>
                        {rankings.map((row) => (
                            <div key={row.unique_id || row.post_id || `${row.post_rank}-${row.user_id}`}
                                data-tricks-highlighted-post={row.user_id === highlightedPost?.actor_name && Number(row.score) === Number(highlightedPost?.score) ? highlightedPost.id : undefined}>
                            <Record
                                mini
                                commentPreviewLength={10}
                                showMiniRps
                                swapScoreRpsLabel
                                scoreUnit="pts"
                                data={{
                                    ...row,
                                    score_type: row.score_type || scoreType,
                                    user_name: usersById[row.user_id]?.name || row.user_name || row.user_id,
                                }}
                            />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div style={{display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 18px 16px", borderTop: "1px solid var(--color-border-base)"}}>
                {children}
                {onClose && <Button onClick={onClose}>閉じる</Button>}
            </div>
        </div>
    )
}
