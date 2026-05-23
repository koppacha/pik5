import Record from "../../components/record/Record";
import useSWR from "swr";
import NowLoading from "../../components/NowLoading";
import {fetcher, useLocale} from "../../lib/pik5";
import BreadCrumb from "../../components/BreadCrumb";
import * as React from "react";
import {FormControl, FormHelperText, Grid, MenuItem, Typography} from "@mui/material";
import {RuleBox, StairIcon, StyledSelect} from "../../styles/pik5.css";
import Link from "next/link";
import SpeedRunWrapper from "../../components/record/SpeedRunWrapper";
import SpeedRunRules from "../../components/form/SpeedRunRules";
import SpeedRunConsole from "../../components/form/SpeedRunConsole";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import Head from "next/head";
import {buildSpeedrunLeaderboardPath, getSpeedrunConsoleIds} from "../../lib/const";

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}
export async function getStaticProps({params}){
    const { getCachedUsers } = await import("../../lib/usersCache")

    const query = params.run
    const stage = query[0]
    const console = query[1] || 0

    const q = buildSpeedrunLeaderboardPath(stage, console)
    const consoles = getSpeedrunConsoleIds(stage)

    if (!q) {
        return {
            notFound: true,
        }
    }
    // ステージ情報をリクエスト
    const res = await fetch(`https://www.speedrun.com/api/v1/leaderboards/${q}`)
    const data = await res.json()

    if(!data){
        return {
            notFound: true,
        }
    }

    // スクリーンネームをリクエスト（検索用）
    const users = await getCachedUsers()

    return {
        props: {
            users, data, stage, console, consoles
        },
        revalidate: 600,
    }
}

export default function Run({data, stage, console, consoles}){

    const {t, r} = useLocale()

    const dates = data.data?.runs
    const displayRuns = (dates || []).reduce((acc, post) => {

        // ピクミン4のNG+はスキップする
        if(post?.run?.values?.dloe59en === "q650zkjl") return acc

        const score = Number(post?.run?.times?.realtime_t || 0)
        const prev = acc[acc.length - 1]
        const rank = prev && prev.score === score ? prev.rank : acc.length + 1

        acc.push({post, score, rank})
        return acc
    }, [])

    return (
        <>
            <Head>
                <title>{t.speedrun[stage]+" - "+t.title[0]}</title>
            </Head>
            <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
            <StairIcon icon={faStairs}/>
            <Link href="https://www.speedrun.com/pikmin">{t.speedrun.title}</Link>
            <StairIcon icon={faStairs}/>
            {t.title[stage.slice(0,2) === "31"?31:stage.slice(0,1)]}<br/>
            #S{stage}<br/>
            <Typography variant="" className="title">{ t.speedrun[stage] }</Typography><br/>
            <Typography variant="" className="subtitle">{r.speedrun[stage]}</Typography><br/>
            <SpeedRunConsole stage={stage} console={console} consoles={consoles}/>
            <Grid item style={{
                marginTop:"20px",marginBottom:"20px"
            }}>
                <SpeedRunRules stage={stage} console={console}/>
            </Grid>
            {displayRuns.map(({post, rank}) => (
                <SpeedRunWrapper
                    key={post?.run?.id || `${post?.run?.submitted || "run"}-${rank}`}
                    post={post}
                    rank={rank}
                />
            ))}
        </>
    )
}
