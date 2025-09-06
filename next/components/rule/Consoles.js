import {Box, Grid} from "@mui/material";
import Link from "next/link";
import * as React from "react";
import {addName2posts, fetcher, useLocale} from "../../lib/pik5";
import {RuleBox, RuleWrapper} from "../../styles/pik5.css"
import useSWR from "swr";
import NowLoading from "../NowLoading";
import Score from "../record/Score";

export default function Consoles({users, stage, rule, console: consoles, year}){

    const {t} = useLocale()

    const { data: record } = useSWR(`/api/server/record/top/${stage}/${consoles}/${rule}`, fetcher)
    if(!record) return <NowLoading />

    const post = addName2posts(record, users)[0]
    if(!post.score) return <></>

    return (
        <Grid className="console-wrapper" item key={consoles}>
            <Box className={`console-box`}
                     component={Link}
                     href={'/stage/'+stage+'/'+consoles+'/'+rule+'/'+year}>
                {t.cnsl[post.console]}<br/>
                <Score rule={rule} score={post.score} stage={stage} category={"stage"} /><br/>
                {post.user_name}<br/>
            </Box>
        </Grid>
    )
}