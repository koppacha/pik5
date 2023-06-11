import useSWR from "swr";
import {fetcher} from "../plugin/pik5";
import NowLoading from "./NowLoading";
import Record from "./Record";
import * as React from "react";

export default function SpeedRunWrapper({post}){

    let video, name

    // ユーザー名を非同期リクエスト
    const {data:user_name} = useSWR(`https://www.speedrun.com/api/v1/users/${post.run.players[0].id}`, fetcher)
    if(!user_name){
        return (
            <NowLoading/>
        )
    } else {
        name = user_name.data.names.japanese || user_name.data.names.international
    }

    // 証拠動画の有無をチェックして、存在するならURLを取得
    if(post.run.videos?.links?.length > 0){
        video = post.run.videos.links[0].uri
    } else {
        video = null
    }
    const data = {
        post_rank: post.place || null,
        video_url: video,
        post_comment: post.run.comment || "コメントなし",
        user: {
            user_id: post.run.players[0].id || null,
            user_name: name || null,
        },
        score: post.run.times.realtime_t || 0,
        console: (post.run.system.platform === "v06dk3e4") ? 2 : 1,
        created_at: post.run.submitted || "2023-06-10 23:00:00",
    }
    return (
        <Record data={data}/>
    )
}