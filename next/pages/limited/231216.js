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
import {PageHeader, RuleBox, RuleWrapper, StageListBox, StairIcon} from "../../styles/pik5.css";
import {logger} from "../../lib/logger";
import {available} from "../../lib/const";
import prisma from "../../lib/prisma";
import StageList from "../../components/record/StageList";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import ModalKeyword from "../../components/modal/ModalKeyword";

export async function getServerSideProps(context){

    const limited = 151101

    // イベント情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/151101`)
    const info = (stage_res.status < 300) ? await stage_res.json() : []

    let stages = []
    // シリーズ番号に基づくステージ群の配列をリクエスト
    const res = await fetch(`http://laravel:8000/api/stages/151101`)
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
            <PageHeader>
                #{param.limited}<br/>
                <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
                <StairIcon icon={faStairs}/>
                {t.limited.type[param.info.type]}<br/>
                <Typography variant="" className="title">{param.info.name}</Typography><br/>
                <Typography variant="" className="subtitle">{param.info.eng}</Typography>
            </PageHeader>
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
            {
                // チーム別総合点を計算して表示する部分（合計ランクポイント、参加者、参加者別ランクポイント、投稿済みステージ数）
                //
            }
            {
                // 各ステージのチームごとのトップスコアを表示する部分
            }
            <RankingTotal stages={stages} users={param.users} series={param.limited} console={0} rule={0} year={0}/>
        </>
    )
}