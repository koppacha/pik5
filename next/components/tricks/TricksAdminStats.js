import {useEffect, useRef, useState} from "react"

const metrics = [
    ["total_rank_points", "合計R"],
    ["collected_card_count", "回収"],
    ["take_count", "テイク総数"],
    ["draw_count", "ドロー総数"],
    ["return_count", "デッキ戻し"],
    ["post_count", "投稿"],
    ["earned_points", "獲得P総数"],
    ["spent_points", "使用P総数"],
    ["creator_take_count", "制作札テイク"],
]
const cellStyle = {padding: 8, border: "1px solid var(--color-border-base)", whiteSpace: "nowrap"}

export default function TricksAdminStats({stats, usersById = {}, onClose}) {
    const panel = useRef(null)
    const users = stats?.users || []
    const cards = (stats?.cards || []).filter((card) => Number(card.stage_id) > 0)
    const [tab, setTab] = useState("users")
    const name = (id) => usersById[id]?.name || id || "-"
    const names = (ids) => ids?.length ? ids.map(name).join(" / ") : "-"
    const maxima = metrics.map(([key]) => Math.max(0, ...users.map((user) => Number(user[key] || 0))))
    useEffect(() => {
        const closeOutside = (event) => {
            if (panel.current?.contains(event.target) || event.target.closest?.("[data-tricks-tournament-info]")) return
            onClose()
        }
        const escape = (event) => { if (event.key === "Escape") onClose() }
        document.addEventListener("pointerdown", closeOutside, true)
        document.addEventListener("keydown", escape)
        return () => {
            document.removeEventListener("pointerdown", closeOutside, true)
            document.removeEventListener("keydown", escape)
        }
    }, [onClose])

    return (
        <section ref={panel} data-tricks-admin-stats aria-label="管理者用ステータス" style={{position: "absolute", zIndex: 600, top: 184, left: 20, right: 20, maxHeight: "calc(100% - 204px)", overflow: "auto", padding: 16, borderRadius: 10, background: "var(--color-bg-base)", color: "var(--color-text-base)", boxShadow: "0 8px 30px #0006", fontSize: 12}}>
            <div role="tablist" aria-label="ステータス項目" style={{display: "flex", gap: 8, marginBottom: 16}}>
                {[ ["users", "項目別ユーザーステータス"], ["cards", "カード別ステータス"] ].map(([key, label]) => <button key={key} id={`tricks-stats-tab-${key}`} type="button" role="tab" aria-selected={tab === key} aria-controls={`tricks-stats-panel-${key}`} onClick={() => setTab(key)} style={{padding: "8px 12px", cursor: "pointer", border: tab === key ? "1px solid #bdbdbd" : "1px solid var(--color-border-base)", fontWeight: tab === key ? 700 : 400, borderRadius: 8, background: tab === key ? "#212121" : "var(--color-bg-base)", color: tab === key ? "#e1e1e1" : "var(--color-text-base)"}}>{label}</button>)}
            </div>
            <div role="tabpanel" id="tricks-stats-panel-users" aria-labelledby="tricks-stats-tab-users" hidden={tab !== "users"}>
            <div style={{overflowX: "auto"}}>
                <table style={{borderCollapse: "collapse", width: "100%"}}>
                    <thead><tr><th style={cellStyle}>プレイヤー</th>{metrics.map(([key, label]) => <th key={key} style={cellStyle}>{label}</th>)}</tr></thead>
                    <tbody>{users.map((user) => <tr key={user.user_id}>
                        <th style={cellStyle}>{name(user.user_id)}</th>
                        {metrics.map(([key], index) => <td key={key} data-tricks-admin-stat={key} style={{...cellStyle, textAlign: "right", background: Number(user[key] || 0) === maxima[index] ? "color-mix(in srgb, var(--color-bg-base) 70%, var(--color-level-1-bg))" : undefined}}>{user[key] || 0}</td>)}
                    </tr>)}</tbody>
                </table>
            </div>
            </div>
            <div role="tabpanel" id="tricks-stats-panel-cards" aria-labelledby="tricks-stats-tab-cards" hidden={tab !== "cards"}>
            <div style={{overflowX: "auto"}}>
                <table data-tricks-card-stats style={{borderCollapse: "collapse", width: "100%"}}>
                    <thead><tr>{["ステージID", "ステージ名（ルール名）", "難易度", "レア度", "場に出ていた時間", "投稿数", "回収時の総還元P", "参加者数", "クリエイター", "テイカー", "ホルダー"].map((label) => <th key={label} style={cellStyle}>{label}</th>)}</tr></thead>
                    <tbody>{cards.map((card) => {
                        const minutes = Math.floor(Number(card.field_seconds || 0) / 60)
                        const duration = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`
                        return <tr key={card.event_card_id}>
                            {[card.stage_id, `${card.title || "-"}（${card.rule_name || "-"}）`, card.difficulty ?? "-", card.rarity ?? "未開封", duration, card.post_count, card.total_reward_points ?? "未回収", new Set(card.participants || []).size, card.creator || "-", name(card.taker), names(card.holders)].map((value, index) => <td key={index} style={cellStyle}>{value}</td>)}
                        </tr>
                    })}</tbody>
                </table>
            </div>
            </div>
        </section>
    )
}
