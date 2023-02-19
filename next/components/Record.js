import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";
import {Grid, Typography} from "@mui/material";
import Link from "next/link";
import {faImage, faTag} from "@fortawesome/free-solid-svg-icons";
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
    const shadow =  '2px 2px 2px #000, -2px 2px 2px #000,' +
                    ' 2px -2px 2px #000, -2px -2px 2px #000,' +
                    ' 2px 0 2px #000, 0 2px 2px #000,' +
                    ' -2px 0 2px #000, 0 -2px 2px #000';

    const r = props.data

    // 順位によってテーマカラーを決定する [0]文字色 [1]背景
    function rank2color(rank){
        rank = Number(rank)
        if(rank === 1){
            return [
                '#f6f24e',
                '#595959'
                ]
        } else if(rank === 2){
            return [
                '#42f35d',
                '#363636'
                ]
        } else if(rank === 3){
            return [
                '#23abf1',
                '#1e1e1e'
                ]
        } else if(rank < 11){
            return [
                '#eae4e4',
                '#181818'
                ]
        } else if(rank < 21){
            return '#a8a2a2'
        } else {
            return '#777171'
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
                <Typography component="span" sx={{color:'#999'}}>{t.g.rankHead}</Typography>
                <Typography component="span" sx={{
                    fontSize:'2em',
                    fontWeight: '200',
                    fontFamily:['"Kulim Park"',"cursive"].join(","),
                    textShadow: shadow,
                }}>{r.post_rank}</Typography>
                <Typography component="span" sx={{
                    color:'#999',
                    textShadow: shadow,
                }}> {t.g.rankTail}</Typography>
                <Typography sx={{fontSize:'0.7em',color:'#999'}}>[{r.rps} rps]</Typography>
            </Grid>
            <Grid xs={3} sx={{
                borderRight: '1px solid #777',
            }}><Typography component="span" sx={{
                lineHeight: '3em',
                fontSize: '1.25em',
                fontFamily:['"M PLUS 1 CODE"'].join(","),
                textShadow: shadow,
            }}><Link href={"/user/"+r.user_id}>{r.user.user_name}</Link></Typography>
            </Grid>
            <Grid xs={3} sx={{
                borderRight: '1px solid #777',
            }}><Typography component="span" sx={{
                lineHeight: '3em',
                fontSize: '1.3em',
                fontFamily:['"Proza Libre"',"cursive"].join(","),
                textShadow: shadow,
            }}>
                {r.score.toLocaleString()}</Typography>
                <Typography component="span" sx={{
                    color:'#999',
                    textShadow: shadow,
                }}> pts.</Typography>
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
                        {r.stage_id ? <><Link href={'/stage/'+r.stage_id}>{r.stage_id + '#' + t.stage[r.stage_id]}</Link></>:undefined}
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