import useSWR from "swr";
import {fetcher, useLocale} from "../plugin/pik5";
import NowLoading from "./NowLoading";
import Record from "./Record";
import * as React from "react";
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {CellBox} from "../styles/pik5.css";

export default function TrendRanking(){

    const {data:trends} = useSWR(`http://localhost:8000/api/trend`, fetcher)

    if(!trends){
        return (
            <NowLoading/>
        )
    }

    const {t} = useLocale()

    return (
        <>
            <Grid container>
            {
                trends.map(function(post, i){

                    return (
                        <Grid item xs={2} component={Link} href={"/stage/"+post.stage_id}>
                            <CellBox>
                                {i+1} 位<br/>
                                {t.stage[post.stage_id]}<br/>
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