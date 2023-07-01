import useSWR from "swr";
import {fetcher} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import Record from "./Record";
import * as React from "react";

export default function RankingTotal({series, console:consoles, rule, year}){

    const {data} = useSWR(`http://localhost:8000/api/total/${series}/${consoles}/${rule}/${year}`, fetcher)
    if(!data){
        return (
            <NowLoading/>
        )
    }

    return Object.values(data.data).map(post =>
        <Record key={post.post_id} data={post} />
    )
}