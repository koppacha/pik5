import useSWR from "swr";
import {fetcher} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import Record from "../record/Record";
import * as React from "react";

export default function NewRecords({users}){

    const {data:newRecords} = useSWR(`/api/server/new`, fetcher)

    if(!newRecords){
        return (
            <NowLoading/>
        )
    }

    const data = newRecords ? newRecords.map(function(post){
        const user = users.find(user => user.userId === post.user_id)
        return {
            ...post,
            user_name: user ? user.name : ""
        }
    }) : []

    return (
        <>
            {
                data.map(function(post, index){
                    return (
                        <Record key={index} data={post}/>
                    )
                })
            }
        </>
    )
}