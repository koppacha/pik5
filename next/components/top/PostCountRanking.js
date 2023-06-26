import useSWR from "swr";
import {fetcher, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import Record from "../record/Record";
import * as React from "react";
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {CellBox} from "../../styles/pik5.css";

export default function PostCountRanking(){

    const {t} = useLocale()

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
                                {t.g.rankHead}{i+1} {t.g.rankTail}<br/>
                                {post.user.user_name}<br/>
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