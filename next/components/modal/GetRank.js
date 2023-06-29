import useSWR from "swr";
import {fetcher} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import {Typography} from "@mui/material";
import React from "react";

export default function GetRank({stage, rule, score}){
    const {data} = useSWR(`http://localhost:8000/api/record/rank/${stage}/${rule}/${score}`, fetcher)
    if(!data) {
        return (
            <NowLoading/>
        )
    }
    return (
        <Typography>暫定順位：{data} 位</Typography>
    )
}