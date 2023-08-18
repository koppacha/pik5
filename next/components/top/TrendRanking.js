import useSWR from "swr";
import {fetcher, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import Record from "../record/Record";
import * as React from "react";
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {CellBox} from "../../styles/pik5.css";

export default function TrendRanking(){

    const {t} = useLocale()
    const {data:trends} = useSWR(`api/server/trend`, fetcher)

    if(!trends){
        return (
            <NowLoading/>
        )
    }
    return (
        <>
            <Grid container>
            {
                trends.data.map(function(post, i){

                    return (
                        <Grid item key={i} xs={4} sm={2} component={Link} href={"/stage/"+post.stage_id}>
                            <CellBox length={t.stage[post.stage_id].length}>
                                {t.g.rankHead}{i+1} {t.g.rankTail}<br/>
                                {t.stage[post.stage_id].length > 9 ? t.stage[post.stage_id].substring(0, 8)+".." : t.stage[post.stage_id]}<br/>
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