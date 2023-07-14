import useSWR from "swr";
import {fetcher} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import Record from "./Record";
import * as React from "react";

export default function RankingTotal({series, console:consoles, rule, year}){

    const {data} = useSWR(`/api/server/total/${series}/${consoles}/${rule}/${year}`, fetcher)
    if(!data?.data?.data){
        return (
            <NowLoading/>
        )
    }
    return Object.values(data.data.data).map(post =>
        <Record key={post.user.user_id} data={post} />
    )
}