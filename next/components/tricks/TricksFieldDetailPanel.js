import Button from "@mui/material/Button"
import Record from "../record/Record"

export default function TricksFieldDetailPanel({
    rankings,
    usersById = {},
    summary,
    onClose,
    children,
    style,
    className = "",
}) {
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
            <div style={{padding: 22, minHeight: 180, maxHeight: 390, overflowY: "auto"}}>
                <div style={{fontSize: 12, color: "var(--color-text-sub)", marginBottom: 10}}>{summary}</div>
                {!rankings && <div style={{color: "var(--color-text-base)"}}>読み込み中...</div>}
                {rankings && rankings.length === 0 && <div style={{color: "var(--color-text-base)"}}>投稿はまだありません</div>}
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
            <div style={{display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 18px 16px", borderTop: "1px solid var(--color-border-base)"}}>
                {children}
                <Button onClick={onClose}>閉じる</Button>
            </div>
        </div>
    )
}
