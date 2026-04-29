import {Box, Typography} from "@mui/material"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {faCalendarDays, faImage} from "@fortawesome/free-solid-svg-icons"
import useSWR from "swr"
import {fetcher} from "../../lib/pik5"
import {TopBox, TopBoxContent, TopBoxHeader} from "../../styles/pik5.css"

const DISCORD_GUILD_ID = "418790157500678164"

const getEventUrl = (event) => `https://discord.com/events/${DISCORD_GUILD_ID}/${event.id}`

const isUrl = (value) => {
    if (!value) return false

    try {
        const url = new URL(value)
        return ["http:", "https:"].includes(url.protocol)
    } catch {
        return false
    }
}

const formatStartTime = (value) => {
    if (!value) return ""

    return new Intl.DateTimeFormat("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value))
}

const formatRemaining = (value) => {
    if (!value) return ""

    const diff = Math.max(0, new Date(value).getTime() - Date.now())
    const totalMinutes = Math.floor(diff / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = String(totalMinutes % 60).padStart(2, "0")

    return `${hours}:${minutes}`
}

const truncateDescription = (value) => {
    if (!value) return "イベント概要はありません。"
    if (value.length < 200) return value

    return value.slice(0, 197) + "..."
}

export default function NextEvent() {
    const {data, error} = useSWR("/api/server/discord/events", fetcher)
    const event = data?.data ?? null

    if (error) {
        return (
            <TopBox className="top-box">
                <TopBoxHeader className="top-box-header">
                    <span><FontAwesomeIcon icon={faCalendarDays}/> 次のイベント</span>
                </TopBoxHeader>
                <TopBoxContent className="top-box-content">
                    <Typography style={{fontSize: "0.9em", color: "#999"}}>
                        イベント情報を取得できませんでした。
                    </Typography>
                </TopBoxContent>
            </TopBox>
        )
    }

    if (!event) {
        return (
            <TopBox className="top-box">
                <TopBoxHeader className="top-box-header">
                    <span><FontAwesomeIcon icon={faCalendarDays}/> 次のイベント</span>
                </TopBoxHeader>
                <TopBoxContent className="top-box-content">
                    <Typography style={{fontSize: "0.9em", color: "#999"}}>
                        予定されているイベントはありません。
                    </Typography>
                </TopBoxContent>
            </TopBox>
        )
    }

    const eventUrl = getEventUrl(event)
    const href = isUrl(event.location) ? event.location : eventUrl
    const isActive = Number(event.status) === 2
    const statusText = isActive ? "ただいま開催中！" : `開催まで ${formatRemaining(event.scheduled_start_time)}`

    return (
        <TopBox
            className="top-box"
            component="a"
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{
                borderColor: isActive ? "#d64242" : undefined,
                color: "inherit",
                cursor: "pointer",
                display: "block",
                height: "100%",
                textDecoration: "none",
            }}
        >
            <TopBoxHeader className="top-box-header">
                <span><FontAwesomeIcon icon={faCalendarDays}/> 次のイベント</span>
            </TopBoxHeader>
            <TopBoxContent className="top-box-content">
                <Box style={{display: "grid", gridTemplateColumns: "96px 1fr", gap: "10px", alignItems: "start"}}>
                    <Box
                        style={{
                            alignItems: "center",
                            aspectRatio: "1 / 1",
                            backgroundColor: "#f0f0f0",
                            backgroundImage: event.image_url ? `url(${event.image_url})` : "none",
                            backgroundPosition: "center",
                            backgroundSize: "cover",
                            borderRadius: "4px",
                            display: "flex",
                            justifyContent: "center",
                            maxWidth: "100px",
                            overflow: "hidden",
                            width: "96px",
                        }}
                    >
                        {!event.image_url && <FontAwesomeIcon icon={faImage} style={{color: "#999"}} />}
                    </Box>
                    <Box style={{minWidth: 0}}>
                        <Typography style={{fontWeight: "bold", lineHeight: 1.35, overflowWrap: "anywhere"}}>
                            {event.name}
                        </Typography>
                        <Typography style={{fontSize: "0.82em", color: "#777", lineHeight: 1.45, marginTop: "4px", overflowWrap: "anywhere"}}>
                            {truncateDescription(event.description)}
                        </Typography>
                    </Box>
                </Box>
                <Box style={{display: "grid", gridTemplateColumns: "5fr 5fr 2fr", gap: "8px", fontSize: "0.86em", marginTop: "10px"}}>
                    <Box style={{minWidth: 0}}>
                        <div style={{color: "#888", fontSize: "0.78em", lineHeight: 1.2}}>開始日時</div>
                        <div style={{fontWeight: "bold", lineHeight: 1.35}}>{formatStartTime(event.scheduled_start_time)}</div>
                    </Box>
                    <Box style={{minWidth: 0}}>
                        <div style={{color: "#888", fontSize: "0.78em", lineHeight: 1.2}}>ステータス</div>
                        <div style={{color: isActive ? "#d64242" : "inherit", fontWeight: "bold", lineHeight: 1.35}}>{statusText}</div>
                    </Box>
                    <Box style={{minWidth: 0}}>
                        <div style={{color: "#888", fontSize: "0.78em", lineHeight: 1.2}}>参加予定人数</div>
                        <div style={{fontWeight: "bold", lineHeight: 1.35}}>{event.user_count ?? 0}人</div>
                    </Box>
                </Box>
            </TopBoxContent>
        </TopBox>
    )
}
