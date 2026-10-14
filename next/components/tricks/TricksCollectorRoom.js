import {useState} from "react"
import {faMedal} from "@fortawesome/free-solid-svg-icons"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {TopBoxContent, TopBoxHeader} from "../../styles/pik5.css"
import {TricksDomCard} from "./TricksLayeredGame"
import {TricksCardBorderStyles} from "./TricksCardBorder"
import TricksFieldDetailPanel from "./TricksFieldDetailPanel"

export default function TricksCollectorRoom({cards = [], usersById = {}, onClose}) {
    const [selected, setSelected] = useState(null)

    return (
        <section aria-label="コレクタールーム" data-testid="tricks-collector-room">
            <TopBoxHeader className="top-box-header"><span><FontAwesomeIcon icon={faMedal} /> コレクタールーム</span></TopBoxHeader>
            <TopBoxContent className="top-box-content">
                <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20, justifyItems: "center"}}>
                    {cards.map((card) => (
                        <div key={`${card.event_id}-${card.stage_id}`} style={{width: 260, height: 363}}>
                            <TricksDomCard
                                card={card}
                                type="field"
                                staticLayout
                                showStackBacks={false}
                                usersById={usersById}
                                holderLabel={usersById[card.holders?.[0]]?.name || card.holders?.[0]}
                                footerLabel={`ランクポイント ${card.rank_points ?? 0}`}
                                footerValue={card.rank_points ?? 0}
                                onClick={() => setSelected(card)}
                            />
                        </div>
                    ))}
                </div>
                <div style={{display: "flex", justifyContent: "flex-end", marginTop: 20}}>
                    <button type="button" onClick={onClose}>閉じる</button>
                </div>
            </TopBoxContent>
            {selected && (
                <div role="presentation" onClick={() => setSelected(null)} style={{position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", background: "rgba(0,0,0,.6)"}}>
                    <TricksFieldDetailPanel
                        rankings={selected.rankings || []}
                        usersById={usersById}
                        summary={`${selected.rule_name || "期間限定ランキング"} / ステージ #${selected.stage_id} / ホルダー獲得 ${selected.rank_points}R`}
                        onClose={() => setSelected(null)}
                        style={{position: "relative", width: "min(560px, calc(100vw - 32px))", borderRadius: 12, background: "var(--color-bg-base)", color: "var(--color-text-base)", boxShadow: "0 16px 48px rgba(0,0,0,.45)"}}
                    />
                </div>
            )}
            <TricksCardBorderStyles />
            <style jsx global>{`
                [data-testid="tricks-collector-room"] .tricks-dom-card {border: 0; padding: 0; background: transparent; cursor: pointer; text-align: left}
                [data-testid="tricks-collector-room"] .tricks-dom-card-face {position: absolute; inset: 0; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto auto; gap: 5px; padding: 10px; overflow: hidden; border: 10px solid var(--card-border); border-radius: 18px; background: #fff; box-shadow: 0 12px 30px #0004; box-sizing: border-box}
                [data-testid="tricks-collector-room"] .tricks-dom-card.rarity-5 .tricks-dom-card-face {background: rgba(255, 255, 255, .9); background-clip: padding-box; border-color: transparent; z-index: 1}
                [data-testid="tricks-collector-room"] .tricks-dom-card-back {position: absolute; inset: 0; border-radius: 18px; box-sizing: border-box; background: #e4e8ef; border: 10px solid #8994a8}
                [data-testid="tricks-collector-room"] .tricks-dom-card-back:nth-child(even) {background: #f2f4f8; border-color: #718097}
                [data-testid="tricks-collector-room"] .tricks-dom-card-meta, [data-testid="tricks-collector-room"] .tricks-dom-card-users, [data-testid="tricks-collector-room"] .tricks-dom-card-footer {display: flex; justify-content: space-between; gap: 8px; color: #667085; font-size: 12px; font-weight: 700}
                [data-testid="tricks-collector-room"] .tricks-dom-card-title {font-size: 22px; font-weight: 800; color: #141923}
                [data-testid="tricks-collector-room"] .tricks-dom-card-rule {font-size: 15px; font-weight: 700; color: #4f5a68}
                [data-testid="tricks-collector-room"] .tricks-dom-card-text {font-size: 14px; color: #243044; line-height: 1.2; min-height: 0; white-space: pre-wrap; overflow-wrap: anywhere; overflow: auto}
                [data-testid="tricks-collector-room"] .tricks-dom-card-users {display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #d5dae2; padding-top: 8px}
                [data-testid="tricks-collector-room"] .tricks-dom-card-holder {grid-column: 1 / -1}
                [data-testid="tricks-collector-room"] .tricks-dom-stack {display: inline-grid; place-items: center; min-width: 36px; height: 36px; border-radius: 50%; background: #000000; color: #fff; font-size: 17px}
            `}</style>
        </section>
    )
}
