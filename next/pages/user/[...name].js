import {Box, Grid, Typography} from "@mui/material";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import {fetcher, useLocale} from "../../lib/pik5";
import Head from "next/head";
import RankingUser from "../../components/record/RankingUser";
import PullDownRule from "../../components/form/PullDownRule";
import {logger} from "../../lib/logger";
import prisma from "../../lib/prisma";

export async function getServerSideProps(context){

    const query = context.query.name
    const user = query[0]

    // スクリーンネームをリクエスト
    const users = await prisma.user.findFirst({
        where: {
            userId: user
        },
        select: {
            userId: true,
            name: true
        }
    });
    const userName = users.name

    const console = query[1] || 0
    const rule    = query[2] || 0
    const year    = query[3] || 2023

    return {
        props: {
            user, userName, console, rule, year
        }
    }
}
// レンダラー本体（フロントサイド）
export default function Stage(param){

    const {t} = useLocale()

    return (
        <>
            <Head>
                <title>{`${param.userName} - ${t.title[0]}`}</title>
            </Head>
            {t.stage.user}<br/>
            <Typography variant="" className="title">{ param.userName }</Typography><br/>
            <Typography variant="" className="subtitle">@{param.user}</Typography>
            <Grid container marginBottom="20px">
                <Grid item xs={12}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                    <PullDownRule props={param}/>
                </Grid>
            </Grid>
            {/*<UserScoreTable/>*/}
            <RankingUser data={param.data} userName={param.userName} userId={param.user} console={param.console} rule={param.rule} year={param.year}/>
        </>
    )
}