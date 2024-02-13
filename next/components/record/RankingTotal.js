import useSWR from "swr";
import {fetcher} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import Record from "./Record";
import * as React from "react";

export default function RankingTotal({series, console:consoles, rule, year, users, stages}){

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

    return data.map(function(post, index) {
        return <Record key={post.user_id} prevUser={data[index-1]?.user_id} data={post} stages={stages} series={series} consoles={consoles} year={year}/>
    })
}