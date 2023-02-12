import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";
import {Box, createTheme, Grid, Typography} from "@mui/material";
import Link from "next/link";
import {faHashtag, faImage, faTag} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faYoutube} from "@fortawesome/free-brands-svg-icons";

// 日付をフォーマットする関数
function dateFormat(value){
    const date = new Date(value)
    const y  = date.getFullYear()
    const mo = ('0' + (date.getMonth() + 1)).slice(-2)
    const d  = ('0' + date.getDate()).slice(-2)
    const h  = ('0' + date.getHours()).slice(-2)
    const mi = ('0' + date.getMinutes()).slice(-2)
    const s  = ('0' + date.getSeconds()).slice(-2)
    return y + '/' + mo + '/' + d + ' ' + h + ':' + mi + ':' + s
}

export default function Record(props) {

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const r = props.data

    // 順位によってテーマカラーを決定する [0]文字色 [1]背景
    function rank2color(rank){
        rank = Number(rank)
        if(rank === 1){
            return [
                '#f2ee0c',
                '#595959'
                ]
        } else if(rank === 2){
            return [
                '#0cf232',
                '#313131'
                ]
        } else if(rank === 3){
            return [
                '#0ca2f2',
                '#111111'
                ]
        } else if(rank < 11){
            return [
                '#eae4e4',
                '#000000'
                ]
        } else if(rank < 21){
            return '#c0bbbb'
        } else {
            return '#a8a0a0'
        }
    }

    const rankColor = rank2color(r.post_rank)

    return (
        <Grid container sx={{
            borderLeft:'10px solid ' + rankColor[0],
            borderBottom:'1px solid ' + rankColor[0],
            backgroundColor: rankColor[1],
            borderRadius: '8px',
            padding: '4px',
            marginY: '10px',
            textAlign: 'center'
        }}>
            <Grid xs={1} sx={{
                borderRight: '1px solid #fff'
            }}>
                <Typography sx={{
                    fontSize:'2em',
                    fontFamily:["Outfit","cursive"].join(",")
                }}>{r.post_rank}</Typography>
                <Typography sx={{fontSize:'0.7em',color:'#999'}}>[{r.rps} rps]</Typography>
            </Grid>
            <Grid xs={3} sx={{
                lineHeight: '3em',
                fontSize: '1.25em',
                borderRight: '1px solid #777'
            }}>
                {r.user_name}
            </Grid>
            <Grid xs={3} sx={{
                lineHeight: '3em',
                fontSize: '1.3em',
                borderRight: '1px solid #777',
                fontFamily:["Outfit","cursive"].join(",")
            }}>
                {r.score.toLocaleString()}
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
                        {dateFormat(r.created_at)}
                    </Grid>
                    <Grid xs={6} sx={{
                        textAlign:'right'
                    }}>
                        {r.stage_id ? <>{r.stage_id + '#' + t.stage[r.stage_id]}</>:undefined}
                    </Grid>
                    <Grid xs={12} sx={{
                        borderTop:'1px solid #777',
                        paddingTop:'8px'
                    }}>
                        {r.img_url ? <Link href={'/image/'+r.img_url}><FontAwesomeIcon icon={faImage} /></Link>: undefined}
                        {r.video_url ? <Link href={r.video_url}><FontAwesomeIcon icon={faYoutube}/></Link>: undefined}
                        {r.unique_id ? <Link href={'/record/'+r.unique_id}><FontAwesomeIcon icon={faTag}/></Link>: undefined}
                        {r.post_comment ? r.post_comment : undefined}
                    </Grid>
                </Grid>
            </Grid>
        </Grid>
    )
}