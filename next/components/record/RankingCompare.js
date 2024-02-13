import {Box, Grid, Typography} from "@mui/material";
import {dateFormat, fetcher, useLocale} from "../../lib/pik5";
import Record from "./Record";
import useSWR from "swr";
import NowLoading from "../NowLoading";
import React, {useEffect, useState} from 'react'
import {CompareType, UserType} from "../../styles/pik5.css";
import Score from "./Score";
import Link from "next/link";
import {rule2array} from "../../lib/const";

export default function RankingCompare({rule, posts1, posts2, userName, userName2}){

    const {t} = useLocale()
    const rules = rule2array(rule)

    // サーバーサイドとのレンダリング不一致対策
    const [isClient, setIsClient] = useState(false)
    useEffect(() => setIsClient(true), [])

    return rules?.map(function (stageId, index){

        // 同じインデックス番号の比較対象データを読み込む
        const post1 = Object.values(posts1).find(i => i.stage_id === stageId)
        const post2 = Object.values(posts2).find(i => i.stage_id === stageId)
        const date1 = new Date(post1?.created_at ?? "2006-09-01 00:00:00")
        const date2 = new Date(post2?.created_at ?? "2006-09-01 00:00:00")

        const Compare = ({side}) => {
            if(post1?.score > 0 && post2?.score > 0 && post1?.score !== post2?.score){
                const abs = Math.abs(post1?.score - post2?.score)
                const mark = (side === "left" && post1?.score > post2?.score) ? `+${abs}` :
                                    (side === "right" && post1?.score < post2?.score) ? `+${abs}` : `-${abs}`
                return <CompareType as="span"> ({mark})</CompareType>
            }
            return <></>
        }

        return (
            <React.Fragment key={stageId}>
                <Grid container style={{width:"100%",border:"1px solid #000"}}>
                    <Grid item xs={5} style={{textAlign:"right",padding:"0.5em"}}>
                        <div style={{marginBottom: "1em"}} key={index}>
                            {post1?.score &&
                                <>
                                    <Typography className="user-type">{userName}</Typography>
                                    <Score rule={post1?.rule} score={post1?.score} stage={post1?.stage_id} category={post1?.category}/>
                                    <Compare side="left"/><br/>
                                    <Typography style={{color: "#ccc", fontSize: "0.8em"}}>{post1?.post_comment}（
                                        <time dateTime={date1.toISOString()}>{isClient ? dateFormat(date1) : ''}</time>
                                        ）</Typography>
                                </>
                            }
                        </div>
                    </Grid>
                    <Grid item xs={2} style={{
                        textAlign: "center",
                        justifyContent: "center",
                        backgroundColor: "#666",
                        borderLeft: `10px solid ${(post1?.score ?? 0) > (post2?.score ?? 0) ? '#e31ca9' : '#555'}`,
                        borderRight: `10px solid ${(post1?.score ?? 0) < (post2?.score ?? 0) ? '#1ce356' : '#555'}`,
                        padding: "0.5em"
                    }}>
                        <Link href={"/stage/" + stageId}>
                            #{stageId}<br/>
                            {t.stage[stageId]}
                        </Link>
                    </Grid>
                    <Grid item xs={5} style={{padding:"0.5em"}}>
                        <div style={{marginBottom: "1em"}} key={index}>
                            {post2?.score &&
                                <>
                                    <Typography className="user-type">{userName2}</Typography>
                                    <Score rule={post2?.rule} score={post2?.score} stage={post2?.stage_id} category={post2?.category}/>
                                    <Compare side="right"/><br/>
                                    <Typography style={{color: "#ccc", fontSize: "0.8em"}}>{post2?.post_comment}（
                                    <time dateTime={date2?.toISOString()}>{isClient ? dateFormat(date2) : ''}</time>
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