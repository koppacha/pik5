import {
    AppBar,
    Box,
    Container,
    FormControl,
    Grid, LinearProgress,
    List, ListItem,
    MenuItem,
    Select,
    Typography,
    useMediaQuery
} from "@mui/material";
import Link from "next/link";
import Record from "../../components/record/Record";
import PullDownConsole from "../../components/form/PullDownConsole";
import PullDownYear from "../../components/form/PullDownYear";
import * as React from "react";
import Totals from "../../components/rule/Totals";
import {createContext, useState} from "react";
import Rules from "../../components/rule/Rules";
import {useLocale, id2name, fetcher, addName2posts} from "../../lib/pik5";
import BreadCrumb from "../../components/BreadCrumb";
import RankingTotal from "../../components/record/RankingTotal";
import Head from "next/head";
import {
    CustomButton,
    PageHeader,
    RuleBox,
    RuleWrapper,
    StageListBox,
    StairIcon,
    TeamScoreType
} from "../../styles/pik5.css";
import {logger} from "../../lib/logger";
import {available} from "../../lib/const";
import prisma from "../../lib/prisma";
import StageList from "../../components/record/StageList";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronLeft, faHouseChimney, faSquare, faStairs, faXmark} from "@fortawesome/free-solid-svg-icons";
import ModalKeyword from "../../components/modal/ModalKeyword";
import RankingTeam from "../../components/record/RankingTeam";
import {useTheme} from "next-themes";
import CountDownTimer from "../../components/CountDownTimer";
import {hydrate} from "react-dom";
import PostButton from "../../components/PostButton";
import {useSession} from "next-auth/react";
import NowLoading from "../../components/NowLoading";
import LimitedTotal from "../../components/LimitedTotal";
import {notFound} from "next/navigation";
import Button from "@mui/material/Button";
import useSWR from "swr";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import RecordPost from "../../components/modal/RecordPost";
import CardGrid from "../../components/limited/CardGrid";

export async function getServerSideProps(context){

    const limited = 221008

    // 閉鎖中
    return {
        notFound: true
    }

    // イベント情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/${limited}`)
    const info = (stage_res.status < 300) ? await stage_res.json() : []

    // 総合ランキング情報をリクエスト
    const total_res = await fetch(`http://laravel:8000/api/total/${limited}`)
    const total = (total_res.status < 300) ? await total_res.json() : []

    // アリーナの状態管理DBをリクエスト
    const arena_res = await fetch(`http://laravel:8000/api/arena`)
    const arena = (arena_res.status < 300) ? await arena_res.json() : null

    // アリーナの状況を整理
    let flagCount = {}
    arena.forEach(record => {
        if(flagCount[record.flag]){
            flagCount[record.flag]++
        } else {
            flagCount[record.flag] = 1
        }
    })

    let stages = []
    // シリーズ番号に基づくステージ群の配列をリクエスト
    const res = await fetch(`http://laravel:8000/api/stages/${limited}`)
    if(res.status < 300) {
        stages = await res.json()
    }

    // 投票データベースから各ユーザーのチーム情報をリクエスト
    const team_res = await fetch(`http://laravel:8000/api/vote/20${limited}`)
    const team = (team_res.status < 300) ? await team_res.json() : []

    // チーム情報を整形する
    const teams = team.reduce((acc, obj) => {
        const key = obj.select?.toString();
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(obj?.user);
        return acc;
    }, {});

    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })
    return {
        props: {
            stages, limited, info, users, teams, total, arena, flagCount
        }
    }
}

export default function Limited(param){

    const {t, r} = useLocale()
    const {data: session } = useSession()
    const stages = param.stages

    // 左チームは１、右チームは２
    const currentTeam =
        param.teams[21]?.includes(session?.user.id) ? 1 :
        param.teams[22]?.includes(session?.user.id) ? 2 : 0

    // ルール確認用モーダルの管理用変数
    const [open, setOpen] = useState(false)

    // 呼び出すレギュレーション本文
    let uniqueId = param.limited

    // アリーナ情報を取得する
    const {data:arenaData, error: arenaError} = useSWR(`/api/server/arena`, fetcher)

    // アリーナ情報から各チームの現在ステージ情報を取得
    const stage = [
        Object.values(arenaData?.data ?? {}).find(p => p.flag === 1),
        Object.values(arenaData?.data ?? {}).find(p => p.flag === 1)
    ]
    // ステージ情報から左チームが着手中のランキングとステージ情報を取得
    const {data:recordLeftData, error: recordLeftError} = useSWR(`/api/server/record/1049`, fetcher)
    const {data:infoLeftData, error: infoLeftError} = useSWR(`/api/server/stage/1049`, fetcher)

    // ステージ情報から右チームが着手中のランキングとステージ情報を取得
    const {data:recordRightData, error: recordRightError} = useSWR(`/api/server/record/1050`, fetcher)
    const {data:infoRightData, error: infoRightError} = useSWR(`/api/server/stage/1050`, fetcher)

    // useSWRをすべてリクエストしたらそれぞれでローディング判定
    if (
        !arenaData || arenaError ||
        !recordLeftData || recordLeftError ||
        !recordRightData || recordRightError ||
        !infoLeftData || infoLeftError ||
        !infoRightData || infoRightError
    ) {
        return <NowLoading />
    }


    // 取得したデータを加工
    const left = addName2posts(recordLeftData.data, param.users)
    const right = addName2posts(recordRightData.data, param.users)

    // 次へ・スタートボタン
    async function arenaSubmit() {
        const confirm = window.confirm(t.g.confirm)
        if (confirm) {
            const res = await fetch(`/api/server/arena/update/${currentTeam}`)
            console.log(res.status)
        }
    }

    const handleClose = () => setOpen(false)
    const handleOpen = () => setOpen(true)

    const cards = [
        { id: "1301", title: "コンクリート迷路", subtitle: "タマゴなし", premium: true, level: 3, user:4, topScore:20345, inventor:"koppacha", description: "これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレ" },
        { id: "1302", title: "土とんの洞窟", subtitle: "140秒", level: 3, user:4, topScore:20345, inventor:"koppacha", description: "これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。。" },
        { id: "1303", title: "巨人のトイレ", subtitle: "１セット縛り", level: 2, user:4, topScore:20345, inventor:"koppacha", description: "これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。。" },
        { id: "1304", title: "切磋琢磨のオアシス", subtitle: "交代禁止", level: 4, user:4, topScore:20345, inventor:"koppacha", description: "これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。。" },
        { id: "1305", title: "戦場のおもちゃ箱", subtitle: "オッチン禁止", level: 1, user:4, topScore:20345, inventor:"koppacha", description: "これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。。" },
        { id: "1306", title: "大水源", subtitle: "半日縛り", level: 5, user:4, topScore:20345, inventor:"koppacha", description: "これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。これは期間限定チャレンジの説明文です。。" },
    ];

    return (
        <>
            <Head>
                <title>第19回期間限定ランキング - ピクチャレ大会</title>
            </Head>
            <PageHeader>
                #{param.limited}<br/>
                <Link href="/"><FontAwesomeIcon icon={faHouseChimney}/></Link>
                <StairIcon icon={faStairs}/>
                期間限定ランキング<br/>
                <Typography variant="" className="title">第19回期間限定ランキング</Typography><br/>
                <Typography variant="" className="subtitle">The 19th Special Limited Ranking</Typography><br/>
                <br/>
                <Typography variant="span" style={{fontSize: "1.25em"}}>
                    アリーナ制<FontAwesomeIcon style={{padding: "0 0.5em"}} icon={faXmark}/>スタンダード
                </Typography>
                <br/>
                <Box style={{padding: "2em"}}>
                    <ul>
                        <li>今大会の縛りルール採用倍率：5.75倍（エクストラ枠除く）</li>
                    </ul>
                    <br/>
                    <ul>
                        <li>参加ボタン押下後、反映されない場合は少し待ってから再読み込みしてください。</li>
                    </ul>
                </Box>
            </PageHeader>
            {/*<StageList stages={stages} />*/}
            <RuleWrapper container item xs={12}
                         style={{marginTop: "24px", justifyContent: 'flex-end', alignContent: 'center'}}>
                <RuleBox className={"active"}
                         onClick={handleOpen}
                         component={Link}
                         href="#">
                    {t.g.rule}
                </RuleBox>
            </RuleWrapper>
            <ModalKeyword open={open} uniqueId={uniqueId} handleClose={handleClose} handleEditOpen={null}/>
            {
                // チーム別総合点を計算して表示する部分（合計ランクポイント、参加者、参加者別ランクポイント、投稿済みステージ数）
                //
                currentTeam ? "あなたの所属チームは " + t.limited.team[currentTeam] + " です。" :
                    <>
                        <PostButton voteId={20231216}/>
                    </>
            }

            <Box style={{
                fontSize: "3.5em",
                color: "#fff",
                textAlign: "center",
                padding: "8px",
                borderRadius: "4px",
                margin: "1em 0",
                background: "#444",
                border: "1px solid #fff"
            }}>
                <CountDownTimer startTime="2025-02-08T19:00:00" endTime="2025-02-15T23:00:00" />
            </Box>
            <CardGrid cards={cards} users={param.users}/>

            {
                // ステージ別スコア表示コンポーネント
                // param.stages.map(s => <RankingTeam key={s} team={param.teams} stage={s} users={param.users}/>)
            }
            {
                // 各ステージのチームごとのトップスコアを表示する部分
                // 大会が終わったら表示
            }
            {/*<br/>*/}
            <RankingTotal posts={param.total} stages={stages} users={param.users} series={param.limited} console={0} rule={0} year={0}/>
        </>
    )
}