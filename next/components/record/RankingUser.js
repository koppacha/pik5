import {Box} from "@mui/material";
import {fetcher, useLocale} from "../../lib/pik5";
import Record from "./Record";
import useSWR from "swr";
import NowLoading from "../NowLoading";
import React from 'react'

export default function RankingUser({userId, console:consoles, rule, year, userName}){

    const { data:posts } = useSWR(`/api/server/record/${userId}/${consoles}/${rule}/${year}`, fetcher)
    if(!posts){
        return (
            <NowLoading/>
        )
    }

    // 取得したデータにPrismaから取ってきたスクリーンネームを入れる
    const data = posts.data ? Object.values(posts.data).map(function(post){
        return {
            ...post,
            user_name: userName
        }
    }) : []

    return data.map(function (post){
                return (
                    <React.Fragment key={post.unique_id}>
                        <Record key={post.unique_id} data={post}/>
                    </React.Fragment>
                )
            }
        )
}