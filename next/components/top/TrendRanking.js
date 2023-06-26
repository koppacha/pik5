import useSWR from "swr";
import {fetcher, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import Record from "../record/Record";
import * as React from "react";
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {CellBox} from "../../styles/pik5.css";

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
                                {t.g.rankHead}{i+1} {t.g.rankTail}<br/>
                                {t.stage[post.stage_id]}<br/>
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