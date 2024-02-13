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
    RenderStagesWrapper, RuleBox, RuleWrapper, ScoreType,
    StageListBox, TeamRpsType, TeamScoreType,
    UserInfoBox,
    UserType
} from "../../styles/pik5.css";
import Link from "next/link";
import Button from "@mui/material/Button";
import Score from "../../components/record/Score";
import ModalCompare from "../../components/modal/ModalCompare";
import {useState} from "react";

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}
export async function getStaticProps({params}){

    let [user1, consoles1, rule1, year1, user2, consoles2, rule2, year2] = params.compare

    const rules = rule2array(rule1)

    if(
        !user1 ||
        !user2 ||
        consoles1 > 7 ||
        consoles1 < 0 ||
        consoles2 > 7 ||
        consoles2 < 0 ||
        rule1 > 43 ||
        rule1 < 0 ||
        rule2 > 43 ||
        rule1 < 0 ||
        year1 < 2014 ||
        year1 > currentYear() ||
        year2 < 2014 ||
        year2 > currentYear()
    ){
        return {
            notFound: true,
        }
    }
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

    // 左側の記録を取得
    const recordRes = await fetch(`http://laravel:8000/api/record/${user1}/${consoles1}/${rule1}/${year1}`)
    const posts1 = await recordRes.json()

    // 右側の記録を取得
    const recordResR = await fetch(`http://laravel:8000/api/record/${user2}/${consoles2}/${rule2}/${year2}`)
    const posts2 = await recordResR.json()

    // 合計点と勝敗数を取得（格納する配列は順に左総合、右総合、左勝利、右勝利、引き分け、総合点差）
    let totals = [0, 0, 0, 0, 0, 0, 0], tempScore = [0, 0]

    rules?.map(function(stageId){
        tempScore[0] = Object.values(posts1).find(i => i.stage_id === stageId)?.score ?? 0
        tempScore[1] = Object.values(posts2).find(i => i.stage_id === stageId)?.score ?? 0
        totals[0] += tempScore[0]
        totals[1] += tempScore[1]
        if(tempScore[0] >   tempScore[1]) totals[2]++
        if(tempScore[0] <   tempScore[1]) totals[3]++
        if(tempScore[0] === tempScore[1]) totals[4]++

        totals[6] = Math.abs(totals[0] - totals[1])
    })

    return {
        props: {
            users, userName, userName2,
            user1, consoles1, rule1, year1,
            user2, consoles2, rule2, year2,
            posts1, posts2, totals
        },
        revalidate: 1000,
    }
}
// レンダラー本体（フロントサイド）
export default function Compare(param){

    const {t} = useLocale()

    // モーダル制御関連
    const [open, setOpen] = useState(false)
    const handleOpen = () => setOpen(true)
    const handleClose = () => setOpen(false)

    return (
        <>
            <Head>
                <title>{`ピクチャレ星取表（${param.userName} vs. ${param.userName2}） - ${t.title[0]}`}</title>
            </Head>
            ツール<br/>
            <Typography variant="" className="title">ピクチャレ星取表</Typography><br/>
            <Typography variant="" className="subtitle">Score Comparison List</Typography><br/>
            <Grid container style={{margin:"1em 0"}}>
                <Grid item xs={4}>
                    <div>
                        <UserType className="user-type">{param.userName}<br/>
                            <span>({param.year1}年・{t.console[param.consoles1]})</span>
                        </UserType>
                    </div>
                </Grid>
                <Grid item xs={4} style={{textAlign:"center"}}>
                    <div>
                        <UserType className="user-type">{t.rule[param.rule1]}</UserType>
                    </div>
                </Grid>
                <Grid item xs={4} style={{textAlign: "right"}}>
                    <div>
                        <UserType className="user-type">{param.userName2}<br/>
                        <span>({param.year2}年・{t.console[param.consoles2]})</span>
                        </UserType>
                    </div>
                </Grid>
                <Grid item xs={4} style={{paddingTop:"1em"}}>
                    <TeamScoreType style={{color:"#e31ca9"}}>{param.totals[2]}</TeamScoreType>
                    <TeamRpsType className="team-rps-type">{param.totals[0].toLocaleString()}</TeamRpsType>
                </Grid>
                <Grid item xs={4} style={{paddingTop:"1em",textAlign:"center"}}>
                    <TeamScoreType style={{color:"#777"}}>{param.totals[4]}</TeamScoreType>
                    <TeamRpsType className="team-rps-type">{param.totals[6].toLocaleString()}</TeamRpsType>
                </Grid>
                <Grid item xs={4} style={{paddingTop:"1em",textAlign: "right"}}>
                    <TeamScoreType style={{color: "#1ce356"}}>{param.totals[3]}</TeamScoreType>
                    <TeamRpsType className="team-rps-type">{param.totals[1].toLocaleString()}</TeamRpsType>
                </Grid>
            </Grid>
            <RuleWrapper container>
                <RuleBox component={Link}
                         href="#" onClick={handleOpen}>
                    条件を変更する
                </RuleBox>
                <RuleBox component={Link}
                         href={`/total/${param.rule1}`}>
                    総合ランキングへ戻る
                </RuleBox>
            </RuleWrapper>
            <ModalCompare open={open} param={param} handleClose={handleClose}/>
            <RankingCompare posts2={param.posts2} posts1={param.posts1} userName={param.userName} rule={param.rule1} userName2={param.userName2}/>
        </>
    )
}