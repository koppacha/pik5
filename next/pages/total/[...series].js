import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {AppBar, Box, Container, FormControl, Grid, MenuItem, Select, Typography} from "@mui/material";
import Link from "next/link";
import Record from "../../components/Record";
import PullDownConsole from "../../components/PullDownConsole";
import PullDownYear from "../../components/PullDownYear";
import * as React from "react";

export async function getServerSideProps(context){
    const query = context.query.series
    const series = query[0]
    const rule  = query[2] || 0
    const console = query[1] || 0
    const year  = query[3] || 2023

    // シリーズ番号に基づいて集計対象ステージをバックエンドで選別して持ってくる
    const res = await fetch(`http://laravel:8000/api/total/${series}/${console}/${rule}/${year}`)
    const data = await res.json()

    return {
        props: {
            data, series, rule, console, year
        }
    }
}

export default function Series(param){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    const stages = param.data['stage_list'];
    const records = param.data.data;
    const rules = [0, 11, 12, 13, 14, 15, 16, 17]

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
            ルール
            <FormControl>
                <Select
                    sx={{color:'#fff'}}
                    defaultValue={param.rule}
                    id="select-rules"
                >
                    {
                        // ルールプルダウンを出力
                        rules.map(val =>
                            <MenuItem value={val}><Link href={'/total/'+param.series+'/'+
                                param.console+'/'+val+'/'+param.year}>{t.rule[val]}</Link></MenuItem>
                        )
                    }
                </Select>
            </FormControl>

            <PullDownConsole
                info={param.info}
                rule={param.rule}
                year={param.year}/>

            <PullDownYear
                info={param.info}
                rule={param.rule}
                year={param.console}/>

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