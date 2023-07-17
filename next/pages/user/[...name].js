import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {Box, Grid, Typography} from "@mui/material";
import Record from "../../components/record/Record";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import Rules from "../../components/rule/Rules";
import RecordPost from "../../components/modal/RecordPost";
import UserScoreTable from "../../components/record/UserScoreTable";
import {fetcher, useLocale} from "../../lib/pik5";
import Head from "next/head";
import useSWR from "swr";
import NowLoading from "../../components/NowLoading";
import {logger} from "../../lib/logger";
import RankingStandard from "../../components/record/RankingStandard";
import RankingUser from "../../components/record/RankingUser";
import {RuleBox} from "../../styles/pik5.css";
import Link from "next/link";
import PullDownRule from "../../components/form/PullDownRule";

export async function getServerSideProps(context){

    const query = context.query.name
    const user = query[0]

    // ユーザーIDに紐づいたユーザー名を取得
    const userNameRes = await fetch(`http://laravel:8000/api/user/name/${user}`)
    const userName = await userNameRes.json()

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
                <title>{`${param.userName[0].user_name} - ${t.title[0]}`}</title>
            </Head>
            {t.stage.user}<br/>
            <Typography variant="" className="title">{ param.userName[0].user_name }</Typography><br/>
            <Typography variant="" className="subtitle">@{param.user}</Typography>
            <Grid container>
                <Grid item xs={12}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                    <PullDownRule props={param}/>
                </Grid>
            </Grid>
            {/*<UserScoreTable/>*/}
            <RankingUser data={param.data} userId={param.user} console={param.console} rule={param.rule} year={param.year}/>
        </>
    )
}