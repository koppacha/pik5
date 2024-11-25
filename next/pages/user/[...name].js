import {Box, Button, Grid, Tooltip, Typography} from "@mui/material";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import {currentYear, dateFormat, fetcher, formattedDate, purgeCache, useLocale} from "../../lib/pik5";
import Head from "next/head";
import RankingUser from "../../components/record/RankingUser";
import PullDownRule from "../../components/form/PullDownRule";
import {logger} from "../../lib/logger";
import prisma from "../../lib/prisma";
import {available, rule2array} from "../../lib/const";
import {
    MarkerTableCell,
    RankCell,
    RenderStagesWrapper,
    StageListBox,
    UserInfoBox, UserInfoSeriesHeader,
    UserInfoTotalBox
} from "../../styles/pik5.css";
import Score from "../../components/record/Score";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faRotate} from "@fortawesome/free-solid-svg-icons";
import {useState} from "react";
import {useFetchToken} from "../../hooks/useFetchToken";

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}
export async function getStaticProps({params}){

    const query = params.name
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
    })?.name

    // 各種統計情報を取得
    const res = await fetch(`http://laravel:8000/api/count/${user}`)
    const info = await res.json()

    // クリアマーカーを取得
    const mark_res = await fetch(`http://laravel:8000/api/user/total/${user}`)
    const marker = await mark_res.json()

    const consoles = query[1] || 0
    const rule     = query[2] || 0
    const year     = query[3] || currentYear()

    // 記録を取得
    const recordRes = await fetch(`http://laravel:8000/api/record/${user}/${consoles}/${rule}/${year}`)
    const posts = await recordRes.json()

    if(
        !userName ||
        year < 2014 ||
        year > currentYear() ||
        query[4]
    ){
        return {
            notFound: true,
        }
    }
    // キャッシュ時間をリクエスト
    const fDate = formattedDate()
    return {
        props: {
            users, user, userName, consoles, rule, year, info, marker, posts, fDate
        },
        revalidate: 604800,
    }
}
// レンダラー本体（フロントサイド）
export default function Stage(param){

    const {t} = useLocale()
    const firstPostDate = new Date(param.info[0].oldest_created_at)

    const [isProcessing, setIsProcessing] = useState(false)

    // トークンを取得
    const token = useFetchToken()

    // キャッシュを再作成するボタン
    const handlePurgeCache = () => {
        setIsProcessing(true)
        purgeCache("user", param.user,0 ,0,2024, token).then(r => setIsProcessing(false))
    }

    // マーカーテーブルに出力するルール一覧
    const ruleList = [10, 11, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 35, 36, 40, 41, 42, 43, 91]
    const consoleList = [1, 2, 7, 3, 4] // 5, 6（おすそわけ・タッチペンは省略）

    const Played = ({stage}) => <Tooltip title={t.stage[stage]} placement="top" arrow><RankCell item rank={10}/></Tooltip>
    const NoPlay = ({stage}) => <Tooltip title={t.stage[stage]} placement="top" arrow><RankCell item rank={30}/></Tooltip>

    // 新クリアマーカー
    function TotalScoreTable(){
        return (
            <RenderStagesWrapper>
                <Grid container wrap="nowrap" columns={{xs: 19}}>
                    {ruleList.map(rule => param.marker.scores[rule] &&
                        <UserInfoTotalBox style={{whiteSpace: 'nowrap'}} item key={rule} xs={1} series={Number(String(rule).slice(0, 1))}>
                            {t.ru[rule]}<br/>
                            <Score score={param.marker.scores[rule]}/><br/>
                            {param.marker.marks[rule]}/{rule2array(rule).length}
                        </UserInfoTotalBox>
                    )}

                </Grid>
            </RenderStagesWrapper>
        )
    }

    // クリアマーカー（操作方法区分統合まで公開停止中）
    function RenderStages({marker}){
        return (
            <RenderStagesWrapper>
                <Grid container columns={{xs: 17}} style={{width:"1800px"}}>
                    <MarkerTableCell item xs={1}>#</MarkerTableCell>
                    {ruleList.map(rule => <MarkerTableCell item key={rule} xs={1}>{t.ru[rule]}</MarkerTableCell>)}
                    {consoleList.map((console,consoleIndex) =>
                        <>
                            <Grid container item xs={17} columns={{xs: 17}}>
                                <MarkerTableCell item xs={1}>{t.cnsl[console]}</MarkerTableCell>
                                {
                                    ruleList.map((rule, ruleIndex)=>
                                        // 表示する条件を定義
                                        (
                                            (ruleIndex < 8 && consoleIndex < 3) ||                      // ピクミン1＆2＝NGC、Wii、Switch
                                            (rule > 30 && rule < 34 && console > 1 && console < 6) || // ピクミン3通常＝Wii、ジャイロなし、ジャイロあり、タッチペン
                                            (rule === 35 && console !== 1 && console !== 7) ||          // ソロビンゴ＝Wii、ジャイロなし、ジャイロあり、タッチペン、おすそわけ
                                            (rule > 35 && rule < 50 && (console === 3 || console === 4))// サイドストーリー＆ピクミン４＝ジャイロなし、ジャイロあり
                                        ) ?
                                            <MarkerTableCell container item key={rule} xs={1} columns={{xs: 5}}>
                                                {
                                                    rule2array(rule).map((stage) =>
                                                        marker.marks[console]?.[rule]?.includes(stage) ? (
                                                            <Played key={stage} stage={stage}/>
                                                        ) : (
                                                            <NoPlay key={stage} stage={stage}/>
                                                        )
                                                    )
                                                }
                                            </MarkerTableCell>
                                        :
                                            <MarkerTableCell item key={rule} xs={1}></MarkerTableCell>
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
            <Box className="page-header">
                {t.stage.user}<br/>
                <Typography variant="" className="title">{ param.userName }</Typography><br/>
                <Typography variant="" className="subtitle">@{param.user}</Typography>
                <Grid container>
                    <UserInfoBox item><span>総投稿数：</span>{param.info[0].cnt}</UserInfoBox>
                    <UserInfoBox item><span>初投稿日：</span>{dateFormat(firstPostDate)}</UserInfoBox>
                    <UserInfoBox item>
                        <span>最終更新：</span>{param.fDate} <Button disabled={isProcessing} style={{color:"#fff",padding:"0 4px",minWidth:"0"}} onClick={handlePurgeCache}><FontAwesomeIcon icon={faRotate} /></Button>
                    </UserInfoBox>
                </Grid>
            </Box>
            <TotalScoreTable/>
            <Grid container marginBottom="20px">
                <Grid item xs={12}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                    <PullDownRule props={param}/>
                </Grid>
            </Grid>
            {/*<UserScoreTable/>*/}
            <RankingUser posts={param.posts} userName={param.userName} userId={param.user} console={param.consoles} rule={param.rule} year={param.year}/>
        </>
    )
}