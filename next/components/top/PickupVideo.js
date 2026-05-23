import {Box, Typography} from "@mui/material"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {faForward, faVideo} from "@fortawesome/free-solid-svg-icons"
import YouTube from "react-youtube"
import useSWR from "swr"
import {useEffect, useMemo, useState} from "react"
import {fetcher, id2name, useLocale} from "../../lib/pik5"
import {TopBox, TopBoxContent, TopBoxHeader} from "../../styles/pik5.css"
import {score2str} from "../../lib/factory"

const extractYouTubeId = (value) => {
    if (typeof value !== "string" || value.trim() === "") return null

    try {
        const url = new URL(value)
        const host = url.hostname.replace(/^www\./, "")

        let id = null

        if (host === "youtu.be") {
            id = url.pathname.split("/").filter(Boolean)[0] || null
        }

        if (host === "youtube.com" || host === "m.youtube.com") {
            if (url.pathname === "/watch") id = url.searchParams.get("v")
            if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2] || null
            if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2] || null
        }

        return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : null
    } catch {
        return null
    }

    return null
}

const selectWeightedIndex = (records) => {
    const total = records.reduce((sum, _record, index) => sum + records.length - index, 0)
    let point = Math.random() * total

    for (let index = 0; index < records.length; index++) {
        point -= records.length - index
        if (point < 0) return index
    }

    return 0
}

const createWeightedQueue = (records) => {
    const remaining = [...records]
    const queue = []

    while (remaining.length > 0) {
        const index = selectWeightedIndex(remaining)
        const [selected] = remaining.splice(index, 1)
        queue.push(selected)
    }

    return queue
}

const getPlayerName = (record, users) => record?.user_name || id2name(users, record?.user_id)

const hiddenRuleIds = [10, 21, 22]

const getRuleName = (record, t) => {
    if (hiddenRuleIds.includes(Number(record?.rule))) return ""

    const stageRule = t.stage?.[record?.stage_id + "-" + record?.rule]
    const rule = t.rule?.[record?.rule]

    return stageRule || rule || ""
}

const getStageName = (record, t) => {
    return t.stage[record?.stage_id] || record?.stage_id || ""
}

const getStageWithRuleLabel = (record, t) => {
    const stageName = getStageName(record, t)
    const ruleName = getRuleName(record, t)

    if (!ruleName) return stageName

    return (
        <>
            {stageName}
            <br/>
            <span style={{fontSize: "0.85em"}}>（{ruleName}）</span>
        </>
    )
}

const getVideoLabel = (record, users, t) => {
    if (!record) return "この動画が最後です"

    const ruleName = getRuleName(record, t)
    const stageName = ruleName ? `${getStageName(record, t)}（${ruleName}）` : getStageName(record, t)

    return `${getPlayerName(record, users)} - ${stageName} - ${score2str(record.score, record.rule, record.stage_id)}`
}

export default function PickupVideo({users}) {
    const {t} = useLocale()
    const [queue, setQueue] = useState([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isVideoLoading, setIsVideoLoading] = useState(false)
    const {data, error} = useSWR("/api/server/new?limit=200", fetcher)

    const candidates = useMemo(() => {
        const records = Array.isArray(data?.data) ? data.data : []

        return records
            .map((record) => ({
                ...record,
                youtubeId: extractYouTubeId(record.video_url),
            }))
            .filter((record) => record.youtubeId)
            .sort((a, b) => Number(b.rps ?? 0) - Number(a.rps ?? 0))
            .slice(0, 40)
    }, [data])

    useEffect(() => {
        if (queue.length > 0 || candidates.length === 0) return

        setQueue(createWeightedQueue(candidates))
    }, [candidates, queue.length])

    const selected = queue[currentIndex] ?? null
    const nextVideo = queue[currentIndex + 1] ?? null
    const isLastVideo = queue.length > 0 && currentIndex >= queue.length - 1
    const canMoveNext = Boolean(nextVideo) && !isVideoLoading
    const progressText = queue.length > 0 ? `${currentIndex + 1}/${queue.length}` : ""
    const nextButtonText = `次の動画：${getVideoLabel(nextVideo, users, t)}${progressText ? `（${progressText}）` : ""}`

    const moveNext = () => {
        if (!nextVideo || isVideoLoading) return

        setIsVideoLoading(true)
        setCurrentIndex((index) => index + 1)
    }

    const handleVideoReady = () => {
        setIsVideoLoading(false)
    }

    const handleVideoPlay = () => {
        setIsVideoLoading(false)
    }

    const handleVideoEnd = () => {
        if (isLastVideo) return

        moveNext()
    }

    const handleVideoError = () => {
        if (!nextVideo) {
            setQueue((current) => current.filter((_record, index) => index !== currentIndex))
            setCurrentIndex((index) => Math.max(0, Math.min(index, queue.length - 2)))
            setIsVideoLoading(false)
            return
        }

        setQueue((current) => current.filter((_record, index) => index !== currentIndex))
        setIsVideoLoading(true)
    }

    return (
        <TopBox className="top-box" style={{height: "100%"}}>
            <TopBoxHeader className="top-box-header">
                <span><FontAwesomeIcon icon={faVideo}/> ピックアップ動画</span>
            </TopBoxHeader>
            <TopBoxContent className="top-box-content">
                {error &&
                    <Typography style={{fontSize: "0.9em", color: "#999"}}>
                        ピックアップ動画を取得できませんでした。
                    </Typography>
                }
                {!error && data && !selected &&
                    <Typography style={{fontSize: "0.9em", color: "#999"}}>
                        ピックアップ動画はありません
                    </Typography>
                }
                {!error && selected &&
                    <>
                        <Box style={{aspectRatio: "16 / 9", overflow: "hidden", width: "100%"}}>
                            <YouTube
                                videoId={selected.youtubeId}
                                opts={{
                                    height: "100%",
                                    width: "100%",
                                    playerVars: {
                                        autoplay: 1,
                                        mute: 1,
                                        playsinline: 1,
                                        controls: 1,
                                    },
                                }}
                                onEnd={handleVideoEnd}
                                onError={handleVideoError}
                                onReady={handleVideoReady}
                                onPlay={handleVideoPlay}
                                style={{height: "100%", width: "100%"}}
                                iframeClassName="pickup-video-iframe"
                            />
                        </Box>
                        <Box style={{display: "grid", gap: "8px", fontSize: "0.86em", marginTop: "10px"}}>
                            <Box style={{display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", gap: "8px"}}>
                                <Box style={{minWidth: 0}}>
                                    <div style={{color: "#888", fontSize: "0.78em", lineHeight: 1.2}}>プレイヤー名</div>
                                    <div style={{fontWeight: "bold", lineHeight: 1.35, overflowWrap: "anywhere"}}>{getPlayerName(selected, users)}</div>
                                </Box>
                                <Box style={{minWidth: 0}}>
                                    <div style={{color: "#888", fontSize: "0.78em", lineHeight: 1.2}}>ステージ名</div>
                                    <div style={{fontWeight: "bold", lineHeight: 1.35, overflowWrap: "anywhere"}}>{getStageWithRuleLabel(selected, t)}</div>
                                </Box>
                                <Box style={{minWidth: 0}}>
                                    <div style={{color: "#888", fontSize: "0.78em", lineHeight: 1.2}}>順位</div>
                                    <div style={{fontWeight: "bold", lineHeight: 1.35}}>{selected.post_rank}位</div>
                                </Box>
                                <Box style={{minWidth: 0}}>
                                    <div style={{color: "#888", fontSize: "0.78em", lineHeight: 1.2}}>スコア</div>
                                    <div style={{fontWeight: "bold", lineHeight: 1.35}}>{score2str(selected.score, selected.rule, selected.stage_id)}</div>
                                </Box>
                            </Box>
                            <button
                                type="button"
                                onClick={moveNext}
                                disabled={!canMoveNext}
                                style={{
                                    background: canMoveNext ? "var(--color-block-header-bg)" : "#aaa",
                                    border: "none",
                                    borderRadius: "4px",
                                    color: canMoveNext ? "var(--color-block-header-text)" : "#f5f5f5",
                                    cursor: canMoveNext ? "pointer" : "default",
                                    font: "inherit",
                                    marginTop: "6px",
                                    padding: "7px 8px",
                                    textAlign: "left",
                                }}
                            >
                                <FontAwesomeIcon icon={faForward} />
                                {isVideoLoading ? "次の動画を読み込み中..." : nextButtonText}
                            </button>
                        </Box>
                    </>
                }
            </TopBoxContent>
        </TopBox>
    )
}
