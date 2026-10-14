import useSWR from "swr"
import {fetcher} from "../../lib/pik5"
import NowLoading from "../NowLoading"
import {Typography} from "@mui/material"
import React from "react"

export default function GetRank({stage, rule, score, eventId}){
    const {data} = useSWR(eventId ? `/api/server/tricks/rank/${stage}/${score}?event_id=${eventId}` : `/api/server/record/rank/${stage}/${rule}/${score}`, fetcher)
    if(!data) {
        return (
            <NowLoading/>
        )
    }
    return (
        <Typography>暫定順位：{data.data} 位</Typography>
    )
}