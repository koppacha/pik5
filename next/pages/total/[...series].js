import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {AppBar, Box, Container, FormControl, Grid, MenuItem, Select, Typography} from "@mui/material";
import Link from "next/link";
import Record from "../../components/Record";
import PullDownConsole from "../../components/PullDownConsole";
import PullDownYear from "../../components/PullDownYear";
import * as React from "react";
import Rules from "../../components/Rules";

export async function getServerSideProps(context){
    const query = context.query.series
    const series = query[0]

    // ステージ情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/${series}`)
    const info = await stage_res.json()

    const rule  = query[2] || series
    const console = query[1] || 0
    const year  = query[3] || 2023

    // シリーズ番号に基づいて集計対象ステージをバックエンドで選別して持ってくる
    const res = await fetch(`http://laravel:8000/api/total/${series}/${console}/${rule}/${year}`)
    const data = await res.json()

    return {
        props: {
            data, series, rule, console, year, info
        }
    }
}

export default function Series(param){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const stages = param.data['stage_list'];
    const records = param.data.data;

    return (
        <>
            総合ランキング<br/>
            #{param.series}<br/>
            <Typography variant="h3">{ t.stage[param.series.slice(0,2)] }</Typography>
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

            <PullDownConsole
                console={param.console}
                info={param.info}
                rule={param.rule}
                year={param.year}/>

            <PullDownYear
                console={param.console}
                info={param.info}
                rule={param.rule}
                year={param.year}/>

            <Box>
                <Rules
                    rule={param.rule}
                    info={param.info}
                    console={param.console}
                    year={param.year}/>
            </Box>

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