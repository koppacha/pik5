import useSWR from "swr";
import {fetcher} from "../plugin/pik5";
import NowLoading from "./NowLoading";
import Record from "./Record";
import * as React from "react";
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {CellBox} from "../styles/pik5.css";

export default function PostCountRanking(){

    const {data:counter} = useSWR(`http://localhost:8000/api/count`, fetcher)

    if(!counter){
        return (
            <NowLoading/>
        )
    }

    return (
        <>
            <Grid container>
            {
                counter.map(function(post, i){

                    return (
                        <Grid item xs={2} component={Link} href={"/user/"+post.user.user_id}>
                            <CellBox>
                                {i+1} 位<br/>
                                {post.user.user_name}<br/>
                                {post.cnt} 回
                            </CellBox>
                        </Grid>
                    )
                })
            }
            </Grid>
        </>
    )
}