import {Box} from "@mui/material"
import {addName2posts, useLocale} from "../../lib/pik5"
import Record from "./Record"
import NowLoading from "../NowLoading"
import React from 'react'

export default function RankingStandard({parent, posts, borders, stage, console:consoles, rule, year, users}){

    const {t} = useLocale()

    if(!posts){
        return (
            <NowLoading/>
        )
    }

    // 取得したデータにPrismaから取ってきたスクリーンネームを入れる
    const data = addName2posts(posts, users)

    let i = borders.length - 1

    // 参考スコアを表示するルール
    const borderShowRules = [20, 21, 22]

    return data.flatMap(function(post){
        const rows = []
        const star = "★"

        if(borderShowRules.includes(Number(rule))){
            while(i >= 0 && post.score < borders[i]){
                const border = borders[i]
                rows.push(
                    <Box
                        key={`border-standard-${i}`}
                        style={{
                            color:"#e81fc1",
                            borderBottom:"2px dotted #e81fc1",
                            textAlign:"center",
                            margin:"8px 0"
                        }}
                    >
                        {star.repeat(i + 1)} {t.border[2][i]} {border.toLocaleString()} pts.
                    </Box>
                )
                i--
            }
        }

        rows.push(
            <Record key={post.unique_id} data={post} parent={parent}/>
        )

        return rows
    })
}
