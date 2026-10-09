import Link from "next/link"
import {useEffect, useState} from "react"
import {Button} from "@mui/material"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {faCalendarDays} from "@fortawesome/free-solid-svg-icons"
import useSWR from "swr"
import {tricksFetcher, formatRemaining} from "../../lib/tricks"
import {TopBox, TopBoxContent, TopBoxHeader, WrapTopBox} from "../../styles/pik5.css"

const EVENT_ID = "251227"
const START_AT = Date.parse("2026-10-09T20:00:00+09:00")
const END_AT = Date.parse("2026-10-11T20:00:00+09:00")

export default function TricksActiveEvent({children}) {
    const {data: event} = useSWR(`/api/server/tricks/tournament?event_id=${EVENT_ID}`, tricksFetcher, {refreshInterval: 30000})
    const [now, setNow] = useState(0)
    useEffect(() => {
        let timer
        const updateClock = () => {
            const current = Date.now()
            setNow(current)
            if (current >= END_AT) return
            // 開催前は開始境界だけ待ち、開催中は秒表示と終了境界を更新する。
            const delay = current < START_AT ? START_AT - current : Math.min(1000, END_AT - current)
            timer = window.setTimeout(updateClock, delay)
        }
        updateClock()
        return () => window.clearTimeout(timer)
    }, [])
    const visible = String(event?.event_id) === EVENT_ID && now >= START_AT && now < END_AT
    if (!visible) return children || null
    const endAt = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(new Date(END_AT))

    return <WrapTopBox item xs={12} className="wrap-top-box top-split-column-item">
        <TopBox className="top-box" data-tricks-active-event>
            <TopBoxHeader className="top-box-header">
                <span><FontAwesomeIcon icon={faCalendarDays}/> 期間限定ランキング開催中</span>
            </TopBoxHeader>
            <TopBoxContent className="top-box-content">
                <div>
                    <div style={{fontWeight: "bold"}}>{event.rule_name || "トリックテイキング制×スタンダード"}</div>
                    <Button style={{width:"100%"}} component={Link} href={`/limited/trick`} variant="contained">大会会場へ/Enter</Button>
                    <div style={{display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8}}>
                        <div style={{fontSize: "0.9em"}}>終了日時：{endAt}</div>
                        <div data-tricks-active-remaining style={{fontSize: "0.9em"}}>残り {formatRemaining(END_AT, now)}</div>
                        <div style={{fontSize: "0.9em"}}>参加者数：{event.participant_count ?? 0}人</div>
                    </div>
                </div>
            </TopBoxContent>
        </TopBox>
    </WrapTopBox>
}
