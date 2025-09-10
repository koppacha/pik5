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
import {available, reverseStages, rule2array} from "../../lib/const";
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
import {range} from "../../lib/pik5";

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}
export async function getStaticProps({params}){

    let [user1, consoles1Str, rule1Str, year1Str, user2, consoles2Str, rule2Str, year2Str] = params.compare

    // Keep original strings for URLs/props
    const consoles1 = consoles1Str
    const consoles2 = consoles2Str
    const rule1 = rule1Str
    const rule2 = rule2Str
    const year1 = year1Str
    const year2 = year2Str

    // Numeric versions for validation/comparisons
    const nConsoles1 = Number(consoles1Str)
    const nConsoles2 = Number(consoles2Str)
    const nRule1 = Number(rule1Str)
    const nRule2 = Number(rule2Str)
    const nYear1 = Number(year1Str)
    const nYear2 = Number(year2Str)

    const rules = rule2array(rule1)

    if (
        !user1 ||
        !user2 ||
        nConsoles1 > 4 ||
        nConsoles1 < 0 ||
        nConsoles2 > 4 ||
        nConsoles2 < 0 ||
        nRule1 > 47 ||
        nRule1 < 0 ||
        nRule2 > 47 ||
        nRule2 < 0 ||
        nYear1 < 2014 ||
        nYear1 > currentYear() ||
        nYear2 < 2014 ||
        nYear2 > currentYear()
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

    // 全総合(= "1")の扱いに応じて各サイドを取得（posts3/posts4 は常に定義）
    let posts1 = {}, posts2 = {}, posts3 = {}, posts4 = {}
    if (rule1 === "1" && rule2 === "1") {
        // 左右とも通常総合(2)と特殊総合(3)を取得
        ;[posts1, posts3] = await Promise.all([
            fetch(`http://laravel:8000/api/record/${user1}/${consoles1}/2/${year1}`).then(res => res.json()),
            fetch(`http://laravel:8000/api/record/${user1}/${consoles1}/3/${year1}`).then(res => res.json())
        ])
        ;[posts2, posts4] = await Promise.all([
            fetch(`http://laravel:8000/api/record/${user2}/${consoles2}/2/${year2}`).then(res => res.json()),
            fetch(`http://laravel:8000/api/record/${user2}/${consoles2}/3/${year2}`).then(res => res.json())
        ])
    } else {
        // 左側
        if (rule1 === "1") {
            ;[posts1, posts3] = await Promise.all([
                fetch(`http://laravel:8000/api/record/${user1}/${consoles1}/2/${year1}`).then(res => res.json()),
                fetch(`http://laravel:8000/api/record/${user1}/${consoles1}/3/${year1}`).then(res => res.json())
            ])
        } else {
            posts1 = await fetch(`http://laravel:8000/api/record/${user1}/${consoles1}/${rule1}/${year1}`).then(r => r.json())
            // posts3 は空のまま（{}）
        }

        // 右側
        if (rule2 === "1") {
            ;[posts2, posts4] = await Promise.all([
                fetch(`http://laravel:8000/api/record/${user2}/${consoles2}/2/${year2}`).then(res => res.json()),
                fetch(`http://laravel:8000/api/record/${user2}/${consoles2}/3/${year2}`).then(res => res.json())
            ])
        } else {
            posts2 = await fetch(`http://laravel:8000/api/record/${user2}/${consoles2}/${rule2}/${year2}`).then(r => r.json())
            // posts4 は空のまま（{}）
        }
    }
    // 合計点と勝敗数を取得（格納する配列は順に左総合、右総合、左勝利、右勝利、引き分け、総合点差）
    let totals = [0, 0, 0, 0, 0, 0, 0], tempScore = [0, 0]

    rules?.map(function(stageId){
        tempScore[0] = Object.values(posts1).find(i => i.stage_id === stageId)?.score ?? 0
        tempScore[1] = Object.values(posts2).find(i => i.stage_id === stageId)?.score ?? 0
        totals[0] += tempScore[0]
        totals[1] += tempScore[1]

        // 勝っている方に加点
        if (tempScore[0] !== tempScore[1]) {
            const leftWins = tempScore[0] > tempScore[1]
            const isReverse = reverseStages.includes(Number(stageId))

            // 排他的論理和（XOR）で加算対象を決定
            const winner = leftWins ^ isReverse ? 2 : 3
            totals[winner]++
        } else {
            // 同点もしくは両者とも未投稿の場合
            totals[4]++
        }

        // 総合点差
        totals[6] = Math.abs(totals[0] - totals[1])
    })

    return {
        props: {
            users, userName, userName2,
            user1, consoles1, rule1, year1,
            user2, consoles2, rule2, year2,
            posts1, posts2, posts3, posts4, totals
        },
        revalidate: 43200,
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
                    <TeamScoreType className="team-score-type" style={{color:"#e31ca9"}}>{param.totals[2]}</TeamScoreType>
                    <TeamRpsType className="team-rps-type">{param.totals[0].toLocaleString()}</TeamRpsType>
                </Grid>
                <Grid item xs={4} style={{paddingTop:"1em",textAlign:"center"}}>
                    <TeamScoreType className="team-score-type" style={{color:"#777"}}>{param.totals[4]}</TeamScoreType>
                    <TeamRpsType className="team-rps-type">{param.totals[6].toLocaleString()}</TeamRpsType>
                </Grid>
                <Grid item xs={4} style={{paddingTop:"1em",textAlign: "right"}}>
                    <TeamScoreType className="team-score-type" style={{color: "#1ce356"}}>{param.totals[3]}</TeamScoreType>
                    <TeamRpsType className="team-rps-type">{param.totals[1].toLocaleString()}</TeamRpsType>
                </Grid>
            </Grid>
            <RuleWrapper className="rule-wrapper" container>
                <RuleBox component={Link} className="rule-box active"
                         href="#" onClick={handleOpen}>
                    条件を変更する
                </RuleBox>
                <RuleBox component={Link} className="rule-box"
                         href={`/total/${param.rule1}`}>
                    総合ランキング
                </RuleBox>
                <RuleBox component={Link} className="rule-box"
                         href={`/user/${param.user1}`}>
                    {param.userName}さんのページ
                </RuleBox>
                <RuleBox component={Link} className="rule-box"
                         href={`/user/${param.user2}`}>
                    {param.userName2}さんのページ
                </RuleBox>
            </RuleWrapper>
            <ModalCompare open={open} param={param} handleClose={handleClose}/>
            <RankingCompare posts2={param.posts2} posts1={param.posts1} userName={param.userName} rule={param.rule1} userName2={param.userName2}/>
            {
                param.rule1 === "1" &&
                <>
                    <Box style={{
                        color:"#e81fc1",
                        borderBottom:"2px dotted #e81fc1",
                        textAlign:"center",
                        margin:"8px 0"
                    }}>◆特殊ランキング（全回収TA・タマゴムシ縛り・スプレー縛り・本編地下・ゲキカラダンドリ・夜の探索）◆</Box>
                    <RankingCompare posts2={param.posts4} posts1={param.posts3} userName={param.userName} rule={"3"} userName2={param.userName2}/>
                </>
            }
        </>
    )
}