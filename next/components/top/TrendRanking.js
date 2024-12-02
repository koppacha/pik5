import useSWR from "swr";
import {fetcher, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import Record from "../record/Record";
import * as React from "react";
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {CellBox} from "../../styles/pik5.css";
import {faFire} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

export default function TrendRanking(){

    const {t} = useLocale()
    const {data:trends} = useSWR(`api/server/trend`, fetcher)

    const repeatElement = (element, count) => {

        // トレンドランキングの炎の数を定義（最低１、最大13）
        let fireCount = Math.floor(count / 4) || 1
        if(fireCount > 13) fireCount = 13

        return Array.from({ length: fireCount }, (_, index) => (
            <React.Fragment key={index}>
                {element}
            </React.Fragment>
        ))
    }

    if(!trends){
        return (
            <Grid container>
                {Array.from({ length: 12 }).map((_, index) => (
                    <Grid item xs={4} sm={3} md={2} key={index}>
                        <CellBox>
                            {index === 0 && <NowLoading />}
                        </CellBox>
                    </Grid>
                ))}
            </Grid>
        )
    }
    return (
        <>
            <Grid container>
            {
                trends?.data?.map(function(post, i){

                    return (
                        <Grid item key={i} xs={4} sm={3} md={2} component={Link} href={"/stage/"+post.stage_id}>
                            <CellBox length={t.stage[post.stage_id].length}>
                                <span className="cell-box-caption">{post.month}</span><br/>
                                {t.stage[post.stage_id].length > 10 ? t.stage[post.stage_id].substring(0, 9)+".." : t.stage[post.stage_id]}<br/>
                                <span className="cell-box-caption">{repeatElement(<FontAwesomeIcon icon={faFire} style={{color:(post.cnt > 52) ? "#e77d7d": "inherit"}} />, post.cnt)}</span>
                            </CellBox>
                        </Grid>
                    )
                })
            }
            </Grid>
        </>
    )
}