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
import {faChevronLeft, faHouseChimney, faSquare, faStairs} from "@fortawesome/free-solid-svg-icons";
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
import Button from "@mui/material/Button";

export async function getServerSideProps(context){

    const limited = 240421

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
    // return {
    //     notFound: true,
    // }
    return {
        props: {
            stages, limited, info, users, teams, total
        }
    }
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
                <Typography variant="span" style={{fontSize:"1.25em"}}>アリーナ戦×チーム対抗制</Typography>
                <br/>
                <Box style={{padding:"2em"}}>
                    <ul>
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

            <Grid container alignItems="flex-start" style={{marginTop:"1em"}}>
                <Grid container alignItems="flex-start" item xs={12} md={6}>
                    <div style={{
                        width: "98%",
                        height: "300px",
                        border: "1px solid #fff",
                        color: "#fff",
                        textAlign: "center",
                        padding: "8px",
                        borderRadius: "4px"
                    }}>
                        秘密兵器実験場（Aボタン縛り）<br/>
                        １位：45,000 pts ごれい 21:20:30<br/>
                        ２位：〜<br/>
                        ３位：〜<br/>
                        <br/>
                        残り 34:21<br/>
                    </div>
                    <CustomButton>ルール詳細</CustomButton>
                    <CustomButton>投稿</CustomButton>
                    <CustomButton>次のステージへ（残４）</CustomButton>
                </Grid>
                <Grid container alignItems="flex-start" item xs={12} md={6}>
                    <div style={{width:"98%",height:"300px",border:"1px solid #fff",color:"#fff",textAlign:"center",padding:"8px",borderRadius:"4px"}}>
                        食神のかまど（笛縛り）
                    </div>
                </Grid>
            </Grid>
            {
                // ステージ別スコア表示コンポーネント
                // param.stages.map(s => <RankingTeam key={s} team={param.teams} stage={s} users={param.users}/>)
            }
            {
                // 各ステージのチームごとのトップスコアを表示する部分
                // 大会が終わったら表示
            }
            {/*<br/>*/}
            {/*<RankingTotal stages={stages} users={param.users} series={param.limited} console={0} rule={0} year={0}/>*/}
        </>
    )
}