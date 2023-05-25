import {useEffect, useState} from "react";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import { useRouter } from "next/router";
import Record from "../../components/Record";
import {
    Box,
    Grid,
    Typography
} from "@mui/material";
import Link from "next/link";
import Button from "@mui/material/Button";
import {faGlobe, faStar} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import * as React from "react";
import {range} from "../../plugin/pik5";
import RecordPost from "../../components/RecordPost";
import PullDownConsole from "../../components/PullDownConsole";
import PullDownYear from "../../components/PullDownYear";
import Rules from "../../components/Rules";

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

export default function Stage(param){

    const { locale } = useRouter()
    const t = (locale === "en") ? en : ja
    const r = (locale === "en") ? ja : en

    // ボーダーライン出力用変数
    let i = 0
    const borders = [param.info.border1, param.info.border2, param.info.border3, param.info.border4]

    // サブカテゴリが存在する場合は総合ランキングへのリンクを出力する
    const subCategory = () => {
        if(param.info.parent){
            return (
                <Link href={"/total/"+param.info.parent+"0"}>（{t.rule[param.info.parent]}）</Link>
            )
        }
    }
    return (
        <>
            #{param.stage}<br/>
            <Link href={"/total/"+param.stage.slice(0,2)+"0"}>{t.title[param.info.series]} {(param.info.series === 3) ? t.g.mission : t.g.challenge}</Link>
            {subCategory()}<br/>
            <Typography variant="h3" sx={{
                fontFamily:['"M PLUS 1 CODE"'].join(","),
            }}>{ t.stage[param.stage] }</Typography>
            <Typography sx={{color:'#999'}}>{r.stage[param.stage]}</Typography>

            <PullDownConsole
                console={param.console}
                info={param.info}
                rule={param.rule}
                year={param.year}/>

            <PullDownYear
                year={param.year}
                info={param.info}
                rule={param.rule}
                console={param.console}/>

            <Box sx={{margin:"20px"}}>

            <Rules
                rule={param.rule}
                info={param.info}
                console={param.console}
                year={param.year}/>

                <Grid>
                    <RecordPost/>
                </Grid>
            </Box>
                {
                    // 記録を出力（ボーダー設定がある通常ランキング）
                    Object.values(param.data).map(function (post){
                            const border = borders[i]
                            const star = "★"
                            if(post.score < border){
                                i++;
                                return (
                                    <>
                                        <Box sx={{
                                            color:"#e81fc1",
                                            borderBottom:"2px dotted #e81fc1",
                                            textAlign:"center",
                                            fontFamily:['"M PLUS 1 CODE"'].join(","),
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
