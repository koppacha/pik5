import Link from "next/link";
import {Box, Grid, Typography} from "@mui/material";
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
    faCircleInfo,
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
          </InfoBox>
          <Grid container>
              <WrapTopBox item xs={12}>
                  <Grid container>
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
              </WrapTopBox>
              <WrapTopBox item xs={12} sm={6}>
                  <TopBox>
                      <TopBoxHeader>
                          <span><FontAwesomeIcon icon={faCalendarDays}/> イベントカレンダー</span>
                      </TopBoxHeader>
                      <TopBoxContent>
                          <EventContainer>
                              <EventContent>
                                  現在予定されているイベントはありません。
                              </EventContent>
                          </EventContainer>
                          <hr style={{margin:"1em",borderWidth:"1px 0 0 0"}}/>
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
                              textAlign: "right"
                          }}>
                              <FontAwesomeIcon icon={faBullhorn}/> イベント告知チャンネルに投稿されたイベントは順次掲載していきます。
                          </Box>
                      </TopBoxContent>
                  </TopBox>
              </WrapTopBox>
              <WrapTopBox item xs={12} sm={6}>
                  <TopBox>
                      <TopBoxHeader>
                          <span><FontAwesomeIcon icon={faCircleInfo}/> {t.g.info}</span>
                      </TopBoxHeader>
                      <TopBoxContent>
                          <TopBoxContentList>【ver.3.08】ピクミンキーワードをWikiプラットフォームにしました（2024/03/24）</TopBoxContentList>
                          <TopBoxContentList>【ver.3.07】２プレイヤー間スコア比較ツール「ピクチャレ星取表」を追加しました（2024/02/13）</TopBoxContentList>
                          <TopBoxContentList>【ver.3.06】レンダリング方式を変更して表示を高速化しました（2024/01/11）</TopBoxContentList>
                          <TopBoxContentList>【ver.3.05】チーム対抗戦コンポーネントを追加しました（2023/12/16）</TopBoxContentList>
                          {/*<TopBoxContentList>【ver.3.04】イベントセル、期間限定チャレンジ投稿フォーム、新着記録順位、総合ランキングの順位マーカーを追加しました（2023/11/11）</TopBoxContentList>*/}
                          {/*<TopBoxContentList>【ver.3.03】検索機能、ロール機能、コメントにおけるNGワード検知機能を追加しました。（2023/10/08）</TopBoxContentList>*/}
                          {/*<TopBoxContentList>【ver.3.02】移転前の期間限定、参加者企画、チャレンジ複合、その他ランキング全306ステージを移植しました。（2023/09/20）</TopBoxContentList>*/}
                          {/*<TopBoxContentList>【ver.3.01】ピクミン4全28ステージを追加しました。（2023/07/29）</TopBoxContentList>*/}
                          {/*<TopBoxContentList>【ver.3.00】リニューアルオープンしました！（2023/07/21）</TopBoxContentList>*/}
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
