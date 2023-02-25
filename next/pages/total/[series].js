import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {AppBar, Box, Container, Grid, Typography} from "@mui/material";
import Link from "next/link";
import Record from "../../components/Record";

export async function getServerSideProps(context){
    const series = context.query.series

    // シリーズ番号に基づいて集計対象ステージをバックエンドで選別して持ってくる
    const res = await fetch(`http://laravel:8000/api/total/${series}`)
    const data = await res.json()

    return {
        props: {
            data, series
        }
    }
}

export default function Series(param){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const stages = param.data.stage_list;
    const records = param.data.data;

    const consoles = [0, 1, 2]

    return (
        <>
            総合ランキング<br/>
            #{param.series}<br/>
            <Typography variant="h3">{ t.stage[param.series.slice(0,2)] }</Typography>
            <Grid container>
                {
                    consoles.map(console =>
                        <Grid xs={4}>
                            <Box sx={{
                                color: console === Number(param.series.slice(-1)) ? '#fff':'#777',
                                border: 'solid 4px #fff',
                                borderRadius: '6px',
                                padding: '8px',
                                margin: '4px',
                                minHeight: '2em',
                                fontSize: '0.9em',
                                textAlign: 'center',
                                lineHeight: '2em',
                            }}>
                                {t.console[console]}
                            </Box>
                        </Grid>
                    )
                }
            </Grid>
            <Grid container>
                {
                    stages.map(stage =>
                    <Grid xs={1.5}>
                        <Link href={'/stage/'+stage}><Box sx={{
                            border: 'solid 1px #fff',
                            borderRadius: '6px',
                            padding: '8px',
                            margin: '4px',
                            minHeight: '6em',
                            fontSize: '0.8em'}}>
                            <span>#{stage}</span><br/>
                            {t.stage[stage]}</Box>
                        </Link>
                    </Grid>
                    )
                }
            </Grid>
            <ul>
                {
                    Object.keys(records).map(e =>
                        <Record data={records[e]} />
                    )
                }
            </ul>
        </>
    )
}