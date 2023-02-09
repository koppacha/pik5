import {useRouter} from "next/router";
import {en} from "../locale/en";
import {ja} from "../locale/ja";
import {Grid} from "@mui/material";
import Link from "next/link";

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
        <Grid container>
            <Grid xs={1}>
                {r.post_rank} 位<br/>
                [{r.rps} rps]
            </Grid>
            <Grid xs={3}>
                {r.user_name}
            </Grid>
            <Grid xs={3}>
                {r.score} pts.
            </Grid>
            <Grid xs={5}>
                {dateFormat(r.created_at)} |
                {t.stage[r.stage_id]}<br/>
                <Link href={'/stage/'+r.img_url}>画像</Link> |
                <Link href={'/stage/'+r.video_url}>動画</Link> |
                <Link href={'/stage/'+r.unique_id}>ID</Link> |
                {r.post_comment}
            </Grid>
        </Grid>
    )
}