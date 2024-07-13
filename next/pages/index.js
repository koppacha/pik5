import Link from "next/link";
import {Box, Grid, List, ListItem, Typography} from "@mui/material";
import React, {useState} from "react";
import {
    AuthButton,
    CellBox,
    EventContainer, EventContent, EventDate,
    InfoBox,
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
        [t.title[1], "/total/10"],
        [t.title[2], "/total/20"],
        [t.title[3], "/total/30"],
        [t.title[4], "/total/40"],
        [t.g.key, "/keyword"],
    ]
    // 先月のトレンド
    const PrevTrend = (prev?.trend[0]?.cnt)
                    ? <>先月同時期TOP: {t.stage[prev.trend[0]["stage_id"]]} ({prev.trend[0]["cnt"]} 回）</>
                    : <></>

    // 去年の最多投稿者
    const PrevPost = (prev?.post[0]?.cnt)
                   ? <>前年TOP: {id2name(users, prev.post[0]["user_id"])} ({prev.post[0]["cnt"]} 回）</>
                   : <></>

  return (
      <>
          <Head>
              <title>{t.title[0] + " - " + t.t.desc}</title>
          </Head>
          <Typography variant="" className="title">{t.title[0]}</Typography><br/>
          <Typography variant="" className="subtitle">{r.title[0]}</Typography><br/>
          <InfoBox>
              {t.t.welcome}
              <hr style={{margin: "1em", borderWidth: "1px 0 0 0"}}/>
              <div style={{textAlign:"right"}}>初めての方はまず<Link href="/auth/register">アカウント作成</Link>！</div>
          </InfoBox>
          <Grid container>
              <WrapTopBox item xs={12}>
                  <TopBox>
                      <TopBoxHeader>
                          <span><FontAwesomeIcon icon={faCircleInfo} /> ダッシュボード</span>
                      </TopBoxHeader>
                      <TopBoxContent>
                          <Grid container style={{marginBottom:"8px"}}>
                              {
                                  quickLinks.map(i =>
                                      (
                                          <Grid item key={i} xs={3} sm={2} component={Link} href={i[1]}>
                                              <CellBox style={{padding: "10px 0"}}>
                                                  {i[0]}
                                              </CellBox>
                                          </Grid>
                                      )
                                  )
                              }
                          </Grid>
                          <EventContainer>
                              <EventContent>
                                  <Link href="#" onClick={handleEditOpen}>
                                      <EventContent style={{
                                          textDecoration: "underline",
                                          float: "left",
                                          width: "50%",
                                          backgroundColor: "#333",
                                          borderRadius: "4px",
                                          padding: "8px",
                                          textAlign: "center"
                                      }}>
                                          期間限定ルールを投稿する<br/>
                                      </EventContent>
                                  </Link>
                                  <Link href="/keyword?c=idea">
                                      <EventContent style={{
                                          textDecoration: "underline",
                                          float: "right",
                                          width: "48%",
                                          backgroundColor: "#333",
                                          borderRadius: "4px",
                                          padding: "8px",
                                          textAlign: "center"
                                      }}>
                                          ルールを確認・編集する
                                      </EventContent>
                                  </Link>
                              </EventContent>
                          </EventContainer>
                          <Box style={{
                              borderTop: "1px solid #777",
                              fontSize: "0.8em",
                              color: "#999",
                              textAlign: "right",
                              display: "none"
                          }}>
                              <FontAwesomeIcon icon={faBullhorn}/> イベント告知チャンネルに投稿されたイベントは順次掲載していきます。
                          </Box>
                      </TopBoxContent>
                  </TopBox>
              </WrapTopBox>
              <WrapTopBox item xs={12}>
                  <TopBox>
                      <TopBoxHeader>
                          <span><FontAwesomeIcon icon={faArrowTrendUp}/> {t.g.trend}</span>
                          <span style={{fontSize: "0.8em"}}>{PrevTrend}</span>
                      </TopBoxHeader>
                      <TopBoxContent>
                          <TrendRanking/>
                      </TopBoxContent>
                  </TopBox>
              </WrapTopBox>
              <WrapTopBox item xs={12}>
                  <TopBox>
                      <TopBoxHeader>
                          <span><FontAwesomeIcon icon={faFlag}/> {t.g.countRanking}</span>
                          <span style={{fontSize: "0.8em"}}>{PrevPost}</span>
                      </TopBoxHeader>
                      <TopBoxContent>
                          <PostCountRanking users={users}/>
                      </TopBoxContent>
                  </TopBox>
              </WrapTopBox>
              <WrapTopBox item xs={12}>
                  <TopBox>
                      <TopBoxHeader>
                          <span><FontAwesomeIcon icon={faCertificate}/> {t.g.newRecord}</span>
                      </TopBoxHeader>
                      <TopBoxContent>
                          <NewRecords users={users}/>
                      </TopBoxContent>
                  </TopBox>
              </WrapTopBox>
          </Grid>
          <br/>
          <button onClick={() => signOut()}>{t.g.logout}</button>
          <ModalIdeaPost editOpen={editOpen} uniqueId={uniqueId} handleEditClose={handleEditClose}
                         handleEditOpen={handleEditOpen}/>
      </>
  )
}
