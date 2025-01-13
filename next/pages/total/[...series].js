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
import prisma from "../../lib/prisma";
import StageList from "../../components/record/StageList";
import ModalKeyword from "../../components/modal/ModalKeyword";
import RuleList from "../../components/record/RuleList";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faRotate} from "@fortawesome/free-solid-svg-icons";
import {useFetchToken} from "../../hooks/useFetchToken";
import useSWR from "swr";

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}
export async function getStaticProps({params}){

    const query   = params.series
    const series  = query[0]
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

        const users = await prisma.user.findMany({
            select: { userId: true, name: true }
        });

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
                    <span>最終更新：</span>{param.fDate} <Button disabled={isProcessing} style={{color:"#fff",padding:"0 4px",minWidth:"0"}} onClick={handlePurgeCache}><FontAwesomeIcon icon={faRotate} /></Button>
                </Grid>
            </Grid>
            <Totals props={param}/>
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
            <RankingTotal posts={param.posts} users={param.users} series={param.series} console={param.consoles} rule={param.rule} year={param.year} stages={param.stages}/>
        </>
    )
}