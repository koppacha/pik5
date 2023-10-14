import {Grid, Tooltip} from "@mui/material";
import Link from "next/link";
import {faComment, faImage, faTag} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faYoutube} from "@fortawesome/free-brands-svg-icons";
import {dateFormat, fetcher, sec2time, useLocale} from "../../lib/pik5";
import Score from "./Score";
import React, {useEffect, useState} from "react";
import {
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

export default function Record({data, stages}) {

    const {t} = useLocale()
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

    return (
        <RecordContainer container rank={data?.post_rank ?? 20} team={data?.team}>
            <RecordGridWrapper item xs={2} sm={1}>
                <div>
                    <RankEdge as="span">{t.g.rankHead} </RankEdge>
                    <RankType as="span">{data?.post_rank ?? "?"}</RankType>
                    <RankEdge as="span"> {t.g.rankTail}</RankEdge>
                    <RankPointType>[{data?.rps ?? "?"} rps]</RankPointType>
                </div>
            </RecordGridWrapper>
            <RecordGridWrapper item xs={3} sm={3}>
                <UserType length={data.user_name?.length || 0}><Link href={userPageUrl}>{data.user_name}</Link></UserType>
            </RecordGridWrapper>
            <RecordGridWrapper item xs={3} sm={3}>
                <div>
                <Score rule={data.rule} score={data.score} stage={data.stage_id} category={data.category} />
                <CompareType as="span"> {compare}</CompareType>
                {
                    // 総合ランキングの場合は投稿ステージ数を表示
                    (data?.ranks) &&
                        <>
                            <br/><ScoreType style={{fontSize:"0.8em"}} as="span">{data.ranks.filter(v => v).length} / {data.ranks.length}</ScoreType>
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
                    <Grid item xs={12} sm={6}>
                        <time dateTime={date.toISOString()}>{isClient ? dateFormat(date) : ''}</time>
                    </Grid>
                    <Grid item xs={12} sm={6} style={{
                        textAlign:'right'
                    }}>
                        {data.stage_id ? <><Link href={'/stage/'+data.stage_id}>{data.stage_id + '#' + t.stage[data.stage_id]}</Link></>:undefined}
                    </Grid>
                    <Grid item xs={12} sm={12} style={{
                        borderTop:'1px solid #777',
                        paddingTop:'8px'
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
                        {data.post_comment &&
                            <>
                                {data.post_comment}
                            </>}
                        {data?.ranks &&
                            <>
                                <Grid container sx={6} md={12} lg={25}>
                                    {
                                        data.ranks.map(function(r, i){
                                            const title = t.stage[stages[i]] + " " + (!r ? "未投稿" : `${r} 位`)
                                            return <Tooltip style={{fontSize:"1.2em"}} placement="top" title={title} arrow><RankCell item rank={r}/></Tooltip>
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