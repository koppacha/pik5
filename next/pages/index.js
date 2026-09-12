import Link from "next/link";
import {Box, Grid, Typography} from "@mui/material";
import React, {useState} from "react";
import {
    AuthButton,
    InfoBox,
    TopBox,
    TopBoxContent,
    TopBoxHeader,
    WrapTopBox
} from "../styles/pik5.css";
import {useLocale} from "../lib/pik5";
import {
    faArrowTrendUp, faBullhorn,
    faCertificate,
    faFlag, faRankingStar
} from "@fortawesome/free-solid-svg-icons";
import {faDiscord} from "@fortawesome/free-brands-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import NewRecords from "../components/top/NewRecords";
import PostCountRanking from "../components/top/PostCountRanking";
import TrendRanking from "../components/top/TrendRanking";
import {useSession, signOut} from "next-auth/react"
import ModalIdeaPost from "../components/modal/ModalIdeaPost";
import DashBoard from "../components/top/DashBoard";
import SeoHead from "../components/SeoHead"
import {toAbsoluteUrl} from "../lib/seo"
import NextEvent from "../components/top/NextEvent"
import PickupVideo from "../components/top/PickupVideo"
import RecentKeywordArticle from "../components/top/RecentKeywordArticle"
import LimitedIdeas from "../components/top/LimitedIdeas"
import MonthlyMnp from "../components/top/MonthlyMnp"

export async function getServerSideProps(context) {
    const { getCachedUsers } = await import("../lib/usersCache")
    const {getServerSession} = await import("next-auth/next")
    const {authOptions} = await import("./api/auth/[...nextauth]")
    const prisma = (await import("../lib/prisma")).default

    // 前回のトレンドをリクエスト
    const prev = await fetch(`http://laravel:8000/api/prev`)
        .then(res => res.ok ? res.json().catch(() => null) : null)
        .catch(() => null)

    // スクリーンネームをリクエスト
    const users = await getCachedUsers()
    const session = await getServerSession(context.req, context.res, authOptions)
    const userSettings = session?.user?.dbId
        ? await prisma.user.findUnique({
            where: {id: session.user.dbId},
            select: {disablePickupVideoAutoplay: true},
        })
        : session?.user?.userId
            ? await prisma.user.findFirst({
                where: {userId: session.user.userId},
                select: {disablePickupVideoAutoplay: true},
            })
            : null

    return {
        props: {
            users,
            prev,
            disablePickupVideoAutoplay: userSettings?.disablePickupVideoAutoplay ?? false,
        }
    }
}

export default function Home({users, prev, disablePickupVideoAutoplay}) {

    const {t,r} = useLocale()
    const {data: session, status: sessionStatus} = useSession()

    // 期間限定ルール投稿モーダル制御関連
    const [editOpen, setEditOpen] = useState(false)
    const [uniqueId, setUniqueId] = useState("")
    const handleEditOpen = () => setEditOpen(true)
    const handleEditClose = () => setEditOpen(false)

    // ウェルカムメッセージ直下のリンク
    const WelcomeBlock =
            <Grid
                container
                spacing={1}
                className="welcome-block"
                columns={{xs: 3, sm: 6}}
                style={{margin: 0, width: "100%"}}
            >
                {[1, 2, 3, 4].map(series => (
                    <Grid item xs={1} key={series}>
                        <Link
                            className="top-series-mini-box"
                            href={`/total/${series}0`}
                        >
                            {t.title[series]}
                        </Link>
                    </Grid>
                ))}
                <Grid item xs={1}>
                    <Link
                        className="top-series-mini-box"
                        href="/keyword"
                    >
                        {t.g.key}
                    </Link>
                </Grid>
                <Grid item xs={1}>
                    <Link
                        className="top-series-mini-box"
                        href="https://discord.gg/rQEBJQa"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FontAwesomeIcon icon={faDiscord} bounce className="welcome-discord-icon"/>Discord
                    </Link>
                </Grid>
            </Grid>
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
          <SeoHead
              title={t.title[0] + " - " + t.t.desc}
              description={t.t.welcome}
              jsonLd={{
                  "@context": "https://schema.org",
                  "@type": "WebSite",
                  name: t.title[0],
                  inLanguage: "ja",
                  url: toAbsoluteUrl("/")
              }}
          />
          <Typography variant="" className="title">{t.title[0]}</Typography><br/>
          <Typography variant="" className="subtitle">{r.title[0]}</Typography><br/>
          <InfoBox className="info-box">
              <Box className="welcome-intro-row">
                  <Box>{t.t.welcome}</Box>
                  {sessionStatus !== "loading" && <Box className="welcome-auth-actions">
                      {!session ? (
                          <>
                              <AuthButton className="welcome-signup-button" component={Link} href="/auth/register">{t.g.register}</AuthButton>
                              <AuthButton component={Link} href="/auth/login">{t.g.login}</AuthButton>
                          </>
                      ) : (
                          <>
                              <AuthButton component={Link} href="/auth/config">{t.g.userConfig}</AuthButton>
                              <AuthButton onClick={() => signOut()}>{t.g.logout}</AuthButton>
                          </>
                      )}
                  </Box>}
              </Box>
              {WelcomeBlock}
          </InfoBox>
          <Grid container spacing={1}>
              {(session) &&
                  <WrapTopBox item xs={12} className="wrap-top-box">
                      <TopBox className="top-box">
                          <DashBoard user={session.user} users={users} simple />
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
              <WrapTopBox item xs={12} sm={6} className="wrap-top-box top-split-column">
                  <Grid container spacing={1} className="top-split-column-grid">
                      <WrapTopBox item xs={12} className="wrap-top-box top-split-column-item">
                          <NextEvent/>
                      </WrapTopBox>
                      <LimitedIdeas/>
                      <WrapTopBox item xs={12} className="wrap-top-box top-split-column-item">
                          <RecentKeywordArticle users={users}/>
                      </WrapTopBox>
                  </Grid>
              </WrapTopBox>
              <WrapTopBox item xs={12} sm={6} className="wrap-top-box">
                  <PickupVideo users={users} disableInitialAutoplay={disablePickupVideoAutoplay}/>
              </WrapTopBox>
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
                          <span><FontAwesomeIcon icon={faRankingStar}/> 月間MVP</span>
                      </TopBoxHeader>
                      <TopBoxContent className="top-box-content">
                          <MonthlyMnp users={users}/>
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
