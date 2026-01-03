import Button from "@mui/material/Button";
import {Box, Grid, Typography} from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from 'rehype-raw';
import React, {useEffect, useState} from "react";
import ModalKeywordEdit from "./ModalKeywordEdit";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import {StairIcon} from "../../styles/pik5.css";
import {dateFormat, id2name, useLocale} from "../../lib/pik5";
import Head from "next/head";

function extractYouTubeId(urlStr) {
  try {
    const u = new URL(urlStr)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      // e.g. https://youtu.be/VIDEOID
      return u.pathname.split('/').filter(Boolean)[0] || null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null
    }
    if (host === 'youtube.com') return u.searchParams.get('v')
  } catch (_) { /* ignore */ }
  return null
}

function extractTwitchVideoInfo(urlStr) {
  try {
    const u = new URL(urlStr)
    const host = u.hostname.replace(/^www\./, '')
    if (host !== 'twitch.tv' && host !== 'm.twitch.tv') return null

    // e.g. https://www.twitch.tv/videos/2625545819?t=06h32m19s
    const m = u.pathname.match(/^\/videos\/(\d+)/)
    if (!m) return null

    const id = m[1]
    const t = u.searchParams.get('t')

    // Twitch embed uses `time=` (same format as `t=` share links)
    const time = t ? String(t) : null

    return {id, time}
  } catch (_) { /* ignore */ }
  return null
}

function replaceTwitchUrlsWithEmbed(text, opts = {}) {
  if (!text) return ''
  const parent = opts.twitchParent || 'localhost'

  // Matches: https://www.twitch.tv/videos/2625545819?t=06h32m19s
  const urlRe = /(https?:\/\/(?:www\.)?(?:twitch\.tv)\/videos\/\d+(?:\?[^\s\)\]>"]+)??)(?=\s|$|\)|\]|>)/g

  return text.replace(urlRe, (match) => {
    const info = extractTwitchVideoInfo(match)
    if (!info) return match

    const params = new URLSearchParams()
    params.set('video', info.id)
    params.set('parent', parent)
    params.set('autoplay', 'false')
    if (info.time) params.set('time', info.time)

    const src = `https://player.twitch.tv/?${params.toString()}`

    return `\n<div class="twitch-embed"><iframe src="${src}" frameborder="0" allowfullscreen loading="lazy"></iframe></div>\n`
  })
}

function replaceYouTubeUrlsWithEmbed(text) {
  if (!text) return ''
  const urlRe = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[\w\-?=&%#/.]+)(?=\s|$|\)|\]|>)/g
  return text.replace(urlRe, (match) => {
    const vid = extractYouTubeId(match)
    if (!vid) return match
    const src = `https://www.youtube-nocookie.com/embed/${vid}`
    return `\n<div class="yt-embed"><iframe src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>\n`
  })
}

function linkifyWikiLinks(text, opts = {}) {
  if (!text) return ''
  // 1) ![画像ID] → 画像URLに展開（13桁16進 + 許可拡張子）
  const withImages = text.replace(/!\[([0-9a-fA-F]{13}\.(?:jpg|jpeg|png|gif|webp|avif))]/g, (m, imageId) => {
    const src = `/api/file/keyword/${imageId}`
    return `<img src="${src}" alt="${imageId}" style="max-width:560px;height:auto;" />\n`
  })
  // 2) [[用語]] → /keyword/用語 にリンク化
  const withWiki = withImages.replace(/\[\[([^\[\]]+)]]/g, (match, p1) => {
    const label = String(p1)
    const href = `/keyword/${encodeURIComponent(label)}`
    return `[${label}](${href})`
  })
  // 3) YouTube URL（短縮/shorts/embed含む）→ 埋め込みiframe
  const withYouTube = replaceYouTubeUrlsWithEmbed(withWiki)

  // 4) Twitch videos URL → 埋め込みiframe
  return replaceTwitchUrlsWithEmbed(withYouTube, opts)
}

export function KeywordContent({data, users}){

    const {t} = useLocale()

    const [open, setOpen] = useState(false)
    const handleOpen = () => {
        setOpen(true)
    }
    const handleClose = () => {
        setOpen(false)
    }
    const date = new Date(data.updated_at ?? "2006-09-01 00:00:00")
    const [isClient, setIsClient] = useState(false)
    useEffect(() => setIsClient(true), [])

    const twitchParent = isClient ? window.location.hostname : null
    const mdContent = React.useMemo(
      () => linkifyWikiLinks(data.content, {twitchParent}),
      [data.content, twitchParent]
    )

    // アンダーバーや下線をスペースに置換する関数
    const customReplace = str => str?.replace(/＿＿|__|＿|_/g, m => ({'__': '_', '＿＿': '＿', '_': ' ', '＿': '　'}[m]))

    const displayKeyword = customReplace(data.keyword)

    return (
        <>
            <style jsx global>{`
              .markdown-content .yt-embed,
              .markdown-content .twitch-embed {
                position: relative;
                width: 100%;
                max-width: 800px;
                margin: 12px 0;
                aspect-ratio: 16 / 9;
              }

              .markdown-content .yt-embed iframe,
              .markdown-content .twitch-embed iframe {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                border: 0;
              }

              /* Fallback for older browsers */
              @supports not (aspect-ratio: 16 / 9) {
                .markdown-content .yt-embed,
                .markdown-content .twitch-embed {
                  height: 0;
                  padding-top: 56.25%;
                }
              }
            `}</style>
            <Typography variant="" style={{fontSize:"0.8em",color:"#777"}}>{data.yomi}</Typography><br/>
            <Typography variant="" className="mini-title">
                <Link href={`/keyword/${data.keyword}`}>{displayKeyword}</Link>
            </Typography><br/>
            <Box style={{
                borderTop: "1px solid #555",
                borderBottom: "1px solid #555",
                marginBottom: "1em"
            }}>
                <Button variant="outlined" style={{margin:"8px",padding:"2px"}}>
                    <Link href={`/keyword/${data.tag}`}>{data.tag}</Link>
                </Button>
                <Box style={{
                    padding: "20px",
                    lineHeight: "1.6em",
                }}>
                    <ReactMarkdown
                        className="markdown-content"
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}>
                        {mdContent}
                    </ReactMarkdown>
                </Box>
            </Box>
            <Grid container spacing={1.5} style={{marginBottom:"2em"}}>
                <Grid item xs={6}>
                    <Button type="button" variant="contained" onClick={handleOpen}>{t.g.edit}</Button>
                </Grid>
                <Grid item xs={6} style={{textAlign:"right"}}>
                    <Typography variant="span" className="subtitle">{id2name(users, data.last_editor)} (<time dateTime={date.toISOString()}>{isClient ? dateFormat(date) : ''}</time>)</Typography>
                </Grid>
            </Grid>
            <ModalKeywordEdit uniqueId={data.unique_id} editOpen={open} handleEditClose={handleClose}/>
        </>
    )
}