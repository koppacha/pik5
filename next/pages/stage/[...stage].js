import {useEffect, useState} from "react";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import { useRouter } from "next/router";
import Record from "../../components/Record";
import {
    Box,
    Card,
    CardContent,
    CardHeader,
    FormControl,
    FormHelperText,
    Grid,
    MenuItem,
    Select,
    Typography
} from "@mui/material";
import Link from "next/link";
import Button from "@mui/material/Button";

// サーバーサイドの処理
export async function getServerSideProps(context){
    const query = context.query.stage

    // 以下はすべて文字列として処理される
    const stage = query[0]
    const rule  = query[2] || 0
    const console = query[1] || 0
    const year  = query[3] || 2023

    // 記録をリクエスト
    const res = await fetch(`http://laravel:8000/api/record/${stage}/${console}/${rule}/${year}`)

    // ステージ情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/${stage}`)

    const data = await res.json()
    const info = await stage_res.json()

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
    const rules = [0]
    const consoles = [0, 1, 2, 3, 4]
    const years = [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014]

    // ステージによってルールを追加
    if(param.info.series === 1){
        // 全回収タイムアタック
        rules.push(11)
    }
    if(param.info.parent === 21){
        // タマゴムシ縛り
        rules.push(23, 26, 27, 28)
    }
    if(param.info.parent === 22){
        if(param.stage !== "216" && param.stage !== "223"){
            // スプレー縛り（食神のかまど、ひみつの花園は除外）
            rules.push(24, 26, 27, 28)
        } else {
            // 食神のかまど、ひみつの花園
            rules.push(26, 27, 28)
        }
    }
    if(param.info.series === 3 && param.info.parent !== 35){
        rules.push(34)
    }

    return (
        <>
            #{param.stage}<br/>
            <Link href={"/total/"+param.stage.slice(0,2)}>{t.title[param.stage.slice(0,1)]+" "+t.g.challenge}</Link><br/>
            <Typography variant="h3" sx={{
                fontFamily:['"M PLUS 1 CODE"'].join(","),
            }}>{ t.stage[param.stage] }</Typography>
            <Typography sx={{color:'#999'}}>{r.stage[param.stage]}</Typography>

            <FormControl>
                <FormHelperText sx={{color:"#fff"}}>操作方法</FormHelperText>
                <Select
                    sx={{color:'#fff'}}
                    defaultValue={param.console}
                    id="select-consoles"
                >
                    {
                        // 操作方法プルダウンを出力
                        consoles.map(val =>
                            <MenuItem value={val} component={Link} href={'/stage/'+param.stage+'/'+
                                val+'/'+param.rule+'/'+param.year}>{t.console[val]}</MenuItem>
                        )
                    }
                </Select>
            </FormControl>
            <FormControl>
                <FormHelperText sx={{color:"#fff"}}>集計年</FormHelperText>
                <Select
                    sx={{color:'#fff'}}
                    defaultValue={param.year}
                    id="select-year"
                >
                    {
                        // 集計年プルダウンを出力
                        years.map(val =>
                            <MenuItem value={val} component={Link} href={'/stage/'+param.stage+'/'+
                                param.console+'/'+param.rule+'/'+val}>{val}</MenuItem>
                        )
                    }
                </Select>
            </FormControl>
            <Box sx={{margin:"20px"}}>
                <Grid container>
                    {
                        // ルールを出力
                        rules.map(val =>
                            <Grid item>
                                <Box sx={{
                                        border:"1px solid #fff",
                                        borderRadius:"4px",
                                        padding:"12px",
                                        margin: "6px",
                                        backgroundColor:(Number(param.rule) === val)? "#fff" : "",
                                        color:(Number(param.rule) === val)? "#000" : "",
                                     }}
                                     component={Link}
                                     href={'/stage/'+param.stage+'/'+param.console+'/'+val+'/'+param.year}>
                                    {t.rule[val]}
                                </Box>
                            </Grid>
                        )
                    }
                </Grid>
            </Box>
                {
                    Object.values(param.data).map(post =>
                        <Record data={post} />
                    )
                }
        </>
    )
}
