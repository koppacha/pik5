import {Box, Grid, Tooltip, Typography} from "@mui/material";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import {dateFormat, fetcher, useLocale} from "../../lib/pik5";
import Head from "next/head";
import RankingUser from "../../components/record/RankingUser";
import PullDownRule from "../../components/form/PullDownRule";
import {logger} from "../../lib/logger";
import prisma from "../../lib/prisma";
import {available, rule2array} from "../../lib/const";
import {MarkerTableCell, RankCell, RenderStagesWrapper, StageListBox, UserInfoBox} from "../../styles/pik5.css";

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

    // クリアマーカーを取得
    const mark_res = await fetch(`http://laravel:8000/api/user/total/${user}`)
    const marker = await mark_res.json()

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
            users, user, userName, consoles, rule, year, info, marker
        }
    }
}
// レンダラー本体（フロントサイド）
export default function Stage(param){

    const {t} = useLocale()
    const firstPostDate = new Date(param.info[0].oldest_created_at)

    // マーカーテーブルに出力するルール一覧
    const ruleList = [10, 11, 21, 22, 23, 24, 25, 91, 31, 32, 33, 35, 36, 41, 42, 43]
    const consoleList = [1, 2, 7, 3, 4, 5, 6]

    const Played = ({stage}) => <Tooltip title={t.stage[stage]} placement="top" arrow><RankCell item rank={10}/></Tooltip>
    const NoPlay = ({stage}) => <Tooltip title={t.stage[stage]} placement="top" arrow><RankCell item rank={30}/></Tooltip>

    function RenderStages({marker}){
        return (
            <RenderStagesWrapper>
                <Grid container columns={{xs: 17}} style={{width:"1700px"}}>
                    <MarkerTableCell item xs={1}>#</MarkerTableCell>
                    {ruleList.map(rule => <MarkerTableCell item xs={1}>{t.rule[rule]}</MarkerTableCell>)}
                    {consoleList.map((console,consoleIndex) =>
                        <>
                            <Grid container item xs={17} columns={{xs: 17}}>
                                <MarkerTableCell item xs={1}>{t.console[console]}</MarkerTableCell>
                                {
                                    ruleList.map((rule, ruleIndex)=>
                                        // 表示する条件を定義
                                        (
                                            (ruleIndex < 8 && consoleIndex < 3) ||                      // ピクミン1＆2＝NGC、Wii、Switch
                                            (rule > 30 && rule < 34 && console > 1 && console < 6) || // ピクミン3通常＝Wii、ジャイロなし、ジャイロあり、タッチペン
                                            (rule === 35 && console !== 1 && console !== 7) ||          // ソロビンゴ＝Wii、ジャイロなし、ジャイロあり、タッチペン、おすそわけ
                                            (rule > 35 && rule < 50 && (console === 3 || console === 4))// サイドストーリー＆ピクミン４＝ジャイロなし、ジャイロあり
                                        ) ?
                                            <MarkerTableCell container item xs={1} columns={{xs: 5}}>
                                                {
                                                    rule2array(rule).map((stage) =>
                                                        marker.marks[console]?.[rule]?.includes(stage) ? (
                                                            <Played stage={stage}/>
                                                        ) : (
                                                            <NoPlay stage={stage}/>
                                                        )
                                                    )
                                                }
                                            </MarkerTableCell>
                                        :
                                            <MarkerTableCell item xs={1}></MarkerTableCell>
                                    )
                                }
                            </Grid>
                        </>
                        )
                    }
                </Grid>
            </RenderStagesWrapper>
        )
    }

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

            <RenderStages marker={param.marker}/>

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