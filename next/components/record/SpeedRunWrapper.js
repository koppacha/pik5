import useSWR from "swr"
import {fetcher, useLocale} from "../../lib/pik5"
import NowLoading from "../NowLoading"
import Record from "./Record"
import * as React from "react"
import {getSpeedrunUserCache, setSpeedrunUserCache} from "../../lib/speedrunUserCache"

const SPEEDRUN_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export default function SpeedRunWrapper({post, rank, index}){

    const {t} = useLocale()
    const userId = post?.run?.players?.[0]?.id || null
    const [isClient, setIsClient] = React.useState(false)
    const [cachedUser, setCachedUser] = React.useState(null)

    React.useEffect(() => {
        setIsClient(true)
    }, [])

    React.useEffect(() => {
        if (!isClient) return
        setCachedUser(getSpeedrunUserCache(userId))
    }, [isClient, userId])

    const {data: userNameResponse} = useSWR(
        userId && isClient && !cachedUser ? `speedrun:user:${userId}` : null,
        () => fetcher(`https://www.speedrun.com/api/v1/users/${userId}`),
        {
            dedupingInterval: SPEEDRUN_CACHE_TTL_MS,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            revalidateIfStale: false,
            onSuccess: (data) => {
                setSpeedrunUserCache(userId, data)
                setCachedUser(data)
            },
        }
    )

    if (userId && !cachedUser && !userNameResponse) {
        return (
            <NowLoading/>
        )
    }

    const userNameData = cachedUser || userNameResponse
    const name = userNameData?.data?.names?.japanese
        || userNameData?.data?.names?.international
        || null

    // 証拠動画の有無をチェックして、存在するならURLを取得
    const video = post.run.videos?.links?.length > 0 ? post.run.videos.links[0].uri : null

    // 操作方法を取得する。取得用配列はNGC, Wii, Wii U, Switch, Switch 2
    const consoles = ["4p9z06rn", "v06dk3e4", "8gejn93d" , "7m6ylw9p", "3167lw9q", null, null, null, null, null, null, "v06dr394"]
    const cnsl = String(consoles.indexOf(post.run.system.platform) + 1)

    const data = {
        category: "speedrun",
        post_rank: rank || (index + 1) || null,
        video_url: video,
        post_comment: post.run.comment || t.g.noComment,
        user_id: userId,
        user_name: name,
        score: post.run.times.realtime_t || 0,
        console: cnsl,
        created_at: post.run.submitted || "2023-06-10 23:00:00",
    }
    return (
        <Record data={data}/>
    )
}
