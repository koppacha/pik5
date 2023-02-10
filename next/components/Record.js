import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";
import {Box, Grid, Typography} from "@mui/material";
import Link from "next/link";
import {faHashtag, faImage, faTag} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faYoutube} from "@fortawesome/free-brands-svg-icons";

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

    const r = props.data;

    return (
        <Grid container sx={{
            borderLeft:'10px solid #fff',
            borderBottom:'1px solid #fff',
            backgroundColor: '#555',
            borderRadius: '8px',
            padding: '4px',
            marginY: '20px',
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
                        {r.stage_id}#{t.stage[r.stage_id]}
                    </Grid>
                    <Grid xs={12} sx={{
                        borderTop:'1px solid #777',
                        paddingTop:'8px'
                    }}>
                        <Link href={'/image/'+r.img_url}><FontAwesomeIcon icon={faImage} /></Link>
                        <Link href={r.video_url}><FontAwesomeIcon icon={faYoutube}/></Link>
                        <Link href={'/record/'+r.unique_id}><FontAwesomeIcon icon={faTag}/></Link>
                        {r.post_comment}
                    </Grid>
                </Grid>
            </Grid>
        </Grid>
    )
}