import useSWR from "swr";
import {fetcher} from "../lib/pik5";
import NowLoading from "./NowLoading";
import Record from "./Record";
import * as React from "react";

export default function NewRecords(){

    const {data:newRecords} = useSWR(`http://localhost:8000/api/new`, fetcher)

    if(!newRecords){
        return (
            <NowLoading/>
        )
    }

    return (
        <>
            {
                newRecords.map(function(post){
                    return (
                        <Record data={post}/>
                    )
                })
            }
        </>
    )
}