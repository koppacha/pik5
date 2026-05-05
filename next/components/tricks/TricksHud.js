import {formatRemaining, shortenTricksText} from "../../lib/tricks"

function logText(log) {
    if (typeof log === "string") return log
    return log?.message || log?.text || log?.event || JSON.stringify(log)
}

export default function TricksHud({state, nowValue = Date.now()}) {
    const tournament = state?.tournament || {}
    const players = state?.players || []
    const logs = state?.logs || []

    return (
        <>
            <div
                style={{
                    position: "absolute",
                    right: 24,
                    bottom: 24,
                    width: 284,
                    maxHeight: 210,
                    zIndex: 2,
                    color: "#e6edf8",
                    pointerEvents: "auto",
                }}
            >
                <div style={{fontSize: 13, color: "#9aa8bd", marginBottom: 6}}>
                    ログ
                </div>
                <div
                    style={{
                        maxHeight: 178,
                        overflowY: "auto",
                        border: "1px solid rgba(154, 168, 189, 0.35)",
                        background: "rgba(13, 18, 28, 0.82)",
                        padding: "8px 10px",
                        fontSize: 12,
                        lineHeight: 1.45,
                    }}
                >
                    {logs.length === 0 && (
                        <div style={{color: "#718096"}}>ログはまだありません</div>
                    )}
                    {logs.slice(0, 100).map((log, index) => (
                        <div
                            key={log?.id || `${index}-${logText(log)}`}
                            style={{
                                padding: "3px 0",
                                borderBottom: index < logs.length - 1 ? "1px solid rgba(154, 168, 189, 0.12)" : "none",
                            }}
                        >
                            {shortenTricksText(logText(log), 72)}
                        </div>
                    ))}
                </div>
            </div>
            <div
                style={{
                    position: "absolute",
                    right: 24,
                    top: 14,
                    width: 420,
                    maxHeight: 238,
                    zIndex: 2,
                    color: "#e6edf8",
                    pointerEvents: "auto",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 12,
                        marginBottom: 7,
                    }}
                >
                    <div style={{fontSize: 15, fontWeight: 700}}>ダッシュボード</div>
                    <div style={{fontSize: 12, color: tournament.debug ? "#88f0b0" : "#ffcf6e"}}>
                        残り {formatRemaining(tournament.end_at, nowValue)}
                    </div>
                </div>
                <div
                    style={{
                        maxHeight: 204,
                        overflowY: "auto",
                        border: "1px solid rgba(154, 168, 189, 0.35)",
                        background: "rgba(13, 18, 28, 0.82)",
                    }}
                >
                    <table style={{width: "100%", borderCollapse: "collapse", fontSize: 12}}>
                        <thead>
                        <tr style={{color: "#aab7c9"}}>
                            <th style={{textAlign: "right", padding: "7px 8px", width: 34}}>#</th>
                            <th style={{textAlign: "left", padding: "7px 8px"}}>Player</th>
                            <th style={{textAlign: "right", padding: "7px 8px"}}>DP</th>
                            <th style={{textAlign: "right", padding: "7px 8px"}}>RP</th>
                            <th style={{textAlign: "right", padding: "7px 8px"}}>H</th>
                        </tr>
                        </thead>
                        <tbody>
                        {players.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{padding: "12px 10px", color: "#718096"}}>
                                    参加者はまだいません
                                </td>
                            </tr>
                        )}
                        {players.map((player, index) => (
                            <tr key={player.name || index}>
                                <td style={{textAlign: "right", padding: "6px 8px", color: "#94a3b8"}}>{index + 1}</td>
                                <td style={{padding: "6px 8px"}}>{shortenTricksText(player.name, 18)}</td>
                                <td style={{textAlign: "right", padding: "6px 8px"}}>{player.draw_points}</td>
                                <td style={{textAlign: "right", padding: "6px 8px"}}>{player.rank_points}</td>
                                <td style={{textAlign: "right", padding: "6px 8px"}}>{player.card_count}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )
}
