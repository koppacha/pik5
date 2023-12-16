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
import prisma from "../../lib/prisma";
import StageList from "../../components/record/StageList";
import ModalKeyword from "../../components/modal/ModalKeyword";
import RuleList from "../../components/record/RuleList";

export async function getServerSideProps(context){

    const query   = context.query.series
    const series  = query[0]
    const consoles = query[1] || 0
    let   rule    = query[2] || series
    const year    = query[3] || 2023

    if(
        !available.includes(Number(series)) ||
        !available.includes(Number(rule)) ||
        !available.includes(Number(consoles)) ||
        year < 2014 ||
        year > 2023 ||
        query[4]
    ){
        return {
            notFound: true,
        }
    }

    let info
    // ステージ情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/${series}`)
    if(stage_res.status < 300) {
        info = await stage_res.json()
    }

    // 総合ランキングの総合ランキングにアクセスする場合はルールフィルターを無効にする
    if(series % 10 === 0 || series < 10){
        rule = 0
    }

    let stages = []
    // シリーズ番号に基づくステージ群の配列をリクエスト
    const res = await fetch(`http://laravel:8000/api/stages/${series}`)
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
            stages, series, rule, consoles, year, info, users
        }
    }
}

export default function Series(param){

    const {t, r} = useLocale()

    // ルール確認用モーダルの管理用変数
    const [open, setOpen] = useState(false)

    const stages = param.stages

    // 呼び出すレギュレーション本文
    const uniqueId = param.series

    const handleClose = () => setOpen(false)
    const handleOpen = () => setOpen(true)

    return (
        <>
            <Head>
                <title>{t.stage[param.series]+" - "+t.title[0]}</title>
            </Head>
            <PageHeader>
                #{param.series}<br/>
                <BreadCrumb info={param.info} rule={param.rule}/>
                <Typography variant="" className="title">{ t.stage[param.series] }</Typography><br/>
                <Typography variant="" className="subtitle">{r.stage[param.series]}</Typography>
            </PageHeader>
            <Totals props={param}/>
            {
                param.series > 9 &&
                <StageList stages={stages} consoles={param.consoles} rule={param.rule} year={param.year} />
            }
            <Grid container style={{marginBottom:'1em'}}>
                <Grid item xs={6}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                </Grid>
                <RuleWrapper container item xs={6} style={{marginTop: "24px",justifyContent: 'flex-end',alignContent: 'center'}}>
                    <RuleBox className={"active"}
                             onClick={handleOpen}
                             component={Link}
                             href="#">
                        {t.g.rule}
                    </RuleBox>
                </RuleWrapper>
            </Grid>
            <ModalKeyword open={open} uniqueId={uniqueId} handleClose={handleClose} handleEditOpen={null}/>
            <RankingTotal users={param.users} series={param.series} console={param.consoles} rule={param.rule} year={param.year} stages={param.stages}/>
        </>
    )
}