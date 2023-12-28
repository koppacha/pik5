import {Box} from "@mui/material";
import {fetcher, useLocale} from "../../lib/pik5";
import Record from "./Record";
import useSWR from "swr";
import NowLoading from "../NowLoading";
import React from 'react'

export default function RankingUser({posts, userName}){

    if(!posts){
        return (
            <NowLoading/>
        )
    }

    // 取得したデータにPrismaから取ってきたスクリーンネームを入れる
    const data = posts ? Object.values(posts).map(function(post){
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