import {AppBar, Box, Container, FormControl, Grid, MenuItem, Select, Typography} from "@mui/material";
import Link from "next/link";
import Record from "../../components/record/Record";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import Totals from "../../components/rule/Totals";
import {createContext} from "react";
import Rules from "../../components/rule/Rules";
import {useLocale} from "../../lib/pik5";
import BreadCrumb from "../../components/BreadCrumb";
import RankingTotal from "../../components/record/RankingTotal";
import Head from "next/head";

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

    const {t, r} = useLocale()

    const stages = param.data['stage_list'];

    return (
        <>
            <Head>
                <title>{ t.stage[param.series] } - {t.title[0]}</title>
            </Head>
            #{param.series}<br/>
            <BreadCrumb info={param.info} rule={param.rule}/>
            <Typography variant="" className="title">{ t.stage[param.series] }</Typography><br/>
            <Typography variant="" className="subtitle">{r.stage[param.series]}</Typography>
            <Grid container style={{margin:"2em 0"}}>
                {
                    stages.map(stage =>
                    <Grid item xs={1.2}>
                        <Link key={stage} href={'/stage/'+stage}><Box style={{
                            backgroundColor: "#444444",
                            borderRadius: '6px',
                            padding: '6px',
                            margin: '2px',
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
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                </Grid>
            </Grid>
            <Grid container style={{
                marginTop:"30px"
            }}>
            <Totals props={param}/>
            </Grid>
            <RankingTotal series={param.series} console={param.console} rule={param.rule} year={param.year}/>
        </>
    )
}