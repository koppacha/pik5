import {
    AppBar,
    Box,
    Container,
    FormControl,
    Grid,
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
import {useLocale, id2name} from "../../lib/pik5";
import BreadCrumb from "../../components/BreadCrumb";
import RankingTotal from "../../components/record/RankingTotal";
import Head from "next/head";
import {PageHeader, RuleBox, RuleWrapper, StageListBox, StairIcon, TeamScoreType} from "../../styles/pik5.css";
import {logger} from "../../lib/logger";
import {available} from "../../lib/const";
import prisma from "../../lib/prisma";
import StageList from "../../components/record/StageList";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHouseChimney, faStairs} from "@fortawesome/free-solid-svg-icons";
import ModalKeyword from "../../components/modal/ModalKeyword";
import RankingTeam from "../../components/record/RankingTeam";
import {useTheme} from "next-themes";
import CountDown from "../../components/CountDown";
import {hydrate} from "react-dom";
import PostButton from "../../components/PostButton";
import {useSession} from "next-auth/react";
import NowLoading from "../../components/NowLoading";
import LimitedTotal from "../../components/LimitedTotal";
import {notFound} from "next/navigation";

export async function getServerSideProps(context){

    const limited = 240324

    // イベント情報をリクエスト
    const stage_res = await fetch(`http://laravel:8000/api/stage/${limited}`)
    const info = (stage_res.status < 300) ? await stage_res.json() : []

    // 総合ランキング情報をリクエスト
    const total_res = await fetch(`http://laravel:8000/api/total/${limited}`)
    const total = (total_res.status < 300) ? await total_res.json() : []

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
        notFound: true,
    }
    // return {
    //     props: {
    //         stages, limited, info, users, teams, total
    //     }
    // }
}

export default function Limited(param){

    const {t, r} = useLocale()
    const {data: session } = useSession()
    const stages = param.stages

    const currentTeam =
        param.teams[21]?.includes(session?.user.id) ? 21 :
        param.teams[22]?.includes(session?.user.id) ? 22 : 0

    // ルール確認用モーダルの管理用変数
    const [open, setOpen] = useState(false)

    // 呼び出すレギュレーション本文
    let uniqueId = param.limited

    function CountdownDisplay() {
        const now = new Date();
        const start = new Date("2023/12/12 19:00:00");
        const end = new Date("2023/12/12 23:00:00");

        if (now < start) {
            return (
                <>
                    <span>開始まで残り： </span>
                    <CountDown endTime={start} />
                </>
            );
        }

        if (now < end) {
            return (
                <>
                    <span>終了まで残り： </span>
                    <CountDown endTime={end} />
                </>
            );
        }

        return <></>;
    }

    const handleClose = () => setOpen(false)
    const handleOpen = () => setOpen(true)

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
                <Typography variant="" className="subtitle">The 19th Special Limited Tournament</Typography><br/>
                <br/>
                <Typography variant="span" style={{fontSize:"1.25em"}}>チーム対抗戦×新ピンポイント制</Typography>
                <br/>
                <Box style={{padding:"2em"}}>
                    <ul>
                        <li>期間限定ランキングは、期間中に特殊なルールのステージのランキングを競い合うイベントです。今回の開催期間は <strong>12/16 19:00〜24:00</strong> となります。</li>
                        <li>開催１時間前からチーム振り分けを受け付けます。途中参加も可能ですが、終了間際の場合は下記参加条件を満たせることをご確認ください。</li>
                        <li>開催期間中に１ステージ以上の投稿ができることが参加条件になります。</li>
                        <li>チーム対抗戦では、参加者が２チームに分かれて競います。最終的にチーム別合計ランクポイントの多い方が優勝チームとなります。</li>
                        <li>各ステージの投稿には(大会参加者数 - 順位 + 1)のランクポイントが付与されます。（大会参加者数＝１ステージ以上投稿しているプレイヤーの人数）</li>
                        <li>各参加者は原則最大４ステージまで選択して投稿できます。選択したステージには時間内であれば何度でも投稿できます。（５ステージ以上投稿することもできますが、ランクポイントにマイナス補正がかかります）</li>
                        <li>投稿数差によるチーム間格差を是正するために投稿数が３未満のプレイヤーのランクポイントには補正がかけられます。</li>
                        <li>大会最優秀賞（MVP）はランクポイントが最も多いプレイヤーに贈られます。同点が複数名いる場合はすべてのプレイヤーに贈られます。</li>
                        <li>原則として１位は証拠動画が必要ですが、大会終了後の提出でも構いません。</li>
                        <li>今大会の縛りルール採用倍率：5.75倍（エクストラ枠除く）</li>
                    </ul><br/>
                    <ul>
                        <li>参加ボタン押下後、反映されない場合は少し待ってから再読み込みしてください。</li>
                    </ul>
                </Box>
            </PageHeader>
            {/*<StageList stages={stages} />*/}
            <RuleWrapper container item xs={12} style={{marginTop: "24px",justifyContent: 'flex-end',alignContent: 'center'}}>
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
                currentTeam ? "あなたの所属チームは "+t.limited.team[currentTeam]+" です。" :
                    <>
                        <PostButton voteId={20231216}/>
                    </>
            }
            {/*<CountdownDisplay suppressHydrationWarning/>*/}
            <LimitedTotal/>
            {
                // ステージ別スコア表示コンポーネント
                param.stages.map(s => <RankingTeam key={s} team={param.teams} stage={s} users={param.users}/>)
            }
            {
                // 各ステージのチームごとのトップスコアを表示する部分
            }
            <br/>
            <RankingTotal stages={stages} users={param.users} series={param.limited} console={0} rule={0} year={0}/>
        </>
    )
}