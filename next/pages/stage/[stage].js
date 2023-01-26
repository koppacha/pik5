import {useEffect, useState} from "react";

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
    return (
        <>
            ステージ番号：{ param.stage }<br/>
            <br/>
            <ul>
                {
                    param.data.map(post =>
                        <li key={post.user_id}>{post.user_name}</li>
                    )
                }
            </ul>
        </>
    )
}
