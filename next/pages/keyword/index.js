import {Box, Card, CardContent, CircularProgress, Divider, Grid, Stack, Typography} from "@mui/material";
import ModalKeywordEdit from "../../components/modal/ModalKeywordEdit";
import React, {useEffect, useRef, useState} from "react";
import useSWR, {mutate} from "swr";
import {fetcher, useLocale} from "../../lib/pik5";
import {InfoBox, RuleBox, StairIcon, TopBox, TopBoxContent, TopBoxHeader, WrapTopBox} from "../../styles/pik5.css";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCertificate, faHouseChimney, faLayerGroup, faStairs, faTowerCell} from "@fortawesome/free-solid-svg-icons";
import PullDownKeywordCategory from "../../components/form/PullDownKeywordCategory";
import ModalKeyword from "../../components/modal/ModalKeyword";
import Head from "next/head";
import prisma from "../../lib/prisma";
import {useSession} from "next-auth/react";
import dynamic from "next/dynamic";
import NewRecords from "../../components/top/NewRecords";
import Button from "@mui/material/Button";

export async function getServerSideProps(context){

    // スクリーンネームをリクエスト（検索用）
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })

    return {
        props: {
            users
        }
    }
}
// KeywordContent は長文レンダリングやクライアント依存がある可能性が高いので SSR 無効化
const KeywordContent = dynamic(
  () => import('../../components/modal/KeywordContent').then(m => m.default || m.KeywordContent),
  { ssr: false }
)

// ---- ヘルパ：proxy/生レスポンス両対応で JSON を取り出す ----
async function fetchJson(url, init) {
    const res = await fetch(url, init)
    const text = await res.text()
    let payload
    try { payload = JSON.parse(text) } catch { payload = text }
    // proxy が { data: ... } を返すパターン／Laravel がそのまま返すパターン両対応
    return (payload && typeof payload === 'object' && 'data' in payload) ? payload.data : payload
}

export default function KeywordIndex({users}) {

    const {t:tl,r} = useLocale()
    const {data: session } = useSession()
    const [open, setOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [uniqueId, setUniqueId] = useState("")
    const [tagStats, setTagStats] = React.useState([])
    const [tagLoading, setTagLoading] = React.useState(true)
    const [tagError, setTagError] = React.useState(null)

    const [recent, setRecent] = React.useState([])
    const [recentLoading, setRecentLoading] = React.useState(true)
    const [recentError, setRecentError] = React.useState(null)

    useEffect(() => {
        let cancelled = false

            // 1) タグ統計
        ;(async () => {
            try {
                const data = await fetchJson('/api/server/keyword/stats')
                if (!cancelled) {
                    // 期待形式: [{ tag: string, count: number }, ...]
                    const arr = Array.isArray(data) ? data : []
                    setTagStats(arr)
                }
            } catch (e) {
                if (!cancelled) setTagError(e?.message || 'failed to load tag stats')
            } finally {
                if (!cancelled) setTagLoading(false)
            }
        })()

        // 2) 新着20件（resolve/recent）
        ;(async () => {
            try {
                const data = await fetchJson('/api/server/keyword/resolve/recent')
                if (!cancelled) {
                    // 期待形式: { mode: 'recent', items: [...] }
                    const items = data?.items || []
                    setRecent(items)
                }
            } catch (e) {
                if (!cancelled) setRecentError(e?.message || 'failed to load recent')
            } finally {
                if (!cancelled) setRecentLoading(false)
            }
        })()

        return () => { cancelled = true }
    }, [])

    // モーダル制御
    const handleOpen = (id) => {
        setUniqueId(id)
        setOpen(true)
    }
    const handleEditOpen = () => {
        setOpen(false)
        setEditOpen(true)
    }
    const handleNewEditOpen = () => {
        setUniqueId(0)
        setEditOpen(true)
    }
    const handleClose = () => setOpen(false)
    const handleEditClose = () => {
        setEditOpen(false)
        mutate()
    }

    return (
        <>
            <Head>
                <title>{`${tl.g.keyword} - ${tl.title[0]}`}</title>
            </Head>
            <Box className="page-header">
                <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
                <StairIcon icon={faStairs}/>
                <Link href="/keyword">{tl.g.keyword}</Link><br/>
                <Typography variant="" className="title">{tl.g.keyword}</Typography><br/>
                <Typography variant="" className="subtitle">{r.g.keyword}</Typography><br/>
            </Box>
            <InfoBox>
            ピクミンシリーズ、ピクチャレ大会、ピクミン界隈にまつわる専門用語や流行語などをなんでも保存しておくためのページです。基本的にどなたでも編集できます。
                <Box style={{ margin: '1em'}}>
                    <ul>
                        <li>Sorry, this content is Japanese only.</li>
                        <li>登録できるのはピクミン界隈にある程度受け入れられている概念に限ります。作成者以外に認知されていない概念等は削除対象です。</li>
                        <li>本文には<Link style={{textDecoration:"underline"}} href="https://docs.github.com/ja/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax" target="_blank">Markdown</Link>を使用できます。YouTubeリンクを貼ると埋め込みコードに変換されます。</li>
                        <li>キーワード名及び本文はピクミン初心者にもなるべくわかりやすい表現を心がけてください。</li>
                        <li>キーワード名単独でどのシリーズやステージの用語か分かりにくい場合は（）でステージ名等を付け加えてください。その際、よみがなにカッコ及びカッコ内を含める必要はありません。</li>
                        <li>本文中のゲームタイトルは『』で囲んでください。強調したい言葉は「」で囲んでください。（キーワード名に含まれる場合は不要）</li>
                        <li>本文にプレイヤー名を記述する場合は末尾に「氏」をつけてください。（キーワード名にプレイヤー名が含まれる場合は敬称略としてください）</li>
                        <li><Link style={{textDecoration:"underline"}} href="https://docs.google.com/document/d/1-qK5yTcy4SlcK_1sgUT0rLfA0ORXJ8cqR9-pAkLuL3U/edit?usp=sharing" target="_blank">やり込み用語についてはalbut3氏がまとめたスプレッドシートを引用元としています。画像付きで読みたい方はこちらも参照してください。</Link></li>
                        <li>カテゴリに「期間限定チャレンジ」と入力して送信すると管理人と投稿者本人以外には表示されません。</li>
                    </ul>
                </Box>
            </InfoBox>
            <Grid container style={{marginTop:"20px"}}>
                <Button type="button" variant="contained" item xs={2} onClick={handleNewEditOpen}>
                    {tl.keyword.g.newTitle}
                </Button>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <WrapTopBox item xs={12} className="wrap-top-box">
                <TopBox>
                    <TopBoxHeader className="top-box-header">
                        <span><FontAwesomeIcon icon={faLayerGroup} /> {tl.g.category}</span>
                    </TopBoxHeader>
                    <TopBoxContent className="top-box-content">
                        {tagLoading ? (
                            <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>
                        ) : tagError ? (
                            <Typography color="error">{String(tagError)}</Typography>
                        ) : (
                            <Grid container spacing={2}>
                                {tagStats.map((row) => (
                                    <Grid item xs={6} sm={4} md={3} lg={2} key={row.tag}>
                                        <Link href={`/keyword/${encodeURIComponent(row.tag)}`}>
                                            <Card variant="outlined" sx={{ height: '100%' }} className={"cards"}>
                                                <CardContent>
                                                    <Typography variant="subtitle2" noWrap title={row.tag} sx={{ mb: .5 }}>
                                                        {/* タグをクリック → そのタグの親ページへ */}
                                                        {row.tag}
                                                    </Typography>
                                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{row.count}</Typography>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    </Grid>
                                ))}
                                {tagStats.length === 0 && (
                                    <Grid item xs={12}><Typography color="text.secondary">タグがありません</Typography></Grid>
                                )}
                            </Grid>
                        )}
                    </TopBoxContent>
                </TopBox>
            </WrapTopBox>

            <WrapTopBox item xs={12} className="wrap-top-box">
                <TopBox>
                    <TopBoxHeader className="top-box-header">
                        <span><FontAwesomeIcon icon={faTowerCell} /> {tl.g.newEntry}</span>
                    </TopBoxHeader>
                    <TopBoxContent className="top-box-content">
                        {recentLoading ? (
                            <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>
                        ) : recentError ? (
                            <Typography color="error">{String(recentError)}</Typography>
                        ) : (
                            <Stack spacing={2}>
                                {recent.map((item) => (
                                    <Card key={item.unique_id} variant="outlined" className={"cards"}>
                                        <CardContent>
                                            {/* KeywordContent は data 1件をそのまま表示する想定 */}
                                            <KeywordContent data={item} users={users} />
                                        </CardContent>
                                    </Card>
                                ))}
                                {recent.length === 0 && (
                                    <Typography color="text.secondary">新着はありません</Typography>
                                )}
                            </Stack>
                        )}
                    </TopBoxContent>
                </TopBox>
            </WrapTopBox>
            <ModalKeywordEdit editOpen={editOpen} uniqueId={uniqueId} handleEditClose={handleEditClose}/>
            <ModalKeyword open={open} uniqueId={uniqueId} handleClose={handleClose} handleEditOpen={handleEditOpen}/>
        </>
    )
}