// ステージ番号をアクセスされるたびに取得する（サーバーサイド）
import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {Box, Grid, Typography} from "@mui/material";
import Record from "../../components/record/Record";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import Rules from "../../components/rule/Rules";
import RecordPost from "../../components/modal/RecordPost";
import UserScoreTable from "../../components/record/UserScoreTable";
import {useLocale} from "../../lib/pik5";

export async function getServerSideProps(context){

    const query = context.query.name
    const userId = query[0]

    // ユーザーIDに紐づいたユーザー名を取得
    const userNameRes = await fetch(`http://laravel:8000/api/user/name/${userId}`)
    const userName = await userNameRes.json()

    // ユーザー記録を取得
    const res = await fetch(`http://laravel:8000/api/record/${userId}`)
    const data = await res.json()

    const console = query[1] || 0
    const rule  = query[2] || 0
    const year  = query[3] || 2023

    return {
        props: {
            data, userId, userName, console, rule, year
        }
    }
}
// レンダラー本体（フロントサイド）
export default function Stage(param){

    const {t} = useLocale()

    return (
        <>
            {t.stage.user}<br/>
            <Typography variant="" className="title">{ param.userName[0].user_name }</Typography><br/>
            <Typography variant="" className="subtitle">@{param.userId}</Typography>
            <Grid container>
                <Grid item xs={12}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                </Grid>
            </Grid>
            <UserScoreTable/>
            {
                Object.values(param.data).map(post =>
                    <Record data={post} />
                )
            }
        </>
    )
}