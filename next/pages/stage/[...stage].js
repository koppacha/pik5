import * as React from "react";
import {Box, Button, Grid, List, ListItem, SwipeableDrawer, Typography} from "@mui/material";
import {useLocale} from "../../lib/pik5";
import RecordPost from "../../components/modal/RecordPost";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import Rules from "../../components/rule/Rules";
import BreadCrumb from "../../components/BreadCrumb";
import ModalKeyword from "../../components/modal/ModalKeyword";
import {useState} from "react";
import {PageHeader, RuleBox} from "../../styles/pik5.css";
import Link from "next/link";
import RankingStandard from "../../components/record/RankingStandard";
import Head from "next/head";
import MobileMenu from "../../components/menu/MobileMenu";
import {available} from "../../lib/const";

// サーバーサイドの処理
export async function getServerSideProps(context){

    const query   = context.query.stage
    const stage   = query[0]
    const console = query[1] || 0
    let   rule    = query[2] || 0
    const year    = query[3] || 2023

    if(
        stage < 100 ||
        stage > 999 ||
        !available.includes(Number(rule)) ||
        !available.includes(Number(console)) ||
        year < 2014 ||
        year > 2023 ||
        query[4]
    ){
        return {
            notFound: true,
        }
    }

    // ステージ情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/${stage}`)
    const info = await stage_res.json()

    if(!info){
        return {
            notFound: true,
        }
    }

    if(info.parent && !rule){
        rule = info.parent
    }

    return {
        props: {
            stage, rule, console, year, info
        }
    }
}
export default function Stage(param){

    const {t, r} = useLocale()

    // ボーダーライン出力用変数
    const borders = [param.info.border1, param.info.border2, param.info.border3, param.info.border4]

    // ルール確認用モーダルの管理用変数
    const [open, setOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)

    // 呼び出すレギュレーション本文
    let uniqueId = param.rule

    // タマゴあり・タマゴなしの場合はピクミン２の通常ルールを表示する
    if(param.rule === 21 || param.rule === 22){
        uniqueId = 20
    }
    const handleClose = () => setOpen(false)

    const handleEditOpen = () => {
        setOpen(false)
        setEditOpen(true)
    }
    const handleOpen = () => setOpen(true)

    return (
        <>
            <Head>
                <title>{`${t.stage[param.stage]} (${t.title[param.info.series]}) - ${t.title[0]}`}</title>
            </Head>
            <PageHeader>
                #{param.stage}<br/>
                <BreadCrumb info={param.info} rule={param.rule}/>
                <Typography variant="" className="title">{ t.stage[param.stage] }</Typography><br/>
                <Typography variant="" className="subtitle">{r.stage[param.stage]}</Typography>
            </PageHeader>
            <Grid container>
                <Grid item xs={12}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                </Grid>
            </Grid>
            <Box style={{margin:"20px 0"}}>
                <Grid container style={{
                    marginTop:"30px"
                }}>
                    <Rules props={param}/>
                    <RecordPost
                        info={param.info} rule={param.rule} console={param.console}/>
                    <Grid item style={{
                        marginBottom:"20px",
                    }}>
                        <RuleBox className={"active"}
                                 onClick={handleOpen}
                                 component={Link}
                                 href="#">
                            {t.g.rule}
                        </RuleBox>
                    </Grid>
                </Grid>
            </Box>
            <ModalKeyword open={open} uniqueId={uniqueId} handleClose={handleClose} handleEditOpen={handleEditOpen}/>
            <RankingStandard data={param.data} borders={borders} stage={param.stage} console={param.console} rule={param.rule} year={param.year}/>
        </>
    )
}
