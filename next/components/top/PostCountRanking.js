import useSWR from "swr";
import {fetcher, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import * as React from "react";
import {Box, Grid} from "@mui/material";
import Link from "next/link";
import {CellBox} from "../../styles/pik5.css";

export default function PostCountRanking({users}){

    const {t} = useLocale()

    const {data:counter} = useSWR(`/api/server/count`, fetcher)

    if(!counter){
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

    const data = counter ? counter.data.map(function(post){
        const user = users.find(user => user.userId === post.user_id)
        return {
            ...post,
            user_name: user ? user.name : ""
        }
    }) : []

    function nameOmission(str) {
        // マルチバイトかどうか判定
        if(str.match(/[^\x01-\x7E\xA1-\xDF]+/)){
            // マルチバイトの場合
            if(str.length > 9) {
                return str.substring(0, 8) + ".."
            } else {
                return str
            }
        // 英数字の場合
        } else {
            if(str.length > 24) {
                return str.substring(0, 23) + ".."
            } else {
                return str
            }
        }
    }

    return (
        <>
            <Grid container>
            {
                data.map(function(post, i){

                    return (
                        <Grid item key={i} xs={4} sm={3} md={2} component={Link} href={"/user/"+post.user_id}>
                            <CellBox className="cell-box" length={post.user_name.length}>
                                <span className="cell-box-caption">{t.g.rankHead}{i+1} {t.g.rankTail}</span><br/>
                                {nameOmission(post.user_name)}<br/>
                                <span className="cell-box-caption">{post.cnt} {t.g.countTail}</span>
                            </CellBox>
                        </Grid>
                    )
                })
            }
            </Grid>
        </>
    )
}