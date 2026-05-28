import {AppBar, Box, Button, Container, FormControl, Grid, MenuItem, Select, Typography} from "@mui/material";
import Link from "next/link";
import Record from "../../components/record/Record";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import Totals from "../../components/rule/Totals";
import {createContext, useEffect, useState} from "react";
import Rules from "../../components/rule/Rules";
import {currentYear, fetcher, formattedDate, purgeCache, useLocale} from "../../lib/pik5";
import BreadCrumb from "../../components/BreadCrumb";
import RankingTotal from "../../components/record/RankingTotal";
import Head from "next/head";
import {PageHeader, RuleBox, RuleWrapper, StageListBox, UserInfoBox} from "../../styles/pik5.css";
import {logger} from "../../lib/logger";
import {available} from "../../lib/const";
import StageList from "../../components/record/StageList";
import ModalKeyword from "../../components/modal/ModalKeyword";
import RuleList from "../../components/record/RuleList";
import CategoryList from "../../components/record/CategoryList";
import EventList from "../../components/record/EventList";
import RankingLimited from "../../components/record/RankingLimited";
import {en} from "../../locale/en";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faRotate, faStopwatch} from "@fortawesome/free-solid-svg-icons";
import {useFetchToken} from "../../hooks/useFetchToken";
import useSWR from "swr";
import {faTwitch} from "@fortawesome/free-brands-svg-icons";

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}
export async function getStaticProps({params}){
    const { getCachedUsers } = await import("../../lib/usersCache")

    const query   = params.series
    const series  = query[0]

    if(series === "4"){
        const category = query[1] || "0"
        const isValidCategory = /^\d+$/.test(category) && (Number(category) === 0 || category.length === 3)
        if(!isValidCategory || query[2]){
            return {
                notFound: true,
            }
        }

        try {
            const postsRes = await fetch(`http://laravel:8000/api/event-total/${category}`)
            if(!postsRes.ok){
                return {notFound: true}
            }

            const eventTotal = await postsRes.json()
            const users = await getCachedUsers()

            return {
                props: {
                    eventTotalMode: true,
                    series,
                    category,
                    users,
                    posts: eventTotal.posts ?? [],
                    events: eventTotal.events ?? [],
                },
                revalidate: 3600,
            }
        } catch (error) {
            console.error('Error fetching event total:', error)
            return {notFound: true}
        }
    }

    const consoles = query[1] || 0
    let   rule    = query[2] || series
    const year    = query[3] || currentYear()

    if(
        !available.includes(Number(series)) ||
        !available.includes(Number(rule)) ||
        !available.includes(Number(consoles)) ||
        year < 2014 ||
        year > currentYear() ||
        query[4]
    ){
        return {
            notFound: true,
        }
    }
    try {
        const [stage_res, posts_res, stages_res] = await Promise.all([
            fetch(`http://laravel:8000/api/stage/${series}`),
            fetch(`http://laravel:8000/api/total/${series}/${consoles}/${rule}/${year}`),
            fetch(`http://laravel:8000/api/stages/${series}`)
        ]);

        if (!stage_res.ok || !posts_res.ok || !stages_res.ok) {
            console.error('One or more API requests failed');
            return { notFound: true };
        }

        const [info, posts, stages] = await Promise.all([
            stage_res.json(),
            posts_res.json(),
            stages_res.json()
        ]);

        const users = await getCachedUsers();

        const fDate = formattedDate();
        return {
            props: { stages, series, rule, consoles, year, info, users, fDate, posts },
            revalidate: 604800
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        return { notFound: true };
    }
}

export default function Series(param){

    const {t, r} = useLocale()

    // ルール確認用モーダルの管理用変数
    const [open, setOpen] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    const stages = param.stages

    // 呼び出すレギュレーション本文
    const uniqueId = param.series

    const handleClose = () => setOpen(false)
    const handleOpen = () => setOpen(true)

    // トークンを取得
    const token = useFetchToken()

    // キャッシュを再作成するボタン
    const handlePurgeCache = () => {
        setIsProcessing(true)
        purgeCache("total", param.series, param.consoles, param.rule, param.year, token).then(r => setIsProcessing(false))
    }

    // 外部リンク生成
    let speedrunUrl = "", twitchUrl = ""
    switch (param.series) {
        case '10':
            speedrunUrl = "https://www.speedrun.com/pikmin1";
            twitchUrl = "https://www.twitch.tv/directory/category/pikmin-2001";
            break;
        case '20':
            speedrunUrl = "https://www.speedrun.com/pikmin2";
            twitchUrl = "https://www.twitch.tv/directory/category/pikmin-2-2004";
            break;
        case '30':
            speedrunUrl = "https://www.speedrun.com/pikmin3dx";
            twitchUrl = "https://www.twitch.tv/directory/category/pikmin-3-deluxe";
            break;
        case '40':
            speedrunUrl = "https://www.speedrun.com/pikmin4";
            twitchUrl = "https://www.twitch.tv/directory/category/pikmin-4";
            break;
        default:
            speedrunUrl = "";
            twitchUrl = "";
    }

    const totalCategoryRules = {
        1: [10, 11, 20, 21, 22, 23, 24, 25, 29, 30, 31, 32, 33, 35, 36, 41, 42, 43, 44, 45, 46, 47],
        2: [10, 20, 21, 22, 30, 31, 32, 33, 36, 41, 42, 43],
        3: [11, 23, 24, 25, 29, 35, 44, 45, 46, 47],
    }
    const eventCategoryIds = [0, ...Object.keys(t.limited.category ?? {}).map(Number).sort((a, b) => a - b)]

    if(param.eventTotalMode){
        const categoryId = Number(param.category)
        const categoryTitle = categoryId ? (t.limited.category?.[categoryId] ?? categoryId) : "イベント総合ランキング"
        const categorySubtitle = categoryId ? (en.limited.category?.[categoryId] ?? categoryId) : "All Events"

        return (
            <>
                <Head>
                    <title>{`${categoryTitle} - ${t.title[0]}`}</title>
                </Head>
                <Box className="page-header">
                    <BreadCrumb eventMode={true}/>
                    #4<br/>
                    <Typography variant="" className="title">{categoryTitle}</Typography><br/>
                    <Typography variant="" className="subtitle">{categorySubtitle}</Typography>
                </Box>
                <Totals props={{...param, info: {series: 0}}}/>
                <CategoryList currentEvent={param.category} events={eventCategoryIds} type="event"/>
                {Number(param.category) !== 0 && <EventList events={param.events}/>}
                <Grid container style={{marginBottom:'1em'}}>
                    <Grid className="rule-wrapper" container item xs={12} style={{marginTop: "24px",justifyContent: 'flex-end',alignContent: 'center'}}>
                        <Box className={"rule-box active"}
                             onClick={handleOpen}
                             component={Link}
                             href="#">
                            {t.g.rule}
                        </Box>
                    </Grid>
                </Grid>
                <ModalKeyword open={open} uniqueId={uniqueId} handleClose={handleClose} handleEditOpen={null}/>
                <RankingLimited posts={param.posts} users={param.users} category={param.category}/>
            </>
        )
    }

    return (
        <>
            <Head>
                <title>{t.stage[param.series]+" - "+t.title[0]}</title>
            </Head>
            <Box className="page-header">
                #{param.series}<br/>
                <BreadCrumb info={param.info} rule={param.rule}/>
                <Typography variant="" className="title">{ t.stage[param.series] }</Typography><br/>
                <Typography variant="" className="subtitle">{r.stage[param.series]}</Typography>
            </Box>
            <Grid container style={{marginBottom:"8px"}}>
                <Grid className="user-info-box" item>
                    <span>最終更新：</span>{param.fDate} <Button disabled={isProcessing} style={{color:"var(--color-surface-inverse-text)",padding:"0 4px",minWidth:"0"}} onClick={handlePurgeCache}><FontAwesomeIcon icon={faRotate} /></Button>
                </Grid>
                {speedrunUrl && <Link href={speedrunUrl} target="_blank">
                    <Grid className="user-info-box" item>
                        <FontAwesomeIcon icon={faStopwatch} /> Speedrun.com
                    </Grid>
                </Link>}
                {twitchUrl && <Link href={twitchUrl} target="_blank">
                    <Grid className="user-info-box" item>
                        <FontAwesomeIcon icon={faTwitch} /> Twitch
                    </Grid>
                </Link>}
            </Grid>
            <Totals props={param}/>
            {totalCategoryRules[Number(param.series)] &&
                <CategoryList currentEvent={param.rule} events={totalCategoryRules[Number(param.series)]} type="total"/>
            }
            {
                param.series > 9 &&
                <StageList stages={stages} consoles={param.consoles} rule={param.rule} year={param.year} />
            }
            <Grid container style={{marginBottom:'1em'}}>
                <Grid item xs={6}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                </Grid>
                <Grid className="rule-wrapper" container item xs={6} style={{marginTop: "24px",justifyContent: 'flex-end',alignContent: 'center'}}>
                    <Box className={"rule-box active"}
                             onClick={handleOpen}
                             component={Link}
                             href="#">
                        {t.g.rule}
                    </Box>
                </Grid>
            </Grid>
            <ModalKeyword open={open} uniqueId={uniqueId} handleClose={handleClose} handleEditOpen={null}/>
            <RankingTotal posts={param.posts} users={param.users} series={param.series} console={param.consoles} rule={param.rule} year={param.year} stages={param.stages} isRpsTotalMode={Number(param.series) < 10}/>
        </>
    )
}
