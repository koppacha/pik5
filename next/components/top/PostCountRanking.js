import useSWR from "swr";
import {fetcher, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import * as React from "react";
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {CellBox} from "../../styles/pik5.css";

export default function PostCountRanking({users}){

    const {t} = useLocale()

    const {data:counter} = useSWR(`http://localhost:8000/api/count`, fetcher)

    if(!counter){
        return (
            <NowLoading/>
        )
    }

    const data = counter ? counter.map(function(post){
        const user = users.find(user => user.userId === post.user_id)
        return {
            ...post,
            user_name: user ? user.name : ""
        }
    }) : []

    return (
        <>
            <Grid container>
            {
                data.map(function(post, i){

                    return (
                        <Grid item key={i} xs={2} component={Link} href={"/user/"+post.user_id}>
                            <CellBox>
                                {t.g.rankHead}{i+1} {t.g.rankTail}<br/>
                                {post.user_name}<br/>
                                {post.cnt} {t.g.countTail}
                            </CellBox>
                        </Grid>
                    )
                })
            }
            </Grid>
        </>
    )
}