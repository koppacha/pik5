import {useState} from "react"
import {TricksDomCard} from "./TricksLayeredGame"
import TricksFieldDetailPanel from "./TricksFieldDetailPanel"

const detailPanelWidth = 560
const detailPanelGap = 28

const adminMetrics = [
    ["total_rank_points", "合計R"],
    ["collected_card_count", "回収"],
    ["take_count", "テイク"],
    ["draw_count", "ドロー"],
    ["return_count", "山札戻し"],
    ["post_count", "投稿"],
    ["spent_points", "消費P"],
    ["creator_take_count", "制作札テイク"],
]

export default function TricksCollectedResults({cards = [], usersById = {}, adminStats = [], isAdmin = false}) {
    const [selected, setSelected] = useState(null)
    const [adminStatsOpen, setAdminStatsOpen] = useState(false)
    const visibleCards = cards.filter((card) => card.holders?.length)
    const selectedCard = selected?.card
    const fieldDuration = (card) => {
        const takenAt = new Date(card.taken_at).getTime()
        const collectedAt = new Date(card.collected_at).getTime()
        const minutes = Number.isFinite(takenAt) && Number.isFinite(collectedAt)
            ? Math.max(0, Math.floor((collectedAt - takenAt) / 60000))
            : 0

        return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`
    }
    const totalReward = (card) => Number(card.total_reward_points ?? card.rewards?.reduce(
        (total, reward) => total + Number(reward.points_delta || 0),
        0,
    ) ?? 0)
    const adminMaxima = adminMetrics.reduce((maxima, [key]) => ({
        ...maxima,
        [key]: Math.max(0, ...adminStats.map((player) => Number(player[key] || 0))),
    }), {})
    const panelStyle = selected && {
        position: "fixed",
        zIndex: 6,
        width: "min(560px, calc(100vw - 48px))",
        left: selected.side === "left"
            ? Math.max(24, selected.anchor.x - detailPanelGap - detailPanelWidth)
            : selected.anchor.x + selected.anchor.width + detailPanelGap,
        top: Math.max(116, Math.min(selected.anchor.y, window.innerHeight - 360)),
        transformOrigin: selected.side === "left" ? "100% 50%" : "0 50%",
        pointerEvents: "auto",
    }
    const openCard = (card, event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const anchor = {x: rect.left, y: rect.top, width: rect.width, height: rect.height}

        setSelected({
            card,
            anchor,
            side: anchor.x + anchor.width / 2 > window.innerWidth / 2 ? "left" : "right",
        })
    }

    return (
        <section
            aria-label="回収カード一覧"
            data-testid="tricks-collected-results"
            style={{
                position: "absolute",
                inset: "128px 20px 20px",
                zIndex: 4,
                overflowY: "auto",
                padding: "20px",
                background: "rgba(12, 16, 22, 0.94)",
            }}
        >
            <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 6}}>
                <h1 style={{fontSize: 22, margin: 0}}>大会結果・回収カード</h1>
                {isAdmin && (
                    <button
                        type="button"
                        data-tricks-admin-stats-toggle
                        aria-expanded={adminStatsOpen}
                        onClick={() => setAdminStatsOpen((open) => !open)}
                        style={{border: "1px solid #64748b", borderRadius: 6, background: "#1f2937", color: "#fff", cursor: "pointer", padding: "5px 9px"}}
                    >
                        管理統計 {adminStatsOpen ? "閉じる" : "表示"}
                    </button>
                )}
            </div>
            {isAdmin && adminStatsOpen && (
                <div data-tricks-admin-stats style={{display: "grid", gridTemplateColumns: `minmax(120px, 1.5fr) repeat(${adminMetrics.length}, minmax(76px, 1fr))`, overflowX: "auto", gap: 1, marginBottom: 18, background: "#475569", fontSize: 12}}>
                    <div style={{padding: 8, background: "#1e293b", fontWeight: 800}}>プレイヤー</div>
                    {adminMetrics.map(([, label]) => <div key={label} style={{padding: 8, background: "#1e293b", fontWeight: 800, whiteSpace: "nowrap"}}>{label}</div>)}
                    {adminStats.map((player) => (
                        <div key={player.user_id} style={{display: "contents"}}>
                            <div style={{padding: 8, background: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{usersById[player.user_id]?.name || player.user_id}</div>
                            {adminMetrics.map(([key]) => {
                                const value = Number(player[key] || 0)
                                const isMax = value === adminMaxima[key]

                                return <div key={`${player.user_id}-${key}`} data-tricks-admin-stat={key} style={{padding: 8, textAlign: "right", background: isMax ? "#365314" : "#0f172a"}}>{value}</div>
                            })}
                        </div>
                    ))}
                </div>
            )}
            {visibleCards.length === 0 && <div style={{color: "#9aa8bd"}}>回収カードはありません</div>}
            <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18}}>
                {visibleCards.map((card) => (
                    <div
                        key={card.event_card_id || card.id}
                        data-testid="tricks-collected-card"
                        style={{
                            display: "flex",
                            justifyContent: "center",
                        }}
                    >
                        <TricksDomCard
                            card={card}
                            type="field"
                            layout={{x: 0, y: 0}}
                            usersById={usersById}
                            staticLayout
                            showStackBacks={false}
                            footerLabel={`アクティブ時間 ${fieldDuration(card)}`}
                            footerValue={card.stack_count ?? 0}
                            holderLabel={card.holders.map((holder) => usersById[holder]?.name || holder).join(" / ")}
                            onClick={(event) => openCard(card, event)}
                        />
                    </div>
                ))}
            </div>
            {selectedCard && (
                <>
                    <div
                        aria-hidden="true"
                        onClick={() => setSelected(null)}
                        style={{position: "fixed", inset: 0, zIndex: 5, background: "rgba(3, 6, 12, 0.58)"}}
                    />
                    <TricksFieldDetailPanel
                        rankings={selectedCard.rankings || []}
                        usersById={usersById}
                        summary={<>回収時の総還元 {totalReward(selectedCard)}P{" / "}アクティブ時間 {fieldDuration(selectedCard)}</>}
                        onClose={() => setSelected(null)}
                        className={`tricks-collected-detail-panel tricks-field-detail-panel-${selected.side}`}
                        style={panelStyle}
                    />
                </>
            )}
        </section>
    )
}
