import {AppBar, Box, Container, FormControl, Grid, MenuItem, Select, Typography} from "@mui/material";
import Link from "next/link";
import Record from "../../components/record/Record";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import Totals from "../../components/rule/Totals";
import {createContext} from "react";
import Rules from "../../components/rule/Rules";
import {useLocale} from "../../lib/pik5";
import BreadCrumb from "../../components/BreadCrumb";
import RankingTotal from "../../components/record/RankingTotal";
import Head from "next/head";
import {PageHeader, StageListBox, StairIcon} from "../../styles/pik5.css";
import {logger} from "../../lib/logger";
import {available} from "../../lib/const";
import prisma from "../../lib/prisma";
import StageList from "../../components/record/StageList";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";

export async function getServerSideProps(context){

    const limited   = context.query.limited

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
    if(!info){
        return {
            notFound: true,
        }
    }

    let stages = []
    // シリーズ番号に基づくステージ群の配列をリクエスト
    const res = await fetch(`http://laravel:8000/api/stages/${limited}`)
    if(res.status < 300) {
        stages = await res.json()
    }

    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })

    return {
        props: {
            stages, limited, info, users
        }
    }
}

export default function Limited(param){

    const {t, r} = useLocale()

    const stages = param.stages

    return (
        <>
            <Head>
                <title>{t.stage[param.series]+" - "+t.title[0]}</title>
            </Head>
            <PageHeader>
                #{param.limited}<br/>
                <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
                <StairIcon icon={faStairs}/>
                <Link href={"/limited/"}>ピクチャレ大会イベント</Link>
                <StairIcon icon={faStairs}/>
                <Link href={"/total/4"}>期間限定ランキング</Link><br/>
                <Typography variant="" className="title">{param.info.name}</Typography><br/>
                <Typography variant="" className="subtitle">{param.info.eng}</Typography>
            </PageHeader>
            <StageList stages={stages} />
            <Grid container style={{
                marginTop:"30px"
            }}>
            </Grid>
            <RankingTotal users={param.users} series={param.limited} console={0} rule={0} year={0}/>
        </>
    )
}