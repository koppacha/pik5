import {Grid} from "@mui/material";
import Link from "next/link";
import {faImage, faTag} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faYoutube} from "@fortawesome/free-brands-svg-icons";
import {useLocale} from "../../lib/pik5";
import ModalDialogImage from "../modal/ModalDialogImage";
import Score from "./Score";
import {useEffect, useState} from "react";
import ModalDialogVideo from "../modal/ModalDialogVideo";
import {
    CompareType,
    RankEdge,
    RankPointType,
    RankType,
    RecordContainer,
    UserType
} from "../../styles/pik5.css";

// 日付をフォーマットする関数
function dateFormat(date, now){
    const diff = now.getTime() - date.getTime()
    if(diff > (1000 * 60 * 60 * 12)) {
        // 12時間以上前なら日付で表示
        const y = date.getFullYear()
        const mo = ('0' + (date.getMonth() + 1)).slice(-2)
        const d = ('0' + date.getDate()).slice(-2)
        return y + '/' + mo + '/' + d
    } else {
        // 12時間以内なら時間で表示
        const h = ('0' + date.getHours()).slice(-2)
        const mi = ('0' + date.getMinutes()).slice(-2)
        const s = ('0' + date.getSeconds()).slice(-2)
        return h + ':' + mi + ':' + s
    }
}
export default function Record({data}) {

    const {t} = useLocale()
    const date = new Date(data.created_at)
    const now = new Date()

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
    const userPageUrl = (data.category === "speedrun") ? "https://www.speedrun.com/user/"+data.user.user_name : "/user/"+data.user.user_id

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
                <RankType as="span">{data.post_rank}</RankType>
                <RankEdge as="span"> {t.g.rankTail}</RankEdge>
                {
                    data.rps &&
                    <RankPointType>[{data.rps} rps]</RankPointType>
                }
            </Grid>
            <Grid item xs={2.5} sm={3} style={{
                borderRight: '1px solid #777',
            }}>
                <UserType><Link href={userPageUrl}>{data.user.user_name}</Link></UserType>
            </Grid>
            <Grid item xs={2.5} sm={3} style={{
                borderRight: '1px solid #777',
            }}>
                <Score score={data.score} stage={data.stage_id} category={data.category} />
                <CompareType as="span"> {compare}</CompareType>
            </Grid>
            <Grid item xs={5.5} sm={5} style={{
                textAlign: 'left',
            }}>
                <Grid container style={{
                    margin: '8px',
                    fontSize: '0.8em',
                    width: '95%'
                }}>
                    <Grid item xs={5} sm={6}>
                        <time dateTime={date.toISOString()}>{isClient ? dateFormat(date, now) : ''}</time>
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