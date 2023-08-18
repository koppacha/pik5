import Link from "next/link";
import {Box, Grid, Typography} from "@mui/material";
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
import Head from "next/head";

export async function getServerSideProps(context) {
    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })
    return {
        props: {
            users
        }
    }
}

export default function Home({users}) {

    const {t,r} = useLocale()
    const {data: session } = useSession()

    // ログイン判定によって表示を変更
    const loginName = () => {
        if(!session){
            return {
                name: t.g.login,
                url: "/auth/login",
            }
        } else {
            return {
                name: session.user.name,
                url: "/user/"+session.user.id
            }
        }
    }

    // クイックアクセス
    const quickLinks = [
        [loginName().name, loginName().url],
        [t.g.register, "/auth/register"],
        [t.title[1], "/total/10"],
        [t.title[2], "/total/20"],
        [t.title[3], "/total/30"],
        [t.title[4], "/total/40"],
        [t.g.key, "/keyword"],
        [t.subtitle[1], "/total/1"],
        [t.subtitle[2], "/total/2"],
        [t.g.ru, "/keyword/rules"],
        ["Discord", "https://discord.gg/rQEBJQa"]
    ]

  return (
    <>
        <Head>
            <title>{t.title[0]+" - "+t.t.desc}</title>
        </Head>
        ver.3.01<br/>
        <Typography variant="" className="title">{t.title[0]}</Typography><br/>
        <Typography variant="" className="subtitle">{r.title[0]}</Typography><br/>
        <InfoBox>
            {t.t.welcome}
        </InfoBox>
        <Grid container>
            <WrapTopBox item xs={12}>
                <Grid container>
                    {
                        quickLinks.map(i =>
                            (
                                <Grid item key={i} xs={3} sm={2} component={Link} href={i[1]}>
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
                    <WrapTopBox item xs={12} sm={6}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faTrophy} /> {t.g.events}
                            </TopBoxHeader>
                            <TopBoxContent>
                                <Link href="/keyword/moving" style={{fontSize:"1.1em",textDecoration:"underline"}}>ダンドリバトル大会テスト</Link><br/>
                                <Box style={{padding:"10px",margin:"10px 20px",border:"1px",borderRadius:"8px"}}>
                                    ダンドリバトルを擬似オンラインで行う大会のテストです。<br/>
                                    開催日時：2023/08/19(土)20:00<br/>
                                    開催条件：３人以上<br/>
                                    参加条件：ダンドリバトルを６ステージ解禁していて配信可能な人（声出しは自由）<br/>
                                </Box>

                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                    <WrapTopBox item xs={12} sm={6}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faCircleInfo} /> {t.g.info}
                            </TopBoxHeader>
                            <TopBoxContent>
                                2023/07/29：ピクミン4全28ステージを追加しました。<br/>
                                <hr/>
                                2023/07/21：リニューアルオープンしました！<br/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>

                    <WrapTopBox item xs={12}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faArrowTrendUp} /> {t.g.trend}
                            </TopBoxHeader>
                            <TopBoxContent>
                                <TrendRanking/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                    <WrapTopBox item xs={12}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faFlag} /> {t.g.countRanking}
                            </TopBoxHeader>
                            <TopBoxContent>
                                <PostCountRanking users={users}/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                    <WrapTopBox item xs={12}>
                        <TopBox>
                            <TopBoxHeader>
                                <FontAwesomeIcon icon={faCertificate} />{t.g.newRecord}
                            </TopBoxHeader>
                            <TopBoxContent>
                                <NewRecords users={users}/>
                            </TopBoxContent>
                        </TopBox>
                    </WrapTopBox>
                </Grid>
            </Grid>
        </Grid>
        <br/>
        <button onClick={()=>signOut()}>{t.g.logout}</button>
    </>
  )
}
