import {AppBar, Box, Container, FormControl, Grid, MenuItem, Select, Typography} from "@mui/material";
import Link from "next/link";
import Record from "../../components/record/Record";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import Totals from "../../components/rule/Totals";
import {createContext, useState} from "react";
import Rules from "../../components/rule/Rules";
import {useLocale} from "../../lib/pik5";
import BreadCrumb from "../../components/BreadCrumb";
import RankingTotal from "../../components/record/RankingTotal";
import Head from "next/head";
import {PageHeader, RuleBox, RuleWrapper, StageListBox} from "../../styles/pik5.css";
import {logger} from "../../lib/logger";
import {available} from "../../lib/const";
import StageList from "../../components/record/StageList";
import ModalKeyword from "../../components/modal/ModalKeyword";

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}
export async function getStaticProps({params}){
    const { getCachedUsers } = await import("../../lib/usersCache")

    const limited   = params.limited

    if(
        limited < 150101 ||
        limited > 291231
    ){
        return {
            notFound: true,
        }
    }

    let info
    // イベント情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/${limited}`)
    if(stage_res.status < 300) {
        info = await stage_res.json()
    }
    if(!info || Object.keys(info).length === 0){
        return {
            notFound: true,
        }
    }
    const categoryRes = await fetch(`http://laravel:8000/api/event-category/${limited}`)
    const eventCategory = categoryRes.ok ? (await categoryRes.json()).category : null

    // ランキングをリクエスト
    const postsRes = await fetch(`http://laravel:8000/api/total/${limited}`)
    if (!postsRes.ok) {
        return {
            notFound: true,
        }
    }
    const posts = await postsRes.json()

    let stages = []
    // シリーズ番号に基づくステージ群の配列をリクエスト
    const res = await fetch(`http://laravel:8000/api/stages/${limited}`)
    if(res.status < 300) {
        stages = await res.json()
    }

    // スクリーンネームをリクエスト
    const users = await getCachedUsers()

    return {
        props: {
            stages, limited, info, users, posts, eventCategory
        },
        revalidate: 1,
    }
}

export default function Limited(param){

    const {t, r, locale} = useLocale()
    const subtitle = locale === "en" ? param.info.name : param.info.eng

    const stages = param.stages

    // ルール確認用モーダルの管理用変数
    const [open, setOpen] = useState(false)

    // 呼び出すレギュレーション本文
    let uniqueId = param.limited

    const handleClose = () => setOpen(false)
    const handleOpen = () => setOpen(true)

    return (
        <>
            <Head>
                <title>{t.limited[param.limited]+" - "+t.title[0]}</title>
            </Head>
            <Box className="page-header">
                <BreadCrumb eventMode={!param.eventCategory} eventCategory={param.eventCategory}/>
                <Typography variant="" className="subtitle">#{param.limited}</Typography><br/>
                <Typography variant="" className="title">{t.limited[param.limited]}</Typography><br/>
                <Typography variant="" className="subtitle">{subtitle ?? r.limited[param.limited]}</Typography>
            </Box>
            <StageList stages={stages} />
            <RuleWrapper container item xs={12} style={{marginTop: "24px",justifyContent: 'flex-end',alignContent: 'center'}}>
                <RuleBox className={"active"}
                         onClick={handleOpen}
                         component={Link}
                         href="#">
                    {t.g.rule}
                </RuleBox>
            </RuleWrapper>
            <ModalKeyword open={open} uniqueId={uniqueId} handleClose={handleClose} handleEditOpen={null}/>
            <RankingTotal posts={param.posts} stages={stages} users={param.users} series={param.limited} console={0} rule={0} year={0}/>
        </>
    )
}
