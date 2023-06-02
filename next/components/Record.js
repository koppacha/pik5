import {Grid, Typography} from "@mui/material";
import Link from "next/link";
import {faImage, faTag} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faYoutube} from "@fortawesome/free-brands-svg-icons";
import {useLocale} from "../plugin/pik5";
import ModalDialogImage from "./ModalDialogImage";
import {useEffect, useState} from "react";
import ModalDialogVideo from "./ModalDialogVideo";

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

export default function Record(props) {

    const {t} = useLocale()

    const shadow =  '2px 2px 2px #000, -2px 2px 2px #000,' +
                    ' 2px -2px 2px #000, -2px -2px 2px #000,' +
                    ' 2px 0 2px #000, 0 2px 2px #000,' +
                    ' -2px 0 2px #000, 0 -2px 2px #000';

    const data = props.data
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

    // 順位によってテーマカラーを決定する [0]文字色 [1]背景
    function rank2color(rank){
        rank = Number(rank)
        if(rank === 1){
            return [
                '#f6f24e',
                '#656565'
                ]
        } else if(rank === 2){
            return [
                '#42f35d',
                '#4b4b4b'
                ]
        } else if(rank === 3){
            return [
                '#23abf1',
                '#2a2a2a'
                ]
        } else if(rank < 11){
            return [
                '#eae4e4',
                '#181818'
                ]
        } else if(rank < 21){
            return [
                '#a8a2a2',
                '#181818'
                ]
        } else {
            return [
                '#777171',
                '#181818'
                ]
        }
    }

    const rankColor = rank2color(data.post_rank)

    // 比較値を整形する
    let compare;
    if(!Number.isNaN(data.compare)){
        if(data.compare > 0) compare = `(+${data.compare})`
        if(data.compare < 0) compare = `(-${data.compare})`
    } else {
        compare = ""
    }

    return (
        <Grid container sx={{
            borderLeft:'10px solid ' + rankColor[0],
            borderBottom:'1px solid ' + rankColor[0],
            backgroundColor: rankColor[1],
            borderRadius: '8px',
            padding: '4px',
            marginY: '10px',
            textAlign: 'center',
            boxShadow: '-3px 1px 4px ' + rankColor[0]
        }}>
            <Grid xs={1} sx={{
                borderRight: '1px solid #fff'
            }}>
                <Typography variant="" sx={{color:'#999'}}>{t.g.rankHead}</Typography>
                <Typography component="span" sx={{
                    fontSize:'2em',
                    fontWeight: '200',
                    fontFamily:['"Kulim Park"',"cursive"].join(","),
                    textShadow: shadow,
                }}>{data.post_rank}</Typography>
                <Typography variant="" sx={{
                    color:'#999',
                    textShadow: shadow,
                }}> {t.g.rankTail}</Typography>
                <Typography sx={{fontSize:'0.7em',color:'#999'}}>[{data.rps} rps]</Typography>
            </Grid>
            <Grid xs={3} sx={{
                borderRight: '1px solid #777',
            }}><Typography variant="" sx={{
                lineHeight: data.user.user_name.length > 12 ? '3.4em' : '3em',
                fontSize: data.user.user_name.length > 12 ? '1.1em' : '1.25em',
                textShadow: shadow,
            }}><Link href={"/user/"+data.user.user_id}>{data.user.user_name}</Link></Typography>
            </Grid>
            <Grid xs={3} sx={{
                borderRight: '1px solid #777',
            }}><Typography component="span" sx={{
                lineHeight: '3em',
                fontSize: '1.3em',
                fontFamily:['"Proza Libre"',"cursive"].join(","),
                textShadow: shadow,
            }}>
                {data.score.toLocaleString()}</Typography>
                <Typography component="span" sx={{
                    color:'#999',
                    textShadow: shadow,
                    fontFamily:['"Proza Libre"',"cursive"].join(","),
                }}> pts.</Typography>
                <Typography component="span" sx={{
                    color:'#4ce600',
                    fontSize: '0.8em',
                    fontFamily:['"Proza Libre"',"cursive"].join(","),
                    textShadow: shadow,
                }}> {compare}</Typography>
            </Grid>
            <Grid xs={5} sx={{
                textAlign: 'left',
            }}>
                <Grid container sx={{
                    margin: '8px',
                    fontSize: '0.8em',
                    width: '95%'
                }}>
                    <Grid xs={6}>
                        <time dateTime={date.toISOString()}>{isClient ? dateFormat(date) : ''}</time>
                    </Grid>
                    <Grid xs={6} sx={{
                        textAlign:'right'
                    }}>
                        {data.stage_id ? <><Link href={'/stage/'+data.stage_id}>{data.stage_id + '#' + t.stage[data.stage_id]}</Link></>:undefined}
                    </Grid>
                    <Grid xs={12} sx={{
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
        </Grid>
    )
}