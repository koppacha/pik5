import * as React from "react";
import Record from "../../components/Record";
import {Box, Grid, Typography} from "@mui/material";
import Link from "next/link";
import {useLocale} from "../../plugin/pik5";
import RecordPost from "../../components/RecordPost";
import PullDownConsole from "../../components/PullDownConsole";
import PullDownYear from "../../components/PullDownYear";
import Rules from "../../components/Rules";
import BreadCrumb from "../../components/BreadCrumb";

// サーバーサイドの処理
export async function getServerSideProps(context){

    const query = context.query.stage
    const stage = query[0]

    // ステージ情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/${stage}`)
    const info = await stage_res.json()

    const rule  = query[2] || info.parent
    const console = query[1] || 0
    const year  = query[3] || 2023

    // 記録をリクエスト
    const res = await fetch(`http://laravel:8000/api/record/${stage}/${console}/${rule}/${year}`)

    const data = await res.json()

    return {
        props: {
            data, stage, rule, console, year, info
        }
    }
}
export default function Stage({data, stage, rule, console, year, info}){

    const {t, r} = useLocale()

    // ボーダーライン出力用変数
    let i = 0
    const borders = [info.border1, info.border2, info.border3, info.border4]

    return (
        <>
            #{stage}<br/>
            <BreadCrumb info={info} rule={rule}/>
            <Typography variant="" className="title">{ t.stage[stage] }</Typography><br/>
            <Typography variant="" className="subtitle">{r.stage[stage]}</Typography>

            <Grid container>
                <Grid item xs={12}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                </Grid>
            </Grid>
            <Box style={{margin:"20px 0"}}>
                <Grid container style={{
                    marginTop:"30px"
                }}>
                    <Rules props={param}/>
                    <RecordPost
                        info={info}/>
                </Grid>
            </Box>
                {
                    // 記録を出力（ボーダー設定がある通常ランキング）
                    Object.values(data).map(function (post){
                            const border = borders[i]
                            const star = "★"
                            if(post.score < border){
                                i++;
                                return (
                                    <>
                                        <Box style={{
                                            color:"#e81fc1",
                                            borderBottom:"2px dotted #e81fc1",
                                            textAlign:"center",
                                        }}>
                                            {star.repeat(4-i)} {t.border[2][i]} {border}点
                                        </Box>
                                        <Record data={post}/>
                                    </>
                                )
                            } else {
                                return (
                                    <Record data={post}/>
                                )
                            }
                        }
                    )
                }
        </>
    )
}
