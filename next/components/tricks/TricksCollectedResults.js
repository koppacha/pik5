import {shortenTricksText} from "../../lib/tricks"

export default function TricksCollectedResults({cards = [], usersById = {}}) {
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
                border: "1px solid rgba(148, 163, 184, 0.3)",
                borderRadius: 14,
                background: "rgba(12, 16, 22, 0.94)",
            }}
        >
            <h1 style={{fontSize: 22, margin: "0 0 6px"}}>大会結果・回収カード</h1>
            <p style={{color: "#9aa8bd", margin: "0 0 18px", fontSize: 13}}>
                ホルダーなしのカードは次回イベントへ戻ります。
            </p>
            {cards.length === 0 && <div style={{color: "#9aa8bd"}}>回収カードはありません</div>}
            <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14}}>
                {cards.map((card) => (
                    <article
                        key={card.event_card_id || card.id}
                        data-testid="tricks-collected-card"
                        style={{
                            padding: 16,
                            border: "1px solid rgba(148, 163, 184, 0.28)",
                            borderRadius: 12,
                            background: "#151d29",
                        }}
                    >
                        <div style={{display: "flex", justifyContent: "space-between", gap: 12, color: "#9aa8bd", fontSize: 12}}>
                            <span>#{card.stage_id || card.card_id || card.id}</span>
                            <span>★{card.difficulty || 1} / R{card.rarity || 1}</span>
                        </div>
                        <h2 style={{fontSize: 18, margin: "8px 0 4px"}}>{shortenTricksText(card.title, 36)}</h2>
                        <div style={{fontWeight: 700, color: card.holders?.length ? "#8df0b4" : "#ffcf6e"}}>
                            {card.holder_label || "ホルダーなし"}
                        </div>
                        <div style={{fontSize: 12, color: "#9aa8bd", marginTop: 3}}>
                            {card.returns_next_event ? "次回イベントで再登場" : "ホルダー所有・以後の山札から除外"}
                        </div>
                        <div style={{display: "grid", gap: 5, marginTop: 12}}>
                            {(card.rankings || []).map((ranking) => (
                                <div
                                    key={ranking.user_id}
                                    style={{display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13}}
                                >
                                    <span>{ranking.rank}位 {usersById[ranking.user_id]?.name || ranking.user_name || ranking.user_id}</span>
                                    <span>{ranking.score} / {ranking.rps}R</span>
                                </div>
                            ))}
                            {(card.rankings || []).length === 0 && (
                                <div style={{fontSize: 12, color: "#718096"}}>投稿者なし</div>
                            )}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    )
}
