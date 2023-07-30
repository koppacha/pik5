import {Grid, Tooltip} from "@mui/material";
import Link from "next/link";
import {faImage, faTag} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faYoutube} from "@fortawesome/free-brands-svg-icons";
import {dateFormat, fetcher, useLocale} from "../../lib/pik5";
import Score from "./Score";
import {useEffect, useState} from "react";
import {
    CompareType,
    RankEdge,
    RankPointType,
    RankType,
    RecordContainer,
    UserType
} from "../../styles/pik5.css";
import Lightbox from "yet-another-react-lightbox";
import LightBoxImage from "../modal/LightBoxImage";
import "yet-another-react-lightbox/styles.css";

export default function Record({data}) {

    const {t} = useLocale()
    const date = new Date(data.created_at ?? "2006-09-01 00:00:00")

    const [imgOpen, setImgOpen] = useState(false)
    const [videoOpen, setVideoOpen] = useState(false)
    const [isClient, setIsClient] = useState(false)

    useEffect(() => setIsClient(true), [])

    const imgHandleClose = () => {
        setImgOpen(false)
    }
    const imgHandleOpen = () => {
        setImgOpen(true)
    }
    const videoHandleClose = () => {
        setVideoOpen(false)
    }
    const videoHandleOpen = () => {
        setVideoOpen(true)
    }

    // カテゴリによってユーザーページリンクを置き換える
    const userPageUrl = (data.category === "speedrun") ? "https://www.speedrun.com/user/"+data.user_name : "/user/"+data.user_id

    // 比較値を整形する
    let compare;
    if(!Number.isNaN(data.compare)){
        if(data.compare > 0) compare = `(+${data.compare})`
        if(data.compare < 0) compare = `(${data.compare})`
    } else {
        compare = ""
    }
    return (
        <RecordContainer container rank={data.post_rank}>
            <Grid item xs={1.5} sm={1} style={{
                borderRight: '1px solid #fff'
            }}>
                <RankEdge as="span">{t.g.rankHead} </RankEdge>
                <RankType as="span">{data.post_rank ?? "?"}</RankType>
                <RankEdge as="span"> {t.g.rankTail}</RankEdge>
                <RankPointType>[{data.rps ?? "?"} rps]</RankPointType>
            </Grid>
            <Grid item xs={3} sm={3} style={{
                borderRight: '1px solid #777',
            }}>
                <UserType length={data.user_name.length}><Link href={userPageUrl}>{data.user_name}</Link></UserType>
            </Grid>
            <Grid item xs={3} sm={3} style={{
                borderRight: '1px solid #777',
            }}>
                <Score rule={data.rule} score={data.score} stage={data.stage_id} category={data.category} />
                <CompareType as="span"> {compare}</CompareType>
            </Grid>
            <Grid item xs={4.5} sm={5} style={{
                textAlign: 'left',
            }}>
                <Grid container style={{
                    margin: '8px',
                    fontSize: '0.8em',
                    width: '95%'
                }}>
                    <Grid item xs={5} sm={6}>
                        <time dateTime={date.toISOString()}>{isClient ? dateFormat(date) : ''}</time>
                    </Grid>
                    <Grid item xs={7} sm={6} style={{
                        textAlign:'right'
                    }}>
                        {data.stage_id ? <><Link href={'/stage/'+data.stage_id}>{data.stage_id + '#' + t.stage[data.stage_id]}</Link></>:undefined}
                    </Grid>
                    <Grid item xs={12} sm={12} style={{
                        borderTop:'1px solid #777',
                        paddingTop:'8px'
                    }}>
                        {data.img_url ?
                            <>
                                <FontAwesomeIcon icon={faImage} style={{marginRight:"0.25em",fontSize:"1.25em"}} onClick={imgHandleOpen} />
                                <Lightbox open={imgOpen} close={() => setImgOpen(false)}
                                          slides={[{src:"/api/file/"+data.img_url}]}
                                          rendar={{ slide: LightBoxImage, buttonPrev: undefined, buttonNext: undefined}}
                                          controller={{ closeOnPullDown: true, closeOnBackdropClick: true }}/>
                            </>: undefined}
                        {data.video_url ?
                            <>
                                <Link href={data.video_url} target="_blank">
                                    <FontAwesomeIcon icon={faYoutube} style={{marginRight:"0.25em",fontSize:"1.25em"}}/>
                                </Link>
                            </>: undefined}
                        {data.unique_id ?
                            <Tooltip title={"ID: " + data.unique_id} arrow>
                                <FontAwesomeIcon icon={faTag} style={{marginRight:"0.25em",fontSize:"1.25em"}}/>
                            </Tooltip>: undefined}
                        {data.post_comment ? data.post_comment : undefined}
                    </Grid>
                </Grid>
            </Grid>
        </RecordContainer>
    )
}