import {Box} from "@mui/material"
import {addName2posts, useLocale} from "../../lib/pik5"
import {basePoints, stageCounts} from "../../lib/const"
import NowLoading from "../NowLoading"
import Record from "./Record"
import * as React from "react"

export default function RankingTotal({posts, series, console:consoles, rule, year, users, stages, isRpsTotalMode = false}){
    const {t} = useLocale()

    if(!posts){
        return <NowLoading/>
    }

    // 取得したデータにPrismaから取ってきたスクリーンネームを入れる
    const data = addName2posts(posts, users)

    const showClassBorders = Number(series) === 1
    const stageCount = stageCounts[Number(year)] ?? Object.values(stageCounts)[0]
    const classBorders = Array.from({length: 14}, (_, idx) => {
        const cls = idx + 1
        return {
            cls,
            point: stageCount * basePoints[cls]
        }
    }).sort((a, b) => b.point - a.point)

    let borderIndex = 0

    return data.flatMap(function(post, index) {
        const rows = []

        if(showClassBorders){
            const score = Number(post?.score ?? 0)
            const star = "★"
            while(borderIndex < classBorders.length && score < classBorders[borderIndex].point){
                const border = classBorders[borderIndex]
                rows.push(
                    <Box
                        key={`border-class-${border.cls}`}
                        style={{
                            color:"#e81fc1",
                            borderBottom:"2px dotted #e81fc1",
                            textAlign:"center",
                            margin:"8px 0"
                        }}
                    >
                        {star.repeat(Math.ceil((15 - borderIndex) / 3))} {t.classes[border.cls]} / {border.point.toLocaleString()} rps.
                    </Box>
                )
                borderIndex++
            }
        }

        rows.push(
            <Record
                key={post.user_id}
                prevUser={data[index-1]?.user_id}
                data={post}
                stages={stages}
                series={series}
                consoles={consoles}
                year={year}
                swapScoreRpsLabel={isRpsTotalMode}
            />
        )

        return rows
    })
}
