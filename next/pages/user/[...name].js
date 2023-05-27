// ステージ番号をアクセスされるたびに取得する（サーバーサイド）
import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {Grid, Typography} from "@mui/material";
import Record from "../../components/Record";
import PullDownConsole from "../../components/PullDownConsole";
import PullDownYear from "../../components/PullDownYear";
import * as React from "react";

export async function getServerSideProps(context){
    // ユーザー名を取得
    const user_id = context.query.name
    const userNameRes = await fetch(`http://laravel:8000/api/user/name/${user_id}`)
    const userName = await userNameRes.json()

    // ユーザー別記録を取得
    const res = await fetch(`http://laravel:8000/api/record/${user_id}`)
    const data = await res.json()
    return {
        props: {
            data, user_id, userName
        }
    }
}

// レンダラー本体（フロントサイド）
export default function Stage(param){

    const { locale } = useRouter();
    const t = (locale === "en") ? en : ja;

    return (
        <>
            ユーザー別ランキング<br/>
            <Typography variant="">{ param.userName[0].user_name }</Typography>
            <Typography sx={{color:'#999'}}>@{param.user_id}</Typography>
            <Grid container>
                <Grid item xs={12}>
                    <PullDownConsole
                        console={param.console}
                        user={param.user_id}
                        rule={param.rule}
                        year={param.year}/>

                    <PullDownYear
                        console={param.console}
                        user={param.user_id}
                        rule={param.rule}
                        year={param.year}/>
                </Grid>
            </Grid>
            {
                Object.values(param.data).map(post =>
                    <Record data={post} />
                )
            }
        </>
    )
}