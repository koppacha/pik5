import {useEffect, useState} from "react";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import { useRouter } from "next/router";
import Record from "../../components/Record";
import {FormControl, MenuItem, NativeSelect, Select, Typography} from "@mui/material";

// ステージ番号をアクセスされるたびに取得する（サーバーサイド）
export async function getServerSideProps(context){
    const query = context.query.stage
    const stage = query[0]
    const rule  = query[1] ? String(query[1]).substring(0, 2) : 10
    const console = query[1] ? String(query[1]).substring(2, 1) : 0
    const year  = query[2] || 0
    const res = await fetch(`http://laravel:8000/api/record/${stage}`)
    const data = await res.json()
    return {
        props: {
            data, stage, rule, console, year
        }
    }
}

// レンダラー本体（フロントサイド）
export default function Stage(param){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

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
                >
                    <MenuItem value={10}>{t.rule[10]}</MenuItem>
                    <MenuItem value={11}>{t.rule[11]}</MenuItem>
                    <MenuItem value={12}>{t.rule[12]}</MenuItem>
                    <MenuItem value={13}>{t.rule[13]}</MenuItem>
                    <MenuItem value={14}>{t.rule[14]}</MenuItem>
                </Select>
            </FormControl>

            操作方法
            <FormControl>
                <Select
                    sx={{color:'#fff'}}
                    defaultValue={param.console}
                >
                    <MenuItem value={0}>{t.console[0]}</MenuItem>
                    <MenuItem value={1}>{t.console[1]}</MenuItem>
                    <MenuItem value={2}>{t.console[2]}</MenuItem>
                    <MenuItem value={3}>{t.console[3]}</MenuItem>
                    <MenuItem value={4}>{t.console[4]}</MenuItem>
                </Select>
            </FormControl>
            集計年
            <FormControl>
                <Select
                    sx={{color:'#fff'}}
                    defaultValue={2023}
                >
                    <MenuItem value={2023}>2023</MenuItem>
                    <MenuItem value={2022}>2022</MenuItem>
                    <MenuItem value={2021}>2021</MenuItem>
                    <MenuItem value={2020}>2020</MenuItem>
                    <MenuItem value={2019}>2019</MenuItem>
                </Select>
            </FormControl>
            <br/>
                {
                    param.data.map(post =>
                        <Record data={post} />
                    )
                }
        </>
    )
}
