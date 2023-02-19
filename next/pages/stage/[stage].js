import {useEffect, useState} from "react";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import { useRouter } from "next/router";
import Record from "../../components/Record";
import {Typography} from "@mui/material";

// ステージ番号をアクセスされるたびに取得する（サーバーサイド）
export async function getServerSideProps(context){
    const stage = context.query.stage
    const res = await fetch(`http://laravel:8000/api/record/${stage}`)
    const data = await res.json()
    return {
        props: {
            data, stage
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
            <br/>
                {
                    param.data.map(post =>
                        <Record data={post} />
                    )
                }
        </>
    )
}
