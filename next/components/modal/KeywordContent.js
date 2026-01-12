import Button from "@mui/material/Button";
import {Box, Grid, Typography} from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from 'rehype-raw';
import React, {useEffect, useRef, useState} from "react";
import ModalKeywordEdit from "./ModalKeywordEdit";
import Link from "next/link";
import {dateFormat, id2name, useLocale} from "../../lib/pik5";

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
        if (!info || !/^\d+$/.test(String(info.id))) return match

        // TwitchのプレイヤーURL（クリック時に使う。ここでは data-src に入れるだけ）
        const params = new URLSearchParams()
        params.set('video', String(info.id))
        params.set('parent', parent)
        params.set('autoplay', 'false')
        if (info.time) params.set('time', info.time)

        const src = `https://player.twitch.tv/?${params.toString()}`

        // Twitchはサムネ取得が簡単ではないため、軽量なプレースホルダにする
        const safeSrc = escapeHtmlAttr(src)
        const safeLink = escapeHtmlAttr(match)

        return `\n<div class="embed embed--twitch js-embed" data-provider="twitch" data-src="${safeSrc}">
<button type="button" class="embed__btn js-embed-btn" aria-label="動画を再生（Twitch）">
<div class="embed__meta">
<div class="embed__title">クリックして再生</div>
<div class="embed__url">${safeLink}</div>
</div>
<span class="embed__play" aria-hidden="true"></span>
</button>
<noscript>
<a href="${safeLink}" rel="noopener noreferrer" target="_blank">Twitchで開く</a>
</noscript>
</div>\n`
    })
}

function escapeHtmlAttr(s) {
    return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
}

function replaceYouTubeUrlsWithEmbed(text) {
    if (!text) return ''
    const urlRe = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[\w\-?=&%#\/.]+)(?=\s|$|\)|]|>)/g

    return text.replace(urlRe, (match) => {
        const vid = extractYouTubeId(match)

        // videoIdは安全のため強めに制限（想定外なら置換しない）
        if (!vid || !/^[a-zA-Z0-9_-]{11}$/.test(vid)) return match

        const safeVid = escapeHtmlAttr(vid)
        const thumb = `https://i.ytimg.com/vi/${safeVid}/hqdefault.jpg`

        // src は生成しない（クリック時に生成）
        // data-ytid だけ渡す
        return `\n<div class="embed embed--yt js-embed" data-provider="youtube" data-ytid="${safeVid}">
<button type="button" class="embed__btn js-embed-btn" aria-label="動画を再生">
<img class="embed__thumb" src="${thumb}" alt="" loading="lazy" decoding="async">
<span class="embed__play" aria-hidden="true"></span>
</button>
<noscript>
<a href="https://www.youtube.com/watch?v=${safeVid}" rel="noopener noreferrer" target="_blank">YouTubeで開く</a>
</noscript>
</div>\n`
    })
}

function buildYouTubeSrc(videoId) {
    const params = new URLSearchParams()
    // autoplayはクリック起点のため許可しても安全寄り（ユーザー操作）
    params.set('autoplay', '1')
    params.set('playsinline', '1')
    // 余計な挙動を減らす（必要なら調整）
    params.set('rel', '0')

    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

function deactivateAllEmbeds(root) {
    const r = root || document
    r.querySelectorAll('.js-embed.is-active').forEach((wrap) => {
        const iframe = wrap.querySelector('iframe')
        if (iframe) iframe.remove()
        wrap.classList.remove('is-active')

        const btn = wrap.querySelector('.js-embed-btn')
        if (btn) btn.hidden = false
    })
}

function activateEmbed(wrap, root) {
    const provider = wrap.getAttribute('data-provider')
    const btn = wrap.querySelector('.js-embed-btn')
    if (!provider || !btn) return

    // 既存の再生中iframeを破棄（iOS Safari対策として有効になりやすい）
    deactivateAllEmbeds(root)

    let src = ''
    if (provider === 'youtube') {
        const ytid = wrap.getAttribute('data-ytid')
        if (!ytid || !/^[a-zA-Z0-9_-]{11}$/.test(ytid)) return
        src = buildYouTubeSrc(ytid)
    } else if (provider === 'twitch') {
        const s = wrap.getAttribute('data-src')
        if (!s) return
        src = s
    } else {
        return
    }

    const iframe = document.createElement('iframe')
    iframe.src = src

    iframe.setAttribute('frameborder', '0')
    iframe.setAttribute('allowfullscreen', '')

    if (provider === 'youtube') {
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share')
    }

    // セキュリティ寄りの設定（必要に応じて）
    iframe.setAttribute('referrerpolicy', 'origin-when-cross-origin')

    btn.hidden = true
    wrap.classList.add('is-active')
    wrap.appendChild(iframe)
}

function initLazyEmbeds(root) {
    const r = root || document

    // 二重バインド回避
    r.querySelectorAll('.js-embed').forEach((wrap) => {
        if (wrap.__lazyEmbedBound) return
        wrap.__lazyEmbedBound = true

        const btn = wrap.querySelector('.js-embed-btn')
        if (!btn) return

        btn.addEventListener('click', () => {
            activateEmbed(wrap, r)
        }, { passive: true })
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

    const mdRootRef = useRef(null)

    const twitchParent = isClient ? window.location.hostname : null
    const mdContent = React.useMemo(
      () => linkifyWikiLinks(data.content, {twitchParent}),
      [data.content, twitchParent]
    )

    useEffect(() => {
        if (!isClient) return
        if (!mdRootRef.current) return

        // クリックでiframe生成（YouTube/Twitch）
        initLazyEmbeds(mdRootRef.current)

        // ページ遷移/再描画時のメモリ圧迫を避ける
        return () => {
            deactivateAllEmbeds(mdRootRef.current)
        }
    }, [isClient, mdContent])

    // アンダーバーや下線をスペースに置換する関数
    const customReplace = str => str?.replace(/＿＿|__|＿|_/g, m => ({'__': '_', '＿＿': '＿', '_': ' ', '＿': '　'}[m]))

    const displayKeyword = customReplace(data.keyword)

    return (
        <>
            <style jsx global>{`
              .markdown-content .embed {
                position: relative;
                width: 100%;
                max-width: 800px;
                margin: 12px 0;
                aspect-ratio: 16 / 9;
              }

              .markdown-content .embed iframe,
              .markdown-content .embed .embed__btn {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                border: 0;
                display: block;
              }

              .markdown-content .embed .embed__btn {
                padding: 0;
                background: transparent;
                cursor: pointer;
              }

              .markdown-content .embed .embed__thumb {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
              }

              /* Twitch placeholder layout */
              .markdown-content .embed--twitch .embed__meta {
                position: absolute;
                inset: 0;
                padding: 12px;
                box-sizing: border-box;
                overflow: hidden;
              }

              .markdown-content .embed--twitch .embed__url {
                word-break: break-all;
                opacity: 0.7;
                font-size: 0.9em;
              }

              /* Fallback for older browsers */
              @supports not (aspect-ratio: 16 / 9) {
                .markdown-content .embed {
                  height: 0;
                  padding-top: 56.25%;
                }

                .markdown-content .embed iframe,
                .markdown-content .embed .embed__btn {
                  position: absolute;
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
                <Box
                  ref={mdRootRef}
                  style={{
                    padding: "20px",
                    lineHeight: "1.6em",
                  }}
                >
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