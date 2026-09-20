import {useEffect, useState} from "react"

function localDateTimeValue(value) {
    if (!value) return ""
    const date = new Date(value)
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

    return local.toISOString().slice(0, 16)
}

function displayDateTime(value) {
    if (!value) return "-"

    return new Date(value).toLocaleString("ja-JP", {hour12: false})
}

export default function TricksDebugPanel({state, busy = false, onOperation, open = false, onClose}) {
    const [setValue, setSetValue] = useState(() => localDateTimeValue(state?.debug_state?.server_now))
    const debug = state?.debug_state || {}

    useEffect(() => {
        if (!setValue && debug.server_now) setSetValue(localDateTimeValue(debug.server_now))
    }, [debug.server_now, setValue])

    return (
        <aside
            data-testid="tricks-debug-panel"
            style={{position: "fixed", left: 24, top: 180, zIndex: 50, width: open ? 310 : "auto"}}
        >
            {open && <button type="button" onClick={onClose} style={buttonStyle}>
                {open ? "デバッグを閉じる" : "デバッグ"}
            </button>}
            {open && (
                <div style={{marginTop: 8, padding: 12, borderRadius: 10, background: "#0d121c", border: "1px solid #53627a"}}>
                    <div style={{fontSize: 12, color: "#a9b8ce", lineHeight: 1.5}}>
                        現在: {displayDateTime(debug.server_now || state?.server_now)}<br />
                        次回給付: {displayDateTime(debug.next_subsidy_slot_at)}<br />
                        時計: {debug.frozen ? "固定" : "実時刻"}
                    </div>
                    <div style={{display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10}}>
                        <button type="button" disabled={busy} onClick={() => onOperation("freeze")} style={smallButtonStyle}>固定</button>
                        <button type="button" disabled={busy} onClick={() => onOperation("advance", {minutes: 1})} style={smallButtonStyle}>+1分</button>
                        <button type="button" disabled={busy} onClick={() => onOperation("advance", {minutes: 30})} style={smallButtonStyle}>+30分</button>
                        <button type="button" disabled={busy} onClick={() => onOperation("advance", {minutes: 90})} style={smallButtonStyle}>+90分</button>
                        <button type="button" disabled={busy} onClick={() => onOperation("advance", {hours: 1})} style={smallButtonStyle}>+1時間</button>
                    </div>
                    <label style={{display: "grid", gap: 5, marginTop: 10, fontSize: 12, color: "#c7d2e6"}}>
                        指定時刻
                        <input
                            type="datetime-local"
                            value={setValue}
                            onChange={(event) => setSetValue(event.target.value)}
                            style={{padding: 7, colorScheme: "dark", background: "#111827", color: "#fff", border: "1px solid #53627a"}}
                        />
                    </label>
                    <div style={{display: "flex", gap: 6, marginTop: 8}}>
                        <button
                            type="button"
                            disabled={busy || !setValue}
                            onClick={() => onOperation("set", {now: new Date(setValue).toISOString()})}
                            style={smallButtonStyle}
                        >
                            設定
                        </button>
                        <button type="button" disabled={busy} onClick={() => onOperation("reset")} style={smallButtonStyle}>実時刻へ戻す</button>
                    </div>
                </div>
            )}
        </aside>
    )
}

const buttonStyle = {
    border: "1px solid #71d99b",
    borderRadius: 7,
    padding: "7px 10px",
    background: "#173b2a",
    color: "#dffbea",
    cursor: "pointer",
}

const smallButtonStyle = {
    border: "1px solid #607089",
    borderRadius: 6,
    padding: "6px 8px",
    background: "#263247",
    color: "#fff",
    cursor: "pointer",
}
