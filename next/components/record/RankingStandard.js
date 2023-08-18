import {Box} from "@mui/material";
import {fetcher, useLocale} from "../../lib/pik5";
import Record from "./Record";
import useSWR from "swr";
import NowLoading from "../NowLoading";
import React from 'react'

export default function RankingStandard({borders, stage, console:consoles, rule, year, users}){

    const {t} = useLocale()
    const { data:posts } = useSWR(`/api/server/record/${stage}/${consoles}/${rule}/${year}`, fetcher, { refreshInterval: 5000 })

    if(!posts){
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

    let i = borders.length - 1

    // 参考スコアを表示するルール
    const borderShowRules = [20, 21, 22]

    return data.map(function (post){
                    const border = borders[i]
                    const star = "★"
                    if(post.score < border && borderShowRules.includes(Number(rule))){
                        i--;
                        return (
                            <React.Fragment key={post.unique_id}>
                                <Box style={{
                                    color:"#e81fc1",
                                    borderBottom:"2px dotted #e81fc1",
                                    textAlign:"center",
                                    margin:"8px 0"
                                }}>
                                    {star.repeat(i + 2)} {t.border[2][i + 1]} {border.toLocaleString()} pts.
                                </Box>
                                <Record data={post}/>
                            </React.Fragment>
                        )
                    } else {
                        return (
                            <React.Fragment key={post.unique_id}>
                                <Record key={post.unique_id} data={post}/>
                            </React.Fragment>
                        )
                    }
                }
            )
}