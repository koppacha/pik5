import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {AppBar, Box, Container, Grid, Typography} from "@mui/material";
import Link from "next/link";

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

    // デフォルト設定ではスコア降順で並び替え（sort関数を使うためにオブジェクトを配列に変換）
    const result = Object.keys(param.data).map(function (key){
        return param.data[key]
    }).sort( function(a, b){
        return (a.score > b.score) ? -1 : 1
    })

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const stages = result.shift() // ソート後にstage_listは先頭に来るのでそれを取り出す

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
                    result.map(data =>
                        <li>{data.user_name}:{data.score}pts/{data.rps}rps</li>
                    )
                }
            </ul>
        </>
    )
}