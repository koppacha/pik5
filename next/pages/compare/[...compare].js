import {Box, Grid, Tooltip, Typography} from "@mui/material";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import {currentYear, dateFormat, fetcher, useLocale} from "../../lib/pik5";
import Head from "next/head";
import RankingCompare from "../../components/record/RankingCompare";
import PullDownRule from "../../components/form/PullDownRule";
import {logger} from "../../lib/logger";
import prisma from "../../lib/prisma";
import {available, rule2array} from "../../lib/const";
import {
    CompareType,
    MarkerTableCell,
    RankCell,
    RenderStagesWrapper, ScoreType,
    StageListBox, TeamRpsType, TeamScoreType,
    UserInfoBox,
    UserType
} from "../../styles/pik5.css";
import Link from "next/link";
import Button from "@mui/material/Button";
import Score from "../../components/record/Score";
import PullDownUser from "../../components/form/PullDownUser";

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}
export async function getStaticProps({params}){

    const query = params.compare
    const user1= query[0]
    const user2= query[4] || user1

    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })
    // 表示中のユーザー名を取り出す
    const userName = users.find(function(e){
        return e.userId === user1
    })?.name
    const userName2= users.find(function(e){
        return e.userId === user2
    })?.name

    // 各種統計情報を取得
    const res = await fetch(`http://laravel:8000/api/count/${user1}`)
    const info = await res.json()

    // クリアマーカーを取得
    const mark_res = await fetch(`http://laravel:8000/api/user/total/${user1}`)
    const marker = await mark_res.json()

    const consoles = query[1] || 0
    const rule     = query[2] || 0
    const year     = query[3] || currentYear()
    const consoles2= query[5] || 0
    const rule2    = query[6] || 0
    const year2    = query[7] || currentYear()

    // 左側の記録を取得
    const recordRes = await fetch(`http://laravel:8000/api/record/${user1}/${consoles}/${rule}/${year}`)
    const posts = await recordRes.json()

    // 右側の記録を取得
    const recordResR = await fetch(`http://laravel:8000/api/record/${user2}/${consoles2}/${rule2}/${year2}`)
    const posts2 = await recordResR.json()

    // 合計点と勝敗数を取得（格納する配列は順に左総合、右総合、左勝利、右勝利、引き分け）
    let totals = [0, 0, 0, 0, 0, 0]

    for(const key in posts){
        totals[0] += posts[key].score
        totals[1] += posts2[key].score
        if(posts[key].score >   posts2[key].score) totals[2]++
        if(posts[key].score <   posts2[key].score) totals[3]++
        if(posts[key].score === posts2[key].score) totals[4]++
    }
    if(
        !userName ||
        year < 2014 ||
        year > currentYear() ||
        query[8]
    ){
        return {
            notFound: true,
        }
    }
    return {
        props: {
            users, user1, userName, consoles, rule, year, info, marker, posts, posts2, user2, userName2, totals
        },
        revalidate: 180,
    }
}
// レンダラー本体（フロントサイド）
export default function Compare(param){

    const {t} = useLocale()

    return (
        <>
            <Head>
                <title>{param.userName+" - "+t.title[0]}</title>
            </Head>
            記録分析ページ<br/>
            <Typography variant="" className="title">２者スコア比較</Typography><br/>
            <Typography variant="" className="subtitle">Score Comparison List</Typography>
            <Grid container style={{margin:"2em 0"}}>
                <Grid item xs={5}>
                    <div>
                        <TeamScoreType style={{color:"#e31ca9"}}>{param.totals[2]}</TeamScoreType>
                        <TeamRpsType>{param.totals[0].toLocaleString()}</TeamRpsType>
                    </div>
                    <div>
                        <PullDownConsole props={param}/>
                        <PullDownYear props={param}/>
                        <PullDownUser props={param}/>
                    </div>
                </Grid>
                <Grid item xs={2} style={{textAlign:"center"}}>
                    <div>
                        <TeamScoreType style={{color:"#777"}}>{param.totals[4]}</TeamScoreType>
                        <TeamRpsType>{param.totals[0].toLocaleString()}</TeamRpsType>
                    </div>
                    <div>
                        <PullDownRule props={param}/>
                    </div>
                </Grid>
                <Grid item xs={5} style={{textAlign: "right"}}>
                    <div>
                        <TeamScoreType style={{color: "#1ce356"}}>{param.totals[3]}</TeamScoreType>
                        <TeamRpsType>{param.totals[1].toLocaleString()}</TeamRpsType>
                    </div>
                    <div>
                        <PullDownConsole props={param}/>
                        <PullDownYear props={param}/>
                        <PullDownUser props={param}/>
                    </div>
                </Grid>
            </Grid>
            <RankingCompare posts2={param.posts2} posts={param.posts} userName={param.userName} userId={param.user}
                            console={param.consoles}
                            rule={param.rule} year={param.year} userName2={param.userName2}/>
        </>
    )
}