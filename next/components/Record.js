import {Grid} from "@mui/material";
import Link from "next/link";
import {faImage, faTag} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faYoutube} from "@fortawesome/free-brands-svg-icons";
import {useLocale} from "../lib/pik5";
import ModalDialogImage from "./ModalDialogImage";
import Score from "./Score";
import {useEffect, useState} from "react";
import ModalDialogVideo from "./ModalDialogVideo";
import {
    CompareType,
    RankEdge,
    RankPointType,
    RankType,
    RecordContainer,
    UserType
} from "../styles/pik5.css";

// 日付をフォーマットする関数
function dateFormat(date){
    const y  = date.getFullYear()
    const mo = ('0' + (date.getMonth() + 1)).slice(-2)
    const d  = ('0' + date.getDate()).slice(-2)
    const h  = ('0' + date.getHours()).slice(-2)
    const mi = ('0' + date.getMinutes()).slice(-2)
    const s  = ('0' + date.getSeconds()).slice(-2)
    return y + '/' + mo + '/' + d + ' ' + h + ':' + mi + ':' + s
}
export default function Record({data}) {

    const {t} = useLocale()
    const date = new Date(data.created_at)

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
            <Grid xs={1} style={{
                borderRight: '1px solid #fff'
            }}>
                <RankEdge as="span">{t.g.rankHead} </RankEdge>
                <RankType as="span">{data.post_rank}</RankType>
                <RankEdge as="span"> {t.g.rankTail}</RankEdge>
                <RankPointType>[{data.rps} rps]</RankPointType>
            </Grid>
            <Grid xs={3} style={{
                borderRight: '1px solid #777',
            }}>
                <UserType><Link href={"/user/"+data.user.user_id}>{data.user.user_name}</Link></UserType>
            </Grid>
            <Grid xs={3} style={{
                borderRight: '1px solid #777',
            }}>
                <Score score={data.score} stage={data.stage_id} category={data.category} />
                <CompareType as="span"> {compare}</CompareType>
            </Grid>
            <Grid xs={5} style={{
                textAlign: 'left',
            }}>
                <Grid container style={{
                    margin: '8px',
                    fontSize: '0.8em',
                    width: '95%'
                }}>
                    <Grid xs={6}>
                        <time dateTime={date.toISOString()}>{isClient ? dateFormat(date) : ''}</time>
                    </Grid>
                    <Grid xs={6} style={{
                        textAlign:'right'
                    }}>
                        {data.stage_id ? <><Link href={'/stage/'+data.stage_id}>{data.stage_id + '#' + t.stage[data.stage_id]}</Link></>:undefined}
                    </Grid>
                    <Grid xs={12} style={{
                        borderTop:'1px solid #777',
                        paddingTop:'8px'
                    }}>
                        {data.img_url ?
                            <>
                                <FontAwesomeIcon icon={faImage}  onClick={imgHandleOpen} />
                                <ModalDialogImage url={data.img_url} imgOpen={imgOpen} imgHandleClose={imgHandleClose}/>
                            </>: undefined}
                        {data.video_url ?
                            <>
                                <FontAwesomeIcon icon={faYoutube} onClick={videoHandleOpen}/>
                                <ModalDialogVideo url={data.video_url} videoOpen={videoOpen} videoHandleClose={videoHandleClose}/>
                            </>: undefined}
                        {data.unique_id ? <Link href={'/record/'+data.unique_id}><FontAwesomeIcon icon={faTag}/></Link>: undefined}
                        {data.post_comment ? data.post_comment : undefined}
                    </Grid>
                </Grid>
            </Grid>
        </RecordContainer>
    )
}