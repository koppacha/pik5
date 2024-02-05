import {Box, Grid, Typography} from "@mui/material";
import {dateFormat, fetcher, useLocale} from "../../lib/pik5";
import Record from "./Record";
import useSWR from "swr";
import NowLoading from "../NowLoading";
import React from 'react'
import {CompareType, UserType} from "../../styles/pik5.css";
import Score from "./Score";
import Link from "next/link";

export default function RankingUser({posts, posts2, userName, userName2}){

    const {t} = useLocale()

    if(!posts){
        return (
            <NowLoading/>
        )
    }

    return posts.map(function (post, index){

        // 同じインデックス番号の比較対象データを読み込む
        const post2 = Object.values(posts2)[index]

        const date = new Date(post.created_at ?? "2006-09-01 00:00:00")
        const date2 = new Date(post2?.created_at ?? "2006-09-01 00:00:00")


        const Compare = ({side}) => {
            if(post.score > 0 && post2?.score > 0 && post.score !== post2?.score){
                const abs = Math.abs(post.score - post2?.score)
                const mark = (side === "left" && post.score > post2?.score) ? `+${abs}` :
                                    (side === "right" && post.score < post2?.score) ? `+${abs}` : `-${abs}`
                return <CompareType as="span"> ({mark})</CompareType>
            }
            return <></>
        }

        return (
            <React.Fragment key={post.unique_id}>
                <Grid container style={{width:"100%",border:"1px solid #000"}}>
                    <Grid item xs={5} style={{textAlign:"right",padding:"0.5em"}}>
                        <div style={{marginBottom: "1em"}} key={index}>
                            <UserType>{userName}</UserType>
                            <Score rule={post.rule} score={post.score} stage={post.stage_id} category={post?.category}/>
                            <Compare side="left"/><br/>
                            <Typography style={{color: "#ccc", fontSize: "0.8em"}}>{post.post_comment}（
                                <time dateTime={date.toISOString()}>{dateFormat(date)}</time>
                                ）</Typography>
                        </div>
                    </Grid>
                    <Grid item xs={2} style={{
                        textAlign: "center",
                        backgroundColor: "#666",
                        borderLeft: `10px solid ${post.score > post2?.score ? '#80ea92' : '#555'}`,
                        borderRight: `10px solid ${post.score < post2?.score ? '#80ea92' : '#555'}`,
                        padding: "0.5em"
                    }}>
                        <Link href={"/stage/" + post.stage_id}>
                            #{post.stage_id}<br/>
                            {t.stage[post.stage_id]}
                        </Link>
                    </Grid>
                    <Grid item xs={5} style={{padding:"0.5em"}}>
                        <div style={{marginBottom: "1em"}} key={index}>
                            {post2?.score &&
                                <>
                                    <UserType>{userName2}</UserType>
                                    <Score rule={post2?.rule} score={post2?.score} stage={post2?.stage_id} category={post2?.category}/>
                                    <Compare side="right"/><br/>
                                    <Typography style={{color: "#ccc", fontSize: "0.8em"}}>{post2?.post_comment}（
                                    <time dateTime={date2?.toISOString()}>{dateFormat(date2)}</time>
                                    ）</Typography>
                                </>
                            }
                        </div>
                    </Grid>
                </Grid>
            </React.Fragment>
        )
    })
}