// ステージ番号をアクセスされるたびに取得する（サーバーサイド）
import {useRouter} from "next/router";
import {en} from "../../locale/en";
import {ja} from "../../locale/ja";
import {Typography} from "@mui/material";
import Record from "../../components/Record";

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
            <Typography variant="h3" sx={{
                fontFamily:['"M PLUS 1 CODE"'].join(","),
            }}>{ param.userName[0].user_name }</Typography>
            <Typography sx={{color:'#999'}}>@{param.user_id}</Typography>
            <br/>
            {
                param.data.map(post =>
                    <Record data={post} />
                )
            }
        </>
    )
}