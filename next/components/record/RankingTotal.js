import useSWR from "swr";
import {fetcher} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import Record from "./Record";
import * as React from "react";

export default function RankingTotal({series, console:consoles, rule, year, users}){

    const {data:posts} = useSWR(`/api/server/total/${series}/${consoles}/${rule}/${year}`, fetcher)
    if(!posts?.data){
        return (
            <NowLoading/>
        )
    }
    // 取得したデータにPrismaから取ってきたスクリーンネームを入れる TODO: あとで共通化
    const data = posts.data ? Object.values(posts.data).map(function(post){
        const user = users.find(user => user.userId === post.user_id)
        return {
            ...post,
            user_name: user ? user.name : ""
        }
    }) : []

    return data.map(post =>
        <Record key={post.user_id} data={post} />
    )
}