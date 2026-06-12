import useSWR from "swr";
import {fetcher, useLocale} from "../../lib/pik5";
import * as React from "react";
import {Typography, Box} from "@mui/material";
import {StairIcon} from "../../styles/pik5.css";
import Link from "next/link";
import SpeedRunWrapper from "../../components/record/SpeedRunWrapper";
import SpeedRunConsole from "../../components/form/SpeedRunConsole";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import Head from "next/head";
import {buildSpeedrunLeaderboardPath, getSpeedrunConsoleIds, speedrunStageSeries} from "../../lib/const";
import RuleList from "../../components/record/RuleList";
import SpecialStages, {SPECIAL_STAGES_RULE} from "../../components/record/SpecialStages";
import StageList from "../../components/record/StageList";
import {useState} from "react";
import {currentYear} from "../../lib/pik5";

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
    const series = speedrunStageSeries(stage)

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
    let specialStages = []
    const stagesRes = await fetch(`http://laravel:8000/api/stages/91?include_special=1&series=${series}`)
    if(stagesRes.ok){
        const stagesPayload = await stagesRes.json()
        specialStages = stagesPayload.specialStages ?? []
    }

    return {
        props: {
            users, data, stage, console, consoles, series, specialStages
        },
        revalidate: 600,
    }
}

export default function Run({data, stage, console, consoles, series, specialStages}){

    const {t, r} = useLocale()
    const [displayedRule, setDisplayedRule] = useState(SPECIAL_STAGES_RULE)
    const stageListKey = displayedRule !== SPECIAL_STAGES_RULE
        ? `/api/server/stages/${displayedRule}`
        : null
    const {data: stageListRes} = useSWR(stageListKey, fetcher)
    const displayedStages = stageListRes?.data ?? []
    const year = currentYear()
    const handleConventionalRuleClick = (event, rule) => {
        event.preventDefault()
        setDisplayedRule(rule)
    }
    const navigationParam = {
        rule: 91,
        consoles: console,
        year,
        info: {
            series,
            parent: 91,
            stage_id: Number(stage),
            type: "speedrun",
        },
    }

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
            <RuleList
                param={navigationParam}
                displayedRule={displayedRule}
                onConventionalRuleClick={handleConventionalRuleClick}
                onAdditionalRuleClick={setDisplayedRule}
            />
            {
                displayedRule === SPECIAL_STAGES_RULE
                    ? <SpecialStages
                        series={series}
                        stages={specialStages}
                        consoles={console}
                        year={year}
                    />
                    : <StageList
                        stages={displayedStages}
                        consoles={console}
                        rule={displayedRule}
                        year={year}
                    />
            }
            <Box sx={{paddingTop: '1em', paddingBottom: '8px'}}>
                <SpeedRunConsole stage={stage} console={console} consoles={consoles}/>
            </Box>
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
