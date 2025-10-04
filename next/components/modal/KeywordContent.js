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

function replaceYouTubeUrlsWithEmbed(text) {
  if (!text) return ''
  const urlRe = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[\w\-?=&%#/.]+)(?=\s|$|\)|\]|>)/g
  return text.replace(urlRe, (match) => {
    const vid = extractYouTubeId(match)
    if (!vid) return match
    const src = `https://www.youtube-nocookie.com/embed/${vid}`
    return `\n<div class="yt-embed"><iframe width="560" height="315" src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>\n`
  })
}

function linkifyWikiLinks(text) {
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
  return replaceYouTubeUrlsWithEmbed(withWiki)
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

    const mdContent = React.useMemo(() => linkifyWikiLinks(data.content), [data.content])

    // アンダーバーや下線をスペースに置換する関数
    const customReplace = str => str.replace(/＿＿|__|＿|_/g, m => ({'__': '_', '＿＿': '＿', '_': ' ', '＿': '　'}[m]))

    const displayKeyword = customReplace(data.keyword)

    return (
        <>
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