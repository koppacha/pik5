import * as React from "react";
import {Box, Button, Grid, List, ListItem, SwipeableDrawer, Typography} from "@mui/material";
import {fetcher, useLocale} from "../../lib/pik5";
import RecordPost from "../../components/modal/RecordPost";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import Rules from "../../components/rule/Rules";
import BreadCrumb from "../../components/BreadCrumb";
import ModalKeyword from "../../components/modal/ModalKeyword";
import {useState} from "react";
import {PageHeader, RuleBox, RuleWrapper, StageListBox} from "../../styles/pik5.css";
import Link from "next/link";
import RankingStandard from "../../components/record/RankingStandard";
import Head from "next/head";
import {available} from "../../lib/const";
import prisma from "../../lib/prisma";
import StageList from "../../components/record/StageList";
import RuleList from "../../components/record/RuleList";
import useSWR from "swr";
import {KeywordContent} from "../../components/modal/KeywordContent";
import NowLoading from "../../components/NowLoading";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// サーバーサイドの処理
export async function getServerSideProps(context){

    const query   = context.query.stage
    const stage   = query[0]
    const consoles = query[1] || 0
    let   rule    = query[2] || 0
    const year    = query[3] || 2023

    if(
        stage < 100 ||
        stage > 9999 ||
        !available.includes(Number(rule)) ||
        !available.includes(Number(consoles)) ||
        year < 2014 ||
        year > 2023 ||
        query[4]
    ){
        return {
            notFound: true,
        }
    }

    let info = null, parent = null, stages = []
    // ステージ情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/${stage}`)
    if(stage_res.status < 300) {
        info = await stage_res.json()

        if(info.parent) {
            const parent_res = await fetch(`http://laravel:8000/api/stage/${info.parent}`)
            if (parent_res.status < 300) {
                parent = await parent_res.json()
            }
            // シリーズ番号に基づくステージ群の配列をリクエスト
            const reqStage = rule || info.parent
            const res = await fetch(`http://laravel:8000/api/stages/${reqStage}`)
            if(res.status < 300) {
                stages = await res.json()
            }
        }
    }
    if(info?.parent && !rule){
        rule = info?.parent
    }

    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })

    return {
        props: {
            stages, stage, rule, consoles, year, info, users, parent
        }
    }
}
export default function Stage(param){

    const {t, r, locale} = useLocale()

    // ルール確認用モーダルの管理用変数
    const [open, setOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)

    const handleClose = () => setOpen(false)

    const handleEditOpen = () => {
        setOpen(false)
        setEditOpen(true)
    }
    const handleOpen = () => setOpen(true)

    // 呼び出すレギュレーションは期間限定ならステージ別ルール、通常ランキングならカテゴリ別ルール
    let uniqueId = (param.stage > 900) ? param.stage : param.rule

    // タマゴあり・タマゴなしの場合はピクミン２の通常ルールの表示を強制する
    if(Number(param.rule) === 21 || Number(param.rule) === 22){
        uniqueId = 20
    }

    function isEvent(info){
        const currentTime = new Date()
        const start = new Date(info?.start)
        const end = new Date(info?.end)

        // 期間が定義されていない場合はイベントではないと判断する
        if(info?.start === undefined) return true

        return currentTime >= start && currentTime <= end
    }

    // ボーダーライン出力用変数
    const borders = [param.info?.border1, param.info?.border2, param.info?.border3, param.info?.border4]

    // 表示するタイトルを定義
    const stageName = locale === "ja" ? param.info?.stage_name : param.info?.eng_stage_name
    const stageNameR= locale === "ja" ? param.info?.eng_stage_name : param.info?.stage_name

    // キーワードにルールがあればそれを表示する
    function RuleInfo(){
        const {data: keywordData, isValidating} = useSWR(`/api/server/keyword/${uniqueId}`, fetcher)

        if(isValidating){
            return <NowLoading/>
        }
        if(keywordData) {
            return (
                <ReactMarkdown className="markdown-content" remarkPlugins={[remarkGfm]}>
                    {keywordData.data?.content}
                </ReactMarkdown>
            )
        } else {
            return <></>
        }
    }
    // ルールタイトルを表示しないルールを定義
    const ruleName = [10, 20, 21, 22, 25, 29, 30, 35, 40, 33, 36, 41, 42, 43, 91].includes(Number(param.rule))
        || Number(param.rule) > 100
        ? <></>
        : <Link href={"/total/"+param.rule} className="mini-title">（{t.rule?.[param.rule]}）</Link>

    return (
        <>
            <Head>
                <title>{stageName+" ("+t.title[param.info?.series]+") - "+t.title[0]}</title>
            </Head>
            <PageHeader>
                #{param.stage}<br/>
                <BreadCrumb info={param.info} rule={param.rule}/>
                <Typography variant="" className="title">{stageName}</Typography>{ruleName}<br/>
                <Typography variant="" className="subtitle">{stageNameR}</Typography><br/><br/>
                <Typography variant="" className="subtitle"><RuleInfo/></Typography><br/>
            </PageHeader>
            <RuleList param={param}/>
            <StageList currentStage={param.stage} stages={param.stages} consoles={param.consoles} rule={param.rule} year={param.year} />
            <Grid container style={{marginBottom:'1em'}}>
                <Grid item xs={6}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                </Grid>
                <RuleWrapper container item xs={6} style={{marginTop: "24px",justifyContent: 'flex-end',alignContent: 'center'}}>
                    {
                        // イベント対象ステージの場合はイベント期間内なら投稿ボタンを表示、イベント対象外の場合は常に投稿ボタンを表示する
                        (isEvent(param.parent)) &&
                            <RecordPost
                                style={{alignItems: "center"}}
                                info={param.info} rule={param.rule} console={param.consoles}/>
                    }
                    <RuleBox className={"active"}
                             onClick={handleOpen}
                             component={Link}
                             href="#">
                        {t.g.rule}
                    </RuleBox>
                </RuleWrapper>
            </Grid>
            <RankingStandard users={param.users} borders={borders} stage={param.stage} console={param.consoles} rule={param.rule} year={param.year}/>
            <ModalKeyword open={open} uniqueId={uniqueId} handleClose={handleClose} handleEditOpen={handleEditOpen}/>
        </>
    )
}
