import {Box, Grid, Typography} from "@mui/material";
import ModalKeywordEdit from "../../components/modal/ModalKeywordEdit";
import React, {useEffect, useRef, useState} from "react";
import useSWR, {mutate} from "swr";
import {fetcher, useLocale} from "../../lib/pik5";
import {InfoBox, RuleBox, StairIcon} from "../../styles/pik5.css";
import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import PullDownKeywordCategory from "../../components/form/PullDownKeywordCategory";
import {useSearchParams} from "next/navigation";
import ModalKeyword from "../../components/modal/ModalKeyword";
import Head from "next/head";

export default function KeywordIndex(){

    const {t:tl,r} = useLocale()
    const [open, setOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [uniqueId, setUniqueId] = useState("")
    const params = useSearchParams()
    const c = params.get("c")
    const t = params.get("t")

    const p = c ? `?c=${c}` : t ? `?t=${t}` : ""

    const {data} = useSWR(`/api/server/keyword${p}`, fetcher, { refreshInterval: 5000 })

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

    let hi, mae

    return (
        <>
            <Head>
                <title>{`${tl.g.keyword} - ${tl.title[0]}`}</title>
            </Head>
            <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
            <StairIcon icon={faStairs}/>
            <Link href="/keyword">{tl.g.keyword}</Link><br/>
            <Typography variant="" className="title">{tl.g.keyword}</Typography><br/>
            <Typography variant="" className="subtitle">{r.g.keyword}</Typography><br/>
            <InfoBox>
            ピクミンシリーズ、ピクチャレ大会、ピクミン界隈にまつわる専門用語や流行語などをなんでも保存しておくためのページです。基本的にどなたでも編集できます。
                <Box style={{ margin: '1em'}}>
                    <ul>
                        <li>Sorry, this content is Japanese only.</li>
                        <li>登録できるのはピクミン界隈にある程度受け入れられている概念に限ります。作成者以外に認知されていない概念等は削除対象です。</li>
                        <li>本文にはMarkdownを使用できます。</li>
                        <li>タグの記述は任意です。カテゴリ内でグルーピングしたい場合に使用してください。</li>
                        <li>キーワード名及び本文はピクミン初心者にもなるべくわかりやすい表現を心がけてください。</li>
                        <li>キーワード名単独でどのシリーズやステージの用語か分かりにくい場合は（）でステージ名等を付け加えてください。その際、よみがなにカッコ及びカッコ内を含める必要はありません。</li>
                        <li>本文中のゲームタイトルは『』で囲んでください。強調したい言葉は「」で囲んでください。（キーワード名に含まれれる場合は不要）</li>
                        <li>本文にプレイヤー名を記述する場合は末尾に「氏」をつけてください。（キーワード名にプレイヤー名が含まれる場合は敬称略としてください）</li>
                    </ul>
                </Box>
            </InfoBox>
            <PullDownKeywordCategory category={c}/>
            <Grid container style={{marginTop:"20px"}}>
                <RuleBox item xs={3} onClick={handleNewEditOpen}>
                    {tl.keyword.g.newTitle}
                </RuleBox>
            </Grid>
            <Grid container>
            {
                data?.data.map(function (post){
                    mae = hi || "わ"
                    hi = post.yomi
                    if(hi.slice(0, 1).normalize('NFD')[0] !== mae.slice(0, 1).normalize('NFD')[0]) {
                        return (
                            <React.Fragment key={post.unique_id}>
                                <Grid item xs={12} style={{marginTop:"2em"}}><Typography variant="h3">{hi.slice(0, 1).normalize('NFD')[0]}</Typography></Grid>
                                <Grid item xs={6} sm={3} style={{marginBottom:"0.5em",borderBottom:"1px solid #999"}}>
                                    <Link href={"/keyword?t="+post.tag} style={{color:"#777",fontSize:"0.75em"}}>{post.tag}</Link><br/>
                                    <Typography style={{cursor:"pointer"}} onClick={()=>handleOpen(post.unique_id)}>{post.keyword}</Typography>
                                </Grid>
                            </React.Fragment>
                        )
                    } else {
                        return (
                            <React.Fragment key={post.unique_id}>
                                <Grid item xs={6} sm={3} style={{marginBottom:"0.5em",borderBottom:"1px solid #999"}}>
                                    <Link href={"/keyword?t="+post.tag} style={{color:"#777",fontSize:"0.75em"}}>{post.tag}</Link><br/>
                                    <Typography style={{cursor:"pointer"}} onClick={()=>handleOpen(post.unique_id)}>{post.keyword}</Typography>
                                </Grid>
                            </React.Fragment>
                        )
                    }
                })
            }
            </Grid>
            <ModalKeywordEdit editOpen={editOpen} uniqueId={uniqueId} handleEditClose={handleEditClose}/>
            <ModalKeyword open={open} uniqueId={uniqueId} handleClose={handleClose} handleEditOpen={handleEditOpen}/>
        </>
    )
}