import Link from "next/link"
import {useEffect, useState} from "react"
import {Button} from "@mui/material"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {faCalendarDays} from "@fortawesome/free-solid-svg-icons"
import useSWR from "swr"
import {tricksFetcher, formatRemaining} from "../../lib/tricks"
import {TopBox, TopBoxContent, TopBoxHeader, WrapTopBox} from "../../styles/pik5.css"

export default function TricksActiveEvent({children}) {
    const {data: event} = useSWR("/api/server/tricks/tournament", tricksFetcher, {refreshInterval: 30000})
    const startAt = Date.parse(event?.start_at)
    const endAt = Date.parse(event?.end_at)
    const [now, setNow] = useState(0)
    useEffect(() => {
        if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return undefined
        let timer
        const updateClock = () => {
            const current = Date.now()
            setNow(current)
            if (current >= endAt) return
            // 開催前は開始境界だけ待ち、開催中は秒表示と終了境界を更新する。
            const delay = current < startAt ? Math.min(startAt - current, 2147483647) : Math.min(1000, endAt - current)
            timer = window.setTimeout(updateClock, delay)
        }
        updateClock()
        return () => window.clearTimeout(timer)
    }, [startAt, endAt])
    const visible = Boolean(event?.event_id && event.state !== "ended" && now >= startAt && now < endAt)
    if (!visible) return children || null
    const endAtLabel = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(new Date(endAt))

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
                        <div style={{fontSize: "0.9em"}}>終了日時：{endAtLabel}</div>
                        <div data-tricks-active-remaining style={{fontSize: "0.9em"}}>残り {formatRemaining(endAt, now)}</div>
                        <div style={{fontSize: "0.9em"}}>参加者数：{event.participant_count ?? 0}人</div>
                    </div>
                </div>
            </TopBoxContent>
        </TopBox>
    </WrapTopBox>
}
