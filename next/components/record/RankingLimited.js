import {Box} from "@mui/material"
import {addName2posts} from "../../lib/pik5"
import NowLoading from "../NowLoading"
import Record from "./Record"
import * as React from "react"

// Display names for historical participants without a registered user profile.
const historicalParticipantNames = {
    nitrosmish: "NitrosB",
    yukimidaifuku: "ゆきみだいふく",
    Rinkuru0912: "ドモホルンリンクル",
}

export default function RankingLimited({posts, users, category}){
    if(!posts){
        return <NowLoading/>
    }

    const data = addName2posts(posts, users)
    if(!data.length){
        return <Box style={{textAlign:"center", margin:"24px 0"}}>No records.</Box>
    }

    return data.map(function(post, index) {
        const view = {
            ...post,
            user_name: post.user_name || (Object.prototype.hasOwnProperty.call(historicalParticipantNames, post.user_id) && historicalParticipantNames[post.user_id]) || post.user_id,
            // Event dates are in JST; keep server and browser parsing consistent.
            created_at: post.created_at?.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, "$1T$2+09:00"),
        }
        let scoreUnit = "stamps"
        let rankPointUnit = "rps"

        if(Number(category) === 151){
            view.score = post.rps_adjust
            view.rps = post.score
            scoreUnit = "rps"
            rankPointUnit = "pts"
        } else if([161, 191, 211, 241, 261].includes(Number(category))){
            view.score = post.score
            scoreUnit = "pts"
        } else {
            view.score = post.stamp
        }

        return (
            <Record
                key={post.user_id}
                prevUser={data[index-1]?.user_id}
                data={view}
                stages={[]}
                series={4}
                consoles={0}
                year={0}
                scoreUnit={scoreUnit}
                rankPointUnit={rankPointUnit}
                hideRankProgress={true}
                stampItems={post.events}
            />
        )
    })
}
