import {useEffect, useState} from "react";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import { useRouter } from "next/router";
import Record from "../../components/Record";
import {FormControl, MenuItem, Select, Typography} from "@mui/material";
import Link from "next/link";

// ステージ番号をアクセスされるたびに取得する（サーバーサイド）
export async function getServerSideProps(context){
    const query = context.query.stage
    const stage = query[0]
    const rule  = query[2] || 10
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

// レンダラー本体（フロントサイド）
export default function Stage(param){

    const { locale } = useRouter()
    const t = (locale === "en") ? en : ja
    const rules = [10, 11, 12, 13, 14, 15, 16, 17]
    const consoles = [0, 1, 2, 3, 4]
    const years = [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014]
    const datas = param.data

    return (
        <>
            #{param.stage}<br/>
            {t.title[param.stage.slice(0,1)]+" "+t.g.challenge}<br/>
            <Typography variant="h3" sx={{
                fontFamily:['"M PLUS 1 CODE"'].join(","),
            }}>{ t.stage[param.stage] }</Typography>
            <Typography sx={{color:'#999'}}>{en.stage[param.stage]}</Typography>
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
                            <MenuItem value={val}><Link href={'/stage/'+param.stage+'/'+
                                param.console+'/'+val+'/'+param.year}>{t.rule[val]}</Link></MenuItem>
                        )
                    }
                </Select>
            </FormControl>

            操作方法
            <FormControl>
                <Select
                    sx={{color:'#fff'}}
                    defaultValue={param.console}
                    id="select-consoles"
                >
                    {
                        // 操作方法プルダウンを出力
                        consoles.map(val =>
                            <MenuItem value={val}><Link href={'/stage/'+param.stage+'/'+
                                val+'/'+param.rule+'/'+param.year}>{t.console[val]}</Link></MenuItem>
                        )
                    }
                </Select>
            </FormControl>
            集計年
            <FormControl>
                <Select
                    sx={{color:'#fff'}}
                    defaultValue={2023}
                    id="select-year"
                >
                    {
                        // 集計年プルダウンを出力
                        years.map(val =>
                            <MenuItem value={val}><Link href={'/stage/'+param.stage+'/'+
                                param.console+'/'+param.rule+'/'+val}>{val}</Link></MenuItem>
                        )
                    }
                </Select>
            </FormControl>
            <br/>
                {
                    datas.map(post =>
                        <Record data={post} />
                    )
                }
        </>
    )
}
