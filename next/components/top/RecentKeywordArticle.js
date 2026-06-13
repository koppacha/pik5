import Link from "next/link"
import {Box, Typography} from "@mui/material"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {faNewspaper} from "@fortawesome/free-solid-svg-icons"
import useSWR from "swr"
import {dateFormat, fetcher, getUserName} from "../../lib/pik5"
import {TopBox, TopBoxContent, TopBoxHeader} from "../../styles/pik5.css"

const buildPlainText = (value) => String(value || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/!\[[^\]]*]/g, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_~>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim()

const truncateText = (value, maxLength = 200) => {
    if (!value) return ""

    return value.slice(0, maxLength) + "..."
}

const buildPreview = (value) => truncateText(buildPlainText(value))

export default function RecentKeywordArticle({users}) {
    const {data, error} = useSWR("/api/server/keyword/resolve/recent", fetcher)
    const item = data?.data?.items?.[0] ?? null

    if (error) {
        return (
            <TopBox className="top-box">
                <TopBoxHeader className="top-box-header">
                    <span><FontAwesomeIcon icon={faNewspaper}/> 新着キーワード記事</span>
                </TopBoxHeader>
                <TopBoxContent className="top-box-content">
                    <Typography style={{fontSize: "0.9em", color: "#999"}}>
                        新着キーワード記事を取得できませんでした。
                    </Typography>
                </TopBoxContent>
            </TopBox>
        )
    }

    if (data && !item) {
        return (
            <TopBox className="top-box">
                <TopBoxHeader className="top-box-header">
                    <span><FontAwesomeIcon icon={faNewspaper}/> 新着キーワード記事</span>
                </TopBoxHeader>
                <TopBoxContent className="top-box-content">
                    <Typography style={{fontSize: "0.9em", color: "#999"}}>
                        新着キーワード記事はありません。
                    </Typography>
                </TopBoxContent>
            </TopBox>
        )
    }

    if (!item) {
        return (
            <TopBox className="top-box">
                <TopBoxHeader className="top-box-header">
                    <span><FontAwesomeIcon icon={faNewspaper}/> 新着キーワード記事</span>
                </TopBoxHeader>
                <TopBoxContent className="top-box-content">
                    <Typography style={{fontSize: "0.9em", color: "#999"}}>
                        読み込み中...
                    </Typography>
                </TopBoxContent>
            </TopBox>
        )
    }

    const href = `/keyword/${encodeURIComponent(item.keyword)}`
    const preview = buildPreview(item.content)
    const updatedAt = new Date(item.updated_at)

    return (
        <TopBox
            className="top-box"
            component={Link}
            href={href}
            style={{
                color: "inherit",
                cursor: "pointer",
                display: "block",
                height: "100%",
                textDecoration: "none",
            }}
        >
            <TopBoxHeader className="top-box-header">
                <span><FontAwesomeIcon icon={faNewspaper}/> 新着キーワード記事</span>
            </TopBoxHeader>
            <TopBoxContent className="top-box-content" style={{display: "flex", flexDirection: "column", minHeight: 0}}>
                <Typography style={{fontWeight: "bold", lineHeight: 1.35, overflowWrap: "anywhere"}}>
                    {item.keyword}
                </Typography>
                <Box
                    className="keyword-preview-content"
                    style={{
                        color: "#777",
                        fontSize: "0.82em",
                        lineHeight: 1.45,
                        marginTop: "4px",
                        overflowWrap: "anywhere",
                    }}
                >
                    {preview || "本文はありません。"}
                </Box>
                <Box style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.86em", marginTop: "10px"}}>
                    <Box style={{minWidth: 0}}>
                        <div style={{color: "#888", fontSize: "0.78em", lineHeight: 1.2}}>編集日</div>
                        <div style={{fontWeight: "bold", lineHeight: 1.35}}>{dateFormat(updatedAt)}</div>
                    </Box>
                    <Box style={{minWidth: 0}}>
                        <div style={{color: "#888", fontSize: "0.78em", lineHeight: 1.2}}>編集者名</div>
                        <div style={{fontWeight: "bold", lineHeight: 1.35, overflowWrap: "anywhere"}}>
                            {getUserName(users, item.last_editor)}
                        </div>
                    </Box>
                </Box>
            </TopBoxContent>
        </TopBox>
    )
}
