import Link from "next/link";
import {Box, Grid, List, ListItem, Typography} from "@mui/material";
import React, {useState} from "react";
import {
    AuthButton,
    CellBox,
    EventContainer, EventContent, EventDate,
    InfoBox, SeriesTheme,
    TopBox,
    TopBoxContent,
    TopBoxContentList,
    TopBoxHeader,
    WrapTopBox
} from "../styles/pik5.css";
import {id2name, useLocale} from "../lib/pik5";
import {
    faArrowTrendUp, faBullhorn,
    faCalendarDays,
    faCertificate,
    faCircleInfo, faFaceSmileBeam,
    faFlag, faRankingStar
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
import DashBoard from "../components/top/DashBoard";

export async function getServerSideProps(context) {

    // 前回のトレンドをリクエスト
    const res = await fetch(`http://laravel:8000/api/prev`)
    const prev = (res.status < 300) ? await res.json() : null

    // スクリーンネームをリクエスト
    const users = await prisma.user.findMany({
        select: {
            userId: true,
            name: true
        }
    })
    return {
        props: {
            users, prev
        }
    }
}

export default function Home({users, prev}) {

    const {t,r} = useLocale()
    const {data: session } = useSession()

    // 期間限定ルール投稿モーダル制御関連
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
                url: "/user/"+session.user.userId
            }
        }
    }
    // ウェルカムメッセージ直下のリンク
    const WelcomeBlock =
        <>
            <hr style={{margin: "1em", borderWidth: "1px 0 0 0"}}/>
            <Grid container className="welcome-block" columns={{xs: 3.3, sm: 6, md: 7.6, lg: 8}}>
                <Grid item xs={1} underline="none" className="top-series-mini-box" component={Link} href="/total/10">{t.title[1]}</Grid>
                <Grid item xs={1} underline="none" className="top-series-mini-box" component={Link} href="/total/20">{t.title[2]}</Grid>
                <Grid item xs={1} underline="none" className="top-series-mini-box" component={Link} href="/total/30">{t.title[3]}</Grid>
                <Grid item xs={1} underline="none" className="top-series-mini-box" component={Link} href="/total/40">{t.title[4]}</Grid>
                <Grid item xs={1} underline="none" className="top-series-mini-box" component={Link} href="/keyword">{t.g.key}</Grid>
                <Grid item xs={1} underline="none" className="top-series-mini-box" component={Link} href="https://discord.gg/rQEBJQa">Discord</Grid>
                {(!session)
                    ?
                    <>
                        <Grid item xs={1} underline="none" className="top-series-mini-box" component={Link} href="/auth/register">{t.g.register}</Grid>
                        <Grid item xs={1} underline="none" className="top-series-mini-box" component={Link} href="/auth/login">{t.g.login}</Grid>
                    </>
                    :
                    <Grid item xs={1} underline="none" className="top-series-mini-box" component={Link} href="#" onClick={() => signOut()}>{t.g.logout}</Grid>
                }
            </Grid>
        </>
    // 年初来の最多投稿ステージ
    const PrevTrend = (prev?.stage?.cnt)
        ? <>{t.g.trendYear}: {t.stage[prev.stage["stage_id"]]} ({prev.stage["cnt"]} {t.g.countTail}）</>
        : <></>

    // 年初来の参加者数
    const PrevPost = (prev?.posts)
        ? <>{t.g.countAll}: {prev.posts} {t.g.countTail}</>
        : <></>

  return (
      <>
          <Head>
              <title>{t.title[0] + " - " + t.t.desc}</title>
          </Head>
          <Typography variant="" className="title">{t.title[0]}</Typography><br/>
          <Typography variant="" className="subtitle">{r.title[0]}</Typography><br/>
          <InfoBox className="info-box">
              {t.t.welcome}
              {WelcomeBlock}
          </InfoBox>
          <Grid container>
              {(session) &&
                  <WrapTopBox item xs={12} className="wrap-top-box">
                      <TopBox className="top-box">
                          <DashBoard user={session.user} users={users} />
                          <Box style={{
                              borderTop: "1px solid #777",
                              fontSize: "0.8em",
                              color: "#999",
                              textAlign: "right",
                              display: "none"
                          }}>
                              <FontAwesomeIcon icon={faBullhorn}/> イベント告知チャンネルに投稿されたイベントは順次掲載していきます。
                          </Box>
                      </TopBox>
                      <ModalIdeaPost editOpen={editOpen} uniqueId={uniqueId} handleEditClose={handleEditClose} handleEditOpen={handleEditOpen}/>
                  </WrapTopBox>
          }
              <WrapTopBox item xs={12} className="wrap-top-box">
                  <TopBox className="top-box">
                      <TopBoxHeader className="top-box-header">
                          <span><FontAwesomeIcon icon={faArrowTrendUp}/> {t.g.trend}</span>
                          <span style={{fontSize: "0.8em"}}>{PrevTrend}</span>
                      </TopBoxHeader>
                      <TopBoxContent className="top-box-content">
                          <TrendRanking/>
                      </TopBoxContent>
                  </TopBox>
              </WrapTopBox>
              <WrapTopBox item xs={12} className="wrap-top-box">
                  <TopBox className="top-box">
                      <TopBoxHeader className="top-box-header">
                          <span><FontAwesomeIcon icon={faFlag}/> {t.g.countRanking}</span>
                          <span style={{fontSize: "0.8em"}}>{PrevPost}</span>
                      </TopBoxHeader>
                      <TopBoxContent className="top-box-content">
                          <PostCountRanking users={users}/>
                      </TopBoxContent>
                  </TopBox>
              </WrapTopBox>
              <WrapTopBox item xs={12} className="wrap-top-box">
                  <TopBox>
                      <TopBoxHeader className="top-box-header">
                          <span><FontAwesomeIcon icon={faCertificate}/> {t.g.newRecord}</span>
                      </TopBoxHeader>
                      <TopBoxContent className="top-box-content">
                          <NewRecords users={users}/>
                      </TopBoxContent>
                  </TopBox>
              </WrapTopBox>
          </Grid>
      </>
  )
}
