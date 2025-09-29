import * as React from "react";
import {Box, Button, Grid, List, ListItem, SwipeableDrawer, Typography} from "@mui/material";
import {range, fetcher, useLocale, currentYear, sec2time, dateFormat, purgeCache, formattedDate} from "../../lib/pik5";
import RecordPost from "../../components/modal/RecordPost";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import Rules from "../../components/rule/Rules";
import BreadCrumb from "../../components/BreadCrumb";
import ModalKeyword from "../../components/modal/ModalKeyword";
import {useEffect, useState} from "react";
import {PageHeader, RuleBox, RuleWrapper, StageListBox, UserInfoBox} from "../../styles/pik5.css";
import Link from "next/link";
import RankingStandard from "../../components/record/RankingStandard";
import Head from "next/head";
import {available, hideRuleNames} from "../../lib/const";
import prisma from "../../lib/prisma";
import StageList from "../../components/record/StageList";
import RuleList from "../../components/record/RuleList";
import useSWR from "swr";
import {KeywordContent} from "../../components/modal/KeywordContent";
import NowLoading from "../../components/NowLoading";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {token} from "stylis";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faRotate} from "@fortawesome/free-solid-svg-icons";
import {useFetchToken} from "../../hooks/useFetchToken";
import ConsoleList from "../../components/record/ConsoleList";

export async function getStaticPaths(){
    return {
        paths: [],
        fallback: 'blocking',
    }
}

// サーバーサイドの処理
export async function getStaticProps({params}){

    const query   = params.stage
    const stage   = query[0]
    const consoles = query[1] || 0
    let   rule    = query[2] || 0
    const year    = query[3] || currentYear()

    if(
        stage < 100 ||
        stage > 9999 ||
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

    // 記録をリクエスト
    const res = await fetch(`http://laravel:8000/api/record/${stage}/${consoles}/${rule}/${year}`)
    const posts = await res.json() ?? [].json()
    if(res.status >= 300){
        return {
            notFound: true,
        }
    }
    let info = null, parent = null, stages = [], ruleId = null

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
    } else {
        return {
            notFound: true,
        }
    }
    if(info?.parent && !rule){
        rule = info?.parent
    }
    // 呼び出すレギュレーションは期間限定ならステージ別ルール、通常ランキングならカテゴリ別ルール
    ruleId = (stage > 900) ? stage : (rule) ? rule : 0

    // タマゴあり・タマゴなしの場合はピクミン２の通常ルールの表示を強制する
    if(Number(rule) === 21 || Number(rule) === 22){
        ruleId = 20
    }
    // ルール本文をリクエスト
    const keyword_res = await fetch(`http://laravel:8000/api/keyword/${ruleId}`)
    const keyword = (keyword_res.status < 300) ? await keyword_res.json() : {}

    // 通常・特殊ランキングに該当する場合は攻略情報をリクエスト
    let guide = {}
    if(stage < 901) {
        const guide_res = await fetch(`http://laravel:8000/api/keyword/${stage}`)
        guide = (guide_res.status < 300) ? await guide_res.json() : {}
    }
    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })
    // キャッシュ時間をリクエスト
    const fDate = formattedDate()
    return {
        props: {
            stages, stage, rule, consoles, year, info, users, parent, posts, ruleId, keyword, fDate, guide
        },
        revalidate: 86400,
    }
}
export default function Stage(param){

    const {t, r, locale} = useLocale()

    // ルール確認用モーダルの管理用変数
    const [open, setOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)

    // ボタンフラグ
    const [isProcessing, setIsProcessing] = useState(false)

    const handleClose = () => setOpen(false)

    const handleEditOpen = () => {
        setOpen(false)
        setEditOpen(true)
    }
    const [keywordId, setKeywordId] = useState(null)
    const handleOpen = (id) => {
        setKeywordId(id)
        setOpen(true)
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

    // キーワードにルールがあればそれを表示する（本編地下は表示しない）
    function RuleInfo() {
        if (param.keyword) {
            if(param.rule !== 25){
                return (
                    <ReactMarkdown className="markdown-content" remarkPlugins={[remarkGfm]}>
                        {param.keyword?.content}
                    </ReactMarkdown>
                )
            } else {
                return (
                    <ReactMarkdown className="markdown-content" remarkPlugins={[remarkGfm]}>
                        本編地下は本編の洞窟へ入る瞬間から脱出する瞬間までのお宝回収価値とタイムを競う擬似チャレンジモードです。
                        初期ピクミンはその洞窟へ入る時点で仲間にしているピクミンであれば自由に編成できます（グリッチを使って仲間にしたピクミンを除く）。
                        適用できるお宝探査キットには制限があります。詳しくは「ルールを確認」ボタンを押して詳細を確認してください。
                        スコアは「お宝価値×10＋脱出時ピクミン数×10＋（制限時間 - 残り時間）÷２の切り捨て」です。
                    </ReactMarkdown>
                )
            }
        } else {
            return <></>
        }
    }
    // ルールタイトルを表示しないルールを定義
    const ruleName = hideRuleNames.includes(Number(param.rule))
        || Number(param.rule) > 100
        ? <></>
        : Number(param.rule) !== 47
        ? <Link href={"/total/"+param.rule} className="mini-title"><span>（{t.rule?.[param.rule]}）</span></Link>

        // 「夜の探索」の場合はエリア名を表示
        : <span className="mini-title">（{t.nightAreas?.[param.stage]}）</span>

    // 制限時間を計算する（ピクミン２チャレンジモードのみ２倍）
    const countdown = (Number(param.rule === 21) || Number(param.rule === 22))
        ? param.info?.time * 2
        : param.info?.time

    // トークンを取得
    const token = useFetchToken()

    // キャッシュを再作成するボタン
    const handlePurgeCache = () => {
        setIsProcessing(true)
        purgeCache("stage", param.stage, param.consoles, param.rule, param.year, token).then(r => setIsProcessing(false))
    }
    return (
        <>
            <Head>
                <title>{stageName+" ("+t.title[param.info?.series]+") - "+t.title[0]}</title>
            </Head>
            <Box className="page-header">
                <BreadCrumb info={param.info} rule={param.rule}/>
                <Typography variant="" className="subtitle">#{param.stage}</Typography><br/>
                <Typography variant="" className="title">{stageName}</Typography>{ruleName}<br/>
                <Typography variant="" className="subtitle">{stageNameR}</Typography><br/><br/>
                <Typography variant="" className="subtitle"><RuleInfo/></Typography><br/>
            </Box>
            <Grid className="rule-wrapper" container item xs={12}>
                {countdown > 0 &&
                    <Grid className="user-info-box" item>
                        <span>{t.g.time}：</span>{sec2time(countdown)}
                    </Grid>
                }
                {param.info?.pikmin > 0 &&
                    <Grid className="user-info-box" item>
                        <span>{t.g.pikmin}：</span>{param.info?.pikmin}
                    </Grid>
                }
                {param.info?.treasure > 0 &&
                    <Grid className="user-info-box" item>
                        <span>{t.g.value}：</span>{param.info?.treasure}
                    </Grid>
                }
                <Grid className="user-info-box" item>
                    <span>{t.g.lastUpdate}：</span>{param.fDate} <Button disabled={isProcessing} style={{color:"#fff",padding:"0 4px",minWidth:"0"}} onClick={handlePurgeCache}><FontAwesomeIcon icon={faRotate} /></Button>
                </Grid>
            </Grid>
            <RuleList param={param}/>
            <StageList parent={param.parent.stage_id} currentStage={param.stage} stages={param.stages} consoles={param.consoles} rule={param.rule} year={param.year} />
            <ConsoleList param={param}/>
            <Grid container style={{marginBottom:'1em'}}>
                <Grid item xs={6} style={{paddingLeft:'0.5em'}}>
                    <PullDownConsole props={param}/>
                    <PullDownYear props={param}/>
                </Grid>
                <Grid container item xs={6} style={{marginTop: "24px",justifyContent: 'flex-end',alignContent: 'center'}}>
                    {
                        // イベント対象ステージの場合はイベント期間内なら投稿ボタンを表示、イベント対象外の場合は常に投稿ボタンを表示する
                        (isEvent(param.parent)) &&
                            <RecordPost
                                style={{alignItems: "center"}}
                                info={param.info} rule={param.rule} console={param.consoles}/>
                    }
                    <Box className={"rule-box active"}
                         onClick={() => handleOpen(param.ruleId)}
                         component={Link}
                         href="#">
                        <span>{t.g.rule}</span>
                    </Box>
                    {param.guide && (
                      <Box className={"rule-box active"}
                           onClick={() => handleOpen(param.stage)}
                           component={Link}
                           href="#">
                        <span>{t.g.guide}</span>
                      </Box>
                    )}
                </Grid>
            </Grid>
            <RankingStandard parent={param.parent} posts={param.posts} users={param.users} borders={borders} stage={param.stage} console={param.consoles} rule={param.rule} year={param.year}/>
            <ModalKeyword open={open} uniqueId={keywordId} users={param.users} handleClose={handleClose} handleEditOpen={handleEditOpen}/>
        </>
    )
}
