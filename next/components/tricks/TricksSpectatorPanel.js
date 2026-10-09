import useSWR from "swr"
import {useEffect, useLayoutEffect, useState} from "react"
import {fieldPanelPosition, fieldDetailModalWidth} from "../../lib/tricks/fieldPanelPosition"
import {tricksFetcher} from "../../lib/tricks"
import TricksFieldDetailPanel from "./TricksFieldDetailPanel"

export default function TricksSpectatorPanel({presentation, tricksApi, usersById}) {
    const {item, blinking} = presentation
    const {card, log} = item
    const {data: rankings, error, mutate} = useSWR(tricksApi.scores(card.id), tricksFetcher, {
        refreshInterval: 3000,
        revalidateOnFocus: true,
    })
    useEffect(() => {
        mutate()
    }, [log.id, mutate])
    const [position, setPosition] = useState({side: "right", style: fieldPanelPosition()})
    useLayoutEffect(() => {
        const element = [...document.querySelectorAll("[data-tricks-card-id]")].find(node => node.dataset.tricksCardId === String(card.id))
        const update = () => {
            const rect = element?.getBoundingClientRect()
            const side = rect && rect.x + rect.width / 2 > window.innerWidth / 2 ? "left" : "right"
            const style = fieldPanelPosition(rect && {x: rect.x, y: rect.y, width: rect.width}, side, window.innerHeight)
            setPosition(previous => previous.side === side && previous.style.left === style.left && previous.style.top === style.top ? previous : {side, style})
        }
        update()
        const observer = new MutationObserver(update)
        if (element) observer.observe(element, {attributes: true, attributeFilter: ["style"]})
        window.addEventListener("resize", update)
        window.addEventListener("scroll", update, true)
        return () => {
            observer.disconnect()
            window.removeEventListener("resize", update)
            window.removeEventListener("scroll", update, true)
        }
    }, [card.id])
    return (
        <div data-tricks-spectator-presentation={log.id} data-tricks-spectator-card={card.event_card_id}
            style={{position: "absolute", inset: 0, zIndex: 50, pointerEvents: "none"}}>
            <TricksFieldDetailPanel
                className={`tricks-field-detail-panel-${position.side}`}
                scoreType={card.score_type}
                rankings={rankings}
                taker={card?.taker}
                takerRemainder={card?.provisional_taker_remainder}
                usersById={usersById}
                highlightedPost={blinking ? log : null}
                summary={`#${card.stage_id} ${card.title || ""}（${card.rule_name || ""}）`}
                style={{position: "absolute", ...position.style, width: fieldDetailModalWidth, pointerEvents: "auto"}}
            >
                {error && <span role="status">ランキングを再取得しています</span>}
            </TricksFieldDetailPanel>
        </div>
    )
}
