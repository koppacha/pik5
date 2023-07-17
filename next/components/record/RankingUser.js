import {Box} from "@mui/material";
import {fetcher, useLocale} from "../../lib/pik5";
import Record from "./Record";
import useSWR from "swr";
import NowLoading from "../NowLoading";
import React from 'react'

export default function RankingUser({userId, console:consoles, rule, year}){

    const { data } = useSWR(`/api/server/record/${userId}/${consoles}/${rule}/${year}`, fetcher)

    if(!data){
        return (
            <NowLoading/>
        )
    }

    return Object.values(data.data).map(function (post){
                return (
                    <React.Fragment key={post.unique_id}>
                        <Record key={post.unique_id} data={post}/>
                    </React.Fragment>
                )
            }
        )
}