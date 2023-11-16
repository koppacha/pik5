import {Box, Grid, Typography} from "@mui/material";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import {dateFormat, fetcher, useLocale} from "../../lib/pik5";
import Head from "next/head";
import RankingUser from "../../components/record/RankingUser";
import PullDownRule from "../../components/form/PullDownRule";
import {logger} from "../../lib/logger";
import prisma from "../../lib/prisma";
import {available} from "../../lib/const";
import {StageListBox, UserInfoBox} from "../../styles/pik5.css";

export async function getServerSideProps(context){

    const query = context.query.name
    const user = query[0]

    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })
    // 表示中のユーザー名を取り出す
    const userName = users.find(function(e){
        return e.userId === user
    }).name

    // 各種統計情報を取得
    const res = await fetch(`http://laravel:8000/api/count/${user}`)
    const info = await res.json()

    const consoles= query[1] || 0
    const rule    = query[2] || 0
    const year    = query[3] || 2023

    if(
        !userName ||
        year < 2014 ||
        year > 2023 ||
        query[4]
    ){
        return {
            notFound: true,
        }
    }
    return {
        props: {
            users, user, userName, consoles, rule, year, info
        }
    }
}
// レンダラー本体（フロントサイド）
export default function Stage(param){

    const {t} = useLocale()
    const firstPostDate = new Date(param.info[0].oldest_created_at)

    return (
        <>
            <Head>
                <title>{param.userName+" - "+t.title[0]}</title>
            </Head>
            {t.stage.user}<br/>
            <Typography variant="" className="title">{ param.userName }</Typography><br/>
            <Typography variant="" className="subtitle">@{param.user}</Typography>
            <Grid container margin="20px 0">
                <UserInfoBox item><span>総投稿数</span><br/>{param.info[0].cnt}</UserInfoBox>
                <UserInfoBox item><span>初投稿日</span><br/>{dateFormat(firstPostDate)}</UserInfoBox>
            </Grid>
            <Grid container marginBottom="20px">
                <Grid item xs={12}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                    <PullDownRule props={param}/>
                </Grid>
            </Grid>
            {/*<UserScoreTable/>*/}
            <RankingUser data={param.data} userName={param.userName} userId={param.user} console={param.consoles} rule={param.rule} year={param.year}/>
        </>
    )
}