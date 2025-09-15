import {Box, Grid, Tooltip, Typography} from "@mui/material";
import Link from "next/link";
import {
    faArrowDownUpAcrossLine,
    faComment,
    faImage, faPeopleArrows,
    faScaleUnbalanced,
    faScaleUnbalancedFlip,
    faTag,
    faUser
} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faYoutube} from "@fortawesome/free-brands-svg-icons";
import {currentYear, dateFormat, fetcher, rankColor, sec2time, useLocale} from "../../lib/pik5";
import Score from "./Score";
import React, {useEffect, useState} from "react";
import {
    CompareIcon,
    CompareType, RankCell,
    RankEdge,
    RankPointType,
    RankType,
    RecordContainer, RecordGridWrapper, ScoreType,
    UserType
} from "../../styles/pik5.css";
import Lightbox from "yet-another-react-lightbox";
import LightBoxImage from "../modal/LightBoxImage";
import "yet-another-react-lightbox/styles.css";
import {hideRuleNames} from "../../lib/const";
import {useSession} from "next-auth/react";
import { useSpring, animated } from 'react-spring';
import { useDrag } from '@use-gesture/react';
import {useRouter} from "next/router";
import {Swiper} from "./Swiper";
import {stageUrlOutput} from "../../lib/factory";

export default function Record({mini, parent, data, stages, series, consoles, year, prevUser, history}) {

    const router = useRouter()
    const {t} = useLocale()
    const {data: session } = useSession()
    const date = new Date(data?.created_at ?? "2006-09-01 00:00:00")

    const [imgOpen, setImgOpen] = useState(
        false)
    const [editOpen, setEditOpen] = useState(false)
    const [videoOpen, setVideoOpen] = useState(false)
    const [isClient, setIsClient] = useState(false)

    useEffect(() => setIsClient(true), [])

    const imgHandleClose = () => setImgOpen(false)
    const imgHandleOpen = () => setImgOpen(true)
    const editHandleClose = () => setEditOpen(false)
    const editHandleOpen = () => setEditOpen(true)
    const videoHandleClose = () => setVideoOpen(false)
    const videoHandleOpen = () => setVideoOpen(true)

    // ユーザーページへのリンク
    const userPageUrl = (data.category === "speedrun") ? "https://www.speedrun.com/user/"+data.user_name : "/user/"+data.user_id

    // ステージへのリンク
    const stageUrl = stageUrlOutput(data.stage_id, 0, data.rule, currentYear(), parent?.stage_id)
    const stageLink = (stageUrl) ? '/stage/'+stageUrl : ""

    // 全総合を表示する場合、二重カウント対象分のステージ数を加算
    // 全回収TA 5＋新チャレ 26＋ゲキカラ 28
    const addStageCount = (Number(series) === 1) ? 59 : 0

    // 比較値を整形する
    let compare;
    if (!Number.isNaN(data.compare)) {
        if (data.compare > 0) {
            if ([30, 31, 32, 36, 41].includes(Number(data.rule))) {
                compare = `(+${sec2time(data.compare)})`
            } else {
                compare = `(+${data.compare})`
            }
        }
        if(data.compare < 0) compare = `(${data.compare})`
        if([29, 35, 47].includes(Number(data.rule))){
            compare = ""
        }
    } else {
        compare = ""
    }
    const currentRankFrontColor = rankColor(data?.post_rank ?? 20, data?.team ?? 0, 1)
    const className = data?.post_rank === 1 ? "rank1" :
                             data?.post_rank === 2 ? "rank2" :
                             data?.post_rank === 3 ? "rank3" :
                             data?.post_rank <  11 ? "rank4" :
                             data?.post_rank <  21 ? "rank11": "rank21"

    // 順位セル用のカラー生成関数
    const rankCellColor = (rank) => {
        const hue = rank === 1 ? 58 : rank === 2 ? 125 : rank === 3 ? 190 : 0
        const saturation = rank === 1 ? "70%" : rank === 2 ? "70%" : rank === 3 ? "50%" : "0%"
        const lightness = !rank ? "15%" : rank < 4 ? "65%" : rank < 11 ? "55%" : rank < 21 ? "35%" : "25%"
        const transparent = !rank ? 0 : 1
        return `hsl(${hue}, ${saturation}, ${lightness}, ${transparent})`
    }
    return (
        // <Swiper userPageUrl={userPageUrl} stageLink={stageLink} router={router}>
        <>
            <RecordContainer className={`record-container ${className}`} container rank={data?.post_rank ?? 20} team={data?.team ?? 0}
                style={{borderLeft:      `10px solid ${currentRankFrontColor}`,
                        borderBottom:    `1px solid ${currentRankFrontColor}`,
                        boxShadow:       `-3px 1px 4px ${currentRankFrontColor}`}}
            >
                <RecordGridWrapper className="record-grid-wrapper" item xs={1.8} sm={1}>
                    <div style={{fontSize:mini && "0.8em"}}>
                        <RankEdge className="rank-edge" as="span">{t.g.rankHead} </RankEdge>
                        <RankType className="rank-type" as="span">{data?.post_rank ?? "?"}</RankType>
                        <RankEdge className="rank-edge" as="span"> {t.g.rankTail}</RankEdge>
                        {mini || <RankPointType className="rank-point-type">[{data?.rps ?? "?"} {history ? "players" : "rps"}]</RankPointType>}
                    </div>
                </RecordGridWrapper>
                <RecordGridWrapper className="record-grid-wrapper" item xs={3.4} sm={3}>
                    <UserType style={{fontSize:mini && "0.9em"}} className="user-type" length={data.user_name?.length || 0}><Link href={userPageUrl}>{data.user_name}</Link></UserType>
                </RecordGridWrapper>
                <RecordGridWrapper className="record-grid-wrapper" item xs={2.8} sm={3}>
                    <div style={{fontSize:mini && "0.9em"}}>
                    <Score rule={data.rule} score={data.score} stage={data.stage_id} category={data.category} /><br className="pc-hidden"/>
                    <CompareType className="compare-type" as="span"> {compare}</CompareType>
                    {
                        // 総合ランキングの場合は投稿ステージ数を表示
                        (data?.ranks) && <><br/><ScoreType className="score-type" style={{fontSize:"0.9em"}} as="span">{data.ranks.length} / {stages.length + addStageCount}</ScoreType></>
                    }
                    </div>
                </RecordGridWrapper>
                <Grid item xs={4} sm={5} style={{
                    textAlign: 'left',
                }}>
                    <Grid container style={{
                        margin: '8px',
                        fontSize: '0.8em',
                        width: '95%'
                    }}>
                        <Grid item xs={12} sm={3}>
                            <time dateTime={date.toISOString()}>{isClient ? dateFormat(date) : ''}</time>
                        </Grid>
                        {mini || <Grid item xs={12} sm={9} style={{textAlign:'right'}}>
                            {data.stage_id &&
                                <Link href={stageLink}>{data.stage_id + '#' + t.stage[data.stage_id]}
                                    {(!hideRuleNames.includes(data.rule) && data.rule < 100) && <span style={{fontSize:'0.85em'}}> ({t.rule[data.rule]})</span>}
                                </Link>
                            }
                            {// シリーズ別総合ランキングは星取表へのリンクを表示する
                                (data.ranks && series < 100 && series > 9) &&
                                <div style={{padding:"0 4px"}}>
                                {(session && session.user.id !== data.user_id) &&
                                    <Link href={`/compare/${session.user.id}/${consoles}/${series}/${year}/${data.user_id}/${consoles}/${series}/${year}`}>
                                        <Tooltip title="自分と比較"><FontAwesomeIcon icon={faPeopleArrows} style={{paddingRight:"4px"}} /></Tooltip>
                                    </Link>
                                }
                                {prevUser &&
                                    <Link href={`/compare/${data.user_id}/${consoles}/${series}/${year}/${prevUser}/${consoles}/${series}/${year}`}>
                                        <Tooltip title="上位と比較"><FontAwesomeIcon icon={faArrowDownUpAcrossLine} style={{paddingRight:"4px"}}/></Tooltip>
                                    </Link>
                                }
                                </div>
                            }
                        </Grid>}
                        <Grid item xs={12} sm={12} style={{
                            borderTop:'1px solid #777',
                            paddingTop:'8px',
                            maxWidth:'450px'
                        }}>
                            {data.img_url &&
                                <>
                                    <FontAwesomeIcon icon={faImage} style={{marginRight:"0.25em",fontSize:"1.25em"}} onClick={imgHandleOpen} />
                                    <Lightbox open={imgOpen} close={() => setImgOpen(false)}
                                              slides={[{src:"/api/file/"+data.img_url}]}
                                              render={{ slide: LightBoxImage, buttonPrev: undefined, buttonNext: undefined}}
                                              controller={{ closeOnPullDown: true, closeOnBackdropClick: true }}/>
                                </>}
                            {data.video_url &&
                                <>
                                    <Link href={data.video_url} target="_blank">
                                        <FontAwesomeIcon icon={faYoutube} style={{marginRight:"0.25em",fontSize:"1.25em"}}/>
                                    </Link>
                                </>}
                            {data.unique_id &&
                                <>
                                    <Link href={"/record/"+data.unique_id}>
                                        <FontAwesomeIcon icon={faTag} style={{marginRight:"0.25em",fontSize:"1.25em"}}/>
                                    </Link>
                                </>}
                            {data.console &&
                                <span style={{position:"relative",top:"-2px",fontSize:"0.85em",backgroundColor:"#eee",color:"#111",borderRadius:"4px",padding:"2px 4px",marginRight:"0.5em"}}>
                                {t.cnsl[data.console]}
                                </span>}
                            {data.post_comment &&
                                mini ?
                                <Tooltip title={data.post_comment} arrow><FontAwesomeIcon icon={faComment} /></Tooltip>
                                :
                                <>
                                    {data.post_comment}
                                </>}
                            {data?.ranks &&
                                <>
                                    <Grid container>
                                        {
                                            data.ranks.map(function(r, i){
                                                const title =
                                                    <>
                                                        <div style={{fontWeight:'bold'}}>
                                                            {t.stage[r.stage] + " " + (!hideRuleNames.includes(r.rule) ? `（${t.rule[r.rule]})` : "")}
                                                        </div>
                                                        <div>
                                                            {(!r.post_rank ? "未投稿" : `${r.post_rank} 位 / ${r.rps.toLocaleString()} RPS`)}
                                                        </div>
                                                    </>
                                                return <Tooltip key={i} style={{fontSize:"1.2em"}} placement="top" title={title} arrow><RankCell item style={{backgroundColor:rankCellColor(r.post_rank)}} className={`rank-cell ${series < 10 && "mini-cell"}`}/></Tooltip>
                                            })
                                        }
                                    </Grid>
                                </>}
                        </Grid>
                    </Grid>
                </Grid>
            </RecordContainer>
        {/*</Swiper>*/}
        </>
    )
}