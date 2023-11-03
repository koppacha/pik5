import Link from "next/link";
import {Box, Grid, Typography} from "@mui/material";
import React, {useState} from "react";
import {CellBox, InfoBox, TopBox, TopBoxContent, TopBoxContentList, TopBoxHeader, WrapTopBox} from "../styles/pik5.css";
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
import ModalKeywordEdit from "../components/modal/ModalKeywordEdit";
import {mutate} from "swr";
import ModalIdeaPost from "../components/modal/ModalIdeaPost";
import PostButton from "../components/PostButton";

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

    // モーダル制御関連
    const [editOpen, setEditOpen] = useState(false)
    const [uniqueId, setUniqueId] = useState("")
    const handleEditOpen = () => setEditOpen(true)
    const handleEditClose = () => setEditOpen(false)

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
                                <Link href="#" target="_blank" style={{fontSize:"1.1em",textDecoration:"underline"}}></Link><br/>
                                <Box style={{padding:"10px",margin:"10px 20px",border:"1px",borderRadius:"8px"}}>
                                    現在開催予定のイベントはありません。<br/>
                                    <PostButton voteId={20231019}/>
                                    <Link href="#" onClick={handleEditOpen}>期間限定チャレンジルールを投稿する</Link>
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
                                <TopBoxContentList>【ver.3.03】検索機能、ロール機能、コメントにおけるNGワード検知機能を追加しました。（2023/10/08）</TopBoxContentList>
                                <TopBoxContentList>【ver.3.02】移転前の期間限定、参加者企画、チャレンジ複合、その他ランキング全306ステージを移植しました。（2023/09/20）</TopBoxContentList>
                                <TopBoxContentList>【ver.3.01】ピクミン4全28ステージを追加しました。（2023/07/29）</TopBoxContentList>
                                {/*<TopBoxContentList>【ver.3.00】リニューアルオープンしました！（2023/07/21）</TopBoxContentList>*/}
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
        <ModalIdeaPost editOpen={editOpen} uniqueId={uniqueId} handleEditClose={handleEditClose} handleEditOpen={handleEditOpen}/>
    </>
  )
}
