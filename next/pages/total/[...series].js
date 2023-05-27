import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {AppBar, Box, Container, FormControl, Grid, MenuItem, Select, Typography} from "@mui/material";
import Link from "next/link";
import Record from "../../components/Record";
import PullDownConsole from "../../components/PullDownConsole";
import PullDownYear from "../../components/PullDownYear";
import * as React from "react";
import Totals from "../../components/Totals";
import {createContext} from "react";
import Rules from "../../components/Rules";

export async function getServerSideProps(context){
    const query = context.query.series
    const series = query[0]

    // ステージ情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/${series}`)
    const info = await stage_res.json()

    const console = query[1] || 0
    let rule  = query[2] || series
    const year  = query[3] || 2023

    // 総合ランキングの総合ランキングにアクセスする場合はルールフィルターを無効にする
    if(series % 10 === 0 || series < 10){
        rule = 0
    }

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
    const r = (locale === "en") ? ja : en;

    const stages = param.data['stage_list'];
    const records = param.data.data;

    function ruleOutput(){
        if(param.rule){
            // １レイヤーの総合ランキングは通常ランキングのルールコンポーネントを流用
            return (
                <Rules
                    rule={param.rule}
                    info={param.info}
                    console={param.console}
                    year={param.year}/>
            )
        } else {
            // ２レイヤーの総合ランキングは専用コンポーネントに分岐する
            return (
                <Totals
                    series={param.series}
                    info={param.info}
                    console={param.console}
                    year={param.year}/>
            )
        }
    }

    return (
        <>
            総合ランキング<br/>
            #{param.series}<br/>
            <Typography variant="" className="title">{ t.stage[param.series] }</Typography><br/>
            <Typography variant="" className="subtitle">{r.stage[param.series]}</Typography>
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

            <Grid container>
                <Grid item xs={12}>
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
                </Grid>
            </Grid>
            <Grid container sx={{
                marginTop:"30px"
            }}>
                {
                    ruleOutput()
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