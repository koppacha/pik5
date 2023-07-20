import Link from "next/link";
import {Grid, Typography} from "@mui/material";
import React from "react";
import {CellBox, InfoBox, TopBox, TopBoxContent, TopBoxHeader, WrapTopBox} from "../styles/pik5.css";
import {useLocale} from "../lib/pik5";
import {
    faArrowTrendUp,
    faCertificate,
    faChartColumn, faCheckToSlot, faCircleInfo,
    faFlag,
    faTrophy
} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import NewRecords from "../components/top/NewRecords";
import PostCountRanking from "../components/top/PostCountRanking";
import TrendRanking from "../components/top/TrendRanking";
import { useSession, signIn, signOut } from "next-auth/react"
import prisma from "../lib/prisma"

export async function getServerSideProps(context) {
    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany()
    return {
        props: {
            users
        }
    }
}

export default function Home({users}) {

    const {t,r} = useLocale()
    const {data: session } = useSession()

    // クイックアクセス
    const quickLinks = [
        ["ログイン", "/auth/login"],
        ["アカウント作成", "/auth/register"],
        ["ピクミン1", "/total/10"],
        ["ピクミン2", "/total/20"],
        ["ピクミン3", "/total/30"],
        ["ピクミン4", "/total/40"],
        ["キーワード", "/keyword"],
        // ["本編RTA", "/speedrun"],
        // ["期間限定", "/limited"],
        ["全総合", "/total/1"],
        ["通常総合", "/total/2"],
        ["特殊総合", "/total/3"],
        ["利用規約", "/keyword/rules"],
        ["Discord", "https://discord.gg/rQEBJQa"]
    ]

  return (
    <>
        ver.3.00<br/>
        <Typography variant="" className="title">{t.title[0]}</Typography><br/>
        <Typography variant="" className="subtitle">{r.title[0]}</Typography><br/>
        <InfoBox>
            ピクチャレ大会へようこそ。このサイトは、任天堂のゲームソフト『ピクミン』シリーズをやり込む人のためのハイスコアを競い合うランキングサイトです。
            腕前関係なくどなたでも参加することができます。
        </InfoBox>
        <Grid container>
            <WrapTopBox item xs={12}>
                <Grid container>
                    {
                        quickLinks.map(i =>
                            (
                                <Grid item key={i} xs={2} component={Link} href={i[1]}>
                                    <CellBox style={{padding:"10px 0"}}>
                                        {i[0]}
                                    </CellBox>
                                </Grid>
                            )
                        )
                    }
                </Grid>
            </WrapTopBox>
            <Grid item xs={12}>
                <Grid container>
                    <WrapTopBox item xs={6}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faCheckToSlot} /> ログイン情報
                            </TopBoxHeader>
                            <TopBoxContent>
                                {
                                    (session)
                                        &&
                                        <>
                                            ようこそ、 <Link href={"/user/"+session.user.id}>{session.user.name} さん！</Link><br/>
                                            <button onClick={()=>signOut()}>サインアウト</button>
                                        </>
                                }
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                    <WrapTopBox item xs={6}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faCircleInfo} /> お知らせ
                            </TopBoxHeader>
                            <TopBoxContent>
                                2023/07/21：リニューアルオープンしました！<br/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>

                    <WrapTopBox item xs={12}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faArrowTrendUp} /> 最近のトレンド
                            </TopBoxHeader>
                            <TopBoxContent>
                                <TrendRanking/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                    <WrapTopBox item xs={12}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faFlag} /> 2023年投稿数ランキング
                            </TopBoxHeader>
                            <TopBoxContent>
                                <PostCountRanking users={users}/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                    <WrapTopBox item xs={12}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faCertificate} /> 新着記録
                            </TopBoxHeader>
                            <TopBoxContent>
                                <NewRecords users={users}/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                </Grid>
            </Grid>
        </Grid>
    </>
  )
}
