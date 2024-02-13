import {Box, Grid, Tooltip, Typography} from "@mui/material";
import Link from "next/link";
import {faComment, faImage, faScaleUnbalanced, faScaleUnbalancedFlip, faTag} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faYoutube} from "@fortawesome/free-brands-svg-icons";
import {currentYear, dateFormat, fetcher, rankColor, sec2time, stageUrlOutput, useLocale} from "../../lib/pik5";
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

export default function Record({parent, data, stages, series, consoles, year, prevUser}) {

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

    // カテゴリによってユーザーページリンクを置き換える
    const userPageUrl = (data.category === "speedrun") ? "https://www.speedrun.com/user/"+data.user_name : "/user/"+data.user_id

    // シリーズが指定されている場合、ランキングセルの折り返し位置を指定
    const cols = (series === 2) ? 15 : 25

    // 比較値を整形する
    let compare;
    if(!Number.isNaN(data.compare)){
        if(data.compare > 0){
            if([30, 31, 32, 36, 41].includes(Number(data.rule))){
                compare = `(+${sec2time(data.compare)})`
            } else {
                compare = `(+${data.compare})`
            }
        }
        if(data.compare < 0) compare = `(${data.compare})`
    } else {
        compare = ""
    }
    const currentRankFrontColor = rankColor(data?.post_rank ?? 20, data?.team ?? 0, 1)
    const className = data?.post_rank === 1 ? "rank1" :
                             data?.post_rank === 2 ? "rank2" :
                             data?.post_rank === 3 ? "rank3" :
                             data?.post_rank <  11 ? "rank4" :
                             data?.post_rank <  21 ? "rank11": "rank21"
    return (
        <RecordContainer className={`record-container ${className}`} container rank={data?.post_rank ?? 20} team={data?.team ?? 0}
            style={{borderLeft:      `10px solid ${currentRankFrontColor}`,
                    borderBottom:    `1px solid ${currentRankFrontColor}`,
                    boxShadow:       `-3px 1px 4px ${currentRankFrontColor}`}}
        >
            <RecordGridWrapper className="record-grid-wrapper" item xs={2} sm={1}>
                <div>
                    <RankEdge className="rank-edge" as="span">{t.g.rankHead} </RankEdge>
                    <RankType className="rank-type" as="span">{data?.post_rank ?? "?"}</RankType>
                    <RankEdge className="rank-edge" as="span"> {t.g.rankTail}</RankEdge>
                    <RankPointType className="rank-point-type">[{data?.rps ?? "?"} rps]</RankPointType>
                </div>
            </RecordGridWrapper>
            <RecordGridWrapper className="record-grid-wrapper" item xs={3} sm={3}>
                <UserType className="user-type" length={data.user_name?.length || 0}><Link href={userPageUrl}>{data.user_name}</Link></UserType>
            </RecordGridWrapper>
            <RecordGridWrapper className="record-grid-wrapper" item xs={3} sm={3}>
                <div>
                <Score rule={data.rule} score={data.score} stage={data.stage_id} category={data.category} />
                <CompareType className="compare-type" as="span"> {compare}</CompareType>
                {
                    // 総合ランキングの場合は投稿ステージ数を表示
                    (data?.ranks) &&
                        <>
                            <br/><ScoreType className="score-type" style={{fontSize:"0.8em"}} as="span">{data.ranks.filter(v => v).length} / {data.ranks.length}</ScoreType>
                        </>
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
                    <Grid item xs={12} sm={9} style={{textAlign:'right'}}>
                        {data.stage_id &&
                            <Link href={'/stage/'+stageUrlOutput(data.stage_id, 0, data.rule, currentYear(), parent?.stage_id)}>{data.stage_id + '#' + t.stage[data.stage_id]}
                                {hideRuleNames.includes(data.rule) || <span style={{fontSize:'0.85em'}}> ({t.rule[data.rule]})</span>}
                            </Link>
                        }
                        {(data?.ranks && series < 100) &&
                            <>
                            {(session && session.user.id !== data.user_id) &&
                                <Link href={`/compare/${session.user.id}/${consoles}/${series}/${year}/${data.user_id}/${consoles}/${series}/${year}`}>
                                    <CompareIcon><FontAwesomeIcon icon={faScaleUnbalancedFlip} /><span style={{fontSize:"0.8em"}}>自分と比較</span></CompareIcon>
                                </Link>
                            }
                            {prevUser &&
                                <Link href={`/compare/${data.user_id}/${consoles}/${series}/${year}/${prevUser}/${consoles}/${series}/${year}`}>
                                    <CompareIcon><FontAwesomeIcon icon={faScaleUnbalanced} /><span style={{fontSize:"0.8em"}}>上位と比較</span></CompareIcon>
                                </Link>
                            }
                            </>
                        }
                    </Grid>
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
                                          rendar={{ slide: LightBoxImage, buttonPrev: undefined, buttonNext: undefined}}
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
                            <>
                                {data.post_comment}
                            </>}
                        {data?.ranks &&
                            <>
                                <Grid container>
                                    {
                                        data.ranks.map(function(r, i){
                                            const title = t.stage[stages[i]] + " " + (!r ? "未投稿" : `${r} 位`)
                                            return <Tooltip key={i} style={{fontSize:"1.2em"}} placement="top" title={title} arrow><RankCell item rank={r}/></Tooltip>
                                        })
                                    }
                                </Grid>
                            </>}
                    </Grid>
                </Grid>
            </Grid>
        </RecordContainer>
    )
}